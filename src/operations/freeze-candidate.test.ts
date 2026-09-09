import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planFreeze, type PlanFreezeInput } from "./freeze-candidate.js";

const baseInput: PlanFreezeInput = {
  headSha: "abc123",
  expectedSha: "abc123",
  porcelainEntries: [],
  changedPaths: ["src/foo.ts"],
  targetRoot: "/tmp/scratch/abc123",
  repoRoot: "/repo",
};

test("accepts a clean tree matching the expected sha", () => {
  const plan = planFreeze(baseInput);
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.sha, "abc123");
    assert.deepEqual(plan.changedPaths, ["src/foo.ts"]);
    assert.equal(plan.checkoutPath, "/tmp/scratch/abc123");
  }
});

test("refuses when HEAD does not match the sha the caller passed in", () => {
  const plan = planFreeze({ ...baseInput, expectedSha: "def456" });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "sha_mismatch");
  }
});

test("refuses on an untracked path that would not exist in the detached checkout", () => {
  const plan = planFreeze({
    ...baseInput,
    porcelainEntries: [{ path: "scratch/notes.txt", indexStatus: "?", worktreeStatus: "?" }],
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "untracked_path");
    assert.match(plan.detail, /scratch\/notes\.txt/);
  }
});

test("refuses on an undeclared staged modification", () => {
  const plan = planFreeze({
    ...baseInput,
    porcelainEntries: [{ path: "src/other.ts", indexStatus: "M", worktreeStatus: " " }],
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "undeclared_modification");
    assert.match(plan.detail, /src\/other\.ts/);
  }
});

test("refuses on an undeclared unstaged-only modification", () => {
  const plan = planFreeze({
    ...baseInput,
    porcelainEntries: [{ path: "src/other.ts", indexStatus: " ", worktreeStatus: "M" }],
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "undeclared_modification");
    assert.match(plan.detail, /src\/other\.ts/);
  }
});

test("a declared exception is not treated as dirty tree", () => {
  const plan = planFreeze({
    ...baseInput,
    porcelainEntries: [{ path: "content/other-session/review-queue.md", indexStatus: "M", worktreeStatus: " " }],
    declaredExceptions: ["content/other-session/review-queue.md"],
  });
  assert.equal(plan.ok, true);
});

test("a declared exception never suppresses the untracked-path refusal", () => {
  const plan = planFreeze({
    ...baseInput,
    porcelainEntries: [{ path: "scratch/notes.txt", indexStatus: "?", worktreeStatus: "?" }],
    declaredExceptions: ["scratch/notes.txt"],
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "untracked_path");
  }
});

test("sha mismatch is checked before dirty-tree conditions", () => {
  const plan = planFreeze({
    ...baseInput,
    expectedSha: "def456",
    porcelainEntries: [{ path: "scratch/notes.txt", indexStatus: "?", worktreeStatus: "?" }],
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "sha_mismatch");
  }
});

test("refuses a scratch root that lands inside the repository working tree", () => {
  const plan = planFreeze({
    ...baseInput,
    repoRoot: "/repo",
    targetRoot: "/repo/scratch/frozen",
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "scratch_root_inside_repo");
  }
});

test("refuses when the scratch root is the repo root itself", () => {
  const plan = planFreeze({
    ...baseInput,
    repoRoot: "/repo",
    targetRoot: "/repo",
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.reason, "scratch_root_inside_repo");
  }
});

// --- CLI/integration: exercise the real script end-to-end against a disposable git repo ---

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "freeze-candidate-cli-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "initial"], { cwd: dir });
  return dir;
}

test("CLI end-to-end: creates a detached checkout outside the repo and writes a complete manifest", () => {
  const repoDir = makeTempRepo();
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
  const scratchRoot = join(tmpdir(), `freeze-candidate-cli-test-out-${Date.now()}`);
  const scriptPath = fileURLToPath(new URL("./freeze-candidate.ts", import.meta.url));
  const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

  try {
    const output = execFileSync(
      "node",
      [
        "--import",
        "tsx",
        scriptPath,
        "--repo",
        repoDir,
        "--base",
        "HEAD",
        "--scratch-root",
        scratchRoot,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.match(output, /froze/);

    assert.ok(existsSync(scratchRoot), "detached checkout directory should exist");
    const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: scratchRoot, encoding: "utf8" }).trim();
    assert.equal(checkoutSha, headSha);

    const manifestPath = `${scratchRoot}.manifest.json`;
    assert.ok(existsSync(manifestPath), "manifest file should exist");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.sha, headSha);
    assert.equal(manifest.checkoutPath, scratchRoot);
    assert.ok(Array.isArray(manifest.changedPaths));
    assert.equal(typeof manifest.frozenAt, "string");
    assert.match(manifest.frozenAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", scratchRoot], { cwd: repoDir });
    } catch {
      // best-effort cleanup
    }
  }
});

test("CLI refuses when the requested scratch root is inside the repo", () => {
  const repoDir = makeTempRepo();
  const scratchRoot = join(repoDir, "inside-scratch");
  const scriptPath = fileURLToPath(new URL("./freeze-candidate.ts", import.meta.url));
  const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

  let caught: unknown;
  try {
    execFileSync(
      "node",
      ["--import", "tsx", scriptPath, "--repo", repoDir, "--base", "HEAD", "--scratch-root", scratchRoot],
      { cwd: repoRoot, encoding: "utf8", stdio: "pipe" },
    );
    assert.fail("expected the CLI to exit non-zero");
  } catch (error) {
    caught = error;
  }
  const stderr = (caught as { stderr?: string }).stderr ?? "";
  assert.match(stderr, /scratch_root_inside_repo/);
  assert.ok(!existsSync(scratchRoot), "no checkout should be created inside the repo");
});

test("CLI refuses and writes nothing when the changed-file diff cannot be computed", () => {
  const repoDir = makeTempRepo();
  const scratchRoot = join(tmpdir(), `freeze-candidate-cli-test-baddiff-${Date.now()}`);
  const scriptPath = fileURLToPath(new URL("./freeze-candidate.ts", import.meta.url));
  const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

  let caught: unknown;
  try {
    execFileSync(
      "node",
      [
        "--import",
        "tsx",
        scriptPath,
        "--repo",
        repoDir,
        "--base",
        "refs/does-not-exist-anywhere",
        "--scratch-root",
        scratchRoot,
      ],
      { cwd: repoRoot, encoding: "utf8", stdio: "pipe" },
    );
    assert.fail("expected the CLI to exit non-zero on an unresolvable base");
  } catch (error) {
    caught = error;
  }
  const stderr = (caught as { stderr?: string }).stderr ?? "";
  assert.match(stderr, /changed-file list/);
  assert.ok(!existsSync(scratchRoot), "no checkout should be created when the diff cannot be computed");
  assert.ok(!existsSync(`${scratchRoot}.manifest.json`), "no manifest should be written when the diff cannot be computed");
});
