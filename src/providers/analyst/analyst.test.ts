import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCodexAvailability, CodexUnavailableError } from "./codex-cli.js";
import { createRoutedAnalyst } from "./routed.js";
import type { AnalystProvider } from "../types.js";

test("classifyCodexAvailability catches the usage-limit shapes and stays quiet otherwise", () => {
  assert.match(classifyCodexAvailability("You've hit your usage limit. Try again on July 23.")!, /usage limit/i);
  assert.match(classifyCodexAvailability("error: rate limit exceeded, resets at 04:00 UTC")!, /rate limit/i);
  assert.match(classifyCodexAvailability("You are out of usage credits for this billing cycle")!, /out of usage credits/i);
  assert.match(classifyCodexAvailability("Not logged in — run codex login")!, /not logged in/i);
  // the shape a signed-out/expired-auth codex actually emits (observed live 2026-07-19)
  assert.match(
    classifyCodexAvailability("ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://api.openai.com/v1/responses")!,
    /401 Unauthorized/,
  );
  assert.equal(classifyCodexAvailability("ANALYST-PROBE-OK\ntokens used\n9,450"), null);
});

function fake(name: string, behavior: () => Promise<string>): AnalystProvider {
  return { name, analyze: async () => ({ text: await behavior(), costUsd: 0, engine: name }) };
}

test("routed: GPT answers when available, no fallback stamp", async () => {
  const routed = createRoutedAnalyst(fake("gpt-codex", async () => "gpt says"), fake("claude-cli", async () => "claude says"));
  const r = await routed.analyze({ prompt: "p" });
  assert.equal(r.engine, "gpt-codex");
  assert.equal(r.fallbackReason, undefined);
});

test("routed: falls back to Claude and carries the limit message as the reason", async () => {
  const limited: AnalystProvider = { name: "gpt-codex", analyze: async () => { throw new CodexUnavailableError("You've hit your usage limit. Try again on July 23."); } };
  const routed = createRoutedAnalyst(limited, fake("claude-cli", async () => "claude says"));
  const r = await routed.analyze({ prompt: "p" });
  assert.equal(r.engine, "claude-cli");
  assert.match(r.fallbackReason!, /July 23/);
});

test("routed: both engines failing throws a combined error naming each", async () => {
  const broken = (name: string): AnalystProvider => ({ name, analyze: async () => { throw new Error(name + " down"); } });
  const routed = createRoutedAnalyst(broken("gpt-codex"), broken("claude-cli"));
  await assert.rejects(routed.analyze({ prompt: "p" }), /gpt-codex: gpt-codex down; claude-cli: claude-cli down/);
});
