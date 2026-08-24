import assert from "node:assert/strict";
import test from "node:test";
import {
  main,
  parsePoolBestLedgerReportArgs,
  renderPoolBestLedgerReportMarkdown,
} from "./pool-best-ledger-report-cli.js";
import { buildAccountReviewLedger } from "./account-review-ledger.js";
import { buildSourceEvidenceLedger } from "./source-evidence-ledger.js";
import { buildPoolBestLedgerReport } from "./pool-best-ledger-report.js";

test("parses durable ledger paths and comparison threshold", () => {
  assert.deepEqual(parsePoolBestLedgerReportArgs([
    "--accounts-file", "accounts.jsonl",
    "--sources-file", "sources.jsonl",
    "--baselines", "baselines.jsonl",
    "--minimum-comparable-candidates", "3",
    "--format", "both",
  ]), {
    accountsFile: "accounts.jsonl",
    sourcesFile: "sources.jsonl",
    baselinesPath: "baselines.jsonl",
    minimumComparableCandidates: 3,
    format: "both",
  });
  assert.throws(() => parsePoolBestLedgerReportArgs(["--accounts-file", "a", "--sources-file", "s", "--minimum-comparable-candidates", "1"]), /at least 2/);
});

test("renders the durable best-report wrapper as blocked when source evidence is absent", () => {
  const report = buildPoolBestLedgerReport({
    accountLedger: buildAccountReviewLedger([]),
    sourceLedger: buildSourceEvidenceLedger([]),
    baselines: [],
    minimumComparableCandidates: 2,
  });
  const markdown = renderPoolBestLedgerReportMarkdown(report);
  assert.match(markdown, /Pool best report from durable ledgers/);
  assert.match(markdown, /source ledger has no comparison evidence/);
  assert.match(markdown, /body-free/i);
});

test("CLI uses injected file and baseline readers", () => {
  const files: Record<string, string> = { accounts: "", sources: "" };
  let output = "";
  let errors = "";
  assert.equal(main(["--accounts-file", "accounts", "--sources-file", "sources", "--format", "markdown"], {
    readFile: (path) => files[path] ?? "",
    readBaselines: () => [],
  }, {
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  }), 0);
  assert.equal(errors, "");
  assert.match(output, /Pool best report from durable ledgers/);
  assert.match(output, /blocked/);
});
