import "../../util/env.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { TTSProvider } from "../types.js";

// ElevenLabs with-timestamps endpoint → mp3 + character-level alignment.
// Flash v2.5 ≈ $0.05 per 1k chars. Override model via ELEVENLABS_MODEL.
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";
const COST_PER_1K_CHARS = 0.05;

export const provider: TTSProvider = {
  name: "elevenlabs",
  async synthesize({ text, voiceId, outPath }) {
    const key = process.env.ELEVENLABS_API_KEY;
    const voice = voiceId ?? process.env.ELEVENLABS_VOICE_ID;
    if (!key) throw new Error("ELEVENLABS_API_KEY missing in .env");
    if (!voice) throw new Error("ELEVENLABS_VOICE_ID missing in .env (pick one at elevenlabs.io/voices)");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "xi-api-key": key },
        body: JSON.stringify({ text, model_id: MODEL }),
      }
    );
    if (!res.ok) throw new Error(`elevenlabs request failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      audio_base64: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      };
    };
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(data.audio_base64, "base64"));

    const a = data.alignment;
    const charTimestamps = a
      ? a.characters.map((char, i) => ({
          char,
          startMs: Math.round(a.character_start_times_seconds[i] * 1000),
          endMs: Math.round(a.character_end_times_seconds[i] * 1000),
        }))
      : null;
    return {
      audioPath: outPath,
      charTimestamps,
      costUsd: (text.length / 1000) * COST_PER_1K_CHARS,
    };
  },
};
