import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listFictionSeries, resolveDoc, saveFictionDoc, readFictionDoc,
  readFictionChapter, readSceneBeats, saveSceneBeats, clearSceneBeats,
} from "./fiction.js";

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

// ── chapters on the desk (v7 §2) ──
// They were deliberately left in GitHub (commit feb0ffe). The Fiction room needs the scene on
// screen, so they are readable here now, and strictly readable: the only write into a chapter is
// the scoped span patch behind "Fix the line".

function tmpSeriesWithChapters(): string {
  const root = tmpSeries();
  const dir = join(root, "the-least-of-us");
  mkdirSync(join(dir, "chapters"), { recursive: true });
  writeFileSync(join(dir, "chapters", "chapter-01.md"), '---\nseries: the-least-of-us\nchapter: 1\ntitle: "Freedom from Drudgery"\nstatus: drafting\n---\n\nThe airlock was quiet.\n');
  writeFileSync(join(dir, "chapters", "chapter-02.md"), "---\nchapter: 2\nstatus: drafting\n---\n\nHe counted the crew.\n");
  writeFileSync(join(dir, "chapters", "notes.md"), "not a chapter\n");
  return root;
}

test("chapterDocs lists chapters in order, read-only, ignoring non-chapter files", () => {
  const root = tmpSeriesWithChapters();
  try {
    const [series] = listFictionSeries(root);
    assert.deepEqual(series.chapters.map((c) => c.path), ["chapters/chapter-01.md", "chapters/chapter-02.md"]);
    assert.equal(series.chapters[0].label, "Chapter 1: Freedom from Drudgery");
    assert.equal(series.chapters[1].label, "Chapter 2");
    for (const c of series.chapters) assert.equal(c.editable, false);
    // The canon rail Muxin clicks through is untouched by the chapters.
    assert.deepEqual(series.docs.map((d) => d.id), ["bible", "outline", "canon", "characters/eli.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readFictionChapter returns the prose without the frontmatter", () => {
  const root = tmpSeriesWithChapters();
  try {
    const ch = readFictionChapter("the-least-of-us", 1, root);
    assert.equal(ch.number, 1);
    assert.equal(ch.title, "Freedom from Drudgery");
    assert.equal(ch.status, "drafting");
    assert.equal(ch.body, "The airlock was quiet.");
    assert.ok(!ch.body.includes("---"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the path-traversal guard covers the new chapter paths too", () => {
  const root = tmpSeriesWithChapters();
  try {
    assert.throws(() => resolveDoc("the-least-of-us", "chapters/../../.env", root), /no such canon doc/);
    assert.throws(() => resolveDoc("the-least-of-us", "chapters/../series.yaml", root), /no such canon doc/);
    assert.throws(() => resolveDoc("the-least-of-us", "chapters/chapter-99.md", root), /no such canon doc/);
    assert.throws(() => resolveDoc("../../etc", "chapters/chapter-01.md", root), /bad series/);
    assert.throws(() => readFictionChapter("the-least-of-us", 0, root), /bad chapter/);
    assert.throws(() => readFictionChapter("the-least-of-us", 9, root), /no such canon doc/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a chapter is never saveable through the desk, so nothing regenerates a whole file here", () => {
  const root = tmpSeriesWithChapters();
  try {
    assert.throws(
      () => saveFictionDoc("the-least-of-us", "chapters/chapter-01.md", "rewritten", root),
      /append-only|is append/,
    );
    assert.equal(readFictionDoc("the-least-of-us", "chapters/chapter-01.md", root).body.includes("The airlock was quiet."), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scene beats survive a reload, and starting a different scene drops the anchor", () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-beats-"));
  try {
    assert.equal(readSceneBeats("the-least-of-us", root), null);
    saveSceneBeats("the-least-of-us", "  Eli finds the cut line.  ", null, root);
    assert.equal(readSceneBeats("the-least-of-us", root)?.beats, "Eli finds the cut line.");
    saveSceneBeats("the-least-of-us", "Eli finds the cut line.", 2, root);
    assert.equal(readSceneBeats("the-least-of-us", root)?.chapter, 2);
    clearSceneBeats("the-least-of-us", root);
    assert.equal(readSceneBeats("the-least-of-us", root), null);
    assert.throws(() => saveSceneBeats("the-least-of-us", "   ", null, root), /say the beats/);
    assert.throws(() => saveSceneBeats("../escape", "beats", null, root), /bad series/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
