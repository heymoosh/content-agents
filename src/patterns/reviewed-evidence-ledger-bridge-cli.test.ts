import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewedEvidenceLedgerBridgeCliFromJson,
  main,
  parseReviewedEvidenceLedgerBridgeArgs,
  renderReviewedEvidenceLedgerBridgeMarkdown,
  renderReviewedEvidenceLedgerBridgeJson,
} from "./reviewed-evidence-ledger-bridge-cli.js";
import type { ReviewedEvidenceIntakeReport } from "./reviewed-evidence-ledger-bridge.js";

function report(): ReviewedEvidenceIntakeReport {
  return {
    kind: "reviewed_evidence_intake",
    version: "reviewed-evidence-intake-v1",
    rows: {
      accounts: [
        {
          kind: "reviewed_account_intake_row",
          version: "reviewed-evidence-intake-v1",
          id: "account:zeta",
          currentAccountKey: "x|zeta",
          platform: "x",
          handle: null,
          creator: null,
          stableAccountId: "unknown",
          stableAccountIdStatus: "not-yet-reviewed",
          topics: "unknown",
          focus: null,
          nicheLabel: null,
          researchPoolMembership: null,
          popularityScope: null,
          sampleScope: "unknown",
          baselineScope: null,
          baselineSource: "unknown",
          medium: null,
          format: null,
          audienceSnapshot: "unknown",
          evidenceLinks: ["link://account-zeta"],
          evidenceRefs: ["ref://account-zeta"],
          caveats: "unknown",
          reviewer: null,
          reviewedAt: null,
          disposition: null,
          dispositionReason: null,
          readiness: { status: "blocked", blockers: ["shared blocker", "account blocker"] },
          bodyIncluded: false,
        },
        {
          kind: "reviewed_account_intake_row",
          version: "reviewed-evidence-intake-v1",
          id: "account:alpha",
          currentAccountKey: "x|alpha",
          platform: "x",
          handle: "@alpha",
          creator: "Alpha",
          stableAccountId: "account-alpha",
          stableAccountIdStatus: "confirmed",
          topics: ["civic tech"],
          focus: ["decisions"],
          nicheLabel: "human inference",
          researchPoolMembership: [{ pool: "niche", reason: "explicit review" }],
          popularityScope: "public follower count",
          sampleScope: "reviewed posts",
          baselineScope: "same platform",
          baselineSource: "baseline://x",
          medium: "text",
          format: "short-post",
          audienceSnapshot: { size: 100, countType: "followers", provenance: "profile", asOf: "2026-08-20", collectedAt: "2026-08-21" },
          evidenceLinks: null,
          evidenceRefs: null,
          caveats: [],
          reviewer: "muxin",
          reviewedAt: "2026-08-21",
          disposition: "reviewed",
          dispositionReason: null,
          readiness: { status: "ready", blockers: [] },
          bodyIncluded: false,
        },
      ],
      evidence: [
        {
          kind: "reviewed_source_evidence_intake_row",
          version: "reviewed-evidence-intake-v1",
          id: "evidence:zeta",
          sourceId: "source-zeta",
          postId: "post-zeta",
          accountId: "account:zeta",
          platform: "x",
          medium: "text",
          format: "short-post",
          pool: null,
          membershipReason: null,
          audienceSizeSnapshot: null,
          metricSnapshot: "unknown",
          comparisonClaimed: null,
          popularityScope: null,
          sampleScope: "unknown",
          baselineScope: null,
          baselineSource: "unknown",
          evidenceLinks: ["link://source-zeta"],
          evidenceRefs: ["ref://source-zeta"],
          bodyComplete: false,
          caveats: null,
          provenance: null,
          observedAt: null,
          collectedAt: null,
          reviewStatus: "pending",
          status: "blocked",
          lineage: null,
          readiness: { status: "blocked", blockers: ["shared blocker", "source blocker"] },
          bodyIncluded: false,
        },
        {
          kind: "reviewed_source_evidence_intake_row",
          version: "reviewed-evidence-intake-v1",
          id: "evidence:alpha",
          sourceId: "source-alpha",
          postId: "post-alpha",
          accountId: "account:alpha",
          platform: "x",
          medium: "text",
          format: "short-post",
          pool: "niche",
          membershipReason: "explicit review",
          audienceSizeSnapshot: { size: 100, countType: "followers", provenance: "profile", asOf: "2026-08-20", collectedAt: "2026-08-21" },
          metricSnapshot: { metric: "likes", value: 5, unit: "count", numerator: 5, denominator: 100, window: "all time", scope: "post", observedAt: "2026-08-20" },
          comparisonClaimed: true,
          popularityScope: "public",
          sampleScope: "reviewed posts",
          baselineScope: "same platform",
          baselineSource: "baseline://x",
          evidenceLinks: "unknown",
          evidenceRefs: null,
          bodyComplete: true,
          caveats: [],
          provenance: "manual review",
          observedAt: "2026-08-20",
          collectedAt: "2026-08-21",
          reviewStatus: "reviewed",
          status: "ready",
          lineage: [{ recordType: "account", id: "account-alpha", relation: "belongs-to" }],
          readiness: { status: "ready", blockers: [] },
          bodyIncluded: false,
        },
      ],
      baselines: [
        {
          id: "baseline:zeta",
          accountId: "account:zeta",
          platform: "x",
          baselineScope: null,
          baselineSource: "unknown",
          evidenceLinks: ["link://baseline-zeta"],
          evidenceRefs: ["ref://baseline-zeta"],
          reviewStatus: "pending",
          readiness: { status: "blocked", blockers: ["baseline blocker"] },
        },
      ],
    },
    summary: { "explicitly supplied": true },
    readiness: { status: "blocked", blockers: ["root blocker"] },
    bodyIncluded: false,
    sideEffects: "none",
  };
}

test("builds deterministic body-free operator metadata without inventing facts", () => {
  const raw = JSON.stringify(report());
  const first = buildReviewedEvidenceLedgerBridgeCliFromJson(raw);
  const second = buildReviewedEvidenceLedgerBridgeCliFromJson(raw);

  assert.deepEqual(first, second);
  assert.deepEqual(first.counts, { accounts: 2, sources: 2, baselines: 1, total: 5 });
  assert.deepEqual(first.accounts.map((row) => row.id), ["account:alpha", "account:zeta"]);
  assert.equal(first.accounts[1]?.stableAccountId, "unknown");
  assert.equal(first.accounts[1]?.disposition, null);
  assert.deepEqual(first.accounts[1]?.evidenceLinks, ["link://account-zeta"]);
  assert.deepEqual(first.accounts[1]?.evidenceRefs, ["ref://account-zeta"]);
  assert.equal(first.sources[0]?.evidenceLinks, "unknown");
  assert.equal(first.sources[0]?.evidenceRefs, null);
  assert.deepEqual(first.sources[1]?.evidenceLinks, ["link://source-zeta"]);
  assert.deepEqual(first.sources[1]?.evidenceRefs, ["ref://source-zeta"]);
  assert.equal(first.baselines[0]?.baselineScope, null);
  assert.equal(first.baselines[0]?.baselineSource, "unknown");
  assert.deepEqual(first.baselines[0]?.evidenceLinks, ["link://baseline-zeta"]);
  assert.deepEqual(first.baselines[0]?.evidenceRefs, ["ref://baseline-zeta"]);
  assert.equal(first.accountReviewInputs[1]?.disposition, null);
  assert.equal(first.sourceEvidenceRecordInputs[1]?.recordStatus, "blocked");
  assert.deepEqual(first.blockers, [
    { kind: "account", id: "account:zeta", blockers: ["account blocker", "shared blocker"] },
    { kind: "baseline", id: "baseline:zeta", blockers: ["baseline blocker"] },
    { kind: "evidence", id: "evidence:zeta", blockers: ["shared blocker", "source blocker"] },
  ]);
  assert.equal(first.bodyIncluded, false);
  assert.equal(first.sideEffects, "none");
  assert.doesNotMatch(JSON.stringify(first), /PRIVATE BODY|post text|creator body/i);
});

test("renders JSON and Markdown with counts, all blockers, and explicit metadata", () => {
  const view = buildReviewedEvidenceLedgerBridgeCliFromJson(JSON.stringify(report()));
  const json = renderReviewedEvidenceLedgerBridgeJson(view);
  const markdown = renderReviewedEvidenceLedgerBridgeMarkdown(view);

  assert.deepEqual(JSON.parse(json), view);
  assert.match(markdown, /^# Reviewed evidence ledger bridge/m);
  assert.match(markdown, /Accounts: 2/);
  assert.match(markdown, /Sources: 2/);
  assert.match(markdown, /Baselines: 1/);
  for (const blocker of ["account blocker", "shared blocker", "source blocker", "baseline blocker"]) {
    assert.match(markdown, new RegExp(blocker));
  }
  assert.match(markdown, /link:\/\/source-zeta/);
  assert.match(markdown, /ref:\/\/source-zeta/);
  assert.match(markdown, /"stableAccountId": "unknown"/);
  assert.match(markdown, /"disposition": null/);
});

test("accepts exactly one explicit source and uses injected file/output I/O", async () => {
  assert.deepEqual(parseReviewedEvidenceLedgerBridgeArgs(["--json", "{}", "--format", "markdown"]), {
    source: { kind: "json-string", value: "{}" },
    format: "markdown",
  });
  assert.throws(() => parseReviewedEvidenceLedgerBridgeArgs(["--json", "{}", "--file", "report.json"]), /exactly one/i);

  let output = "";
  let errors = "";
  const exitCode = await main(["--file", "report.json", "--format", "markdown"], {
    readFile: async (path) => {
      assert.equal(path, "report.json");
      return JSON.stringify(report());
    },
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  });

  assert.equal(exitCode, 0);
  assert.equal(errors, "");
  assert.match(output, /# Reviewed evidence ledger bridge/);
});

test("fails closed on malformed, unsafe, or non-body-free reports", async () => {
  assert.throws(() => buildReviewedEvidenceLedgerBridgeCliFromJson("not json"), /valid JSON/i);
  assert.throws(() => buildReviewedEvidenceLedgerBridgeCliFromJson(JSON.stringify({ ...report(), bodyIncluded: true })), /bodyIncluded/i);
  assert.throws(() => buildReviewedEvidenceLedgerBridgeCliFromJson(JSON.stringify({
    ...report(),
    rows: { ...report().rows, evidence: [{ ...report().rows.evidence[0], model: "private-model" }] },
  })), /unsupported|body.*model/i);

  let errors = "";
  const exitCode = await main(["--json", "not json"], {
    write: () => { throw new Error("must not write failed output"); },
    error: (value) => { errors += value; },
  });
  assert.equal(exitCode, 1);
  assert.match(errors, /valid JSON/i);
});
