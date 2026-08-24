import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAccountMapping, main, renderAccountMappingMarkdown } from "./account-mapping.js";
import type { PatternCatalog } from "./catalog.js";
import type { PatternMiningConfig } from "./types.js";

function catalog(rows: Partial<PatternCatalog["rows"][number]>[]): PatternCatalog {
  return {
    rows: rows.map((row) => ({
      key: "x|placeholder",
      accountId: "x|placeholder",
      accountIdStatus: "derived" as const,
      platform: "x",
      handle: "@placeholder",
      creator: "Placeholder",
      sourceKind: "handle" as const,
      niche: null,
      configured: true,
      collected: true,
      audience: { size: null, countType: null, provenance: null, asOf: null },
      topics: [], focus: [], researchPools: [], formats: [], mediaForms: [],
      popularityScopes: [], sampleScopes: [], baselineSources: [],
      evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0, bodyIncompleteCount: 0,
      lastCollectedAt: null, lastAnalyzedAt: null, caveats: [],
      ...row,
    })),
    summary: {
      configuredTargets: 0, collectedSources: 0, configuredAndCollected: 0,
      configuredButUncollected: 0, evidenceCount: 0, admissibleCount: 0,
      bodyCompleteCount: 0, bodyIncompleteCount: 0,
    },
  };
}

test("projects derived rows as needs-review and sorts by current account key", () => {
  const mapping = buildAccountMapping(catalog([
    { key: "x|zeta", accountId: "x|zeta", platform: "x", handle: "@Zeta", creator: "Zeta", evidenceCount: 2 },
    { key: "linkedin|alpha", accountId: "linkedin|alpha", platform: "linkedin", handle: "@Alpha", creator: "Alpha", evidenceCount: 1 },
  ]));

  assert.deepEqual(mapping.rows.map((row) => row.currentAccountKey), ["linkedin|alpha", "x|zeta"]);
  assert.deepEqual(mapping.rows.map((row) => row.derivedAccountId), ["linkedin|alpha", "x|zeta"]);
  assert.deepEqual(mapping.rows.map((row) => row.mappingDisposition), ["needs-review", "needs-review"]);
  assert.equal(mapping.rows[0].evidenceCount, 1);
  assert.match(mapping.rows[0].humanReviewNote, /derived.*not yet opaque.*reviewed/i);
  assert.deepEqual(mapping.summary, { total: 2, needsReview: 2, unmapped: 0, evidenceCount: 3 });
});

test("renders review fields in a deterministic markdown table", () => {
  const markdown = renderAccountMappingMarkdown(buildAccountMapping(catalog([
    { key: "x|alpha", accountId: "x|alpha", platform: "x", handle: "@alpha", creator: "Alpha", evidenceCount: 3 },
  ])));

  assert.match(markdown, /Current account key/);
  assert.match(markdown, /Derived account ID/);
  assert.match(markdown, /needs-review/);
  assert.match(markdown, /x\\\|alpha/);
  assert.match(markdown, /Evidence count/);
  assert.match(markdown, /derived ID is not yet opaque\/reviewed/i);
  assert.match(markdown, /Total rows: 1 \| Needs review: 1 \| Unmapped: 0 \| Evidence: 3/);
});

const cliConfig: PatternMiningConfig = {
  niches: [], accounts: [], outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 1 },
};

test("CLI emits JSON by default and Markdown when requested", () => {
  const originalWrite = process.stdout.write;
  const output: string[] = [];
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    const inputs = { config: cliConfig, corpus: [], analyses: [] };
    assert.equal(main([], () => inputs), 0);
    const json = JSON.parse(output.pop() ?? "");
    assert.deepEqual(json.summary, { total: 0, needsReview: 0, unmapped: 0, evidenceCount: 0 });

    assert.equal(main(["--format", "markdown"], () => inputs), 0);
    assert.match(output.pop() ?? "", /# Account identity mapping review/);
  } finally {
    process.stdout.write = originalWrite;
  }
});
