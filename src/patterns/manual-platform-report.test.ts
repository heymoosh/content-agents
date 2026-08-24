import { test } from "node:test";
import assert from "node:assert/strict";
import { buildManualPlatformIntake } from "./manual-platform-intake.js";
import { buildManualPlatformReport, renderManualPlatformReportJson, renderManualPlatformReportMarkdown } from "./manual-platform-report.js";
import type { ManualPlatformIntake } from "./manual-platform-intake.js";

function observation(overrides: Partial<ManualPlatformIntake> = {}): ManualPlatformIntake {
  return {
    kind: "manual_platform_observation",
    version: "manual-platform-intake-v1",
    accountId: "account",
    sourceId: null,
    postId: "post",
    evidenceId: null,
    platform: "x",
    handle: "maker",
    creator: "Maker",
    topics: ["topic"],
    focus: ["focus"],
    audienceSnapshot: null,
    medium: "text",
    format: "short-post",
    media: null,
    url: null,
    stableUrl: null,
    evidenceRefs: null,
    pool: "niche",
    scope: "niche",
    membershipReason: null,
    metricSnapshot: null,
    evidenceLinks: null,
    popularityScope: "selected posts",
    sampleScope: "manual sample",
    baselineScope: "timeline",
    baselineSource: "operator notes",
    observedAt: null,
    collectedAt: null,
    caveats: null,
    provenance: "manual-operator",
    collectionMethod: "manual",
    collectionStatus: "observed",
    collectionCaveats: null,
    collection: { method: "manual", status: "observed", caveats: null },
    status: "observed",
    bodyIncluded: false,
    bodyComplete: false,
    lineage: null,
    evidence: {} as ManualPlatformIntake["evidence"],
    readiness: { status: "ready", blockers: [] },
    sideEffects: "none",
    ...overrides,
  };
}

test("aggregates missing facts, statuses, and explicit role/pool without ranking", () => {
  const first = buildManualPlatformReport([
    observation({ platform: "z", collectionStatus: "partial", pool: "format", role: "editor" }),
    observation({ platform: null, collectionStatus: null, topics: null, focus: "unknown", scope: null, popularityScope: null, sampleScope: "unknown", baselineSource: null, role: "analyst", pool: null }),
  ]);
  const second = buildManualPlatformReport([
    observation({ platform: null, collectionStatus: null, topics: null, focus: "unknown", scope: null, popularityScope: null, sampleScope: "unknown", baselineSource: null, role: "analyst", pool: null }),
    observation({ platform: "z", collectionStatus: "partial", pool: "format", role: "editor" }),
  ]);

  assert.deepEqual(first, second);
  assert.deepEqual(first.collectionStatuses, [{ status: "missing", count: 1 }, { status: "partial", count: 1 }]);
  assert.deepEqual(first.missing, { scope: 1, topic: 1, focus: 1, popularity: 1, sample: 1, baseline: 1 });
  assert.deepEqual(first.roles, [{ value: "analyst", count: 1 }, { value: "editor", count: 1 }]);
  assert.deepEqual(first.pools, [{ value: "format", count: 1 }]);
  assert.equal(first.body.included, 0);
  assert.equal(first.body.complete, 0);
  assert.match(first.note, /descriptive coverage only/i);
  assert.equal(JSON.stringify(first).includes("Maker"), false);
  assert.equal(JSON.stringify(first).includes("PRIVATE"), false);
});

test("preserves an explicitly supplied role through intake without inferring one", () => {
  const normalized = buildManualPlatformIntake({ role: "editor", platform: "x" });
  assert.equal(normalized.role, "editor");
  assert.deepEqual(buildManualPlatformReport([normalized]).roles, [{ value: "editor", count: 1 }]);
});

test("renders deterministic JSON and markdown for an empty report", () => {
  const report = buildManualPlatformReport([]);
  assert.equal(renderManualPlatformReportJson(report), `${JSON.stringify(report, null, 2)}\n`);
  assert.match(renderManualPlatformReportMarkdown(report), /\| Platform \| Observations \| Collection statuses \|/);
  assert.match(renderManualPlatformReportMarkdown(report), /Observations: 0/);
});
