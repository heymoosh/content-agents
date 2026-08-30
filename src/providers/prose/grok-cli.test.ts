import test from "node:test";
import assert from "node:assert/strict";

import { buildProsePrompt } from "./grok-cli.js";

test("Grok subscription prose keeps system, context, and chapter direction explicit", () => {
  const prompt = buildProsePrompt("VOICE RULES", "CANON PACK", "WRITE CHAPTER 3");
  assert.match(prompt, /^# System and voice rules\nVOICE RULES/m);
  assert.match(prompt, /# Canon and story context\nCANON PACK/m);
  assert.match(prompt, /# Chapter direction\nWRITE CHAPTER 3/m);
  assert.match(prompt, /Output only the finished chapter prose/);
});

test("Grok subscription prose rejects missing prompt sections before invoking a model", () => {
  assert.throws(() => buildProsePrompt("", "canon", "chapter"), /system and voice rules/i);
  assert.throws(() => buildProsePrompt("voice", "", "chapter"), /canon and story context/i);
  assert.throws(() => buildProsePrompt("voice", "canon", ""), /chapter direction/i);
});
