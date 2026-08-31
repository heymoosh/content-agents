import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildContentRequest,
  mergeContentConfiguration,
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

  test("accepts Venture provenance only on a Venture-owned request", () => {
    const ventureSource = {
      artifactId: "p1-note", phase: 1 as const, artifactKind: "text-post-note" as const,
      messageId: "msg-1", bodyPath: "phase-1-attention/p1-note.md", claimRefs: [],
      approval: { editorialStatus: "approved" as const, provenance: "muxin-editorial-approval" as const },
    };
    assert.throws(() => buildContentRequest({ ...base, ventureSource }), /Venture.*origin/i);
    assert.throws(() => buildContentRequest({ ...base, origin: "venture", ventureSource }), /ventureId/i);
    assert.equal(buildContentRequest({ ...base, origin: "venture", ventureId: "civic-tech", ventureSource }).ventureSource?.artifactId, "p1-note");
  });

  test("configuration edits preserve immutable source and Venture approval provenance", () => {
    const ventureSource = {
      artifactId: "p1-note", phase: 1 as const, artifactKind: "text-post-note" as const,
      messageId: "msg-1", bodyPath: "phase-1-attention/p1-note.md", claimRefs: [{ claim: "One", ref: "intake:q1" }],
      approval: { editorialStatus: "approved" as const, provenance: "muxin-editorial-approval" as const },
    };
    const existing = buildContentRequest({ ...base, origin: "venture", ventureId: "civic-tech", ventureSource });
    const merged = mergeContentConfiguration(existing, {
      ...base, origin: "studio", descriptor: "spoofed", originalInput: "replaced", ventureId: null, ventureSource: null,
      treatments: ["shorter-version"], platforms: ["x"],
    });
    assert.equal(merged.origin, "venture");
    assert.equal(merged.descriptor, existing.descriptor);
    assert.equal(merged.originalInput, existing.originalInput);
    assert.deepEqual(merged.sourceContext, existing.sourceContext);
    assert.equal(merged.ventureId, "civic-tech");
    assert.deepEqual(merged.ventureSource, ventureSource);
    assert.deepEqual(merged.treatments, ["shorter-version"]);
    assert.deepEqual(merged.platforms, ["x"]);
  });

  test("configuration edits cannot forge or erase authoritative source provenance", () => {
    const existing = buildContentRequest({ ...base, sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [2, "4-5"] } });
    const merged = mergeContentConfiguration(existing, { ...base, sourceProvenance: { kind: "source", sourceLines: [99] } });
    assert.deepEqual(merged.sourceProvenance, existing.sourceProvenance);
  });

  test("configuration edits cannot replace the server-owned generation source context", () => {
    const sourceContext = {
      kind: "charles-approved-post" as const,
      authoritativeBody: "Approved Charles body.",
      personaRef: "charles/config/persona.yaml" as const,
      identity: "charles-lord-featherbottom" as const,
      restrictions: ["Manual delivery only.", "No em dashes."],
    };
    const existing = buildContentRequest({ ...base, origin: "charles", ventureId: "charles", sourceContext });
    const merged = mergeContentConfiguration(existing, {
      ...base, origin: "charles", ventureId: "charles",
      sourceContext: { ...sourceContext, authoritativeBody: "SPOOFED CLIENT BODY" },
      originalInput: "SPOOFED INSTRUCTION",
    });
    assert.deepEqual(merged.sourceContext, sourceContext);
    assert.equal(merged.originalInput, existing.originalInput);
  });

  test("experiment lineage is server-owned and survives ordinary configuration edits", () => {
    const configured = buildContentRequest({ ...base, treatments: ["summary"], media: ["none"], platforms: ["linkedin"] });
    const variablesByVariant = Object.fromEntries(configured.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }]));
    const experiment = {
      id: "experiment:opening", recommendationId: "signals:opening",
      planProposalDigest: `sha256:${"a".repeat(64)}`, planDecisionDigest: `sha256:${"b".repeat(64)}`,
      planApprovedAt: "2026-08-31T18:00:00.000Z", hypothesis: "A grounded opening will improve replies.",
      controlledVariable: "opening", variablesByVariant,
    };
    const existing = buildContentRequest({ ...base, treatments: ["summary"], media: ["none"], platforms: ["linkedin"], experiment });
    assert.equal(existing.experiment?.copyApproval, "pending-in-content");
    assert.equal(mergeContentConfiguration(existing, { ...base, treatments: ["counterpoint"], experiment: null }).experiment, existing.experiment);
    assert.throws(() => buildContentRequest({ ...base, treatments: ["summary"], media: ["none"], platforms: ["linkedin"], experiment: { ...experiment, variablesByVariant: {} } }), /cover every configured variant/i);
  });

  test("rejects empty and malformed source provenance", () => {
    assert.throws(() => buildContentRequest({ ...base, sourceProvenance: { kind: "source", sourceLines: [] } }), /requires source_lines/);
    assert.throws(() => buildContentRequest({ ...base, sourceProvenance: { kind: "source", sourceLines: [0] } }), /invalid/);
    assert.throws(() => buildContentRequest({ ...base, sourceProvenance: { kind: "approved-cut", sourceLines: [1] } }), /requires a lens/);
    assert.throws(() => buildContentRequest({ ...base, sourceProvenance: { kind: "source", sourceLines: [1], canonicalUrl: "http://example.com" } }), /must use https/);
    assert.equal(buildContentRequest({ ...base, sourceProvenance: { kind: "source", sourceLines: [1], canonicalUrl: "https://example.com/essay" } }).sourceProvenance?.canonicalUrl, "https://example.com/essay");
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
