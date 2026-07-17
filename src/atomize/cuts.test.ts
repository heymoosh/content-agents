import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addCut, cutDir, listCuts, DEFAULT_LENS } from "./cuts.js";

function tmpFolder(): string {
  return mkdtempSync(join(tmpdir(), "cuts-test-"));
}

describe("addCut: scaffolds cuts/<lens>/cut.md + derivatives/", () => {
  test("writes cut.md with lens/title/created_at frontmatter and the trimmed body", () => {
    const dir = tmpFolder();
    const out = addCut(dir, { lens: "derisk", title: 'A "quoted" title', text: "  the composed frame  \n" });
    assert.equal(out, cutDir(dir, "derisk"));
    assert.ok(existsSync(join(dir, "cuts", "derisk", "cut.md")));
    assert.ok(existsSync(join(dir, "cuts", "derisk", "derivatives")));
    const body = readFileSync(join(dir, "cuts", "derisk", "cut.md"), "utf8");
    assert.ok(body.includes("lens: derisk"));
    assert.ok(body.includes('title: "A \\"quoted\\" title"'));
    assert.ok(body.includes("the composed frame"));
    rmSync(dir, { recursive: true, force: true });
  });

  test("refuses the default lens — extract stays top-level, never a cuts/ subfolder", () => {
    const dir = tmpFolder();
    assert.throws(() => addCut(dir, { lens: DEFAULT_LENS, title: "x", text: "x" }), /never a cuts\/ subfolder/);
    rmSync(dir, { recursive: true, force: true });
  });

  test("refuses to overwrite an existing cut", () => {
    const dir = tmpFolder();
    addCut(dir, { lens: "derisk", title: "x", text: "x" });
    assert.throws(() => addCut(dir, { lens: "derisk", title: "x", text: "y" }), /already exists/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("listCuts: every non-default lens with a cut.md on disk", () => {
  test("empty when no cuts/ folder exists yet", () => {
    const dir = tmpFolder();
    assert.deepEqual(listCuts(dir), []);
    rmSync(dir, { recursive: true, force: true });
  });

  test("lists multiple lenses alphabetically", () => {
    const dir = tmpFolder();
    addCut(dir, { lens: "derisk", title: "x", text: "x" });
    addCut(dir, { lens: "counter", title: "x", text: "x" });
    assert.deepEqual(listCuts(dir), ["counter", "derisk"]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("ignores a cuts/ subfolder with no cut.md yet (in-progress scaffold)", () => {
    const dir = tmpFolder();
    mkdirSync(join(dir, "cuts", "half-built"), { recursive: true });
    assert.deepEqual(listCuts(dir), []);
    rmSync(dir, { recursive: true, force: true });
  });
});
