import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { patchBody, patchChapterSpan, PatchSpanError } from "./patch.js";
import { sentencesOnLine } from "./_format.js";

const BODY = [
  "The airlock was quiet.",
  "He ran his gloved hand along the bulkhead, past the frost near the primary vent.",
  "That was when he felt it.",
  "",
  "He did not speak into the comms.",
  "The thought settled in his stomach like lead.",
].join("\n");

test("patchBody replaces the one flagged span and leaves every other line alone", () => {
  const out = patchBody(
    BODY,
    "He ran his gloved hand along the bulkhead",
    "He ran his two remaining fingers along the bulkhead",
  );
  const lines = out.split("\n");
  assert.equal(lines[0], "The airlock was quiet.");
  assert.equal(lines[1], "He ran his two remaining fingers along the bulkhead, past the frost near the primary vent.");
  assert.equal(lines[2], "That was when he felt it.");
  assert.equal(lines[3], "");
  assert.equal(lines[4], "He did not speak into the comms.");
  assert.equal(lines[5], "The thought settled in his stomach like lead.");
});

test("patchBody refuses when the span is not there at all", () => {
  assert.throws(
    () => patchBody(BODY, "he raised his ungloved hand", "he raised his two remaining fingers"),
    (e: unknown) => e instanceof PatchSpanError && /not in the chapter any more/.test((e as Error).message),
  );
});

test("patchBody refuses an ambiguous span that appears more than once", () => {
  const twice = "He did not speak.\nSomething moved.\nHe did not speak.";
  assert.throws(
    () => patchBody(twice, "He did not speak.", "He said nothing."),
    (e: unknown) => e instanceof PatchSpanError && /appears 2 times/.test((e as Error).message),
  );
});

test("patchBody refuses an empty span, an empty replacement, and an em dash", () => {
  assert.throws(() => patchBody(BODY, "", "anything"), PatchSpanError);
  assert.throws(() => patchBody(BODY, "That was when he felt it.", ""), PatchSpanError);
  assert.throws(
    () => patchBody(BODY, "That was when he felt it.", "That was when he felt it — cold."),
    (e: unknown) => e instanceof PatchSpanError && /em dash/.test((e as Error).message),
  );
});

test("patchBody keeps one sentence per line when the replacement adds a sentence", () => {
  const out = patchBody(BODY, "That was when he felt it.", "That was when he felt it. The cut was too clean.");
  const lines = out.split("\n");
  assert.equal(lines[2], "That was when he felt it.");
  assert.equal(lines[3], "The cut was too clean.");
  for (const line of lines.filter(Boolean)) assert.ok(sentencesOnLine(line) <= 1, `crammed line: ${line}`);
});

test("patchChapterSpan preserves the frontmatter block byte for byte", () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-patch-"));
  try {
    const dir = join(root, "stories", "a-series");
    mkdirSync(join(dir, "chapters"), { recursive: true });
    writeFileSync(join(dir, "series.yaml"), "slug: a-series\ntitle: A Series\n");
    // Deliberately odd spacing and key order: a rewrite through a YAML dumper would normalize it.
    const header = `---\nseries:   a-series\nchapter: 1\npov: Eli\nstatus: drafting\nword_count:   12\n---\n`;
    const abs = join(dir, "chapters", "chapter-01.md");
    writeFileSync(abs, `${header}\n${BODY}\n`);

    const result = patchChapterSpan(dir, 1, "That was when he felt it.", "That was when he knew.");
    assert.ok(result.body.includes("That was when he knew."));

    const after = readFileSync(abs, "utf8");
    assert.ok(after.startsWith(header), "frontmatter block was not preserved byte for byte");
    assert.ok(!after.includes("That was when he felt it."));
    assert.ok(after.includes("The airlock was quiet."), "untouched prose was lost");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("patchChapterSpan refuses a chapter that is not there", () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-patch-"));
  try {
    const dir = join(root, "stories", "a-series");
    mkdirSync(join(dir, "chapters"), { recursive: true });
    writeFileSync(join(dir, "series.yaml"), "slug: a-series\n");
    assert.throws(() => patchChapterSpan(dir, 9, "x", "y"), PatchSpanError);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// The replacement is a model's proposed prose, so it must land as literal text. String.prototype
// .replace reads $&, $`, $' and $$ out of a replacement STRING even when the pattern is a plain
// string, which would have spliced the flagged wording straight back into the line the patch was
// meant to clear (or dropped a stray $ into Muxin's chapter).
test("a replacement carrying $ tokens lands verbatim, never as a substitution pattern", () => {
  const dollar = "He felt $& and $` and $' and $$ at once.";
  const out = patchBody(BODY, "That was when he felt it.", dollar);
  assert.ok(out.includes(dollar), "the replacement must reach the chapter exactly as written");
  assert.ok(!out.includes("That was when he felt it."), "$& must not restore the flagged wording");
  assert.ok(!out.includes("The airlock was quiet.He"), "$` must not splice the text before the span");
});

test("each $ token on its own stays literal", () => {
  for (const text of ["Cost him $$ and a hand.", "He felt $& nothing.", "Behind him: $` silence.", "Ahead: $' nothing."]) {
    const out = patchBody(BODY, "That was when he felt it.", text);
    assert.ok(out.includes(text), `mangled: ${text}`);
  }
});
