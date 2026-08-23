// The yt-dlp transcript route, tested entirely against a fake subprocess. Nothing here touches
// the network and nothing here downloads a video.
//
// Every test below exists because the thing it checks is a way the corpus gets corrupted quietly:
//   - a machine caption labelled as the creator's own wording
//   - a machine TRANSLATION of a caption track passed off as the spoken words
//   - a zero-byte caption file, which is exactly what the old timedtext route returned, read as
//     "this video has nothing in it"
//   - a missing binary recorded as "no transcript available" instead of "install yt-dlp"

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  YtDlpFailedError,
  YtDlpMissingError,
  fetchTranscript,
  pickSubtitleFile,
  ytDlpArgs,
} from "./youtube-transcript.js";

// A json3 caption payload in YouTube's real shape: words split across segs inside timed events.
function json3(pieces: string[]): string {
  return JSON.stringify({
    events: pieces.map((text, i) => ({ tStartMs: i * 1000, dDurationMs: 1000, segs: [{ utf8: text }] })),
  });
}

describe("ytDlpArgs", () => {
  test("asks for automatic captions for an ASR track and manual ones for a human track", () => {
    const asr = ytDlpArgs("https://www.youtube.com/watch?v=oXwujuphEMc", { human: false, language: "en" });
    assert.ok(asr.includes("--write-auto-subs"));
    assert.ok(!asr.includes("--write-subs"));

    const human = ytDlpArgs("https://www.youtube.com/watch?v=oXwujuphEMc", { human: true, language: "en" });
    assert.ok(human.includes("--write-subs"));
    assert.ok(!human.includes("--write-auto-subs"));
  });

  test("never both at once, because then the downloaded file's provenance has to be guessed", () => {
    for (const human of [true, false]) {
      const args = ytDlpArgs("https://x", { human, language: "en" });
      assert.equal(args.filter((a) => a === "--write-subs" || a === "--write-auto-subs").length, 1);
    }
  });

  test("downloads nothing but subtitles, in json3, at the politeness floor", () => {
    const args = ytDlpArgs("https://www.youtube.com/watch?v=oXwujuphEMc", { human: false, language: "en" });
    assert.ok(args.includes("--skip-download"));
    assert.equal(args[args.indexOf("--sub-format") + 1], "json3");
    assert.equal(args[args.indexOf("--sleep-requests") + 1], "1");
    assert.equal(args[args.length - 1], "https://www.youtube.com/watch?v=oXwujuphEMc");
  });

  test("the language selector follows the track's language rather than assuming English", () => {
    const args = ytDlpArgs("https://x", { human: false, language: "es" });
    assert.equal(args[args.indexOf("--sub-langs") + 1], "es.*");
  });
});

describe("pickSubtitleFile", () => {
  test("prefers the -orig track, which is the one transcribed off the real audio", () => {
    // A bare "en" file next to "en-orig" is YouTube's machine TRANSLATION of the machine
    // transcript. For an English video that is a lossy round trip; for a Spanish one it is not
    // the spoken words at all.
    const picked = pickSubtitleFile(["vid.en.json3", "vid.en-orig.json3"], "en");
    assert.equal(picked?.languageCode, "en-orig");
  });

  test("falls back to the plain language track when no -orig exists", () => {
    assert.equal(pickSubtitleFile(["vid.en.json3"], "en")?.languageCode, "en");
  });

  test("ignores files that are not json3", () => {
    assert.equal(pickSubtitleFile(["vid.en.vtt", "vid.info.json"], "en"), null);
    assert.equal(pickSubtitleFile([], "en"), null);
  });
});

describe("fetchTranscript", () => {
  test("returns the caption track's words, and carries the ASR verdict through untouched", async () => {
    const runner = async (_args: string[], cwd: string) => {
      writeFileSync(join(cwd, "vid.en-orig.json3"), json3(["Four things I wish", " I knew in my early 20s."]));
      return { code: 0, stdout: "", stderr: "" };
    };
    const result = await fetchTranscript("https://www.youtube.com/watch?v=oXwujuphEMc", { isAsr: true, runner });
    assert.equal(result?.text, "Four things I wish I knew in my early 20s.");
    assert.equal(result?.languageCode, "en-orig");
    // Decided by the watch page, never by this module, and never dropped on the way through.
    assert.equal(result?.isAsr, true);
  });

  test("a zero-byte caption file is no transcript, not an empty video", async () => {
    // This is exactly what the old api/timedtext route returned: HTTP 200 and nothing in it.
    // Reading that as a body would write "this creator said nothing" into the corpus.
    const runner = async (_args: string[], cwd: string) => {
      writeFileSync(join(cwd, "vid.en.json3"), "");
      return { code: 0, stdout: "", stderr: "" };
    };
    assert.equal(await fetchTranscript("https://x", { isAsr: true, runner }), null);
  });

  test("a caption file with no text in its events is null rather than an empty string", async () => {
    const runner = async (_args: string[], cwd: string) => {
      writeFileSync(join(cwd, "vid.en.json3"), JSON.stringify({ events: [{ tStartMs: 0 }] }));
      return { code: 0, stdout: "", stderr: "" };
    };
    assert.equal(await fetchTranscript("https://x", { isAsr: true, runner }), null);
  });

  test("no file written at all means the video genuinely has no track to read", async () => {
    const runner = async () => ({ code: 0, stdout: "", stderr: "" });
    assert.equal(await fetchTranscript("https://x", { isAsr: false, runner }), null);
  });

  test("a failed run throws instead of returning null, so a broken tool is never filed as a fact", async () => {
    const runner = async () => ({ code: 1, stdout: "", stderr: "ERROR: Sign in to confirm you are not a bot" });
    await assert.rejects(() => fetchTranscript("https://x", { isAsr: true, runner }), YtDlpFailedError);
  });

  test("the scratch directory is cleaned up even when the run fails", async () => {
    const before = readdirSync(process.env.TMPDIR ?? "/tmp").filter((n) => n.startsWith("yt-transcript-")).length;
    const runner = async () => ({ code: 1, stdout: "", stderr: "boom" });
    await assert.rejects(() => fetchTranscript("https://x", { isAsr: true, runner }));
    const after = readdirSync(process.env.TMPDIR ?? "/tmp").filter((n) => n.startsWith("yt-transcript-")).length;
    assert.equal(after, before);
  });

  test("a missing binary says how to install it, and never looks like an absent transcript", async () => {
    // No network: this spawns a name that cannot exist and asserts on the ENOENT path.
    const err = await fetchTranscript("https://x", {
      isAsr: true,
      binary: "yt-dlp-that-is-not-installed-anywhere",
    }).then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof YtDlpMissingError);
    assert.match(err.message, /brew install yt-dlp/);
    assert.match(err.message, /Nothing was written/);
  });
});
