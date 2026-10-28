// Consumer: applies queue events to the dashboard, idempotently.
import { openDb } from './db.ts';
const db = openDb(process.argv[2]);
const events = db.prepare(`SELECT * FROM events ORDER BY seq`).all() as any[];
let applied = 0, dupes = 0;
for (const e of events) {
  const { taleId } = JSON.parse(e.payload);
  db.exec('BEGIN IMMEDIATE');              // write lock first: check-and-insert are one atomic unit
  if (db.prepare(`SELECT 1 FROM processed WHERE event_id=?`).get(e.id)) { db.exec('ROLLBACK'); dupes++; continue; }
  db.prepare(`INSERT INTO dashboard(tale_id,status,applied_count) VALUES(?,?,1)
              ON CONFLICT(tale_id) DO UPDATE SET status=excluded.status, applied_count=applied_count+1`)
    .run(taleId, 'published');
  db.prepare(`INSERT INTO processed(event_id) VALUES(?)`).run(e.id);
  db.exec('COMMIT');
  applied++;
}
console.log(`consumer applied=${applied} duplicatesSkipped=${dupes}`);
