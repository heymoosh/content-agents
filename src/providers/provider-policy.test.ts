import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

test("default provider policy uses subscriptions/local tools and confines OpenRouter to video", () => {
  const config = parse(readFileSync("config/providers.yaml", "utf8")) as Record<string, unknown>;
  assert.equal(config.analyst, "routed");
  assert.equal(config["text-polish"], "claude-cli");
  assert.equal(config.prose, "grok-cli");
  assert.equal(config.transcription, "whispercpp");
  assert.equal(config.image, "none");
  assert.equal(config["video-broll"], "openrouter-video");
  assert.ok(!JSON.stringify(config).includes("gemini"));
  assert.ok(!JSON.stringify(config).includes("grok-openrouter"));
});
