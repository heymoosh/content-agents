import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

// Forced-alignment fallback. TTS providers that return character timestamps (ElevenLabs)
// pass straight through. Providers that don't (Kokoro → charTimestamps: null) get a
// Whisper pass on the rendered audio, and we synthesize char-level timestamps from the
// word/token offsets so the existing charsToWordCaptions() consumes the result unchanged.

export type CharTs = { char: string; startMs: number; endMs: number };

export async function charsOrWhisper(
  charTimestamps: CharTs[] | null,
  audioPath: string
): Promise<CharTs[]> {
  if (charTimestamps) return charTimestamps;

  const backend = process.env.WHISPER_BACKEND ?? "whispercpp";
  if (backend !== "whispercpp") {
    throw new Error(
      `TTS returned no timestamps and WHISPER_BACKEND="${backend}" is unsupported. ` +
        `Set WHISPER_BACKEND=whispercpp (see docs/setup-kokoro.md).`
    );
  }
  return whisperCppAlign(audioPath);
}

function whisperCppAlign(audioPath: string): CharTs[] {
  const bin = process.env.WHISPER_CPP_BIN ?? "whisper-cli";
  const model = process.env.WHISPER_CPP_MODEL;
  if (!model) {
    throw new Error("WHISPER_CPP_MODEL missing in .env (path to a ggml-*.bin model — see docs/setup-kokoro.md)");
  }

  const wav = `${audioPath}.align.wav`;
  const outBase = `${audioPath}.align`; // whisper.cpp writes <outBase>.json
  const jsonPath = `${outBase}.json`;
  try {
    // 16kHz mono PCM WAV is what whisper.cpp expects.
    run("ffmpeg", ["-y", "-i", audioPath, "-ar", "16000", "-ac", "1", wav]);
    // -ml 1 → token-level segments (tightest timing granularity); -oj → JSON; -of → output base.
    run(bin, ["-m", model, "-f", wav, "-ml", "1", "-oj", "-of", outBase]);

    const data = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      transcription?: { offsets?: { from: number; to: number }; text?: string }[];
    };
    const segments = data.transcription ?? [];
    if (segments.length === 0) {
      throw new Error(`whisper.cpp produced no transcription for ${audioPath}`);
    }

    // Each segment is a token like " hello"; spread its [from,to] linearly across its chars.
    // Leading spaces between tokens delimit words for charsToWordCaptions().
    const chars: CharTs[] = [];
    for (const seg of segments) {
      const text = seg.text ?? "";
      const from = seg.offsets?.from ?? 0;
      const to = seg.offsets?.to ?? from;
      const n = text.length;
      if (n === 0) continue;
      const span = Math.max(0, to - from);
      for (let i = 0; i < n; i++) {
        chars.push({
          char: text[i],
          startMs: Math.round(from + (span * i) / n),
          endMs: Math.round(from + (span * (i + 1)) / n),
        });
      }
    }
    return chars;
  } finally {
    rmSync(wav, { force: true });
    rmSync(jsonPath, { force: true });
  }
}

function run(cmd: string, args: string[]): void {
  try {
    execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });
  } catch (e) {
    throw new Error(
      `"${cmd}" failed — is it installed and on PATH? (${(e as Error).message}) See docs/setup-kokoro.md.`
    );
  }
}
