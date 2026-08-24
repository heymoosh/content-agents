import test from "node:test";
import assert from "node:assert/strict";

import { createGenerationBrief } from "./generation-brief.js";

const baseInput = {
  sourceReference: "essay:human-inference/attention",
  substanceReference: "The supplied essay argues that useful inference starts with observing what people do, not what they say.",
  goal: "Test thoughtful, useful growth formats without flattening the original idea.",
  platforms: ["linkedin", "x"],
  formats: ["short-post", "thread"],
  mediaModes: ["text", "video"],
  topicLanes: ["human inference", "civic technology"],
  patternTemplateRefs: ["hook:contrarian-observation", "hook:question-led"],
};

test("fans out deterministic, deduplicated platform-format-treatment variants", () => {
  const first = createGenerationBrief({
    ...baseInput,
    platforms: ["x", "linkedin", "x"],
    formats: ["thread", "short-post", "thread"],
    mediaModes: ["video", "text", "video"],
    topicLanes: ["civic technology", "human inference", "civic technology"],
    patternTemplateRefs: ["hook:question-led", "hook:contrarian-observation", "hook:question-led"],
    experimentMatrix: {
      dimensions: [
        { name: "opening", options: ["question", "observation"] },
        { name: "cta", options: ["reply", "save"] },
      ],
    },
  });
  const second = createGenerationBrief({
    ...baseInput,
    experimentMatrix: {
      dimensions: [
        { name: "cta", options: ["save", "reply"] },
        { name: "opening", options: ["observation", "question"] },
      ],
    },
  });

  assert.deepEqual(first.variants, second.variants);
  assert.equal(first.variants.length, 2 * 2 * 2 * 2 * 2 * 4);
  assert.deepEqual(first.variants[0], {
    id: "linkedin|short-post|text|civic technology|hook:contrarian-observation|cta=reply&opening=observation",
    platform: "linkedin",
    format: "short-post",
    mediaMode: "text",
    topicLane: "civic technology",
    patternTemplateRef: "hook:contrarian-observation",
    treatment: {
      mediaMode: "text",
      topicLane: "civic technology",
      patternTemplateRef: "hook:contrarian-observation",
    },
    experimentAssignment: { cta: "reply", opening: "observation" },
    humanGate: { required: true, before: "publish", approvalOwner: "human", status: "pending" },
    specificationOnly: true,
  });
});

test("defaults daily volume to one for every normalized platform", () => {
  const brief = createGenerationBrief(baseInput);

  assert.deepEqual(brief.dailyVolumePerPlatform, { linkedin: 1, x: 1 });
});

test("carries the mad-lib hook policy without permitting creator body-copy reuse", () => {
  const brief = createGenerationBrief(baseInput);

  assert.deepEqual(brief.templateReusePolicy, {
    mode: "template-madlib",
    commonSocialHooks: "allowed",
    creatorBodyCopy: "forbidden",
  });
});

test("does not produce copy, winners, demand claims, or release actions", () => {
  const brief = createGenerationBrief(baseInput);

  assert.equal(brief.generatesCopy, false);
  assert.equal(brief.sideEffects, "none");
  assert.equal(Object.hasOwn(brief, "body"), false);
  assert.equal(Object.hasOwn(brief, "winner"), false);
  assert.equal(Object.hasOwn(brief, "demandClaim"), false);
  assert.equal(Object.hasOwn(brief, "publishing"), false);
  assert.equal(Object.hasOwn(brief, "scheduling"), false);
  for (const variant of brief.variants) {
    assert.equal(Object.hasOwn(variant, "body"), false);
    assert.equal(Object.hasOwn(variant, "winner"), false);
    assert.equal(Object.hasOwn(variant, "demandClaim"), false);
  }
});

test("requires human approval before release and defers model invocation", () => {
  const brief = createGenerationBrief(baseInput);

  assert.deepEqual(brief.humanGate, {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status: "pending",
  });
  assert.deepEqual(brief.modelBoundary, {
    modelInvocation: "deferred",
    preferredRoute: "claude-subscription",
    costClass: "subscription",
    humanGate: "required",
    humanDecision: "pending",
    sideEffects: "none",
    boundaries: {
      composesBody: false,
      commonHookMadLibAllowed: true,
      creatorBodyCopyAllowed: false,
    },
  });
  assert.deepEqual(brief.reviewGate, { required: true, before: "publish", approvalOwner: "human" });
});

test("rejects empty values, missing platforms, and invalid daily volume", () => {
  assert.throws(() => createGenerationBrief({ ...baseInput, sourceReference: " " }), /sourceReference must not be empty/);
  assert.throws(() => createGenerationBrief({ ...baseInput, platforms: [] }), /at least one platform is required/);
  assert.throws(() => createGenerationBrief({ ...baseInput, formats: ["", "thread"] }), /format must not be empty/);
  assert.throws(() => createGenerationBrief({ ...baseInput, mediaModes: [] }), /mediaModes must not be empty/);
  assert.throws(() => createGenerationBrief({ ...baseInput, topicLanes: [" "] }), /topicLane must not be empty/);
  assert.throws(() => createGenerationBrief({ ...baseInput, patternTemplateRefs: [] }), /at least one pattern\/template reference is required/);
  assert.throws(() => createGenerationBrief({ ...baseInput, dailyVolumePerPlatform: 0 }), /daily volume.*positive integer/);
  assert.throws(() => createGenerationBrief({ ...baseInput, dailyVolumePerPlatform: { linkedin: 1.5 } }), /daily volume.*positive integer/);
  assert.throws(() => createGenerationBrief({ ...baseInput, dailyVolumePerPlatform: { mastodon: 1 } }), /unknown platform/);
  assert.throws(() => createGenerationBrief({
    ...baseInput,
    experimentMatrix: { dimensions: [{ name: " ", options: ["question"] }] },
  }), /experiment dimension name must not be empty/);
  assert.throws(() => createGenerationBrief({
    ...baseInput,
    experimentMatrix: { dimensions: [{ name: "opening", options: [] }] },
  }), /experiment options.*not be empty/);
});
