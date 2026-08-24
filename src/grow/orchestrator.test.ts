import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createGrowPlan, type GrowPlanRequest } from "./index.js";

const request: GrowPlanRequest = {
  source: { kind: "inline-thought", text: "A small thought worth testing." },
  goal: "Learn which framing earns a useful response.",
  platforms: ["linkedin", "x", "linkedin"],
};

describe("createGrowPlan", () => {
  test("returns a deterministic, read-only plan with ordered stages", () => {
    const first = createGrowPlan(request);
    const second = createGrowPlan(request);

    assert.deepEqual(first, second);
    assert.deepEqual(first.platforms, ["linkedin", "x"]);
    assert.deepEqual(first.stages.map((stage) => stage.id), [
      "preserve-source",
      "message-cut",
      "platform-format-variants",
      "human-review",
      "learning-outputs",
    ]);
    assert.equal(first.generatesCopy, false);
    assert.equal(first.sideEffects, "none");
    assert.equal(first.reviewGate.required, true);
    assert.equal(first.reviewGate.before, "publish");
  });

  test("makes experiment variables and deferred engine capabilities traceable", () => {
    const plan = createGrowPlan({
      ...request,
      experiment: {
        hypothesis: "A concrete question will invite more replies.",
        variables: [
          { name: "message-cut", options: ["question", "observation"] },
          { name: "format", options: ["text", "image"] },
        ],
      },
    });

    assert.deepEqual(plan.experiment.variables, [
      { name: "format", options: ["image", "text"] },
      { name: "message-cut", options: ["observation", "question"] },
    ]);
    assert.equal(plan.experiment.hypothesis, "A concrete question will invite more replies.");
    assert.ok(plan.engineCapabilities.some((engine) => engine.name === "atomize/cuts"));
    assert.ok(plan.engineCapabilities.some((engine) => engine.name === "strategy/route"));
    for (const name of ["develop", "brand-lens", "atomize", "video", "review", "publish", "signals", "venture/status"]) {
      assert.ok(plan.engineCapabilities.some((engine) => engine.name === name), `missing deferred capability: ${name}`);
    }
    assert.ok(plan.engineCapabilities.every((engine) => engine.invocation === "deferred"));
  });

  test("rejects empty goals, platforms, and source text", () => {
    assert.throws(() => createGrowPlan({ ...request, goal: " " }), /goal/);
    assert.throws(() => createGrowPlan({ ...request, platforms: [] }), /platform/);
    assert.throws(() => createGrowPlan({ ...request, source: { kind: "inline-thought", text: "" } }), /source/);
  });
});
