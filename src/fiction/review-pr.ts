import "../util/env.js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { oneSentencePerLine } from "./_format.js";
import { withFileLock } from "../runtime/file-lock.js";
import { buildEngineSpawn, extractEngineText, GROK_FINAL_TEXT_SYSTEM_PROMPT, type Engine } from "../review/engines.js";

const execFileP = promisify(execFile);
const ENGINES: readonly Engine[] = ["claude", "grok", "codex", "ollama-gpt-oss"];

export interface CommandResult { code: number; stdout: string; stderr: string }
export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export async function defaultRun(command: string, args: string[], cwd = process.cwd()): Promise<CommandResult> {
  try {
    const result = await execFileP(command, args, { cwd, encoding: "utf8", maxBuffer: 20_000_000 });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string; message?: string };
    return { code: typeof e.code === "number" ? e.code : 1, stdout: e.stdout ?? "", stderr: e.stderr ?? e.message ?? String(error) };
  }
}

function required(result: CommandResult, label: string): string {
  if (result.code !== 0) throw new Error(`${label} failed: ${result.stderr.trim() || `exit ${result.code}`}`);
  return result.stdout.trim();
}
function safeSeries(series: string): void { if (!/^[a-z0-9][\w-]*$/.test(series)) throw new Error("bad series"); }
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function expectedChapterPath(series: string, chapter: number): string {
  safeSeries(series);
  if (!Number.isSafeInteger(chapter) || chapter < 1) throw new Error("bad chapter");
  return `stories/${series}/chapters/chapter-${pad2(chapter)}.md`;
}
function expectedBranch(series: string, chapter: number): string { return `story/${series}/chapter-${pad2(chapter)}`; }

export interface StoryPullRequest { number: number; url: string; title?: string; branch: string; isDraft: boolean }
export interface StoryPrInput { series: string; chapter: number; repoRoot?: string; baseBranch?: string; run?: CommandRunner }

function githubRepoFromRemote(remote: string): string {
  const match = remote.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (!match) throw new Error("origin is not a GitHub repository");
  return match[1];
}

/** Explicit Studio action: create exactly one draft PR for the landed chapter. */
export async function createStoryDraftPr(input: StoryPrInput): Promise<StoryPullRequest> {
  const cwd = input.repoRoot ?? process.cwd();
  const run = input.run ?? ((command, args) => defaultRun(command, args, cwd));
  const base = input.baseBranch ?? "main";
  const chapter = expectedChapterPath(input.series, input.chapter);
  const branch = expectedBranch(input.series, input.chapter);
  const absChapter = join(cwd, chapter);
  if (!existsSync(absChapter)) throw new Error(`chapter file is missing: ${chapter}`);
  const remote = required(await run("git", ["remote", "get-url", "origin"]), "git remote");
  if (!/(?:^|@)github\.com[:/][^/]+\/[^/]+(?:\.git)?$/i.test(remote)) throw new Error("origin is not a GitHub repository; refusing to create story PR");
  const existing = await run("gh", ["pr", "list", "--state", "open", "--head", branch, "--json", "number,url,title,isDraft,headRefName"]);
  if (existing.code === 0) {
    try {
      const rows = JSON.parse(existing.stdout) as Array<{ number: number; url: string; title?: string; isDraft?: boolean; headRefName?: string }>;
      const found = rows.find((row) => row.headRefName === undefined || row.headRefName === branch);
      if (found) return { number: found.number, url: found.url, title: found.title, branch, isDraft: found.isDraft !== false };
    } catch { throw new Error("gh returned malformed PR list; refusing to create a duplicate"); }
  } else if (!/no pull requests found/i.test(existing.stderr)) {
    throw new Error(`gh pr list failed: ${existing.stderr.trim() || `exit ${existing.code}`}`);
  }
  const status = required(await run("git", ["status", "--porcelain", "--untracked-files=all"]), "git status");
  const changedPaths = status.split("\n").map((line) => line.slice(3).trim()).filter(Boolean);
  if (!changedPaths.length || changedPaths.some((changedPath) => changedPath !== chapter)) throw new Error("working tree is dirty outside the landed chapter; refusing to create a story PR");
  if (required(await run("git", ["branch", "--show-current"]), "git branch") !== base) throw new Error(`must start from ${base}; refusing to create story PR`);
  const ref = await run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (ref.code === 0) throw new Error(`branch ${branch} already exists without a matching open PR; refusing to reuse it`);
  if (ref.code !== 1) throw new Error(`could not inspect branch ${branch}`);
  const titleMatch = readFileSync(absChapter, "utf8").match(/^title:\s*(.+)$/m);
  const title = `${input.series.replace(/-/g, " ")} - Chapter ${input.chapter}${titleMatch ? `: ${titleMatch[1].trim().replace(/^['"]|['"]$/g, "")}` : ""}`;
  const body = `Draft chapter review for ${input.series}, chapter ${input.chapter}. Comment on exact lines or ranges for surgical revisions. Approve when the chapter is ready; this PR does not lock or publish it.`;
  required(await run("git", ["switch", "-c", branch]), "git switch");
  required(await run("git", ["add", "--", chapter]), "git add");
  required(await run("git", ["commit", "-m", title]), "git commit");
  required(await run("git", ["push", "--set-upstream", "origin", branch]), "git push");
  const created = required(await run("gh", ["pr", "create", "--draft", "--base", base, "--head", branch, "--title", title, "--body", body]), "gh pr create");
  const url = created.split(/\s+/).find((value) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(value));
  if (!url) throw new Error("gh created a PR but returned no GitHub URL");
  return { number: Number(url.match(/\/pull\/(\d+)/)?.[1] ?? 0), url, title, branch, isDraft: true };
}

export interface VerifyStoryReviewPrInput {
  series: string;
  chapter: number;
  prNumber: number;
  baseBranch?: string;
  repoRoot?: string;
  run?: CommandRunner;
}

/** Prove the explicit PR number and current checkout are the chapter review lane before mutation. */
export async function verifyStoryReviewPr(input: VerifyStoryReviewPrInput): Promise<StoryPullRequest> {
  const run = input.run ?? ((command, args) => defaultRun(command, args, input.repoRoot ?? process.cwd()));
  const branch = expectedBranch(input.series, input.chapter);
  const base = input.baseBranch ?? "main";
  if (!Number.isSafeInteger(input.prNumber) || input.prNumber < 1) throw new Error("bad pull request number");
  if (required(await run("git", ["branch", "--show-current"]), "git branch") !== branch) {
    throw new Error(`switch to ${branch} before applying its review comments`);
  }
  if (required(await run("git", ["status", "--porcelain", "--untracked-files=all"]), "git status")) {
    throw new Error("working tree must be clean before applying review comments");
  }
  const remote = required(await run("git", ["remote", "get-url", "origin"]), "git remote");
  if (!/(?:^|@)github\.com[:/][^/]+\/[^/]+(?:\.git)?$/i.test(remote)) throw new Error("origin is not a GitHub repository");
  const localHead = required(await run("git", ["rev-parse", "HEAD"]), "git HEAD");
  const output = required(await run("gh", ["pr", "view", String(input.prNumber), "--json", "number,url,state,isDraft,headRefName,headRefOid,baseRefName"]), "gh pr view");
  let pr: { number: number; url: string; state: string; isDraft?: boolean; headRefName: string; headRefOid: string; baseRefName: string };
  try { pr = JSON.parse(output); } catch { throw new Error("gh returned malformed PR metadata"); }
  if (pr.state !== "OPEN" || pr.headRefName !== branch || pr.baseRefName !== base) {
    throw new Error(`pull request ${input.prNumber} does not review ${branch} into ${base}`);
  }
  if (!pr.headRefOid || pr.headRefOid !== localHead) {
    throw new Error("local HEAD does not match the pull request head; pull the review branch before applying comments");
  }
  return { number: pr.number, url: pr.url, branch, title: undefined, isDraft: pr.isDraft !== false };
}

export async function listStoryReviewComments(prNumber: number, repoRoot = process.cwd(), run?: CommandRunner): Promise<ReviewComment[]> {
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error("bad pull request number");
  const execute = run ?? ((command, args) => defaultRun(command, args, repoRoot));
  const remote = required(await execute("git", ["remote", "get-url", "origin"]), "git remote");
  const repo = githubRepoFromRemote(remote);
  const query = "query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved comments(first:100){nodes{databaseId body path line startLine}}}}}}}";
  const result = await execute("gh", ["api", "graphql", "-f", `query=${query}`, "-f", `owner=${repo.split("/")[0]}`, "-f", `name=${repo.split("/")[1]}`, "-F", `number=${prNumber}`]);
  const output = required(result, "gh review comments");
  const data = JSON.parse(output) as { data?: { repository?: { pullRequest?: { reviewThreads?: { nodes?: Array<{ isResolved: boolean; comments?: { nodes?: Array<{ databaseId: number; body: string; path: string; line?: number | null; startLine?: number | null }> } }> } } } } };
  return (data.data?.repository?.pullRequest?.reviewThreads?.nodes ?? []).flatMap((thread) => (thread.isResolved ? [] : (thread.comments?.nodes ?? []).slice(0, 1).map((comment) => ({ id: comment.databaseId, path: comment.path, line: comment.line, start_line: comment.startLine, body: comment.body }))));
}

export async function replyToStoryReviewComment(prNumber: number, commentId: number | string, body: string, repoRoot = process.cwd(), run?: CommandRunner): Promise<void> {
  const execute = run ?? ((command, args) => defaultRun(command, args, repoRoot));
  const remote = required(await execute("git", ["remote", "get-url", "origin"]), "git remote");
  const repo = githubRepoFromRemote(remote);
  required(await execute("gh", ["api", `repos/${repo}/pulls/${prNumber}/comments/${commentId}/replies`, "-f", `body=${body}`]), "gh comment reply");
}

/** At most one explicit engine token. Brackets are presentation only and are tolerated. */
export function parseEngineDirective(body: string, defaultEngine: Engine): Engine | null {
  if (!ENGINES.includes(defaultEngine)) return null;
  const matches = [...String(body ?? "").matchAll(/\bengine\s*:\s*([a-z0-9_-]+)/gi)];
  if (!matches.length) return defaultEngine;
  if (matches.length !== 1) return null;
  const candidate = matches[0][1].toLowerCase() as Engine;
  return ENGINES.includes(candidate) ? candidate : null;
}

function isNoop(body: string): boolean {
  const text = String(body ?? "").replace(/\[?\s*engine\s*:\s*[a-z0-9_-]+\s*\]?/gi, "").replace(/[\[\]()*_`]/g, "").trim().toLowerCase();
  return /^(keep(?: this| it)?|looks good|no changes?|no[- ]op|leave(?: this| it)? as is|approved?|nice|great)[.!]?$/.test(text);
}

export interface ReviewComment {
  id: number | string;
  path: string;
  line?: number | null;
  start_line?: number | null;
  body: string;
  resolved?: boolean;
  originalText?: string;
}
interface PreparedComment { comment: ReviewComment; startOffset: number; endOffset: number; originalSpan: string; engine: Engine; noop: boolean }

function lineOffsets(raw: string): number[] {
  const out = [0];
  for (let i = 0; i < raw.length; i++) if (raw[i] === "\n") out.push(i + 1);
  return out;
}
function bodyStartOffset(raw: string): number {
  return raw.match(/^---\n[\s\S]*?\n---\n?/)?.[0].length ?? 0;
}
function prepareComments(raw: string, expectedPath: string, comments: ReviewComment[], defaultEngine: Engine): PreparedComment[] {
  const offsets = lineOffsets(raw);
  const bodyStart = bodyStartOffset(raw);
  const pending: PreparedComment[] = [];
  for (const comment of comments) {
    if (comment.resolved) continue;
    if (comment.path !== expectedPath) throw new Error(`comment ${comment.id} is not bound to ${expectedPath}`);
    if (!Number.isSafeInteger(comment.line) || (comment.start_line !== undefined && comment.start_line !== null && !Number.isSafeInteger(comment.start_line))) throw new Error(`comment ${comment.id} has no exact line range`);
    const endLine = comment.line as number;
    const startLine = (comment.start_line ?? endLine) as number;
    if (startLine < 1 || endLine < startLine || endLine > offsets.length) throw new Error(`comment ${comment.id} has an outdated or invalid line range`);
    const startOffset = offsets[startLine - 1];
    const endOfLine = endLine < offsets.length ? offsets[endLine] - 1 : raw.length;
    if (startOffset < bodyStart || endOfLine <= startOffset || !raw.slice(startOffset, endOfLine).trim()) throw new Error(`comment ${comment.id} does not bind to mutable chapter prose`);
    const originalSpan = raw.slice(startOffset, endOfLine);
    if (comment.originalText !== undefined && comment.originalText !== originalSpan) throw new Error(`comment ${comment.id} is outdated; its original span no longer matches`);
    const engine = parseEngineDirective(comment.body, defaultEngine);
    if (!engine) throw new Error(`comment ${comment.id} has an unknown or conflicting engine directive`);
    if (engine === "ollama-gpt-oss") throw new Error(`comment ${comment.id} requests GPT-OSS for a file-writing revision; choose claude, grok, or codex`);
    pending.push({ comment, startOffset, endOffset: endOfLine, originalSpan, engine, noop: isNoop(comment.body) });
  }
  const sorted = [...pending].sort((a, b) => a.startOffset - b.startOffset);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].startOffset < sorted[i - 1].endOffset) throw new Error("review comment ranges overlap; refusing to guess at a target");
  return pending;
}

export interface CommentReplacement { startOffset: number; endOffset: number; replacement: string }
export function applyCommentReplacements(body: string, replacements: CommentReplacement[]): string {
  let out = body;
  for (const item of [...replacements].sort((a, b) => b.startOffset - a.startOffset)) {
    if (item.startOffset < 0 || item.endOffset < item.startOffset || item.endOffset > body.length) throw new Error("invalid replacement range");
    const replacement = oneSentencePerLine(item.replacement.trim());
    if (!replacement) throw new Error("model returned an empty replacement");
    out = out.slice(0, item.startOffset) + replacement + out.slice(item.endOffset);
  }
  return out;
}

type LedgerStage = "validated" | "pushed" | "replied";
interface LedgerEntry { operationId: string; commentId: string; engine: Engine; outcome: "changed" | "no-op"; changedSpan: string; recordedAt: string; stage: LedgerStage }
function storageBase(): string { return process.env.CONTENT_AGENTS_HOME?.trim() || join(homedir(), ".content-agents"); }
function ledgerPath(series: string, chapter: number, root?: string): string { return join(resolve(root ?? storageBase()), "fiction-review", `${series}-chapter-${pad2(chapter)}.json`); }
function readLedger(series: string, chapter: number, root?: string): LedgerEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(ledgerPath(series, chapter, root), "utf8"));
    return Array.isArray(parsed) ? (parsed as Array<LedgerEntry & { stage?: LedgerStage }>).map((entry) => ({ ...entry, stage: entry.stage ?? "replied" })) : [];
  } catch { return []; }
}
function upsertLedger(series: string, chapter: number, entries: LedgerEntry[], root?: string): void {
  if (!entries.length) return;
  const path = ledgerPath(series, chapter, root);
  withFileLock(`${path}.lock`, () => {
    const existing = readLedger(series, chapter, root);
    const merged = new Map(existing.map((entry) => [entry.operationId, entry]));
    for (const entry of entries) merged.set(entry.operationId, entry);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify([...merged.values()], null, 2) + "\n", { mode: 0o600 });
    renameSync(tmp, path);
  });
}

export interface ProcessCommentsInput {
  series: string; chapter: number; repoRoot?: string; comments: ReviewComment[]; defaultEngine?: Engine; storageRoot?: string;
  run?: CommandRunner;
  validate: (series: string, chapter: number) => Promise<void>;
  revise: (span: string, instruction: string, engine: Engine) => Promise<string>;
  reply: (commentId: number | string, body: string) => Promise<void>;
}
export interface ProcessCommentsResult { processed: number; changed: number; blocked: boolean; skipped: number; blockReason?: string }

async function finishPersistedReview(
  input: ProcessCommentsInput,
  path: string,
  entries: LedgerEntry[],
  skipped: number,
  root: string,
  cwd: string,
): Promise<ProcessCommentsResult> {
  let current = entries;
  const needsPush = current.some((entry) => entry.outcome === "changed" && entry.stage === "validated");
  if (needsPush) {
    await input.validate(input.series, input.chapter);
    const run = input.run ?? ((command, args) => defaultRun(command, args, cwd));
    required(await run("git", ["add", "--", path]), "git add");
    const staged = await run("git", ["diff", "--cached", "--quiet", "--", path]);
    if (staged.code === 1) {
      required(await run("git", ["commit", "-m", `Revise ${input.series} chapter ${input.chapter} from Studio comments`]), "git commit");
    } else if (staged.code !== 0) {
      throw new Error(`git staged-diff check failed: ${staged.stderr.trim() || `exit ${staged.code}`}`);
    }
    required(await run("git", ["push"]), "git push");
  }
  current = current.map((entry) => entry.stage === "validated" ? { ...entry, stage: "pushed" as const } : entry);
  upsertLedger(input.series, input.chapter, current, root);
  for (const entry of current) {
    if (entry.stage !== "pushed") continue;
    const message = entry.outcome === "changed"
      ? `Changed the commented span using ${entry.engine}. New span: "${entry.changedSpan}". This thread was not auto-resolved.`
      : `No prose change made: your comment was treated as a keep/no-op. The span remains unchanged. Engine recorded as ${entry.engine}. This thread was not auto-resolved.`;
    await input.reply(entry.commentId, message);
    entry.stage = "replied";
    upsertLedger(input.series, input.chapter, [entry], root);
  }
  return { processed: current.length, changed: current.filter((entry) => entry.outcome === "changed").length, blocked: false, skipped };
}

/** Apply only unresolved, exact current spans. A blocked batch writes nothing to the chapter. */
export async function processChapterReviewComments(input: ProcessCommentsInput): Promise<ProcessCommentsResult> {
  const cwd = input.repoRoot ?? process.cwd();
  const root = input.storageRoot ?? storageBase();
  const path = expectedChapterPath(input.series, input.chapter);
  const abs = join(cwd, path);
  if (!existsSync(abs)) throw new Error(`chapter file is missing: ${path}`);
  const ledger = readLedger(input.series, input.chapter, root);
  const done = new Set(ledger.filter((entry) => entry.stage === "replied").map((entry) => String(entry.commentId)));
  const pending = ledger.filter((entry) => entry.stage !== "replied" && input.comments.some((comment) => String(comment.id) === entry.commentId && !comment.resolved));
  const skipped = input.comments.filter((comment) => done.has(String(comment.id))).length;
  if (pending.length) return finishPersistedReview(input, path, pending, skipped, root, cwd);
  const candidates = input.comments.filter((comment) => !comment.resolved && !done.has(String(comment.id)));
  if (!candidates.length) return { processed: 0, changed: 0, blocked: false, skipped };
  const raw = readFileSync(abs, "utf8");
  let prepared: PreparedComment[];
  try { prepared = prepareComments(raw, path, candidates, input.defaultEngine ?? "claude"); }
  catch (error) { return { processed: 0, changed: 0, blocked: true, skipped, blockReason: error instanceof Error ? error.message : String(error) }; }
  const replacements: CommentReplacement[] = [];
  const outcomes: LedgerEntry[] = [];
  for (const item of prepared) {
    if (item.noop) {
      outcomes.push({ operationId: `fiction:${input.series}:${input.chapter}:${item.comment.id}`, commentId: String(item.comment.id), engine: item.engine, outcome: "no-op", changedSpan: item.originalSpan, recordedAt: new Date().toISOString(), stage: "pushed" });
      continue;
    }
    const replacement = await input.revise(item.originalSpan, item.comment.body, item.engine);
    replacements.push({ startOffset: item.startOffset, endOffset: item.endOffset, replacement });
    outcomes.push({ operationId: `fiction:${input.series}:${input.chapter}:${item.comment.id}`, commentId: String(item.comment.id), engine: item.engine, outcome: "changed", changedSpan: oneSentencePerLine(replacement.trim()), recordedAt: new Date().toISOString(), stage: "validated" });
  }
  let modified = raw;
  try { if (replacements.length) modified = applyCommentReplacements(raw, replacements); }
  catch (error) { return { processed: 0, changed: 0, blocked: true, skipped, blockReason: error instanceof Error ? error.message : String(error) }; }
  if (modified !== raw) {
    writeFileSync(abs, modified);
    try { await input.validate(input.series, input.chapter); }
    catch (error) {
      writeFileSync(abs, raw);
      return { processed: 0, changed: 0, blocked: true, skipped, blockReason: error instanceof Error ? error.message : String(error) };
    }
  }
  // Record the validated content before any Git or GitHub operation. A later retry resumes this
  // exact result and cannot ask a model to rewrite the already-changed passage again.
  try { upsertLedger(input.series, input.chapter, outcomes, root); }
  catch (error) {
    if (modified !== raw) writeFileSync(abs, raw);
    throw error;
  }
  return finishPersistedReview(input, path, outcomes, skipped, root, cwd);
}

export async function validateStoryChapter(series: string, chapter: number, repoRoot = process.cwd(), run?: CommandRunner): Promise<void> {
  const execute = run ?? ((command, args) => defaultRun(command, args, repoRoot));
  required(await execute("npx", ["tsx", "src/fiction/validate.ts", series, "--chapter", String(chapter)]), "story validation");
}

/** Read-only helper for future engine adapters; no provider/API key is introduced here. */
export function buildRevisionSpawn(engine: Engine, prompt: string): { command: string; args: string[]; input?: string } {
  const built = buildEngineSpawn(engine, prompt, {
    timeoutMs: 120_000, sandbox: "read-only", permissionMode: null, tools: "",
  });
  if (engine === "grok") built.args.push(
    "--output-format", "json",
    "--system-prompt-override", GROK_FINAL_TEXT_SYSTEM_PROMPT,
    "--sandbox", "read-only",
    "--disable-web-search", "--no-subagents", "--verbatim",
  );
  return built;
}

export async function reviseSpanWithEngine(span: string, instruction: string, engine: Engine, repoRoot = process.cwd()): Promise<string> {
  const prompt = `Read .claude/skills/story/SKILL.md before acting. Revise only the exact commented fiction span below. Preserve the surrounding story and return only the replacement prose, with no headings or Markdown fences. No em dashes.\n\nEXACT SPAN:\n${span}\n\nEDITOR COMMENT:\n${instruction}`;
  const built = buildRevisionSpawn(engine, prompt);
  return new Promise((resolveOutput, reject) => {
    const child = spawn(built.command, built.args, { cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) reject(new Error(`${engine} CLI exited ${code}: ${stderr.slice(-500)}`));
      else {
        try { resolveOutput(extractEngineText(engine, stdout)); }
        catch (error) { reject(error); }
      }
    });
    child.stdin?.end(built.input ?? "");
  });
}
