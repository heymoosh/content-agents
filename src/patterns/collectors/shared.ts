// Pattern-mining collectors: the shared contract and the shared parsing helpers.
//
// This is a separate module from registry.ts on purpose. The three adapters need these helpers,
// and registry.ts needs the three adapters, so putting both halves in one file makes an import
// cycle that throws at load (registry's collector map reads an adapter binding that is still in
// its temporal dead zone). Helpers here, wiring there, no cycle.
//
// HOW THIS DIFFERS FROM src/pull/. The adapters in src/pull/platforms/ drive Muxin's OWN
// analytics: they sign in as the account owner and download an export that carries owner-only
// numbers (impressions, opens, click-throughs). These adapters read OTHER PEOPLE'S PUBLIC posts
// from the same logged-in session. Same browser machinery (launchPlatform), same error
// vocabulary (PullError), completely different target pages and a much smaller set of numbers,
// because a non-owner sees only what the platform chooses to show in public. See the per-platform
// "WHAT IS ACTUALLY VISIBLE" block at the top of each adapter.
//
// The split inside every adapter is deliberate:
//   collect()  does the I/O, and nothing else interesting.
//   parse()    is a PURE function over a captured string. Every judgment call about what a number
//              means, and every chance to get one wrong, lives here, so it is all testable with a
//              fixture and no network.

import type { BrowserContext } from "playwright";
import type { PullPlatform } from "../../pull/types.js";
import type { CorpusEntry, Platform } from "../types.js";

// The platforms automated collection covers. It is the intersection of the pattern-mining
// platform list and the platforms that already have a logged-in browser session in src/pull/,
// which is not a coincidence: an adapter can only exist where the session machinery exists.
//
// THE VIDEO SEAM, left open on purpose. tiktok, youtube, and instagram are valid pattern-mining
// platforms and are a deliberate second pass, not an oversight. They are not stubbed here because
// a stub that returns nothing is indistinguishable from an adapter that is silently broken. When
// video collection is built, it needs its own session profile in src/pull/paths.ts first, and the
// transcript question (body is a transcript for kind: "video") answered before any of this shape
// is reused.
export type AutoPlatform = Extract<Platform, PullPlatform>;

export const AUTO_PLATFORMS: readonly AutoPlatform[] = ["x", "linkedin", "substack"] as const;

export function isAutoPlatform(value: string): value is AutoPlatform {
  return (AUTO_PLATFORMS as readonly string[]).includes(value);
}

// One account to collect from, as it appears in config/pattern-mining.yaml.
export interface CollectorAccount {
  handle: string;
  creator: string;
  niche: string;
  // Muxin's hand-entered seed. Used ONLY as a fallback when the page does not show a follower
  // count. It is a human-supplied number, not an invented one, and provenance is recorded in the
  // entry's notes when the fallback fires.
  followers: number | null;
}

export interface CollectOptions {
  // Hard cap on posts taken from this account in this run.
  limit: number;
  // Politeness delay between requests, in milliseconds.
  delayMs: number;
  // Injected so tests get a fixed collected_at instead of the wall clock.
  now?: () => Date;
  // Injected so tests do not actually wait out the politeness delay.
  sleep?: (ms: number) => Promise<void>;
}

// Why a platform was abandoned mid-run. A block is NOT an error: it is the expected, correct
// outcome of being told to back off, and the only right response is to stop asking. It is a
// return value so the runner can record it, move to the next platform, and still keep whatever
// was collected before the block.
export interface StopSignal {
  reason: "rate_limited" | "blocked";
  detail: string;
}

export interface CollectResult {
  entries: CorpusEntry[];
  stop: StopSignal | null;
}

export interface PatternCollector {
  platform: AutoPlatform;
  // Adapter identity, recorded on every entry as collected_by. BUMP THE VERSION whenever parse()
  // changes what it reads or how it reads it, so a bad batch can be found and removed later.
  name: string;
  version: string;
  // The public page this adapter reads. Printed by --dry-run so a run can be checked before it
  // touches the network.
  profileUrl(handle: string): string;
  // PURE. No I/O, no clock unless injected, no network. Given the captured page (HTML for x and
  // linkedin, JSON for substack) it returns corpus entries with every number it could actually
  // find and null everywhere else.
  parse(raw: string, account: CollectorAccount, opts?: { now?: () => Date }): CorpusEntry[];
  collect(context: BrowserContext, account: CollectorAccount, opts: CollectOptions): Promise<CollectResult>;
}

export function collectedBy(collector: Pick<PatternCollector, "name" | "version">): string {
  return `${collector.name}@${collector.version}`;
}

// ── shared parsing helpers ────────────────────────────────────────────────────────────────────

// Social platforms render counts three different ways in the same page: exact ("1,234"),
// abbreviated ("1.2K", "3.4M"), and localized with a space ("12 500"). Anything that is not a
// number we can read with confidence returns null, because a wrong number here quietly corrupts
// the outlier math, and null does not.
export function parseCompactNumber(input: string | null | undefined): number | null {
  if (input == null) return null;
  const text = String(input).trim();
  if (text === "") return null;
  // The number token may carry digit separators but NOT a plain space, and a K/M/B suffix must sit
  // directly against the digits and not be the first letter of a word. Both restrictions come from
  // a live LinkedIn reaction button reading "366  Maddy Viswanath and 365 others": a space-tolerant
  // pattern ran the number into the name and read the M of "Maddy" as millions, recording 366000000
  // likes. A plain space between digits is genuinely ambiguous between one separated number and two
  // adjacent numbers, so it is not treated as a separator here.
  const match = /(\d[\d.,\u00a0\u202f]*)([KMB])?(?![A-Za-z0-9])/i.exec(text);
  if (!match) return null;
  const rawDigits = match[1];
  const suffix = match[2]?.toUpperCase();
  // Strip thousands separators. A comma or period is a decimal point ONLY when a K/M/B suffix
  // follows it, which is the only place these platforms use one ("1.2K" is 1200, "1,234" is 1234).
  let numeric: number;
  if (suffix) {
    numeric = Number.parseFloat(rawDigits.replace(/[\u00a0\u202f]/g, "").replace(/,/g, "."));
  } else {
    numeric = Number.parseInt(rawDigits.replace(/[.,\u00a0\u202f]/g, ""), 10);
  }
  if (!Number.isFinite(numeric)) return null;
  const scale = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
  const value = Math.round(numeric * scale);
  return value >= 0 ? value : null;
}

// Pull one labelled count out of a text blob, reading the number that IMMEDIATELY PRECEDES the
// word. Works on an accessible name ("12 replies, 5 reposts, 340 likes, 12345 views") and equally
// on run-together visible text ("237 comments   5 reposts").
//
// Reading the number next to the word, rather than the first number in the blob, is not fussiness:
// on LinkedIn the comments and reposts counts share a parent element, and taking the first number
// silently reported the comment count as the repost count on every row.
//
// Returns null when the word is absent, which is the honest answer for a number the platform did
// not show us, and is very different from zero.
export function countBeforeWord(label: string | null | undefined, word: string): number | null {
  if (!label) return null;
  // The number token may contain digit separators but NOT a plain space. Allowing spaces inside
  // the number merges two adjacent counts: on a counts blob reading "1,234  56 comments" a
  // space-tolerant pattern captured "1,234 56" and reported 123456 comments. Whitespace is allowed
  // only BETWEEN the number and its word.
  const pattern = new RegExp(`([\\d.,\\u00a0\\u202f]*\\d)\\s*(?:[KMB]\\s*)?${word}`, "i");
  const match = pattern.exec(label);
  if (!match) return null;
  // Re-read the matched span including any suffix so parseCompactNumber sees "1.2K views".
  const start = match.index;
  return parseCompactNumber(label.slice(start, start + match[0].length));
}

// appendEntries dedupes on the exact url string, so two spellings of the same post would both be
// stored. Canonicalizing here is what makes a repeat run a genuine no-op: drop the query string
// and fragment (tracking parameters differ per visit), lowercase the host, fold twitter.com into
// x.com, and drop a trailing slash.
// The original name, kept because x.ts reads accessible names and that is what it is doing there.
export const countFromAriaLabel = countBeforeWord;

export function canonicalUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw.trim();
  }
  url.search = "";
  url.hash = "";
  let host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "twitter.com" || host === "mobile.twitter.com" || host === "mobile.x.com") host = "x.com";
  url.hostname = host;
  url.protocol = "https:";
  let out = url.toString();
  if (out.endsWith("/") && url.pathname !== "/") out = out.slice(0, -1);
  return out;
}

// Have we been told to back off? Checked against visible page text, never against a status code
// alone, because these platforms serve their rate-limit notice as a normal 200 page.
//
// A captcha or a human-verification challenge counts as a block. We never try to solve one and we
// never try to get around one: we stop the platform for the run and record why.
const BLOCK_PATTERNS: ReadonlyArray<[RegExp, StopSignal["reason"], string]> = [
  [/rate limit|too many requests|429/i, "rate_limited", "the platform said we are rate limited"],
  [/try again later|come back later|temporarily (?:limited|unavailable|restricted)/i, "rate_limited", "the platform asked us to come back later"],
  [/unusual (?:activity|traffic)|automated (?:queries|requests)|suspicious activity/i, "blocked", "the platform flagged the traffic as automated"],
  [/captcha|verify you are human|are you a robot|security check|prove you.{0,10}re human/i, "blocked", "the platform served a human-verification challenge"],
  [/access denied|you.{0,3}ve been blocked|blocked from accessing/i, "blocked", "the platform blocked the request"],
];

export function blockSignal(pageText: string | null | undefined): StopSignal | null {
  if (!pageText) return null;
  // Only look at the top of the page. Footer boilerplate and unrelated post text can otherwise
  // trip a false block, and a real block notice is always the main content.
  const head = pageText.slice(0, 4_000);
  for (const [pattern, reason, detail] of BLOCK_PATTERNS) {
    if (pattern.test(head)) return { reason, detail };
  }
  return null;
}

// Accumulate parsed entries across repeated captures of the SAME page, keyed by url.
//
// This exists because x and linkedin both VIRTUALIZE their timelines: as you scroll, the platform
// removes off-screen post nodes from the DOM entirely. So a fresh parse after a scroll is not the
// old posts plus the new ones, it is a moving window. Replacing the result with each parse would
// quietly throw away everything that scrolled out of view, and would also make "this parse found
// no more than the last one" fire on the first scroll. Merging by url fixes both.
//
// Returns how many urls were NEW in this batch, which is the honest "did that scroll get us
// anything" signal to stop on.
export function mergeByUrl(into: Map<string, CorpusEntry>, entries: CorpusEntry[]): number {
  let added = 0;
  for (const entry of entries) {
    if (into.has(entry.url)) continue;
    into.set(entry.url, entry);
    added++;
  }
  return added;
}

// A real, jittered pause. Jitter matters: a fixed interval is itself a bot signal, and the point
// of the delay is to look like and cost the platform no more than a person reading.
export function politeDelay(ms: number, rand: () => number = Math.random): number {
  if (ms <= 0) return 0;
  return Math.round(ms * (0.75 + rand() * 0.5));
}

export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
