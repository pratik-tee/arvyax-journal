const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Railway mounts persistent volumes at /app/data or uses DB_PATH env var
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.RAILWAY_ENVIRONMENT ? "/app/data/journal.db" : path.join(__dirname, "../../journal.db"));

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function initDB() {
  // Ensure the data directory exists (needed for Railway volumes)
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const database = getDB();

  database.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      ambience TEXT NOT NULL CHECK(ambience IN ('forest','ocean','mountain','desert','rain','city')),
      text TEXT NOT NULL,
      emotion TEXT,
      keywords TEXT,
      summary TEXT,
      analyzed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_user_id ON journal_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_created_at ON journal_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_emotion ON journal_entries(user_id, emotion);
  `);

  console.log("✅ Database initialized at:", DB_PATH);
}

module.exports = { getDB, initDB };
