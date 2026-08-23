import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main, parseGrowPlanArgs } from "./cli.js";

test("parses inline source, goal, repeated platforms, and comma-separated platforms", () => {
  assert.deepEqual(
    parseGrowPlanArgs([
      "--text",
      "  A raw thought.  ",
      "--goal",
      "find the useful cut",
      "--platform",
      "substack, linkedin",
      "--platform",
      "bluesky",
    ]),
    {
      source: { kind: "inline-thought", text: "  A raw thought.  " },
      goal: "find the useful cut",
      platforms: ["substack", "linkedin", "bluesky"],
    },
  );
});

test("accepts a file descriptor without reading or rewriting the source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "grow-plan-"));
  const sourcePath = join(directory, "does-not-exist.md");
  const output: string[] = [];

  const exitCode = await main(
    ["--file", sourcePath, "--goal", "plan the experiment", "--platform", "substack"],
    { write: (value) => output.push(value) },
  );

  assert.equal(exitCode, 0);
  const plan = JSON.parse(output.join(""));
  assert.deepEqual(plan.source.descriptor, { kind: "local-file", path: sourcePath });
});

test("emits the same descriptor and plan shape for inline source", async () => {
  const output: string[] = [];

  assert.equal(
    await main(
      ["--text", "raw thought", "--goal", "make a plan", "--platform", "substack,bluesky"],
      { write: (value) => output.push(value) },
    ),
    0,
  );

  const plan = JSON.parse(output.join(""));
  assert.deepEqual(plan.source.descriptor, { kind: "inline-thought", text: "raw thought" });
  assert.equal(plan.generatesCopy, false);
  assert.equal(plan.sideEffects, "none");
});

test("rejects missing and ambiguous inputs clearly", () => {
  assert.throws(
    () => parseGrowPlanArgs(["--goal", "goal", "--platform", "substack"]),
    /exactly one of --text or --file is required/,
  );
  assert.throws(
    () => parseGrowPlanArgs(["--text", "thought", "--file", "source.md", "--goal", "goal", "--platform", "substack"]),
    /exactly one of --text or --file is allowed/,
  );
  assert.throws(
    () => parseGrowPlanArgs(["--text", "thought", "--platform", "substack"]),
    /--goal is required/,
  );
  assert.throws(
    () => parseGrowPlanArgs(["--text", "thought", "--goal", "goal"]),
    /at least one --platform is required/,
  );
});
