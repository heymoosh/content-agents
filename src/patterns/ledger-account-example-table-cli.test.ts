import assert from "node:assert/strict";
import test from "node:test";
import { main, parseLedgerAccountExampleTableArgs } from "./ledger-account-example-table-cli.js";

test("ledger account/example table CLI requires both append-only ledger files", () => {
  assert.deepEqual(parseLedgerAccountExampleTableArgs(["--accounts-file", "accounts.jsonl", "--sources-file", "sources.jsonl", "--format", "both"]), {
    accountFile: "accounts.jsonl",
    sourceFile: "sources.jsonl",
    format: "both",
  });
  assert.throws(() => parseLedgerAccountExampleTableArgs(["--accounts-file", "accounts.jsonl"]), /--accounts-file and --sources-file are required/);
});

test("ledger account/example table CLI can render empty ledgers without inventing rows", () => {
  let output = "";
  let error = "";
  const code = main(["--accounts-file", "accounts.jsonl", "--sources-file", "sources.jsonl"], {
    readFile: () => "",
    write: (value) => { output += value; },
    error: (value) => { error += value; },
  });
  assert.equal(code, 0);
  assert.equal(error, "");
  assert.match(output, /ledger_account_example_table/);
  assert.match(output, /winnerClaimsAllowed.*false/);
});
