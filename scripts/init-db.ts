/**
 * Initialize the SQLite database with the schema
 * Run: npx tsx scripts/init-db.ts
 */
import Database from "better-sqlite3";
import path from "path";

const dbFile = path.resolve(process.cwd(), "prisma", "dev.db");
const db = new Database(dbFile);

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    ministry TEXT NOT NULL,
    source_name TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at DATETIME NOT NULL,
    fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    summary_raw TEXT,
    content_text TEXT,
    hash TEXT NOT NULL UNIQUE,
    updated_flag BOOLEAN NOT NULL DEFAULT 0,
    date_estimated BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_items_ministry ON items(ministry);
  CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at);
  CREATE INDEX IF NOT EXISTS idx_items_ministry_published_at ON items(ministry, published_at);

  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    ministry TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'rss',
    enabled BOOLEAN NOT NULL DEFAULT 1,
    last_fetched_at DATETIME,
    last_error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ministry, name)
  );

  CREATE TABLE IF NOT EXISTS daily_summaries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    ministry TEXT,
    summary TEXT NOT NULL,
    item_count INTEGER NOT NULL,
    items_hash TEXT NOT NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, ministry)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);

  CREATE TABLE IF NOT EXISTS fetch_logs (
    id TEXT PRIMARY KEY,
    ministry TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    status TEXT NOT NULL,
    item_count INTEGER,
    error TEXT,
    duration INTEGER,
    fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fetch_logs_fetched_at ON fetch_logs(fetched_at);

  CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    finished_at DATETIME,
    migration_name TEXT NOT NULL,
    logs TEXT,
    rolled_back_at DATETIME,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  );
`);

console.log("Database initialized successfully.");
console.log("Tables:", db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
db.close();
