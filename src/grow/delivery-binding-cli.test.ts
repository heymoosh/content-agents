import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildGrowCapacityManifest } from "./capacity.js";
import { buildGrowReviewBundle } from "./review-bundle.js";
import {
  buildGrowDeliveryBindingFromJson,
  main,
  parseGrowDeliveryBindingArgs,
  renderGrowDeliveryBindingMarkdown,
  type GrowDeliveryBindingCliIo,
} from "./delivery-binding-cli.js";

const reviewBundle = buildGrowReviewBundle({
  id: "review-1",
  sourceRef: "source-1",
  cutRef: "cut-1",
  variantRefs: ["variant-1"],
  publishRefs: ["publish-1"],
  lineage: [
    { recordType: "source", id: "source-1" },
    { recordType: "cut", id: "cut-1" },
    { recordType: "variant", id: "variant-1" },
    { recordType: "treatment", id: "treatment-1" },
    { recordType: "experiment", id: "experiment-1" },
  ],
  evidence: { status: "supported", refs: ["evidence-1"] },
  voiceCheck: "passed",
  originalityCheck: "passed",
  readiness: { status: "ready", blockingFields: [], reason: "ready" },
  humanDecision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z" },
});

const capacitySlice = buildGrowCapacityManifest({
  days: ["2026-08-25"],
  platforms: ["linkedin"],
  candidates: [{ id: "candidate-1", day: "2026-08-25", platform: "linkedin", status: "approved" }],
  slotCapacity: [{ day: "2026-08-25", platform: "linkedin", capacity: 2, scheduledCount: 0 }],
}).slices[0]!;

const envelope = {
  reviewBundle,
  candidate: {
    id: "candidate-1",
    day: "2026-08-25",
    platform: "linkedin",
    variantId: "variant-1",
    lineage: {
      sourceId: "source-1",
      cutId: "cut-1",
      variantId: "variant-1",
      treatmentId: "treatment-1",
      experimentId: "experiment-1",
    },
  },
  capacitySlice,
  queueFacts: {
    artifactId: "candidate-1",
    status: "approved",
    lineage: {
      sourceId: "source-1", cutId: "cut-1", variantId: "variant-1", treatmentId: "treatment-1", experimentId: "experiment-1", publishId: "publish-1",
    },
    readiness: { status: "ready", blockers: [] },
    sideEffects: "none",
  },
  schedulerFacts: {
    deliveryId: "delivery:review-1:candidate-1",
    status: "unscheduled",
    lineage: {
      sourceId: "source-1", cutId: "cut-1", variantId: "variant-1", treatmentId: "treatment-1", experimentId: "experiment-1", publishId: "publish-1",
    },
    readiness: { status: "ready", blockers: [] },
    sideEffects: "none",
  },
  providerFacts: null,
  deliveryMode: "provider",
};

describe("grow delivery binding CLI", () => {
  test("parses explicit JSON/file sources and supported formats", () => {
    assert.deepEqual(parseGrowDeliveryBindingArgs(["--json", "{}", "--format", "both"]), {
      source: { kind: "json-string", value: "{}" }, format: "both",
    });
    assert.deepEqual(parseGrowDeliveryBindingArgs(["--file", "binding.json"]), {
      source: { kind: "file", path: "binding.json" }, format: "json",
    });
    assert.throws(() => parseGrowDeliveryBindingArgs(["--json", "{}", "--file", "binding.json"]), /exactly one/);
    assert.throws(() => parseGrowDeliveryBindingArgs(["--json", "{}", "--format", "html"]), /json, markdown, or both/);
  });

  test("renders a deterministic body-free operator view", () => {
    const view = buildGrowDeliveryBindingFromJson(JSON.stringify(envelope));
    const markdown = renderGrowDeliveryBindingMarkdown(view);

    assert.equal(view.status, "approved");
    assert.match(markdown, /# Grow delivery binding/);
    assert.match(markdown, /approved/);
    assert.match(markdown, /Side effects: none/);
    assert.match(markdown, /Human approval required: true/);
    assert.doesNotMatch(JSON.stringify(view), /sourceBody|content|bodyText|copyText/i);
    assert.doesNotMatch(markdown, /source body|body text|publish call|provider API/i);
  });

  test("fails closed on nested and body-bearing envelopes", () => {
    assert.throws(() => buildGrowDeliveryBindingFromJson(JSON.stringify({ ...envelope, body: "copy" })), /unsupported field|body/);
    assert.throws(() => buildGrowDeliveryBindingFromJson(JSON.stringify({
      ...envelope,
      candidate: { ...envelope.candidate, content: "copy" },
    })), /unsupported field|content/);
    assert.throws(() => buildGrowDeliveryBindingFromJson(JSON.stringify({
      ...envelope,
      providerFacts: { provider: "typefully", reference: "p-1", payload: { content: "copy" } },
    })), /unsupported field|payload/);
    assert.throws(() => buildGrowDeliveryBindingFromJson("not-json"), /valid JSON/);
  });

  test("uses injected file and output IO without side effects", async () => {
    const reads: string[] = [];
    const writes: string[] = [];
    const errors: string[] = [];
    const io: GrowDeliveryBindingCliIo = {
      readFile: async (path) => { reads.push(path); return JSON.stringify(envelope); },
      write: (value) => { writes.push(value); },
      error: (value) => { errors.push(value); },
    };

    const exitCode = await main(["--file", "binding.json", "--format", "both"], io);

    assert.equal(exitCode, 0);
    assert.deepEqual(reads, ["binding.json"]);
    assert.equal(writes.length, 1);
    assert.match(writes[0] ?? "", /^\{/);
    assert.match(writes[0] ?? "", /# Grow delivery binding/);
    assert.deepEqual(errors, []);
  });

  test("reports validation failures without output", async () => {
    let output = "";
    let error = "";
    const exitCode = await main(["--json", JSON.stringify({ ...envelope, schedulerFacts: null })], {
      write: (value) => { output += value; },
      error: (value) => { error += value; },
    });

    assert.equal(exitCode, 1);
    assert.equal(output, "");
    assert.match(error, /^grow:delivery-binding:/);
    assert.match(error, /schedulerFacts/);
  });
});
