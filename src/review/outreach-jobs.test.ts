import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { disposableOutreachEngineAuthorized, enqueueOutreachDraft, enqueueFollowUpDraft, enqueueDirectedDraft, type OutreachDraftJobDeps } from "./outreach-jobs.js";
import { jobs } from "./jobs.js";

const deps: OutreachDraftJobDeps = {
  runDraft: async (_dir, opts) => {
    await opts?.callClaude?.("draft");
    return { dir: "outreach/leads/acme", messageFile: "messages/message-01.md", messageId: "message-01", channel: "email", evidenceIds: [] };
  },
  spawn: async (job) => ({ code: 0, timedOut: false, enoent: false, stdout: `engine=${job.engine}` }),
};

test("Outreach draft, follow-up, and directed jobs accept Grok and GPT/Codex", async () => {
  jobs.length = 0;
  await enqueueOutreachDraft("draft", "outreach/leads/acme", {}, "grok", deps);
  await enqueueFollowUpDraft("outreach/leads/acme", "email", undefined, "codex", deps);
  await enqueueDirectedDraft("outreach/leads/acme", "email", undefined, "say hello", "grok", deps);
  jobs.length = 0;
});

test("Outreach jobs reject Claude or unknown engines instead of remapping them", async () => {
  jobs.length = 0;
  assert.throws(() => enqueueOutreachDraft("draft", "outreach/leads/acme", {}, "claude" as never, deps), /Outreach engine/);
  await assert.rejects(() => enqueueDirectedDraft("outreach/leads/acme", undefined, undefined, undefined, "wat" as never, deps), /Outreach engine/);
  jobs.length = 0;
});

test("disposable Outreach engine requires the exact token, marker, and repository root", () => {
  const root = mkdtempSync(join(tmpdir(), "outreach-e2e-engine-"));
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, ".e2e-configured-engine-token"), "right");
  assert.equal(disposableOutreachEngineAuthorized({}, root), false);
  assert.equal(disposableOutreachEngineAuthorized({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: "right", E2E_REPO_ROOT: root }, root), true);
  assert.equal(disposableOutreachEngineAuthorized({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: "wrong", E2E_REPO_ROOT: root }, root), false);
  assert.equal(disposableOutreachEngineAuthorized({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: "right", E2E_REPO_ROOT: tmpdir() }, root), false);
});
