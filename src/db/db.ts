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
