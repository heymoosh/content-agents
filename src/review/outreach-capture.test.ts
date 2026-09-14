import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachOutreachCapture } from "./outreach-capture.js";
import { listCaptures, saveCapture } from "./captures.js";
import { saveLeadDirection, readLeadDirection } from "../outreach/direction.js";

test("Outreach capture attaches to the selected lead, retires the inbox task and recovers interrupted retries", () => {
  const root = mkdtempSync(join(tmpdir(), "outreach-handoff-"));
  const dir = "outreach/leads/peer-sam", path = join(root, "captures.json");
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, "lead.md"), "# Sam\n");
  try {
    const capture = saveCapture("Outreach", "Ask about the community project.", path);
    // Simulate a process stopping after the lead write but before the capture promotion.
    saveLeadDirection(root, dir, capture.text, capture.id);
    attachOutreachCapture(root, dir, capture.id, path);
    assert.equal(readLeadDirection(join(root, dir)).text, capture.text);
    assert.equal(listCaptures(path)[0]?.promotion?.itemId, dir);
    saveLeadDirection(root, dir, "Ask about volunteering.");
    attachOutreachCapture(root, dir, capture.id, path);
    assert.equal(readLeadDirection(join(root, dir)).text, "Ask about volunteering.");
    assert.throws(() => attachOutreachCapture(root, "outreach/leads/another", capture.id, path), /another lead/);
    const tooLong = saveCapture("Outreach", "x".repeat(2001), path);
    assert.throws(() => attachOutreachCapture(root, dir, tooLong.id, path), /2000/);
    assert.equal(listCaptures(path).find(c => c.id === tooLong.id)?.promotion, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
