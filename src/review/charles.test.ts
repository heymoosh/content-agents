import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listCharlesPosts, readCharlesPost, saveCharlesPost, setCharlesStatus, readPersonaBrief, stampCharlesEngine } from "./charles.js";

function tmpCharles(): string {
  const root = mkdtempSync(join(tmpdir(), "charles-test-"));
  mkdirSync(join(root, "posts", "one-liners"), { recursive: true });
  mkdirSync(join(root, "posts", "essays"), { recursive: true });
  writeFileSync(join(root, "posts", "one-liners", "dapper.md"), "---\ntype: one-liner\n---\n\nFeeling quite dapper today.\n");
  writeFileSync(join(root, "posts", "essays", "cheat-sheet.md"), "---\ntype: essay\n---\n\n# So You Wish to Be an Oligarch\n");
  writeFileSync(
    join(root, "review-queue.md"),
    [
      "| id | type | file | status | notes |",
      "|----|------|------|--------|-------|",
      "| dapper | one-liner | posts/one-liners/dapper.md | pending | mood post |",
      "| cheat-sheet | essay | posts/essays/cheat-sheet.md | approve | intro essay |",
      "",
    ].join("\n")
  );
  return root;
}

test("listCharlesPosts reads every row + its draft body", () => {
  const root = tmpCharles();
  try {
    const posts = listCharlesPosts(root);
    assert.equal(posts.length, 2);
    const dapper = posts.find((p) => p.id === "dapper")!;
    assert.equal(dapper.status, "pending");
    assert.equal(dapper.body, "Feeling quite dapper today.");
    assert.ok(!dapper.body.includes("type: one-liner"), "frontmatter is metadata, not editable prose");
    const essay = posts.find((p) => p.id === "cheat-sheet")!;
    assert.equal(essay.status, "approve");
    assert.match(essay.body, /So You Wish to Be an Oligarch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stampCharlesEngine normalizes the queue column and leaves legacy rows explicitly unstamped", () => {
  const root = tmpCharles();
  try {
    stampCharlesEngine("dapper", "grok", root);
    const queue = readFileSync(join(root, "review-queue.md"), "utf8");
    assert.match(queue, /\| id \| type \| file \| status \| notes \| engine \|/);
    assert.match(queue, /\| dapper \| one-liner \| posts\/one-liners\/dapper\.md \| pending \| mood post \| grok \|/);
    assert.match(queue, /\| cheat-sheet \| essay \| posts\/essays\/cheat-sheet\.md \| approve \| intro essay \|\s+\|/);
    const posts = listCharlesPosts(root);
    assert.equal(posts.find((post) => post.id === "dapper")?.engine, "grok");
    assert.equal(posts.find((post) => post.id === "cheat-sheet")?.engine, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("setCharlesStatus flips only the targeted row's status (and notes when given)", () => {
  const root = tmpCharles();
  try {
    setCharlesStatus("dapper", "approve", undefined, root);
    const posts = listCharlesPosts(root);
    assert.equal(posts.find((p) => p.id === "dapper")!.status, "approve");
    assert.equal(posts.find((p) => p.id === "cheat-sheet")!.status, "approve"); // untouched

    setCharlesStatus("cheat-sheet", "revise", "needs a sharper walk-back", root);
    const after = readCharlesPost("cheat-sheet", root);
    assert.equal(after.status, "revise");
    assert.equal(after.notes, "needs a sharper walk-back");

    assert.throws(() => setCharlesStatus("dapper", "published", undefined, root), /bad status/);
    assert.throws(() => setCharlesStatus("nope", "approve", undefined, root), /no such post/);
    assert.throws(() => setCharlesStatus("dapper", "revise", "break | the table", root), /pipe/);
    assert.throws(() => setCharlesStatus("dapper", "revise", "break\nthe table", root), /single line/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("saveCharlesPost writes only the file the row already named; refuses an empty save", () => {
  const root = tmpCharles();
  try {
    saveCharlesPost("dapper", "Feeling QUITE dapper today, actually.\n", root);
    const saved = readFileSync(join(root, "posts", "one-liners", "dapper.md"), "utf8");
    assert.match(saved, /QUITE dapper/);
    assert.ok(saved.startsWith("---\ntype: one-liner\n---\n"), "direct edits preserve frontmatter byte for byte");
    assert.throws(() => saveCharlesPost("dapper", "   ", root), /empty/);
    assert.throws(() => saveCharlesPost("nope", "hi", root), /no such post/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readPersonaBrief returns the verbatim brief file; throws a clear error when missing", () => {
  const root = mkdtempSync(join(tmpdir(), "charles-test-"));
  try {
    assert.throws(() => readPersonaBrief(root), /no persona-brief\.md/);
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "config", "persona-brief.md"), "**PERSONA**\n\nA haughty British consultant...\n");
    assert.match(readPersonaBrief(root), /A haughty British consultant/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
