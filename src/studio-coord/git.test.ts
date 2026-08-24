import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { inspectCleanBaseline, verifyTaskCommit } from "./git.js";
import type { StudioTask } from "./coordinator.js";

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function fixture(): { root: string; base: string; task: StudioTask } {
  const root = mkdtempSync(join(tmpdir(), "studio-coord-git-"));
  fixtures.push(root);
  git(root, "init", "-b", "feat/test");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  writeFileSync(join(root, "allowed.ts"), "export const value = 1;\n");
  writeFileSync(join(root, "outside.ts"), "export const untouched = true;\n");
  git(root, "add", "allowed.ts", "outside.ts");
  git(root, "commit", "-m", "base");
  const base = git(root, "rev-parse", "HEAD");
  return {
    root,
    base,
    task: {
      id: "test",
      batch_id: "batch-001",
      outcome: "Test Git boundary",
      status: "ready",
      depends_on: [],
      base_sha: base,
      context_paths: [],
      forbidden_paths: ["forbidden/**"],
      write_paths: ["allowed.ts"],
      semantic_locks: [],
      builder_family: "codex",
      auditor_family: "grok",
      branch: "feat/test",
      worktree: root,
      acceptance_commands: ["npm run check"],
      user_visible_behavior: false,
      content_logic_change: false,
      human_gate: "batch-approved",
      commit_sha: null,
      audit_verdict: "pending",
    },
  };
}

test("accepts an exact named clean baseline and rejects dirty worktrees", () => {
  const { root, task } = fixture();
  assert.doesNotThrow(() => inspectCleanBaseline(task));
  writeFileSync(join(root, "allowed.ts"), "export const value = 2;\n");
  assert.throws(() => inspectCleanBaseline(task), /dirty baseline/i);
});

test("verifies commit ancestry and rejects paths outside the file lease", () => {
  const { root, task } = fixture();
  writeFileSync(join(root, "allowed.ts"), "export const value = 2;\n");
  git(root, "add", "allowed.ts");
  git(root, "commit", "-m", "allowed change");
  const allowedCommit = git(root, "rev-parse", "HEAD");
  assert.deepEqual(verifyTaskCommit(task, allowedCommit), ["allowed.ts"]);

  writeFileSync(join(root, "surprise.ts"), "export {};\n");
  git(root, "add", "surprise.ts");
  git(root, "commit", "-m", "outside lease");
  const outsideCommit = git(root, "rev-parse", "HEAD");
  assert.throws(() => verifyTaskCommit(task, outsideCommit), /outside.*lease/i);
});

test("treats deletion of an out-of-lease path as a boundary violation", () => {
  const { root, task } = fixture();
  rmSync(join(root, "outside.ts"));
  git(root, "add", "outside.ts");
  git(root, "commit", "-m", "delete outside lease");
  const commit = git(root, "rev-parse", "HEAD");
  assert.throws(() => verifyTaskCommit(task, commit), /outside.*lease/i);
});
