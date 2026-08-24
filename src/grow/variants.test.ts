import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createGrowPlan, type GrowPlanRequest } from "./orchestrator.js";
import { createGrowVariantManifest, type GrowTreatmentDefinition } from "./variants.js";

const request: GrowPlanRequest = {
  source: { kind: "local-file", path: "content/essay/source.md" },
  goal: "Learn which treatment earns a useful response.",
  platforms: ["x", "substack"],
  experiment: {
    hypothesis: "A question framing will invite more replies.",
    variables: [{ name: "format", options: ["post", "thread"] }],
  },
};

describe("createGrowVariantManifest", () => {
  test("expands each treatment across platform, medium, and format", () => {
    const plan = createGrowPlan(request);
    const treatments: GrowTreatmentDefinition[] = [
      { id: "short-text", medium: "text", formats: ["thread", "post"], reason: "Match the platform's native reading pattern." },
      { id: "voice", medium: "audio", format: "short", reason: "Test whether spoken delivery changes response quality." },
    ];

    const manifest = createGrowVariantManifest(plan, treatments);

    assert.equal(manifest.candidates.length, 6);
    assert.deepEqual(
      manifest.candidates.map(({ platform, medium, format }) => `${platform}/${medium}/${format}`),
      [
        "substack/audio/short",
        "substack/text/post",
        "substack/text/thread",
        "x/audio/short",
        "x/text/post",
        "x/text/thread",
      ],
    );
    assert.equal(manifest.candidates[0]?.status, "needs-human-review");
    assert.match(manifest.candidates[0]?.reviewRequirement ?? "", /human/i);
    assert.deepEqual(manifest.reviewGate, plan.reviewGate);
  });

  test("retains source lineage, treatment provenance, and experiment values", () => {
    const plan = createGrowPlan(request);
    const [candidate] = createGrowVariantManifest(plan, [{
      id: "patterned-post",
      medium: "text",
      format: "post",
      reason: "Use the observed question-led opener structure.",
      patternRefs: ["pattern-7"],
      evidenceRefs: ["evidence-2"],
      experimentVariables: { opener: "question", length: "short" },
    }]).candidates;

    assert.deepEqual(candidate?.source, plan.source);
    assert.equal(candidate?.provenance, "descriptor-retained");
    assert.equal(candidate?.treatmentId, "patterned-post");
    assert.equal(candidate?.treatmentReason, "Use the observed question-led opener structure.");
    assert.deepEqual(candidate?.patternRefs, ["pattern-7"]);
    assert.deepEqual(candidate?.evidenceRefs, ["evidence-2"]);
    assert.deepEqual(candidate?.experimentVariables, {
      format: "post",
      length: "short",
      medium: "text",
      opener: "question",
      platform: "substack",
    });
  });

  test("deduplicates and validates treatment definitions deterministically", () => {
    const plan = createGrowPlan(request);
    const duplicate = { medium: "text", format: "post", reason: "Baseline." };
    const first = createGrowVariantManifest(plan, [duplicate, duplicate]);
    const second = createGrowVariantManifest(plan, [duplicate]);

    assert.deepEqual(first, second);
    assert.equal(first.candidates.length, 2);
    assert.throws(() => createGrowVariantManifest(plan, []), /treatment/i);
    assert.throws(() => createGrowVariantManifest(plan, [{ medium: " ", format: "post", reason: "Baseline." }]), /medium/i);
    assert.throws(() => createGrowVariantManifest(plan, [{ medium: "text", formats: [], reason: "Baseline." }]), /format/i);
    assert.throws(() => createGrowVariantManifest(plan, [{ medium: "text", format: "post", reason: " " }]), /reason/i);
    assert.throws(() => createGrowVariantManifest(plan, [
      { id: "same", medium: "text", format: "post", reason: "First." },
      { id: "same", medium: "text", format: "thread", reason: "Second." },
    ]), /treatment id must be unique/i);
  });
});
