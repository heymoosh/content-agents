import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parsePlatformPoolMatrixRepoArgs } from "./platform-pool-matrix-repo-cli.js";
import type { PatternCatalog } from "./catalog.js";

const catalog: PatternCatalog = {
  rows: [{ key: "x|alpha", accountId: "x|alpha", accountIdStatus: "derived", platform: "x", handle: "@alpha", creator: "Alpha", niche: "civic", sourceKind: "handle", configured: true, collected: true, audience: { size: null, countType: null, provenance: null, asOf: null }, topics: [], focus: [], researchPools: ["niche"], formats: ["text"], mediaForms: ["text"], popularityScopes: [], sampleScopes: [], baselineSources: [], evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0, bodyIncompleteCount: 0, lastCollectedAt: null, lastAnalyzedAt: null, caveats: [] }],
  summary: { configuredTargets: 1, collectedSources: 1, configuredAndCollected: 1, configuredButUncollected: 0, evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0, bodyIncompleteCount: 0 },
};

test("loads explicit review facts and renders the repo matrix", () => {
  let output = "";
  assert.equal(main(["--reviews", "reviews.json", "--format", "markdown"], {
    loadCatalog: () => catalog,
    readBaselines: () => [],
    readFile: () => JSON.stringify([{
      currentAccountKey: "x|alpha",
      reviewStatus: "pending",
      reviewedPoolMembership: [{ pool: "niche", reason: "pending fixture" }],
      medium: "text",
      format: "short post",
    }]),
  }, { write: (value) => { output = value; } }), 0);
  assert.match(output, /Unassigned or blocked pool targets/);
  assert.match(output, /pending/);
});

test("parses repo paths and reports malformed review input", () => {
  assert.deepEqual(parsePlatformPoolMatrixRepoArgs(["--config", "config.yaml", "--baselines", "b.jsonl"]), { configPath: "config.yaml", corpusPath: undefined, analysesPath: undefined, reviewsPath: undefined, baselinesPath: "b.jsonl", format: "json" });
  let error = "";
  assert.equal(main(["--reviews", "reviews.json"], { loadCatalog: () => catalog, readBaselines: () => [], readFile: () => "{}" }, { error: (value) => { error = value; } }), 1);
  assert.match(error, /patterns:platform-pool-matrix-repo/);
});
