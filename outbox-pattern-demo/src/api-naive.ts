// The pre-outbox design: two independent writes, no shared transaction.
import { openDb } from './db.ts';
const db = openDb(process.argv[2]);
const taleId = process.argv[3];
const crash = process.argv[4] === '--crash-between';

db.exec('BEGIN');
db.prepare(`UPDATE tales SET status='published' WHERE id=?`).run(taleId);
db.exec('COMMIT');                          // write 1: database committed
if (crash) { console.log('CRASH: process died after DB commit, before queue publish'); process.exit(1); }
db.prepare(`INSERT INTO events(id,type,payload) VALUES(?,?,?)`)  // write 2: queue publish
  .run(crypto.randomUUID(), 'tale.published', JSON.stringify({ taleId }));
console.log('naive publish completed');
