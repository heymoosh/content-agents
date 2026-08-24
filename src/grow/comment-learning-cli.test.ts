import assert from "node:assert/strict";
import test from "node:test";
import { main } from "./comment-learning-cli.js";

const lineage = { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" };
const body = "PRIVATE COMMENT BODY MUST NEVER APPEAR IN OPERATOR OUTPUT";

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    commentObservations: [
      {
        id: "comment-1",
        lineage,
        observation: {
          sourcePlatform: "substack",
          surface: "comment",
          commentId: "remote-comment-1",
          observedAt: "2026-08-23T12:00:00Z",
          text: body,
        },
        qualification: { status: "not_qualified", basis: "generic praise" },
        interpretation: { summary: "conversation signal", confidence: "low" },
        evidence: { status: "missing", refs: [], note: "not independently collected" },
        caveats: ["single observation"],
      },
    ],
    funnelEvents: [
      {
        id: "funnel-1",
        lineage,
        observation: { eventType: "visit", occurredAt: "2026-08-23T13:00:00Z", source: "substack", value: null },
        interpretation: { summary: "attention signal", confidence: "medium" },
        evidence: { status: "observed", refs: ["evidence-2", "evidence-1"], note: null },
        caveats: [],
      },
    ],
    businessOutcomes: [],
    ...overrides,
  };
}

async function run(raw: string, argv: readonly string[] = ["--input", "learning.json"]): Promise<{ exitCode: number; output: string; errors: string[] }> {
  const output: string[] = [];
  const errors: string[] = [];
  const exitCode = await main(argv, {
    readFile: () => raw,
    write: (value) => {
      output.push(value);
    },
    error: (value) => {
      errors.push(value);
    },
  });
  return { exitCode, output: output.join(""), errors };
}

test("loads a valid explicit envelope through injected IO and preserves blockers and pending decision", async () => {
  const result = await run(JSON.stringify(envelope()));

  assert.equal(result.exitCode, 0);
  const view = JSON.parse(result.output) as {
    muxinDecision: string;
    readiness: { status: string; blockers: string[] };
    hypotheses: Array<{ qualification: string; signal: string }>;
  };
  assert.equal(view.muxinDecision, "pending");
  assert.equal(view.readiness.status, "blocked");
  assert.deepEqual(view.readiness.blockers, ["comment-1 evidence is missing"]);
  assert.equal(view.hypotheses[0]?.qualification, "not_qualified");
  assert.equal(view.hypotheses[0]?.signal, "comment");
});

test("rejects a missing required envelope field and reports the field", async () => {
  const input = envelope();
  delete input.funnelEvents;
  const result = await run(JSON.stringify(input));

  assert.equal(result.exitCode, 1);
  assert.match(result.errors.join(""), /funnelEvents.*required/i);
  assert.equal(result.output, "");
});

test("rejects malformed JSON and invalid record shape without partial output", async () => {
  const malformed = await run("{ not json");
  assert.equal(malformed.exitCode, 1);
  assert.match(malformed.errors.join(""), /valid JSON/i);
  assert.equal(malformed.output, "");

  const invalid = envelope({
    funnelEvents: [{ id: "bad", lineage, observation: { eventType: "not-an-event" } }],
  });
  const invalidResult = await run(JSON.stringify(invalid));
  assert.equal(invalidResult.exitCode, 1);
  assert.match(invalidResult.errors.join(""), /funnelEvents.*observation\.eventType/i);
  assert.equal(invalidResult.output, "");
});

test("renders the same JSON and Markdown for equivalent input orderings", async () => {
  const firstJson = await run(JSON.stringify(envelope()));
  const first = await run(JSON.stringify(envelope()), ["--input", "learning.json", "--format", "markdown"]);
  const reversed = envelope({
    commentObservations: [...(envelope().commentObservations as unknown[])].reverse(),
    funnelEvents: [...(envelope().funnelEvents as unknown[])].reverse(),
  });
  const secondJson = await run(JSON.stringify(reversed));
  const second = await run(JSON.stringify(reversed), ["--input", "learning.json", "--format", "markdown"]);

  assert.equal(firstJson.exitCode, 0);
  assert.equal(secondJson.exitCode, 0);
  assert.equal(firstJson.output, secondJson.output);
  assert.equal(first.exitCode, 0);
  assert.equal(second.exitCode, 0);
  assert.equal(first.output, second.output);
});

test("keeps both JSON and Markdown body-free and does not expose reply or write instructions", async () => {
  const json = await run(JSON.stringify(envelope()));
  const markdown = await run(JSON.stringify(envelope()), ["--input", "learning.json", "--format", "markdown"]);

  assert.doesNotMatch(json.output, new RegExp(body));
  assert.doesNotMatch(markdown.output, new RegExp(body));
  assert.doesNotMatch(json.output, /reply|generate|write Signals|write Venture/i);
  assert.doesNotMatch(markdown.output, /reply|generate|write Signals|write Venture/i);
  assert.match(markdown.output, /Muxin decision: pending/);
  assert.match(markdown.output, /comment-1 evidence is missing/);
});
