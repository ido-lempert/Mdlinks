// Idempotency-keys demo: a coupon-claim endpoint on a stories/banners SaaS (TaleArt-like world).
// Zero-dependency Node. Two endpoints share one ledger:
//   POST /api/naive/claim      - no protection: every retry is a new claim
//   POST /api/idempotent/claim - Idempotency-Key header: first result is stored and replayed
// Artificial 900ms processing delay lets us lose a response mid-flight on purpose.
import http from 'node:http';

const claims = [];            // the business ledger: one row per claimed coupon
const keys = new Map();       // idempotency store: key -> { status, payloadHash, response }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16); };

async function readBody(req) { let b = ''; for await (const c of req) b += c; return JSON.parse(b || '{}'); }

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/ledger') return send(200, { claims });
  if (req.method === 'POST' && req.url === '/reset') { claims.length = 0; keys.clear(); return send(200, { ok: true }); }
  if (req.method !== 'POST') return send(404, {});

  const body = await readBody(req);
  const user = body.user || 'anonymous';

  if (req.url === '/api/naive/claim') {
    await sleep(900);                              // work happens here...
    const claim = { id: claims.length + 1, user, coupon: 'FLASH50', at: Date.now() };
    claims.push(claim);                            // ...and the write is already committed
    return send(201, { claim });                   // if THIS response is lost, the client will retry blind
  }

  if (req.url === '/api/idempotent/claim') {
    const key = req.headers['idempotency-key'];
    if (!key) return send(400, { error: 'Idempotency-Key header required' });
    const payloadHash = hash(JSON.stringify(body));
    const existing = keys.get(key);
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        return send(422, { error: 'same key, different payload - rejected', key });
      if (existing.status === 'in-flight')
        return send(409, { error: 'request with this key is still processing - retry shortly', key });
      return send(200, { claim: existing.response.claim, replayed: true });   // stored result, not a new claim
    }
    keys.set(key, { status: 'in-flight', payloadHash });
    await sleep(900);
    const claim = { id: claims.length + 1, user, coupon: 'FLASH50', at: Date.now() };
    claims.push(claim);
    keys.set(key, { status: 'done', payloadHash, response: { claim } });
    return send(201, { claim });
  }
  return send(404, {});
});
server.listen(4290, () => console.log('idempotency demo on :4290'));
