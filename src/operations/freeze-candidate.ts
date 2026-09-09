import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, isAbsolute } from "node:path";

export interface PorcelainEntry {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
}

export type FreezeRefusalReason =
  | "sha_mismatch"
  | "untracked_path"
  | "undeclared_modification"
  | "scratch_root_inside_repo";

export interface FreezeRefusal {
  ok: false;
  reason: FreezeRefusalReason;
  detail: string;
}

export interface FreezePlan {
  ok: true;
  sha: string;
  changedPaths: string[];
  checkoutPath: string;
}

export interface PlanFreezeInput {
  headSha: string;
  expectedSha: string;
  porcelainEntries: PorcelainEntry[];
  changedPaths: string[];
  declaredExceptions?: string[];
  targetRoot: string;
  repoRoot: string;
}

function isInsideRepo(repoRoot: string, targetRoot: string): boolean {
  const rel = relative(resolve(repoRoot), resolve(targetRoot));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Pure: decides whether the current repository state is safe to freeze into a
 * detached checkout. No git call, no filesystem write.
 */
export function planFreeze(input: PlanFreezeInput): FreezeRefusal | FreezePlan {
  const { headSha, expectedSha, porcelainEntries, changedPaths, targetRoot, repoRoot } = input;
  const exceptions = new Set(input.declaredExceptions ?? []);

  if (headSha !== expectedSha) {
    return {
      ok: false,
      reason: "sha_mismatch",
      detail: `HEAD is ${headSha} but the caller expected to freeze ${expectedSha}`,
    };
  }

  if (isInsideRepo(repoRoot, targetRoot)) {
    return {
      ok: false,
      reason: "scratch_root_inside_repo",
      detail: `${targetRoot} is inside the repository working tree ${repoRoot}; the checkout must land outside it`,
    };
  }

  for (const entry of porcelainEntries) {
    // Untracked paths never have an exception route: they would silently be
    // missing from the detached checkout regardless of what the caller declares.
    const isUntracked = entry.indexStatus === "?" && entry.worktreeStatus === "?";
    if (isUntracked) {
      return {
        ok: false,
        reason: "untracked_path",
        detail: `${entry.path} is untracked and would not exist in the detached checkout`,
      };
    }
    if (exceptions.has(entry.path)) continue;
    return {
      ok: false,
      reason: "undeclared_modification",
      detail: `${entry.path} carries an undeclared change (index=${entry.indexStatus} worktree=${entry.worktreeStatus})`,
    };
  }

  return {
    ok: true,
    sha: headSha,
    changedPaths,
    checkoutPath: targetRoot,
  };
}

function parsePorcelain(raw: string): PorcelainEntry[] {
  return raw
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const indexStatus = line[0];
      const worktreeStatus = line[1];
      let path = line.slice(3);
      const renameSplit = path.split(" -> ");
      if (renameSplit.length === 2) path = renameSplit[1];
      return { path, indexStatus, worktreeStatus };
    });
}

function git(args: string[], cwd: string): string {
  // trimEnd only: git status --porcelain's leading status column can be a
  // literal space, and a full trim() would eat it off the first line only.
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trimEnd();
}

interface CliArgs {
  base: string;
  expectedSha?: string;
  allow: string[];
  scratchRoot?: string;
  repo?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { base: "origin/main", allow: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") args.base = argv[++i];
    else if (arg === "--expected-sha") args.expectedSha = argv[++i];
    else if (arg === "--allow") args.allow = argv[++i].split(",").filter(Boolean);
    else if (arg === "--scratch-root") args.scratchRoot = argv[++i];
    else if (arg === "--repo") args.repo = argv[++i];
  }
  return args;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const cwd = args.repo ? resolve(args.repo) : process.cwd();

  const headSha = git(["rev-parse", "HEAD"], cwd);
  const expectedSha = args.expectedSha ?? headSha;
  const porcelainRaw = git(["status", "--porcelain=v1"], cwd);
  const porcelainEntries = parsePorcelain(porcelainRaw);
  let changedPaths: string[];
  try {
    changedPaths = git(["diff", "--name-only", `${args.base}...HEAD`], cwd)
      .split("\n")
      .filter(Boolean);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`freeze refused: could not determine the changed-file list against ${args.base}: ${message}`);
    process.exit(1);
  }

  const targetRoot =
    args.scratchRoot ?? join(tmpdir(), `content-agents-freeze-${headSha.slice(0, 12)}-${Date.now()}`);

  const plan = planFreeze({
    headSha,
    expectedSha,
    porcelainEntries,
    changedPaths,
    declaredExceptions: args.allow,
    targetRoot,
    repoRoot: cwd,
  });

  if (!plan.ok) {
    console.error(`freeze refused: ${plan.reason} — ${plan.detail}`);
    process.exit(1);
  }

  git(["worktree", "add", "--detach", plan.checkoutPath, plan.sha], cwd);

  const manifest = {
    sha: plan.sha,
    checkoutPath: plan.checkoutPath,
    changedPaths: plan.changedPaths,
    frozenAt: new Date().toISOString(),
  };
  const manifestPath = `${plan.checkoutPath}.manifest.json`;
  mkdirSync(join(plan.checkoutPath, ".."), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`froze ${plan.sha} at ${plan.checkoutPath}`);
  console.log(`manifest: ${manifestPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
