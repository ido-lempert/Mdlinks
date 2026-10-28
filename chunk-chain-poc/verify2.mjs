import { publishChain, reconstructChain, CHUNK_RAW, sha256Hex } from './chain-lib.mjs';
const RELAY = 'http://localhost:4291';
const bytes = new Uint8Array(6 * 1024 * 1024);
let x = 42; for (let i = 0; i < bytes.length; i++) { x = (1103515245 * x + 12345) & 0x7fffffff; bytes[i] = x & 0xff; }
const id = await publishChain(RELAY, 'replica-test-6mb.bin', bytes);
const p0 = JSON.parse((await (await fetch(`${RELAY}/posts/${id}`)).json()).body);
for (const idx of [3, 77]) await fetch(`${RELAY}/posts/${p0.entries[idx].ids[0]}`, { method: 'DELETE' });
const r = await reconstructChain(RELAY, id);
console.log('replica-fill path: OK,', JSON.stringify(r.stats), 'identical:', (await sha256Hex(r.bytes)) === (await sha256Hex(bytes)));
