import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, type RoutingConfig } from "./route.js";
import { type StrategyConfig } from "./platform-fit.js";
import {
  classifyTrend,
  classifyPeakHour,
  rankTrend,
  rankPeakHour,
  loadRows,
  loadFollowRows,
  classifyCadenceFollow,
  rankCadenceFollow,
  buildOverridesFile,
  type OverridesFile,
} from "./cadence-fit.js";

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
    cadence_thresholds: { climb_ratio: 1.2, decline_ratio: 0.8, step: 1, max_posts_per_week: 10 },
    peak_hour_thresholds: { min_distinct_times: 3 },
    cadence_follow_thresholds: { win_ratio: 1.2 },
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
    .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, source) VALUES (?, ?, ?, ?)`)
    .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, source);
  db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts) VALUES (?, ?, ?, 0, 0)`).run(
    info.lastInsertRowid,
    postedAt,
    likes
  );
}

// Lever C follow-through (epic 2ce597d7): a variant of insertPost that also stamps
// cadence_source, with an optional source (defaults to a normal 'atomized' post, never
// CONTROL_RUN_SOURCE/EXPLORATION_SOURCE, so loadFollowRows's exclusion is exercised separately).
function insertPostCadence(
  db: Database.Database,
  platform: string,
  cadenceSource: string | null,
  postedAt: string,
  likes: number,
  source: string | null = "atomized"
): void {
  const info = db
    .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, source, cadence_source) VALUES (?, ?, ?, ?, ?)`)
    .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, source, cadenceSource);
  db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts) VALUES (?, ?, ?, 0, 0)`).run(
    info.lastInsertRowid,
    postedAt,
    likes
  );
}

const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const WEEK_MS = 7 * 24 * 3600 * 1000;

// 3 posts safely inside the "recent" window (0-4wk ago) or the "prior" window (4-8wk ago),
// each `likes` engagement. classifyTrend's windows are (now-4wk, now] and (now-8wk, now-4wk].
function windowRows(platform: string, window: "recent" | "prior", likes: number): ReturnType<typeof loadRows> {
  const weeksAgoValues = window === "recent" ? [0.5, 1, 1.5] : [4.5, 5, 5.5];
  return weeksAgoValues.map((weeksAgo) => ({
    platform,
    posted_at: new Date(NOW - weeksAgo * WEEK_MS).toISOString(),
    likes,
    replies: 0,
    reposts: 0,
  }));
}

describe("classifyTrend: overfitting guard — insufficient data in EITHER window always reads insufficient-data", () => {
  test("thin recent window (n<min_posts_for_data) reads insufficient-data even with an extreme ratio", () => {
    const rows: ReturnType<typeof loadRows> = [
      { platform: "x", posted_at: new Date(NOW - 1 * WEEK_MS).toISOString(), likes: 1000, replies: 0, reposts: 0 }, // recent n=1
      ...windowRows("x", "prior", 10), // prior window, n=3
    ];
    const r = classifyTrend("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("thin prior window (n<min_posts_for_data) reads insufficient-data even when recent looks solid", () => {
    const rows: ReturnType<typeof loadRows> = [
      ...windowRows("x", "recent", 10), // recent window, n=3
      { platform: "x", posted_at: new Date(NOW - 6 * WEEK_MS).toISOString(), likes: 10, replies: 0, reposts: 0 }, // prior n=1
    ];
    const r = classifyTrend("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("a zero-engagement prior baseline reads insufficient-data rather than dividing by zero", () => {
    const rows: ReturnType<typeof loadRows> = [...windowRows("x", "recent", 10), ...windowRows("x", "prior", 0)];
    const r = classifyTrend("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
    assert.equal(r.ratio, null);
  });
});

describe("classifyTrend: label thresholds once both windows have sufficient data", () => {
  test("ratio at/above climb_ratio reads climbing", () => {
    const rows = [...windowRows("x", "recent", 12), ...windowRows("x", "prior", 10)]; // ratio 1.2
    const r = classifyTrend("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "climbing");
  });

  test("ratio at/below decline_ratio reads declining", () => {
    const rows = [...windowRows("x", "recent", 8), ...windowRows("x", "prior", 10)]; // ratio 0.8
    const r = classifyTrend("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "declining");
  });

  test("ratio between the two floors reads steady", () => {
    const rows = [...windowRows("x", "recent", 10), ...windowRows("x", "prior", 10)]; // ratio 1.0
    const r = classifyTrend("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "steady");
  });
});

describe("classifyTrend: throws a clear error when config/strategy.yaml has no cadence_thresholds", () => {
  test("missing cadence_thresholds fails loudly instead of silently defaulting", () => {
    const rows = [...windowRows("x", "recent", 12), ...windowRows("x", "prior", 10)];
    const sc = strategyCfg();
    delete (sc as Partial<StrategyConfig>).cadence_thresholds;
    assert.throws(() => classifyTrend("x", rows, cfg(), sc, NOW), /cadence_thresholds/);
  });
});

describe("rankTrend: only ranks CORE_TEXT platforms with rows, guardrail label order", () => {
  test("climbing sorts before steady, which sorts before declining, which sorts before insufficient-data", () => {
    const rows = [
      ...windowRows("x", "recent", 20),
      ...windowRows("x", "prior", 10), // ratio 2.0 -> climbing
      ...windowRows("linkedin", "recent", 10),
      ...windowRows("linkedin", "prior", 10), // ratio 1.0 -> steady
      ...windowRows("bluesky", "recent", 5),
      ...windowRows("bluesky", "prior", 10), // ratio 0.5 -> declining
    ];
    const ranked = rankTrend(rows, cfg(), strategyCfg(), NOW);
    assert.deepEqual(
      ranked.map((r) => r.label),
      ["climbing", "steady", "declining"]
    );
  });

  test("a platform with no rows at all does not appear", () => {
    const rows = windowRows("x", "recent", 10);
    const ranked = rankTrend(rows, cfg(), strategyCfg(), NOW);
    assert.ok(!ranked.some((r) => r.platform === "linkedin"));
  });
});

describe("classifyPeakHour: overfitting + synthetic-timestamp guard", () => {
  test("too few distinct PT hours reads insufficient-data even with plenty of posts (X/LinkedIn's synthetic midnight case)", () => {
    // 10 posts, all landing on the exact same UTC instant each week -> 1 distinct hour, spans >=4wks.
    const rows: ReturnType<typeof loadRows> = [];
    for (let w = 0; w < 5; w++) {
      rows.push({ platform: "x", posted_at: new Date(NOW - w * WEEK_MS).toISOString(), likes: 10, replies: 0, reposts: 0 });
    }
    const r = classifyPeakHour("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
    assert.equal(r.distinctHours, 1);
  });

  test("fewer than min_posts_for_data reads insufficient-data even with several distinct hours", () => {
    const rows: ReturnType<typeof loadRows> = [
      { platform: "x", posted_at: new Date(NOW - 0 * WEEK_MS).toISOString(), likes: 10, replies: 0, reposts: 0 },
      { platform: "x", posted_at: new Date(NOW - 1 * WEEK_MS - 3600_000).toISOString(), likes: 10, replies: 0, reposts: 0 },
    ];
    const r = classifyPeakHour("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("fewer than 4 weeks of spread reads insufficient-data even with many distinct hours", () => {
    // 5 posts, all within the same single day, spread across 5 distinct hours -> weeks=1.
    const rows: ReturnType<typeof loadRows> = [0, 1, 2, 3, 4].map((h) => ({
      platform: "x",
      posted_at: new Date(NOW - h * 3600_000).toISOString(),
      likes: 10,
      replies: 0,
      reposts: 0,
    }));
    const r = classifyPeakHour("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });
});

describe("classifyPeakHour: picks the best-engagement hour once data is sufficient", () => {
  test("the hour with higher recency-weighted engagement wins", () => {
    const rows: ReturnType<typeof loadRows> = [];
    // 4 distinct hours spread across >=4 weeks; hour A (higher likes) should win over hour B/C/D.
    const hours = [
      { offsetHours: 0, likes: 100 }, // "hour A" — best
      { offsetHours: 3, likes: 10 },
      { offsetHours: 6, likes: 10 },
      { offsetHours: 9, likes: 10 },
    ];
    // w=0..4 (5 iterations) so min/max posted_at span exactly 4 weeks -- clears the weeks>=4 floor.
    for (let w = 0; w < 5; w++) {
      for (const h of hours) {
        rows.push({
          platform: "x",
          posted_at: new Date(NOW - w * WEEK_MS - h.offsetHours * 3600_000).toISOString(),
          likes: h.likes,
          replies: 0,
          reposts: 0,
        });
      }
    }
    const r = classifyPeakHour("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "found");
    assert.equal(r.n, 20);
    assert.ok(r.distinctHours >= 3);
  });
});

describe("rankPeakHour: only ranks CORE_TEXT platforms with rows", () => {
  test("a platform with no rows at all does not appear", () => {
    const rows: ReturnType<typeof loadRows> = [
      { platform: "x", posted_at: new Date(NOW).toISOString(), likes: 10, replies: 0, reposts: 0 },
    ];
    const ranked = rankPeakHour(rows, cfg(), strategyCfg(), NOW);
    assert.ok(!ranked.some((r) => r.platform === "linkedin"));
  });
});

describe("loadRows: excludes deliberate spin-control-run and exploration-probe rows, scoped to CORE_TEXT", () => {
  test("both CONTROL_RUN_SOURCE and EXPLORATION_SOURCE rows are excluded", () => {
    const db = freshDb();
    insertPost(db, "x", "organic", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "x", CONTROL_RUN_SOURCE, "2026-06-08T00:00:00.000Z", 1000);
    insertPost(db, "x", EXPLORATION_SOURCE, "2026-06-15T00:00:00.000Z", 1000);
    const rows = loadRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].likes, 10);
    db.close();
  });

  test("a community-target platform (not CORE_TEXT) never appears", () => {
    const db = freshDb();
    insertPost(db, "x", "organic", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "community:democratic-resilience", "organic", "2026-06-01T00:00:00.000Z", 10);
    const rows = loadRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].platform, "x");
    db.close();
  });
});

// Lever C follow-through (epic 2ce597d7): posts.cadence_source, whether THIS post's publish slot
// actually followed an active config/schedule-overrides.yaml entry or the static default.
function followRows(platform: string, cadenceSource: string, likes: number): ReturnType<typeof loadFollowRows> {
  return [0, 2, 4].map((weeksAgo) => ({
    platform,
    cadence_source: cadenceSource,
    posted_at: new Date(NOW - weeksAgo * WEEK_MS).toISOString(),
    likes,
    replies: 0,
    reposts: 0,
  }));
}

describe("loadFollowRows: only cadence_source-tagged CORE_TEXT rows, excludes control/exploration", () => {
  test("a row with no cadence_source is excluded", () => {
    const db = freshDb();
    insertPostCadence(db, "x", null, "2026-06-01T00:00:00.000Z", 10);
    insertPostCadence(db, "x", "default", "2026-06-08T00:00:00.000Z", 10);
    const rows = loadFollowRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].cadence_source, "default");
    db.close();
  });

  test("CONTROL_RUN_SOURCE and EXPLORATION_SOURCE rows are excluded even when cadence-tagged", () => {
    const db = freshDb();
    insertPostCadence(db, "x", "default", "2026-06-01T00:00:00.000Z", 10, CONTROL_RUN_SOURCE);
    insertPostCadence(db, "x", "default", "2026-06-08T00:00:00.000Z", 10, EXPLORATION_SOURCE);
    insertPostCadence(db, "x", "default", "2026-06-15T00:00:00.000Z", 10, "atomized");
    const rows = loadFollowRows(db);
    assert.equal(rows.length, 1);
    db.close();
  });

  test("a community-target platform (not CORE_TEXT) never appears", () => {
    const db = freshDb();
    insertPostCadence(db, "x", "default", "2026-06-01T00:00:00.000Z", 10);
    insertPostCadence(db, "community:democratic-resilience", "default", "2026-06-01T00:00:00.000Z", 10);
    const rows = loadFollowRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].platform, "x");
    db.close();
  });
});

describe("classifyCadenceFollow: overfitting guard — insufficient data on EITHER side always reads insufficient-data", () => {
  test("thin override side reads insufficient-data even with an extreme ratio", () => {
    const rows = [
      { platform: "x", cadence_source: "override", posted_at: new Date(NOW).toISOString(), likes: 1000, replies: 0, reposts: 0 }, // n=1
      ...followRows("x", "default", 10), // n=3
    ];
    const r = classifyCadenceFollow("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("thin default side reads insufficient-data even when override looks solid", () => {
    const rows = [
      ...followRows("x", "override", 10), // n=3
      { platform: "x", cadence_source: "default", posted_at: new Date(NOW).toISOString(), likes: 10, replies: 0, reposts: 0 }, // n=1
    ];
    const r = classifyCadenceFollow("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });

  test("a zero-engagement default baseline reads insufficient-data rather than dividing by zero", () => {
    const rows = [...followRows("x", "override", 10), ...followRows("x", "default", 0)];
    const r = classifyCadenceFollow("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
    assert.equal(r.ratio, null);
  });

  test("either side spanning <4wks reads insufficient-data", () => {
    const rows = [
      { platform: "x", cadence_source: "override", posted_at: new Date(NOW).toISOString(), likes: 20, replies: 0, reposts: 0 },
      { platform: "x", cadence_source: "override", posted_at: new Date(NOW - 1000).toISOString(), likes: 20, replies: 0, reposts: 0 },
      { platform: "x", cadence_source: "override", posted_at: new Date(NOW - 2000).toISOString(), likes: 20, replies: 0, reposts: 0 },
      ...followRows("x", "default", 10),
    ];
    const r = classifyCadenceFollow("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "insufficient-data");
  });
});

describe("classifyCadenceFollow: label thresholds once both sides have sufficient data", () => {
  test("ratio at/above win_ratio reads override-winning", () => {
    const rows = [...followRows("x", "override", 20), ...followRows("x", "default", 10)]; // ratio 2.0
    const r = classifyCadenceFollow("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "override-winning");
    assert.equal(r.ratio, 2);
  });

  test("ratio at/below 1/win_ratio reads override-losing", () => {
    const rows = [...followRows("x", "override", 5), ...followRows("x", "default", 10)]; // ratio 0.5
    const r = classifyCadenceFollow("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "override-losing");
  });

  test("ratio between the two floors reads even", () => {
    const rows = [...followRows("x", "override", 10), ...followRows("x", "default", 10)]; // ratio 1.0
    const r = classifyCadenceFollow("x", rows, cfg(), strategyCfg(), NOW);
    assert.equal(r.label, "even");
  });
});

describe("classifyCadenceFollow: throws a clear error when config/strategy.yaml has no cadence_follow_thresholds", () => {
  test("missing cadence_follow_thresholds fails loudly instead of silently defaulting", () => {
    const rows = [...followRows("x", "override", 20), ...followRows("x", "default", 10)];
    const sc = strategyCfg();
    delete (sc as Partial<StrategyConfig>).cadence_follow_thresholds;
    assert.throws(() => classifyCadenceFollow("x", rows, cfg(), sc, NOW), /cadence_follow_thresholds/);
  });
});

describe("rankCadenceFollow: only ranks CORE_TEXT platforms with rows, guardrail label order", () => {
  test("override-winning sorts before even, which sorts before override-losing, which sorts before insufficient-data", () => {
    const rows = [
      ...followRows("x", "override", 20),
      ...followRows("x", "default", 10), // ratio 2.0 -> override-winning
      ...followRows("linkedin", "override", 10),
      ...followRows("linkedin", "default", 10), // ratio 1.0 -> even
      ...followRows("bluesky", "override", 5),
      ...followRows("bluesky", "default", 10), // ratio 0.5 -> override-losing
    ];
    const ranked = rankCadenceFollow(rows, cfg(), strategyCfg(), NOW);
    assert.deepEqual(
      ranked.map((r) => r.label),
      ["override-winning", "even", "override-losing"]
    );
  });

  test("a platform with no rows at all does not appear", () => {
    const rows = followRows("x", "override", 10);
    const ranked = rankCadenceFollow(rows, cfg(), strategyCfg(), NOW);
    assert.ok(!ranked.some((r) => r.platform === "linkedin"));
  });
});

describe("buildOverridesFile: proposed posts_per_week — single-step nudge, clamped by max_posts_per_week", () => {
  const emptyExisting: OverridesFile = { approved: false, generated: "", overrides: {} };

  test("climbing proposes current + step", () => {
    const trends = [{ platform: "x", label: "climbing" as const, ratio: 1.5, recentN: 5, priorN: 5 }];
    const file = buildOverridesFile(trends, [], strategyCfg(), "2026-07-15", { x: { posts_per_week: 7 } }, emptyExisting);
    assert.equal(file.overrides.x.posts_per_week, 8);
  });

  test("declining proposes current - step", () => {
    const trends = [{ platform: "x", label: "declining" as const, ratio: 0.5, recentN: 5, priorN: 5 }];
    const file = buildOverridesFile(trends, [], strategyCfg(), "2026-07-15", { x: { posts_per_week: 7 } }, emptyExisting);
    assert.equal(file.overrides.x.posts_per_week, 6);
  });

  test("climbing at the ceiling clamps to max_posts_per_week, never proposing a jump above it", () => {
    const trends = [{ platform: "x", label: "climbing" as const, ratio: 5, recentN: 5, priorN: 5 }];
    const sc = strategyCfg({ cadence_thresholds: { climb_ratio: 1.2, decline_ratio: 0.8, step: 1, max_posts_per_week: 10 } });
    const file = buildOverridesFile(trends, [], sc, "2026-07-15", { x: { posts_per_week: 10 } }, emptyExisting);
    assert.ok(!("x" in file.overrides), "already at ceiling -> no change proposed, not clamped-but-emitted");
  });

  test("declining at the floor clamps to 1, never proposing 0 or negative", () => {
    const trends = [{ platform: "x", label: "declining" as const, ratio: 0.1, recentN: 5, priorN: 5 }];
    const file = buildOverridesFile(trends, [], strategyCfg(), "2026-07-15", { x: { posts_per_week: 1 } }, emptyExisting);
    assert.ok(!("x" in file.overrides), "already at floor -> no change proposed");
  });

  test("steady and insufficient-data trends never produce a posts_per_week proposal", () => {
    const trends = [
      { platform: "x", label: "steady" as const, ratio: 1.0, recentN: 5, priorN: 5 },
      { platform: "linkedin", label: "insufficient-data" as const, ratio: null, recentN: 1, priorN: 1 },
    ];
    const file = buildOverridesFile(
      trends,
      [],
      strategyCfg(),
      "2026-07-15",
      { x: { posts_per_week: 7 }, linkedin: { posts_per_week: 5 } },
      emptyExisting
    );
    assert.deepEqual(file.overrides, {});
  });
});

describe("buildOverridesFile: proposed slot_time_pst only on a 'found' peak-hour read that differs from current", () => {
  const emptyExisting: OverridesFile = { approved: false, generated: "", overrides: {} };

  test("a found peak hour that differs from the current slot_time_pst is proposed", () => {
    const peakHours = [{ platform: "x", label: "found" as const, hourPst: 10, n: 20, distinctHours: 4 }];
    const file = buildOverridesFile([], peakHours, strategyCfg(), "2026-07-15", { x: { slot_time_pst: "09:30" } }, emptyExisting);
    assert.equal(file.overrides.x.slot_time_pst, "10:00");
  });

  test("a found peak hour matching the current slot_time_pst proposes no change", () => {
    const peakHours = [{ platform: "x", label: "found" as const, hourPst: 9, n: 20, distinctHours: 4 }];
    const file = buildOverridesFile([], peakHours, strategyCfg(), "2026-07-15", { x: { slot_time_pst: "09:00" } }, emptyExisting);
    assert.ok(!("x" in file.overrides));
  });

  test("insufficient-data peak-hour never produces a slot_time_pst proposal", () => {
    const peakHours = [{ platform: "x", label: "insufficient-data" as const, hourPst: null, n: 2, distinctHours: 1 }];
    const file = buildOverridesFile([], peakHours, strategyCfg(), "2026-07-15", { x: { slot_time_pst: "09:30" } }, emptyExisting);
    assert.deepEqual(file.overrides, {});
  });
});

describe("buildOverridesFile: approval preserve/reset rule", () => {
  test("unchanged proposals (byte-identical to what's on disk) preserve an existing approved:true", () => {
    const trends = [{ platform: "x", label: "climbing" as const, ratio: 1.5, recentN: 5, priorN: 5 }];
    const existing: OverridesFile = { approved: true, generated: "2026-07-08", overrides: { x: { posts_per_week: 8 } } };
    const file = buildOverridesFile(trends, [], strategyCfg(), "2026-07-15", { x: { posts_per_week: 7 } }, existing);
    assert.equal(file.approved, true);
  });

  test("different proposals reset approved to false even if it was previously true", () => {
    const trends = [{ platform: "x", label: "climbing" as const, ratio: 1.5, recentN: 5, priorN: 5 }];
    const existing: OverridesFile = { approved: true, generated: "2026-07-08", overrides: { x: { posts_per_week: 9 } } };
    const file = buildOverridesFile(trends, [], strategyCfg(), "2026-07-15", { x: { posts_per_week: 7 } }, existing);
    assert.equal(file.approved, false);
    assert.equal(file.overrides.x.posts_per_week, 8);
  });

  test("no existing file (approved:false, empty overrides) never surfaces approved:true on its own", () => {
    const trends = [{ platform: "x", label: "steady" as const, ratio: 1.0, recentN: 5, priorN: 5 }];
    const existing: OverridesFile = { approved: false, generated: "", overrides: {} };
    const file = buildOverridesFile(trends, [], strategyCfg(), "2026-07-15", { x: { posts_per_week: 7 } }, existing);
    assert.equal(file.approved, false);
  });
});
