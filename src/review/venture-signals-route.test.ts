import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { appendCanonEvent } from "../venture/canon.js";
import { readArtifact } from "../venture/artifacts.js";
import { handleVentureWrite } from "./venture-writes.js";
import { recordSignalsVentureDecision, recordSignalsVentureProposal, signalsVentureProposalId } from "./signals-venture-handoff-store.js";
import { clearTempVentureRoot, useTempVentureRoot } from "../venture/test-venture-root.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SLUG = "route-signals";
const RULES = "venture-rules-2026-08-19-draft-1";
let handoffsPath: string;

beforeEach(() => {
  useTempVentureRoot();
  handoffsPath = join(mkdtempSync(join(tmpdir(), "signals-handoff-route-")), "handoffs.jsonl");
  appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, { rules_version: RULES }, "2026-08-31T00:00:00.000Z");
  recordSignalsVentureProposal({ id: "proposal-1", ventureSlug: SLUG, sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1", title: "Qualified signal", factualSummary: "A measured outcome", proposedInput: "Test the problem", rationale: "Evidence warrants a test", confidence: "medium", evidenceRefs: ["evidence-1"], phase: 1, inputKind: "funnel", contentItemRefs: ["content-1"], scope: "qualified inquiry", sampleSize: { treatment: 10, control: 10 }, provenance: { planDigest: "plan-1", interpretationId: "interpretation-1" }, caveats: ["Directional."], qualification: "qualified", evidenceStatus: "measured" }, handoffsPath);
  recordSignalsVentureDecision("proposal-1", "adopt", "Muxin adopted this proposal.", handoffsPath);
});
afterEach(clearTempVentureRoot);

describe("Venture Signals input route", () => {
  test("accepts the adopted proposal through Venture and creates the internal artifact", () => {
    const result = handleVentureWrite("POST", `/api/venture/${SLUG}/signals-input/proposal-1/decision`, {
      outcome: "accept", reason: "I will test this signal.",
    }, { signalsHandoffsPath: handoffsPath });
    assert.equal(result?.status, 200, JSON.stringify(result));
    assert.equal(readArtifact(SLUG, "signals-input-proposal-1")?.publishable, false);
  });

  test("accepts the route-safe generated proposal identity", () => {
    const generatedId = signalsVentureProposalId("experiment-1", SLUG, 1);
    recordSignalsVentureProposal({ id: generatedId, ventureSlug: SLUG, sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1", title: "Qualified signal", factualSummary: "A measured outcome", proposedInput: "Test the problem", rationale: "Evidence warrants a test", confidence: "medium", evidenceRefs: ["outcome:1"], phase: 1, inputKind: "funnel", contentItemRefs: ["content-1"], scope: "qualified inquiry", sampleSize: { treatment: 10, control: 10 }, provenance: { planDigest: "plan-1", interpretationId: "interpretation-1" }, caveats: ["Directional."], qualification: "qualified", evidenceStatus: "measured" }, handoffsPath);
    recordSignalsVentureDecision(generatedId, "adopt", "Muxin adopted this proposal.", handoffsPath);
    const result = handleVentureWrite("POST", `/api/venture/${SLUG}/signals-input/${generatedId}/decision`, {
      outcome: "accept", reason: "I will test this signal.",
    }, { signalsHandoffsPath: handoffsPath });
    assert.equal(result?.status, 200, JSON.stringify(result));
  });

  test("a Venture rejection records the decision without creating an artifact", () => {
    const result = handleVentureWrite("POST", `/api/venture/${SLUG}/signals-input/proposal-1/decision`, {
      outcome: "reject", reason: "This does not fit the Venture hypothesis.",
    }, { signalsHandoffsPath: handoffsPath });
    assert.equal(result?.status, 200, JSON.stringify(result));
    assert.equal((result?.body as any).acceptance.artifact, null);
    assert.equal(readArtifact(SLUG, "signals-input-proposal-1"), undefined);
  });

  test("a Venture request for more evidence records the decision without creating an artifact", () => {
    const result = handleVentureWrite("POST", `/api/venture/${SLUG}/signals-input/proposal-1/decision`, {
      outcome: "request-more-evidence", reason: "Run this against a larger qualified sample.",
    }, { signalsHandoffsPath: handoffsPath });
    assert.equal(result?.status, 200, JSON.stringify(result));
    assert.equal((result?.body as any).acceptance.artifact, null);
    assert.equal(readArtifact(SLUG, "signals-input-proposal-1"), undefined);
  });

  test("rejects missing Muxin action fields and non-adopted or wrong-slug proposals", () => {
    const missing = handleVentureWrite("POST", `/api/venture/${SLUG}/signals-input/proposal-1/decision`, { outcome: "accept" }, { signalsHandoffsPath: handoffsPath });
    assert.equal(missing?.status, 400);
    const wrong = handleVentureWrite("POST", `/api/venture/other/signals-input/proposal-1/decision`, { outcome: "accept", reason: "x" }, { signalsHandoffsPath: handoffsPath });
    assert.equal(wrong?.status, 404);
  });

  test("ignores no forged authority fields: unknown client fields are rejected", () => {
    const result = handleVentureWrite("POST", `/api/venture/${SLUG}/signals-input/proposal-1/decision`, {
      outcome: "accept", reason: "I will test this signal.", rulesVersion: "forged", contentDecisionRef: "forged",
      ventureGateRef: "forged", decisionRef: "forged", measured: false,
    }, { signalsHandoffsPath: handoffsPath });
    assert.equal(result?.status, 400);
    assert.match(String((result?.body as { error?: string }).error), /unknown|field|only|allowed/i);
  });
});
