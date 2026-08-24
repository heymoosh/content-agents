import assert from "node:assert/strict";
import test from "node:test";
import { main } from "./experiment-outcome-cli.js";

const lineage = { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" };
const privateText = "PRIVATE COMMENT BODY MUST NEVER APPEAR IN LEDGER OUTPUT";

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    experiment: {
      id: "experiment-1", question: "Does the opening change conversation?",
      variables: [{ name: "opening", options: ["concrete", "abstract"] }],
      scope: { platform: ["linkedin"], format: ["text"], topic: ["learning"], audience: ["builders"] },
      lineage: { sourceRefs: ["source-1"], variantRefs: ["variant-1"], outcomeRefs: ["outcome-1"] },
      successObservations: [{ id: "success-1", family: "conversation", metric: "qualified comments", measured: false, sample: null, outcomeRefs: ["outcome-1"] }],
      minimumSample: 3, reviewRule: "after 3 posts", status: "running",
    },
    commentObservations: [{
      id: "comment-1", lineage, observation: {
        sourcePlatform: "linkedin", surface: "comment", commentId: "remote-1", observedAt: "2026-08-24T12:00:00Z", text: privateText,
      }, qualification: { status: "qualified", basis: "concrete problem" },
      interpretation: { summary: "problem signal", confidence: "medium" },
      evidence: { status: "observed", refs: ["evidence-1"], note: null }, caveats: [],
    }],
    funnelEvents: [{
      id: "funnel-1", lineage, observation: { eventType: "visit", occurredAt: "2026-08-24T12:00:00Z", source: "linkedin", value: null },
      interpretation: null, evidence: { status: "observed", refs: ["evidence-2"], note: null }, caveats: [],
    }],
    businessOutcomes: [], ...overrides,
  };
}

async function run(raw: string, argv: readonly string[] = ["--json", raw]): Promise<{ exitCode: number; output: string; errors: string[] }> {
  const output: string[] = [];
  const errors: string[] = [];
  const exitCode = await main(argv, { write: (value) => { output.push(value); }, error: (value) => { errors.push(value); } });
  return { exitCode, output: output.join(""), errors };
}

test("builds a ledger from raw records and preserves families, evidence, and no-winner guarantees", async () => {
  const result = await run(JSON.stringify(envelope()));
  assert.equal(result.exitCode, 0);
  const ledger = JSON.parse(result.output) as {
    familyCounts: Record<string, number>; winner: unknown; autoWinner: boolean; sideEffects: string;
    links: Array<{ family: string; recordId: string }>; readiness: { status: string };
  };
  assert.deepEqual(ledger.familyCounts, { attention: 0, conversation: 1, audience: 1, business: 0 });
  assert.deepEqual(ledger.links.map((link) => [link.recordId, link.family]), [["funnel-1", "audience"], ["comment-1", "conversation"]]);
  assert.equal(ledger.winner, null);
  assert.equal(ledger.autoWinner, false);
  assert.equal(ledger.sideEffects, "none");
  assert.equal(ledger.readiness.status, "ready");
  assert.doesNotMatch(result.output, new RegExp(privateText));
});

test("accepts a supplied closed winner and optional Venture proposal without inferring one", async () => {
  const base = envelope();
  const input = envelope({
    experiment: {
      ...(base.experiment as Record<string, unknown>), status: "closed",
      successObservations: [{ id: "success-1", family: "conversation", metric: "qualified comments", measured: true, value: 4, sample: 3, observedAt: "2026-08-24", outcomeRefs: ["outcome-1"] }],
      winner: { variantRef: "variant-1", family: "conversation", observationRefs: ["success-1"] },
    },
    ventureInputProposal: {
      id: "proposal-1", lineage, observation: { basisRecordIds: ["comment-1"], factualSummary: "supplied fact" },
      interpretation: { proposedInput: "supplied proposal", rationale: "supplied rationale", confidence: "medium" },
      caveats: [], evidence: { status: "observed", refs: ["evidence-3"], note: null }, muxinDecision: "pending", ventureGate: "blocked",
    },
  });
  const result = await run(JSON.stringify(input));
  assert.equal(result.exitCode, 0);
  const ledger = JSON.parse(result.output) as { winner: unknown; venture: Record<string, unknown> };
  assert.deepEqual(ledger.winner, { variantRef: "variant-1", family: "conversation", observationRefs: ["success-1"] });
  assert.deepEqual(ledger.venture, { proposalId: "proposal-1", muxinDecision: "pending", ventureGate: "blocked" });
});

test("renders Markdown and fails closed before writing on malformed input", async () => {
  const markdown = await run(JSON.stringify(envelope()), ["--json", JSON.stringify(envelope()), "--format", "markdown"]);
  assert.equal(markdown.exitCode, 0);
  assert.match(markdown.output, /# Experiment outcome ledger/);
  assert.match(markdown.output, /Side effects: none/);
  assert.doesNotMatch(markdown.output, /generate|publish|send/i);

  const malformed = await run(JSON.stringify({ ...envelope(), funnelEvents: "not-an-array" }));
  assert.equal(malformed.exitCode, 1);
  assert.match(malformed.errors.join(""), /funnelEvents.*array/i);
  assert.equal(malformed.output, "");
});
