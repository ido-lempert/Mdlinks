const $ = (id) => document.getElementById(id);
const fmtMB = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
const sparkCtx = $('spark').getContext('2d');
const samples = [];
function drawSpark() {
  const w = $('spark').width, h = $('spark').height;
  sparkCtx.clearRect(0, 0, w, h);
  if (samples.length < 2) return;
  const max = Math.max(...samples, 1);
  sparkCtx.strokeStyle = '#41e0a3'; sparkCtx.lineWidth = 2; sparkCtx.beginPath();
  samples.forEach((s, i) => {
    const x = (i / (samples.length - 1)) * w, y = h - (s / max) * (h - 6) - 3;
    i ? sparkCtx.lineTo(x, y) : sparkCtx.moveTo(x, y);
  });
  sparkCtx.stroke();
}

// 1. Upload with progress, get the stream link
$('uploadBtn').onclick = () => {
  const f = $('fileInput').files[0];
  if (!f) { $('upStatus').textContent = 'Pick a file first.'; return; }
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');
  xhr.setRequestHeader('x-file-name', f.name);
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      $('upFill').style.width = (100 * e.loaded / e.total) + '%';
      $('upStatus').textContent = `uploading ${fmtMB(e.loaded)} / ${fmtMB(e.total)}`;
    }
  };
  xhr.onload = () => showLink(JSON.parse(xhr.responseText));
  xhr.send(f);
};
$('demoBtn').onclick = async () => {
  $('upStatus').textContent = 'preparing 50MB demo on the server...';
  const r = await fetch('/api/files');
  const files = await r.json();
  const demo = files.find(x => x.name.startsWith('demo-content-50mb'));
  showLink(demo || (await (await fetch('/api/demo', { method: 'POST' })).json()));
  $('upStatus').textContent = '50MB demo ready.';
};
function showLink(meta) {
  const url = location.origin + meta.streamUrl;
  $('linkOut').value = url;
  $('linkIn').value = url;
  $('linkRow').classList.remove('hidden');
  $('upStatus').textContent = `stored "${meta.name}" (${fmtMB(meta.size)}) - stream link ready`;
}
$('copyBtn').onclick = () => navigator.clipboard.writeText($('linkOut').value);

// 2. Paste the link, stream and assemble
$('startBtn').onclick = async () => {
  const url = $('linkIn').value.trim();
  if (!url) { $('dlStatus').textContent = 'Paste a stream link first.'; return; }
  $('dlStatus').textContent = 'connecting...';
  $('dlFill').style.width = '0%'; samples.length = 0;
  const res = await fetch(url);
  if (!res.ok || !res.body) { $('dlStatus').textContent = 'fetch failed: ' + res.status; return; }
  const total = +res.headers.get('content-length') || 0;
  const name = decodeURIComponent(url.split('/').pop() || 'download.bin');

  let writable = null;
  if ($('diskMode').checked && 'showSaveFilePicker' in window) {
    try {
      const handle = await showSaveFilePicker({ suggestedName: name });
      writable = await handle.createWritable();
    } catch { writable = null; }
  }
  const parts = writable ? null : [];
  const reader = res.body.getReader();
  let got = 0, t0 = performance.now(), lastT = t0, lastB = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (writable) await writable.write(value); else parts.push(value);
    got += value.length;
    const now = performance.now();
    if (now - lastT > 200) {
      const mbps = ((got - lastB) / 1048576) / ((now - lastT) / 1000);
      samples.push(mbps); if (samples.length > 120) samples.shift(); drawSpark();
      lastT = now; lastB = got;
      if (total) $('dlFill').style.width = (100 * got / total) + '%';
      $('dlStatus').textContent = `streaming ${fmtMB(got)}${total ? ' / ' + fmtMB(total) : ''} - ${mbps.toFixed(1)} MB/s - ${writable ? 'writing to disk' : 'assembling in memory'}`;
    }
  }
  if (total) $('dlFill').style.width = '100%';
  if (writable) { await writable.close(); }
  else {
    const blob = new Blob(parts);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  }
  const secs = (performance.now() - t0) / 1000;
  $('dlStatus').textContent = `done - ${fmtMB(got)} in ${secs.toFixed(1)}s (${(got / 1048576 / secs).toFixed(1)} MB/s avg) -> "${name}"`;
};
