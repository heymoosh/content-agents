import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  main,
  parseOutcomeLedgerArgs,
  type OutcomeLedgerCliOptions,
} from "./outcome-ledger-cli.js";

const row = {
  id: "f-1",
  observedAt: "2026-08-24T10:00:00Z",
  collectedAt: "2026-08-24T11:00:00Z",
  metric: "visits",
  value: 3,
  unit: "count",
  numerator: 3,
  denominator: 100,
  scope: { platform: "x" },
  window: { startAt: "2026-08-24T00:00:00Z", endAt: "2026-08-24T23:59:59Z" },
  sourceNote: "manual operator observation",
  evidenceRefs: ["e:f-1"],
  lineage: [{ recordType: "variant", id: "v-1", relation: "measured" }],
  caveats: [],
  status: "observed",
  eventType: "visit",
  attribution: [{
    contentItemId: "v-1",
    touchType: "last",
    touchAt: "2026-08-24T10:00:00Z",
    confidence: "high",
    attributionReason: null,
  }],
};

describe("outcome-ledger CLI", () => {
  test("accepts a durable ledger source and keeps it exclusive with JSON sources", () => {
    assert.deepEqual(parseOutcomeLedgerArgs(["--ledger", "data/outcomes.jsonl", "--format", "markdown"]), {
      source: { kind: "ledger", path: "data/outcomes.jsonl" },
      format: "markdown",
    } satisfies OutcomeLedgerCliOptions);
    assert.throws(() => parseOutcomeLedgerArgs(["--ledger", "facts.jsonl", "--json", "{}"]), /exactly one/);
    assert.throws(() => parseOutcomeLedgerArgs([]), /exactly one/);
  });

  test("reads existing JSONL without writing and renders the normalized outcome view", async () => {
    const folder = mkdtempSync(join(tmpdir(), "content-agents-outcome-ledger-"));
    try {
      const path = join(folder, "outcomes.jsonl");
      writeFileSync(path, JSON.stringify(row) + "\n");
      const output: string[] = [];
      const errors: string[] = [];
      assert.equal(await main(["--ledger", path, "--format", "markdown"], {
        write: (value: string) => { output.push(value); },
        error: (value: string) => { errors.push(value); },
      }), 0);
      assert.match(output[0] ?? "", /Outcome ledger/);
      assert.match(output[0] ?? "", /f-1/);
      assert.match(output[0] ?? "", /funnel/);
      assert.deepEqual(errors, []);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test("fails closed with a durable line number for malformed JSONL", async () => {
    const folder = mkdtempSync(join(tmpdir(), "content-agents-outcome-ledger-bad-"));
    try {
      const path = join(folder, "outcomes.jsonl");
      writeFileSync(path, JSON.stringify(row) + "\nnot-json\n");
      const errors: string[] = [];
      assert.equal(await main(["--ledger", path], {
        write: () => undefined,
        error: (value: string) => { errors.push(value); },
      }), 1);
      assert.match(errors[0] ?? "", /ledger line 2 is not valid JSON/);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
