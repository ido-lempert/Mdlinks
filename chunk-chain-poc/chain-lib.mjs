// Shared chunk-chain logic: file <-> chained text posts. Works in Node and the browser.
// Layout: one manifest post + N chunk posts (x replicas). The manifest post's URL is the share link.
export const CHUNK_RAW = 48 * 1024; // 48KB raw -> ~64KB base64, fits a 70KB text-post cap

export async function sha256Hex(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function toBase64(bytes) {
  let s = ''; const B = 0x8000;
  for (let i = 0; i < bytes.length; i += B) s += String.fromCharCode(...bytes.subarray(i, i + B));
  return btoa(s);
}
export function fromBase64(b64) {
  const s = atob(b64); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Publish: returns the manifest post id (the share link's tail). onProgress(done, total).
export async function publishChain(relay, name, bytes, { replicas = 2, onProgress } = {}) {
  const total = Math.ceil(bytes.length / CHUNK_RAW);
  const chunks = [];
  for (let i = 0; i < total; i++) {
    const part = bytes.subarray(i * CHUNK_RAW, (i + 1) * CHUNK_RAW);
    const body = JSON.stringify({ body: JSON.stringify({ i, b64: toBase64(part) }) });
    const ids = [];
    for (let r = 0; r < replicas; r++) {
      const res = await fetch(`${relay}/posts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      if (!res.ok) throw new Error('relay refused chunk ' + i + ': ' + res.status);
      ids.push((await res.json()).id);
    }
    chunks.push({ ids, sha: await sha256Hex(part), len: part.length });
    onProgress?.(i + 1, total);
  }
  // The manifest itself can exceed a post cap on big files, so it is chained too:
  // parts of MANIFEST_PART entries, each pointing at the next part; the share link is part 0.
  const MANIFEST_PART = 120;
  const head = { v: 1, name, size: bytes.length, chunkSize: CHUNK_RAW, sha256: await sha256Hex(bytes), total: chunks.length };
  const groups = [];
  for (let i = 0; i < chunks.length; i += MANIFEST_PART) groups.push(chunks.slice(i, i + MANIFEST_PART));
  let next = null;
  for (let g = groups.length - 1; g >= 0; g--) {
    const part = { ...head, part: g, entries: groups[g], next };
    const res = await fetch(`${relay}/posts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: JSON.stringify(part) }) });
    if (!res.ok) throw new Error('relay refused manifest part ' + g + ': ' + res.status);
    next = (await res.json()).id;
  }
  return next;
}

// Reconstruct from the share link id. Returns { name, bytes, stats }. Throws on unrecoverable chunk.
export async function reconstructChain(relay, manifestId, { onProgress } = {}) {
  const mres = await fetch(`${relay}/posts/${manifestId}`);
  if (!mres.ok) throw new Error('start link dead: manifest post is gone (' + mres.status + ')');
  const first = JSON.parse((await mres.json()).body);
  const chunks = [...first.entries];
  let next = first.next;
  while (next) {
    const r = await fetch(`${relay}/posts/${next}`);
    if (!r.ok) throw new Error('manifest chain broken at part after ' + chunks.length + ' entries');
    const p = JSON.parse((await r.json()).body);
    chunks.push(...p.entries);
    next = p.next;
  }
  const manifest = { ...first, chunks };
  const out = new Uint8Array(manifest.size);
  const stats = { chunks: manifest.chunks.length, replicaFills: 0, missing: [] };
  let off = 0;
  for (const c of manifest.chunks) {
    let part = null;
    for (const id of c.ids) {
      const r = await fetch(`${relay}/posts/${id}`);
      if (r.ok) { part = fromBase64(JSON.parse((await r.json()).body).b64); break; }
      stats.replicaFills++;
    }
    if (!part) { stats.missing.push(c.ids[0]); continue; }
    if (await sha256Hex(part) !== c.sha) throw new Error('chunk hash mismatch at offset ' + off);
    out.set(part, off); off += part.length;
    onProgress?.(off, manifest.size);
  }
  if (stats.missing.length) { const e = new Error('unrecoverable: ' + stats.missing.length + ' chunk(s) gone from all replicas'); e.stats = stats; throw e; }
  if (await sha256Hex(out) !== manifest.sha256) throw new Error('whole-file hash mismatch');
  return { name: manifest.name, bytes: out, stats };
}
