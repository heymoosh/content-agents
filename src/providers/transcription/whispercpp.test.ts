import { test } from "node:test";
import assert from "node:assert/strict";
import { joinTranscript, provider } from "./whispercpp.js";

// whisper.cpp's -ml 1 flag returns token-level segments (often with a leading space, e.g.
// " hello"). joinTranscript() is the pure piece of the adapter — trims + rejoins those tokens
// into one plain transcript — so it's testable without shelling out to whisper-cli/ffmpeg.

test("joinTranscript trims token segments and joins with single spaces", () => {
  const text = joinTranscript([{ text: " Hello" }, { text: " there," }, { text: " world." }]);
  assert.equal(text, "Hello there, world.");
});

test("joinTranscript drops empty/whitespace-only segments", () => {
  const text = joinTranscript([{ text: " Hi" }, { text: "" }, { text: "   " }, { text: undefined }, { text: " there" }]);
  assert.equal(text, "Hi there");
});

test("joinTranscript returns an empty string for no segments", () => {
  assert.equal(joinTranscript([]), "");
});

test("provider satisfies the TranscriptionProvider interface shape", () => {
  assert.equal(provider.name, "whispercpp");
  assert.equal(typeof provider.transcribe, "function");
});
