// The route that finally reaches YouTube's spoken words: yt-dlp, run as a real subprocess.
//
// WHY THIS EXISTS, and why it is a separate file from youtube.ts.
//
// youtube.ts documents at length that caption CONTENT is unreachable by plain HTTP: every
// `api/timedtext` fetch answers 200 with a zero-byte body, `/youtubei/v1/get_transcript` answers
// 400 FAILED_PRECONDITION, and the Data API's `captions.download` needs OAuth as the video's
// owner. All of that is still true of plain HTTP and none of it has been walked back.
//
// yt-dlp gets past it because it does the work a plain fetch does not: it runs YouTube's own
// player handshake and mints the proof-of-origin token the timedtext endpoint demands. Verified on
// 2026-08-23 with yt-dlp 2026.08.19 against oXwujuphEMc: 23,461 bytes of real json3, not an empty
// body. So youtube.ts keeps its HTTP purity and this file owns the one thing that needs a
// subprocess and a scratch directory.
//
// This is NOT a model-backed fetch and that distinction is the whole point. yt-dlp downloads the
// caption file YouTube serves and writes those bytes to disk. Nothing rewords it, nothing
// summarises it, nothing decides what it "said". The corpus has been corrupted twice by asking a
// model to read a page, so the rule here is absolute: read the file, never a rendering of it.
//
// ONE HAZARD WORTH NAMING. YouTube offers machine TRANSLATIONS of its machine captions, and they
// are served under the same `en` language key as an original English track. A translated track is
// not the spoken words in any useful sense. The original auto-caption track is always published
// under `<lang>-orig`, so that file is preferred whenever it exists, and the caller passes in the
// language the watch page actually listed rather than assuming English.

import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTimedTextJson3 } from "./youtube.js";
import { decodeHtmlEntities } from "../util/html-entities.js";

// Overridable so a machine that installed yt-dlp somewhere unusual does not have to fight PATH.
export const YT_DLP_BIN = process.env.YT_DLP_PATH ?? "yt-dlp";

// Thrown when the binary is not installed, and worded so the fix is in the message rather than in
// somebody's memory. The alternative failure mode is the dangerous one: a collector that shrugs at
// a missing binary and records "no transcript available" writes a tooling gap into the corpus as
// if it were a fact about the video.
export class YtDlpMissingError extends Error {
  constructor(readonly binary: string) {
    super(
      `yt-dlp is not installed (looked for "${binary}").\n` +
        "It is required to retrieve YouTube transcripts; no other route reaches them.\n" +
        "Install it with:  brew install yt-dlp\n" +
        "or:               python3 -m pip install --user -U yt-dlp\n" +
        "If it lives somewhere off PATH, set YT_DLP_PATH to its full path.\n" +
        "Nothing was written. A missing binary is a tooling gap, not a fact about the video.",
    );
    this.name = "YtDlpMissingError";
  }
}

export class YtDlpFailedError extends Error {
  constructor(
    readonly code: number,
    readonly stderr: string,
  ) {
    super(`yt-dlp exited ${code}. Stopping rather than recording a missing transcript as a fact.\n${stderr.trim()}`);
    this.name = "YtDlpFailedError";
  }
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

// The subprocess boundary, injectable so every test below runs against a fake and never the
// network. A real run is the only thing this indirection hides.
export type YtDlpRunner = (args: string[], cwd: string) => Promise<RunResult>;

// The command line, built as data so a test can assert on it without spawning anything.
//
// `--write-subs` and `--write-auto-subs` are deliberately NOT both passed. Which one is passed is
// decided by what the watch page already told us, and passing only one makes the downloaded file's
// provenance unambiguous: with both, a human track and a machine track can land under names that
// have to be guessed apart afterwards, and getting that guess wrong labels ASR wording as the
// creator's own.
export function ytDlpArgs(url: string, opts: { human: boolean; language: string }): string[] {
  // A yt-dlp language selector is a regex, so "en.*" covers "en", "en-US" and "en-orig" in one
  // pattern. Every match is downloaded; which one is READ is decided by pickSubtitleFile below.
  const langs = `${opts.language}.*`;
  return [
    "--skip-download",
    opts.human ? "--write-subs" : "--write-auto-subs",
    "--sub-langs",
    langs,
    // json3 preferred, vtt as an explicit fallback. NOT decoration: Ali Abdaal's 1ArVtCQqQRE
    // carries a HUMAN-authored en-GB track that YouTube publishes as vtt with no json3 at all, and
    // asking for json3 alone made yt-dlp fall back silently to a file this module then refused to
    // read. Naming the fallback makes the second format a decision rather than an accident.
    "--sub-format",
    "json3/vtt",
    // yt-dlp's own inter-request pacing, on top of the collector's. YouTube answered 429 during
    // the 2026-08-23 probe after roughly fifteen rapid requests.
    "--sleep-requests",
    "1",
    "--no-warnings",
    "--no-playlist",
    "-o",
    "%(id)s",
    url,
  ];
}

export type SubtitleFormat = "json3" | "vtt";

export interface SubtitleFile {
  name: string;
  languageCode: string;
  format: SubtitleFormat;
}

// Which of the downloaded files to actually read.
//
// The `-orig` suffix marks the track YouTube transcribed from the real audio. A bare `en` file
// alongside it is a machine translation of that track back into English, which for an English
// video is a lossy round trip and for any other video is not the spoken words at all. So `-orig`
// wins whenever it is there.
export function pickSubtitleFile(names: string[], language: string): SubtitleFile | null {
  // json3 first, vtt only if no json3 exists. A track can be published in one and not the other,
  // and refusing vtt outright is how a HUMAN-authored track gets silently skipped: 1ArVtCQqQRE
  // has one in en-GB and offers no json3 for it. Human tracks are the quotable ones, so losing
  // them is the most expensive kind of miss this module can make.
  const inFormat = (ext: string): SubtitleFile[] =>
    names
      .filter((n) => n.endsWith(`.${ext}`))
      .map((n) => {
        const match = n.match(new RegExp(`\\.([A-Za-z0-9-]+)\\.${ext}$`));
        return match ? { name: n, languageCode: match[1], format: ext as SubtitleFormat } : null;
      })
      .filter((f): f is SubtitleFile => f !== null);

  const parsed = inFormat("json3").length > 0 ? inFormat("json3") : inFormat("vtt");
  if (parsed.length === 0) return null;
  return (
    parsed.find((f) => f.languageCode === `${language}-orig`) ??
    parsed.find((f) => f.languageCode === language) ??
    parsed.find((f) => f.languageCode.startsWith(`${language}-`)) ??
    parsed[0]
  );
}

// A WebVTT caption file into one run of plain text.
//
// Everything that is not spoken words comes out: the WEBVTT header and its Kind/Language lines,
// the cue timing lines, the numeric cue ids, and the inline <c> and <00:00:01.000> karaoke tags
// YouTube sprinkles through rolling captions. Consecutive duplicate lines are collapsed because a
// rolling caption repeats each line as the window scrolls, and leaving them in would triple the
// body and wreck any structural read of it.
//
// Sound cues like "(tranquil ambient music)" are LEFT IN, exactly as the human captioner wrote
// them, on the same principle that keeps YouTube's "[ __ ]" profanity mask and its ASR
// mis-transcriptions in the corpus verbatim: the record shows what the track said.
export function parseVtt(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "WEBVTT") continue;
    if (trimmed.includes("-->")) continue;
    if (/^(Kind|Language|NOTE|STYLE|REGION):?\b/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;
    // Same shared decoder the essay ingest uses: a caption track carries the speaker's own
    // words, and `&#8217;` was surviving the old named-only chain into the stored transcript.
    const text = decodeHtmlEntities(trimmed.replace(/<[^>]*>/g, ""))
      .replace(/\u00a0/g, " ")
      .trim();
    if (text === "") continue;
    if (out.length > 0 && out[out.length - 1] === text) continue;
    out.push(text);
  }
  const joined = out.join("\n").trim();
  return joined.length > 0 ? joined : null;
}

export interface TranscriptResult {
  text: string;
  // The track file actually read, e.g. "en-orig". Recorded so a reader can see whether the words
  // came off the original audio or off a translation of it.
  languageCode: string;
  // Carried straight through from the watch page's own track list. yt-dlp is asked for one kind or
  // the other, so this is a statement of what was requested and got served, not an inference.
  isAsr: boolean;
  // Which caption format the words were actually read out of.
  format: SubtitleFormat;
}

export interface FetchTranscriptOptions {
  // False when the watch page listed a human-authored track for this language, true when the only
  // track is machine-generated. Decided by pickCaptionTrack in youtube.ts, never guessed here.
  isAsr: boolean;
  language?: string;
  runner?: YtDlpRunner;
  binary?: string;
}

// Runs yt-dlp into a scratch directory, reads the caption file it wrote, and returns the words.
//
// Returns null only when yt-dlp succeeded and there was genuinely no caption file to read, which
// is a real fact about the video. Every other failure throws, because "the tool broke" and "this
// video has no transcript" must never end up recorded as the same thing.
export async function fetchTranscript(url: string, opts: FetchTranscriptOptions): Promise<TranscriptResult | null> {
  const language = opts.language ?? "en";
  const binary = opts.binary ?? YT_DLP_BIN;
  const run = opts.runner ?? defaultRunner(binary);
  const dir = mkdtempSync(join(tmpdir(), "yt-transcript-"));
  try {
    const result = await run(ytDlpArgs(url, { human: !opts.isAsr, language }), dir);
    if (result.code !== 0) throw new YtDlpFailedError(result.code, result.stderr);
    const chosen = pickSubtitleFile(readdirSync(dir), language);
    if (!chosen) return null;
    const raw = readFileSync(join(dir, chosen.name), "utf8");
    // A zero-byte or unparseable file is the old timedtext wall showing through, not an empty
    // video. Null here says "no words retrieved", and the caller leaves body_is_complete false.
    const text = chosen.format === "vtt" ? parseVtt(raw) : parseJson3Text(raw);
    if (text === null) return null;
    return { text, languageCode: chosen.languageCode, isAsr: opts.isAsr, format: chosen.format };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseJson3Text(raw: string): string | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseTimedTextJson3(json);
}

function defaultRunner(binary: string): YtDlpRunner {
  return (args, cwd) =>
    new Promise((resolve, reject) => {
      execFile(binary, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new YtDlpMissingError(binary));
          return;
        }
        const code = err && typeof (err as { code?: unknown }).code === "number" ? ((err as { code: number }).code) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      });
    });
}
