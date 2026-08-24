import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountReviewLedger, type AccountReviewInput } from "./account-review-ledger.js";
import type { PatternCatalog } from "./catalog.js";
import {
  main,
  parseReviewedAccountRegistryArgs,
  renderReviewedAccountRegistryMarkdown,
} from "./reviewed-account-registry-cli.js";
import { buildReviewedAccountRegistryReport } from "./reviewed-account-registry-report.js";
import { buildSourceEvidenceLedger } from "./source-evidence-ledger.js";

function account(): AccountReviewInput {
  return {
    id: "review:alice",
    currentAccountKey: "linkedin|alice",
    platform: "linkedin",
    handle: "@alice",
    creator: "Alice Example",
    stableAccountId: "account:alice",
    stableAccountIdStatus: "confirmed",
    topics: ["civic technology"],
    focus: ["decision-making under uncertainty"],
    nicheLabel: "civic technology",
    researchPoolMembership: [{ pool: "niche", reason: "explicit niche membership" }],
    popularityScope: "reviewed niche sample",
    sampleScope: "reviewed sample",
    baselineScope: "2026-08 /new baseline",
    baselineSource: "baseline:linkedin:2026-08",
    medium: "text",
    format: "short text post",
    audienceSnapshot: { size: 12000, countType: "followers", provenance: "reviewed profile", asOf: "2026-08-23", collectedAt: "2026-08-24" },
    evidenceRefs: ["evidence:account:alice"],
    baselineRefs: ["baseline:linkedin:2026-08"],
    caveats: [],
    reviewer: "muxin",
    reviewNote: "reviewed",
    disposition: "reviewed",
    dispositionReason: "explicitly reviewed",
    reviewed_at: "2026-08-24T12:00:00Z",
    supersedesId: null,
  };
}

const catalog: PatternCatalog = {
  rows: [],
  summary: {
    configuredTargets: 0,
    collectedSources: 0,
    configuredAndCollected: 0,
    configuredButUncollected: 0,
    evidenceCount: 0,
    admissibleCount: 0,
    bodyCompleteCount: 0,
    bodyIncompleteCount: 0,
  },
};

test("parses the durable ledger inputs and output format", () => {
  assert.deepEqual(parseReviewedAccountRegistryArgs([
    "--accounts-file", "accounts.jsonl",
    "--sources-file", "sources.jsonl",
    "--config", "config.yaml",
    "--baselines", "baselines.jsonl",
    "--format", "both",
  ]), {
    accountsFile: "accounts.jsonl",
    sourcesFile: "sources.jsonl",
    configPath: "config.yaml",
    corpusPath: undefined,
    analysesPath: undefined,
    baselinesPath: "baselines.jsonl",
    format: "both",
  });
  assert.throws(() => parseReviewedAccountRegistryArgs(["--accounts-file", "accounts.jsonl"]), /--accounts-file and --sources-file are required/);
});

test("renders a deterministic body-free operator view", () => {
  const report = buildReviewedAccountRegistryReport({
    accountLedger: buildAccountReviewLedger([account()]),
    sourceLedger: buildSourceEvidenceLedger([]),
    catalog,
  });
  const markdown = renderReviewedAccountRegistryMarkdown(report);
  assert.match(markdown, /Reviewed account registry/);
  assert.match(markdown, /Winner claims allowed: no/);
  assert.match(markdown, /Alice Example/);
  assert.doesNotMatch(markdown, /Alice's body|generated copy|post body text/i);
});

test("CLI reads both ledgers through injected I/O and fails closed on body-bearing rows", () => {
  const ledger = buildAccountReviewLedger([account()]);
  const files: Record<string, string> = {
    accounts: ledger.rows.map((row) => JSON.stringify(row)).join("\n"),
    sources: "",
  };
  let output = "";
  let errors = "";
  const loaders = {
    loadCatalog: () => catalog,
    readBaselines: () => [],
    readFile: (path: string) => files[path] ?? "",
  };
  assert.equal(main(["--accounts-file", "accounts", "--sources-file", "sources", "--format", "both"], loaders, {
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  }), 0);
  assert.equal(errors, "");
  assert.match(output, /reviewed_account_registry/);
  assert.match(output, /Winner claims allowed: no/);

  files.accounts = `${files.accounts}\n${JSON.stringify({ ...ledger.rows[0], body: "creator body" })}`;
  errors = "";
  assert.equal(main(["--accounts-file", "accounts", "--sources-file", "sources"], loaders, {
    write: () => undefined,
    error: (value) => { errors += value; },
  }), 1);
  assert.match(errors, /body-free/);
});
