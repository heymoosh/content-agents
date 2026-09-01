import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import {
  latestMetricsJoin,
  measurementScope,
  type StrategyMeasurementContext,
} from "./measurement-context.js";
import { loadData } from "./route.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8"));
  return db;
}

const context: StrategyMeasurementContext = { brandId: "human-inference" };

test("measurement scope keeps a brand isolated and excludes legacy rows", () => {
  const db = freshDb();
  db.exec(`
    INSERT INTO posts (platform, platform_post_id, brand_id, provider_account_id, pillar)
      VALUES ('x', 'hi-1', 'human-inference', 'x/hi', 'human-ai'),
             ('x', 'charles-1', 'charles', 'x/charles', 'human-ai'),
             ('x', 'legacy-1', NULL, NULL, 'human-ai');
    INSERT INTO metrics (post_id, captured_at, likes, brand_id, provider_account_id)
      SELECT id, '2026-08-01T00:00:00Z', 10, brand_id, provider_account_id FROM posts WHERE platform_post_id = 'hi-1';
    INSERT INTO metrics (post_id, captured_at, likes, brand_id, provider_account_id)
      SELECT id, '2026-08-01T00:00:00Z', 999, brand_id, provider_account_id FROM posts WHERE platform_post_id = 'charles-1';
    INSERT INTO metrics (post_id, captured_at, likes)
      SELECT id, '2026-08-01T00:00:00Z', 500 FROM posts WHERE platform_post_id = 'legacy-1';
  `);
  const scope = measurementScope(context, "p", "m");
  const rows = db.prepare(`
    SELECT p.platform_post_id, m.likes
    FROM posts p JOIN metrics m ON m.post_id = p.id
    WHERE ${scope.sql}
  `).all(...scope.params) as { platform_post_id: string; likes: number }[];
  assert.deepEqual(rows, [{ platform_post_id: "hi-1", likes: 10 }]);
  db.close();
});

test("account is optional for explicit brand aggregates but latest join still matches identity", () => {
  const db = freshDb();
  db.exec(`
    INSERT INTO posts (platform, platform_post_id, brand_id, provider_account_id, pillar)
      VALUES ('x', 'a', 'human-inference', 'x/a', 'human-ai'),
             ('x', 'b', 'human-inference', 'x/b', 'human-ai');
    INSERT INTO metrics (post_id, captured_at, likes, brand_id, provider_account_id)
      SELECT id, '2026-08-01T00:00:00Z', CASE platform_post_id WHEN 'a' THEN 3 ELSE 7 END, brand_id, provider_account_id FROM posts;
    INSERT INTO metrics (post_id, captured_at, likes, brand_id, provider_account_id)
      SELECT id, '2026-08-02T00:00:00Z', 1000, 'charles', provider_account_id FROM posts WHERE platform_post_id = 'a';
  `);
  const scope = measurementScope(context, "p", "m");
  const rows = db.prepare(`
    SELECT p.platform_post_id, m.likes
    FROM posts p JOIN (${latestMetricsJoin(context).sql}) m ON m.post_id = p.id
    WHERE ${scope.sql}
    ORDER BY p.platform_post_id
  `).all(...latestMetricsJoin(context).params, ...scope.params) as { platform_post_id: string; likes: number }[];
  assert.deepEqual(rows, [{ platform_post_id: "a", likes: 3 }, { platform_post_id: "b", likes: 7 }]);
  db.close();
});

test("explicit account scope excludes another account of the same brand", () => {
  const db = freshDb();
  db.exec(`
    INSERT INTO posts (platform, platform_post_id, brand_id, provider_account_id, pillar)
      VALUES ('x', 'a', 'human-inference', 'x/a', 'human-ai'),
             ('x', 'b', 'human-inference', 'x/b', 'human-ai');
    INSERT INTO metrics (post_id, captured_at, likes, brand_id, provider_account_id)
      SELECT id, '2026-08-01T00:00:00Z', CASE platform_post_id WHEN 'a' THEN 5 ELSE 500 END, brand_id, provider_account_id FROM posts;
  `);
  const accountContext = { brandId: "human-inference", providerAccountId: "x/a" } as const;
  const data = loadData(undefined, db, accountContext);
  assert.deepEqual(data.cells.get("x|human-ai"), { n: 1, avg_eng: 5 });
  db.close();
});

test("routing data does not leak another brand", () => {
  const db = freshDb();
  db.exec(`
    INSERT INTO posts (platform, platform_post_id, brand_id, provider_account_id, pillar)
      VALUES ('x', 'hi', 'human-inference', 'x/hi', 'human-ai'),
             ('x', 'charles', 'charles', 'x/charles', 'human-ai');
    INSERT INTO metrics (post_id, captured_at, likes, brand_id, provider_account_id)
      SELECT id, '2026-08-01T00:00:00Z', CASE platform_post_id WHEN 'hi' THEN 3 ELSE 900 END, brand_id, provider_account_id FROM posts;
  `);
  const data = loadData(undefined, db, context);
  assert.deepEqual(data.cells.get("x|human-ai"), { n: 1, avg_eng: 3 });
  db.close();
});
