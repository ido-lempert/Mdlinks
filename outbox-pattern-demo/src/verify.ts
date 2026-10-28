import { openDb } from './db.ts';
const db = openDb(process.argv[2]);
const taleId = process.argv[3];
const tale = db.prepare(`SELECT status FROM tales WHERE id=?`).get(taleId) as any;
const dash = db.prepare(`SELECT status FROM dashboard WHERE tale_id=?`).get(taleId) as any;
const outboxPending = (db.prepare(`SELECT count(*) c FROM outbox WHERE published_at IS NULL`).get() as any).c;
console.log(JSON.stringify({ dbStatus: tale?.status ?? null, dashboardStatus: dash?.status ?? null, outboxPending }));
