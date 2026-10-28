// Streaming file POC - zero-dependency Node server.
// Upload a file -> get a stream link. Paste the link -> the browser streams and assembles it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(ROOT, 'public');
const PORT = process.env.PORT || 4173;
fs.mkdirSync(DATA, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const safeName = (n) => path.basename(String(n || 'file.bin')).replace(/[^\w.\- ]+/g, '_');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-file-name, content-type, range');
  res.setHeader('Access-Control-Expose-Headers', 'content-length, content-range, accept-ranges');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function listFiles() {
  return fs.readdirSync(DATA).filter(f => !f.endsWith('.part')).map(f => {
    const st = fs.statSync(path.join(DATA, f));
    const [id, ...rest] = f.split('--');
    return { id, name: rest.join('--') || f, size: st.size, streamUrl: `/stream/${id}/${encodeURIComponent(rest.join('--') || f)}` };
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // POST /api/upload  (raw bytes, filename in x-file-name)
  if (req.method === 'POST' && u.pathname === '/api/upload') {
    const id = crypto.randomBytes(6).toString('hex');
    const name = safeName(req.headers['x-file-name']);
    const dest = path.join(DATA, `${id}--${name}`);
    const tmp = dest + '.part';
    const ws = fs.createWriteStream(tmp);
    let size = 0;
    req.on('data', (c) => { size += c.length; });
    req.pipe(ws);
    ws.on('finish', () => {
      fs.renameSync(tmp, dest);
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id, name, size, streamUrl: `/stream/${id}/${encodeURIComponent(name)}` }));
    });
    ws.on('error', (e) => { res.writeHead(500); res.end(String(e)); });
    return;
  }

  // POST /api/demo -> create the 50MB demo if needed and return its stream link
  if (req.method === 'POST' && u.pathname === '/api/demo') {
    const { execFile } = await import('node:child_process');
    execFile(process.execPath, [path.join(ROOT, 'make-demo.mjs')], () => {
      const demo = listFiles().find(f => f.name.startsWith('demo-content-50mb'));
      if (demo) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(demo)); }
      else { res.writeHead(500); res.end('demo failed'); }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/api/files') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(listFiles()));
  }

  // GET /stream/:id/:name  -> the link you paste into the text field
  const m = u.pathname.match(/^\/stream\/([^/]+)\/(.+)$/);
  if (req.method === 'GET' && m) {
    const file = path.join(DATA, `${m[1]}--${safeName(decodeURIComponent(m[2]))}`);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    const size = fs.statSync(file).size;
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    let start = 0, end = size - 1, status = 200;
    if (range) { start = +range[1]; if (range[2]) end = Math.min(+range[2], size - 1); status = 206; }
    res.writeHead(status, {
      'content-type': 'application/octet-stream',
      'content-length': end - start + 1,
      'accept-ranges': 'bytes',
      ...(status === 206 ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}),
      'content-disposition': `attachment; filename="${safeName(decodeURIComponent(m[2]))}"`,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }

  // static
  const p = path.join(PUBLIC, u.pathname === '/' ? 'index.html' : safeName(u.pathname));
  if (fs.existsSync(p) && p.startsWith(PUBLIC)) {
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    return fs.createReadStream(p).pipe(res);
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, () => console.log(`streaming-poc on http://localhost:${PORT}`));
