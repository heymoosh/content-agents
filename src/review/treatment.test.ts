import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { routingMd } from "../strategy/route.js";
import {
  readTreatment,
  fitLabelFor,
  reuseKeyFor,
  parsePillars,
  allChannels,
  type TreatmentDeps,
} from "./treatment.js";
import type { LoadedData, RoutingConfig } from "../strategy/route.js";
import type { ReuseCheckResult } from "../publish/reuse-guard.js";

const CFG: RoutingConfig = {
  defaults: {
    "human-ai": ["x", "linkedin", "bluesky"],
    "civic-tech": ["bluesky", "community:democratic-resilience"],
  },
  rules: { "civic-tech": { always: ["community:democratic-resilience"] } },
  thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: ["quote-card"] },
};

// Enough posts/weeks that computeFit reports confidence "data" — n >= min_posts_for_data (3) and
// weeks >= 4. avg_eng vs the platform baseline is what sets the score.
function dataFor(scores: Record<string, number>): LoadedData {
  const cells = new Map<string, { n: number; avg_eng: number }>();
  const weeks = new Map<string, number>();
  const baselines = new Map<string, number>();
  for (const [platform, score] of Object.entries(scores)) {
    cells.set(`${platform}|human-ai`, { n: 10, avg_eng: score * 100 });
    weeks.set(platform, 12);
    baselines.set(platform, 100);
  }
  return { cells, weeks, baselines };
}

const COLD: LoadedData = { cells: new Map(), weeks: new Map(), baselines: new Map() };

function fakeSlots() {
  return { times: ["2026-09-01T16:30:00.000Z"], labels: ["Tue, Sep 1, 9:30 AM PT"] };
}

// A content folder holding just the routing.md readTreatment reads the pillar from.
function folderWith(routingMd: string | null): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "treatment-"));
  if (routingMd !== null) writeFileSync(join(dir, "routing.md"), routingMd);
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// Multi-pillar on purpose: real routing.md files carry "civic-tech + human-ai" headings, and only
// civic-tech's `always` rule pulls the community room into the channel list.
const ROUTING_MD = `# Routing — civic-tech + human-ai — 2026-08-22

| platform | decision | fit | confidence | why |
|---|---|---|---|---|
| x | include | 1.07 | data | data: 1.07× platform norm (n=65) |
| linkedin | skip | — | brief | hand-corrected per the brief |
`;

function base(deps: Partial<TreatmentDeps> = {}): TreatmentDeps {
  return {
    cfg: CFG,
    data: COLD,
    claimSlots: fakeSlots as unknown as TreatmentDeps["claimSlots"],
    checkReuse: (_slug, platform) => ({ allowed: true, minDays: platform === "linkedin" ? 60 : 14 }),
    ...deps,
  };
}

// --- fit labels ------------------------------------------------------------

test("fitLabelFor covers the four buckets off measured data", () => {
  assert.deepEqual(fitLabelFor({ score: 1.4, confidence: "data" }, 0.4), { label: "STRONG FIT", basis: "measured" });
  assert.deepEqual(fitLabelFor({ score: 1.0, confidence: "data" }, 0.4), { label: "STRONG FIT", basis: "measured" });
  assert.deepEqual(fitLabelFor({ score: 0.7, confidence: "data" }, 0.4), { label: "REACH ONLY", basis: "measured" });
  assert.deepEqual(fitLabelFor({ score: 0.4, confidence: "data" }, 0.4), { label: "REACH ONLY", basis: "measured" });
  assert.deepEqual(fitLabelFor({ score: 0.2, confidence: "data" }, 0.4), { label: "POOR FIT", basis: "measured" });
});

test("fitLabelFor reads the floor from config, not a literal 0.4", () => {
  // Same score, different configured floor → different bucket.
  assert.equal(fitLabelFor({ score: 0.5, confidence: "data" }, 0.4).label, "REACH ONLY");
  assert.equal(fitLabelFor({ score: 0.5, confidence: "data" }, 0.8).label, "POOR FIT");
});

test("cold-start overrides any score — it is not a weak STRONG FIT", () => {
  assert.deepEqual(fitLabelFor({ score: null, confidence: "cold-start" }, 0.4), {
    label: "COLD START",
    basis: "insufficient-data",
  });
  // Even if a score somehow rode along, cold-start still wins: it means "no verdict yet".
  assert.equal(fitLabelFor({ score: 2.5, confidence: "cold-start" }, 0.4).label, "COLD START");
  assert.equal(fitLabelFor({ score: 0.05, confidence: "cold-start" }, 0.4).label, "COLD START");
  assert.equal(fitLabelFor({ score: null, confidence: "exploration" }, 0.4).label, "COLD START");
});

test("editorial rules and format assets get NO label, only a basis", () => {
  assert.deepEqual(fitLabelFor({ score: null, confidence: "rule" }, 0.4), { label: null, basis: "editorial-rule" });
  assert.deepEqual(fitLabelFor({ score: null, confidence: "always" }, 0.4), { label: null, basis: "format-asset" });
});

// --- reuse keys ------------------------------------------------------------

test("reuseKeyFor maps routing channel names onto Placed-log platform names", () => {
  assert.equal(reuseKeyFor("linkedin"), "linkedin");
  assert.equal(reuseKeyFor("community:democratic-resilience"), "community");
  assert.equal(reuseKeyFor("quote-card"), null); // cards are reuse-checked per fan-out target
});

// --- pillar ----------------------------------------------------------------

// The HISTORICAL heading, still on disk in every routing.md written before 2026-08-23. These files
// are never rewritten, so this test must keep passing forever.
test("parsePillars reads the pre-2026-08-23 em-dash routing.md headings", () => {
  assert.deepEqual(parsePillars("# Routing — human-ai — 2026-06-16\n"), ["human-ai"]);
  assert.deepEqual(parsePillars("# Routing — civic-tech + human-ai — 2026-07-04\n"), ["civic-tech", "human-ai"]);
  assert.deepEqual(parsePillars("# Some other doc\n"), []);
  assert.deepEqual(parsePillars("# Routing — not-a-pillar — 2026-07-04\n"), []);
});

test("parsePillars reads the current parenthesized-date routing.md headings", () => {
  assert.deepEqual(parsePillars("# Routing: human-ai (2026-06-16)\n"), ["human-ai"]);
  assert.deepEqual(parsePillars("# Routing: civic-tech + human-ai (2026-07-04)\n"), ["civic-tech", "human-ai"]);
  assert.deepEqual(parsePillars("# Routing: not-a-pillar (2026-07-04)\n"), []);
});

// ROUND TRIP. The bug this guards against: route.ts changed its heading punctuation and parsePillars
// still demanded the old one, so every newly written routing.md silently read as "no pillar" and the
// Content room's treatment step went blank. Nothing caught it because every parse test fed a
// hand-typed fixture. This drives the REAL writer instead, so the two can never drift again.
test("parsePillars round-trips routing.md exactly as route.ts writes it", () => {
  const decisions = [
    { platform: "x", decision: "include" as const, score: 1.2, confidence: "data" as const, rationale: "why", pillars: ["human-ai"] },
  ];
  assert.deepEqual(parsePillars(routingMd(["human-ai"], decisions)), ["human-ai"]);
  assert.deepEqual(parsePillars(routingMd(["civic-tech", "human-ai"], decisions)), ["civic-tech", "human-ai"]);
});

test("allChannels is derived from config, not a hardcoded list", () => {
  const channels = allChannels(CFG);
  assert.ok(channels.includes("x") && channels.includes("bluesky") && channels.includes("linkedin"));
  assert.ok(channels.includes("community:democratic-resilience"));
  assert.ok(channels.includes("quote-card"));
});

// --- per-channel reuse windows --------------------------------------------

test("each channel carries its OWN reuse window, read through the real config", () => {
  const f = folderWith(ROUTING_MD);
  try {
    // No checkReuse injection: this runs the REAL reuse guard against config/platforms.yaml, so a
    // regression to a single global window fails here. A slug with no Placed-log row returns
    // { allowed: true, minDays } deterministically whatever bets.md happens to contain.
    const t = readTreatment("no-such-slug-ever-placed-anywhere", {
      cfg: CFG,
      data: COLD,
      folder: f.dir,
      claimSlots: fakeSlots as unknown as TreatmentDeps["claimSlots"],
    });
    const min = (c: string) => t.channels.find((x) => x.channel === c)!.reuse!.minDays;
    assert.equal(min("linkedin"), 60);
    assert.equal(min("x"), 14);
    assert.equal(min("bluesky"), 21);
    assert.notEqual(min("linkedin"), min("x")); // never one global number
    // The global fallback (config/platforms.yaml min_reuse_days: 30) for a channel with no entry.
    assert.equal(t.channels.find((c) => c.channel === "community:democratic-resilience")!.reuse!.minDays, 30);
  } finally {
    f.cleanup();
  }
});

test("never-placed reads as an explicit unknown, not as a measured zero", () => {
  const f = folderWith(ROUTING_MD);
  try {
    const t = readTreatment("slug", base({ folder: f.dir }));
    const x = t.channels.find((c) => c.channel === "x")!;
    assert.equal(x.reuse!.everPlaced, false);
    assert.equal(x.reuse!.lastPlacedAt, null);
    assert.equal(x.reuse!.daysSince, null);
    assert.equal(x.reuse!.allowed, true);
    assert.equal(x.reuse!.reason, null);
  } finally {
    f.cleanup();
  }
});

test("reuse-held branch carries the real reason, days and that channel's window", () => {
  const held: ReuseCheckResult = {
    allowed: false,
    reason: '"slug" was last published to linkedin 3.0 days ago (min_reuse_days: 60)',
    lastPlacedAt: "2026-08-19T12:00:00.000Z",
    daysSince: 3,
    minDays: 60,
  };
  const f = folderWith(ROUTING_MD);
  try {
    const t = readTreatment(
      "slug",
      base({ folder: f.dir, checkReuse: (_s, p) => (p === "linkedin" ? held : { allowed: true, minDays: 14 }) })
    );
    const li = t.channels.find((c) => c.channel === "linkedin")!;
    assert.equal(li.reuse!.allowed, false);
    assert.equal(li.reuse!.everPlaced, true);
    assert.equal(li.reuse!.daysSince, 3);
    assert.equal(li.reuse!.minDays, 60);
    assert.match(li.reuse!.reason!, /min_reuse_days: 60/);
    assert.equal(t.channels.find((c) => c.channel === "x")!.reuse!.allowed, true);
  } finally {
    f.cleanup();
  }
});

test("quote-card reports no direct reuse check instead of a false all-clear", () => {
  const f = folderWith(ROUTING_MD);
  try {
    const t = readTreatment("slug", base({ folder: f.dir }));
    const card = t.channels.find((c) => c.channel === "quote-card")!;
    assert.equal(card.reuse, null);
    assert.match(card.reuseNote!, /per fan-out target/);
  } finally {
    f.cleanup();
  }
});

// --- fit + policy ----------------------------------------------------------

test("a measured low score is reported as information, never as an exclusion", () => {
  const f = folderWith(ROUTING_MD);
  try {
    const t = readTreatment("slug", base({ folder: f.dir, data: dataFor({ x: 1.3, linkedin: 0.2, bluesky: 0.6 }) }));
    const li = t.channels.find((c) => c.channel === "linkedin")!;
    assert.equal(li.fitLabel, "POOR FIT");
    assert.equal(li.decision, "include"); // config/routing.yaml defaults still decide
    assert.equal(li.belowFloor, true);
    assert.deepEqual(t.scoredBelowFloorButEnabled, ["linkedin"]);
    assert.equal(t.channels.find((c) => c.channel === "x")!.fitLabel, "STRONG FIT");
    assert.equal(t.channels.find((c) => c.channel === "bluesky")!.fitLabel, "REACH ONLY");
    assert.equal(t.floor, 0.4);
  } finally {
    f.cleanup();
  }
});

test("routing.md's recorded decision is returned alongside the recomputed one", () => {
  const f = folderWith(ROUTING_MD);
  try {
    const t = readTreatment("slug", base({ folder: f.dir, data: dataFor({ x: 1.3, linkedin: 0.9 }) }));
    const li = t.channels.find((c) => c.channel === "linkedin")!;
    // routing.md was hand-corrected to skip; the live recompute says include. Both are reported so
    // the UI can show the gate validate.ts actually enforces, not just today's recomputation.
    assert.equal(li.recordedDecision, "skip");
    assert.equal(li.decision, "include");
  } finally {
    f.cleanup();
  }
});

test("no pillar → an explicit no-pillar state, null fit, and reuse/slots still answered", () => {
  const f = folderWith(null); // pasted foreign essay: never routed, no routing.md
  try {
    writeFileSync(join(f.dir, "source.md"), "---\nsource_kind: substack-note\n---\n\nOne compact thought.");
    const t = readTreatment("slug", base({ folder: f.dir }));
    assert.deepEqual(t.pillars, []);
    assert.equal(t.pillarSource, "none");
    assert.ok(t.channels.length > 0);
    for (const c of t.channels) {
      assert.equal(c.fitLabel, null);
      assert.equal(c.fitBasis, "unknown");
      assert.equal(c.decision, null);
      assert.equal(c.confidence, null);
      assert.equal(c.rationale, null);
      assert.equal(c.belowFloor, false);
      assert.ok(c.slot.label.length > 0);
    }
    assert.deepEqual(t.scoredBelowFloorButEnabled, []);
    assert.equal(t.channels.find((c) => c.channel === "linkedin")!.reuse!.minDays, 60);
    assert.deepEqual(t.distribution.platforms.map((item) => item.option), ["x", "threads", "bluesky", "mastodon", "linkedin"]);
    assert.deepEqual(t.distribution.media, []);
  } finally {
    f.cleanup();
  }
});

test("reviewed source-matched mechanism evidence is returned separately from source-fit distribution", () => {
  const f = folderWith(null);
  try {
    writeFileSync(join(f.dir, "source.md"), "I used to think reach was the goal. Now I believe replies are the useful signal.\n");
    const t = readTreatment("slug", base({
      folder: f.dir,
      mechanismBody: "I used to think reach was the goal. Now I believe replies are the useful signal.",
      recommendMechanisms: (body) => [{
        option: "belief-shift", kind: "treatment", recommended: true,
        reason: `Reviewed hypothesis matched: ${body.slice(0, 15)}`,
        source: `research-dossier:sha256:${"a".repeat(64)}`,
      }],
    }));
    assert.equal(t.mechanismRecommendations[0]?.option, "belief-shift");
    assert.equal(t.mechanismRecommendations[0]?.kind, "treatment");
    assert.equal(t.distribution.evidence, "source-fit");
  } finally {
    f.cleanup();
  }
});

test("whole-source text cannot authorize a reviewed mechanism without a server-read approved cut", () => {
  const f = folderWith(null);
  try {
    writeFileSync(join(f.dir, "source.md"), "I used to think reach was the goal. Now I believe replies matter more.\n");
    let called = false;
    const t = readTreatment("slug", base({
      folder: f.dir,
      recommendMechanisms: () => { called = true; return []; },
    }));
    assert.deepEqual(t.mechanismRecommendations, []);
    assert.equal(called, false);
  } finally {
    f.cleanup();
  }
});

test("a bad slug is rejected before any filesystem read", () => {
  assert.throws(() => readTreatment("../etc", base()), /bad slug/);
  assert.throws(() => readTreatment("a/b", base()), /bad slug/);
  assert.throws(() => readTreatment("", base()), /bad slug/);
});

// --- read-only guarantee ---------------------------------------------------

test("the slot lookup is a dry run: the slot ledger is byte-identical afterwards", () => {
  const dir = mkdtempSync(join(tmpdir(), "treatment-ledger-"));
  const ledger = join(dir, "publish-schedule.jsonl");
  const seed =
    JSON.stringify({ platform: "x", day: "2026-09-01", time: "2026-09-01T16:30:00.000Z", asset: "seed", by: "test" }) +
    "\n";
  writeFileSync(ledger, seed);
  const prevLedger = process.env.CONTENT_AGENTS_TEST_LEDGER;
  process.env.CONTENT_AGENTS_TEST_LEDGER = ledger; // ledgerPath() resolves this lazily, per call
  const f = folderWith(ROUTING_MD);
  try {
    // Real claimSlots this time — the point is that dryRun really does skip the append.
    const t = readTreatment("slug", {
      cfg: CFG,
      data: COLD,
      folder: f.dir,
      checkReuse: () => ({ allowed: true, minDays: 14 }),
      now: new Date("2026-08-25T12:00:00.000Z"),
    });
    assert.ok(t.channels.every((c) => c.slot.label.length > 0));
    assert.equal(readFileSync(ledger, "utf8"), seed);
  } finally {
    if (prevLedger === undefined) delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    else process.env.CONTENT_AGENTS_TEST_LEDGER = prevLedger;
    f.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a channel with no cadence entry returns the literal next-free-slot, not a made-up time", () => {
  const dir = mkdtempSync(join(tmpdir(), "treatment-slot-"));
  const ledger = join(dir, "publish-schedule.jsonl");
  const prevLedger = process.env.CONTENT_AGENTS_TEST_LEDGER;
  process.env.CONTENT_AGENTS_TEST_LEDGER = ledger;
  const f = folderWith(ROUTING_MD);
  try {
    const t = readTreatment("slug", {
      cfg: CFG,
      data: COLD,
      folder: f.dir,
      checkReuse: () => ({ allowed: true, minDays: 30 }),
      now: new Date("2026-08-25T12:00:00.000Z"),
    });
    const room = t.channels.find((c) => c.channel === "community:democratic-resilience")!;
    assert.equal(room.slot.label, "next-free-slot");
    assert.equal(room.slot.time, "next-free-slot");
    // A platform that DOES have a cadence resolves to a real PT-anchored slot.
    assert.notEqual(t.channels.find((c) => c.channel === "x")!.slot.label, "next-free-slot");
  } finally {
    if (prevLedger === undefined) delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    else process.env.CONTENT_AGENTS_TEST_LEDGER = prevLedger;
    f.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});
