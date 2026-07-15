import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import {
  applyExplorationOverride,
  applySubstackRepost,
  CONTROL_RUN_SOURCE,
  CORE_TEXT,
  decideForPillar,
  loadData,
  mergeDecisions,
  type Decision,
  type LoadedData,
  type MergedDecision,
  type RoutingConfig,
} from "./route.js";

function d(overrides: Partial<Decision>): Decision {
  return { platform: "x", decision: "include", score: null, confidence: "cold-start", rationale: "", ...overrides };
}

function cfg(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaults: {},
    rules: {},
    thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: [] },
    ...overrides,
  };
}

describe("decideForPillar: decision is ALWAYS defaults-driven, score never overrides it (card 7e550e48)", () => {
  test("a defaults-listed platform with sufficient data but a LOW score still includes (old score-driven logic would have skipped it)", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    const data: LoadedData = {
      cells: new Map([["x|human-ai", { n: 5, avg_eng: 1 }]]), // well below baseline
      weeks: new Map([["x", 5]]),
      baselines: new Map([["x", 10]]),
    };
    const decisions = decideForPillar("human-ai", c, data);
    const x = decisions.find((x) => x.platform === "x")!;
    assert.equal(x.decision, "include", "in defaults -> include regardless of score");
    assert.equal(x.confidence, "data", "confidence still reflects that data was sufficient");
    assert.ok(x.score !== null && x.score < c.thresholds.skip_below_score, "score is computed and attached, and is indeed below skip_below_score");
  });

  test("a NON-defaults platform with sufficient data and a HIGH score still skips (old score-driven logic would have included it)", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } }); // linkedin not in defaults for this pillar
    const data: LoadedData = {
      cells: new Map([["linkedin|human-ai", { n: 5, avg_eng: 20 }]]), // well above baseline
      weeks: new Map([["linkedin", 5]]),
      baselines: new Map([["linkedin", 10]]),
    };
    const decisions = decideForPillar("human-ai", c, data);
    const li = decisions.find((x) => x.platform === "linkedin")!;
    assert.equal(li.decision, "skip", "not in defaults -> skip regardless of score");
    assert.equal(li.confidence, "data");
    assert.ok(li.score !== null && li.score >= c.thresholds.skip_below_score, "score is computed and attached, and is indeed at/above skip_below_score");
  });

  test("insufficient data (cold-start) still falls back to defaults, unchanged from before", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    const data: LoadedData = { cells: new Map(), weeks: new Map(), baselines: new Map() };
    const decisions = decideForPillar("human-ai", c, data);
    assert.equal(decisions.find((x) => x.platform === "x")!.decision, "include");
    assert.equal(decisions.find((x) => x.platform === "linkedin")!.decision, "skip");
    assert.equal(decisions.find((x) => x.platform === "x")!.confidence, "cold-start");
  });

  test("`never`/`always` editorial rules still override the defaults-driven decision, unaffected by this change", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] }, rules: { "human-ai": { always: ["linkedin"], never: ["x"] } } });
    const data: LoadedData = { cells: new Map(), weeks: new Map(), baselines: new Map() };
    const decisions = decideForPillar("human-ai", c, data);
    const x = decisions.find((d) => d.platform === "x")!;
    const li = decisions.find((d) => d.platform === "linkedin")!;
    assert.equal(x.decision, "skip");
    assert.equal(x.confidence, "rule");
    assert.equal(li.decision, "include");
    assert.equal(li.confidence, "rule");
  });
});

describe("mergeDecisions: platform-fit gate across multiple pillars", () => {
  test("includes a platform if either pillar includes it", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "bluesky", decision: "include", confidence: "cold-start" })]],
      ["human-ai", [d({ platform: "bluesky", decision: "skip", confidence: "cold-start" })]],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const bluesky = merged.find((m) => m.platform === "bluesky")!;
    assert.equal(bluesky.decision, "include");
    assert.deepEqual(bluesky.pillars, ["civic-tech"]);
  });

  test("a `never` rule from one pillar hard-vetoes the platform even if another pillar includes it", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "x", decision: "skip", confidence: "rule", rationale: "editorial rule: never route here" })]],
      ["human-ai", [d({ platform: "x", decision: "include", confidence: "cold-start" })]],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const x = merged.find((m) => m.platform === "x")!;
    assert.equal(x.decision, "skip");
    assert.equal(x.confidence, "rule");
    assert.match(x.rationale, /hard veto/);
  });

  test("skips a platform no pillar includes", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "linkedin", decision: "skip", confidence: "cold-start" })]],
      ["human-ai", [d({ platform: "linkedin", decision: "skip", confidence: "cold-start" })]],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const li = merged.find((m) => m.platform === "linkedin")!;
    assert.equal(li.decision, "skip");
    assert.deepEqual(li.pillars, []);
  });

  test("a platform only one pillar considered still resolves correctly", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "community:democratic-resilience", decision: "include", confidence: "rule" })]],
      ["human-ai", []],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const community = merged.find((m) => m.platform === "community:democratic-resilience")!;
    assert.equal(community.decision, "include");
  });
});

describe("loadData: excludes deliberate spin-control-run rows from the main resonance figures (card f444f440)", () => {
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

  test("a spin-control-run post is excluded from the pillar/platform cell's n and avg_eng", () => {
    const db = freshDb();
    insertPost(db, "x", "human-ai", "organic", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "x", "human-ai", "organic", "2026-06-08T00:00:00.000Z", 12);
    insertPost(db, "x", "human-ai", CONTROL_RUN_SOURCE, "2026-06-15T00:00:00.000Z", 1000);

    const data = loadData(undefined, db);
    const cell = data.cells.get("x|human-ai")!;
    assert.equal(cell.n, 2, "the spin-control-run row must not be counted in n");
    assert.equal(cell.avg_eng, 11, "avg must be computed from only the two organic posts (10, 12) -> 11");
    db.close();
  });

  test("a post with NULL source is treated as a normal (non-control) post", () => {
    const db = freshDb();
    insertPost(db, "bluesky", "civic-tech", null, "2026-06-01T00:00:00.000Z", 5);
    const data = loadData(undefined, db);
    assert.equal(data.cells.get("bluesky|civic-tech")!.n, 1);
    db.close();
  });
});

describe("applyExplorationOverride: the exploration-budget's routing hook (card 92bb2ae6)", () => {
  function md(overrides: Partial<MergedDecision>): MergedDecision {
    return { platform: "linkedin", decision: "skip", score: null, confidence: "cold-start", rationale: "", pillars: ["human-ai"], ...overrides };
  }

  test("flips a skipped off-assignment platform to include, tagged confidence 'exploration'", () => {
    const merged = [md({ platform: "linkedin", decision: "skip" }), md({ platform: "x", decision: "include", confidence: "data" })];
    const out = applyExplorationOverride(merged, "civic-tech", "linkedin");
    const li = out.find((m) => m.platform === "linkedin")!;
    assert.equal(li.decision, "include");
    assert.equal(li.confidence, "exploration");
    assert.match(li.rationale, /exploration probe/);
    assert.match(li.rationale, /exploration_probe: true/);
    assert.ok(li.pillars.includes("civic-tech"));
  });

  test("leaves every OTHER platform's decision completely untouched", () => {
    const merged = [md({ platform: "linkedin", decision: "skip" }), md({ platform: "x", decision: "include", confidence: "data", score: 0.9 })];
    const out = applyExplorationOverride(merged, "civic-tech", "linkedin");
    const x = out.find((m) => m.platform === "x")!;
    assert.deepEqual(x, merged[1], "x is untouched — override targets only the named platform");
  });

  test("a platform ALREADY included by the normal decision is left as-is (no-op, no confidence downgrade)", () => {
    const merged = [md({ platform: "linkedin", decision: "include", confidence: "data", score: 0.8 })];
    const out = applyExplorationOverride(merged, "civic-tech", "linkedin");
    assert.deepEqual(out, merged, "already-include must not be relabeled 'exploration'");
  });

  test("a platform absent from the merged decisions entirely is a no-op (nothing to flip)", () => {
    const merged = [md({ platform: "x", decision: "include", confidence: "data" })];
    const out = applyExplorationOverride(merged, "civic-tech", "linkedin");
    assert.deepEqual(out, merged);
  });

  test("a platform under an explicit editorial `never` rule (confidence 'rule') is left as-is — a probe must never punch through a hard veto", () => {
    const merged = [md({ platform: "linkedin", decision: "skip", confidence: "rule", rationale: "editorial rule: never route here" })];
    const out = applyExplorationOverride(merged, "civic-tech", "linkedin");
    assert.deepEqual(out, merged, "a hard veto must not be relabeled 'exploration'");
  });
});

describe("CORE_TEXT: substack is never an unconditional routing target", () => {
  test("substack is absent from CORE_TEXT", () => {
    assert.ok(!CORE_TEXT.includes("substack"), "substack must only ever be added conditionally, via applySubstackRepost");
  });
});

describe("applySubstackRepost: the Substack-Notes repost hook (card df11d0db)", () => {
  function md(overrides: Partial<MergedDecision>): MergedDecision {
    return { platform: "x", decision: "include", score: null, confidence: "cold-start", rationale: "", pillars: ["human-ai"], ...overrides };
  }

  test("a Note-sourced piece (source_kind: substack-note) gets `substack` added as `include`", () => {
    const merged = [md({ platform: "x" })];
    const out = applySubstackRepost(merged, ["human-ai"], "substack-note");
    const sub = out.find((m) => m.platform === "substack");
    assert.ok(sub, "substack decision must be present");
    assert.equal(sub!.decision, "include");
    assert.equal(sub!.confidence, "rule");
    assert.match(sub!.rationale, /substack-note/);
    assert.deepEqual(sub!.pillars, ["human-ai"]);
  });

  test("an ordinary (non-Note) piece — empty source_kind — never gets `substack` added", () => {
    const merged = [md({ platform: "x" }), md({ platform: "linkedin" })];
    const out = applySubstackRepost(merged, ["human-ai"], "");
    assert.equal(out.find((m) => m.platform === "substack"), undefined);
    assert.deepEqual(out, merged, "non-note content's decisions are completely untouched");
  });

  test("a piece with a different source_kind (e.g. outreach-message) never gets `substack` added", () => {
    const merged = [md({ platform: "x" })];
    const out = applySubstackRepost(merged, ["human-ai"], "outreach-message");
    assert.equal(out.find((m) => m.platform === "substack"), undefined);
  });

  test("a no-op when `substack` is already present (never duplicates the entry)", () => {
    const existing = md({ platform: "substack", decision: "skip", confidence: "cold-start" });
    const merged = [existing];
    const out = applySubstackRepost(merged, ["human-ai"], "substack-note");
    assert.deepEqual(out, merged, "an already-present substack decision is left untouched, not duplicated");
  });

  test("carries every pillar passed in, for a multi-pillar Note", () => {
    const out = applySubstackRepost([], ["human-ai", "builder"], "substack-note");
    assert.deepEqual(out.find((m) => m.platform === "substack")!.pillars, ["human-ai", "builder"]);
  });
});
