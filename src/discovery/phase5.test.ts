import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseAnchors,
  selectDiscoveryLens,
  buildAnchorGraphContext,
  collectPassAntiExamples,
  normalizeIdentity,
  decideMidTail,
  classifyRateLimitFailure,
  computeDiscoveryCalibration,
  evaluateCandidateMidTail,
  runDiscover,
  withRateLimitRetry,
  applyDiscoveryEvidenceGates,
  capDiscoveryCandidates,
  shouldBlockColdCalibration,
} from "./discover.js";

describe("phase 5 discovery primitives", () => {
  test("rotates worldview belief, dialect/modality, and anchor subset from persisted run count", () => {
    const lens = selectDiscoveryLens({
      runCount: 2,
      beliefs: ["b1", "b2", "b3"],
      dialects: ["d1", "d2"],
      modalities: ["podcast", "newsletter"],
      anchors: [{ name: "A", why: "one" }, { name: "B", why: "two" }, { name: "C", why: "three" }],
      anchorSubsetSize: 2,
    });
    assert.equal(lens.belief, "b3");
    assert.equal(lens.dialect, "d1");
    assert.equal(lens.modality, "podcast");
    assert.deepEqual(lens.anchors.map((a) => a.name), ["C", "A"]);
  });

  test("parses anchors and includes selected graph context", () => {
    const anchors = parseAnchors("- **Audrey Tang**, former minister: public-interest technologist.\n  build the process that lets people change the system.\n- **CIP**. Why this anchor: participation.\n<!-- machine format:\n  - **Name**. Why this anchor: placeholder.\n-->");
    assert.equal(anchors.length, 2);
    assert.doesNotMatch(anchors[1].why, /machine|placeholder/);
    const context = buildAnchorGraphContext(anchors);
    assert.match(context, /Audrey Tang/);
    assert.match(context, /co-appearance/);
    assert.match(context, /collaboration/);
  });

  test("collects one-line pass reasons as negative anti-examples", () => {
    const examples = collectPassAntiExamples([
      { name: "Nope", status: "passed", body: "## Decision log\n- 2026-08-01: Muxin decided pass (manual, review GUI): audience too large." },
      { name: "Yes", status: "pursue", body: "## Decision log\n- 2026-08-01: status set to pursue." },
    ]);
    assert.deepEqual(examples, ["Nope: audience too large."]);
  });

  test("normalizes aliases and URL/domain variants to one identity", () => {
    assert.equal(normalizeIdentity("https://www.Acme.com/about/"), "acme");
    assert.equal(normalizeIdentity("Acme, Inc."), "acme");
    assert.equal(normalizeIdentity("The Collective Intelligence Project"), normalizeIdentity("collective-intelligence-project.org"));
  });

  test("mid-tail policy emits explicit downgrade or exclusion outcomes", () => {
    assert.deepEqual(decideMidTail({ kind: "platform", audienceSize: 60000 }), { action: "downgrade", reason: "audience_size_at_or_above_cap" });
    assert.deepEqual(decideMidTail({ kind: "client", fundingStage: "series-c" }), { action: "exclude", reason: "funding_stage_at_or_above_cap" });
    assert.deepEqual(decideMidTail({ kind: "client", fundingStage: "seed" }), { action: "keep", reason: "within_mid_tail" });
    assert.deepEqual(decideMidTail({ kind: "platform", audienceSize: 10000, newsletterSubscribers: 60000 }), { action: "downgrade", reason: "audience_size_at_or_above_cap" });
  });

  test("extracts deterministic mid-tail signals from candidate evidence", () => {
    const base = {
      name: "Example",
      url: "https://example.com",
      profile: "An active show.",
      evidenceBlock: "",
      evidence: [],
      disconfirmation: "none",
      classification: "strong",
      classificationNote: "fit",
      pitchAngle: "pitch",
    };
    assert.deepEqual(
      evaluateCandidateMidTail("platform", { ...base, profile: "The newsletter has 62,000 subscribers." }),
      { action: "downgrade", reason: "audience_size_at_or_above_cap" },
    );
    assert.deepEqual(
      evaluateCandidateMidTail("client", { ...base, profile: "The company raised a Series C round." }),
      { action: "exclude", reason: "funding_stage_at_or_above_cap" },
    );
    assert.deepEqual(
      evaluateCandidateMidTail("platform", { ...base, profile: "The show reports 60k monthly downloads." }),
      { action: "downgrade", reason: "audience_size_at_or_above_cap" },
    );
    assert.deepEqual(
      evaluateCandidateMidTail("platform", { ...base, profile: "It appears on a current hype list." }),
      { action: "exclude", reason: "current_hype_list" },
    );
  });

  test("enforces people-first client evidence and downgrades missing disconfirmation", () => {
    const base = { name: "Example", url: "https://example.com", profile: "Profile", evidenceBlock: "", evidence: [], disconfirmation: "", classification: "strong", classificationNote: "fit", pitchAngle: "pitch" };
    assert.equal(applyDiscoveryEvidenceGates("client", base).action, "skip");
    const platform = applyDiscoveryEvidenceGates("platform", base);
    assert.equal(platform.action, "keep");
    assert.equal(platform.candidate.classification, "weak");
    assert.match(platform.candidate.classificationNote, /no disconfirmation pass/i);

    const placeholder = { ...base, evidence: [{ id: "E1", signal: "person-fit", person: "Ada", source: "not-a-url", quote: "n/a", description: "placeholder", captured_at: "" }] };
    assert.equal(applyDiscoveryEvidenceGates("client", placeholder).action, "skip");
    const evidenced = { ...base, evidence: [{ id: "E1", signal: "person-fit", person: "Ada", source: "https://example.com/interview", quote: "I want to rebuild the institution.", description: "direct quote", captured_at: "" }] };
    assert.equal(applyDiscoveryEvidenceGates("client", evidenced).action, "keep");
  });

  test("hard-caps parsed model candidates before any write loop", () => {
    assert.deepEqual(capDiscoveryCandidates(["one", "two", "three"], 2), ["one", "two"]);
    assert.deepEqual(capDiscoveryCandidates(["one"], 0), []);
  });

  test("cold calibration blocks only after the same fit profile has already had a run", () => {
    assert.equal(shouldBlockColdCalibration(["client"], "profile-b", "profile-a"), false);
    assert.equal(shouldBlockColdCalibration(["client"], "profile-b", "profile-b"), true);
    assert.equal(shouldBlockColdCalibration([], "profile-b", "profile-b"), false);
  });

  test("recognizes rate-limit failures without confusing ordinary failures", () => {
    assert.equal(classifyRateLimitFailure({ code: 429, stderr: "" }), true);
    assert.equal(classifyRateLimitFailure({ code: 1, stderr: "Claude usage limit reached" }), true);
    assert.equal(classifyRateLimitFailure({ code: 1, stderr: "invalid prompt" }), false);
  });

  test("retries rate limits with bounded exponential backoff", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const result = await withRateLimitRetry(async () => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error("rate limit"), { code: 429 });
      return "ok";
    }, { maxRetries: 2, baseDelayMs: 100, sleep: async (ms) => { delays.push(ms); } });
    assert.deepEqual(result, { value: "ok", retries: 2 });
    assert.deepEqual(delays, [100, 200]);
  });

  test("calibrates platform and client discovery from actual pursue/pass decisions", () => {
    const result = computeDiscoveryCalibration([
      { kind: "platform", status: "pursue" },
      { kind: "platform", status: "passed" },
      { kind: "platform", status: "passed" },
      { kind: "platform", status: "passed" },
      { kind: "platform", status: "passed" },
      { kind: "client", status: "pursue" },
      { kind: "client", status: "passed" },
      { kind: "client", status: "intake" },
    ]);
    assert.deepEqual(result[0], { kind: "client", decided: 2, pursued: 1, pursueRate: 0.5, assessment: "thin" });
    assert.deepEqual(result[1], { kind: "platform", decided: 5, pursued: 1, pursueRate: 0.2, assessment: "healthy" });
  });

  test("passes feedback context into the sweep and writes the complete outreach run ledger", async () => {
    const dir = mkdtempSync(join(tmpdir(), "discovery-phase5-"));
    const runLogPath = join(dir, "run-log.jsonl");
    const lensStatePath = join(dir, "lens.json");
    const times = [1_000, 1_250];
    let contextSeen = false;
    try {
      await runDiscover({
        kinds: ["platform"],
        theme: "fixed theme",
        limit: 2,
        runLogPath,
        lensStatePath,
        now: () => times.shift() ?? 1_250,
        runKind: async (_kind, _theme, _limit, context) => {
          contextSeen = Boolean(context.lens.belief && context.calibration.length === 2);
          return { kind: "platform", created: ["one"], skipped: [], searchesUsed: 4, evidenceFound: 3, rateLimitRetries: 1, midTailDowngraded: 1, midTailExcluded: 0 };
        },
      });
      assert.equal(contextSeen, true);
      const entry = JSON.parse(readFileSync(runLogPath, "utf8"));
      assert.equal(entry.durationMs, 250);
      assert.equal(entry.searchesUsed, 4);
      assert.equal(entry.evidenceFound, 3);
      assert.equal(entry.rateLimitRetries, 1);
      assert.equal(entry.midTailDowngraded, 1);
      assert.equal(entry.midTailExcluded, 0);
      assert.ok(entry.lens.belief);
      assert.equal(entry.calibration.length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("records a failed discovery run before surfacing the error", async () => {
    const dir = mkdtempSync(join(tmpdir(), "discovery-phase5-failure-"));
    const runLogPath = join(dir, "run-log.jsonl");
    try {
      await assert.rejects(
        runDiscover({
          kinds: ["platform"],
          theme: "fixed theme",
          runLogPath,
          lensStatePath: join(dir, "lens.json"),
          runKind: async () => { throw new Error("rate limit exhausted"); },
        }),
        /rate limit exhausted/,
      );
      const entry = JSON.parse(readFileSync(runLogPath, "utf8"));
      assert.equal(entry.status, "failed");
      assert.match(entry.error, /rate limit exhausted/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("bounds the whole multi-kind run to the configured five-lead batch cap", async () => {
    const dir = mkdtempSync(join(tmpdir(), "discovery-phase5-cap-"));
    const limits: number[] = [];
    try {
      const result = await runDiscover({
        kinds: ["client", "platform", "content-example"],
        theme: "fixed theme",
        limit: 5,
        runLogPath: join(dir, "run-log.jsonl"),
        lensStatePath: join(dir, "lens.json"),
        runKind: async (kind, _theme, limit) => {
          limits.push(limit);
          return { kind, created: Array.from({ length: limit }, (_, i) => `${kind}-${i}`), skipped: [] };
        },
      });
      assert.deepEqual(limits, [2, 2, 1]);
      assert.equal(result.results.reduce((sum, item) => sum + item.created.length, 0), 5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
