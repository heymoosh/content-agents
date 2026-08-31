import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createCharlesContentHandoff, toCharlesContentRequestInput, CHARLES_VENTURE_ID } from "./charles-content-handoff.js";

const base = {
  id: "charles-launch-1", thought: "The client asked whether power is still inevitable.",
  replySource: "A quoted post about political accountability.",
  selectedOutputs: ["one-liner", "reply"] as const,
  descriptor: "Power is apparently inevitable",
  originalInput: "Draft Charles outputs from this thought and reply source.",
  approvedPostBody: "POWER REMAINS INEVITABLE! Please stop checking.",
};

describe("Charles content handoff", () => {
  test("carries identity, original sources, selected output types, and Charles restrictions", () => {
    const handoff = createCharlesContentHandoff(base);
    assert.equal(handoff.origin, "charles");
    assert.equal(handoff.identity.persona, "charles-lord-featherbottom");
    assert.deepEqual(handoff.selectedOutputs, ["one-liner", "reply"]);
    assert.equal(handoff.thought, base.thought);
    assert.equal(handoff.replySource, base.replySource);
    assert.ok(handoff.ctaRestrictions.length > 0);
  });

  test("refuses cross-venture CTA inheritance and empty output selection", () => {
    assert.throws(() => createCharlesContentHandoff({ ...base, inheritedVentureId: "least-of-us-fiction" }), /venture|CTA/i);
    assert.throws(() => createCharlesContentHandoff({ ...base, selectedOutputs: [] }), /output/i);
    assert.throws(() => createCharlesContentHandoff({ ...base, selectedOutputs: ["meme"] as never }), /output/i);
  });

  test("converts to ordinary Content input without generating or publishing", () => {
    const input = toCharlesContentRequestInput(createCharlesContentHandoff(base));
    assert.equal(input.origin, "charles");
    assert.equal(input.ventureId, CHARLES_VENTURE_ID);
    assert.equal(input.originalInput, base.originalInput);
    assert.equal(input.sourceContext?.kind, "charles-approved-post");
    assert.equal(input.sourceContext?.authoritativeBody, base.approvedPostBody);
    assert.equal(input.sourceContext && "personaRef" in input.sourceContext ? input.sourceContext.personaRef : "", "charles/config/persona.yaml");
    assert.ok(input.sourceContext && "restrictions" in input.sourceContext && input.sourceContext.restrictions.some((rule) => /manual/i.test(rule)));
    assert.equal("cta" in input, false);
  });
});
