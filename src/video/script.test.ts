import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScriptInstructions } from "./script.js";
import { buildPolishPrompt } from "../providers/polish/claude-cli.js";

// Video scripts move off Grok onto Claude Code on the subscription (Muxin, 2026-07-03): the
// text-polish provider is claude-cli, driven by /video's script:draft step. These lock the two
// guardrails that keep a Claude-drafted script in Muxin's voice and inside the scoped exception.

test("script instructions carry the hook-first + voice guardrails", () => {
  const s = buildScriptInstructions();
  assert.match(s, /Hook in the FIRST line/i); // scroll-stopping opener
  assert.match(s, /60-90 second/); // short-form length target
  assert.match(s, /NO em dashes/i); // voice.yaml house rule (fiction + video included)
  assert.match(s, /Muxin's voice/i);
  assert.match(s, /Do not invent/i); // stays tethered to the essay's real ideas
});

test("polish prompt wraps the instructions + source and demands bare output", () => {
  const p = buildPolishPrompt("SYSTEM RULES HERE", "THE ESSAY BODY");
  assert.match(p, /SYSTEM RULES HERE/);
  assert.match(p, /THE ESSAY BODY/);
  assert.match(p, /Source material to work from/);
  assert.match(p, /Output ONLY the finished text/);
});
