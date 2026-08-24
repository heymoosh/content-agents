import test from "node:test";
import assert from "node:assert/strict";

import { buildEngineSpawn, getEngineMetadata } from "./engines.js";

test("buildEngineSpawn keeps Claude's existing invocation", () => {
  assert.deepEqual(
    buildEngineSpawn("claude", "do the work", { timeoutMs: 1000 }),
    { command: "claude", args: ["-p", "do the work", "--permission-mode", "acceptEdits"] },
  );
});

test("buildEngineSpawn uses Grok's Claude-compatible headless flags", () => {
  assert.deepEqual(
    buildEngineSpawn("grok", "do the work", { timeoutMs: 1000 }),
    { command: "grok", args: ["-p", "do the work", "--permission-mode", "acceptEdits"] },
  );
});

test("buildEngineSpawn captures Codex's final answer and permits workspace edits", () => {
  const built = buildEngineSpawn("codex", "do the work", { timeoutMs: 1000, outputFile: "/tmp/answer.md" });
  assert.equal(built.command, "codex");
  assert.deepEqual(built.args.slice(0, 4), ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check"]);
  assert.ok(built.args.includes("--output-last-message"));
  assert.ok(built.args.includes("/tmp/answer.md"));
  assert.equal(built.args.at(-1), "do the work");
});

test("engine metadata gives stable role guidance without renaming providers", () => {
  assert.deepEqual(getEngineMetadata("grok"), {
    id: "grok",
    label: "Grok",
    description: "Playful ideation, humor, and unexpected angles.",
    roleHint: "Ideation / Humor",
  });
  assert.equal(getEngineMetadata("unknown").id, "claude");
});
