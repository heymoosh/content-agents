import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, type RoutingConfig } from "./route.js";
import { type StrategyConfig } from "./platform-fit.js";
import { classifyMediaFit, loadRows, rankMediaFit } from "./media-fit.js";

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
    media_thresholds: { lean_floor: 1.5 },
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
  mediaType: string,
  source: string | null,
  postedAt: string,
  likes: number
): void {
  const info = db
    .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, media_type, source) VALUES (?, ?, ?, ?, ?)`)
    .run(platform, `${platform}-${mediaType}-${postedAt}-${Math.random()}`, postedAt, mediaType, source);
  db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts) VALUES (?, ?, ?, 0, 0)`).run(
    info.lastInsertRowid,
    postedAt,
    likes
  );
}

// Fixed clock for every classifyMediaFit/rankMediaFit call below (same convention as
// cadence-fit.test.ts/frame-fit.test.ts's NOW). Without this, `now` defaults to the real
// Date.now() and drifts further from the fixture's June 2026 dates every day this suite runs —
// the recency-weighted ratio in "ratio at/above lean_floor reads lean-toward" is algebraically
// exactly 1.5 (constant likes on both sides) but only in exact arithmetic; the real weight VALUES
// depend on `now`, and floating-point rounding in the weighted-average division intermittently
// lands the computed ratio a hair below 1.5 depending on which `now` happened to be in effect,
// flipping the >= lean_floor label. Pinning `now` makes the float noise, and the label it
// produces, reproducible instead of a CI coin flip.
const NOW = Date.parse("2026-07-15T12:00:00.000Z");

// A row set with n>=3 posts spanning >=4 weeks for both `text` and `mediaType` on `platform`, so
// hasData() passes on both sides — the shared fixture every threshold/label test builds on.
function sufficientRows(platform: string, mediaType: string, textLikesEach: number, mediaLikesEach: number): ReturnType<typeof loadRows> {
  // 2026-06-01 -> 2026-06-29 spans exactly 28 days = 4 weeks, clearing the weeks>=4 floor.
  const weeks = ["2026-06-01", "2026-06-11", "2026-06-19", "2026-06-29"];
  const rows: ReturnType<typeof loadRows> = [];
  for (const w of weeks) {
    rows.push({ platform, media_type: "text", posted_at: `${w}T00:00:00.000Z`, likes: textLikesEach, replies: 0, reposts: 0 });
    rows.push({ platform, media_type: mediaType, posted_at: `${w}T00:00:00.000Z`, likes: mediaLikesEach, replies: 0, reposts: 0 });
  }
  return rows;
}

describe("classifyMediaFit: overfitting guard — insufficient data on EITHER side always reads insufficient-data", () => {
  test("thin media-type side (n<min_posts_for_data) reads insufficient-data even with an extreme raw ratio", () => {
    const rows: ReturnType<typeof loadRows> = [
      { platform: "x", media_type: "text", posted_at: "2026-06-01T00:00:00.000Z", likes: 1, replies: 0, reposts: 0 },
      { platform: "x", media_type: "text", posted_at: "2026-06-15T00:00:00.000Z", likes: 1, replies: 0, reposts: 0 },
      { platform: "x", media_type: "text", posted_at: "2026-06-29T00:00:00.000Z", likes: 1, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-29T00:00:00.000Z", likes: 1000, replies: 0, reposts: 0 }, // n=1
    ];
    const r = classifyMediaFit("x", "video", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("thin text baseline (n<min_posts_for_data) reads insufficient-data even when the media side alone looks solid", () => {
    const rows: ReturnType<typeof loadRows> = [
      { platform: "x", media_type: "text", posted_at: "2026-06-01T00:00:00.000Z", likes: 1, replies: 0, reposts: 0 }, // n=1
      { platform: "x", media_type: "video", posted_at: "2026-06-01T00:00:00.000Z", likes: 10, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-08T00:00:00.000Z", likes: 10, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-15T00:00:00.000Z", likes: 10, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-22T00:00:00.000Z", likes: 10, replies: 0, reposts: 0 },
    ];
    const r = classifyMediaFit("x", "video", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("fewer than 4 weeks of spread on the media side reads insufficient-data even with plenty of posts", () => {
    const rows: ReturnType<typeof loadRows> = [
      { platform: "x", media_type: "text", posted_at: "2026-06-01T00:00:00.000Z", likes: 1, replies: 0, reposts: 0 },
      { platform: "x", media_type: "text", posted_at: "2026-06-15T00:00:00.000Z", likes: 1, replies: 0, reposts: 0 },
      { platform: "x", media_type: "text", posted_at: "2026-06-29T00:00:00.000Z", likes: 1, replies: 0, reposts: 0 },
      // all 5 video posts on the same single day -> weeks=1, even though n=5
      { platform: "x", media_type: "video", posted_at: "2026-06-29T00:00:00.000Z", likes: 100, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-29T01:00:00.000Z", likes: 100, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-29T02:00:00.000Z", likes: 100, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-29T03:00:00.000Z", likes: 100, replies: 0, reposts: 0 },
      { platform: "x", media_type: "video", posted_at: "2026-06-29T04:00:00.000Z", likes: 100, replies: 0, reposts: 0 },
    ];
    const r = classifyMediaFit("x", "video", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("a zero-engagement text baseline reads insufficient-data rather than dividing by zero", () => {
    const rows = sufficientRows("x", "video", 0, 10);
    const r = classifyMediaFit("x", "video", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
    assert.equal(r.ratio, null);
  });
});

describe("classifyMediaFit: label thresholds once data is sufficient on both sides", () => {
  test("ratio at/above lean_floor reads lean-toward", () => {
    const rows = sufficientRows("x", "video", 10, 15); // ratio 1.5
    const r = classifyMediaFit("x", "video", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "lean-toward");
    // Recency weighting introduces float noise (e.g. 1.5000000000000002) even where the ratio
    // is algebraically exact (text/media likes are each constant across dates here) — compare
    // with a tolerance instead of strict equality.
    assert.ok(Math.abs(r.ratio! - 1.5) < 1e-9, `expected ratio ~1.5, got ${r.ratio}`);
  });

  test("ratio below lean_floor reads steady", () => {
    const rows = sufficientRows("x", "video", 10, 11); // ratio 1.1
    const r = classifyMediaFit("x", "video", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "steady");
  });

  test("media engagement below text's still reads steady, not a negative label", () => {
    const rows = sufficientRows("x", "video", 10, 2); // ratio 0.2
    const r = classifyMediaFit("x", "video", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "steady");
  });
});

describe("classifyMediaFit: throws a clear error when config/strategy.yaml has no media_thresholds", () => {
  test("missing media_thresholds fails loudly instead of silently defaulting", () => {
    const rows = sufficientRows("x", "video", 10, 15);
    const sc = strategyCfg();
    delete (sc as Partial<StrategyConfig>).media_thresholds;
    assert.throws(() => classifyMediaFit("x", "video", rows, cfg(), sc, NOW), /media_thresholds/);
  });
});

describe("rankMediaFit: never fabricates a read for a media type that was never posted, and orders lean-toward first", () => {
  test("a platform with no video posts at all gets no video row", () => {
    const rows = sufficientRows("x", "quote-card", 10, 15);
    const ranked = rankMediaFit(rows, cfg(), strategyCfg(), NOW);
    assert.ok(!ranked.some((r) => r.mediaType === "video"));
    assert.ok(ranked.some((r) => r.mediaType === "quote-card"));
  });

  test("lean-toward sorts before steady, which sorts before insufficient-data", () => {
    const rows = [
      ...sufficientRows("x", "video", 10, 20), // ratio 2.0 -> lean-toward
      ...sufficientRows("linkedin", "quote-card", 10, 11), // ratio 1.1 -> steady
      { platform: "bluesky", media_type: "text", posted_at: "2026-06-01T00:00:00.000Z", likes: 5, replies: 0, reposts: 0 },
      { platform: "bluesky", media_type: "video", posted_at: "2026-06-01T00:00:00.000Z", likes: 500, replies: 0, reposts: 0 }, // n=1 -> insufficient
    ];
    const ranked = rankMediaFit(rows, cfg(), strategyCfg(), NOW);
    const labels = ranked.map((r) => r.label);
    assert.equal(labels[0], "lean-toward");
    const lastRealIdx = labels.lastIndexOf("steady");
    const firstInsufficientIdx = labels.indexOf("insufficient-data");
    assert.ok(firstInsufficientIdx > lastRealIdx);
  });

  test("only compares CORE_TEXT platforms (community targets never appear)", () => {
    const rows = [
      ...sufficientRows("x", "video", 10, 20),
      ...sufficientRows("community:democratic-resilience", "video", 10, 20),
    ];
    const ranked = rankMediaFit(rows, cfg(), strategyCfg(), NOW);
    assert.ok(ranked.some((r) => r.platform === "x"));
    assert.ok(!ranked.some((r) => r.platform === "community:democratic-resilience"));
  });
});

describe("loadRows: excludes deliberate spin-control-run and exploration-probe rows, and unknown/null media_type", () => {
  test("both CONTROL_RUN_SOURCE and EXPLORATION_SOURCE rows are excluded", () => {
    const db = freshDb();
    insertPost(db, "x", "video", "organic", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "x", "video", CONTROL_RUN_SOURCE, "2026-06-08T00:00:00.000Z", 1000);
    insertPost(db, "x", "video", EXPLORATION_SOURCE, "2026-06-15T00:00:00.000Z", 1000);
    const rows = loadRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].likes, 10);
    db.close();
  });

  test("a row with media_type 'unknown' is excluded", () => {
    const db = freshDb();
    insertPost(db, "x", "unknown", "organic", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "x", "text", "organic", "2026-06-01T00:00:00.000Z", 10);
    const rows = loadRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].media_type, "text");
    db.close();
  });
});
