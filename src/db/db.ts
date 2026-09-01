import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DB_PATH = join(ROOT, "data", "analytics.db");

export function migrateAnalyticsIdentitySchema(db: Database.Database): void {
  for (const table of ["posts", "metrics", "audience", "imports", "research_observations"]) {
    const tableCols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!tableCols.some((c) => c.name === "brand_id")) db.exec(`ALTER TABLE ${table} ADD COLUMN brand_id TEXT`);
    if (!tableCols.some((c) => c.name === "provider_account_id")) db.exec(`ALTER TABLE ${table} ADD COLUMN provider_account_id TEXT`);
  }

  const audienceSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'audience'").get() as { sql?: string } | undefined)?.sql ?? "";
  if (/UNIQUE\s*\(\s*platform\s*,\s*captured_at\s*,\s*metric_type\s*,\s*dimension\s*,\s*value_label\s*\)/i.test(audienceSql)) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE audience RENAME TO audience_pre_brand_identity;
        CREATE TABLE audience (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL, captured_at TEXT NOT NULL, as_of_date TEXT,
          metric_type TEXT NOT NULL, dimension TEXT, value_label TEXT,
          value_count INTEGER, value_pct REAL, source_file TEXT, raw_json TEXT,
          brand_id TEXT, provider_account_id TEXT
        );
        INSERT INTO audience (
          id, platform, captured_at, as_of_date, metric_type, dimension, value_label,
          value_count, value_pct, source_file, raw_json, brand_id, provider_account_id
        )
        SELECT id, platform, captured_at, as_of_date, metric_type, dimension, value_label,
          value_count, value_pct, source_file, raw_json, brand_id, provider_account_id
        FROM audience_pre_brand_identity;
        DROP TABLE audience_pre_brand_identity;
      `);
    })();
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_bound_identity
      ON audience(brand_id, provider_account_id, platform, captured_at, metric_type,
        COALESCE(dimension, ''), COALESCE(value_label, ''))
      WHERE brand_id IS NOT NULL AND provider_account_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_legacy_identity
      ON audience(platform, captured_at, metric_type, COALESCE(dimension, ''), COALESCE(value_label, ''))
      WHERE brand_id IS NULL AND provider_account_id IS NULL;
  `);
}

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
  if (!cols.some((c) => c.name === "cta_destination")) {
    db.exec("ALTER TABLE posts ADD COLUMN cta_destination TEXT");
  }
  if (!cols.some((c) => c.name === "cadence_source")) {
    db.exec("ALTER TABLE posts ADD COLUMN cadence_source TEXT");
  }
  migrateAnalyticsIdentitySchema(db);
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
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_cta_destination ON posts(cta_destination)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_cadence_source ON posts(cadence_source)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_brand ON posts(brand_id, provider_account_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_metrics_brand ON metrics(brand_id, provider_account_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_audience_brand ON audience(brand_id, platform, metric_type)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_audience_platform ON audience(platform, metric_type)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_imports_brand ON imports(brand_id, provider_account_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_research_observations_brand ON research_observations(brand_id, provider_account_id)");
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
