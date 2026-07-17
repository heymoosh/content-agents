import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readQueueCached,
  enrich,
  cutBody,
  cutSetForFolder,
  saveCutBodyToFolder,
  addCutCommentToFolder,
  resolveCutCommentInFolder,
} from "./rows.js";
import { addCut } from "../atomize/cuts.js";
import type { QueueRow } from "../publish/queue.js";
import type { LiveProviderState } from "./reconcile.js";

// GET /api/queue used to re-read + re-parse EVERY content folder's review-queue.md synchronously
// on every request (Codebase review Phase 5c, P1). readQueueCached caches the parsed rows per
// folder keyed on the file's own mtime, so a request against an unchanged file reuses the parsed
// rows instead of re-reading+re-parsing — this proves both halves: a repeat read with no file
// change is a cache HIT (no re-parse), and a read after the file changes is a cache MISS (fresh
// parse, reflecting the new content), using a counting stub instead of the real markdown parser so
// the "no re-parse" half is actually provable, not just plausible.

function tmpFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), "rows-cache-test-"));
  writeFileSync(
    join(dir, "review-queue.md"),
    "| id | platform | format | asset | native | brand | cta | status | notes |\n" +
      "|---|---|---|---|---|---|---|---|---|\n" +
      "| x-1 | x | text | derivatives/x-1.md | | | | pending | |\n",
  );
  return dir;
}

test("readQueueCached: a repeat read with NO file change reuses the cached rows (no re-parse)", () => {
  const folder = tmpFolder();
  try {
    const row: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "—", status: "pending", notes: "", lineIndex: 2 };
    let calls = 0;
    const parse = (_f: string) => {
      calls++;
      return { rows: [row] };
    };

    const first = readQueueCached(folder, parse);
    assert.equal(calls, 1, "first read parses once");
    assert.deepEqual(first, [row]);

    const second = readQueueCached(folder, parse);
    assert.equal(calls, 1, "second read against an unchanged file must NOT re-parse");
    assert.deepEqual(second, [row]);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("readQueueCached: invalidates once the file's mtime changes, returning fresh rows", () => {
  const folder = tmpFolder();
  try {
    const before: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "—", status: "pending", notes: "", lineIndex: 2 };
    const after: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "—", status: "approve", notes: "", lineIndex: 2 };
    let calls = 0;
    let current = before;
    const parse = (_f: string) => {
      calls++;
      return { rows: [current] };
    };

    const first = readQueueCached(folder, parse);
    assert.equal(calls, 1);
    assert.equal(first[0].status, "pending");

    // Modify the file's content AND force its mtime forward, so this can't flake on filesystems/CI
    // where two writes in quick succession land in the same mtime tick.
    current = after;
    writeFileSync(join(folder, "review-queue.md"), "changed\n");
    const bumped = new Date(statSync(join(folder, "review-queue.md")).mtimeMs + 1000);
    utimesSync(join(folder, "review-queue.md"), bumped, bumped);

    const second = readQueueCached(folder, parse);
    assert.equal(calls, 2, "a changed mtime must trigger a fresh parse");
    assert.equal(second[0].status, "approve", "the second read must reflect the new content, not the stale cache");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// canGenerateStoryboard / duplicatable (Codebase review Phase 2, "GUI actions"): the two new
// per-row flags that drive the "Generate storyboard" and "Duplicate to platform" buttons.

const NO_LIVE: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [] };
const videoScriptRow = (): QueueRow => ({
  id: "video-script", platform: "video-script", format: "storyboard", asset: "—",
  status: "pending", notes: "", lineIndex: 0,
});

test("canGenerateStoryboard is true for a video-script row before video/storyboard.md exists", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-storyboard-test-"));
  try {
    mkdirSync(join(folder, "video"), { recursive: true });
    writeFileSync(join(folder, "video", "script-draft.md"), "---\nkind: video-script-draft\n---\n\nsome script\n");
    const out = enrich(folder, "demo", videoScriptRow(), { text: "" }, NO_LIVE);
    assert.equal(out.canGenerateStoryboard, true);
    assert.equal(out.duplicatable, false); // storyboard rows are never duplicatable
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("canGenerateStoryboard is false once video/storyboard.md already exists", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-storyboard-test-"));
  try {
    mkdirSync(join(folder, "video"), { recursive: true });
    writeFileSync(join(folder, "video", "storyboard.md"), "---\nkind: storyboard\n---\n\n## Script\nhi\n");
    const out = enrich(folder, "demo", videoScriptRow(), { text: "" }, NO_LIVE);
    assert.equal(out.canGenerateStoryboard, false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("canGenerateStoryboard is false for a non-storyboard row (never offered outside the video path)", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-storyboard-test-"));
  try {
    const textRow: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 0 };
    const out = enrich(folder, "demo", textRow, { text: "" }, NO_LIVE);
    assert.equal(out.canGenerateStoryboard, false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("duplicatable is true for a real text derivative with a body on disk", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-duplicate-test-"));
  try {
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    writeFileSync(join(folder, "derivatives", "x-1.md"), "---\nplatform: x\nspin: true\nangle: x\n---\n\nSome post body.\n");
    const row: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 0 };
    const out = enrich(folder, "demo", row, { text: "" }, NO_LIVE);
    assert.equal(out.duplicatable, true);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("duplicatable is false for a text row whose derivative file doesn't exist yet (nothing to duplicate)", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-duplicate-test-"));
  try {
    const row: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 0 };
    const out = enrich(folder, "demo", row, { text: "" }, NO_LIVE);
    assert.equal(out.duplicatable, false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// Outreach Phase 2 (docs/outreach-engine-plan.md §6): a lead's review-queue.md row for a
// drafted message reuses the SAME enrich() the Review tab uses for every other row — no second
// parser. kind classification + body loading off messages/<id>.md, never derivatives/<id>.md.
test("enrich() classifies an outreach-message row and loads its body from messages/<id>.md", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-outreach-test-"));
  try {
    mkdirSync(join(folder, "messages"), { recursive: true });
    writeFileSync(
      join(folder, "messages", "message-01.md"),
      "---\nlead: client-acme-co\nchannel: email\nevidence: [E1]\nclassification: greenfield\nstatus: draft\n---\n\nHi there.\n",
    );
    const row: QueueRow = {
      id: "message-01", platform: "email", format: "outreach-message", asset: "messages/message-01.md",
      status: "pending", notes: "", lineIndex: 0,
    };
    const out = enrich(folder, "client-acme-co", row, { text: "" }, NO_LIVE);
    assert.equal(out.kind, "outreach-message");
    assert.equal(out.hasAsset, true);
    assert.equal(out.body, "Hi there.");
    // never editable/revisable/duplicatable in this phase (no in-place edit, no "Ask Claude",
    // no re-angling flow defined for outreach messages) — Approve/Discard are the only actions.
    assert.equal(out.editable, false);
    assert.equal(out.revisable, false);
    assert.equal(out.duplicatable, false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("duplicatable is false for an image (quote-card) row, even with an asset on disk", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-duplicate-test-"));
  try {
    mkdirSync(join(folder, "images"), { recursive: true });
    writeFileSync(join(folder, "images", "quote-card-1.png"), Buffer.from([0]));
    const row: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "images/quote-card-1.png", status: "pending", notes: "", lineIndex: 0 };
    const out = enrich(folder, "demo", row, { text: "" }, NO_LIVE);
    assert.equal(out.duplicatable, false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// ── Cuts tab (Stage 1 "Proof Sheet") ──

test("cutBody: extract reads extracts.md, returns null before it's drafted", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    assert.equal(cutBody(folder, "extract"), null);
    writeFileSync(join(folder, "extracts.md"), "1. a quotable line\n2. another\n");
    assert.equal(cutBody(folder, "extract"), "1. a quotable line\n2. another\n");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cutBody: a non-default lens reads cuts/<lens>/cut.md's body, frontmatter stripped", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    addCut(folder, { lens: "derisk", title: "t", text: "the composed frame" });
    const body = cutBody(folder, "derisk");
    assert.ok(body?.includes("the composed frame"));
    assert.ok(!body?.includes("lens: derisk"));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cutSetForFolder: null when nothing's drafted yet", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    assert.equal(cutSetForFolder(folder, "demo"), null);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cutSetForFolder: extract + an additional lens, each with its own comments", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    writeFileSync(join(folder, "extracts.md"), "extract body");
    addCut(folder, { lens: "derisk", title: "t", text: "derisk body" });
    addCutCommentToFolder(folder, "derisk", 1, "tighten this");
    const cuts = cutSetForFolder(folder, "demo");
    assert.equal(cuts?.length, 2);
    const extract = cuts?.find((c) => c.lens === "extract");
    const derisk = cuts?.find((c) => c.lens === "derisk");
    assert.equal(extract?.body, "extract body");
    assert.deepEqual(extract?.comments, []);
    assert.ok(derisk?.body.includes("derisk body"));
    assert.equal(derisk?.comments.length, 1);
    assert.equal(derisk?.comments[0].text, "tighten this");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("saveCutBodyToFolder: overwrites extracts.md whole", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    writeFileSync(join(folder, "extracts.md"), "old body");
    saveCutBodyToFolder(folder, "extract", "  new body  \n");
    assert.equal(cutBody(folder, "extract"), "new body\n");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("saveCutBodyToFolder: a non-default lens keeps its frontmatter, replaces only the body", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    addCut(folder, { lens: "derisk", title: "t", text: "old" });
    saveCutBodyToFolder(folder, "derisk", "revised frame");
    const body = cutBody(folder, "derisk");
    assert.ok(body?.includes("revised frame"));
    assert.ok(!body?.includes("old"));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("saveCutBodyToFolder: throws for a lens with no cut.md on disk", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    assert.throws(() => saveCutBodyToFolder(folder, "derisk", "x"), /no such cut/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("saveCutBodyToFolder / cutBody: a path-traversal lens is rejected before it ever reaches join() (self-vet finding)", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    const evilLens = "../../../../tmp/rows-cuts-escape-marker";
    assert.throws(() => saveCutBodyToFolder(folder, evilLens, "pwned"), /bad lens/);
    assert.equal(cutBody(folder, evilLens), null);
    assert.equal(cutBody(folder, "UPPERCASE"), null); // not a valid slug either
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("addCutCommentToFolder: a path-traversal-shaped lens is rejected too, even though it's only ever used as a JSON key", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    assert.throws(() => addCutCommentToFolder(folder, "../escape", 1, "x"), /bad lens/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("addCutCommentToFolder / resolveCutCommentInFolder: round-trip, scoped per lens", () => {
  const folder = mkdtempSync(join(tmpdir(), "rows-cuts-test-"));
  try {
    const c1 = addCutCommentToFolder(folder, "extract", 3, "cut this line");
    addCutCommentToFolder(folder, "derisk", 1, "unrelated, different lens");
    assert.equal(c1.line, 3);
    assert.equal(c1.resolved, false);
    let cuts = cutSetForFolder(folder, "demo");
    // no extracts.md/cut.md drafted yet — comments alone don't manufacture a cut view
    assert.equal(cuts, null);
    writeFileSync(join(folder, "extracts.md"), "body");
    cuts = cutSetForFolder(folder, "demo");
    const extract = cuts?.find((c) => c.lens === "extract");
    assert.equal(extract?.comments.length, 1);
    assert.ok(resolveCutCommentInFolder(folder, "extract", c1.id));
    cuts = cutSetForFolder(folder, "demo");
    assert.equal(cuts?.find((c) => c.lens === "extract")?.comments[0].resolved, true);
    assert.equal(resolveCutCommentInFolder(folder, "extract", "no-such-id"), false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
