// Relay: drains unpublished outbox rows to the queue, then marks them published.
// If it dies between queue insert and mark, the row is re-published on the next run (at-least-once).
import { openDb } from './db.ts';
const db = openDb(process.argv[2]);
const dieMid = process.argv[3] === '--die-mid-publish';

const rows = db.prepare(`SELECT * FROM outbox WHERE published_at IS NULL ORDER BY created_at`).all() as any[];
for (const r of rows) {
  db.prepare(`INSERT INTO events(id,type,payload) VALUES(?,?,?)`).run(r.id, r.type, r.payload);
  if (dieMid) { console.log(`CRASH: relay died after queueing ${r.id}, before marking`); process.exit(1); }
  db.prepare(`UPDATE outbox SET published_at=? WHERE id=?`).run(new Date().toISOString(), r.id);
  console.log(`relayed ${r.type} for tale ${r.tale_id}`);
}
if (!rows.length) console.log('outbox empty');
