import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { verifyChangedPaths, type StudioTask } from "./coordinator.js";

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`git ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`);
  }
}

function requiredLeaseFields(task: StudioTask): { base: string; worktree: string; branch: string } {
  if (!task.base_sha) throw new Error(`task ${task.id} has no named base_sha`);
  if (!task.worktree) throw new Error(`task ${task.id} has no worktree`);
  if (!task.branch) throw new Error(`task ${task.id} has no branch`);
  return { base: task.base_sha, worktree: task.worktree, branch: task.branch };
}

export function inspectCoordinatorMutationContext(cwd: string, expectedBranch: string): void {
  const branch = git(cwd, ["branch", "--show-current"]);
  if (branch !== expectedBranch) {
    throw new Error(`coordinator branch mismatch: expected ${expectedBranch}, found ${branch || "detached HEAD"}`);
  }
  const gitDir = resolve(cwd, git(cwd, ["rev-parse", "--git-dir"]));
  const commonDir = resolve(cwd, git(cwd, ["rev-parse", "--git-common-dir"]));
  if (gitDir === commonDir) {
    throw new Error("coordinator mutations are forbidden in the primary checkout; use a linked worktree");
  }
}

export function inspectCleanBaseline(task: StudioTask): void {
  const { base, worktree, branch } = requiredLeaseFields(task);
  const head = git(worktree, ["rev-parse", "HEAD"]);
  if (head !== base) throw new Error(`task ${task.id} baseline mismatch: worktree HEAD ${head} is not base_sha ${base}`);
  const actualBranch = git(worktree, ["branch", "--show-current"]);
  if (actualBranch !== branch) throw new Error(`task ${task.id} branch mismatch: expected ${branch}, found ${actualBranch || "detached HEAD"}`);
  const dirty = git(worktree, ["status", "--porcelain"]);
  if (dirty) throw new Error(`task ${task.id} has a dirty baseline; clean the task worktree before claiming it`);
}

export function inspectCleanWorktree(task: StudioTask): void {
  const { worktree, branch } = requiredLeaseFields(task);
  const actualBranch = git(worktree, ["branch", "--show-current"]);
  if (actualBranch !== branch) throw new Error(`task ${task.id} branch mismatch: expected ${branch}, found ${actualBranch || "detached HEAD"}`);
  const dirty = git(worktree, ["status", "--porcelain"]);
  if (dirty) throw new Error(`task ${task.id} worktree is dirty before correction handoff`);
}

export function verifyTaskCommit(task: StudioTask, commit: string): string[] {
  const { base, worktree } = requiredLeaseFields(task);
  const resolved = git(worktree, ["rev-parse", `${commit}^{commit}`]);
  if (resolved.toLowerCase() !== commit.toLowerCase()) {
    throw new Error(`commit must be supplied as its full 40-character SHA: ${resolved}`);
  }
  const commonBase = git(worktree, ["merge-base", base, resolved]);
  if (commonBase !== base) {
    throw new Error(`commit ${resolved} is not based on task ${task.id}'s base_sha ${base}`);
  }
  const output = git(worktree, ["diff", "--name-status", "-z", "--diff-filter=ACMRTD", `${base}..${resolved}`]);
  const tokens = output.split("\0").filter(Boolean);
  const changedPaths: string[] = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++]!;
    const firstPath = tokens[index++];
    if (!firstPath) throw new Error(`could not parse git diff status ${status}`);
    changedPaths.push(firstPath);
    if (status.startsWith("R") || status.startsWith("C")) {
      const secondPath = tokens[index++];
      if (!secondPath) throw new Error(`could not parse git diff ${status} destination`);
      changedPaths.push(secondPath);
    }
  }
  verifyChangedPaths(task, changedPaths);
  return changedPaths;
}
