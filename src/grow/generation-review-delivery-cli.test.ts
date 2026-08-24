import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGenerationReviewDeliveryFromJson,
  main,
  parseGenerationReviewDeliveryArgs,
  renderGenerationReviewDelivery,
  renderGenerationReviewDeliveryMarkdown,
  type GenerationReviewDeliveryCliIo,
} from "./generation-review-delivery-cli.js";

const generationRun = {
  version: "grow-generation-run-v1",
  sourceReference: "thought:one",
  substanceReference: "artifact:one",
  slots: [{
    platform: "x",
    dayIndex: 0,
    slotIndex: 0,
    variantId: "variant:one",
    experimentAssignment: null,
    status: "blocked",
    readiness: { status: "blocked", blockers: ["human review is pending"] },
    blockers: ["human review is pending"],
    generatedArtifactRef: "artifact:x-one",
    reviewQueueRef: "review:x-one",
    reviewQueueStatus: "pending",
    humanReviewRequired: true,
  }],
};

function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ generationRun, bindings: [], ...overrides });
}

test("parses one explicit source and supported output formats", () => {
  assert.deepEqual(parseGenerationReviewDeliveryArgs(["--json", "{}", "--format", "markdown"]), {
    source: { kind: "json-string", value: "{}" },
    format: "markdown",
  });
  assert.deepEqual(parseGenerationReviewDeliveryArgs(["--file", "join.json"]), {
    source: { kind: "file", path: "join.json" },
    format: "json",
  });
  assert.throws(() => parseGenerationReviewDeliveryArgs(["--json", "{}", "--file", "join.json"]), /exactly one/);
  assert.throws(() => parseGenerationReviewDeliveryArgs([]), /exactly one/);
  assert.throws(() => parseGenerationReviewDeliveryArgs(["--json", "{}", "--format", "html"]), /must be json, markdown, or both/);
});

test("renders a body-free blocked review-to-delivery view", () => {
  const value = buildGenerationReviewDeliveryFromJson(envelope());
  assert.equal(value.readiness.status, "blocked");
  assert.equal(value.summary.missingBindings, 1);
  assert.equal(value.bodyFree, true);
  assert.equal(value.autoPublishing, false);
  const markdown = renderGenerationReviewDeliveryMarkdown(value);
  assert.match(markdown, /^# Generation review delivery/m);
  assert.match(markdown, /Review queue reference/);
  assert.match(renderGenerationReviewDelivery(value, "both"), /\n# Generation review delivery/);
  assert.doesNotMatch(JSON.stringify(value), /"(?:body|content|copy)"\s*:/i);
});

test("fails closed on malformed, incomplete, or body-bearing envelopes", () => {
  assert.throws(() => buildGenerationReviewDeliveryFromJson("not-json"), /valid JSON/);
  assert.throws(() => buildGenerationReviewDeliveryFromJson("[]"), /JSON object envelope/);
  assert.throws(() => buildGenerationReviewDeliveryFromJson(JSON.stringify({ generationRun })), /bindings is required/);
  assert.throws(() => buildGenerationReviewDeliveryFromJson(envelope({ body: "copy" })), /body field|unsupported/);
  assert.throws(() => buildGenerationReviewDeliveryFromJson(envelope({ generationRun: { ...generationRun, body: "copy" } })), /body field|unsupported/);
});

test("uses injected file and output IO", async () => {
  const reads: string[] = [];
  const writes: string[] = [];
  const errors: string[] = [];
  const io: GenerationReviewDeliveryCliIo = {
    readFile: async (path) => { reads.push(path); return envelope(); },
    write: (value) => { writes.push(value); },
    error: (value) => { errors.push(value); },
  };
  const exitCode = await main(["--file", "join.json", "--format", "markdown"], io);
  assert.equal(exitCode, 0);
  assert.deepEqual(reads, ["join.json"]);
  assert.match(writes[0] ?? "", /^# Generation review delivery/);
  assert.deepEqual(errors, []);
});
