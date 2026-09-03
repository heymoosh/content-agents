import { test } from "node:test";
import assert from "node:assert/strict";
import { captureRouterPrompt, parseCaptureRouterReply, routeCapture } from "./capture-router.js";
import type { AnalystProvider } from "../providers/types.js";

const fake = (text: string, opts: { throws?: string; engine?: string; fallbackReason?: string } = {}): (() => Promise<AnalystProvider>) =>
  async () => ({
    name: "fake",
    async analyze() {
      if (opts.throws) throw new Error(opts.throws);
      return { text, costUsd: 0, engine: opts.engine ?? "fake", ...(opts.fallbackReason ? { fallbackReason: opts.fallbackReason } : {}) };
    },
  });

import { existsSync, readdirSync } from "node:fs";

const ESSAY_WITH_PRICE = "The price of attention is going up and most creators are still paying in the wrong currency.";

test("routeCapture: a valid model verdict overrides the keyword sniff", async () => {
  const r = await routeCapture(ESSAY_WITH_PRICE, { analyst: fake('{"room":"Content","reason":"An essay about attention."}', { engine: "gpt-codex" }) });
  assert.deepEqual(r.verdict, { kind: "room", room: "Content" });
  assert.equal(r.method, "model");
  assert.equal(r.reason, "An essay about attention.");
  assert.equal(r.engine, "gpt-codex");
});

test("routeCapture: JSON inside a fence or a sentence still parses", async () => {
  const r = await routeCapture("The lighthouse keeper's daughter has been lying about the storm.", {
    analyst: fake('Sure.\n```json\n{"room":"Fiction","reason":"Narrative prose."}\n```'),
  });
  assert.deepEqual(r.verdict, { kind: "room", room: "Fiction" });
  assert.equal(r.method, "model");
});

test("routeCapture: an unknown room, garbage, or a failure falls back to keywords and says why", async () => {
  for (const analyst of [fake('{"room":"Signals","reason":"x"}'), fake("no json here"), fake("", { throws: "codex timed out" })]) {
    const r = await routeCapture(ESSAY_WITH_PRICE, { analyst });
    assert.deepEqual(r.verdict, { kind: "room", room: "Venture" }, "keyword sniff answers");
    assert.equal(r.method, "keywords");
    assert.ok(r.fallbackReason, "fallback reason recorded");
  }
});

test("routeCapture: carries the analyst route's own fallback reason through", async () => {
  const r = await routeCapture(ESSAY_WITH_PRICE, { analyst: fake('{"room":"Content","reason":"essay"}', { engine: "claude-cli", fallbackReason: "codex usage limit" }) });
  assert.equal(r.fallbackReason, "codex usage limit");
});

test("routeCapture: empty text and bare links never reach the model", async () => {
  let calls = 0;
  const analyst: () => Promise<AnalystProvider> = async () => ({ name: "spy", async analyze() { calls++; return { text: "", costUsd: 0, engine: "spy" }; } });
  assert.equal((await routeCapture("   ", { analyst })).verdict.kind, "empty");
  assert.equal((await routeCapture("https://example.com/post", { analyst })).verdict.kind, "ask-link");
  assert.equal(calls, 0);
});

test("routeCapture: the model runs in an empty temp directory that is removed afterwards, and the prompt marks the capture untrusted", async () => {
  let seenCwd = "";
  let entries = -1;
  const analyst: () => Promise<AnalystProvider> = async () => ({
    name: "spy",
    async analyze(req) {
      seenCwd = req.cwd ?? "";
      entries = readdirSync(seenCwd).length;
      assert.match(req.prompt, /untrusted data/);
      return { text: '{"room":"Content","reason":"ok"}', costUsd: 0, engine: "spy" };
    },
  });
  await routeCapture(ESSAY_WITH_PRICE, { analyst });
  assert.ok(seenCwd && !seenCwd.includes("content-agents"), "not the repo");
  assert.equal(entries, 0, "empty while the model runs");
  assert.ok(!existsSync(seenCwd), "removed afterwards");
});

test("captureRouterPrompt: names the five rooms, defaults to Content, truncates long captures", () => {
  const p = captureRouterPrompt("x".repeat(10_000));
  for (const room of ["Content", "Fiction", "Outreach", "Venture", "Charles"]) assert.match(p, new RegExp(`- ${room}:`));
  assert.match(p, /choose Content/);
  assert.match(p, /\[truncated\]/);
  assert.equal(parseCaptureRouterReply('{"room":"charles","reason":"case"}'), undefined, "room names are exact");
});
