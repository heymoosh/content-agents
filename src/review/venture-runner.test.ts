import assert from "node:assert/strict";
import test from "node:test";
import { parseVentureStepProposal, validateVentureStepProposal, ventureStepPrompt, VENTURE_STEP_COMMANDS } from "./venture-runner.js";

test("Venture step allowlist contains only draft/recommendation commands", () => {
  assert.ok(VENTURE_STEP_COMMANDS[1].includes("ideas"));
  assert.ok(VENTURE_STEP_COMMANDS[4].includes("operating-plan-write"));
  for (const commands of Object.values(VENTURE_STEP_COMMANDS)) {
    for (const command of commands) {
      assert.equal(/select|approve|deliver|checkpoint|decide|ingest|confirm|discard|restore/.test(command), false, command);
    }
  }
});

test("parseVentureStepProposal accepts fenced JSON and rejects prose-only answers", () => {
  assert.deepEqual(
    parseVentureStepProposal('Here is the step:\n```json\n{"command":"ideas","args":[],"input":{"candidates":[]},"summary":"Ten ideas"}\n```'),
    { command: "ideas", args: [], input: { candidates: [] }, summary: "Ten ideas" },
  );
  assert.throws(() => parseVentureStepProposal("I would run the ideas step."), /required Venture step JSON/);
});

test("validateVentureStepProposal rejects human-only commands and unsafe arguments", () => {
  const base = { args: [], input: {} };
  assert.throws(() => validateVentureStepProposal(1, { ...base, command: "platform-select" }), /not allowed/);
  assert.throws(() => validateVentureStepProposal(1, { ...base, command: "draft", args: ["../secret"] }), /safe lowercase ids/);
  assert.throws(() => validateVentureStepProposal(1, { ...base, command: "ideas" , args: ["extra"] }), /expects no arguments/);
  assert.doesNotThrow(() => validateVentureStepProposal(2, { ...base, command: "concepts" }));
});

test("ventureStepPrompt requires one selected-phase step and preserves human gates", () => {
  const prompt = ventureStepPrompt("test-venture", 3, { phase: 3, status: "awaiting_user" });
  assert.match(prompt, /Return ONLY one JSON object/);
  assert.match(prompt, /Do not auto-select, auto-approve/);
  assert.match(prompt, /Current phase: 3/);
});
