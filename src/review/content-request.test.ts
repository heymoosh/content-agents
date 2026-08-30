import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildContentRequest,
  resolveContentCta,
  type ContentRequestInput,
  type LeadMagnet,
} from "./content-request.js";

const base: ContentRequestInput = {
  id: "request-1",
  origin: "human-inference",
  descriptor: "The hidden cost of convenience",
  originalInput: "A verbatim thought with\nline breaks preserved.",
  treatments: ["hook-variants", "shorter-version"],
  media: ["static-quote-card", "image"],
  platforms: ["substack", "bluesky"],
  recommendationEvidence: [
    { option: "hook-variants", kind: "treatment", reason: "Similar essays earned more saves", source: "signal-1", recommended: true },
    { option: "static-quote-card", kind: "media", reason: "Quote cards beat plain text", source: "signal-2", recommended: true },
    { option: "bluesky", kind: "platform", reason: "Safe cold-start default", source: "default", recommended: true },
  ],
};

describe("content request domain", () => {
  test("keeps source text verbatim, treats selections independently, and creates an enabled control", () => {
    const request = buildContentRequest(base);
    assert.equal(request.descriptor, base.descriptor);
    assert.equal(request.originalInput, base.originalInput);
    assert.deepEqual(request.selections, {
      treatments: ["hook-variants", "shorter-version"],
      media: ["static-quote-card", "image"],
      platforms: ["substack", "bluesky"],
    });
    assert.equal(request.control.enabled, true);
    assert.equal(request.variants[0]?.identity.kind, "control");
    assert.equal(request.variants[0]?.identity.requestId, "request-1");
    assert.equal(request.variants.some((variant) => variant.identity.kind === "treated"), true);
    assert.equal(request.variants.every((variant) => /^[\w.-]+$/.test(variant.identity.id)), true, "variant ids must be editable derivative ids");
  });

  test("preselection is evidence-backed but user-overridable", () => {
    const request = buildContentRequest({ ...base, treatments: ["shorter-version"], media: [], platforms: ["substack"], recommendationEvidence: base.recommendationEvidence });
    assert.equal(request.recommendations.treatments[0]?.option, "hook-variants");
    assert.deepEqual(request.selections.treatments, ["shorter-version"]);
    assert.deepEqual(request.selections.media, []);
    assert.equal(request.recommendations.treatments[0]?.evidence[0]?.source, "signal-1");
    const defaults = buildContentRequest({ ...base, treatments: undefined, media: undefined, platforms: undefined });
    assert.deepEqual(defaults.selections.treatments, ["hook-variants"]);
    assert.deepEqual(defaults.selections.media, ["static-quote-card"]);
    assert.deepEqual(defaults.selections.platforms, ["bluesky"]);
  });

  test("allows explicitly disabling the untreated control", () => {
    const request = buildContentRequest({ ...base, includeUntreatedControl: false });
    assert.equal(request.control.enabled, false);
    assert.equal(request.variants.every((variant) => variant.identity.kind === "treated"), true);
  });

  test("refuses missing, ambiguous, or cross-origin/cross-venture CTA mappings", () => {
    const request = buildContentRequest({ ...base, ventureId: "hi" });
    const valid: LeadMagnet = { id: "hi-guide", name: "HI guide", origin: "human-inference", ventureId: "hi" };
    assert.equal(resolveContentCta(request, [valid]).leadMagnetId, "hi-guide");
    assert.throws(() => resolveContentCta(request, []), /missing/i);
    assert.throws(() => resolveContentCta(request, [valid, { ...valid, id: "hi-guide-2" }]), /ambiguous/i);
    assert.throws(() => resolveContentCta(request, [{ ...valid, origin: "charles" }]), /origin/i);
    assert.throws(() => resolveContentCta(request, [{ ...valid, ventureId: "other" }]), /venture/i);
  });
});
