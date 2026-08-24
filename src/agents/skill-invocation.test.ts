import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSkillInvocationEnvelope,
  type SkillInvocationInput,
} from "./skill-invocation.js";

function completeFacts(contract: "format-for-platforms" | "patterns"): Record<string, unknown> {
  if (contract === "patterns") {
    return {
      developed_source: "source-1",
      pattern_evidence: "evidence-1",
      platform_best_practices: "platform-rules-1",
    };
  }
  return {
    developed_source: "source-1",
    pattern_treatments: "treatments-1",
    target_platforms: ["substack"],
    format_options: ["text"],
    experiment_policy: "one-variable-at-a-time",
  };
}

describe("skill invocation envelope", () => {
  test("audits supplied fact keys without copying fact values or body text", () => {
    const input: SkillInvocationInput = {
      invocationId: "invocation-1",
      contract: "format-for-platforms",
      suppliedFacts: {
        ...completeFacts("format-for-platforms"),
        source_body: "creator body text must never appear in the audit artifact",
      },
    };

    const artifact = buildSkillInvocationEnvelope(input);
    const serialized = JSON.stringify(artifact);

    assert.deepEqual(artifact.suppliedFactKeys, [
      "developed_source",
      "experiment_policy",
      "format_options",
      "pattern_treatments",
      "source_body",
      "target_platforms",
    ]);
    assert.equal(artifact.kind, "skill_invocation");
    assert.equal(artifact.invocationId, "invocation-1");
    assert.equal(artifact.contract, "format-for-platforms");
    assert.equal(artifact.outputFact, "platform_format_experiments");
    assert.equal(artifact.owner, "The content studio");
    assert.equal(artifact.humanGate, "not-required");
    assert.equal(serialized.includes("creator body text must never appear"), false);
    assert.equal(serialized.includes("source-1"), false);
    assert.equal(artifact.sideEffects, "none");
  });

  test("keeps blocked and ready contract evaluation exact", () => {
    const blocked = buildSkillInvocationEnvelope({
      invocationId: "invocation-blocked",
      contract: "format-for-platforms",
      suppliedFacts: {
        developed_source: "source-1",
        pattern_treatments: null,
        extra_fact: "not-declared",
      },
    });
    assert.deepEqual(blocked.evaluation, {
      contract: "format-for-platforms",
      status: "blocked",
      missingFacts: ["experiment_policy", "format_options", "target_platforms"],
      unknownFacts: ["extra_fact", "pattern_treatments"],
    });

    const ready = buildSkillInvocationEnvelope({
      invocationId: "invocation-ready",
      contract: "format-for-platforms",
      suppliedFacts: completeFacts("format-for-platforms"),
    });
    assert.equal(ready.evaluation.status, "ready");
    assert.deepEqual(ready.evaluation.missingFacts, []);
    assert.deepEqual(ready.evaluation.unknownFacts, []);
    assert.equal(ready.outputFact, "platform_format_experiments");
    assert.equal(ready.owner, "The content studio");
    assert.equal(ready.humanGate, "not-required");
  });

  test("allows common-hook mad-lib reuse while forbidding creator body-copy reuse", () => {
    const artifact = buildSkillInvocationEnvelope({
      invocationId: "invocation-patterns",
      contract: "patterns",
      suppliedFacts: completeFacts("patterns"),
    });

    assert.equal(artifact.contentReuse.commonHookReuse, "template-madlib-compatible");
    assert.equal(artifact.contentReuse.creatorBodyCopyReuse, "forbidden");
  });

  test("blocks unknown contract names deterministically", () => {
    const input: SkillInvocationInput = {
      invocationId: "invocation-unknown",
      contract: "not-a-contract",
      suppliedFacts: { invented: "value" },
    };

    const first = buildSkillInvocationEnvelope(input);
    const second = buildSkillInvocationEnvelope(input);

    assert.deepEqual(first, second);
    assert.equal(first.evaluation.status, "blocked");
    assert.equal(first.contract, "not-a-contract");
    assert.equal(first.outputFact, null);
    assert.equal(first.owner, null);
    assert.equal(first.humanGate, null);
  });
});
