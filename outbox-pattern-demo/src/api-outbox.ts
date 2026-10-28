// The outbox design: business row + outbox row in ONE transaction. Nothing else is sent from here.
import { openDb } from './db.ts';
const db = openDb(process.argv[2]);
const taleId = process.argv[3];
const crash = process.argv[4] === '--crash-after-commit';

db.exec('BEGIN IMMEDIATE');
db.prepare(`UPDATE tales SET status='published' WHERE id=?`).run(taleId);
db.prepare(`INSERT INTO outbox(id,tale_id,type,payload,created_at) VALUES(?,?,?,?,?)`)
  .run(crypto.randomUUID(), taleId, 'tale.published', JSON.stringify({ taleId }), new Date().toISOString());
db.exec('COMMIT');                          // both writes commit or neither does
if (crash) { console.log('CRASH: process died right after commit; outbox row is safe'); process.exit(1); }
console.log('outbox publish committed');
