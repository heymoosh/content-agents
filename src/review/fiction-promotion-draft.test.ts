import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createFictionPromotionDraft, directEdit, applyTargetedRevision,
  saveFictionPromotionDraft, loadFictionPromotionDraft,
  type FictionPromotionDraftInput,
} from "./fiction-promotion-draft.js";

const handoff = {
  id: "launch-3", origin: "fiction" as const,
  series: { id: "least-of-us", title: "The Least of Us" }, chapter: { number: 3, title: "The Door" },
  sourcePassages: [{ ref: "chapter-03:line-1", text: "The door remembered her hand.", locked: true as const }],
  restrictions: { canon: ["Preserve established canon."], provenance: ["Quote only locked passages."] },
  suggestedPromotionalObjective: "Invite readers to start.", descriptor: "A door that remembers", originalInput: "Promote chapter 3.",
  approvedPromotionBody: "Approved promotion body.",
};
const base: FictionPromotionDraftInput = {
  id: "draft-1", request: handoff, body: "The door remembered her hand.", state: "Draft",
  previews: [{ platform: "substack", media: "text", label: "Launch note" }],
};

describe("fiction promotional draft", () => {
  test("validates identity, locked provenance, and preview metadata", () => {
    const draft = createFictionPromotionDraft(base);
    assert.equal(draft.request.chapter.number, 3);
    assert.equal(draft.state, "Draft");
    assert.equal(draft.revisionHistory.length, 0);
    assert.deepEqual(draft.previews, base.previews);
  });

  test("supports direct edits and targeted AI revisions with model/instruction history", () => {
    const edited = directEdit(createFictionPromotionDraft(base), "A new direct edit.");
    assert.equal(edited.body, "A new direct edit.");
    assert.equal(edited.revisionHistory[0]?.kind, "direct-edit");
    const revised = applyTargetedRevision(edited, { body: "A sharper revision.", model: "gpt-oss", instruction: "Increase tension in the opening." });
    assert.equal(revised.body, "A sharper revision.");
    assert.deepEqual(revised.revisionHistory[1], { kind: "ai-revision", body: "A sharper revision.", model: "gpt-oss", instruction: "Increase tension in the opening." });
  });

  test("refuses unsafe or mismatched states", () => {
    assert.throws(() => createFictionPromotionDraft({ ...base, body: "" }), /body/i);
    assert.throws(() => createFictionPromotionDraft({ ...base, state: "Pending" as never }), /state/i);
    assert.throws(() => createFictionPromotionDraft({ ...base, request: { ...handoff, origin: "studio" } as never }), /fiction|origin/i);
    assert.throws(() => applyTargetedRevision(createFictionPromotionDraft(base), { body: "x", model: "", instruction: "why" }), /model/i);
  });

  test("persists atomically inside the caller-provided series directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "fiction-draft-"));
    const saved = await saveFictionPromotionDraft(root, createFictionPromotionDraft(base));
    assert.ok(saved.endsWith("/promotion-drafts/draft-1.json"));
    const loaded = await loadFictionPromotionDraft(root, "draft-1");
    assert.deepEqual(loaded, createFictionPromotionDraft(base));
    await assert.rejects(() => loadFictionPromotionDraft(root, "../escape"), /unsafe|draft/i);
    assert.match(await readFile(saved, "utf8"), /"state": "Draft"/);
  });
});
