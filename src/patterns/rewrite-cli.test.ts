import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { CREATOR_CONTENT_DIR } from "./creator-content-normalization.js";
import { HOOK_FRAME_BANK } from "./hook-frame-cli.js";
import { MECHANISM_PROPOSALS, REWRITE_PROMPT } from "./rewrite-brief.js";
import { parseRewriteArgs, runRewriteCli, type RewriteCliIo, type RewriteCliOptions } from "./rewrite-cli.js";

// Synthetic fixtures only. Nothing below is the real corpus, the real frame bank, the real proposal
// file or the real stored prompt, and no model is ever called: `analyze` is injected.

// ---------------------------------------------------------------------------
// parseRewriteArgs
// ---------------------------------------------------------------------------

test("parseRewriteArgs requires a draft", () => {
  assert.throws(() => parseRewriteArgs([]), /usage: rewrite-cli --draft/);
});

test("parseRewriteArgs defaults to grok and a first pass without patterns", () => {
  const options = parseRewriteArgs(["--draft", "post.md"]);
  assert.equal(options.draft, "post.md");
  assert.equal(options.engine, "grok-cli");
  assert.equal(options.withPatterns, false);
  assert.equal(options.briefOnly, false);
  assert.equal(options.root, ".");
});

test("parseRewriteArgs reads the flags", () => {
  const options = parseRewriteArgs([
    "--draft", "post.md", "--platform", "linkedin", "--engine", "gpt-codex",
    "--patterns", "--brief-only", "--out", "out.md", "--root", "/somewhere",
  ]);
  assert.equal(options.platform, "linkedin");
  assert.equal(options.engine, "gpt-codex");
  assert.equal(options.withPatterns, true);
  assert.equal(options.briefOnly, true);
  assert.equal(options.out, "out.md");
  assert.equal(options.root, "/somewhere");
});

test("parseRewriteArgs will not accept Claude as the engine", () => {
  assert.throws(() => parseRewriteArgs(["--draft", "post.md", "--engine", "claude"]), /--engine must be one of grok-cli, gpt-codex/);
});

test("parseRewriteArgs rejects an unsupported platform and an unknown flag", () => {
  assert.throws(() => parseRewriteArgs(["--draft", "post.md", "--platform", "myspace"]), /--platform myspace is unsupported/);
  assert.throws(() => parseRewriteArgs(["--draft", "post.md", "--bogus"]), /unknown argument: --bogus/);
  assert.throws(() => parseRewriteArgs(["--draft"]), /--draft requires a value/);
});

// ---------------------------------------------------------------------------
// runRewriteCli, over a fully injected io
// ---------------------------------------------------------------------------

const CREATOR_A = "creator-a.md";
const CREATOR_B = "creator-b.md";
const DRAFT_PATH = "content/example/derivatives/linkedin-1.md";

function creatorMarkdown(handle: string, platform: string, topic: string, subject: string): string {
  return [
    `**Handle:** @${handle}`,
    `**Primary platform:** ${platform}`,
    "**Primary media type:** Text",
    "**Audience size:** 5K",
    `**Topic(s):** ${topic}`,
    "**Capture method:** manual capture",
    "**Posts captured:** 2/2",
    "",
    "## Posts",
    "",
    `### 1. Post One (2025-01-01) [link](https://example.test/${handle}/1)`,
    "**Metrics:** 40 likes",
    "",
    "**Opening hook (verbatim):**",
    `> Nobody warns you that ${subject} changes the moment you ship, entry one about ${topic}.`,
    "",
    `### 2. Post Two (2025-01-02) [link](https://example.test/${handle}/2)`,
    "**Metrics:** 55 likes",
    "",
    "**Opening hook (verbatim):**",
    `> Synthetic opening line about ${topic} for entry two.`,
    "",
  ].join("\n");
}

const BANK = `${JSON.stringify({
  id: "hook:consistent",
  name: "Consistent test frame",
  template: "Nobody warns you that {topic} changes the moment you {action}.",
  slots: ["topic", "action"],
  whenToUse: "When introducing a shift in how a habit works.",
  platforms: ["bluesky", "linkedin"],
  topics: ["careers", "building"],
  support: { instances: 2, distinctCreatorFiles: 2, rankedInstances: 0, topQuartileInstances: 0 },
  sourceRefs: [`${CREATOR_A}#entry-1-1`, `${CREATOR_B}#entry-1-1`],
  review: "pending",
  originality: "pending",
  adaptationNote: "Use your own topic and action; never borrow a creator's phrasing.",
})}\n`;

const PROPOSALS = `${JSON.stringify({
  proposal_id: "prop-001",
  family: "structure",
  name: "Claim then proof",
  mechanism: "Lead on the claim, then earn it.",
  platforms: ["linkedin"],
  evidence_status: "observational",
  support: { entries: 12, distinct_creator_files: 5 },
  evidence_limitations: ["no control group"],
})}\n`;

const PROMPT = ["## base", "", "Make this post perform better.", "", "## patterns", "", "Shapes, not sentences.", ""].join("\n");

const DRAFT = ["---", "platform: linkedin", "---", "", "My own draft body, in my own words.", ""].join("\n");

interface Harness {
  readonly io: RewriteCliIo;
  readonly output: string[];
  readonly errors: string[];
  readonly written: Map<string, string>;
  readonly prompts: string[];
}

function makeIo(answer: string, draft = DRAFT): Harness {
  const output: string[] = [];
  const errors: string[] = [];
  const written = new Map<string, string>();
  const prompts: string[] = [];
  const corpusDir = join(".", CREATOR_CONTENT_DIR);
  const files: Record<string, string> = {
    [CREATOR_A]: creatorMarkdown("creatora", "LinkedIn", "careers", "pricing"),
    [CREATOR_B]: creatorMarkdown("creatorb", "Bluesky", "building", "scope"),
  };
  const io: RewriteCliIo = {
    readFile: (path) => {
      if (path === DRAFT_PATH) return draft;
      if (path === join(".", HOOK_FRAME_BANK)) return BANK;
      if (path === join(".", MECHANISM_PROPOSALS)) return PROPOSALS;
      if (path === join(".", REWRITE_PROMPT)) return PROMPT;
      const name = path.slice(corpusDir.length + 1);
      if (files[name] !== undefined) return files[name]!;
      throw new Error(`unexpected readFile: ${path}`);
    },
    listDir: (path) => {
      if (path !== corpusDir) throw new Error(`unexpected listDir: ${path}`);
      return Object.keys(files);
    },
    writeFile: (path, value) => { written.set(path, value); },
    write: (value) => { output.push(value); },
    error: (value) => { errors.push(value); },
    analyze: async (_engine, prompt) => {
      prompts.push(prompt);
      return { text: answer, costUsd: 0.09, engine: "grok-cli" };
    },
  };
  return { io, output, errors, written, prompts };
}

function options(overrides: Partial<RewriteCliOptions> = {}): RewriteCliOptions {
  return { draft: DRAFT_PATH, root: ".", engine: "grok-cli", briefOnly: false, withPatterns: false, ...overrides };
}

const ANSWER = ["## Rewritten post", "", "A sharper version.", "", "## What changed", "", "- Led on the claim.", "", "## Blanks to fill", "", "none"].join("\n");

test("runRewriteCli takes the platform from the draft's own frontmatter", async () => {
  const harness = makeIo(ANSWER);
  assert.equal(await runRewriteCli(options(), harness.io), 0);
  assert.match(harness.output.join(""), /platform: linkedin/);
});

test("runRewriteCli refuses rather than guessing when no platform is declared", async () => {
  const harness = makeIo(ANSWER, "No frontmatter here.\n");
  assert.equal(await runRewriteCli(options(), harness.io), 1);
  assert.match(harness.errors.join(""), /rewrite needs a platform/);
  assert.equal(harness.prompts.length, 0);
});

test("runRewriteCli spends nothing on --brief-only", async () => {
  const harness = makeIo(ANSWER);
  assert.equal(await runRewriteCli(options({ briefOnly: true }), harness.io), 0);
  assert.equal(harness.prompts.length, 0);
  assert.equal(harness.written.size, 0);
  assert.match(harness.output.join(""), /Make this post perform better\./);
});

test("runRewriteCli keeps the corpus out of a first pass and puts it in an iteration", async () => {
  const first = makeIo(ANSWER);
  await runRewriteCli(options(), first.io);
  assert.doesNotMatch(first.prompts[0]!, /OPENING SHAPES:/);
  assert.match(first.output.join(""), /patterns: not included/);

  const second = makeIo(ANSWER);
  await runRewriteCli(options({ withPatterns: true }), second.io);
  assert.match(second.prompts[0]!, /OPENING SHAPES:/);
  assert.match(second.prompts[0]!, /hook:consistent/);
  assert.match(second.prompts[0]!, /prop-001/);
  assert.match(second.output.join(""), /patterns offered: 1 opening shapes, 1 structural patterns/);
});

test("runRewriteCli offers a pending frame, since merging code is not approving frame content", async () => {
  const harness = makeIo(ANSWER);
  await runRewriteCli(options({ withPatterns: true }), harness.io);
  assert.match(harness.prompts[0]!, /hook:consistent/);
});

test("runRewriteCli drops the narration a model runs ahead of the first heading", async () => {
  const harness = makeIo(`Let me read the repo first.I'll check the voice rules.${ANSWER}`);
  await runRewriteCli(options(), harness.io);
  const file = harness.written.get(`content/example/derivatives/linkedin-1.rewrite.md`)!;
  assert.doesNotMatch(file, /Let me read the repo first/);
  assert.match(file, /## Rewritten post/);
});

test("runRewriteCli records the engine, the cost and a pending review status", async () => {
  const harness = makeIo(ANSWER);
  await runRewriteCli(options(), harness.io);
  const file = harness.written.get("content/example/derivatives/linkedin-1.rewrite.md")!;
  assert.match(file, /^source_draft: content\/example\/derivatives\/linkedin-1\.md$/m);
  assert.match(file, /^engine: grok-cli$/m);
  assert.match(file, /^cost_usd: 0\.0900$/m);
  assert.match(file, /^voice_findings: 0$/m);
  assert.match(file, /^review_status: pending$/m);
  assert.equal(harness.written.has(DRAFT_PATH), false);
});

test("runRewriteCli flags an em dash and the AI tells rather than trusting the prompt", async () => {
  const harness = makeIo(ANSWER.replace("A sharper version.", "A sharper version — here's the thing, let me delve in."));
  await runRewriteCli(options(), harness.io);
  const file = harness.written.get("content/example/derivatives/linkedin-1.rewrite.md")!;
  assert.match(file, /^voice_findings: 3$/m);
  assert.match(file, /em dash/);
  assert.match(harness.output.join(""), /voice findings: 3/);
});

test("runRewriteCli writes where --out says", async () => {
  const harness = makeIo(ANSWER);
  await runRewriteCli(options({ out: "somewhere/else.md" }), harness.io);
  assert.equal(harness.written.has("somewhere/else.md"), true);
});
