import assert from "node:assert/strict";
import { test } from "node:test";
import { main } from "./experiment-run-cli.js";

test("running-experiment CLI fails closed when the envelope has no successful attempts", async () => {
  let output = "";
  let error = "";
  const code = await main(["--input", "run.json"], {
    out: async (value) => { output += value; }, error: async (value) => { error += value; },
    readJson: async () => ({ proposal: { digest: "sha256:proposal" }, decision: {}, attempts: [] }),
  });
  assert.equal(code, 1);
  assert.equal(output, "");
  assert.match(error, /unsupported|scheduling attempt|required|invalid/i);
});

test("running-experiment CLI rejects malformed envelopes and unknown options", async () => {
  const errors: string[] = [];
  const io = { out: async () => {}, error: async (value: string) => { errors.push(value); }, readJson: async () => ({}) };
  assert.equal(await main(["--input", "run.json"], io), 1);
  assert.match(errors.pop() ?? "", /proposal is required/);
  assert.equal(await main(["--wat"], io), 1);
  assert.match(errors.pop() ?? "", /unknown option/);
});
