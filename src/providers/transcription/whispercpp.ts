import "../../util/env.js";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import type { TranscriptionProvider } from "../types.js";

// Free-local transcription via whisper.cpp — the SAME binary/model this repo already runs for
// TTS caption forced-alignment (src/video/align.ts, whisperCppAlign()). This adapter reuses that
// exact invocation (ffmpeg → 16kHz mono WAV, then `whisper-cli -ml 1 -oj -of`) but only needs the
// plain transcript text, not align.ts's char-timestamp synthesis (alignment-specific, not
// needed here). Cost is $0 (local) — still returns costUsd to satisfy the interface contract
// (CLAUDE.md rule 6: every adapter returns costUsd).
//
// This is a bakeoff candidate, not the default (see config/providers.yaml `transcription:` and
// docs/bakeoffs/whispercpp-vs-gemini-transcription.md) — swap in via
// `transcription: whispercpp` once a real-voice-memo quality check clears it.

export function joinTranscript(segments: { text?: string }[]): string {
  return segments
    .map((s) => (s.text ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export const provider: TranscriptionProvider = {
  name: "whispercpp",
  async transcribe({ audioPath }) {
    const bin = process.env.WHISPER_CPP_BIN ?? "whisper-cli";
    const model = process.env.WHISPER_CPP_MODEL;
    if (!model) {
      throw new Error(
        "WHISPER_CPP_MODEL missing in .env (path to a ggml-*.bin model — see docs/setup-kokoro.md)"
      );
    }

    const wav = `${audioPath}.transcribe.wav`;
    const outBase = `${audioPath}.transcribe`; // whisper.cpp writes <outBase>.json
    const jsonPath = `${outBase}.json`;
    try {
      // 16kHz mono PCM WAV is what whisper.cpp expects.
      run("ffmpeg", ["-y", "-i", audioPath, "-ar", "16000", "-ac", "1", wav]);
      // -ml 1 → token-level segments; -oj → JSON; -of → output base. Same flags as align.ts.
      run(bin, ["-m", model, "-f", wav, "-ml", "1", "-oj", "-of", outBase]);

      const data = JSON.parse(readFileSync(jsonPath, "utf8")) as {
        transcription?: { text?: string }[];
      };
      const segments = data.transcription ?? [];
      const text = joinTranscript(segments);
      if (!text) throw new Error(`whisper.cpp produced no transcription for ${audioPath}`);
      return { text, costUsd: 0 };
    } finally {
      rmSync(wav, { force: true });
      rmSync(jsonPath, { force: true });
    }
  },
};

function run(cmd: string, args: string[]): void {
  try {
    execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });
  } catch (e) {
    throw new Error(
      `"${cmd}" failed — is it installed and on PATH? (${(e as Error).message}) See docs/setup-kokoro.md.`
    );
  }
}
