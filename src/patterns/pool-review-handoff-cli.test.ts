import { test } from "node:test";
import assert from "node:assert/strict";
import type { PatternCatalog } from "./catalog.js";
import {
  buildPoolReviewHandoffFromPaths,
  main,
  parsePoolReviewHandoffArgs,
  renderPoolReviewHandoffJsonWithCliVersion,
  PoolReviewHandoffCliValidationError,
} from "./pool-review-handoff-cli.js";

const catalog: PatternCatalog = {
  rows: [{
    key: "fixture|alpha",
    accountId: "fixture|alpha",
    accountIdStatus: "derived",
    platform: "fixture",
    handle: "@alpha",
    creator: "Alpha",
    niche: "civic technology",
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: 1000, countType: "followers", provenance: "fixture", asOf: "2026-08-23" },
    topics: ["public services"],
    focus: ["inference"],
    researchPools: [],
    formats: ["video"],
    mediaForms: ["video"],
    popularityScopes: [],
    sampleScopes: [],
    baselineSources: [],
    evidenceCount: 1,
    admissibleCount: 1,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
    lastCollectedAt: "2026-08-23",
    lastAnalyzedAt: null,
    caveats: [],
  }],
  summary: {
    configuredTargets: 1,
    collectedSources: 1,
    configuredAndCollected: 1,
    configuredButUncollected: 0,
    evidenceCount: 1,
    admissibleCount: 1,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
  },
};

test("parses repo paths and formats", () => {
  assert.deepEqual(parsePoolReviewHandoffArgs(["--reviews", "reviews.json", "--format", "both"]), {
    configPath: undefined,
    corpusPath: undefined,
    analysesPath: undefined,
    reviewsPath: "reviews.json",
    format: "both",
  });
});

test("rejects malformed reviews input before building", () => {
  assert.throws(
    () => buildPoolReviewHandoffFromPaths(
      parsePoolReviewHandoffArgs(["--reviews", "reviews.json"]),
      { loadCatalog: () => catalog, readFile: () => "{bad" },
    ),
    (error: unknown) => error instanceof PoolReviewHandoffCliValidationError && /valid JSON/i.test(error.message),
  );
});

test("main is read-only and exposes a body-free unmapped report when reviews are absent", () => {
  const output: string[] = [];
  const status = main([], { loadCatalog: () => catalog, readFile: () => "[]" }, { write: (value) => output.push(value) });
  assert.equal(status, 0);
  const report = JSON.parse(output.join("")) as Record<string, unknown>;
  assert.equal(report.kind, "pool_review_handoff");
  assert.equal(report.cliVersion, "pool-review-handoff-cli-v1");
  assert.equal((report as { bodyIncluded: boolean }).bodyIncluded, false);
  assert.match(output.join(""), /"status": "unmapped"/);
  assert.doesNotMatch(output.join(""), /"body"\s*:/i);
  assert.equal(renderPoolReviewHandoffJsonWithCliVersion(JSON.parse(output.join(""))).includes("cliVersion"), true);
});
