import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyCommentReplacements,
  buildRevisionSpawn,
  createStoryDraftPr,
  listStoryReviewComments,
  parseEngineDirective,
  processChapterReviewComments,
  verifyStoryReviewPr,
  type ReviewComment,
  type CommandResult,
} from "./review-pr.js";

const ok = (stdout = ""): CommandResult => ({ code: 0, stdout, stderr: "" });
const fail = (stderr = "failed"): CommandResult => ({ code: 1, stdout: "", stderr });

test("engine directives are tolerant of brackets, default when absent, and fail closed when conflicting", () => {
  assert.equal(parseEngineDirective("[engine: grok]", "claude"), "grok");
  assert.equal(parseEngineDirective("[engine: ollama-gpt-oss]", "claude"), "ollama-gpt-oss");
  assert.equal(parseEngineDirective("please tighten this", "codex"), "codex");
  assert.equal(parseEngineDirective("[engine: grok] [engine: claude]", "claude"), null);
  assert.equal(parseEngineDirective("engine: unknown", "claude"), null);
});

test("Fiction revision adapters are read-only for every subscription CLI", () => {
  const claude = buildRevisionSpawn("claude", "private fiction");
  const grok = buildRevisionSpawn("grok", "private fiction");
  const codex = buildRevisionSpawn("codex", "private fiction");
  for (const built of [claude, grok]) {
    assert.equal(built.args.includes("acceptEdits"), false);
    assert.ok(built.args.some((value, index) => value === "--tools" && built.args[index + 1] === ""));
  }
  assert.ok(grok.args.some((value, index) => value === "--output-format" && grok.args[index + 1] === "json"));
  assert.ok(grok.args.some((value, index) => value === "--sandbox" && grok.args[index + 1] === "read-only"));
  assert.ok(grok.args.includes("--system-prompt-override"));
  assert.deepEqual(codex.args.slice(0, 3), ["exec", "--sandbox", "read-only"]);
});

test("replacements apply from the bottom so line shifts cannot retarget later comments", () => {
  const body = "first old.\nsecond old.\nthird old.";
  const out = applyCommentReplacements(body, [
    { startOffset: 0, endOffset: 10, replacement: "first new sentence.\nA second sentence." },
    { startOffset: 11, endOffset: 22, replacement: "second new." },
  ]);
  assert.match(out, /^first new sentence\.\nA second sentence\.\nsecond new\.\nthird old\.$/);
});

test("story PR creation preflights branch, dirty state, remote, and idempotent existing PR", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-pr-"));
  const seriesDir = join(root, "stories", "series");
  mkdirSync(join(seriesDir, "chapters"), { recursive: true });
  writeFileSync(join(seriesDir, "series.yaml"), "slug: series\ntitle: Series\n");
  writeFileSync(join(seriesDir, "chapters", "chapter-01.md"), "---\nseries: series\nchapter: 1\npov: Eli\nstatus: drafting\ntitle: Arrival\n---\n\nThe door opened.\n");
  const calls: string[][] = [];
  const run = async (_command: string, args: string[]): Promise<CommandResult> => {
    calls.push(args);
    if (args[0] === "status") return ok("?? stories/series/chapters/chapter-01.md\n");
    if (args[0] === "branch") return ok("main\n");
    if (args[0] === "remote") return ok("git@github.com:heymoosh/content-agents.git\n");
    if (args[0] === "show-ref") return fail("missing");
    if (args[0] === "pr" && args[1] === "list") return ok("[]");
    if (args[0] === "switch") return ok();
    if (args[0] === "add" || args[0] === "commit" || args[0] === "push") return ok();
    if (args[0] === "pr" && args[1] === "create") return ok("https://github.com/heymoosh/content-agents/pull/7\n");
    return ok();
  };
  const pr = await createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run });
  assert.equal(pr.branch, "story/series/chapter-01");
  assert.equal(pr.url, "https://github.com/heymoosh/content-agents/pull/7");
  assert.ok(calls.some((args) => args[0] === "switch" && args[1] === "-c"));
});

test("story PR creation permits only the expected landed chapter as the sole pending change", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-pr-landed-"));
  const chapter = "stories/series/chapters/chapter-01.md";
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  writeFileSync(join(root, chapter), "---\nseries: series\nchapter: 1\n---\n\nLanded prose.\n");
  const common = async (_command: string, args: string[]): Promise<CommandResult> => {
    if (args[0] === "status") return ok(`?? ${chapter}\n`);
    if (args[0] === "branch") return ok("main\n");
    if (args[0] === "remote") return ok("git@github.com:heymoosh/content-agents.git\n");
    if (args[0] === "show-ref") return fail("missing");
    if (args[0] === "pr" && args[1] === "list") return ok("[]");
    if (args[0] === "pr" && args[1] === "create") return ok("https://github.com/heymoosh/content-agents/pull/8\n");
    return ok();
  };
  const pr = await createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run: common });
  assert.equal(pr.number, 8);
  await assert.rejects(() => createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run: async (_command, args) => args[0] === "status" ? ok(`?? ${chapter}\n?? unrelated.md\n`) : common(_command, args) }), /only the landed chapter|dirty/i);
});

test("story PR creation fails closed on wrong branch, non-GitHub remote, command failure, and orphan branch", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-pr-guards-"));
  const chapter = "stories/series/chapters/chapter-01.md";
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  writeFileSync(join(root, chapter), "---\nseries: series\nchapter: 1\n---\n\nLanded prose.\n");
  const runWith = (branch: string, remote: string, failure?: string) => async (_command: string, args: string[]): Promise<CommandResult> => {
    if (args[0] === "status") return ok(`?? ${chapter}\n`);
    if (args[0] === "branch") return ok(`${branch}\n`);
    if (args[0] === "remote") return ok(`${remote}\n`);
    if (args[0] === "show-ref") return failure === "orphan" ? ok() : fail("missing");
    if (args[0] === "pr" && args[1] === "list") return failure === "list" ? fail("permission denied") : ok("[]");
    return ok();
  };
  await assert.rejects(() => createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run: runWith("feature/work", "git@github.com:heymoosh/content-agents.git") }), /must start from main/);
  await assert.rejects(() => createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run: runWith("main", "git@gitlab.com:heymoosh/content-agents.git") }), /not a GitHub/);
  await assert.rejects(() => createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run: runWith("main", "git@github.com:heymoosh/content-agents.git", "list") }), /gh pr list failed/);
  await assert.rejects(() => createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run: runWith("main", "git@github.com:heymoosh/content-agents.git", "orphan") }), /already exists/);
});

test("story PR creation returns an existing matching PR without creating another", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-pr-existing-"));
  const chapter = "stories/series/chapters/chapter-01.md";
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  writeFileSync(join(root, chapter), "---\nseries: series\nchapter: 1\n---\n\nLanded prose.\n");
  const calls: string[][] = [];
  const run = async (_command: string, args: string[]): Promise<CommandResult> => {
    calls.push(args);
    if (args[0] === "status") return ok(`?? ${chapter}\n`);
    if (args[0] === "branch") return ok("main\n");
    if (args[0] === "remote") return ok("git@github.com:heymoosh/content-agents.git\n");
    if (args[0] === "pr" && args[1] === "list") return ok(JSON.stringify([{ number: 44, url: "https://github.com/heymoosh/content-agents/pull/44", title: "existing", isDraft: true, headRefName: "story/series/chapter-01" }]));
    return ok();
  };
  const pr = await createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run });
  assert.equal(pr.number, 44);
  assert.equal(calls.some((args) => args[0] === "switch"), false);
});

test("story PR creation returns the existing PR even from its clean story branch", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-pr-existing-branch-"));
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  writeFileSync(join(root, "stories", "series", "chapters", "chapter-01.md"), "---\ntitle: Arrival\n---\n\nLine.\n");
  const calls: string[][] = [];
  const run = async (_command: string, args: string[]): Promise<CommandResult> => {
    calls.push(args);
    if (args[0] === "remote") return ok("git@github.com:heymoosh/content-agents.git\n");
    if (args[0] === "pr" && args[1] === "list") return ok('[{"number":7,"url":"https://github.com/heymoosh/content-agents/pull/7","isDraft":true,"headRefName":"story/series/chapter-01"}]');
    if (args[0] === "status") return ok("");
    if (args[0] === "branch") return ok("story/series/chapter-01\n");
    return fail("must not mutate");
  };
  const pr = await createStoryDraftPr({ series: "series", chapter: 1, repoRoot: root, run });
  assert.equal(pr.number, 7);
  assert.equal(calls.some((args) => ["switch", "add", "commit", "push"].includes(args[0])), false);
});

test("review execution verifies clean expected branch and matching open PR", async () => {
  const responses = new Map<string, CommandResult>([
    ["branch", ok("story/series/chapter-01\n")],
    ["status", ok("")],
    ["remote", ok("git@github.com:heymoosh/content-agents.git\n")],
    ["rev-parse", ok("abc123\n")],
    ["pr", ok('{"number":7,"state":"OPEN","isDraft":true,"headRefName":"story/series/chapter-01","headRefOid":"abc123","baseRefName":"main","url":"https://github.com/heymoosh/content-agents/pull/7"}')],
  ]);
  const run = async (_command: string, args: string[]) => responses.get(args[0]) ?? fail("unexpected");
  await assert.doesNotReject(() => verifyStoryReviewPr({ series: "series", chapter: 1, prNumber: 7, run }));
  responses.set("pr", ok('{"number":8,"state":"OPEN","isDraft":true,"headRefName":"feature/wrong","headRefOid":"abc123","baseRefName":"main","url":"https://github.com/heymoosh/content-agents/pull/8"}'));
  await assert.rejects(() => verifyStoryReviewPr({ series: "series", chapter: 1, prNumber: 8, run }), /does not review.*story\/series\/chapter-01/i);
  responses.set("pr", ok('{"number":7,"state":"OPEN","isDraft":true,"headRefName":"story/series/chapter-01","headRefOid":"different","baseRefName":"main","url":"https://github.com/heymoosh/content-agents/pull/7"}'));
  await assert.rejects(() => verifyStoryReviewPr({ series: "series", chapter: 1, prNumber: 7, run }), /local HEAD.*pull request head/i);
});

test("review processing preserves frontmatter and unrelated bytes, replies without resolving, and is idempotent", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-comments-"));
  const seriesDir = join(root, "stories", "series");
  mkdirSync(join(seriesDir, "chapters"), { recursive: true });
  writeFileSync(join(seriesDir, "series.yaml"), "slug: series\nchapter:\n  min_words: 0\n");
  const raw = "---\nseries: series\nchapter: 1\npov: Eli\nstatus: drafting\n---\n\nFirst old.\nSecond old.\nThird stays.\n";
  const path = join(seriesDir, "chapters", "chapter-01.md");
  writeFileSync(path, raw);
  const comments: ReviewComment[] = [
    { id: 10, path: "stories/series/chapters/chapter-01.md", start_line: 8, line: 8, body: "Make it sharper. [engine: grok]" },
    { id: 11, path: "stories/series/chapters/chapter-01.md", start_line: 9, line: 9, body: "Keep this. [engine: claude]" },
  ];
  const replies: string[] = [];
  const commands: string[][] = [];
  const run = async (_command: string, args: string[]): Promise<CommandResult> => {
    commands.push(args);
    if (args[0] === "add" || args[0] === "commit" || args[0] === "push") return ok();
    return ok();
  };
  const first = await processChapterReviewComments({ series: "series", chapter: 1, repoRoot: root, comments, run, validate: async () => {} , revise: async (span, instruction, engine) => `${span} Better.`, reply: async (_id, body) => { replies.push(body); }, storageRoot: root });
  assert.equal(first.changed, 1);
  assert.equal(first.processed, 2);
  assert.equal(replies.length, 2);
  assert.match(replies[0], /grok/);
  assert.match(replies[0], /Better/);
  assert.match(replies[1], /no change|keep/i);
  assert.ok(readFileSync(path, "utf8").startsWith("---\nseries: series\n"));
  assert.match(readFileSync(path, "utf8"), /Second old\./);
  assert.match(readFileSync(path, "utf8"), /Third stays\./);
  assert.equal((await processChapterReviewComments({ series: "series", chapter: 1, repoRoot: root, comments, run, validate: async () => {}, revise: async () => "unused", reply: async () => { throw new Error("must not reply twice"); }, storageRoot: root })).processed, 0);
  assert.ok(commands.some((args) => args[0] === "push"));
});

test("a GitHub reply failure cannot cause the same model edit to run twice", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-comments-reply-failure-"));
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  const path = join(root, "stories", "series", "chapters", "chapter-01.md");
  writeFileSync(path, "---\nseries: series\nchapter: 1\n---\n\nOriginal line.\n");
  const comments: ReviewComment[] = [{ id: 44, path: "stories/series/chapters/chapter-01.md", line: 6, body: "Sharpen it" }];
  let revisions = 0;
  await assert.rejects(() => processChapterReviewComments({
    series: "series", chapter: 1, repoRoot: root, comments, storageRoot: root,
    run: async () => ok(), validate: async () => {}, revise: async () => { revisions++; return "Sharper line."; },
    reply: async () => { throw new Error("GitHub unavailable"); },
  }), /GitHub unavailable/);
  const retry = await processChapterReviewComments({
    series: "series", chapter: 1, repoRoot: root, comments, storageRoot: root,
    run: async () => ok(), validate: async () => {}, revise: async () => { revisions++; return "Must not run."; }, reply: async () => {},
  });
  assert.equal(revisions, 1);
  assert.equal(retry.processed, 1);
  assert.match(readFileSync(path, "utf8"), /Sharper line/);
});

test("a Git commit or push failure resumes the persisted edit without invoking the model again", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-comments-git-failure-"));
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  const path = join(root, "stories", "series", "chapters", "chapter-01.md");
  writeFileSync(path, "---\nseries: series\nchapter: 1\n---\n\nOriginal line.\n");
  const comments: ReviewComment[] = [{ id: 55, path: "stories/series/chapters/chapter-01.md", line: 6, body: "Sharpen it" }];
  let revisions = 0;
  const failingRun = async (_command: string, args: string[]) => {
    if (args[0] === "diff") return fail("staged change");
    if (args[0] === "commit") return fail("disk full");
    return ok();
  };
  await assert.rejects(() => processChapterReviewComments({
    series: "series", chapter: 1, repoRoot: root, comments, storageRoot: root,
    run: failingRun, validate: async () => {}, revise: async () => { revisions++; return "Sharper line."; }, reply: async () => {},
  }), /git commit failed/i);
  const commands: string[] = [];
  const retry = await processChapterReviewComments({
    series: "series", chapter: 1, repoRoot: root, comments, storageRoot: root,
    run: async (_command, args) => { commands.push(args[0]); return args[0] === "diff" ? fail("staged change") : ok(); },
    validate: async () => {}, revise: async () => { revisions++; return "Must not run."; }, reply: async () => {},
  });
  assert.equal(revisions, 1);
  assert.equal(retry.processed, 1);
  assert.ok(commands.includes("commit"));
  assert.ok(commands.includes("push"));
  assert.match(readFileSync(path, "utf8"), /Sharper line/);
});

test("malformed or outdated spans block before any write, validation, push, or reply", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-comments-blocked-"));
  const seriesDir = join(root, "stories", "series");
  mkdirSync(join(seriesDir, "chapters"), { recursive: true });
  writeFileSync(join(seriesDir, "series.yaml"), "slug: series\n");
  const path = join(seriesDir, "chapters", "chapter-01.md");
  const raw = "---\nseries: series\nchapter: 1\npov: Eli\nstatus: drafting\n---\n\nOnly line.\n";
  writeFileSync(path, raw);
  let writes = 0; let replies = 0;
  const result = await processChapterReviewComments({ series: "series", chapter: 1, repoRoot: root, comments: [{ id: 1, path: "stories/series/chapters/chapter-01.md", line: 99, body: "change" }], run: async () => { writes++; return ok(); }, validate: async () => { writes++; }, revise: async () => "bad", reply: async () => { replies++; }, storageRoot: root });
  assert.equal(result.blocked, true);
  assert.match(result.blockReason ?? "", /outdated|invalid line range/i);
  assert.equal(readFileSync(path, "utf8"), raw);
  assert.equal(writes, 0);
  assert.equal(replies, 0);
});

test("GPT-OSS remains read-only even when explicitly named in a review comment", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-comments-ollama-"));
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  writeFileSync(join(root, "stories", "series", "series.yaml"), "slug: series\n");
  const path = join(root, "stories", "series", "chapters", "chapter-01.md");
  const raw = "---\nseries: series\nchapter: 1\n---\n\nOriginal line.\n";
  writeFileSync(path, raw);
  const result = await processChapterReviewComments({
    series: "series", chapter: 1, repoRoot: root,
    comments: [{ id: 3, path: "stories/series/chapters/chapter-01.md", line: 6, body: "Change it [engine: ollama-gpt-oss]" }],
    storageRoot: root, run: async () => ok(), validate: async () => {}, revise: async () => "Changed", reply: async () => {},
  });
  assert.equal(result.blocked, true);
  assert.equal(readFileSync(path, "utf8"), raw);
});

test("validation failure restores the original chapter bytes", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-comments-restore-"));
  mkdirSync(join(root, "stories", "series", "chapters"), { recursive: true });
  writeFileSync(join(root, "stories", "series", "series.yaml"), "slug: series\n");
  const path = join(root, "stories", "series", "chapters", "chapter-01.md");
  const raw = "---\nseries: series\nchapter: 1\npov: Eli\nstatus: drafting\n---\n\nOriginal line.\n";
  writeFileSync(path, raw);
  const result = await processChapterReviewComments({
    series: "series", chapter: 1, repoRoot: root,
    comments: [{ id: 2, path: "stories/series/chapters/chapter-01.md", line: 8, body: "Change it" }],
    storageRoot: root, run: async () => ok(), validate: async () => { throw new Error("invalid"); },
    revise: async () => "Changed line.", reply: async () => { throw new Error("must not reply"); },
  });
  assert.equal(result.blocked, true);
  assert.equal(readFileSync(path, "utf8"), raw);
});

test("unresolved review threads contribute only their root comment", async () => {
  const run = async (_command: string, args: string[]): Promise<CommandResult> => {
    if (args[0] === "remote") return ok("git@github.com:heymoosh/content-agents.git\n");
    return ok(JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [
      { isResolved: false, comments: { nodes: [
        { databaseId: 21, body: "root", path: "stories/series/chapters/chapter-01.md", line: 8, startLine: 8 },
        { databaseId: 22, body: "reply", path: "stories/series/chapters/chapter-01.md", line: 8, startLine: 8 },
      ] } },
      { isResolved: true, comments: { nodes: [{ databaseId: 23, body: "resolved", path: "x", line: 1, startLine: 1 }] } },
    ] } } } } }));
  };
  const comments = await listStoryReviewComments(9, "/tmp/repo", run);
  assert.deepEqual(comments.map((comment) => comment.id), [21]);
});
