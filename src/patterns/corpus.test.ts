// The corpus store. Every test writes into a temp directory, never into the real data/patterns.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { accountKey, appendEntries, groupByAccount, makeId, normalizeHandle, readCorpus } from "./corpus.js";
import type { CorpusEntry } from "./types.js";

let dir: string;
let corpusPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "patterns-corpus-"));
  corpusPath = join(dir, "corpus.jsonl");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function entry(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "x-someone-00000000",
    platform: "x",
    handle: "@someone",
    creator: "Someone",
    niche: "building-solopreneur",
    url: "https://example.com/1",
    posted_at: "2026-08-01",
    collected_at: "2026-08-20T00:00:00.000Z",
    kind: "text",
    body: "a post",
    transcript_source: null,
    metrics: { views: 1000, likes: 10, comments: 1, shares: 0, followers: 500 },
    ...overrides,
  };
}

describe("readCorpus", () => {
  test("a corpus file that does not exist yet reads as empty", () => {
    assert.deepEqual(readCorpus(corpusPath), []);
  });

  test("blank lines are skipped", () => {
    writeFileSync(corpusPath, `${JSON.stringify(entry())}\n\n`, "utf8");
    assert.equal(readCorpus(corpusPath).length, 1);
  });
});

describe("appendEntries", () => {
  test("appends new entries and reads them back whole", () => {
    const a = entry({ url: "https://example.com/a" });
    const b = entry({ url: "https://example.com/b" });
    const result = appendEntries([a, b], corpusPath);
    assert.equal(result.appended.length, 2);
    assert.equal(result.duplicates.length, 0);
    assert.deepEqual(readCorpus(corpusPath), [a, b]);
  });

  test("a url already in the corpus is skipped, so a second run appends nothing", () => {
    const a = entry({ url: "https://example.com/a" });
    appendEntries([a], corpusPath);
    const second = appendEntries([a], corpusPath);
    assert.equal(second.appended.length, 0);
    assert.equal(second.duplicates.length, 1);
    assert.equal(readCorpus(corpusPath).length, 1, "collecting the same post twice leaves one row");
  });

  test("a url repeated inside one batch collapses to the first copy", () => {
    const a = entry({ url: "https://example.com/a", body: "first" });
    const dup = entry({ url: "https://example.com/a", body: "second" });
    const result = appendEntries([a, dup], corpusPath);
    assert.equal(result.appended.length, 1);
    assert.equal(result.duplicates.length, 1);
    assert.equal(readCorpus(corpusPath)[0].body, "first");
  });

  test("appending to an existing file keeps the earlier rows intact", () => {
    appendEntries([entry({ url: "https://example.com/a" })], corpusPath);
    appendEntries([entry({ url: "https://example.com/b" })], corpusPath);
    const urls = readCorpus(corpusPath).map((e) => e.url);
    assert.deepEqual(urls, ["https://example.com/a", "https://example.com/b"]);
    assert.ok(readFileSync(corpusPath, "utf8").endsWith("\n"), "file stays newline-terminated");
  });

  test("appending nothing does not create a file", () => {
    const result = appendEntries([], corpusPath);
    assert.equal(result.appended.length, 0);
    assert.deepEqual(readCorpus(corpusPath), []);
  });
});

describe("groupByAccount", () => {
  test("groups by handle and platform together", () => {
    const entries = [
      entry({ url: "u1", handle: "@a", platform: "x" }),
      entry({ url: "u2", handle: "@a", platform: "x" }),
      entry({ url: "u3", handle: "@a", platform: "linkedin" }),
      entry({ url: "u4", handle: "@b", platform: "x" }),
    ];
    const groups = groupByAccount(entries);
    assert.equal(groups.size, 3, "the same creator on two platforms is two accounts");
    assert.equal(groups.get("x|a")!.length, 2);
    assert.equal(groups.get("linkedin|a")!.length, 1);
  });

  test("handle case and a leading @ do not split one account in two", () => {
    const groups = groupByAccount([
      entry({ url: "u1", handle: "@Someone" }),
      entry({ url: "u2", handle: "someone" }),
    ]);
    assert.equal(groups.size, 1);
    assert.equal(groups.get(accountKey({ platform: "x", handle: "@someone" }))!.length, 2);
  });

  test("an empty corpus groups into nothing", () => {
    assert.equal(groupByAccount([]).size, 0);
  });
});

describe("makeId and normalizeHandle", () => {
  test("the same url always produces the same id", () => {
    assert.equal(makeId("x", "@someone", "https://example.com/a"), makeId("x", "@someone", "https://example.com/a"));
  });

  test("a different url produces a different id", () => {
    assert.notEqual(makeId("x", "@someone", "https://example.com/a"), makeId("x", "@someone", "https://example.com/b"));
  });

  test("the id reads as platform, handle, then a short hash", () => {
    const id = makeId("tiktok", "@Some.One", "https://example.com/a");
    assert.match(id, /^tiktok-some-one-[0-9a-f]{8}$/);
  });

  test("normalizeHandle strips the @ and lowercases", () => {
    assert.equal(normalizeHandle(" @JustinWelsh "), "justinwelsh");
  });
});
