import { test } from "node:test";
import assert from "node:assert/strict";
import { GrokUnavailableError, parseGrokJson } from "./grok-cli.js";

// parseGrokJson only. The spawn half is not unit-tested on purpose: it shells out to a real CLI,
// and the codex adapter next door draws the same line.

test("parseGrokJson reads the text and the billed cost", () => {
  const parsed = parseGrokJson(JSON.stringify({ text: "  a rewritten post  ", total_cost_usd: 0.0908 }));
  assert.equal(parsed.text, "a rewritten post");
  assert.equal(parsed.costUsd, 0.0908);
});

test("parseGrokJson treats a missing cost as zero rather than failing", () => {
  assert.equal(parseGrokJson(JSON.stringify({ text: "body" })).costUsd, 0);
});

test("parseGrokJson ignores the exit banner the CLI appends after its JSON", () => {
  const raw = `${JSON.stringify({ text: "body", total_cost_usd: 1 })}\n[exited with code 0]\n`;
  assert.equal(parseGrokJson(raw).text, "body");
});

test("parseGrokJson rejects output that is not a JSON envelope", () => {
  assert.throws(() => parseGrokJson("command not found: grok"), GrokUnavailableError);
  assert.throws(() => parseGrokJson("{not json"), /not valid JSON/);
});

test("parseGrokJson surfaces an error envelope as the error it is", () => {
  assert.throws(
    () => parseGrokJson(JSON.stringify({ type: "error", message: "rate limited" })),
    /rate limited/,
  );
});

test("parseGrokJson refuses an empty answer instead of writing an empty proposal", () => {
  assert.throws(() => parseGrokJson(JSON.stringify({ text: "   " })), /empty message/);
  assert.throws(() => parseGrokJson(JSON.stringify({ total_cost_usd: 2 })), /empty message/);
});
