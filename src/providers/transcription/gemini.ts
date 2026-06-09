import "../../util/env.js";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import type { TranscriptionProvider } from "../types.js";

// Gemini multimodal transcription (audio inline, fine for voice memos < ~19MB).
// Override model via GEMINI_TRANSCRIBE_MODEL.
const MODEL = process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-2.5-flash";
const MIME: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

export const provider: TranscriptionProvider = {
  name: "gemini",
  async transcribe({ audioPath }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing in .env (see .env.example)");
    const mime = MIME[extname(audioPath).toLowerCase()];
    if (!mime) throw new Error(`unsupported audio extension: ${audioPath}`);
    const sizeMb = statSync(audioPath).size / (1024 * 1024);
    if (sizeMb > 19) {
      throw new Error(
        `${audioPath} is ${sizeMb.toFixed(1)}MB — inline limit ~19MB. Split the memo or compress to mp3.`
      );
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Transcribe this audio verbatim. Output only the transcript text — no preamble, no speaker labels, no timestamps. Preserve the speaker's wording exactly; use paragraph breaks at natural pauses.",
                },
                { inline_data: { mime_type: mime, data: readFileSync(audioPath).toString("base64") } },
              ],
            },
          ],
        }),
      }
    );
    if (!res.ok) throw new Error(`gemini transcription failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("gemini returned an empty transcript");
    // ~$0.06/hr audio input at flash pricing; estimate from typical memo bitrate.
    const estCost = Math.max(0.001, (sizeMb / 1) * 0.004);
    return { text: text.trim(), costUsd: estCost };
  },
};
