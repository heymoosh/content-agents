// Backfills real upvote and comment counts onto reddit entries that were staged without them.
//
// WHY THIS EXISTS.
//
// The RSS collector (src/patterns/reddit-rss.ts) is the only route that returns post BODIES
// without an API key, and it publishes no numbers at all. The browser route is the opposite: a
// real logged-out browser on www.reddit.com/r/<sub>/top/?t=year renders Reddit's own
// <shreddit-post> web components, and those carry `score`, `comment-count` and `upvote-ratio` as
// plain DOM attributes, but shipping 100KB of post text back through that channel is not
// practical. So each route supplies what it is good at and this file joins them.
//
// THE JOIN KEY IS THE POST ID, never the url. RSS publishes www.reddit.com permalinks, the corpus
// stores old.reddit.com urls, and the browser reports a `t3_<id>` element id. All three contain
// the same base36 post id, so that is what the two sides are matched on. Matching on url strings
// would fail on the host difference alone. Measured on the 2026-08-23 pass: 225 of 225 matched.
//
// An entry that cannot be matched keeps its nulls. A null here means "this route could not see
// the number", which is a statement worth preserving, and inventing one would defeat the entire
// point of the baseline work this corpus exists to support.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CorpusEntry } from "./types.js";

// One post's numbers as read off the rendered listing. Everything is a number or null; no text.
export interface BrowserMeasurement {
  id: string;
  rank: number;
  score: number;
  comments: number;
  ratio: number | null;
  postType: string | null;
  date: string | null;
}

// The base36 post id out of any reddit url or fullname: a permalink, an old.reddit url, or
// "t3_1o4u9wk". Returns null rather than a guess when there is no id to find.
export function postIdFrom(value: string): string | null {
  const fromComments = /\/comments\/([a-z0-9]+)(?:\/|$)/i.exec(value);
  if (fromComments) return fromComments[1].toLowerCase();
  const fromFullname = /^t3_([a-z0-9]+)$/i.exec(value.trim());
  if (fromFullname) return fromFullname[1].toLowerCase();
  return null;
}

// Parses the pipe-delimited measurement files written from the browser pass. The header line is
// required and names the columns, so a file whose shape changes fails loudly instead of silently
// loading the wrong column as a score.
export function parseMeasurements(text: string): BrowserMeasurement[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
  if (lines.length === 0) return [];
  const header = lines[0].split("|");
  if (header[0] !== "rank" || header[1] !== "id" || header[2] !== "score" || header[3] !== "comments") {
    throw new Error(`Measurement file header must start rank|id|score|comments, got: ${lines[0]}`);
  }
  const out: BrowserMeasurement[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split("|");
    const score = Number(f[2]);
    const comments = Number(f[3]);
    if (!Number.isFinite(score) || !Number.isFinite(comments)) continue;
    const ratio = Number(f[4]);
    out.push({
      rank: Number(f[0]),
      id: f[1].toLowerCase(),
      score,
      comments,
      ratio: Number.isFinite(ratio) ? ratio : null,
      postType: f[5] ?? null,
      date: f[6] ?? null,
    });
  }
  return out;
}

export function measurementIndex(measurements: BrowserMeasurement[]): Map<string, BrowserMeasurement> {
  const index = new Map<string, BrowserMeasurement>();
  for (const m of measurements) index.set(m.id, m);
  return index;
}

// The notes paragraph the RSS collector writes when it has no numbers. Once numbers exist it is
// false, so the backfill replaces it rather than leaving a contradiction in the corpus.
const NO_SCORE_MARKER = "NO SCORE, AND THEREFORE NO MULTIPLE.";

// The opening words of the line this function writes. Used to recognise its own previous output,
// so running the backfill twice replaces that line instead of appending a second copy. Found the
// hard way: a re-run stamped a duplicate provenance paragraph onto all 225 entries.
const PROVENANCE_MARKER = "Upvotes and comments were measured separately";

export function rewriteNotes(notes: string, m: BrowserMeasurement, measuredAt: string): string {
  const replacement =
    `Upvotes and comments were measured separately, on ${measuredAt.slice(0, 10)}, by reading Reddit's own ` +
    `<shreddit-post> element for this post off the rendered top-of-year listing in a real logged-out browser: ` +
    `score=${m.score}, comment-count=${m.comments}` +
    (m.ratio === null ? "" : `, upvote-ratio=${m.ratio}`) +
    `. The post text in this entry came from Reddit's RSS feed and the numbers came from the rendered page; ` +
    `the two were joined on the post id ${m.id}, which both routes publish, never on the url. ` +
    `Reddit publishes no view count and no share count, so metrics.views and metrics.shares stay null.`;
  const lines = notes.split("\n");
  const isTarget = (line: string) => line.startsWith(NO_SCORE_MARKER) || line.startsWith(PROVENANCE_MARKER);
  // Every target line collapses to one replacement: the first is rewritten and any later duplicate
  // is dropped, so this is idempotent and also repairs a note a previous buggy run doubled up.
  let written = false;
  const replaced: string[] = [];
  for (const line of lines) {
    if (!isTarget(line)) {
      replaced.push(line);
      continue;
    }
    if (!written) {
      replaced.push(replacement);
      written = true;
    }
  }
  // A note that carried neither marker gets the provenance appended rather than dropped.
  if (!written) replaced.push(replacement);
  return replaced.join("\n");
}

export interface BackfillResult {
  entries: CorpusEntry[];
  filled: number;
  missed: number;
  missedIds: string[];
  typeDisagreements: { id: string; recordedForm: string; browserType: string }[];
}

// Fills metrics on a copy of the staged entries. Never mutates the input, and never touches an
// entry it could not match.
export function backfill(
  entries: CorpusEntry[],
  index: Map<string, BrowserMeasurement>,
  measuredAt: string,
): BackfillResult {
  let filled = 0;
  const missedIds: string[] = [];
  const typeDisagreements: BackfillResult["typeDisagreements"] = [];
  const out = entries.map((entry) => {
    if (entry.platform !== "reddit") return entry;
    const id = postIdFrom(entry.url);
    const m = id === null ? undefined : index.get(id);
    if (!m) {
      if (entry.metrics.likes === null) missedIds.push(id ?? entry.url);
      return entry;
    }
    filled++;
    // Recorded for the report only. The form on the entry was determined from the feed and carries
    // its own method in media.description, so it is not silently overwritten here by a second
    // source; a disagreement is surfaced to a human instead.
    if (entry.media && entry.media.form && m.postType) {
      const agrees =
        (m.postType === "text" && entry.media.form === "text-only") ||
        (m.postType === "image" && entry.media.form === "image") ||
        (m.postType === "video" && entry.media.form === "video") ||
        (m.postType === "gallery" && entry.media.form === "carousel") ||
        (m.postType === "link" && entry.media.form === "link-preview");
      if (!agrees) typeDisagreements.push({ id: m.id, recordedForm: entry.media.form, browserType: m.postType });
    }
    return {
      ...entry,
      metrics: {
        ...entry.metrics,
        likes: m.score,
        comments: m.comments,
        upvote_ratio: m.ratio,
      },
      notes: typeof entry.notes === "string" ? rewriteNotes(entry.notes, m, measuredAt) : entry.notes,
    };
  });
  return { entries: out, filled, missed: missedIds.length, missedIds, typeDisagreements };
}

// Loads every *-top-year.txt in a directory into one index.
export function loadMeasurementDir(dir: string): Map<string, BrowserMeasurement> {
  const all: BrowserMeasurement[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith("-top-year.txt")).sort()) {
    all.push(...parseMeasurements(readFileSync(join(dir, name), "utf8")));
  }
  return measurementIndex(all);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let staged = "";
  let dir = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--staged" && argv[i + 1]) (staged = argv[i + 1]), i++;
    else if (argv[i] === "--measurements" && argv[i + 1]) (dir = argv[i + 1]), i++;
  }
  if (!staged || !dir) {
    console.error("Usage: npm run patterns:reddit-backfill -- --staged <inbox.json> --measurements <dir>");
    return 1;
  }
  const entries = JSON.parse(readFileSync(staged, "utf8")) as CorpusEntry[];
  const index = loadMeasurementDir(dir);
  const result = backfill(entries, index, new Date().toISOString());
  writeFileSync(staged, JSON.stringify(result.entries, null, 2) + "\n", "utf8");

  console.log(`Measurements loaded: ${index.size}`);
  console.log(`Entries filled: ${result.filled} of ${entries.length}. Left null: ${result.missed}.`);
  if (result.missedIds.length > 0) console.log(`  unmatched: ${result.missedIds.slice(0, 20).join(", ")}`);
  if (result.typeDisagreements.length > 0) {
    console.log(`\nForm disagreements between the feed and the rendered page (${result.typeDisagreements.length}).`);
    console.log("Nothing was overwritten; the recorded form keeps its own method. Listed for a human to settle:");
    for (const d of result.typeDisagreements.slice(0, 30)) {
      console.log(`  ${d.id}: entry says ${d.recordedForm}, page says post-type=${d.browserType}`);
    }
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
