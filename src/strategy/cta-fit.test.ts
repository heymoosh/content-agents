import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, type RoutingConfig } from "./route.js";
import { type StrategyConfig } from "./platform-fit.js";
import { classifyCtaFit, rankCtaFit, loadRows, type Row } from "./cta-fit.js";

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
    cta_thresholds: { win_ratio: 1.2 },
    ...overrides,
  };
}

function freshDb(): Database.Database {
  const schema = readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8");
  const db = new Database(":memory:");
  db.exec(schema);
  return db;
}

function insertPost(
  db: Database.Database,
  platform: string,
  ctaDestination: string | null,
  postedAt: string,
  likes: number,
  source: string | null = "atomized"
): void {
  const info = db
    .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, source, cta_destination) VALUES (?, ?, ?, ?, ?)`)
    .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, source, ctaDestination);
  db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts) VALUES (?, ?, ?, 0, 0)`).run(
    info.lastInsertRowid,
    postedAt,
    likes
  );
}

const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const WEEK_MS = 7 * 24 * 3600 * 1000;

// 3 rows, spread across a >=4wk span (0, 2, 4 weeks ago), each `likes` engagement, tagged with the
// given cta_destination. classifyCtaFit's span guard needs weeksSpan >= 4 on a bucket to count as
// sufficient.
function spanRows(platform: string, ctaDestination: string, likes: number): Row[] {
  return [0, 2, 4].map((weeksAgo) => ({
    platform,
    cta_destination: ctaDestination,
    posted_at: new Date(NOW - weeksAgo * WEEK_MS).toISOString(),
    likes,
    replies: 0,
    reposts: 0,
  }));
}

describe("classifyCtaFit: overfitting guard — fewer than two sufficient destination buckets always reads insufficient-data", () => {
  test("no cta-tagged rows at all reads insufficient-data (the expected state before any CTA post ships)", () => {
    const r = classifyCtaFit("x", [], cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
    assert.equal(r.topDestination, null);
  });

  test("only one destination has any data at all reads insufficient-data (nothing to compare against)", () => {
    const rows = spanRows("x", "source", 10);
    const r = classifyCtaFit("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("a thin second bucket (n<min_posts_for_data) still reads insufficient-data even with an extreme ratio", () => {
    const rows: Row[] = [
      ...spanRows("x", "source", 1000),
      { platform: "x", cta_destination: "project", posted_at: new Date(NOW).toISOString(), likes: 1, replies: 0, reposts: 0 }, // n=1
    ];
    const r = classifyCtaFit("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("a bucket spanning <4wks still reads insufficient-data even with plenty of posts", () => {
    const rows: Row[] = [
      { platform: "x", cta_destination: "source", posted_at: new Date(NOW).toISOString(), likes: 10, replies: 0, reposts: 0 },
      { platform: "x", cta_destination: "source", posted_at: new Date(NOW - 3600_000).toISOString(), likes: 10, replies: 0, reposts: 0 },
      { platform: "x", cta_destination: "source", posted_at: new Date(NOW - 7200_000).toISOString(), likes: 10, replies: 0, reposts: 0 },
      ...spanRows("x", "project", 10),
    ];
    const r = classifyCtaFit("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });
});

describe("classifyCtaFit: label thresholds once two destination buckets have sufficient data", () => {
  test("ratio at/above win_ratio reads clear-winner, naming the top destination", () => {
    const rows = [...spanRows("x", "source", 12), ...spanRows("x", "project", 10)]; // ratio 1.2
    const r = classifyCtaFit("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "clear-winner");
    assert.equal(r.topDestination, "source");
  });

  test("ratio below win_ratio reads even, with no named winner", () => {
    const rows = [...spanRows("x", "source", 10), ...spanRows("x", "project", 10)]; // ratio 1.0
    const r = classifyCtaFit("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "even");
    assert.equal(r.topDestination, null);
  });

  test("three sufficient buckets: the ratio compares the top two, ignoring the third", () => {
    const rows = [...spanRows("x", "source", 20), ...spanRows("x", "project", 10), ...spanRows("x", "work_with_me", 5)];
    const r = classifyCtaFit("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "clear-winner");
    assert.equal(r.topDestination, "source");
    assert.ok(Math.abs(r.ratio! - 2) < 0.001);
  });
});

describe("classifyCtaFit: throws a clear error when config/strategy.yaml has no cta_thresholds", () => {
  test("missing cta_thresholds fails loudly instead of silently defaulting", () => {
    const rows = [...spanRows("x", "source", 12), ...spanRows("x", "project", 10)];
    const sc = strategyCfg();
    delete (sc as Partial<StrategyConfig>).cta_thresholds;
    assert.throws(() => classifyCtaFit("x", rows, cfg(), sc, NOW), /cta_thresholds/);
  });
});

describe("rankCtaFit: only ranks CORE_TEXT platforms with rows, guardrail label order", () => {
  test("clear-winner sorts before even, which sorts before insufficient-data", () => {
    const rows = [
      ...spanRows("x", "source", 20),
      ...spanRows("x", "project", 10), // ratio 2.0 -> clear-winner
      ...spanRows("linkedin", "source", 10),
      ...spanRows("linkedin", "project", 10), // ratio 1.0 -> even
      ...spanRows("bluesky", "source", 10), // only one bucket -> insufficient-data
    ];
    const ranked = rankCtaFit(rows, cfg(), strategyCfg(), NOW);
    assert.deepEqual(
      ranked.map((r) => r.label),
      ["clear-winner", "even", "insufficient-data"]
    );
  });

  test("a platform with no rows at all does not appear", () => {
    const rows = spanRows("x", "source", 10);
    const ranked = rankCtaFit(rows, cfg(), strategyCfg(), NOW);
    assert.ok(!ranked.some((r) => r.platform === "linkedin"));
  });
});

describe("loadRows: scoped to CORE_TEXT platforms with a non-null cta_destination, excluding control/exploration sources", () => {
  test("rows with a cta_destination are included; rows with none (NULL) are excluded", () => {
    const db = freshDb();
    insertPost(db, "x", "source", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "x", "project", "2026-06-08T00:00:00.000Z", 20);
    insertPost(db, "x", null, "2026-06-01T00:00:00.000Z", 999);
    const rows = loadRows(db);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.likes !== 999));
    db.close();
  });

  test("control-run and exploration-probe sourced posts are excluded even with a cta_destination set", () => {
    const db = freshDb();
    insertPost(db, "x", "source", "2026-06-01T00:00:00.000Z", 10, "atomized");
    insertPost(db, "x", "source", "2026-06-08T00:00:00.000Z", 999, CONTROL_RUN_SOURCE);
    insertPost(db, "x", "source", "2026-06-08T00:00:00.000Z", 999, EXPLORATION_SOURCE);
    const rows = loadRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].likes, 10);
    db.close();
  });

  test("a community-target platform (not CORE_TEXT) never appears", () => {
    const db = freshDb();
    insertPost(db, "x", "source", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "community:democratic-resilience", "source", "2026-06-01T00:00:00.000Z", 10);
    const rows = loadRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].platform, "x");
    db.close();
  });
});
