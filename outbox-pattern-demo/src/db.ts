import { DatabaseSync } from 'node:sqlite';

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS tales(
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
    );
    CREATE TABLE IF NOT EXISTS outbox(
      id TEXT PRIMARY KEY,
      tale_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      published_at TEXT
    );
    CREATE TABLE IF NOT EXISTS events(        -- the "message queue", as a table so it survives process death
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed(     -- consumer idempotency ledger
      event_id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS dashboard(     -- what the dashboard currently shows
      tale_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      applied_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
}
