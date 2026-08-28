// Make this post perform better.
//
//   npm run patterns:rewrite -- --draft <path> [--engine grok-cli|gpt-codex] [--patterns]
//
// One command over a stored, editable prompt (config/rewrite-prompt.md). The first pass is just that
// prompt and the draft, because a capable model restructures prose unaided. Pass --patterns when the
// first pass is not enough and the corpus inventory should be on the table too. That is the
// iteration lever, not the opening move.
//
// Writes a proposal file. The draft is never touched and nothing publishes.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { CREATOR_CONTENT_DIR, parseCreatorFile } from "./creator-content-normalization.js";
import { buildCorpusRanking, corpusRunIndex } from "./hook-frame-corpus.js";
import { VERBATIM_RUN_WORDS, readHookFrameLibrary } from "./hook-frame-library.js";
import { HOOK_FRAME_BANK } from "./hook-frame-cli.js";
import { MECHANISM_PROPOSALS, REWRITE_PROMPT, assembleBrief, parseStoredPrompt, readMechanismProposals, scopeProposals } from "./rewrite-brief.js";
import { PLATFORMS, type Platform } from "./types.js";

export const REWRITE_CLI_VERSION = "rewrite-cli-v1" as const;

/** Claude is deliberately absent. See getAnalystNamed in the provider registry for why. */
export const REWRITE_ENGINES = ["grok-cli", "gpt-codex"] as const;
export type RewriteEngine = (typeof REWRITE_ENGINES)[number];

export interface RewriteCliOptions {
  readonly draft: string;
  readonly root: string;
  readonly platform?: Platform;
  readonly engine: RewriteEngine;
  /** Print the brief and stop, without spending anything on a model call. */
  readonly briefOnly: boolean;
  /** Append the corpus inventory. Off by default; this is the iteration lever. */
  readonly withPatterns: boolean;
  readonly out?: string;
}

export interface RewriteCliIo {
  readonly readFile: (path: string) => string;
  readonly listDir: (path: string) => readonly string[];
  readonly writeFile: (path: string, value: string) => void;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
  readonly analyze?: (engine: RewriteEngine, prompt: string) => Promise<{ text: string; costUsd: number; engine: string }>;
}

function fail(message: string): never {
  throw new Error(message);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseRewriteArgs(argv: readonly string[]): RewriteCliOptions {
  let draft: string | undefined;
  let root = ".";
  let platform: Platform | undefined;
  let engine: RewriteEngine = "grok-cli";
  let briefOnly = false;
  let withPatterns = false;
  let out: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--draft") {
      draft = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--root") {
      root = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--platform") {
      const value = optionValue(argv, index, argument);
      if (!(PLATFORMS as readonly string[]).includes(value)) fail(`--platform ${value} is unsupported`);
      platform = value as Platform;
      index += 1;
    } else if (argument === "--engine") {
      const value = optionValue(argv, index, argument);
      if (!(REWRITE_ENGINES as readonly string[]).includes(value)) {
        fail(`--engine must be one of ${REWRITE_ENGINES.join(", ")}. Claude is not offered: it stays too close to the draft and loses the argument.`);
      }
      engine = value as RewriteEngine;
      index += 1;
    } else if (argument === "--brief-only") {
      briefOnly = true;
    } else if (argument === "--patterns") {
      withPatterns = true;
    } else if (argument === "--out") {
      out = optionValue(argv, index, argument);
      index += 1;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  if (draft === undefined) fail("usage: rewrite-cli --draft <path> [--platform x] [--engine grok-cli|gpt-codex] [--patterns] [--brief-only] [--out <path>]");
  return { draft, root, engine, briefOnly, withPatterns, ...(platform === undefined ? {} : { platform }), ...(out === undefined ? {} : { out }) };
}

export async function runRewriteCli(options: RewriteCliOptions, io: RewriteCliIo): Promise<number> {
  const draft = io.readFile(options.draft);
  const declared = /^platform:\s*([a-z-]+)\s*$/m.exec(draft)?.[1];
  const platform = options.platform ?? (declared !== undefined && (PLATFORMS as readonly string[]).includes(declared) ? (declared as Platform) : undefined);
  if (platform === undefined) {
    io.error?.("rewrite needs a platform: pass --platform, or give a draft whose frontmatter declares one\n");
    return 1;
  }

  const directory = join(options.root, CREATOR_CONTENT_DIR);
  const names = [...io.listDir(directory)].filter((name) => name.endsWith(".md")).sort();
  const rawTexts = names.map((name) => io.readFile(join(directory, name)));
  const files = names.map((name, index) => parseCreatorFile(name, rawTexts[index]!));
  const ranking = buildCorpusRanking(files);
  const runIndex = corpusRunIndex(rawTexts, VERBATIM_RUN_WORDS);
  const library = readHookFrameLibrary(io.readFile(join(options.root, HOOK_FRAME_BANK)), {
    creatorNames: files.map((file) => file.creatorSlug.replace(/-/g, " ")),
    handles: files.map((file) => file.header.handle ?? "").filter((handle) => handle.length > 0),
    corpusContainsRun: (words) => runIndex.has(words.join(" ")),
  });

  // Every frame in scope for the platform, review state included. Fit is the model's call now, not
  // a regex's, so nothing is filtered out on whether the draft already contains the material.
  const frames = library.frames.filter((frame) => frame.platforms.includes(platform) && frame.review !== "rejected" && frame.originality !== "failed");
  const proposals = scopeProposals(readMechanismProposals(io.readFile(join(options.root, MECHANISM_PROPOSALS))), platform);

  const brief = assembleBrief({
    draft,
    platform,
    prompt: parseStoredPrompt(io.readFile(join(options.root, REWRITE_PROMPT))),
    withPatterns: options.withPatterns,
    frames,
    proposals,
    baseRate: ranking.rankedEntries === 0 ? 0.25 : ranking.topQuartileEntries / ranking.rankedEntries,
  });

  io.write(
    `draft: ${options.draft}\nplatform: ${platform}\n` +
      (options.withPatterns
        ? `patterns offered: ${brief.openersOffered} opening shapes, ${brief.structuresOffered} structural patterns\n`
        : "patterns: not included. Re-run with --patterns for corpus shapes if this pass is not enough.\n"),
  );

  if (options.briefOnly) {
    io.write("\n--- brief ---\n");
    io.write(brief.prompt);
    io.write("\n");
    return 0;
  }

  const analyze = io.analyze;
  if (analyze === undefined) fail("no analyze function was supplied");
  io.write(`engine: ${options.engine}\nthinking...\n`);
  const result = await analyze(options.engine, brief.prompt);

  // Models narrate their plan before answering, and an agentic one will also think out loud
  // mid-answer. Anchor on the first requested heading and drop everything before it, so the file
  // opens on the rewrite rather than on someone's process.
  const body = result.text.trim();
  // Not anchored to line start: an agentic model runs its narration straight into the heading
  // with no newline between them.
  const firstHeading = body.indexOf("## Rewritten post");
  const sections = firstHeading > 0 ? body.slice(firstHeading) : body;

  // The brief bans em dashes and the obvious AI tells. Check rather than trust, and say so in the
  // file, because Muxin reads this before deciding what to take.
  const voiceFindings: string[] = [];
  if (/[—–]/.test(sections)) voiceFindings.push("contains an em dash or en dash, which is never her punctuation");
  if (/\bhere's the thing\b/i.test(sections)) voiceFindings.push('contains "here\'s the thing"');
  if (/\bdelve\b|\bit's not just .{0,40}, it's\b/i.test(sections)) voiceFindings.push("contains a common AI writing tell");

  const out = options.out ?? `${options.draft.replace(/\.md$/, "")}.rewrite.md`;
  const header = [
    "---",
    `source_draft: ${options.draft}`,
    `platform: ${platform}`,
    `engine: ${result.engine}`,
    `cost_usd: ${result.costUsd.toFixed(4)}`,
    `patterns_offered: ${options.withPatterns ? `${brief.openersOffered} openers, ${brief.structuresOffered} structures` : "none"}`,
    `voice_findings: ${voiceFindings.length}`,
    "review_status: pending",
    "---",
    "",
    "<!-- A proposal, not a replacement. Muxin's draft is untouched. Nothing here publishes. -->",
    ...(voiceFindings.length === 0 ? [] : ["", "> Voice check flagged this proposal:", ...voiceFindings.map((finding) => `> - ${finding}`)]),
    "",
  ].join("\n");
  io.writeFile(out, `${header}${sections}\n`);
  io.write(`\nwrote ${out}\ncost: $${result.costUsd.toFixed(4)}\n`);
  if (voiceFindings.length > 0) io.write(`voice findings: ${voiceFindings.length} (listed in the file)\n`);
  io.write("Your draft is untouched. Read the proposal and take what you want.\n");
  return 0;
}

/* c8 ignore start */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseRewriteArgs(process.argv.slice(2));
  const { getAnalystNamed } = await import("../providers/registry.js");
  const { logCost } = await import("../util/cost-log.js");
  const code = await runRewriteCli(options, {
    readFile: (path) => readFileSync(path, "utf8"),
    listDir: (path) => readdirSync(path),
    writeFile: (path, value) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, value, "utf8");
    },
    write: (value) => process.stdout.write(value),
    error: (value) => process.stderr.write(value),
    analyze: async (engine, prompt) => {
      const provider = await getAnalystNamed(engine);
      const result = await provider.analyze({ prompt });
      if (result.costUsd > 0) logCost({ step: "patterns:rewrite", detail: options.draft, costUsd: result.costUsd, engine: result.engine });
      return result;
    },
  });
  process.exitCode = code;
}
/* c8 ignore stop */
