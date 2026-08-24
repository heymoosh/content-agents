import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrowThisPlanOperatorView,
  main,
  parseGrowThisPlanArgs,
  parseGrowThisPlanInput,
  renderGrowThisPlan,
  type GrowThisPlanCliOptions,
} from "./grow-this-plan-cli.js";
import type { GrowThisPlanInput } from "./grow-this-plan.js";

const source = { recordType: "source", id: "source-1", relation: "origin" };
const cut = { recordType: "cut", id: "cut-1", relation: "selected" };
const variant = { recordType: "variant", id: "variant-1", relation: "formatted" };

function input(overrides: Partial<GrowThisPlanInput> = {}): GrowThisPlanInput {
  return {
    id: "grow-this-1",
    sourceRef: source,
    cutRef: cut,
    variantRefs: [variant],
    sourceStatus: "ready",
    cutStatus: "ready",
    cutDecision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-23T11:00:00Z" },
    reviewBundle: {
      id: "review-1",
      sourceRef: source,
      cutRef: cut,
      variantRefs: [variant],
      publishRefs: [],
      lineage: [source, cut, variant],
      evidenceStatus: "blocked",
      evidenceRefs: [],
      evidenceNote: null,
      voiceCheck: "passed",
      originalityCheck: "passed",
      readiness: { status: "blocked", blockingFields: ["humanReview", "evidenceRefs"], reason: "needs review" },
      humanDecision: { status: "candidate", decidedBy: null, decidedAt: null, note: null },
      status: "candidate",
      kind: "grow_review_bundle",
      version: "grow-review-bundle-v1",
      generatesCopy: false,
      sideEffects: "none",
    } as GrowThisPlanInput["reviewBundle"],
    evidenceRefs: [],
    ...overrides,
  };
}

function raw(overrides: Partial<GrowThisPlanInput> = {}): string {
  return JSON.stringify(input(overrides));
}

describe("Grow-this operator CLI", () => {
  test("requires exactly one source and validates the format", () => {
    assert.deepEqual(parseGrowThisPlanArgs(["--json", raw(), "--format", "both"]), {
      source: { kind: "json", value: raw() },
      format: "both",
    } satisfies GrowThisPlanCliOptions);
    assert.throws(() => parseGrowThisPlanArgs([]), /exactly one/);
    assert.throws(() => parseGrowThisPlanArgs(["--json", raw(), "--file", "plan.json"]), /exactly one/);
    assert.throws(() => parseGrowThisPlanArgs(["--json", raw(), "--format", "yaml"]), /--format/);
  });

  test("reports the first human/evidence blocker without bodies or winners", () => {
    const view = buildGrowThisPlanOperatorView(parseGrowThisPlanInput(raw()));
    assert.equal(view.nextAction.stage, "review");
    assert.equal(view.nextAction.status, "pending");
    assert.match(view.nextAction.message, /human review|evidence/i);
    assert.equal(view.bodyIncluded, false);
    assert.equal(view.sideEffects, "none");
    assert.equal(view.plan.winner, null);
    assert.equal("body" in view, false);
    assert.equal("copy" in view, false);
  });

  test("renders deterministic JSON and Markdown operator views", () => {
    const view = buildGrowThisPlanOperatorView(parseGrowThisPlanInput(raw()));
    const first = renderGrowThisPlan(view, "both");
    const second = renderGrowThisPlan(view, "both");
    assert.equal(first, second);
    assert.match(first, /Grow-this operator view/);
    assert.match(first, /Generates copy: false/);
    assert.doesNotMatch(first, /"(?:body|copy|model)"\s*:/);
  });

  test("main supports injected file I/O and rejects unsafe fields", () => {
    const output: string[] = [];
    const errors: string[] = [];
    const fileIo = {
      readFile: () => raw(),
      write: (value: string) => output.push(value),
      error: (value: string) => errors.push(value),
    };
    assert.equal(main(["--file", "plan.json", "--format", "markdown"], fileIo), 0);
    assert.match(output[0] ?? "", /Lifecycle:/);
    assert.deepEqual(errors, []);

    assert.equal(main(["--json", JSON.stringify({ ...input(), body: "creator text" })], fileIo), 1);
    assert.match(errors.at(-1) ?? "", /unsupported|body-free/i);
  });
});
