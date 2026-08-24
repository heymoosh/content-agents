import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPoolEvidenceInventory, renderPoolEvidenceJson, renderPoolEvidenceMarkdown } from "./pool-evidence.js";
import type { CatalogRow, PatternCatalog } from "./catalog.js";

type CatalogRowWithReasons = CatalogRow & {
  poolMembershipReasons?: Partial<Record<"niche" | "broad" | "format", string | null>>;
};

function row(overrides: Partial<CatalogRowWithReasons> = {}): CatalogRowWithReasons {
  return {
    key: "x|alpha",
    accountId: "x|alpha",
    accountIdStatus: "derived",
    platform: "x",
    handle: "@alpha",
    creator: "Alpha Creator",
    niche: "civic-democracy",
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: 1200, countType: "followers", provenance: "profile", asOf: "2026-08-20" },
    topics: ["labor"],
    focus: ["systems"],
    researchPools: ["niche"],
    formats: ["text"],
    mediaForms: ["text-only"],
    popularityScopes: ["niche"],
    sampleScopes: ["recent"],
    baselineSources: ["account-baseline"],
    evidenceCount: 3,
    admissibleCount: 2,
    bodyCompleteCount: 2,
    bodyIncompleteCount: 1,
    lastCollectedAt: "2026-08-20T00:00:00.000Z",
    lastAnalyzedAt: "2026-08-21",
    caveats: ["small sample"],
    ...overrides,
  };
}

function catalog(rows: CatalogRowWithReasons[]): PatternCatalog {
  return {
    rows,
    summary: {
      configuredTargets: rows.filter((item) => item.configured).length,
      collectedSources: rows.filter((item) => item.collected).length,
      configuredAndCollected: rows.filter((item) => item.configured && item.collected).length,
      configuredButUncollected: rows.filter((item) => item.configured && !item.collected).length,
      evidenceCount: rows.reduce((sum, item) => sum + item.evidenceCount, 0),
      admissibleCount: rows.reduce((sum, item) => sum + item.admissibleCount, 0),
      bodyCompleteCount: rows.reduce((sum, item) => sum + item.bodyCompleteCount, 0),
      bodyIncompleteCount: rows.reduce((sum, item) => sum + item.bodyIncompleteCount, 0),
    },
  };
}

test("emits one row for every explicitly declared pool and keeps the account facts intact", () => {
  const source = row({
    researchPools: ["format", "niche", "not-a-pool"],
    poolMembershipReasons: { format: "Short-video mechanics", niche: "Relevant civic audience" },
  });
  const inventory = buildPoolEvidenceInventory(catalog([source]));

  assert.deepEqual(inventory.rows.map((item) => item.pool), ["format", "niche"]);
  assert.deepEqual(inventory.rows[0], {
    accountId: "x|alpha",
    platform: "x",
    handle: "@alpha",
    creator: "Alpha Creator",
    niche: "civic-democracy",
    topics: ["labor"],
    focus: ["systems"],
    formats: ["text"],
    audience: { size: 1200, countType: "followers", provenance: "profile", asOf: "2026-08-20" },
    pool: "format",
    membershipReason: "Short-video mechanics",
    popularityScopes: ["niche"],
    sampleScopes: ["recent"],
    baselineSources: ["account-baseline"],
    evidenceCount: 3,
    admissibleCount: 2,
    bodyCompleteCount: 2,
    bodyIncompleteCount: 1,
    caveats: ["small sample"],
    readiness: { status: "ready", reason: "Explicit pool membership is available for inspection." },
    comparisonReadiness: {
      status: "blocked",
      reason: "Blocked: account inventory is a rollup; linked source/post evidence is required for comparison.",
    },
  });
  assert.equal(inventory.rows[1]?.membershipReason, "Relevant civic audience");
  assert.deepEqual(inventory.summary, {
    poolCounts: { niche: 1, broad: 0, format: 1 },
    blockedAccounts: [],
  });
  assert.deepEqual(source.researchPools, ["format", "niche", "not-a-pool"]);
});

test("creates a blocked null-pool row without inferring from niche or creator name", () => {
  const inventory = buildPoolEvidenceInventory(catalog([row({
    accountId: "x|niche-famous",
    key: "x|niche-famous",
    handle: null,
    creator: "Broad Niche Famous",
    niche: "labor",
    researchPools: [],
    audience: { size: null, countType: null, provenance: null, asOf: null },
    topics: [],
    focus: [],
    formats: [],
    popularityScopes: [],
    sampleScopes: [],
    baselineSources: [],
    evidenceCount: 0,
    admissibleCount: 0,
    bodyCompleteCount: 0,
    bodyIncompleteCount: 0,
    caveats: [],
  })]));

  assert.equal(inventory.rows.length, 1);
  assert.equal(inventory.rows[0]?.pool, null);
  assert.equal(inventory.rows[0]?.membershipReason, null);
  assert.equal(inventory.rows[0]?.niche, "labor");
  assert.equal(inventory.rows[0]?.creator, "Broad Niche Famous");
  assert.deepEqual(inventory.rows[0]?.readiness, {
    status: "blocked",
    reason: "Blocked: no explicit pool membership; classification was not inferred from niche or name.",
  });
  assert.deepEqual(inventory.summary, {
    poolCounts: { niche: 0, broad: 0, format: 0 },
    blockedAccounts: ["x|niche-famous"],
  });
});

test("sorts accounts and pools deterministically regardless of input order", () => {
  const first = buildPoolEvidenceInventory(catalog([
    row({ key: "x|zeta", accountId: "x|zeta", researchPools: ["niche"] }),
    row({ key: "x|alpha", accountId: "x|alpha", researchPools: ["niche", "broad"] }),
  ]));
  const second = buildPoolEvidenceInventory(catalog([
    row({ key: "x|alpha", accountId: "x|alpha", researchPools: ["broad", "niche"] }),
    row({ key: "x|zeta", accountId: "x|zeta", researchPools: ["niche"] }),
  ]));

  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((item) => `${item.accountId}/${item.pool}`), [
    "x|alpha/broad",
    "x|alpha/niche",
    "x|zeta/niche",
  ]);
  assert.equal(renderPoolEvidenceJson(first), renderPoolEvidenceJson(second));
});

test("renders an inspectable markdown table with nulls, summary counts, and escaped cells", () => {
  const markdown = renderPoolEvidenceMarkdown(buildPoolEvidenceInventory(catalog([
    row({
      accountId: "x|alpha|pipe",
      key: "x|alpha|pipe",
      handle: "@alpha|pipe",
      niche: null,
      researchPools: [],
      audience: { size: null, countType: null, provenance: null, asOf: null },
      topics: [], focus: [], formats: [], popularityScopes: [], sampleScopes: [], baselineSources: [],
      evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0, bodyIncompleteCount: 0, caveats: [],
    }),
  ])));

  assert.match(markdown, /# Pool evidence inventory/);
  assert.match(markdown, /Pool counts: niche 0 \| broad 0 \| format 0 \| blocked 1/);
  assert.match(markdown, /\| Account ID \| Platform \| Handle \| Creator \| Niche \| Topics \| Focus \| Formats \| Audience \| Pool \| Membership reason \| Popularity scopes \| Sample scopes \| Baseline sources \| Evidence\/admissible\/body-complete\/body-incomplete \| Caveats \| Readiness \| Comparison readiness \|/);
  assert.match(markdown, /x\\\|alpha\\\|pipe/);
  assert.match(markdown, /null \| null \| null \| null \| null \| null \| null \| null \| 0 \/ 0 \/ 0 \/ 0 \| null \| blocked:/);
});
