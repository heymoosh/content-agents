import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migrateAnalyticsIdentitySchema } from "./db.js";

test("audience migration preserves legacy rows and separates bound brand/account snapshots", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE posts (id INTEGER PRIMARY KEY);
    CREATE TABLE metrics (id INTEGER PRIMARY KEY);
    CREATE TABLE imports (id INTEGER PRIMARY KEY);
    CREATE TABLE research_observations (observation_id TEXT PRIMARY KEY);
    CREATE TABLE audience (
      id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT NOT NULL, captured_at TEXT NOT NULL,
      as_of_date TEXT, metric_type TEXT NOT NULL, dimension TEXT, value_label TEXT,
      value_count INTEGER, value_pct REAL, source_file TEXT, raw_json TEXT,
      UNIQUE(platform, captured_at, metric_type, dimension, value_label)
    );
    INSERT INTO audience (platform, captured_at, metric_type, value_count)
      VALUES ('x', '2026-08-01T00:00:00Z', 'follower_total', 10);
  `);

  migrateAnalyticsIdentitySchema(db);
  const legacy = db.prepare("SELECT brand_id, provider_account_id, value_count FROM audience").get() as Record<string, unknown>;
  assert.deepEqual(legacy, { brand_id: null, provider_account_id: null, value_count: 10 });

  const insert = db.prepare(`
    INSERT OR IGNORE INTO audience
      (platform, captured_at, metric_type, value_count, brand_id, provider_account_id)
    VALUES ('x', '2026-08-02T00:00:00Z', 'follower_total', ?, ?, ?)
  `);
  assert.equal(insert.run(20, "human-inference", "hi/x").changes, 1);
  assert.equal(insert.run(21, "human-inference", "hi/x").changes, 0);
  assert.equal(insert.run(30, "charles", "charles/x").changes, 1);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM audience").get() as { count: number }).count, 3);
  db.close();
});
