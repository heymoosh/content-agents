import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLeadDirection, saveLeadDirection } from "./direction.js";

test("saved angle survives reload, appends captures once, and protects edits on retry", () => {
  const root = mkdtempSync(join(tmpdir(), "outreach-angle-"));
  const dir = "outreach/leads/peer-sam";
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, "lead.md"), "# Sam\n");
  try {
    assert.deepEqual(readLeadDirection(join(root, dir)), { text: "", captureIds: [] });
    saveLeadDirection(root, dir, "Ask about the community project.", "capture-1");
    assert.equal(readLeadDirection(join(root, dir)).text, "Ask about the community project.");
    saveLeadDirection(root, dir, "Ask about volunteering.");
    saveLeadDirection(root, dir, "Ask about the community project.", "capture-1");
    assert.equal(readLeadDirection(join(root, dir)).text, "Ask about volunteering.");
    saveLeadDirection(root, dir, "Offer a short conversation.", "capture-2");
    assert.equal(readLeadDirection(join(root, dir)).text, "Ask about volunteering.\n\nOffer a short conversation.");
    assert.throws(() => saveLeadDirection(root, dir, "x".repeat(2001)), /2000/);
    assert.equal(readLeadDirection(join(root, dir)).captureIds.length, 2);
    assert.throws(() => saveLeadDirection(root, "../elsewhere", "x"), /Invalid/);
    symlinkSync(join(root, dir), join(root, "outreach/leads/alias"));
    assert.throws(() => saveLeadDirection(root, "outreach/leads/alias", "x"), /inside/);
    saveLeadDirection(root, dir, "");
    assert.equal(readLeadDirection(join(root, dir)).text, "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
