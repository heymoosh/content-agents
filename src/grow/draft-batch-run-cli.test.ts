import assert from "node:assert/strict";
import test from "node:test";
import { parseDraftBatchGenerationRunArgs } from "./draft-batch-run-cli.js";

test("draft-batch-run CLI requires exactly one JSON or file source", () => {
  assert.deepEqual(parseDraftBatchGenerationRunArgs(["--file", "run.json", "--format", "markdown"]), {
    source: { kind: "file", path: "run.json" },
    format: "markdown",
  });
  assert.throws(() => parseDraftBatchGenerationRunArgs([]), /exactly one of --json or --file is required/);
  assert.throws(() => parseDraftBatchGenerationRunArgs(["--json", "{}", "--file", "run.json"]), /exactly one of --json or --file is allowed/);
});
