import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLockedChapterHandoff } from "./fiction-content-handoff-store.js";

async function fixture(status = "approved", body = "The door remembered her hand.\nBeyond it, the city held its breath.") {
  const root = await mkdtemp(join(tmpdir(), "fiction-handoff-"));
  const series = join(root, "the-least-of-us");
  await mkdir(join(series, "chapters"), { recursive: true });
  await writeFile(join(series, "bible.md"), "# The Least of Us Story Bible\n");
  await writeFile(join(series, "series.yaml"), "title: The Least of Us\n");
  await writeFile(join(series, "chapters", "chapter-03.md"), `---\ntitle: The Door Beneath the City\nstatus: ${status}\n---\n\n${body}\n`);
  return root;
}

describe("locked fiction chapter handoff store", () => {
  test("builds a real handoff from exactly one approved chapter and stable line refs", async () => {
    const root = await fixture();
    const handoff = await createLockedChapterHandoff({
      root, series: "the-least-of-us", chapter: 3,
      id: "fiction-launch-3", originalInput: "Promote this chapter.",
      descriptor: "A door that remembers", suggestedPromotionalObjective: "Invite readers to begin.",
    });
    assert.equal(handoff.origin, "fiction");
    assert.deepEqual(handoff.series, { id: "the-least-of-us", title: "The Least of Us" });
    assert.deepEqual(handoff.chapter, { number: 3, title: "The Door Beneath the City" });
    assert.deepEqual(handoff.sourcePassages.map((p) => p.ref), [
      "the-least-of-us/chapters/chapter-03.md:line-1", "the-least-of-us/chapters/chapter-03.md:line-2",
    ]);
    assert.ok(handoff.sourcePassages.every((p) => p.locked));
  });

  test("refuses missing, non-locked, or passage-less chapter source state", async () => {
    const draftRoot = await fixture("draft");
    assert.throws(() => createLockedChapterHandoff({ root: draftRoot, series: "the-least-of-us", chapter: 3, id: "x", originalInput: "x", descriptor: "x", suggestedPromotionalObjective: "x" }), /locked|approved/i);
    const emptyRoot = await fixture("approved", "\n\n");
    assert.throws(() => createLockedChapterHandoff({ root: emptyRoot, series: "the-least-of-us", chapter: 3, id: "x", originalInput: "x", descriptor: "x", suggestedPromotionalObjective: "x" }), /passage|empty/i);
    const missingRoot = await fixture();
    assert.throws(() => createLockedChapterHandoff({ root: missingRoot, series: "the-least-of-us", chapter: 4, id: "x", originalInput: "x", descriptor: "x", suggestedPromotionalObjective: "x" }), /chapter|source|canon/i);
  });
});
