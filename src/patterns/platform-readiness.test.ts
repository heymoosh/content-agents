import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlatformReadiness } from "./platform-readiness.js";

type CatalogRow = {
  accountId: string;
  platform: string | "unknown" | null;
  configured: boolean;
  collected: boolean;
  formats: string[];
};

type EvidenceRow = {
  id: string | "unknown" | null;
  platform: string | "unknown" | null;
  format: string | "unknown" | null;
  baselineScope: string | "unknown" | null;
  baselineSource: string | "unknown" | null;
};

type ComparisonRow = {
  id: string;
  evidenceId: string | null;
  platform: string | "unknown" | null;
  format: string | "unknown" | null;
  readiness: { status: "ready" | "blocked"; blockers: string[] };
};

function catalog(rows: CatalogRow[]) {
  return { rows };
}

function evidence(rows: EvidenceRow[]) {
  return { rows };
}

function comparisons(rows: ComparisonRow[]) {
  return { rows };
}

const operatorReadiness = { gaps: ["account metadata is unreviewed"] };

test("orders platform/format rows and blockers deterministically", () => {
  const first = buildPlatformReadiness({
    catalog: catalog([
      { accountId: "x|alpha", platform: "x", configured: true, collected: true, formats: ["text", "image"] },
      { accountId: "linkedin|beta", platform: "linkedin", configured: true, collected: true, formats: ["document"] },
    ]),
    sourceEvidence: evidence([
      { id: "e-x-text", platform: "x", format: "text", baselineScope: "timeline", baselineSource: "baseline-x" },
      { id: "e-linkedin-document", platform: "linkedin", format: "document", baselineScope: null, baselineSource: null },
    ]),
    comparisonReadiness: comparisons([
      { id: "e-linkedin-document", evidenceId: "e-linkedin-document", platform: "linkedin", format: "document", readiness: { status: "blocked", blockers: ["baseline is missing"] } },
      { id: "e-x-text", evidenceId: "e-x-text", platform: "x", format: "text", readiness: { status: "ready", blockers: [] } },
    ]),
    operatorReadiness,
  });

  const second = buildPlatformReadiness({
    catalog: catalog([
      { accountId: "linkedin|beta", platform: "linkedin", configured: true, collected: true, formats: ["document"] },
      { accountId: "x|alpha", platform: "x", configured: true, collected: true, formats: ["image", "text"] },
    ]),
    sourceEvidence: evidence([
      { id: "e-linkedin-document", platform: "linkedin", format: "document", baselineScope: null, baselineSource: null },
      { id: "e-x-text", platform: "x", format: "text", baselineScope: "timeline", baselineSource: "baseline-x" },
    ]),
    comparisonReadiness: comparisons([
      { id: "e-x-text", evidenceId: "e-x-text", platform: "x", format: "text", readiness: { status: "ready", blockers: [] } },
      { id: "e-linkedin-document", evidenceId: "e-linkedin-document", platform: "linkedin", format: "document", readiness: { status: "blocked", blockers: ["baseline is missing"] } },
    ]),
    operatorReadiness: { gaps: ["account metadata is unreviewed"] },
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => `${row.platform}/${row.format}`), [
    "linkedin/document",
    "x/image",
    "x/text",
  ]);
  assert.ok(first.summary.blockers.includes("account metadata is unreviewed"));
  assert.ok(first.summary.blockers.includes("baseline is missing"));
});

test("keeps a configured but uncollected platform visible without inventing a format", () => {
  const result = buildPlatformReadiness({
    catalog: catalog([
      { accountId: "x|collected", platform: "x", configured: true, collected: true, formats: ["text"] },
      { accountId: "pinterest|empty", platform: "pinterest", configured: true, collected: false, formats: [] },
    ]),
    sourceEvidence: evidence([
      { id: "e-x-text", platform: "x", format: "text", baselineScope: "timeline", baselineSource: "baseline-x" },
    ]),
    comparisonReadiness: comparisons([
      { id: "e-x-text", evidenceId: "e-x-text", platform: "x", format: "text", readiness: { status: "ready", blockers: [] } },
    ]),
    operatorReadiness: { gaps: [] },
  });

  const pinterest = result.rows.find((row) => row.platform === "pinterest");
  assert.ok(pinterest);
  assert.equal(pinterest.format, null);
  assert.equal(pinterest.configuredTargets, 1);
  assert.equal(pinterest.formatTargets, "unknown");
  assert.equal(pinterest.collectedEvidence, 0);
  assert.equal(pinterest.reviewedEvidence, 0);
  assert.deepEqual(pinterest.baselines, { present: 0, unknown: 0, missing: 0 });
  assert.equal(pinterest.reusable.status, "blocked");
  assert.ok(pinterest.blockers.includes("no collected evidence"));
  assert.ok(!pinterest.blockers.includes("format is text"));
});

test("keeps unknowns and blocks reuse without reviewed evidence or a known baseline", () => {
  const result = buildPlatformReadiness({
    catalog: catalog([
      { accountId: "x|alpha", platform: "x", configured: true, collected: true, formats: ["unknown"] },
    ]),
    sourceEvidence: evidence([
      { id: "e-unknown", platform: "x", format: "unknown", baselineScope: "unknown", baselineSource: "unknown" },
    ]),
    comparisonReadiness: comparisons([
      { id: "e-unknown", evidenceId: "e-unknown", platform: "x", format: "unknown", readiness: { status: "blocked", blockers: ["account metadata is unreviewed"] } },
    ]),
    operatorReadiness: { gaps: ["account metadata is unreviewed"] },
  });

  const row = result.rows[0];
  assert.equal(row.format, "unknown");
  assert.deepEqual(row.baselines, { present: 0, unknown: 1, missing: 0 });
  assert.equal(row.reviewedEvidence, 0);
  assert.equal(row.reusable.status, "blocked");
  assert.ok(row.blockers.includes("reviewed evidence is missing"));
  assert.ok(row.blockers.includes("baseline is unknown"));
  assert.equal(result.summary.reusableRows, 0);
  assert.equal(result.sideEffects, "none");
  assert.equal(JSON.stringify(result).includes("Creator body"), false);
});

test("keeps row readiness separate from global operator blockers", () => {
  const result = buildPlatformReadiness({
    catalog: catalog([{ accountId: "x|alpha", platform: "x", configured: true, collected: true, formats: ["text"] }]),
    sourceEvidence: evidence([{ id: "e-ready", platform: "x", format: "text", baselineScope: "timeline", baselineSource: "baseline-x" }]),
    comparisonReadiness: comparisons([{ id: "e-ready", evidenceId: "e-ready", platform: "x", format: "text", readiness: { status: "ready", blockers: [] } }]),
    operatorReadiness: { gaps: ["account metadata is unreviewed"] },
  });

  assert.equal(result.rows[0]?.reusable.status, "ready");
  assert.equal(result.summary.reusableRows, 1);
  assert.deepEqual(result.summary.blockers, ["account metadata is unreviewed"]);
  assert.equal(result.rows[0]?.bodyIncluded, false);
});
