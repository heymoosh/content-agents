import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DB_PATH = join(ROOT, "data", "analytics.db");

export function openDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  const schema = readFileSync(join(ROOT, "src", "db", "schema.sql"), "utf8");
  db.exec(schema);
  // Migrate DBs created before later columns existed (CREATE TABLE IF NOT EXISTS won't add them).
  const cols = db.prepare("PRAGMA table_info(posts)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "bet_id")) {
    db.exec("ALTER TABLE posts ADD COLUMN bet_id TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_bet ON posts(bet_id)");
  }
  if (!cols.some((c) => c.name === "source")) {
    db.exec("ALTER TABLE posts ADD COLUMN source TEXT");
  }
  if (!cols.some((c) => c.name === "media_type")) {
    db.exec("ALTER TABLE posts ADD COLUMN media_type TEXT");
    // Backfill from format column so existing rows are immediately queryable.
    db.exec(`UPDATE posts SET media_type = CASE
      WHEN format = 'video'                          THEN 'video'
      WHEN format = 'image'                          THEN 'quote-card'
      WHEN format IN ('text', 'thread', 'newsletter') THEN 'text'
      ELSE 'unknown'
    END WHERE media_type IS NULL`);
  }
  // Indexes OUTSIDE the column guards (and not in schema.sql, which runs before these migrations):
  // columns are guaranteed to exist by here, and CREATE INDEX IF NOT EXISTS is idempotent.
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_media_type ON posts(media_type)");
  return db;
}

export const repoRoot = ROOT;

// Run directly: create/migrate the database and print the schema.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  console.log(`db: ${DB_PATH}`);
  console.log(`tables: ${tables.map((t) => t.name).join(", ")}`);
  db.close();
}
