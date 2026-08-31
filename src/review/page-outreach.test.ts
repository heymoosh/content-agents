import { test } from "node:test";
import assert from "node:assert/strict";
import {
  followupDraftRequest,
  outreachDraftRequest,
  outreachMessageReviseRequest,
  isOutreachEngine,
  OUTREACH_ENGINE_OPTIONS,
  type OutreachEngine,
  renderOutreachRecommendations,
  renderSelectedOutreachComposer,
} from "./page-outreach.js";

test("Outreach request builders default to GPT/Codex", () => {
  assert.equal(followupDraftRequest("outreach/leads/acme").engine, "codex");
  assert.equal(outreachDraftRequest("outreach/leads/acme", "ask for a chat").engine, "codex");
  assert.equal(outreachMessageReviseRequest("outreach/leads/acme", "messages/message-01.md", "shorter").engine, "codex");
});

test("Outreach request builders accept Grok and GPT/Codex only", () => {
  for (const engine of ["grok", "codex"] as OutreachEngine[]) {
    assert.equal(followupDraftRequest("outreach/leads/acme", undefined, engine).engine, engine);
    assert.equal(outreachDraftRequest("outreach/leads/acme", "hello", undefined, engine).engine, engine);
    assert.equal(outreachMessageReviseRequest("outreach/leads/acme", "messages/message-01.md", "warmer", engine).engine, engine);
  }
  assert.equal(isOutreachEngine("claude"), false);
  assert.equal(isOutreachEngine("unsupported"), false);
});

test("Outreach request builders reject Claude and unknown engines", () => {
  assert.throws(() => followupDraftRequest("outreach/leads/acme", undefined, "claude"), /Outreach engine/);
  assert.throws(() => outreachDraftRequest("outreach/leads/acme", "hello", undefined, "claude"), /Outreach engine/);
  assert.throws(() => outreachMessageReviseRequest("outreach/leads/acme", "messages/message-01.md", "warmer", "wat"), /Outreach engine/);
});

test("Outreach helper copy names ChatGPT and Grok, not Claude", () => {
  assert.deepEqual(OUTREACH_ENGINE_OPTIONS.map((option) => option.label), ["ChatGPT", "Grok"]);
});

test("Outreach recommendation markup excludes poor-fit leads", () => {
  const html = renderOutreachRecommendations([
    { dir: "outreach/leads/good", kind: "client", name: "Good", classification: "greenfield", pitchAngle: "A useful angle" },
    { dir: "outreach/leads/bad", kind: "client", name: "Bad", classification: "unclear", pitchAngle: "Do not show" },
  ]);
  assert.match(html, /Good/);
  assert.doesNotMatch(html, /Bad|Do not show/);
});

test("selected Outreach composer includes concise fit, direction, model, contact, and manual-send controls", () => {
  const html = renderSelectedOutreachComposer({
    dir: "outreach/leads/good", kind: "client", name: "Good", classification: "greenfield",
    whyMutual: "We share a useful overlap.", pitchAngle: "Lead with the overlap.",
    contacts: [{ name: "Rae", role: "Founder" }],
  }, { account: "other@example.com", authenticated: true, sendPermission: true });
  for (const text of ["Good", "We share a useful overlap.", "Lead with the overlap.", "Rae", "ChatGPT", "Grok", "Copy message", "I sent this by hand"]) assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(html, /Claude/);
  assert.match(html, /textarea[^>]+id="outreachDirection"/);
});

test("selected Outreach is a lightweight yes-or-no message workspace", () => {
  const html = renderSelectedOutreachComposer({
    dir: "outreach/leads/good", kind: "client", name: "Good", classification: "greenfield",
    whyMutual: "We share a useful overlap.", pitchAngle: "Lead with the overlap.",
  });
  assert.match(html, /Interested/);
  assert.match(html, /Not for me/);
  assert.match(html, /Message to edit before sending/);
  assert.match(html, /textarea[^>]+id="outreachMessageEditor"/);
  assert.match(html, /details[^>]+class="outreach-why"/);
});

test("Outreach does not advertise a Gmail send path", () => {
  const html = renderSelectedOutreachComposer({ dir: "outreach/leads/good", kind: "client", classification: "greenfield" }, {
    account: "muxin.li.pro@gmail.com", authenticated: true, sendPermission: true,
  });
  assert.doesNotMatch(html, /Gmail|Connect Gmail|outreach-send/);
  assert.match(html, /outreach-copy/);
  assert.match(html, /outreach-mark-sent/);
});
