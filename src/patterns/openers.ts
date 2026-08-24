// The opener bank: captured first lines, derived from corpus entries and stored on their own.
//
// This is an analysis evidence bank. It may retain another creator's captured wording so Muxin can
// inspect the source and identify a common hook mechanism. Read
// `.claude/skills/patterns/references/remix-mode.md` before changing anything here: generated
// output adapts a common template into Muxin's own words. Exact text is for analysis, quotation,
// attribution, or a licensed exception only.
//
// The derivation functions are pure. Only the read/append helpers and the CLI touch disk.
//
// Run it with `npm run patterns:openers`. It rebuilds the bank from the corpus and prints it
// ranked. Rebuilding twice appends nothing, the same way `patterns:collect` is a no-op the second
// time, because opener ids are derived from corpus ids.
//
// Everything here is DERIVED. To pick up a newly recorded on-screen title, a corrected
// `body_is_complete`, or a new `verbatim_ok` grant, delete data/patterns/openers.jsonl and rebuild.
// Never hand-edit the bank: the corpus entry is where a fact belongs, and a hand-edit there is
// silently overwritten by nothing and silently ignored by everything.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORPUS_PATH, PATTERNS_DIR, accountKey, groupByAccount, normalizeHandle, readCorpus } from "./corpus.js";
import { loadConfig } from "./collect.js";
import { loadBaselineIndex } from "./baselines.js";
import { baselineMultiple, engagementScore, isWinnersOnlySample, recordedBaselineMultiple } from "./outliers.js";
import type { AccountBaseline, CorpusEntry, Opener, OpenerWarning, PatternMiningConfig, Platform } from "./types.js";

export const OPENERS_PATH = join(PATTERNS_DIR, "openers.jsonl");

// How many lines of a text post count as the opener. The first two lines are a practical
// above-the-fold evidence window for text platforms such as LinkedIn and Substack.
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

// A body this short is probably a caption sitting over an image, a carousel, or a video, none of
// which the corpus collects. Dan Koe's strongest LinkedIn post in the current corpus is a
// 22-character caption over an image, and its numbers were earned by the image. A genuinely short
// post that worked on its own words looks identical from here, so this is a warning shown to Muxin
// rather than a rule the code applies on her behalf.
const SHORT_BODY_CHARS = 80;

// Platforms where slide text, frame text, and on-screen text carry the post, and where none of
// that is collected today. An Instagram carousel's likes were earned by images nobody retrieved.
const MEDIA_FIRST_PLATFORMS: ReadonlySet<Platform> = new Set<Platform>(["instagram", "tiktok", "youtube"]);

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
// Null happens in four cases, and each one matters:
//   - `transcript_source: "caption"`. The body is the creator's WRITTEN caption, not the words
//     they said. A caption is not the spoken opener, and a remix that copies it would be copying
//     the wrong thing. Same for a video entry with no transcript source recorded at all.
//   - the opener span carries a truncation marker, so the opening was not captured whole.
//   - the whole body ends on a colon. That is the thread-opener tell: the post promises what comes
//     next and the substance is in reply posts the corpus never collected. A colon in the MIDDLE
//     of a post is ordinary writing and is left alone, so the check is on the whole trimmed body,
//     not on the opener span.
//   - the body is empty.
//
// What is NOT null here, on purpose: a short body, a media-first platform, and a body cut off
// after the opener. Those come back as warnings from `openerWarnings`, because the opener itself
// is knowable and the doubt is Muxin's to weigh. See remix-mode.md.
export function extractOpener(entry: CorpusEntry): string | null {
  if (entry.transcript_source === "caption") return null;

  const lines = nonEmptyLines(entry.body);
  if (lines.length === 0) return null;
  if (entry.body.trim().endsWith(":")) return null;

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

// Reasons to doubt an opener whose text is still knowable. Order is deliberate: the two that
// decide a refusal in `/patterns remix` come first, so the first line Muxin reads is the one that
// might stop the pick.
export function openerWarnings(entry: CorpusEntry): OpenerWarning[] {
  const warnings: OpenerWarning[] = [];
  const body = entry.body.trim();
  const media = entry.media;

  // A recorded observation beats both guesses. `media` present means someone looked at the post,
  // so the body-length and platform priors below have nothing left to add and are skipped.
  if (media) {
    if (!media.body_is_complete) {
      const title = media.onscreen_text === null ? "and its on-screen text was not captured" : "though its on-screen text WAS captured";
      warnings.push({
        code: "substance-outside-body",
        note: `Someone looked at this post: its form is ${media.form}, and its substance is not in the collected body, ${title}. Using this fragment as hook evidence could miss what actually worked.`,
      });
    }
  } else {
    if (body.length < SHORT_BODY_CHARS) {
      warnings.push({
        code: "short-body",
        note: `Nobody has recorded what this post looked like, and the whole body is ${body.length} characters, short enough to be a caption over an image, a carousel, or a video that was never collected. If it is, its numbers were earned by something outside this text.`,
      });
    }

    if (MEDIA_FIRST_PLATFORMS.has(entry.platform)) {
      warnings.push({
        code: "media-first-platform",
        note: `Nobody has recorded what this post looked like, and on ${entry.platform} the slide, frame, and on-screen text usually carry the post. The body alone may not be what worked.`,
      });
    }
  }

  // A media-first post with no captured on-screen text is missing part of the hook evidence. Form
  // "none" means someone looked and found no media at all, which is not a gap.
  const mediaCarriesTitle = media ? media.form !== "text-only" && media.form !== "thread" : entry.kind === "video";
  if (mediaCarriesTitle && (media?.onscreen_text ?? null) === null) {
    warnings.push({
      code: "missing-onscreen-title",
      note: "No on-screen title on record. Read the original if the visual hook matters, then record the evidence before selecting a template.",
    });
  }

  if (TRUNCATION_MARKERS.some((marker) => body.toLowerCase().endsWith(marker))) {
    warnings.push({
      code: "truncated-body",
      note: "The opener is intact but the body was cut off later, so the rest of the post is not fully known.",
    });
  }

  return warnings;
}

export interface BuildOpenersOptions {
  // Handles with a PUBLIC attribution/licensing grant for intentional verbatim quotation. Common
  // template adaptation does not require this flag. The durable list lives in
  // config/pattern-mining.yaml under `verbatim_ok`, each entry citing its grant; the CLI reads it
  // from there and `--verbatim-ok @handle` adds one ad hoc on top.
  verbatimOkHandles?: string[];
  // Only build openers for this platform, when set.
  platform?: Platform;
  // Measured baselines by account key, from data/patterns/baselines.jsonl. Where an account has
  // one, the multiple shown next to its opener is measured against the account's true typical
  // post instead of against the account's other collected entries. That matters most on reddit,
  // where every collected entry is a top-of-year post, so the sibling number understates a winner
  // by three orders of magnitude and Muxin would be picking openers off it.
  baselines?: Map<string, AccountBaseline>;
}

// Reads the recorded numbers and says, in words, what the multiple means or why there is none.
// The wording names which denominator was used, because "12x an ordinary post in this community"
// and "12x this account's other collected winners" are different claims and only one of them is
// a fact about the platform.
function performanceNote(multiple: number | null, entry: CorpusEntry, measured: boolean, winnersOnly: boolean): string {
  if (multiple !== null) {
    return measured
      ? `${multiple.toFixed(1)}x an ordinary post on this account, measured against a real baseline`
      : `${multiple.toFixed(1)}x this account's median COLLECTED post, which is not the same as a typical one`;
  }
  if (engagementScore(entry) === null) return "No numbers were recorded on this post";
  if (winnersOnly) {
    return "No baseline yet: every collected post on this account was picked for having travelled, so their median is a median of winners";
  }
  return "No baseline yet: this account needs at least 3 other comparably scored posts";
}

// Builds one Opener per entry that has a knowable opener. Entries whose opener cannot be known
// are skipped rather than guessed at.
//
// `onscreen_title` comes from the entry's `media.onscreen_text` and is null when no media was
// recorded or its on-screen text was not retrievable. Null means unknown, never "probably
// something like this", so a remix says unknown rather than inventing a title.
export function buildOpeners(entries: CorpusEntry[], options: BuildOpenersOptions = {}): Opener[] {
  const verbatimOk = new Set((options.verbatimOkHandles ?? []).map(normalizeHandle));
  const accounts = groupByAccount(entries);
  const openers: Opener[] = [];

  for (const entry of entries) {
    if (options.platform && entry.platform !== options.platform) continue;
    const opener_text = extractOpener(entry);
    if (opener_text === null) continue;

    const accountEntries = accounts.get(accountKey(entry)) ?? [];
    const measured = options.baselines?.get(accountKey(entry)) ?? null;
    const winnersOnly = isWinnersOnlySample(accountEntries);
    // Same order of preference as the outlier step: a measured baseline first, siblings only where
    // the collection does not declare itself winners-only, and otherwise no number at all.
    const recorded = measured ? recordedBaselineMultiple(entry, measured) : null;
    const baseline = recorded ?? (winnersOnly ? null : baselineMultiple(entry, accountEntries));
    const multiple = baseline?.multiple ?? null;
    openers.push({
      id: `opener-${entry.id}`,
      corpus_entry_id: entry.id,
      platform: entry.platform,
      creator: entry.creator,
      handle: entry.handle,
      url: entry.url,
      opener_text,
      // Captured verbatim from the entry, and null when nobody captured it. Never derived or
      // guessed: this is evidence for template selection, not generated copy.
      onscreen_title: entry.media?.onscreen_text ?? null,
      kind: entry.kind,
      performance: {
        multiple,
        metric: baseline?.metric ?? null,
        note: performanceNote(multiple, entry, recorded !== null, winnersOnly),
      },
      verbatim_ok: verbatimOk.has(normalizeHandle(entry.handle)),
      warnings: openerWarnings(entry),
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
  configPath?: string;
  verbatimOkHandles: string[];
  platform?: Platform;
}

// The durable grant list, from config/pattern-mining.yaml. Absent means nobody, which is the
// honest default: no grant on record, no verbatim reuse.
export function grantedHandles(config: PatternMiningConfig): string[] {
  return (config.verbatim_ok ?? []).map((grant) => grant.handle);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { corpusPath: CORPUS_PATH, openersPath: OPENERS_PATH, verbatimOkHandles: [] };
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === "--corpus" && next) args.corpusPath = next;
    if (argv[i] === "--openers" && next) args.openersPath = next;
    if (argv[i] === "--platform" && next) args.platform = next as Platform;
    if (argv[i] === "--config" && next) args.configPath = next;
    if (argv[i] === "--verbatim-ok" && next) {
      args.verbatimOkHandles = next.split(",").map((h) => h.trim()).filter((h) => h.length > 0);
    }
  }
  return args;
}

// The whole opener, indented for the evidence listing. Every line of it, because a text opener is
// two lines and showing only the first would misrepresent the captured source.
function indented(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

// "unknown" and "there is no title" are different facts, and only the first one asks Muxin to go
// look. The missing-onscreen-title warning is what separates them.
function onscreenTitleLine(opener: Opener): string {
  if (opener.onscreen_title !== null) return opener.onscreen_title;
  const missing = opener.warnings.some((w) => w.code === "missing-onscreen-title");
  return missing ? "unknown, read it off the original" : "none on this post";
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const corpus = readCorpus(args.corpusPath);
  if (corpus.length === 0) {
    console.log(`No corpus yet at ${args.corpusPath}. Run /patterns collect first.`);
    return 0;
  }

  const granted = grantedHandles(loadConfig(args.configPath));
  const built = buildOpeners(corpus, {
    verbatimOkHandles: [...granted, ...args.verbatimOkHandles],
    platform: args.platform,
    baselines: loadBaselineIndex(),
  });
  const { appended, duplicates } = appendOpeners(built, args.openersPath);
  const skipped = corpus.filter((e) => extractOpener(e) === null).length;

  console.log(`Corpus entries: ${corpus.length}. Openers derived: ${built.length}.`);
  console.log(`Attribution/licensing grants on record: ${granted.length === 0 ? "none" : granted.join(", ")}.`);
  console.log(`Skipped (caption, truncated opening, thread opener, or empty body): ${skipped}.`);
  console.log(`Appended: ${appended.length}. Already in the bank: ${duplicates.length}.`);

  const ranked = rankOpeners(readOpeners(args.openersPath));
  console.log("\nRanked opener bank:");
  for (const opener of ranked) {
    const permission = opener.verbatim_ok ? "attribution/licensing grant on record" : "common-template adaptation allowed";
    const metric = opener.performance.metric ? ` (${opener.performance.metric})` : "";
    console.log(`\n  ${opener.performance.note}${metric} - ${opener.creator} (${opener.handle}), ${opener.platform}`);
    console.log("  captured opener evidence (verbatim):");
    console.log(indented(opener.opener_text));
    console.log(`  on-screen title: ${onscreenTitleLine(opener)}`);
    console.log(`  ${permission} | ${opener.url}`);
    for (const warning of opener.warnings) console.log(`  WARNING (${warning.code}): ${warning.note}`);
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
