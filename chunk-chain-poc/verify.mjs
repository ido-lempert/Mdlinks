// Headless end-to-end: 50MB deterministic content -> publish chain -> reconstruct -> fault injection -> re-reconstruct.
import { publishChain, reconstructChain, CHUNK_RAW, sha256Hex } from './chain-lib.mjs';
const RELAY = 'http://localhost:4291';
const SIZE = 50 * 1024 * 1024;

// deterministic 50MB (same generator as the article demo content)
const bytes = new Uint8Array(SIZE);
let x = 123456789;
for (let i = 0; i < SIZE; i++) { x = (1103515245 * x + 12345) & 0x7fffffff; bytes[i] = x & 0xff; }
console.log('content:', SIZE, 'bytes, sha256', await sha256Hex(bytes));

const t0 = Date.now();
const manifestId = await publishChain(RELAY, 'demo-content-50mb.bin', bytes, {
  onProgress: (d, t) => { if (d % 200 === 0 || d === t) console.log(`publish ${d}/${t} chunks`); },
});
console.log(`published in ${((Date.now() - t0) / 1000).toFixed(1)}s; share link: ${RELAY}/posts/${manifestId}`);

const t1 = Date.now();
const r1 = await reconstructChain(RELAY, manifestId);
console.log(`reconstruct #1 OK in ${((Date.now() - t1) / 1000).toFixed(1)}s:`, JSON.stringify(r1.stats));
console.log('identical to source:', r1.bytes.length === SIZE && (await sha256Hex(r1.bytes)) === (await sha256Hex(bytes)));

// fault injection: delete 3 chunk posts (one replica each of 2 chunks, BOTH replicas of 1 chunk)
const p0 = JSON.parse((await (await fetch(`${RELAY}/posts/${manifestId}`)).json()).body);
const allEntries = [...p0.entries]; let nx = p0.next;
while (nx) { const p = JSON.parse((await (await fetch(`${RELAY}/posts/${nx}`)).json()).body); allEntries.push(...p.entries); nx = p.next; }
const victimA = allEntries[10].ids[0], victimB = allEntries[250].ids[0];
const doomed = allEntries[500].ids;
for (const id of [victimA, victimB, ...doomed]) await fetch(`${RELAY}/posts/${id}`, { method: 'DELETE' });
console.log('fault injected: removed 1 replica of chunks 10 & 250, BOTH replicas of chunk 500');

try {
  const r2 = await reconstructChain(RELAY, manifestId);
  console.log('UNEXPECTED success', JSON.stringify(r2.stats));
} catch (e) {
  console.log('reconstruct #2 correctly failed:', e.message);
}
// restore chunk 500 replicas by reposting identical bodies (reader-consented re-replication, simulated locally)
const part500 = bytes.subarray(500 * CHUNK_RAW, 501 * CHUNK_RAW);
const { toBase64 } = await import('./chain-lib.mjs');
const body500 = JSON.stringify({ body: JSON.stringify({ i: 500, b64: toBase64(part500) }) });
for (let k = 0; k < 2; k++) await fetch(`${RELAY}/posts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body500 });
// NOTE: reposting creates NEW ids; a real manifest would need mutable pointers. Verify replica-fill path instead:
// delete only one replica of two chunks and confirm failover + exact bytes.
const r3 = await reconstructChain(RELAY, manifestId).catch(e => e);
console.log('reconstruct #3:', r3.message || 'OK ' + JSON.stringify(r3.stats));
