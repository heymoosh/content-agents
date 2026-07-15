import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, loadData, type LoadedData, type RoutingConfig } from "./route.js";
import { classifyFit, loadRows, rankPlatformFit, type StrategyConfig } from "./platform-fit.js";

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
  pillar: string,
  source: string | null,
  postedAt: string,
  likes: number
): void {
  const info = db
    .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, pillar, source) VALUES (?, ?, ?, ?, ?)`)
    .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, pillar, source);
  db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts) VALUES (?, ?, ?, 0, 0)`).run(
    info.lastInsertRowid,
    postedAt,
    likes
  );
}

describe("classifyFit: overfitting guard — a thin cell is ALWAYS insufficient-data, never a directive label", () => {
  test("n below min_posts_for_data reads insufficient-data even with an extreme score", () => {
    const data: LoadedData = {
      cells: new Map([["x|human-ai", { n: 1, avg_eng: 1000 }]]), // wildly above norm, but n=1
      weeks: new Map([["x", 5]]),
      baselines: new Map([["x", 10]]),
    };
    const r = classifyFit("x", "human-ai", cfg(), data, [], strategyCfg());
    assert.equal(r.label, "insufficient-data");
  });

  test("fewer than 4 weeks of data reads insufficient-data even with plenty of posts", () => {
    const data: LoadedData = {
      cells: new Map([["x|human-ai", { n: 10, avg_eng: 1000 }]]),
      weeks: new Map([["x", 2]]), // < 4
      baselines: new Map([["x", 10]]),
    };
    const r = classifyFit("x", "human-ai", cfg(), data, [], strategyCfg());
    assert.equal(r.label, "insufficient-data");
  });

  test("no cell at all reads insufficient-data with a null score", () => {
    const data: LoadedData = { cells: new Map(), weeks: new Map(), baselines: new Map() };
    const r = classifyFit("x", "human-ai", cfg(), data, [], strategyCfg());
    assert.equal(r.label, "insufficient-data");
    assert.equal(r.score, null);
  });
});

describe("classifyFit: label thresholds once data is sufficient", () => {
  const sufficientData = (avgEng: number, baseline: number): LoadedData => ({
    cells: new Map([["x|human-ai", { n: 5, avg_eng: avgEng }]]),
    weeks: new Map([["x", 5]]),
    baselines: new Map([["x", baseline]]),
  });

  test("score at/above lean_in_floor reads lean-in", () => {
    const r = classifyFit("x", "human-ai", cfg(), sufficientData(13, 10), [], strategyCfg()); // score 1.3
    assert.equal(r.label, "lean-in");
  });

  test("score below skip_below_score reads ease-off", () => {
    const r = classifyFit("x", "human-ai", cfg(), sufficientData(3, 10), [], strategyCfg()); // score 0.3
    assert.equal(r.label, "ease-off");
  });

  test("score between the two floors reads steady", () => {
    const r = classifyFit("x", "human-ai", cfg(), sufficientData(8, 10), [], strategyCfg()); // score 0.8
    assert.equal(r.label, "steady");
  });
});

describe("classifyFit: seed-prior annotation", () => {
  const data: LoadedData = {
    cells: new Map([["x|claude-code", { n: 5, avg_eng: 10 }]]),
    weeks: new Map([["x", 5]]),
    baselines: new Map([["x", 10]]),
  };

  test("pillar listed under the platform's priors reads matches-prior", () => {
    const sc = strategyCfg({ platform_pillar_priors: { x: ["claude-code", "builder"] } });
    const r = classifyFit("x", "claude-code", cfg(), data, [], sc);
    assert.equal(r.priorMatch, "matches-prior");
  });

  test("pillar NOT listed under the platform's priors reads off-prior", () => {
    const sc = strategyCfg({ platform_pillar_priors: { x: ["career-work"] } });
    const r = classifyFit("x", "claude-code", cfg(), data, [], sc);
    assert.equal(r.priorMatch, "off-prior");
  });

  test("a platform with no configured priors reads no-prior", () => {
    const r = classifyFit("x", "claude-code", cfg(), data, [], strategyCfg());
    assert.equal(r.priorMatch, "no-prior");
  });
});

describe("classifyFit: recency-weighted engagement", () => {
  test("within a mixed-age group, recency weighting skews the average toward the more recent post", () => {
    // A weighted average of a single row always returns that row's own value regardless of age
    // (the weight cancels out) — the skew is only observable across a mixed-age group, same as
    // resonance.ts's rcEng. Old post: 0 engagement, 12 weeks ago. Recent post: 20 engagement, now.
    const now = Date.now();
    const rows: ReturnType<typeof loadRows> = [
      { platform: "x", pillar: "human-ai", posted_at: new Date(now - 12 * 7 * 24 * 3600 * 1000).toISOString(), likes: 0, replies: 0, reposts: 0 },
      { platform: "x", pillar: "human-ai", posted_at: new Date(now).toISOString(), likes: 20, replies: 0, reposts: 0 },
    ];
    const data: LoadedData = {
      cells: new Map([["x|human-ai", { n: 2, avg_eng: 10 }]]), // plain average = (0+20)/2 = 10
      weeks: new Map([["x", 5]]),
      baselines: new Map([["x", 10]]),
    };
    const r = classifyFit("x", "human-ai", cfg(), data, rows, strategyCfg(), now);
    assert.ok(
      r.recencyWeightedEng! > 10,
      "recency weighting should pull the average above the plain average, toward the recent post's higher engagement"
    );
  });

  test("no matching rows for the cell leaves recencyWeightedEng null", () => {
    const data: LoadedData = {
      cells: new Map([["x|human-ai", { n: 1, avg_eng: 10 }]]),
      weeks: new Map([["x", 5]]),
      baselines: new Map([["x", 10]]),
    };
    const r = classifyFit("x", "human-ai", cfg(), data, [], strategyCfg());
    assert.equal(r.recencyWeightedEng, null);
  });
});

describe("rankPlatformFit: ordering (lean-in, steady, ease-off, insufficient-data; highest score first within a label)", () => {
  test("sorts labels in the guardrail order and score descending within a label", () => {
    const data: LoadedData = {
      cells: new Map([
        ["x|human-ai", { n: 5, avg_eng: 20 }], // score 2.0 -> lean-in
        ["linkedin|human-ai", { n: 5, avg_eng: 8 }], // score 0.8 -> steady
        ["bluesky|human-ai", { n: 5, avg_eng: 2 }], // score 0.2 -> ease-off
        ["x|builder", { n: 1, avg_eng: 100 }], // insufficient (n<3)
      ]),
      weeks: new Map([
        ["x", 5],
        ["linkedin", 5],
        ["bluesky", 5],
      ]),
      baselines: new Map([
        ["x", 10],
        ["linkedin", 10],
        ["bluesky", 10],
      ]),
    };
    const rows = [
      { platform: "x", pillar: "human-ai", posted_at: null, likes: 20, replies: 0, reposts: 0 },
      { platform: "linkedin", pillar: "human-ai", posted_at: null, likes: 8, replies: 0, reposts: 0 },
      { platform: "bluesky", pillar: "human-ai", posted_at: null, likes: 2, replies: 0, reposts: 0 },
      { platform: "x", pillar: "builder", posted_at: null, likes: 100, replies: 0, reposts: 0 },
    ];
    const ranked = rankPlatformFit(cfg(), data, rows, strategyCfg());

    // The three human-ai pairs with real data must come out in guardrail order: lean-in, steady, ease-off.
    const humanAiLabels = ranked.filter((r) => r.pillar === "human-ai").map((r) => r.label);
    assert.deepEqual(humanAiLabels, ["lean-in", "steady", "ease-off"]);

    // Every insufficient-data pair (the thin x|builder cell) sorts after every pair with a real read.
    const lastRealIdx = ranked.map((r) => r.label).lastIndexOf("ease-off");
    const firstInsufficientIdx = ranked.findIndex((r) => r.label === "insufficient-data");
    assert.ok(firstInsufficientIdx > lastRealIdx);
  });

  test("only ranks CORE_TEXT platforms that actually have rows (community targets excluded)", () => {
    const data: LoadedData = { cells: new Map(), weeks: new Map(), baselines: new Map() };
    const rows = [{ platform: "x", pillar: "human-ai", posted_at: null, likes: 1, replies: 0, reposts: 0 }];
    const ranked = rankPlatformFit(cfg(), data, rows, strategyCfg());
    const platforms = new Set(ranked.map((r) => r.platform));
    assert.ok(platforms.has("x"));
    assert.ok(!platforms.has("linkedin"), "linkedin has no rows in this fixture, so it should not appear");
  });
});

describe("loadRows: excludes deliberate spin-control-run and exploration-probe rows", () => {
  test("both CONTROL_RUN_SOURCE and EXPLORATION_SOURCE rows are excluded (route.ts's loadData policy)", () => {
    const db = freshDb();
    insertPost(db, "x", "human-ai", "organic", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "x", "human-ai", CONTROL_RUN_SOURCE, "2026-06-08T00:00:00.000Z", 1000);
    insertPost(db, "x", "human-ai", EXPLORATION_SOURCE, "2026-06-15T00:00:00.000Z", 1000);
    const rows = loadRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].likes, 10);
    db.close();
  });
});

describe("loadRows + loadData agree on cell membership (real db, not fixtures)", () => {
  test("a cell present in loadData() has matching rows from loadRows()", () => {
    const db = freshDb();
    insertPost(db, "linkedin", "career-work", "organic", "2026-06-01T00:00:00.000Z", 15);
    insertPost(db, "linkedin", "career-work", "organic", "2026-06-08T00:00:00.000Z", 25);
    const data = loadData(undefined, db);
    const rows = loadRows(db);
    const cell = data.cells.get("linkedin|career-work")!;
    const matching = rows.filter((r) => r.platform === "linkedin" && r.pillar === "career-work");
    assert.equal(matching.length, cell.n);
    db.close();
  });
});
