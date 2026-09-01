import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import {
  applyExplorationOverride,
  applyOriginBlock,
  applySubstackRepost,
  CONTROL_RUN_SOURCE,
  CORE_TEXT,
  decideForPillar,
  loadData,
  mergeDecisions,
  originPlatform,
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
      .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, pillar, source, brand_id, provider_account_id) VALUES (?, ?, ?, ?, ?, 'human-inference', 'test/account')`)
      .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, pillar, source);
    db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts, brand_id, provider_account_id) VALUES (?, ?, ?, 0, 0, 'human-inference', 'test/account')`).run(
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

    const data = loadData(undefined, db, { brandId: "human-inference" });
    const cell = data.cells.get("x|human-ai")!;
    assert.equal(cell.n, 2, "the spin-control-run row must not be counted in n");
    assert.equal(cell.avg_eng, 11, "avg must be computed from only the two organic posts (10, 12) -> 11");
    db.close();
  });

  test("a post with NULL source is treated as a normal (non-control) post", () => {
    const db = freshDb();
    insertPost(db, "bluesky", "civic-tech", null, "2026-06-01T00:00:00.000Z", 5);
    const data = loadData(undefined, db, { brandId: "human-inference" });
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

describe("originPlatform: mapping source.md `origin` onto a routing channel (v5 handoff §9.9)", () => {
  test("maps the platforms whose origin URL names them unambiguously", () => {
    assert.equal(originPlatform("https://www.linkedin.com/posts/muxin-li_something-activity-7123"), "linkedin");
    assert.equal(originPlatform("https://linkedin.com/feed/update/urn:li:activity:7123"), "linkedin");
    assert.equal(originPlatform("https://x.com/humaninference/status/1234567890"), "x");
    assert.equal(originPlatform("https://twitter.com/humaninference/status/1234567890"), "x", "twitter.com is the same channel as x.com");
    assert.equal(originPlatform("https://mobile.twitter.com/humaninference/status/1"), "x", "subdomains resolve too");
    assert.equal(originPlatform("https://bsky.app/profile/humaninference.bsky.social/post/3k"), "bluesky");
    assert.equal(originPlatform("https://www.threads.net/@humaninference/post/Cabc"), "threads");
    assert.equal(originPlatform("https://www.threads.com/@humaninference/post/Cabc"), "threads");
    assert.equal(originPlatform("https://humaninference.substack.com/p/some-essay"), "substack");
    assert.equal(originPlatform("https://substack.com/@humaninference/note/c-292558121"), "substack");
  });

  test("HTTP is treated the same as HTTPS", () => {
    assert.equal(originPlatform("http://www.linkedin.com/posts/x-activity-7123"), "linkedin");
  });

  test("the scaffolder's non-URL origins name no platform at all", () => {
    // new-content.ts writes exactly these three shapes for a non-URL source.
    assert.equal(originPlatform("file:Building an Innovation Nation.md"), undefined);
    assert.equal(originPlatform("voice-memo:idea.m4a"), undefined);
    assert.equal(originPlatform("pasted-text"), undefined);
    assert.equal(originPlatform(""), undefined, "an absent origin (readSourceOrigin returns '') names nothing");
  });

  test("platforms this repo cannot resolve a host for FAIL OPEN rather than being guessed", () => {
    // Mastodon is federated and no instance host is configured anywhere in config/; a community
    // is recorded in config/platforms.yaml with notes only, no URL. Guessing either would drop a
    // channel on no evidence, so both must return undefined.
    assert.equal(originPlatform("https://mastodon.social/@humaninference/1234"), undefined);
    assert.equal(originPlatform("https://hachyderm.io/@humaninference/1234"), undefined);
    assert.equal(originPlatform("https://circle.so/c/democratic-resilience/post/abc"), undefined);
    assert.equal(originPlatform("https://humaninference.com/p/some-essay"), undefined, "a Substack publication on a custom domain carries no substack.com marker");
  });

  test("a malformed URL fails open instead of throwing", () => {
    assert.equal(originPlatform("https://"), undefined);
  });

  test("a lookalike hostname does not match by substring", () => {
    assert.equal(originPlatform("https://notlinkedin.com/posts/1"), undefined, "suffix match is on a dot boundary, not a substring");
    assert.equal(originPlatform("https://x.com.evil.example/status/1"), undefined, "the registrable domain must be the tail of the host");
  });
});

describe("applyOriginBlock: a piece is never routed back to the platform it is already live on", () => {
  function md(overrides: Partial<MergedDecision>): MergedDecision {
    return { platform: "x", decision: "include", score: null, confidence: "cold-start", rationale: "", pillars: ["human-ai"], ...overrides };
  }

  test("a LinkedIn-origin piece never routes to linkedin, even though config defaults include it", () => {
    const merged = [
      md({ platform: "linkedin", decision: "include", confidence: "cold-start", rationale: "cold-start (no tagged data yet) — posting broadly to gather signal" }),
      md({ platform: "x", decision: "include" }),
    ];
    const out = applyOriginBlock(merged, "https://www.linkedin.com/posts/muxin-li_x-activity-7123");
    const li = out.find((m) => m.platform === "linkedin")!;
    assert.equal(li.decision, "skip", "the origin platform is a hard exclusion, outranking the config `include` default");
    assert.equal(li.confidence, "rule", "'rule' is the un-overridable confidence — applyExplorationOverride and validate.ts both key off it");
  });

  test("the exclusion is VISIBLE: the row survives, saying it is already live there and what the decision was before", () => {
    const merged = [md({ platform: "linkedin", rationale: "cold-start (no tagged data yet) — posting broadly to gather signal" })];
    const out = applyOriginBlock(merged, "https://www.linkedin.com/posts/muxin-li_x-activity-7123");
    assert.equal(out.length, merged.length, "a blocked channel must not vanish from routing.md");
    assert.match(out[0].rationale, /already live there/, "routing.md has to say WHY the channel was excluded");
    assert.match(out[0].rationale, /linkedin\.com/, "and name the origin it read that from");
    assert.match(out[0].rationale, /Was: cold-start \(no tagged data yet\)/, "and preserve the decision it replaced");
  });

  test("the text this block introduces carries no em dash (root CLAUDE.md rule 5: routing.md is a file Muxin reads)", () => {
    const merged = [md({ platform: "linkedin", rationale: "cold-start (no tagged data yet), posting broadly to gather signal" })];
    const out = applyOriginBlock(merged, "https://www.linkedin.com/posts/muxin-li_x-activity-7123");
    assert.ok(!out[0].rationale.includes("\u2014"), "no em dash in the origin-block rationale");
  });

  test("a data-driven include is blocked just the same (the block outranks every include path)", () => {
    const merged = [md({ platform: "x", decision: "include", score: 1.8, confidence: "data", rationale: "config default: include — data shows 1.80× platform norm (n=9)" })];
    const out = applyOriginBlock(merged, "https://x.com/humaninference/status/1234567890");
    assert.equal(out[0].decision, "skip");
    assert.equal(out[0].confidence, "rule");
  });

  test("no origin recorded: decisions are byte-identical to today's behaviour", () => {
    const merged = [md({ platform: "x" }), md({ platform: "linkedin" }), md({ platform: "bluesky", decision: "skip" })];
    assert.deepEqual(applyOriginBlock(merged, ""), merged);
  });

  test("a local/pasted origin routes exactly as it does today", () => {
    const merged = [md({ platform: "x" }), md({ platform: "linkedin" })];
    assert.deepEqual(applyOriginBlock(merged, "file:Building an Innovation Nation.md"), merged);
    assert.deepEqual(applyOriginBlock(merged, "voice-memo:idea.m4a"), merged);
    assert.deepEqual(applyOriginBlock(merged, "pasted-text"), merged);
  });

  test("an origin the mapper cannot resolve routes normally rather than losing a channel", () => {
    const merged = [md({ platform: "x" }), md({ platform: "mastodon" }), md({ platform: "linkedin" })];
    assert.deepEqual(applyOriginBlock(merged, "https://mastodon.social/@humaninference/1234"), merged, "an unmappable host must fail open, never fail wrong");
    assert.deepEqual(applyOriginBlock(merged, "https://some-blog.example/posts/1"), merged);
  });

  test("only the origin platform is touched — every other channel keeps its exact decision", () => {
    const merged = [md({ platform: "linkedin" }), md({ platform: "x" }), md({ platform: "bluesky" }), md({ platform: "quote-card", confidence: "always" })];
    const out = applyOriginBlock(merged, "https://www.linkedin.com/posts/muxin-li_x-activity-7123");
    assert.deepEqual(out.filter((m) => m.platform !== "linkedin"), merged.filter((m) => m.platform !== "linkedin"));
  });

  test("a channel already skipping is left exactly as it was (no rationale rewrite)", () => {
    const merged = [md({ platform: "linkedin", decision: "skip", confidence: "rule", rationale: "editorial rule: never route here" })];
    assert.deepEqual(applyOriginBlock(merged, "https://www.linkedin.com/posts/muxin-li_x-activity-7123"), merged);
  });

  test("DEMOTE-ONLY: never appends a decision for a platform that was not already a candidate", () => {
    const merged = [md({ platform: "x" })];
    const out = applyOriginBlock(merged, "https://humaninference.substack.com/p/some-essay");
    assert.deepEqual(out, merged, "substack was never a candidate, so there is nothing to exclude and no row to invent");
  });

  test("an exploration probe cannot punch through the origin block", () => {
    const blocked = applyOriginBlock([md({ platform: "linkedin" })], "https://www.linkedin.com/posts/muxin-li_x-activity-7123");
    const out = applyExplorationOverride(blocked, "human-ai", "linkedin");
    assert.deepEqual(out, blocked, "confidence 'rule' is what applyExplorationOverride refuses to override");
  });

  test("main()'s order keeps the Muxin-approved Note repost alive (card df11d0db)", () => {
    // A Substack Note's origin IS substack, and the block runs BEFORE applySubstackRepost. Since
    // the block is demote-only, `substack` is still absent when the repost hook runs, so the one
    // republish-to-origin Muxin decided on purpose still happens.
    const merged = [md({ platform: "x" }), md({ platform: "bluesky" })];
    const blocked = applyOriginBlock(merged, "https://substack.com/@humaninference/note/c-292558121");
    const out = applySubstackRepost(blocked, ["human-ai"], "substack-note");
    const sub = out.find((m) => m.platform === "substack");
    assert.ok(sub, "the Note repost must survive the origin block");
    assert.equal(sub!.decision, "include");
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
