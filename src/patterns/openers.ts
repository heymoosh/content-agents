// The opener bank: verbatim first lines, derived from corpus entries and stored on their own.
//
// This file is the one place in the pattern pipeline that keeps another creator's EXACT wording.
// That is deliberate and narrow. Read `.claude/skills/patterns/references/remix-mode.md` before
// changing anything here: the exception covers the opener and the on-screen title, nothing else,
// and everything after the opener is still governed by the shapes-only rule in
// `.claude/skills/atomize/references/hook-patterns.md`.
//
// The derivation functions are pure. Only the read/append helpers and the CLI touch disk.
//
// Run it with `node --import tsx src/patterns/openers.ts` (a `patterns:openers` npm script is
// pending). It rebuilds the bank from the corpus and prints it ranked. Rebuilding twice is a
// no-op, the same way `patterns:collect` is, because opener ids are derived from corpus ids.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORPUS_PATH, PATTERNS_DIR, accountKey, groupByAccount, normalizeHandle, readCorpus } from "./corpus.js";
import { baselineMultiple, engagementScore } from "./outliers.js";
import type { CorpusEntry, Opener, Platform } from "./types.js";

export const OPENERS_PATH = join(PATTERNS_DIR, "openers.jsonl");

// How many lines of a text post count as the opener. Sabrina's rule for text platforms is the
// first two lines, which is also roughly what LinkedIn and Substack show above the fold.
export const TEXT_OPENER_LINES = 2;

// How many spoken sentences count as the opener on a video. Two is about three seconds of speech,
// and the second one is only taken when the first is too short to be an opener on its own.
const VIDEO_OPENER_SENTENCES = 2;
const SHORT_FIRST_SENTENCE = 40;

// Markers that say the text was cut off rather than recorded whole. The X syndication endpoint
// truncates at 279 characters with a trailing ellipsis, and a pasted body can be clipped at either
// end, so any of these landing INSIDE the opener span means the real opener is unknown.
//
// A stylistic ellipsis in a genuine opener trips this too. That is the trade we want: a false null
// costs one skipped opener, while a false positive would put a broken line into a post word for
// word. An ellipsis after the opener span is ignored, because the opening is still intact.
const TRUNCATION_MARKERS = ["…", "...", "[truncated]", "[…]", "[...]"];

function isTruncated(span: string): boolean {
  const lower = span.toLowerCase();
  return TRUNCATION_MARKERS.some((marker) => lower.includes(marker));
}

function nonEmptyLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Splits on sentence-ending punctuation, keeping the punctuation with its sentence.
function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// The verbatim opener of one entry, or null when there is no honest way to know it.
//
// Null happens in three cases, and each one matters:
//   - `transcript_source: "caption"`. The body is the creator's WRITTEN caption, not the words
//     they said. A caption is not the spoken opener, and a remix that copies it would be copying
//     the wrong thing. Same for a video entry with no transcript source recorded at all.
//   - the opener span carries a truncation marker, so the opening was not captured whole.
//   - the body is empty.
export function extractOpener(entry: CorpusEntry): string | null {
  if (entry.transcript_source === "caption") return null;

  const lines = nonEmptyLines(entry.body);
  if (lines.length === 0) return null;

  if (entry.kind === "video") {
    // "manual" and "captions" are both the spoken words. Anything else on a video is not speech.
    if (entry.transcript_source !== "manual" && entry.transcript_source !== "captions") return null;
    const spoken = sentences(lines.join(" "));
    if (spoken.length === 0) return null;
    const take = spoken[0].length < SHORT_FIRST_SENTENCE ? VIDEO_OPENER_SENTENCES : 1;
    const span = spoken.slice(0, take).join(" ");
    return isTruncated(span) ? null : span;
  }

  const span = lines.slice(0, TEXT_OPENER_LINES).join("\n");
  return isTruncated(span) ? null : span;
}

export interface BuildOpenersOptions {
  // Handles whose creator has PUBLICLY granted permission to remix their work. Everyone else gets
  // verbatim_ok: false, which is the honest default. There is no config home for this list yet;
  // it is passed in, or given to the CLI as --verbatim-ok @handle,@handle.
  verbatimOkHandles?: string[];
  // Only build openers for this platform, when set.
  platform?: Platform;
}

// Reads the recorded numbers and says, in words, what the multiple means or why there is none.
function performanceNote(multiple: number | null, entry: CorpusEntry): string {
  if (multiple !== null) return `${multiple.toFixed(1)}x this account's median post`;
  if (engagementScore(entry) === null) return "No numbers were recorded on this post";
  return "No baseline yet: this account needs at least 3 other comparably scored posts";
}

// Builds one Opener per entry that has a knowable opener. Entries whose opener cannot be known
// are skipped rather than guessed at.
//
// `onscreen_title` is always null here. CorpusEntry has no field for it, so a derived opener
// cannot carry one. A record with a real title has to be written into openers.jsonl by hand until
// collection captures it.
export function buildOpeners(entries: CorpusEntry[], options: BuildOpenersOptions = {}): Opener[] {
  const verbatimOk = new Set((options.verbatimOkHandles ?? []).map(normalizeHandle));
  const accounts = groupByAccount(entries);
  const openers: Opener[] = [];

  for (const entry of entries) {
    if (options.platform && entry.platform !== options.platform) continue;
    const opener_text = extractOpener(entry);
    if (opener_text === null) continue;

    const baseline = baselineMultiple(entry, accounts.get(accountKey(entry)) ?? []);
    const multiple = baseline?.multiple ?? null;
    openers.push({
      id: `opener-${entry.id}`,
      corpus_entry_id: entry.id,
      platform: entry.platform,
      creator: entry.creator,
      handle: entry.handle,
      url: entry.url,
      opener_text,
      onscreen_title: null,
      kind: entry.kind,
      performance: {
        multiple,
        metric: baseline?.metric ?? null,
        note: performanceNote(multiple, entry),
      },
      verbatim_ok: verbatimOk.has(normalizeHandle(entry.handle)),
      collected_at: entry.collected_at,
    });
  }

  return openers;
}

// Strongest first, by measured multiple. An opener with no multiple sorts last rather than being
// treated as a zero, because "not measured" is not "did not travel". Ties and nulls keep the order
// they came in.
export function rankOpeners(openers: Opener[]): Opener[] {
  return [...openers].sort((a, b) => {
    const left = a.performance.multiple;
    const right = b.performance.multiple;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  });
}

// Every path is a parameter with a real default so tests never touch the real bank.
export function readOpeners(path: string = OPENERS_PATH): Opener[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Opener);
}

export interface AppendOpenersResult {
  appended: Opener[];
  // Dropped because their id was already in the bank, or repeated within this batch. Ids are
  // derived from corpus ids, so a rebuild over an unchanged corpus appends nothing.
  duplicates: Opener[];
}

export function appendOpeners(openers: Opener[], path: string = OPENERS_PATH): AppendOpenersResult {
  const seen = new Set(readOpeners(path).map((o) => o.id));
  const appended: Opener[] = [];
  const duplicates: Opener[] = [];
  for (const opener of openers) {
    if (seen.has(opener.id)) {
      duplicates.push(opener);
      continue;
    }
    seen.add(opener.id);
    appended.push(opener);
  }
  if (appended.length > 0) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, appended.map((o) => JSON.stringify(o)).join("\n") + "\n", "utf8");
  }
  return { appended, duplicates };
}

interface Args {
  corpusPath: string;
  openersPath: string;
  verbatimOkHandles: string[];
  platform?: Platform;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { corpusPath: CORPUS_PATH, openersPath: OPENERS_PATH, verbatimOkHandles: [] };
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === "--corpus" && next) args.corpusPath = next;
    if (argv[i] === "--openers" && next) args.openersPath = next;
    if (argv[i] === "--platform" && next) args.platform = next as Platform;
    if (argv[i] === "--verbatim-ok" && next) {
      args.verbatimOkHandles = next.split(",").map((h) => h.trim()).filter((h) => h.length > 0);
    }
  }
  return args;
}

// The whole opener, indented for the listing. Every line of it, because a text opener is two
// lines and showing only the first would misrepresent what gets copied.
function indented(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const corpus = readCorpus(args.corpusPath);
  if (corpus.length === 0) {
    console.log(`No corpus yet at ${args.corpusPath}. Run /patterns collect first.`);
    return 0;
  }

  const built = buildOpeners(corpus, { verbatimOkHandles: args.verbatimOkHandles, platform: args.platform });
  const { appended, duplicates } = appendOpeners(built, args.openersPath);
  const skipped = corpus.filter((e) => extractOpener(e) === null).length;

  console.log(`Corpus entries: ${corpus.length}. Openers derived: ${built.length}.`);
  console.log(`Skipped (caption, truncated, or empty body): ${skipped}.`);
  console.log(`Appended: ${appended.length}. Already in the bank: ${duplicates.length}.`);

  const ranked = rankOpeners(readOpeners(args.openersPath));
  console.log("\nRanked opener bank:");
  for (const opener of ranked) {
    const permission = opener.verbatim_ok ? "verbatim_ok" : "no remix permission on record";
    const metric = opener.performance.metric ? ` (${opener.performance.metric})` : "";
    console.log(`\n  ${opener.performance.note}${metric} - ${opener.creator} (${opener.handle}), ${opener.platform}`);
    console.log("  opener, copied word for word:");
    console.log(indented(opener.opener_text));
    console.log(`  on-screen title: ${opener.onscreen_title ?? "unknown"}`);
    console.log(`  ${permission} | ${opener.url}`);
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
