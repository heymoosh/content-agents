import { test } from "node:test";
import assert from "node:assert/strict";
import type { HookFrame } from "./hook-frame-library.js";
import {
  RewriteBriefError,
  assembleBrief,
  parseStoredPrompt,
  readMechanismProposals,
  scopeProposals,
  type MechanismProposal,
} from "./rewrite-brief.js";

// Synthetic fixtures only. Nothing here is read from the real corpus, the real frame bank or the
// real proposal file.

const PROMPT_MARKDOWN = [
  "# Rewrite prompt",
  "",
  "Prose above the sections is not sent.",
  "",
  "## base",
  "",
  "Make this post perform better.",
  "",
  "## patterns",
  "",
  "Shapes, not sentences to copy.",
  "",
].join("\n");

function frame(overrides: Partial<HookFrame> = {}): HookFrame {
  return {
    id: "hook:example",
    name: "Example",
    template: "Nobody warns you that {thing}",
    slots: ["thing"],
    whenToUse: "Use when the piece already names a surprise.",
    platforms: ["linkedin"],
    topics: ["careers"],
    support: { instances: 6, distinctCreatorFiles: 3, rankedInstances: 4, topQuartileInstances: 2 },
    sourceRefs: ["creator-a.md#entry-1-1", "creator-b.md#entry-1-1"],
    review: "pending",
    originality: "pending",
    adaptationNote: "Fill every slot from your own material.",
    ...overrides,
  } as HookFrame;
}

function proposal(overrides: Partial<MechanismProposal> = {}): MechanismProposal {
  return {
    proposal_id: "prop-001",
    family: "structure",
    name: "Claim then proof",
    mechanism: "Lead on the claim, then earn it.",
    platforms: ["linkedin"],
    evidence_status: "observational",
    support: { entries: 12, distinct_creator_files: 5 },
    evidence_limitations: ["no control group"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseStoredPrompt
// ---------------------------------------------------------------------------

test("parseStoredPrompt splits the always-sent base from the patterns half", () => {
  const parsed = parseStoredPrompt(PROMPT_MARKDOWN);
  assert.equal(parsed.base, "Make this post perform better.");
  assert.equal(parsed.patterns, "Shapes, not sentences to copy.");
});

test("parseStoredPrompt allows a prompt file with no patterns section", () => {
  assert.equal(parseStoredPrompt("## base\n\nJust the base.\n").patterns, "");
});

test("parseStoredPrompt refuses a prompt file with no base", () => {
  assert.throws(() => parseStoredPrompt("## patterns\n\nonly patterns\n"), RewriteBriefError);
});

// ---------------------------------------------------------------------------
// readMechanismProposals
// ---------------------------------------------------------------------------

test("readMechanismProposals reads rows and skips blank lines", () => {
  const jsonl = `${JSON.stringify(proposal())}\n\n${JSON.stringify(proposal({ proposal_id: "prop-002" }))}\n`;
  assert.deepEqual(readMechanismProposals(jsonl).map((row) => row.proposal_id), ["prop-001", "prop-002"]);
});

test("readMechanismProposals names the line that failed", () => {
  assert.throws(() => readMechanismProposals(`${JSON.stringify(proposal())}\n{broken\n`), /line 2 is not valid JSON/);
  assert.throws(() => readMechanismProposals('{"family":"structure"}\n'), /line 1 is missing proposal_id or mechanism/);
});

// ---------------------------------------------------------------------------
// scopeProposals
// ---------------------------------------------------------------------------

test("scopeProposals keeps structural families for the platform, sorted by id", () => {
  const rows = scopeProposals(
    [
      proposal({ proposal_id: "prop-009", family: "cta" }),
      proposal({ proposal_id: "prop-002", family: "hook" }),
      proposal({ proposal_id: "prop-003", family: "retention" }),
      proposal({ proposal_id: "prop-004", family: "structure", platforms: ["bluesky"] }),
    ],
    "linkedin",
  );
  assert.deepEqual(rows.map((row) => row.proposal_id), ["prop-003", "prop-009"]);
});

// ---------------------------------------------------------------------------
// assembleBrief
// ---------------------------------------------------------------------------

const BASE = parseStoredPrompt(PROMPT_MARKDOWN);

test("assembleBrief sends only the stored base and the draft on a first pass", () => {
  const brief = assembleBrief({
    draft: "My draft body.",
    platform: "linkedin",
    prompt: BASE,
    withPatterns: false,
    frames: [frame()],
    proposals: [proposal()],
    baseRate: 0.28,
  });
  assert.match(brief.prompt, /Make this post perform better\./);
  assert.match(brief.prompt, /MY DRAFT \(linkedin\):/);
  assert.doesNotMatch(brief.prompt, /OPENING SHAPES:/);
  assert.equal(brief.openersOffered, 0);
  assert.equal(brief.structuresOffered, 0);
});

test("assembleBrief appends the corpus inventory when patterns are asked for", () => {
  const brief = assembleBrief({
    draft: "My draft body.",
    platform: "linkedin",
    prompt: BASE,
    withPatterns: true,
    frames: [frame(), frame({ id: "hook:second" })],
    proposals: [proposal()],
    baseRate: 0.28,
  });
  assert.equal(brief.openersOffered, 2);
  assert.equal(brief.structuresOffered, 1);
  assert.match(brief.prompt, /OPENING SHAPES:/);
  assert.match(brief.prompt, /\[hook:second\]/);
  assert.match(brief.prompt, /2\/4 top-quartile/);
  assert.match(brief.prompt, /28% is the rate/);
});

test("assembleBrief says a frame is not ranked rather than dividing by zero", () => {
  const brief = assembleBrief({
    draft: "My draft body.",
    platform: "linkedin",
    prompt: BASE,
    withPatterns: true,
    frames: [frame({ support: { instances: 2, distinctCreatorFiles: 2, rankedInstances: 0, topQuartileInstances: 0 } })],
    proposals: [proposal()],
    baseRate: 0.28,
  });
  assert.match(brief.prompt, /not ranked/);
});

test("assembleBrief refuses an empty draft", () => {
  assert.throws(
    () => assembleBrief({ draft: "   ", platform: "linkedin", prompt: BASE, withPatterns: false, frames: [], proposals: [], baseRate: 0.28 }),
    /draft is empty/,
  );
});

test("assembleBrief refuses a patterns pass with nothing in scope", () => {
  assert.throws(
    () => assembleBrief({ draft: "body", platform: "linkedin", prompt: BASE, withPatterns: true, frames: [], proposals: [], baseRate: 0.28 }),
    /no patterns are in scope for linkedin/,
  );
});

test("assembleBrief refuses a patterns pass when the prompt file has no patterns half", () => {
  assert.throws(
    () => assembleBrief({
      draft: "body",
      platform: "linkedin",
      prompt: { base: "base only", patterns: "" },
      withPatterns: true,
      frames: [frame()],
      proposals: [proposal()],
      baseRate: 0.28,
    }),
    /has no "## patterns" section/,
  );
});
