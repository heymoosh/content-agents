import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createVentureContentHandoff, toContentRequestInput, type VentureArtifactForHandoff } from "./venture-content-handoff.js";

const artifact: VentureArtifactForHandoff = {
  artifact_id: "p1-essay-01", phase: 1, artifact_kind: "substack-post",
  title: "A useful test", body_path: "phase-1-attention/p1-essay-01.md",
  venture_id: "civic-tech", venture_phase: 1, message_id: "msg-p1-essay-01",
  editorial_status: "approved", delivery_status: "ready", publishable: false,
  delivery_mode: "manual", claim_refs: [{ claim: "A real claim", ref: "intake:q7" }],
  created_at: "2026-08-29T00:00:00.000Z", updated_at: "2026-08-29T01:00:00.000Z",
};

describe("Venture content handoff", () => {
  test("preserves approved primary artifact provenance and creates a pending Content source", () => {
    const handoff = createVentureContentHandoff({ artifact, body: "The approved body.\n" });
    assert.equal(handoff.origin, "venture");
    assert.equal(handoff.ventureId, "civic-tech");
    assert.equal(handoff.artifactId, "p1-essay-01");
    assert.equal(handoff.phase, 1);
    assert.deepEqual(handoff.claimRefs, artifact.claim_refs);
    assert.deepEqual(handoff.approval, { editorialStatus: "approved", provenance: "muxin-editorial-approval" });
    assert.equal(handoff.body, "The approved body.\n");
    const request = toContentRequestInput(handoff);
    assert.deepEqual(request, {
      id: "p1-essay-01", origin: "venture", ventureId: "civic-tech",
      descriptor: "A useful test", originalInput: "The approved body.\n",
      ventureSource: {
        artifactId: "p1-essay-01", phase: 1, artifactKind: "substack-post",
        messageId: "msg-p1-essay-01", bodyPath: "phase-1-attention/p1-essay-01.md",
        claimRefs: [{ claim: "A real claim", ref: "intake:q7" }],
        approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" },
      },
    });
  });

  test("refuses non-primary, unapproved, not-ready, missing-body, and mismatched artifacts", () => {
    for (const change of [
      { artifact_kind: "lead-magnet" }, { editorial_status: "draft" },
      { delivery_status: "awaiting_approval" }, { body_path: null },
      { origin_type: "studio" }, { venture_id: "other-venture" },
    ]) assert.throws(() => createVentureContentHandoff({ artifact: { ...artifact, ...change } as VentureArtifactForHandoff, body: "body", expectedVentureId: "civic-tech" }), /approved|primary|ready|body|venture/i);
    assert.throws(() => createVentureContentHandoff({ artifact, body: "   " }), /body/i);
  });

  test("rejects a handoff that is already handed off or live", () => {
    assert.throws(() => createVentureContentHandoff({ artifact: { ...artifact, delivery_status: "handed_off" }, body: "body" }), /handed|live|duplicate/i);
    assert.throws(() => createVentureContentHandoff({ artifact: { ...artifact, delivery_status: "live_confirmed" }, body: "body" }), /handed|live|duplicate/i);
  });
});
