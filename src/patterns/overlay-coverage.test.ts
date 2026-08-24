import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOverlayCoverage, type OverlayCoverageInput } from "./overlay-coverage.js";
import type { CatalogRow } from "./catalog.js";
import type { ComparisonReadinessInventory } from "./comparison-readiness.js";
import type { ReviewMetadataInput } from "./review-metadata.js";

const catalogRow = (key: string): CatalogRow => ({
  key, accountId: `derived:${key}`, accountIdStatus: "derived", platform: "fixture", handle: key,
  creator: "catalog-only", niche: "catalog-only", sourceKind: "handle", configured: true, collected: false,
  audience: { size: null, countType: null, provenance: null, asOf: null }, topics: [], focus: [],
  researchPools: [], formats: [], mediaForms: [], popularityScopes: [], sampleScopes: [], baselineSources: [],
  evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0, bodyIncompleteCount: 0,
  lastCollectedAt: null, lastAnalyzedAt: null, caveats: [],
});

const review = (currentAccountKey: string, overrides: Partial<ReviewMetadataInput> = {}): ReviewMetadataInput => ({
  currentAccountKey, platform: "fixture", handle: currentAccountKey, stableAccountId: `stable:${currentAccountKey}`,
  stableAccountIdStatus: "confirmed", topics: ["explicit topic"], focus: ["explicit focus"], nicheLabel: "explicit niche",
  researchPoolMembership: [{ pool: "niche", reason: "explicit review reason" }], popularityScope: "explicit popularity",
  sampleScope: "explicit sample", baselineScope: "explicit baseline scope", baselineSource: "explicit baseline",
  medium: "text", format: "short post", audienceSnapshot: { size: 10, countType: "followers", provenance: "explicit", asOf: "2026-08-20", collectedAt: "2026-08-21" },
  evidenceLinks: ["evidence:1"], reviewer: "reviewer", reviewNote: "reviewed", disposition: "reviewed",
  reviewed_at: "2026-08-23T00:00:00Z", caveats: [], ...overrides,
});

const comparison = (rows: ComparisonReadinessInventory["rows"]): ComparisonReadinessInventory => ({
  kind: "comparison_readiness_inventory", version: "comparison-readiness-v1", rows,
  summary: { ready: rows.filter((row) => row.readiness.status === "ready").length, blocked: rows.filter((row) => row.readiness.status === "blocked").length, duplicateEvidence: 0 },
  sideEffects: "none",
});

const evidenceRow = (accountId: string, status: "ready" | "blocked" = "ready"): ComparisonReadinessInventory["rows"][number] => ({
  kind: "comparison_readiness_row", version: "comparison-readiness-v1", id: `evidence:${accountId}`, evidenceId: `evidence:${accountId}`,
  accountId, sourceId: "source", postId: "post", platform: "fixture", medium: "text", format: "short post", pool: "niche",
  topics: null, focus: null, nicheLabel: null, popularityScope: null, sampleScope: null, baselineScope: null, baselineSource: null,
  evidenceLinks: [], caveats: [], readiness: { status, blockers: status === "ready" ? [] : ["incomplete"] }, bodyIncluded: false,
});

test("reports a complete reviewed mapping and linked evidence readiness", () => {
  const result = buildOverlayCoverage({ catalog: [catalogRow("fixture|alpha")], reviews: [review("fixture|alpha")], comparison: comparison([evidenceRow("stable:fixture|alpha")]) });
  assert.deepEqual(result.rows[0], {
    currentAccountKey: "fixture|alpha", status: "reviewed", stableId: "stable:fixture|alpha", stableIdPresent: true,
    missingRequiredOverlayFields: [], comparisonEvidenceReady: true,
  });
  assert.equal(result.sideEffects, "none");
  assert.equal(JSON.stringify(result).includes("bodyIncluded"), false);
});

test("reports missing current mappings and metadata rows that cannot be mapped", () => {
  const result = buildOverlayCoverage({ catalog: [catalogRow("fixture|alpha"), catalogRow("fixture|zeta")], reviews: [review("fixture|orphan")] });
  assert.deepEqual(result.rows.map((row) => [row.currentAccountKey, row.status]), [["fixture|alpha", "unmapped"], ["fixture|zeta", "unmapped"]]);
  assert.deepEqual(result.missingMappings, ["fixture|alpha", "fixture|zeta"]);
  assert.deepEqual(result.unmappedMetadataRows, ["fixture|orphan"]);
});

test("reports duplicate mappings and blocks reviewed rows with missing required fields", () => {
  const result = buildOverlayCoverage({
    catalog: [catalogRow("fixture|alpha")],
    reviews: [review("fixture|alpha"), review("fixture|alpha", { stableAccountId: null, topics: null })],
    comparison: comparison([evidenceRow("stable:fixture|alpha", "blocked")]),
  });
  assert.deepEqual(result.duplicateMappings, ["fixture|alpha"]);
  assert.equal(result.rows[0]?.status, "blocked");
  assert.deepEqual(result.rows[0]?.missingRequiredOverlayFields, ["stableAccountId", "topics"]);
  assert.equal(result.rows[0]?.comparisonEvidenceReady, false);
});

test("sorts rows and diagnostics deterministically regardless of input order", () => {
  const catalog = [catalogRow("fixture|zeta"), catalogRow("fixture|alpha")];
  const reviews = [review("fixture|zeta"), review("fixture|alpha")];
  const input: OverlayCoverageInput = { catalog, reviews };
  const reversed = buildOverlayCoverage(input);
  const ordered = buildOverlayCoverage({ ...input, catalog: [...catalog].reverse(), reviews: [...reviews].reverse() });
  assert.deepEqual(reversed, ordered);
  assert.deepEqual(reversed.rows.map((row) => row.currentAccountKey), ["fixture|alpha", "fixture|zeta"]);
});

test("keeps an explicit unmapped disposition distinct from missing metadata", () => {
  const result = buildOverlayCoverage({
    catalog: [catalogRow("fixture|alpha")],
    reviews: [review("fixture|alpha", { disposition: "unmapped", stableAccountId: null, topics: null })],
    comparison: comparison([evidenceRow("derived:fixture|alpha")]),
  });
  assert.equal(result.rows[0]?.status, "unmapped");
  assert.equal(result.rows[0]?.comparisonEvidenceReady, false);
  assert.ok(result.rows[0]?.missingRequiredOverlayFields.includes("stableAccountId"));
});
