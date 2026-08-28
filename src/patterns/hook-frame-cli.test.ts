import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { CREATOR_CONTENT_DIR } from "./creator-content-normalization.js";
import { HOOK_FRAME_BANK, parseHookFrameArgs, runHookFrameCli } from "./hook-frame-cli.js";
import type { HookFrameCliIo } from "./hook-frame-cli.js";

// Synthetic fixtures only. Nothing below is read from, or derived from, the real corpus under
// docs/content-studio-program/creator-content/, and none of it is the real config/hook-frames.jsonl.

// ---------------------------------------------------------------------------
// parseHookFrameArgs
// ---------------------------------------------------------------------------

test("parseHookFrameArgs parses each command", () => {
  assert.equal(parseHookFrameArgs(["verify"]).command, "verify");
  assert.equal(parseHookFrameArgs(["list", "--platform", "linkedin"]).command, "list");
  assert.equal(parseHookFrameArgs(["fill", "--frame", "hook:x"]).command, "fill");
});

test("parseHookFrameArgs defaults root to '.' and reads --root", () => {
  assert.equal(parseHookFrameArgs(["verify"]).root, ".");
  assert.equal(parseHookFrameArgs(["verify", "--root", "/tmp/some-corpus"]).root, "/tmp/some-corpus");
});

test("parseHookFrameArgs validates --platform", () => {
  assert.equal(parseHookFrameArgs(["list", "--platform", "linkedin"]).platform, "linkedin");
  assert.throws(() => parseHookFrameArgs(["list", "--platform", "not-a-platform"]), /--platform not-a-platform is unsupported/);
});

test("parseHookFrameArgs reads --topic", () => {
  assert.equal(parseHookFrameArgs(["list", "--platform", "linkedin", "--topic", "careers"]).topic, "careers");
  assert.equal(parseHookFrameArgs(["list", "--platform", "linkedin"]).topic, undefined);
});

test("parseHookFrameArgs sets includePending only when --include-pending is passed", () => {
  assert.equal(parseHookFrameArgs(["list", "--platform", "linkedin"]).includePending, false);
  assert.equal(parseHookFrameArgs(["list", "--platform", "linkedin", "--include-pending"]).includePending, true);
});

test("parseHookFrameArgs validates --limit", () => {
  assert.equal(parseHookFrameArgs(["list", "--platform", "linkedin", "--limit", "3"]).limit, 3);
  assert.throws(() => parseHookFrameArgs(["list", "--platform", "linkedin", "--limit", "0"]), /--limit must be a positive integer/);
  assert.throws(() => parseHookFrameArgs(["list", "--platform", "linkedin", "--limit", "1.5"]), /--limit must be a positive integer/);
  assert.throws(() => parseHookFrameArgs(["list", "--platform", "linkedin", "--limit", "nope"]), /--limit must be a positive integer/);
});

test("parseHookFrameArgs reads --frame", () => {
  assert.equal(parseHookFrameArgs(["fill", "--frame", "hook:contrast"]).frameId, "hook:contrast");
});

test("parseHookFrameArgs builds a material map from repeated --slot", () => {
  const options = parseHookFrameArgs([
    "fill", "--frame", "hook:x",
    "--slot", "topic=career pivots",
    "--slot", "detail=the messy part",
  ]);
  assert.deepEqual(options.material, { topic: "career pivots", detail: "the messy part" });
});

test("parseHookFrameArgs requires --slot to contain '='", () => {
  assert.throws(() => parseHookFrameArgs(["fill", "--frame", "hook:x", "--slot", "topic-no-equals"]), /--slot expects name=value/);
});

test("parseHookFrameArgs rejects an unknown argument", () => {
  assert.throws(() => parseHookFrameArgs(["verify", "--bogus"]), /unknown argument: --bogus/);
});

test("parseHookFrameArgs requires --platform for list", () => {
  assert.throws(() => parseHookFrameArgs(["list"]), /list requires --platform/);
});

test("parseHookFrameArgs requires --frame for fill", () => {
  assert.throws(() => parseHookFrameArgs(["fill"]), /fill requires --frame/);
});

test("parseHookFrameArgs rejects an unknown command", () => {
  assert.throws(() => parseHookFrameArgs(["bogus"]), /usage: hook-frame-cli <list\|verify\|fill>/);
});

// ---------------------------------------------------------------------------
// runHookFrameCli, over a fully injected io and a tiny synthetic corpus + bank
// ---------------------------------------------------------------------------

const CREATOR_A = "creator-a.md";
const CREATOR_B = "creator-b.md";

function creatorAMarkdown(): string {
  return [
    "**Handle:** @creatora",
    "**Primary platform:** LinkedIn",
    "**Primary media type:** Text",
    "**Audience size:** 5K",
    "**Topic(s):** careers",
    "**Capture method:** manual capture",
    "**Posts captured:** 3/3",
    "",
    "## Posts",
    "",
    "### 1. Post One (2025-01-01) [link](https://example.test/a/1)",
    "**Metrics:** 40 likes",
    "",
    "**Opening hook (verbatim):**",
    "> Synthetic opening line about careers for entry one.",
    "",
    "### 2. Post Two (2025-01-02) [link](https://example.test/a/2)",
    "**Metrics:** 55 likes",
    "",
    "**Opening hook (verbatim):**",
    "> Synthetic opening line about careers for entry two.",
    "",
    "### 3. Post Three (2025-01-03) [link](https://example.test/a/3)",
    "**Metrics:** 60 likes",
    "",
    "**Opening hook (verbatim):**",
    "> Synthetic opening line about careers for entry three.",
    "",
  ].join("\n");
}

function creatorBMarkdown(): string {
  return [
    "**Handle:** @creatorb",
    "**Primary platform:** Bluesky",
    "**Primary media type:** Text",
    "**Audience size:** 8K",
    "**Topic(s):** building",
    "**Capture method:** manual capture",
    "**Posts captured:** 2/2",
    "",
    "## Posts",
    "",
    "### 1. Note One (2025-02-01) [link](https://example.test/b/1)",
    "**Metrics:** 30 likes",
    "",
    "**Opening hook (verbatim):**",
    "> Synthetic opening line about building for entry one.",
    "",
    "### 2. Note Two (2025-02-02) [link](https://example.test/b/2)",
    "**Metrics:** 45 likes",
    "",
    "**Opening hook (verbatim):**",
    "> Synthetic opening line about building for entry two.",
    "",
  ].join("\n");
}

interface FakeIo {
  readonly io: HookFrameCliIo;
  readonly output: string[];
  readonly errors: string[];
}

/** A fully injected io over the two synthetic creator files above plus one supplied bank. */
function makeIo(bank: string): FakeIo {
  const output: string[] = [];
  const errors: string[] = [];
  const files: Record<string, string> = {
    [CREATOR_A]: creatorAMarkdown(),
    [CREATOR_B]: creatorBMarkdown(),
  };
  const corpusDir = join(".", CREATOR_CONTENT_DIR);
  const bankPath = join(".", HOOK_FRAME_BANK);
  const io: HookFrameCliIo = {
    readFile: (path) => {
      if (path === bankPath) return bank;
      const name = path.slice(corpusDir.length + 1);
      if (files[name] !== undefined) return files[name]!;
      throw new Error(`unexpected readFile: ${path}`);
    },
    listDir: (path) => {
      if (path !== corpusDir) throw new Error(`unexpected listDir: ${path}`);
      return Object.keys(files);
    },
    write: (value) => { output.push(value); },
    error: (value) => { errors.push(value); },
  };
  return { io, output, errors };
}

interface FrameRow {
  readonly id: string;
  readonly name: string;
  readonly template: string;
  readonly slots: readonly string[];
  readonly whenToUse: string;
  readonly platforms: readonly string[];
  readonly topics: readonly string[];
  readonly support: {
    readonly instances: number;
    readonly distinctCreatorFiles: number;
    readonly rankedInstances: number;
    readonly topQuartileInstances: number;
  };
  readonly sourceRefs: readonly string[];
  readonly review: string;
  readonly originality: string;
  readonly adaptationNote: string;
}

function frameLine(row: FrameRow): string {
  return `${JSON.stringify(row)}\n`;
}

// True for both creator-a.md and creator-b.md, since each file has fewer entries than
// MINIMUM_ENTRIES_FOR_RANKING (8): nothing in this corpus is ever ranked.
const consistentFrame: FrameRow = {
  id: "hook:consistent",
  name: "Consistent test frame",
  template: "Nobody warns you that {topic} changes the moment you {action}.",
  slots: ["topic", "action"],
  whenToUse: "When introducing a shift in how a skill or career habit works.",
  platforms: ["bluesky", "linkedin"],
  topics: ["careers", "building"],
  support: { instances: 2, distinctCreatorFiles: 2, rankedInstances: 0, topQuartileInstances: 0 },
  sourceRefs: ["creator-a.md#entry-1-1", "creator-b.md#entry-1-1"],
  review: "approved",
  originality: "passed",
  adaptationNote: "Use Muxin's own topic and action; never borrow a creator's specific phrasing.",
};

test("verify returns 0 and prints findings: 0 for a consistent bank", () => {
  const { io, output } = makeIo(frameLine(consistentFrame));
  const code = runHookFrameCli(parseHookFrameArgs(["verify"]), io);
  const text = output.join("");
  assert.equal(code, 0);
  assert.match(text, /findings: 0/);
  assert.doesNotMatch(text, /FINDING/);
});

test("verify returns 1 and prints a support-mismatch FINDING when the bank overstates instances", () => {
  const overstated: FrameRow = {
    ...consistentFrame,
    id: "hook:overstated",
    support: { ...consistentFrame.support, instances: 3 },
  };
  const { io, output } = makeIo(frameLine(overstated));
  const code = runHookFrameCli(parseHookFrameArgs(["verify"]), io);
  const text = output.join("");
  assert.equal(code, 1);
  assert.match(text, /FINDING hook:overstated: support-mismatch: instances claims 3, corpus says 2/);
});

test("verify returns 1 and prints an unresolved-ref FINDING for a ref matching no entry", () => {
  const unresolved: FrameRow = {
    ...consistentFrame,
    id: "hook:unresolved",
    sourceRefs: ["creator-a.md#entry-1-1", "creator-b.md#entry-1-1", "creator-a.md#entry-1-99"],
    support: { instances: 3, distinctCreatorFiles: 2, rankedInstances: 0, topQuartileInstances: 0 },
  };
  const { io, output } = makeIo(frameLine(unresolved));
  const code = runHookFrameCli(parseHookFrameArgs(["verify"]), io);
  const text = output.join("");
  assert.equal(code, 1);
  assert.match(text, /FINDING hook:unresolved: unresolved-ref: creator-a\.md#entry-1-99 matches no corpus entry/);
});

test("verify prints a platform-mismatch FINDING when refs cover a platform the frame does not list", () => {
  const platformMismatch: FrameRow = {
    ...consistentFrame,
    id: "hook:platform-mismatch",
    platforms: ["linkedin"], // omits bluesky, though a creator-b.md ref (platform bluesky) is cited
  };
  const { io, output } = makeIo(frameLine(platformMismatch));
  const code = runHookFrameCli(parseHookFrameArgs(["verify"]), io);
  const text = output.join("");
  assert.equal(code, 1);
  assert.match(text, /FINDING hook:platform-mismatch: platform-mismatch: refs include bluesky, which the frame does not list/);
  assert.match(text, /findings: 1/);
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

const approvedListFrame: FrameRow = { ...consistentFrame, id: "hook:list-approved" };
const pendingListFrame: FrameRow = {
  ...consistentFrame,
  id: "hook:list-pending",
  template: "The part nobody explains about {topic} is how it actually starts with {action}.",
  review: "pending",
};

test("list returns 0 and prints the frames for a platform; a pending frame needs --include-pending", () => {
  const bank = frameLine(approvedListFrame) + frameLine(pendingListFrame);

  const withoutPending = makeIo(bank);
  const code1 = runHookFrameCli(parseHookFrameArgs(["list", "--platform", "linkedin"]), withoutPending.io);
  const text1 = withoutPending.output.join("");
  assert.equal(code1, 0);
  assert.match(text1, /hook:list-approved/);
  assert.doesNotMatch(text1, /hook:list-pending/);

  const withPending = makeIo(bank);
  const code2 = runHookFrameCli(parseHookFrameArgs(["list", "--platform", "linkedin", "--include-pending"]), withPending.io);
  const text2 = withPending.output.join("");
  assert.equal(code2, 0);
  assert.match(text2, /hook:list-approved/);
  assert.match(text2, /hook:list-pending/);
});

test("list prints the 'no frames match' message when nothing matches", () => {
  const bank = frameLine(approvedListFrame);
  const { io, output } = makeIo(bank);
  // --limit is supplied to route around a module bug: selectFrames in hook-frame-library.ts
  // defaults an omitted `limit` to `rows.length`, and when zero frames match that default is 0,
  // which its own `limit < 1` check then rejects as invalid instead of returning an empty
  // selection. See the final report for this run for the full note.
  const code = runHookFrameCli(parseHookFrameArgs(["list", "--platform", "x", "--limit", "5"]), io);
  const text = output.join("");
  assert.equal(code, 0);
  assert.match(text, /no frames match\./);
});

test("list without --limit reports no match rather than failing on an empty result", () => {
  const bank = frameLine(approvedListFrame);
  const { io, output } = makeIo(bank);
  const code = runHookFrameCli(parseHookFrameArgs(["list", "--platform", "x"]), io);
  assert.equal(code, 0);
  assert.match(output.join(""), /no frames match/);
});

// ---------------------------------------------------------------------------
// fill
// ---------------------------------------------------------------------------

test("fill returns 0 and prints the filled text plus the frame id and source refs", () => {
  const { io, output } = makeIo(frameLine(consistentFrame));
  const options = parseHookFrameArgs([
    "fill", "--frame", "hook:consistent",
    "--slot", "topic=freelance pricing",
    "--slot", "action=raise your rate",
  ]);
  const code = runHookFrameCli(options, io);
  const text = output.join("");
  assert.equal(code, 0);
  assert.match(text, /Nobody warns you that freelance pricing changes the moment you raise your rate\./);
  assert.match(text, /frame: hook:consistent/);
  assert.match(text, /source refs: creator-a\.md#entry-1-1, creator-b\.md#entry-1-1/);
});

test("fill returns 1 for an unknown frame id", () => {
  const { io, errors } = makeIo(frameLine(consistentFrame));
  const code = runHookFrameCli(parseHookFrameArgs(["fill", "--frame", "hook:does-not-exist"]), io);
  assert.equal(code, 1);
  assert.match(errors.join(""), /no usable frame with id hook:does-not-exist/);
});

test("fill surfaces a voice finding (return 1) when supplied material contains an em dash", () => {
  const { io, output } = makeIo(frameLine(consistentFrame));
  // The em dash in the slot value below is intentional: it exercises fillFrame's own
  // em-dash detection, which is the one thing this test needs to prove.
  const options = parseHookFrameArgs([
    "fill", "--frame", "hook:consistent",
    "--slot", "topic=freelance pricing — finally",
    "--slot", "action=raise your rate",
  ]);
  const code = runHookFrameCli(options, io);
  const text = output.join("");
  assert.equal(code, 1);
  assert.match(text, /voice findings:/);
  assert.match(text, /em dash/);
});
