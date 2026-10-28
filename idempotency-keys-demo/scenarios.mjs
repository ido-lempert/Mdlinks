// Four scenarios against the demo server, narrated to stdout.
const BASE = 'http://localhost:4290';
const post = (path, body, headers = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ledger = async () => (await (await fetch(BASE + '/ledger')).json()).claims;
const reset = () => post('/reset', {});
const say = (s) => console.log(s);

await reset();
say('--- Scenario 1: naive endpoint, response lost in flight ---');
say('client: POST /api/naive/claim {user:"dana"} ... server commits, response lost (simulated)');
const lost = post('/api/naive/claim', { user: 'dana' });           // we never await: the client "gives up"
await new Promise(r => setTimeout(r, 1100));                       // server finished in the background
say('client: no answer after timeout -> RETRY the same intent');
const retry = await (await post('/api/naive/claim', { user: 'dana' })).json();
say(`ledger now holds ${(await ledger()).length} claims for dana: ` + JSON.stringify(await ledger()));
say('>> one click, two coupons. The retry was blind.\n');

await reset();
say('--- Scenario 2: same failure, idempotent endpoint ---');
const key = crypto.randomUUID();
say(`client: POST /api/idempotent/claim {user:"dana"} Idempotency-Key: ${key} ... response lost again`);
const lost2 = post('/api/idempotent/claim', { user: 'dana' }, { 'idempotency-key': key });
await new Promise(r => setTimeout(r, 1100));
say('client: timeout -> RETRY with the SAME key');
const replay = await (await post('/api/idempotent/claim', { user: 'dana' }, { 'idempotency-key': key })).json();
say(`server answered: ` + JSON.stringify(replay));
say(`ledger holds ${(await ledger()).length} claim(s): ` + JSON.stringify(await ledger()));
say('>> the stored result was replayed; no second claim.\n');

await reset();
say('--- Scenario 3: double-click while the first request is still processing ---');
const k3 = crypto.randomUUID();
const a = post('/api/idempotent/claim', { user: 'eli' }, { 'idempotency-key': k3 });
await new Promise(r => setTimeout(r, 200));                        // first is mid-flight
const b = await (await post('/api/idempotent/claim', { user: 'eli' }, { 'idempotency-key': k3 })).json();
say('second click got: ' + JSON.stringify(b));
const aRes = await (await a).json();
say('first click got:  ' + JSON.stringify(aRes));
say(`ledger holds ${(await ledger()).length} claim(s).`);
say('>> concurrent duplicate is told to wait, not given a second claim.\n');

await reset();
say('--- Scenario 4: same key, different payload ---');
const k4 = crypto.randomUUID();
await post('/api/idempotent/claim', { user: 'eli' }, { 'idempotency-key': k4 });
await new Promise(r => setTimeout(r, 1100));
const mismatch = await post('/api/idempotent/claim', { user: 'someone-else' }, { 'idempotency-key': k4 });
say(`status ${mismatch.status}: ` + JSON.stringify(await mismatch.json()));
say('>> a key is bound to its payload; reuse with a different body is rejected.');
