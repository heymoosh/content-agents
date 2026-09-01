import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, type RoutingConfig } from "./route.js";
import { type StrategyConfig } from "./platform-fit.js";
import { classifyFrame, rankFrameFit, loadRows, type Row } from "./frame-fit.js";

function cfg(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaults: {},
    rules: {},
    thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: [] },
    ...overrides,
  };
}

function strategyCfg(overrides: Partial<StrategyConfig> = {}): StrategyConfig {
  return {
    platform_pillar_priors: {},
    thresholds: { lean_in_floor: 1.3 },
    frame_thresholds: { win_ratio: 1.2 },
    ...overrides,
  };
}

function freshDb(): Database.Database {
  const schema = readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8");
  const db = new Database(":memory:");
  db.exec(schema);
  return db;
}

function insertPost(db: Database.Database, platform: string, source: string | null, postedAt: string, likes: number): void {
  const info = db
    .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, source, brand_id, provider_account_id) VALUES (?, ?, ?, ?, 'human-inference', 'test/account')`)
    .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, source);
  db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts, brand_id, provider_account_id) VALUES (?, ?, ?, 0, 0, 'human-inference', 'test/account')`).run(
    info.lastInsertRowid,
    postedAt,
    likes
  );
}

const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const WEEK_MS = 7 * 24 * 3600 * 1000;

// 3 rows, spread across a >=4wk span (0, 2, 4 weeks ago), each `likes` engagement, tagged with the
// given source. classifyFrame's span guard needs weeksSpan >= 4 on BOTH sides independently.
function spanRows(platform: string, source: string, likes: number): Row[] {
  return [0, 2, 4].map((weeksAgo) => ({
    platform,
    source,
    posted_at: new Date(NOW - weeksAgo * WEEK_MS).toISOString(),
    likes,
    replies: 0,
    reposts: 0,
  }));
}

describe("classifyFrame: overfitting guard — insufficient data on EITHER side always reads insufficient-data", () => {
  test("thin spin-on side (n<min_posts_for_data) reads insufficient-data even with an extreme ratio", () => {
    const rows: Row[] = [
      { platform: "x", source: "atomized", posted_at: new Date(NOW).toISOString(), likes: 1000, replies: 0, reposts: 0 }, // spin-on n=1
      ...spanRows("x", CONTROL_RUN_SOURCE, 10),
    ];
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("thin spin-off side (n<min_posts_for_data) reads insufficient-data even when spin-on looks solid", () => {
    const rows: Row[] = [
      ...spanRows("x", "atomized", 10),
      { platform: "x", source: CONTROL_RUN_SOURCE, posted_at: new Date(NOW).toISOString(), likes: 10, replies: 0, reposts: 0 }, // spin-off n=1
    ];
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("a zero-engagement spin-off baseline reads insufficient-data rather than dividing by zero", () => {
    const rows: Row[] = [...spanRows("x", "atomized", 10), ...spanRows("x", CONTROL_RUN_SOURCE, 0)];
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
    assert.equal(r.ratio, null);
  });

  test("either side spanning <4wks reads insufficient-data even with plenty of posts", () => {
    const rows: Row[] = [
      { platform: "x", source: "atomized", posted_at: new Date(NOW).toISOString(), likes: 10, replies: 0, reposts: 0 },
      { platform: "x", source: "atomized", posted_at: new Date(NOW - 3600_000).toISOString(), likes: 10, replies: 0, reposts: 0 },
      { platform: "x", source: "atomized", posted_at: new Date(NOW - 7200_000).toISOString(), likes: 10, replies: 0, reposts: 0 },
      ...spanRows("x", CONTROL_RUN_SOURCE, 10),
    ];
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });
});

describe("classifyFrame: label thresholds once both sides have sufficient data", () => {
  test("ratio at/above win_ratio reads frame-winning", () => {
    const rows = [...spanRows("x", "atomized", 12), ...spanRows("x", CONTROL_RUN_SOURCE, 10)]; // ratio 1.2
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "frame-winning");
  });

  test("ratio at/below 1/win_ratio reads frame-losing", () => {
    const rows = [...spanRows("x", "atomized", 10), ...spanRows("x", CONTROL_RUN_SOURCE, 12)]; // ratio ~0.833 <= 1/1.2
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "frame-losing");
  });

  test("ratio between the two floors reads even", () => {
    const rows = [...spanRows("x", "atomized", 10), ...spanRows("x", CONTROL_RUN_SOURCE, 10)]; // ratio 1.0
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "even");
  });
});

describe("classifyFrame: throws a clear error when config/strategy.yaml has no frame_thresholds", () => {
  test("missing frame_thresholds fails loudly instead of silently defaulting", () => {
    const rows = [...spanRows("x", "atomized", 12), ...spanRows("x", CONTROL_RUN_SOURCE, 10)];
    const sc = strategyCfg();
    delete (sc as Partial<StrategyConfig>).frame_thresholds;
    assert.throws(() => classifyFrame("x", rows, cfg(), sc, NOW), /frame_thresholds/);
  });
});

describe("classifyFrame: source classification — atomized + atomized-spin are spin-on, spin-control-run is spin-off", () => {
  test("both atomized and atomized-spin sources count toward the spin-on side", () => {
    const rows: Row[] = [
      ...spanRows("x", "atomized", 10).slice(0, 2),
      ...spanRows("x", "atomized-spin", 10).slice(0, 1),
      ...spanRows("x", CONTROL_RUN_SOURCE, 10),
    ];
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.spinOnN, 3);
  });

  test("organic, exploration-probe, and untagged (null) sources count toward neither side", () => {
    const rows: Row[] = [
      ...spanRows("x", "atomized", 10),
      ...spanRows("x", CONTROL_RUN_SOURCE, 10),
      ...spanRows("x", "organic", 999),
      ...spanRows("x", EXPLORATION_SOURCE, 999),
      { platform: "x", source: null, posted_at: new Date(NOW).toISOString(), likes: 999, replies: 0, reposts: 0 },
    ];
    const r = classifyFrame("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.spinOnN, 3);
    assert.equal(r.spinOffN, 3);
  });
});

describe("rankFrameFit: only ranks CORE_TEXT platforms with rows, guardrail label order", () => {
  test("frame-winning sorts before even, which sorts before frame-losing, which sorts before insufficient-data", () => {
    const rows = [
      ...spanRows("x", "atomized", 20),
      ...spanRows("x", CONTROL_RUN_SOURCE, 10), // ratio 2.0 -> frame-winning
      ...spanRows("linkedin", "atomized", 10),
      ...spanRows("linkedin", CONTROL_RUN_SOURCE, 10), // ratio 1.0 -> even
      ...spanRows("bluesky", "atomized", 5),
      ...spanRows("bluesky", CONTROL_RUN_SOURCE, 10), // ratio 0.5 -> frame-losing
    ];
    const ranked = rankFrameFit(rows, cfg(), strategyCfg(), NOW);
    assert.deepEqual(
      ranked.map((r) => r.label),
      ["frame-winning", "even", "frame-losing"]
    );
  });

  test("a platform with no rows at all does not appear", () => {
    const rows = spanRows("x", "atomized", 10);
    const ranked = rankFrameFit(rows, cfg(), strategyCfg(), NOW);
    assert.ok(!ranked.some((r) => r.platform === "linkedin"));
  });
});

describe("loadRows: scoped to spin-on + spin-off sources only, CORE_TEXT platforms", () => {
  test("atomized, atomized-spin, and spin-control-run rows are all included; organic/exploration/untagged are excluded", () => {
    const db = freshDb();
    insertPost(db, "x", "atomized", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "x", "atomized-spin", "2026-06-08T00:00:00.000Z", 20);
    insertPost(db, "x", CONTROL_RUN_SOURCE, "2026-06-15T00:00:00.000Z", 30);
    insertPost(db, "x", "organic", "2026-06-01T00:00:00.000Z", 999);
    insertPost(db, "x", EXPLORATION_SOURCE, "2026-06-01T00:00:00.000Z", 999);
    insertPost(db, "x", null, "2026-06-01T00:00:00.000Z", 999);
    const rows = loadRows(db, { brandId: "human-inference" });
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.likes !== 999));
    db.close();
  });

  test("a community-target platform (not CORE_TEXT) never appears", () => {
    const db = freshDb();
    insertPost(db, "x", "atomized", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "community:democratic-resilience", "atomized", "2026-06-01T00:00:00.000Z", 10);
    const rows = loadRows(db, { brandId: "human-inference" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].platform, "x");
    db.close();
  });
});
