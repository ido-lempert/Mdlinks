// Simulated public text-post relay for the chunk-chain POC.
// Stands in for "a place that lets you post text" - it is NOT a real portal.
// POST /posts {body, prev} -> {id}   GET /posts/:id -> {id, body, prev}   DELETE /posts/:id (fault injection)
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };

const posts = new Map();
const readBody = async (req) => { let b = ''; for await (const c of req) b += c; return b; };

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/posts') {
    const { body, prev } = JSON.parse(await readBody(req) || '{}');
    if (typeof body !== 'string' || body.length > 70000) { res.writeHead(413); return res.end('{"error":"post too large"}'); }
    const id = crypto.randomBytes(8).toString('hex');
    posts.set(id, { id, body, prev: prev || null, at: Date.now() });
    res.writeHead(201, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id }));
  }
  const m = u.pathname.match(/^\/posts\/([a-f0-9]{16})$/);
  if (m) {
    const p = posts.get(m[1]);
    if (req.method === 'GET') {
      if (!p) { res.writeHead(404); return res.end('{"error":"post gone"}'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(p));
    }
    if (req.method === 'DELETE') { posts.delete(m[1]); res.writeHead(200); return res.end('{}'); }
  }
  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/chain-lib.mjs' || u.pathname.startsWith('/app.') || u.pathname === '/style.css')) {
    const p = path.join(u.pathname === '/chain-lib.mjs' ? ROOT : path.join(ROOT, 'public'), u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
    if (fs.existsSync(p)) { res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'text/plain' }); return fs.createReadStream(p).pipe(res); }
  }
  if (req.method === 'GET' && u.pathname === '/stats') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ posts: posts.size }));
  }
  res.writeHead(404); res.end('{}');
}).listen(4291, () => console.log('simulated text-post relay on :4291'));
