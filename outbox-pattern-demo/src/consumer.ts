// Consumer: applies queue events to the dashboard, idempotently.
import { openDb } from './db.ts';
const db = openDb(process.argv[2]);
const events = db.prepare(`SELECT * FROM events ORDER BY seq`).all() as any[];
let applied = 0, dupes = 0;
for (const e of events) {
  if (db.prepare(`SELECT 1 FROM processed WHERE event_id=?`).get(e.id)) { dupes++; continue; }
  const { taleId } = JSON.parse(e.payload);
  db.exec('BEGIN IMMEDIATE');
  db.prepare(`INSERT INTO dashboard(tale_id,status) VALUES(?,?) ON CONFLICT(tale_id) DO UPDATE SET status=excluded.status`)
    .run(taleId, 'published');
  db.prepare(`INSERT INTO processed(event_id) VALUES(?)`).run(e.id);
  db.exec('COMMIT');
  applied++;
}
console.log(`consumer applied=${applied} duplicatesSkipped=${dupes}`);
