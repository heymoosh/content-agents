import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listFictionSeries, resolveDoc, saveFictionDoc, readFictionDoc } from "./fiction.js";

function tmpSeries(): string {
  const root = mkdtempSync(join(tmpdir(), "fiction-test-"));
  const dir = join(root, "the-least-of-us");
  mkdirSync(join(dir, "characters"), { recursive: true });
  writeFileSync(join(dir, "bible.md"), "# The Least of Us, Story Bible\n\nworld text\n");
  writeFileSync(join(dir, "outline.md"), "# Outline\n\nplot\n");
  writeFileSync(join(dir, "canon.md"), "# Canon\n\n## Established facts\n");
  writeFileSync(join(dir, "characters", "eli.md"), "# Eli\n");
  writeFileSync(join(dir, "characters", "README.md"), "# readme\n");
  return root;
}

test("listFictionSeries enumerates real canon docs; canon.md is read-only; README excluded", () => {
  const root = tmpSeries();
  try {
    const [series] = listFictionSeries(root);
    assert.equal(series.title, "The Least of Us");
    const ids = series.docs.map((d) => d.id);
    assert.deepEqual(ids, ["bible", "outline", "canon", "characters/eli.md"]);
    assert.equal(series.docs.find((d) => d.id === "canon")!.editable, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDoc refuses invented paths and bad slugs; save honors the append-only ledger", () => {
  const root = tmpSeries();
  try {
    assert.throws(() => resolveDoc("the-least-of-us", "../../.env", root), /no such canon doc/);
    assert.throws(() => resolveDoc("../etc", "bible.md", root), /bad series/);
    assert.throws(() => saveFictionDoc("the-least-of-us", "canon.md", "overwrite", root), /append-only/);
    assert.throws(() => saveFictionDoc("the-least-of-us", "bible.md", "   ", root), /empty/);
    saveFictionDoc("the-least-of-us", "bible.md", "# New bible\n\nedited", root);
    assert.equal(readFictionDoc("the-least-of-us", "bible.md", root).body, "# New bible\n\nedited\n");
    assert.equal(readFileSync(join(root, "the-least-of-us", "canon.md"), "utf8").includes("overwrite"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
