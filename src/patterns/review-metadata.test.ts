import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeReviewedMetadata,
  normalizeReviewMetadata,
  validateReviewMetadata,
  validateReviewMetadataRows,
  type ReviewMetadataRecord,
} from "./review-metadata.js";
import type { CatalogRow } from "./catalog.js";

function review(overrides: Partial<ReviewMetadataRecord> = {}): ReviewMetadataRecord {
  return {
    currentAccountKey: "fixture|alpha",
    platform: "fixture-platform",
    handle: "@fixture-alpha",
    stableAccountId: "stable:fixture:alpha",
    stableAccountIdStatus: "confirmed",
    topics: ["systems", "labor"],
    focus: ["research"],
    nicheLabel: "fixture-niche",
    researchPoolMembership: [
      { pool: "format", reason: "Fixture account was selected for format mechanics." },
      { pool: "niche", reason: "Fixture account was selected for the fixture topic." },
    ],
    popularityScope: "fixture-sample",
    sampleScope: "fixture-selection",
    baselineScope: "fixture-baseline-window",
    baselineSource: "fixture-baseline",
    medium: "text",
    format: "text",
    audienceSnapshot: {
      size: 1200,
      countType: "followers",
      provenance: "fixture profile snapshot",
      asOf: "2026-08-20",
      collectedAt: "2026-08-21",
    },
    evidenceLinks: ["fixture://evidence/alpha"],
    reviewer: "fixture-reviewer",
    reviewNote: "Fixture reviewed for contract coverage.",
    disposition: "reviewed",
    reviewed_at: "2026-08-23T10:00:00.000Z",
    caveats: ["fixture only"],
    ...overrides,
  };
}

function catalogRow(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    key: "fixture|alpha",
    accountId: "fixture|alpha",
    accountIdStatus: "derived",
    platform: "fixture-platform",
    handle: "@fixture-alpha",
    creator: "Fixture Creator",
    niche: "derived-niche-must-not-be-reviewed",
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: 999, countType: "followers", provenance: "catalog", asOf: "2026-08-01" },
    topics: ["derived-topic"],
    focus: ["derived-focus"],
    researchPools: ["niche"],
    formats: ["text"],
    mediaForms: ["text-only"],
    popularityScopes: ["derived-scope"],
    sampleScopes: ["derived-sample"],
    baselineSources: ["derived-baseline"],
    evidenceCount: 2,
    admissibleCount: 1,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
    lastCollectedAt: "2026-08-01",
    lastAnalyzedAt: "2026-08-02",
    caveats: ["derived caveat"],
    ...overrides,
  };
}

test("normalizes a valid multi-pool row and sorts all order-insensitive values", () => {
  const result = validateReviewMetadata(review({
    topics: ["systems", "labor", "systems"],
    researchPoolMembership: [
      { pool: "niche", reason: "Fixture account was selected for the fixture topic." },
      { pool: "format", reason: "Fixture account was selected for format mechanics." },
    ],
    evidenceLinks: ["fixture://evidence/z", "fixture://evidence/a"],
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.blockingFields, []);
  assert.deepEqual(result.normalized?.topics, ["labor", "systems"]);
  const memberships = result.normalized?.researchPoolMembership;
  assert.deepEqual(Array.isArray(memberships) ? memberships.map((membership) => membership.pool) : [], ["format", "niche"]);
  assert.deepEqual(result.normalized?.evidenceLinks, ["fixture://evidence/a", "fixture://evidence/z"]);
  assert.equal(result.normalized?.reviewed_at, "2026-08-23T10:00:00.000Z");
});

test("keeps explicit nulls and reports them as deterministic readiness blockers", () => {
  const result = validateReviewMetadata(review({
    topics: null,
    focus: "unknown",
    nicheLabel: null,
    researchPoolMembership: [],
    popularityScope: null,
    sampleScope: "unknown",
    baselineSource: null,
    format: null,
    audienceSnapshot: { size: null, countType: null, provenance: null, asOf: null },
    evidenceLinks: null,
    reviewer: null,
    reviewed_at: null,
  }));

  assert.equal(result.errors.length, 0);
  assert.equal(result.ok, false);
  assert.deepEqual(result.blockingFields, [
    "topics", "focus", "nicheLabel", "researchPoolMembership", "popularityScope", "sampleScope",
    "baselineSource", "format", "audienceSnapshot.size", "audienceSnapshot.countType",
    "audienceSnapshot.provenance", "audienceSnapshot.asOf", "audienceSnapshot.collectedAt", "evidenceLinks", "reviewer", "reviewed_at",
  ]);
  assert.equal(result.normalized?.topics, null);
  assert.equal(result.normalized?.focus, "unknown");

  const merged = mergeReviewedMetadata(catalogRow(), result.normalized);
  assert.equal(merged.reviewStatus, "reviewed");
  assert.equal(merged.readiness.status, "blocked");
  assert.deepEqual(merged.readiness.blockingFields, result.blockingFields);
});

test("rejects unsupported pools instead of dropping or inferring membership", () => {
  const result = validateReviewMetadata(review({
    researchPoolMembership: [{ pool: "viral" as never, reason: "Fixture must be rejected." }],
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /researchPoolMembership.*viral.*niche.*broad.*format/i);
  assert.throws(() => normalizeReviewMetadata({
    ...review(),
    researchPoolMembership: [{ pool: "viral", reason: "Fixture must be rejected." }],
  }), /unsupported pool/i);
});

test("rejects duplicate current account keys without silently choosing a row", () => {
  const result = validateReviewMetadataRows([
    review({ currentAccountKey: "fixture|zeta" }),
    review({ currentAccountKey: "fixture|alpha" }),
    review({ currentAccountKey: "fixture|zeta" }),
  ]);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duplicate currentAccountKey "fixture\|zeta"/);
  assert.deepEqual(result.rows.map((row) => row.currentAccountKey), ["fixture|alpha", "fixture|zeta", "fixture|zeta"]);
});

test("sorts normalized review rows deterministically and leaves unreviewed catalog rows blocked", () => {
  const first = validateReviewMetadataRows([
    review({ currentAccountKey: "fixture|zeta", topics: ["z", "a"] }),
    review({ currentAccountKey: "fixture|alpha", topics: ["b", "a"] }),
  ]);
  const second = validateReviewMetadataRows([
    review({ currentAccountKey: "fixture|alpha", topics: ["a", "b"] }),
    review({ currentAccountKey: "fixture|zeta", topics: ["a", "z"] }),
  ]);

  assert.equal(first.ok, true);
  assert.deepEqual(first.rows, second.rows);
  assert.deepEqual(first.rows.map((row) => row.currentAccountKey), ["fixture|alpha", "fixture|zeta"]);

  const unreviewed = mergeReviewedMetadata(catalogRow(), null);
  assert.equal(unreviewed.reviewStatus, "unreviewed");
  assert.equal(unreviewed.readiness.status, "blocked");
  assert.match(unreviewed.readiness.reason, /unreviewed/i);
  assert.equal(unreviewed.accountId, null);
  assert.equal(unreviewed.nicheLabel, null);
  assert.equal(unreviewed.researchPoolMembership, null);
  assert.deepEqual(unreviewed.catalogRow, catalogRow());
});

test("blocks a non-reviewed disposition even when the fields are otherwise complete", () => {
  const merged = mergeReviewedMetadata(catalogRow(), review({ disposition: "pending" }));
  assert.equal(merged.reviewStatus, "pending");
  assert.equal(merged.readiness.status, "blocked");
  assert.deepEqual(merged.readiness.blockingFields, ["reviewStatus"]);
  assert.match(merged.readiness.reason, /disposition is pending/i);
});
