import { basename } from "node:path";
import { execFileSync } from "node:child_process";
import { repoRoot } from "../db/db.js";
import { saveSceneBeats } from "./fiction.js";
import { resolveSeriesDir, chapterNumbers, readChapter } from "../fiction/_series.js";
import { continuityReportPath, readContinuityReport } from "../fiction/continuity.js";
import { ENGINE_LABELS, type Engine } from "./engines.js";
import type { CommandSpawnResult } from "./jobs.js";

export interface FictionJob {
  id: string;
  kind: string;
  label: string;
  engine?: Engine;
  arg: string;
  status: "queued" | "running" | "blocked" | "done" | "failed" | "stopped";
  slugs: string[];
  error: string | null;
  lastSpawn?: { code: number | null; timedOut: boolean; enoent: boolean };
  payload?: {
    mode?: "draft" | "repass";
    beats?: string;
    note?: string;
    series?: string;
    chapter?: number;
    engine?: Engine;
  };
}

type FictionJobFields = Pick<FictionJob, "status" | "slugs" | "error"> & {
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastStdoutLine: string | null;
  steps: string[];
  stepTotal: number | null;
  step: number;
  failedAtStep: number | null;
  retryable: boolean;
  ask: { question: string; options: string[]; askedAt: number } | null;
  answer: string | null;
};

export interface FictionJobDependencies {
  jobs: FictionJob[];
  nextJobId: () => string;
  freshJobFields: () => FictionJobFields;
  scheduleDrain: () => void;
  runClaudeSpawn: (
    job: FictionJob,
    prompt: string,
    opts: { timeoutMs: number; permissionMode?: string },
  ) => Promise<CommandSpawnResult>;
  runCommandSpawn: (
    job: FictionJob,
    command: string,
    args: string[],
    opts: { timeoutMs: number },
  ) => Promise<CommandSpawnResult>;
  addFictionCheckJob: (seriesArg: string, chapter: number, engine?: Engine) => FictionJob;
  decodeSpawnFailure: (
    result: { code: number | null; timedOut: boolean; enoent: boolean },
    jobId: string,
    opts: {
      timeoutVerb: string;
      timeoutLabel: string;
      exitVerb: string;
      includeTailOnTimeout?: boolean;
      command?: string;
    },
  ) => string | null;
  logTailSuffix: (jobId: string) => string;
  atomizePermissionMode: string;
}

// Pure prompt assembly, exported so the two constraints above are directly readable in a test.
export function fictionDraftPrompt(slug: string, beats: string): string {
  return [
    `/story ${slug}`,
    ``,
    `Muxin typed these beats in the studio's Fiction room and pressed "Draft it". They are her`,
    `direction for this scene:`,
    `"""`,
    beats.trim(),
    `"""`,
    ``,
    `This run is headless, so three things differ from the interactive skill:`,
    `- Her beats above ARE her sign-off on the direction, so do not post a beat sheet and wait.`,
    `  Plan from them and draft the chapter now.`,
    `- Write chapters/chapter-NN.md and run story:validate. Stop there.`,
    `- Do NOT commit, branch, push or open a pull request, and do not lock or publish anything.`,
    `  She reads the scene in the studio first, and the GitHub flow stays hers.`,
  ].join("\n");
}

// The second pass. `/story --revise` normally reads Muxin's GitHub PR review comments, and there is
// no PR here, so the note is handed over as the one review comment it should work from.
export function fictionRepassPrompt(slug: string, chapter: number, note: string): string {
  return [
    `/story --revise ${slug} ${chapter}`,
    ``,
    `There is no GitHub pull request for this chapter yet, so there are no review comments to read.`,
    `Muxin's note, typed in the studio, is the one comment. It covers the whole chapter:`,
    `"""`,
    note.trim(),
    `"""`,
    ``,
    `Apply it the way the skill's revise rules say: edits in the direction she asked for, and leave`,
    `everything her note does not reach. Re-run story:validate when you are done.`,
    `Do NOT commit, branch, push, open a pull request or reply on any thread. She reads the result`,
    `in the studio.`,
  ].join("\n");
}

// Every chapter's prose, keyed by number — the before/after artifact check for a fiction run.
// "Finished" is not "worked": a /story run can exit 0 having written nothing, and the only honest
// proof is a chapter file that appeared or changed.
export function chapterSnapshot(dir: string): Map<number, string> {
  const snap = new Map<number, string>();
  for (const n of chapterNumbers(dir)) {
    try {
      snap.set(n, readChapter(dir, n).body);
    } catch {
      /* unreadable mid-write — counts as absent */
    }
  }
  return snap;
}

// Pure: what a fiction run actually produced, from the two snapshots. Returns the chapter number a
// draft created, or null when nothing landed. Exported so the artifact check is unit-testable
// without spawning anything.
export function fictionRunProduced(
  before: Map<number, string>,
  after: Map<number, string>,
  mode: "draft" | "repass",
  target?: number,
): number | null {
  if (mode === "draft") {
    const fresh = [...after.keys()].filter((n) => !before.has(n)).sort((a, b) => a - b);
    return fresh.length ? fresh[fresh.length - 1] : null;
  }
  if (!target) return null;
  const was = before.get(target);
  const now = after.get(target);
  if (now === undefined || was === undefined) return null;
  return now !== was ? target : null;
}

// Which queued-or-running fiction job a new request is a duplicate of. Pure over the list so the
// identity rule is unit-testable without pushing a job (a pushed job starts a real `claude` spawn).
//
// Identity is the WHOLE request, not the series. Matching on kind and series alone meant a queued
// first-pass draft swallowed a chapter-3 second pass, and a chapter-3 second pass swallowed a
// chapter-5 one: the route answered ok with somebody else's job and the run Muxin asked for never
// happened.
export function findFictionDupe(
  list: FictionJob[],
  want: { kind: string; series: string; mode?: string; chapter?: number },
): FictionJob | undefined {
  return list.find((j) => {
    if (j.kind !== want.kind) return false;
    if (j.status !== "queued" && j.status !== "running") return false;
    const p = j.payload ?? {};
    if (p.series !== want.series) return false;
    if (want.mode !== undefined && (p.mode ?? "draft") !== want.mode) return false;
    if (want.chapter !== undefined && p.chapter !== want.chapter) return false;
    return true;
  });
}

// ── The "do not touch git" rule, enforced rather than asked for ─────────────────────────────────
// The /story skill's step 7 commits the chapter on a branch and opens a draft PR, and the dispatch
// prompt tells the headless run not to. A prompt is a request. The run holds `acceptEdits` and it
// legitimately needs Bash for `npm run story:validate`, so no tool filter can take git away from it
// without also taking the validate step away. What CAN be enforced is the outcome: read where git
// stands before the run and again after, and fail the job loudly if anything moved. That covers
// every route to the same damage (a commit, a checkout, a new branch) instead of naming commands.
//
// It never reverts. Rewinding somebody's checkout to clean up after a bad run is a worse failure
// than the one it fixes; the job reports exactly what moved and leaves it to Muxin.
export interface GitState {
  head: string; // HEAD commit sha
  branch: string; // current branch name, or "HEAD" when detached
  branches: string; // every local branch, newline joined
}

export function readGitState(cwd: string = repoRoot): GitState | null {
  const run = (args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", timeout: 15_000 }).trim();
  try {
    return {
      head: run(["rev-parse", "HEAD"]),
      branch: run(["rev-parse", "--abbrev-ref", "HEAD"]),
      branches: run(["for-each-ref", "--format=%(refname)", "refs/heads"]),
    };
  } catch {
    return null; // not a git checkout, or git is unavailable: there is nothing to compare
  }
}

// Pure: what moved, in Muxin's words. Null when git stands exactly where it did.
export function gitStateDrift(before: GitState | null, after: GitState | null): string | null {
  if (!before || !after) return null;
  const moved: string[] = [];
  if (before.branch !== after.branch) moved.push(`it switched the branch from ${before.branch} to ${after.branch}`);
  if (before.head !== after.head) moved.push("it committed something");
  const fresh = after.branches.split("\n").filter((b) => b && !before.branches.split("\n").includes(b));
  if (fresh.length) moved.push(`it created ${fresh.map((b) => b.replace("refs/heads/", "")).join(", ")}`);
  if (!moved.length) return null;
  return `the run was told to leave git alone and did not: ${moved.join(", ")}. Nothing was undone for you, so check \`git status\` and \`git log\` before you carry on.`;
}

async function runFictionDraftJob(job: FictionJob, deps: FictionJobDependencies): Promise<void> {
  const p = job.payload ?? {};
  const mode = p.mode === "repass" ? "repass" : "draft";
  const dir = resolveSeriesDir(p.series ?? job.arg);
  const before = chapterSnapshot(dir);
  const gitBefore = readGitState();
  const prompt =
    mode === "repass"
      ? fictionRepassPrompt(p.series ?? job.arg, p.chapter ?? 0, p.note ?? "")
      : fictionDraftPrompt(p.series ?? job.arg, p.beats ?? "");

  const result = await deps.runClaudeSpawn(job, prompt, {
    timeoutMs: FICTION_TIMEOUT_MS,
    permissionMode: deps.atomizePermissionMode,
  });
  const failure = deps.decodeSpawnFailure(result, job.id, {
    timeoutVerb: mode === "repass" ? "the second pass" : "the scene draft",
    timeoutLabel: `${FICTION_TIMEOUT_MS / 60000} min`,
    exitVerb: mode === "repass" ? "the second pass" : "the scene draft",
    includeTailOnTimeout: true,
  });
  const produced = fictionRunProduced(before, chapterSnapshot(dir), mode, p.chapter);
  const drift = gitStateDrift(gitBefore, readGitState());
  job.status = !failure && produced !== null && !drift ? "done" : "failed";
  if (produced === null || job.status !== "done") {
    // A chapter that landed AND git that moved is both facts at once, and the run still failed.
    const landed = produced === null ? "" : ` Chapter ${produced} was written, so the prose is on disk.`;
    job.error =
      failure ??
      (drift
        ? `${drift}${landed}${deps.logTailSuffix(job.id)}`
        : mode === "repass"
          ? `the second pass ran but chapter ${p.chapter} did not change, so nothing was written${deps.logTailSuffix(job.id)}`
          : `it ran but wrote no new chapter file, so nothing was written${deps.logTailSuffix(job.id)}`);
    return;
  }
  const chapter: number = produced;
  job.payload = { ...p, chapter };
  // Keep the anchor pointing at the scene it produced, so a reload still shows her beats above it.
  try {
    if (mode === "draft" && p.beats) saveSceneBeats(p.series ?? job.arg, p.beats, chapter);
  } catch {
    /* the anchor is a convenience; a scene that exists is still a scene */
  }
  // "It writes a first pass and checks the canon while it goes." The queue is serial, so this
  // simply runs next, on the same engine the draft ran on unless she picks a different one for the
  // recheck itself.
  try {
    deps.addFictionCheckJob(p.series ?? job.arg, chapter, job.engine ?? "claude");
  } catch {
    /* a check that cannot be queued must not fail the draft that already landed */
  }
}

async function runFictionCheckJob(job: FictionJob, deps: FictionJobDependencies): Promise<void> {
  const p = job.payload ?? {};
  const slug = p.series ?? job.arg;
  const chapter = p.chapter ?? 0;
  const engine: Engine = p.engine ?? job.engine ?? "claude";
  const before = readContinuityReport(slug, chapter)?.checkedAt ?? null;
  const result = await deps.runCommandSpawn(job, "npx", ["tsx", "src/fiction/continuity.ts", slug, "--chapter", String(chapter), "--engine", engine], {
    timeoutMs: CONTINUITY_TIMEOUT_MS,
  });
  const failure = deps.decodeSpawnFailure(result, job.id, {
    timeoutVerb: `the ${ENGINE_LABELS[engine]} canon check`, timeoutLabel: `${CONTINUITY_TIMEOUT_MS / 60000} min`,
    exitVerb: `the ${ENGINE_LABELS[engine]} canon check`, includeTailOnTimeout: true, command: "npx",
  });
  // Artifact, not exit code: a fresh report actually on disk.
  const after = readContinuityReport(slug, chapter);
  const wrote = Boolean(after) && after!.checkedAt !== before;
  job.status = !failure && wrote ? "done" : "failed";
  if (job.status === "failed") {
    job.error = failure ?? `the canon check ran but wrote no findings to ${continuityReportPath(slug, chapter)}${deps.logTailSuffix(job.id)}`;
  }
}

export function createFictionJobs(deps: FictionJobDependencies) {
  function addFictionDraftJob(seriesArg: string, beats: string, engine: Engine = "claude"): { job: FictionJob; queued: boolean } {
    const dir = resolveSeriesDir(seriesArg); // throws on an unknown series before anything is queued
    const slug = basename(dir);
    if (!beats.trim()) throw new Error("say the beats first");
    const existing = findFictionDupe(deps.jobs, { kind: "fiction-draft", series: slug, mode: "draft" });
    // Idempotent against a double-click, like addVideoJob. `queued: false` tells the route this run
    // is somebody else's already in flight, so it must not overwrite the beats anchor with beats the
    // running job never received.
    if (existing) return { job: existing, queued: false };
    const job: FictionJob = {
      id: deps.nextJobId(), kind: "fiction-draft", label: `Draft a scene: ${slug}`, arg: slug, engine, ...deps.freshJobFields(),
      payload: { mode: "draft", series: slug, beats: beats.trim() },
    };
    deps.jobs.push(job);
    deps.scheduleDrain();
    return { job, queued: true };
  }

  function addFictionRepassJob(seriesArg: string, chapter: number, note: string, engine: Engine = "claude"): FictionJob {
    const dir = resolveSeriesDir(seriesArg);
    const slug = basename(dir);
    if (!note.trim()) throw new Error("say what to change first");
    if (!chapterNumbers(dir).includes(chapter)) throw new Error(`there is no chapter ${chapter} to run again`);
    const existing = findFictionDupe(deps.jobs, { kind: "fiction-draft", series: slug, mode: "repass", chapter });
    if (existing) return existing;
    const job: FictionJob = {
      id: deps.nextJobId(), kind: "fiction-draft", label: `Second pass: ${slug} chapter ${chapter}`, arg: slug, engine, ...deps.freshJobFields(),
      payload: { mode: "repass", series: slug, chapter, note: note.trim() },
    };
    deps.jobs.push(job);
    deps.scheduleDrain();
    return job;
  }

  function addFictionCheckJob(seriesArg: string, chapter: number, engine: Engine = "claude"): FictionJob {
    const dir = resolveSeriesDir(seriesArg);
    const slug = basename(dir);
    if (!chapterNumbers(dir).includes(chapter)) throw new Error(`there is no chapter ${chapter} to check`);
    const existing = findFictionDupe(deps.jobs, { kind: "fiction-continuity", series: slug, chapter });
    if (existing) return existing;
    const job: FictionJob = {
      id: deps.nextJobId(), kind: "fiction-continuity", label: `Check the canon: ${slug} chapter ${chapter}`,
      arg: slug, engine, ...deps.freshJobFields(), payload: { series: slug, chapter, engine },
    };
    deps.jobs.push(job);
    deps.scheduleDrain();
    return job;
  }

  return {
    addFictionDraftJob,
    addFictionRepassJob,
    addFictionCheckJob,
    runFictionDraftJob: (job: FictionJob) => runFictionDraftJob(job, deps),
    runFictionCheckJob: (job: FictionJob) => runFictionCheckJob(job, deps),
  };
}

const FICTION_TIMEOUT_MS = 20 * 60_000;
const CONTINUITY_TIMEOUT_MS = 10 * 60_000;
