import { publishChain, reconstructChain, sha256Hex } from '/chain-lib.mjs';
const $ = (id) => document.getElementById(id);
const RELAY = location.origin;
const fmtMB = (n) => (n / 1048576).toFixed(1) + ' MB';
let pending = null; // { name, bytes }

$('fileInput').onchange = () => {
  const f = $('fileInput').files[0];
  if (f) { pending = null; $('pubStatus').textContent = `selected "${f.name}" (${fmtMB(f.size)})`; }
};
$('demoBtn').onclick = () => {
  const SIZE = 50 * 1024 * 1024;
  const bytes = new Uint8Array(SIZE);
  let x = 123456789;
  for (let i = 0; i < SIZE; i++) { x = (1103515245 * x + 12345) & 0x7fffffff; bytes[i] = x & 0xff; }
  pending = { name: 'demo-content-50mb.bin', bytes };
  $('pubStatus').textContent = '50MB deterministic demo content generated in-browser.';
};
$('pubBtn').onclick = async () => {
  let { name, bytes } = pending || {};
  if (!bytes) {
    const f = $('fileInput').files[0];
    if (!f) { $('pubStatus').textContent = 'Pick a file or generate the demo first.'; return; }
    name = f.name; bytes = new Uint8Array(await f.arrayBuffer());
  }
  $('pubFill').style.width = '0%';
  const t0 = performance.now();
  const replicas = +$('replicas').value || 2;
  const id = await publishChain(RELAY, name, bytes, { replicas,
    onProgress: (d, t) => { $('pubFill').style.width = (100 * d / t) + '%'; $('pubStatus').textContent = `publishing chunk ${d}/${t} (x${replicas} replicas)`; } });
  const link = `${RELAY}/posts/${id}`;
  $('linkOut').value = link; $('linkIn').value = link;
  $('linkRow').classList.remove('hidden');
  $('pubStatus').textContent = `chain published in ${((performance.now() - t0) / 1000).toFixed(1)}s - share the link`;
};
$('copyBtn').onclick = () => navigator.clipboard.writeText($('linkOut').value);
$('startBtn').onclick = async () => {
  const link = $('linkIn').value.trim();
  const id = link.split('/').pop();
  if (!id) { $('dlStatus').textContent = 'Paste a start-of-chain link first.'; return; }
  if ($('chaos').checked) {
    const p0 = JSON.parse((await (await fetch(`${RELAY}/posts/${id}`)).json()).body);
    let killed = 0;
    for (const e of p0.entries) { if (killed < 5 && e.ids.length > 1 && Math.random() < 0.5) { await fetch(`${RELAY}/posts/${e.ids[0]}`, { method: 'DELETE' }); killed++; } }
    $('dlStatus').textContent = `fault injection: killed ${killed} single replicas`;
  }
  $('dlFill').style.width = '0%';
  try {
    const t0 = performance.now();
    const { name, bytes, stats } = await reconstructChain(RELAY, id, {
      onProgress: (done, total) => { $('dlFill').style.width = (100 * done / total) + '%'; $('dlStatus').textContent = `rebuilding ${fmtMB(done)} / ${fmtMB(total)}`; } });
    const blob = new Blob([bytes]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
    $('dlFill').style.width = '100%';
    $('dlStatus').textContent = `done - "${name}" ${fmtMB(bytes.length)} in ${((performance.now() - t0) / 1000).toFixed(1)}s, sha256 verified, ${stats.chunks} chunks, ${stats.replicaFills} replica fills`;
  } catch (e) {
    $('dlStatus').textContent = 'FAILED: ' + e.message;
  }
};
