import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationBrief, type GenerationBriefInput } from "./generation-brief.js";
import {
  buildVolumePlanFromJson,
  main,
  parseVolumePlanArgs,
  renderVolumePlanMarkdown,
  type VolumePlanCliIo,
} from "./volume-plan-cli.js";

const briefInput: GenerationBriefInput = {
  sourceReference: "essay:human-inference/attention",
  substanceReference: "reference:essay:human-inference/attention",
  goal: "Test useful growth formats without flattening the idea.",
  platforms: ["x", "linkedin"],
  formats: ["short-post"],
  mediaModes: ["text"],
  topicLanes: ["human inference"],
  patternTemplateRefs: ["hook:question-led"],
  dailyVolumePerPlatform: { linkedin: 1, x: 2 },
  experimentMatrix: {
    dimensions: [{ name: "opening", options: ["question", "observation"] }],
  },
  platformFormatReadiness: [
    {
      platform: "linkedin",
      format: "short-post",
      readiness: { status: "ready", blockers: [] },
    },
    {
      platform: "x",
      format: "short-post",
      readiness: { status: "blocked", blockers: ["format review pending"] },
    },
  ],
};

function json(value: unknown): string {
  return JSON.stringify(value);
}

test("parses exactly one explicit source and the supported formats", () => {
  assert.deepEqual(parseVolumePlanArgs(["--json", "{}", "--format", "markdown"]), {
    source: { kind: "json-string", value: "{}" },
    format: "markdown",
  });
  assert.deepEqual(parseVolumePlanArgs(["--file", "plan.json"]), {
    source: { kind: "file", path: "plan.json" },
    format: "json",
  });
  assert.throws(() => parseVolumePlanArgs(["--json", "{}", "--json", "{}"]), /may only be supplied once/);
  assert.throws(() => parseVolumePlanArgs(["--json", "{}", "--file", "plan.json"]), /exactly one/);
  assert.throws(() => parseVolumePlanArgs([]), /exactly one/);
  assert.throws(() => parseVolumePlanArgs(["--json", "{}", "--format", "html"]), /must be json, markdown, or both/);
});

test("builds a deterministic slot plan from an input envelope and renders metadata only", () => {
  const first = buildVolumePlanFromJson(json({ generationBrief: briefInput }));
  const second = buildVolumePlanFromJson(json({
    generationBrief: {
      ...briefInput,
      platforms: ["linkedin", "x"],
      experimentMatrix: { dimensions: [{ name: "opening", options: ["observation", "question"] }] },
    },
  }));

  assert.deepEqual(first, second);
  assert.equal(first.generatesCopy, false);
  assert.equal(first.sideEffects, "none");
  assert.equal(first.humanReviewRequired, true);
  assert.deepEqual(first.slots.map((slot) => [slot.platform, slot.dayIndex, slot.slotIndex, slot.variantId]), [
    ["linkedin", 0, 0, "linkedin|short-post|text|human inference|hook:question-led|opening=observation"],
    ["linkedin", 1, 0, "linkedin|short-post|text|human inference|hook:question-led|opening=question"],
    ["x", 0, 0, "x|short-post|text|human inference|hook:question-led|opening=observation"],
    ["x", 0, 1, "x|short-post|text|human inference|hook:question-led|opening=question"],
  ]);
  assert.deepEqual(first.slots[0]?.experimentAssignment, { opening: "observation" });
  assert.equal(first.slots[0]?.readiness, "ready");
  assert.equal(first.slots[2]?.readiness, "blocked");
  assert.deepEqual(first.slots[2]?.blockers, ["format review pending"]);
  assert.deepEqual(first.slots[0]?.humanGate, {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status: "pending",
  });
  assert.equal(JSON.stringify(first).includes("body"), false);
  assert.equal(JSON.stringify(first).includes("content"), false);

  const markdown = renderVolumePlanMarkdown(first);
  assert.match(markdown, /\| Platform \| Day index \| Slot index \| Variant \| Experiment \| Readiness \| Blockers \| Human gate \|/);
  assert.match(markdown, /linkedin/);
  assert.match(markdown, /opening=observation/);
  assert.match(markdown, /blocked/);
  assert.match(markdown, /format review pending/);
  assert.match(markdown, /pending before publish \(owner: human\)/);
  assert.doesNotMatch(markdown, /flattening the idea|source body|creator body/i);
});

test("accepts a built generation brief and applies platform volume overrides", () => {
  const builtBrief = createGenerationBrief({
    ...briefInput,
    formats: ["short-post", "thread"],
    experimentMatrix: undefined,
    platformFormatReadiness: undefined,
  });
  const plan = buildVolumePlanFromJson(json({
    generationBrief: builtBrief,
    volumeOverrides: { x: 1 },
  }));

  assert.deepEqual(plan.slots.map((slot) => [slot.platform, slot.dayIndex, slot.slotIndex]), [
    ["linkedin", 0, 0],
    ["linkedin", 1, 0],
    ["x", 0, 0],
    ["x", 1, 0],
  ]);
});

test("fails closed for malformed envelopes, unsupported fields, and invalid overrides", () => {
  assert.throws(() => buildVolumePlanFromJson("[]"), /JSON object envelope/);
  assert.throws(() => buildVolumePlanFromJson(json({})), /generationBrief is required/);
  assert.throws(() => buildVolumePlanFromJson(json({ generationBrief: null })), /generationBrief/);
  assert.throws(() => buildVolumePlanFromJson(json({ generationBrief: briefInput, volumeOverrides: { mastodon: 1 } })), /unknown platform/);
  assert.throws(() => buildVolumePlanFromJson(json({ generationBrief: briefInput, volumeOverrides: { x: 0 } })), /positive integer/);
  assert.throws(() => buildVolumePlanFromJson(json({ generationBrief: briefInput, body: "must not be accepted" })), /unsupported field/);
  assert.throws(() => buildVolumePlanFromJson("{not-json"), /valid JSON/);
});

test("uses injected file and output IO without writing domain state", async () => {
  const reads: string[] = [];
  const writes: string[] = [];
  const errors: string[] = [];
  const io: VolumePlanCliIo = {
    readFile: async (path) => {
      reads.push(path);
      return json({ generationBrief: briefInput, volumeOverrides: { linkedin: 2 } });
    },
    write: (value) => {
      writes.push(value);
    },
    error: (value) => {
      errors.push(value);
    },
  };

  const exitCode = await main(["--file", "plan.json", "--format", "both"], io);

  assert.equal(exitCode, 0);
  assert.deepEqual(reads, ["plan.json"]);
  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /^\{/);
  assert.match(writes[0] ?? "", /# Volume plan/);
  assert.deepEqual(errors, []);
});

test("reports validation failures through injected error IO", async () => {
  let output = "";
  let error = "";
  const exitCode = await main(["--json", json({ generationBrief: briefInput, volumeOverrides: { mastodon: 1 } })], {
    write: (value) => { output += value; },
    error: (value) => { error += value; },
  });

  assert.equal(exitCode, 1);
  assert.equal(output, "");
  assert.match(error, /^grow:volume-plan:/);
  assert.match(error, /unknown platform/);
});
