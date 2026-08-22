// The corpus store: a small reader/appender over data/patterns/corpus.jsonl.
// Deduping is by url, because the same post collected twice is the same post.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "../db/db.js";
import type { CorpusEntry } from "./types.js";

export const PATTERNS_DIR = join(repoRoot, "data", "patterns");
export const CORPUS_PATH = join(PATTERNS_DIR, "corpus.jsonl");
export const INBOX_DIR = join(PATTERNS_DIR, "inbox");

// Every path is a parameter with a real default so tests can point at a temp file and never
// touch the real corpus.
export function readCorpus(path: string = CORPUS_PATH): CorpusEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CorpusEntry);
}

export interface AppendResult {
  appended: CorpusEntry[];
  // Entries dropped because their url was already in the corpus, or repeated within this batch.
  duplicates: CorpusEntry[];
}

// Appends every entry whose url is new, in order. Duplicates inside the batch collapse to the
// first one seen, so running collect twice over the same staged files is a no-op the second time.
export function appendEntries(entries: CorpusEntry[], path: string = CORPUS_PATH): AppendResult {
  const seen = new Set(readCorpus(path).map((e) => e.url));
  const appended: CorpusEntry[] = [];
  const duplicates: CorpusEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) {
      duplicates.push(entry);
      continue;
    }
    seen.add(entry.url);
    appended.push(entry);
  }
  if (appended.length > 0) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, appended.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  }
  return { appended, duplicates };
}

export function accountKey(entry: Pick<CorpusEntry, "platform" | "handle">): string {
  return `${entry.platform}|${normalizeHandle(entry.handle)}`;
}

// One account is one handle on one platform. The same creator on two platforms is two accounts,
// because reach and baselines are not comparable across platforms.
export function groupByAccount(entries: CorpusEntry[]): Map<string, CorpusEntry[]> {
  const groups = new Map<string, CorpusEntry[]>();
  for (const entry of entries) {
    const key = accountKey(entry);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

// Stable id: <platform>-<handle>-<short hash of url>. Same url, same id, every run.
export function makeId(platform: string, handle: string, url: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 8);
  const slug = normalizeHandle(handle).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${platform}-${slug || "unknown"}-${hash}`;
}
