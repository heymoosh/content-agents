import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveIntakeDraft,
  readIntakeDraft,
  readIntakeDrafts,
  clearIntakeDrafts,
  saveIntakeSectionDraft,
  readIntakeSections,
  MAX_QUESTION,
} from "./intake-draft.js";

function withRoot(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "intake-draft-test-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the interview is the fixed 25 questions", () => {
  assert.equal(MAX_QUESTION, 25);
});

test("save then read round-trips one draft", () => {
  withRoot((root) => {
    const saved = saveIntakeDraft("my-venture", 3, "half a thought", root);
    assert.equal(saved.ok, true);
    assert.equal(saved.draft?.text, "half a thought");
    assert.match(saved.draft?.savedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);

    const one = readIntakeDraft("my-venture", 3, root);
    assert.equal(one.ok, true);
    assert.equal(one.draft?.n, 3);
    assert.equal(one.draft?.text, "half a thought");
  });
});

test("reading all drafts returns them in question order", () => {
  withRoot((root) => {
    saveIntakeDraft("my-venture", 12, "twelve", root);
    saveIntakeDraft("my-venture", 2, "two", root);
    saveIntakeDraft("my-venture", 25, "twenty five", root);
    const all = readIntakeDrafts("my-venture", root);
    assert.equal(all.ok, true);
    assert.deepEqual(all.drafts.map((d) => d.n), [2, 12, 25]);
    assert.deepEqual(all.drafts.map((d) => d.text), ["two", "twelve", "twenty five"]);
  });
});

test("saving the same question again overwrites, it does not stack up", () => {
  withRoot((root) => {
    saveIntakeDraft("my-venture", 4, "first pass", root);
    saveIntakeDraft("my-venture", 4, "first pass, more of it", root);
    const all = readIntakeDrafts("my-venture", root);
    assert.equal(all.drafts.length, 1);
    assert.equal(all.drafts[0].text, "first pass, more of it");
  });
});

test("an empty string is a real save, so a cleared box restores as cleared", () => {
  withRoot((root) => {
    saveIntakeDraft("my-venture", 5, "typed something", root);
    saveIntakeDraft("my-venture", 5, "", root);
    assert.equal(readIntakeDraft("my-venture", 5, root).draft?.text, "");
  });
});

test("drafts for one venture never leak into another", () => {
  withRoot((root) => {
    saveIntakeDraft("venture-a", 1, "a's answer", root);
    saveIntakeDraft("venture-b", 1, "b's answer", root);
    assert.equal(readIntakeDraft("venture-a", 1, root).draft?.text, "a's answer");
    assert.equal(readIntakeDraft("venture-b", 1, root).draft?.text, "b's answer");
  });
});

test("a venture with no drafts reads back empty, not an error", () => {
  withRoot((root) => {
    const all = readIntakeDrafts("never-started", root);
    assert.equal(all.ok, true);
    assert.deepEqual(all.drafts, []);
  });
});

test("a question with no draft reads back null, not an error", () => {
  withRoot((root) => {
    saveIntakeDraft("my-venture", 1, "only one saved", root);
    const one = readIntakeDraft("my-venture", 9, root);
    assert.equal(one.ok, true);
    assert.equal(one.draft, null);
  });
});

test("clear removes a venture's scratch buffer", () => {
  withRoot((root) => {
    saveIntakeDraft("my-venture", 1, "written", root);
    assert.equal(existsSync(join(root, "my-venture.json")), true);
    const cleared = clearIntakeDrafts("my-venture", root);
    assert.equal(cleared.ok, true);
    assert.equal(cleared.cleared, true);
    assert.deepEqual(readIntakeDrafts("my-venture", root).drafts, []);
  });
});

test("clearing a venture that never had drafts is fine", () => {
  withRoot((root) => {
    const cleared = clearIntakeDrafts("never-started", root);
    assert.equal(cleared.ok, true);
    assert.equal(cleared.cleared, false);
  });
});

test("a bad venture name is refused on every operation", () => {
  withRoot((root) => {
    for (const slug of ["../escape", "a/b", ".hidden", "", "Upper", "/absolute", "..", "sub/dir/deep"]) {
      assert.equal(saveIntakeDraft(slug, 1, "x", root).ok, false, `save allowed ${JSON.stringify(slug)}`);
      assert.equal(readIntakeDraft(slug, 1, root).ok, false, `read allowed ${JSON.stringify(slug)}`);
      assert.equal(readIntakeDrafts(slug, root).ok, false, `read all allowed ${JSON.stringify(slug)}`);
      assert.equal(clearIntakeDrafts(slug, root).ok, false, `clear allowed ${JSON.stringify(slug)}`);
    }
    assert.match(saveIntakeDraft("../escape", 1, "x", root).error ?? "", /venture name/);
  });
});

test("a question number outside 1 to 25 is refused", () => {
  withRoot((root) => {
    for (const n of [0, 26, -1, 1.5, NaN, Infinity, 100]) {
      assert.equal(saveIntakeDraft("my-venture", n, "x", root).ok, false, `save allowed ${n}`);
      assert.equal(readIntakeDraft("my-venture", n, root).ok, false, `read allowed ${n}`);
    }
    assert.equal(saveIntakeDraft("my-venture", "3" as unknown as number, "x", root).ok, false);
    assert.match(saveIntakeDraft("my-venture", 0, "x", root).error ?? "", /1 to 25/);
    assert.equal(saveIntakeDraft("my-venture", 1, "lowest", root).ok, true);
    assert.equal(saveIntakeDraft("my-venture", 25, "highest", root).ok, true);
  });
});

test("non-text draft content is refused", () => {
  withRoot((root) => {
    assert.equal(saveIntakeDraft("my-venture", 1, null as unknown as string, root).ok, false);
    assert.equal(saveIntakeDraft("my-venture", 1, 42 as unknown as string, root).ok, false);
  });
});

test("a corrupt draft file reads back empty instead of throwing", () => {
  withRoot((root) => {
    writeFileSync(join(root, "my-venture.json"), '{"slug":"my-venture","drafts":[{"n":2,"te');
    assert.deepEqual(readIntakeDrafts("my-venture", root).drafts, []);
    assert.equal(readIntakeDraft("my-venture", 2, root).draft, null);
    // and the next save repairs the file
    assert.equal(saveIntakeDraft("my-venture", 2, "fresh", root).ok, true);
    assert.equal(readIntakeDraft("my-venture", 2, root).draft?.text, "fresh");
  });
});

test("a draft file with the wrong shape reads back empty", () => {
  withRoot((root) => {
    writeFileSync(join(root, "my-venture.json"), '"not an object"');
    assert.deepEqual(readIntakeDrafts("my-venture", root).drafts, []);
    writeFileSync(join(root, "other.json"), '{"slug":"other","drafts":"nope"}');
    assert.deepEqual(readIntakeDrafts("other", root).drafts, []);
  });
});

test("junk entries inside a draft file are dropped, good ones survive", () => {
  withRoot((root) => {
    writeFileSync(
      join(root, "my-venture.json"),
      JSON.stringify({ slug: "my-venture", drafts: [{ n: 99, text: "out of range" }, { n: 3, text: "kept" }, null, { n: 4 }] }),
    );
    const all = readIntakeDrafts("my-venture", root);
    assert.deepEqual(all.drafts.map((d) => d.n), [3]);
    assert.equal(all.drafts[0].text, "kept");
  });
});

test("saving creates the drafts directory when it does not exist yet", () => {
  withRoot((root) => {
    const nested = join(root, "not", "created", "yet");
    assert.equal(saveIntakeDraft("my-venture", 1, "x", nested).ok, true);
    assert.equal(readIntakeDraft("my-venture", 1, nested).draft?.text, "x");
  });
});

test("reading from a directory that does not exist is empty, not a crash", () => {
  withRoot((root) => {
    const missing = join(root, "no", "such", "dir");
    assert.deepEqual(readIntakeDrafts("my-venture", missing).drafts, []);
    assert.equal(readIntakeDraft("my-venture", 1, missing).draft, null);
    assert.equal(clearIntakeDrafts("my-venture", missing).cleared, false);
  });
});

test("voice and scorecard section drafts round-trip independently", () => {
  withRoot((root) => {
    const voice = saveIntakeSectionDraft("my-venture", "voice", "worldview_statement", "I believe this.", root);
    const scorecard = saveIntakeSectionDraft("my-venture", "scorecard", "ongoing_pace", "three posts a week", root);
    assert.equal(voice.ok, true);
    assert.equal(scorecard.ok, true);
    const sections = readIntakeSections("my-venture", root);
    assert.equal(sections.ok, true);
    assert.equal(sections.sections.voice.worldview_statement?.text, "I believe this.");
    assert.equal(sections.sections.scorecard.ongoing_pace?.text, "three posts a week");
  });
});

test("section drafts reject unknown fields and non-text values", () => {
  withRoot((root) => {
    assert.equal(saveIntakeSectionDraft("my-venture", "voice", "ongoing_pace", "no", root).ok, false);
    assert.equal(saveIntakeSectionDraft("my-venture", "scorecard", "unknown", "no", root).ok, false);
    assert.equal(saveIntakeSectionDraft("my-venture", "voice", "natural_phrases", 42, root).ok, false);
  });
});

test("clearing intake drafts removes both question and section buffers", () => {
  withRoot((root) => {
    saveIntakeDraft("my-venture", 1, "answer", root);
    saveIntakeSectionDraft("my-venture", "voice", "natural_phrases", "hello", root);
    const cleared = clearIntakeDrafts("my-venture", root);
    assert.equal(cleared.cleared, true);
    assert.deepEqual(readIntakeSections("my-venture", root).sections, { voice: {}, scorecard: {} });
  });
});
