import "../../util/env.js";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { TTSProvider } from "../types.js";

// Kokoro-82M run locally — free, no timestamps (render falls back to Whisper alignment).
// Two invocation modes via KOKORO_MODE:
//   "server" (default): POST KOKORO_URL — kokoro-fastapi's OpenAI-compatible /v1/audio/speech
//   "cli":              spawn KOKORO_CMD with (text, outPath) as argv
// See docs/setup-kokoro.md. costUsd is 0 (local).
export const provider: TTSProvider = {
  name: "kokoro",
  async synthesize({ text, voiceId, outPath }) {
    mkdirSync(dirname(outPath), { recursive: true });
    const mode = process.env.KOKORO_MODE ?? "server";

    if (mode === "cli") {
      const cmd = process.env.KOKORO_CMD;
      if (!cmd) throw new Error("KOKORO_MODE=cli but KOKORO_CMD is unset (see docs/setup-kokoro.md)");
      try {
        execFileSync(cmd, [text, outPath], { stdio: ["ignore", "ignore", "inherit"] });
      } catch (e) {
        throw new Error(`kokoro cli "${cmd}" failed: ${(e as Error).message} (see docs/setup-kokoro.md)`);
      }
      return { audioPath: outPath, charTimestamps: null, costUsd: 0 };
    }

    const url = process.env.KOKORO_URL ?? "http://localhost:8880/v1/audio/speech";
    const voice = voiceId ?? process.env.KOKORO_VOICE ?? "af_heart";
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "kokoro", voice, input: text, response_format: "mp3" }),
    }).catch((e) => {
      throw new Error(`kokoro server unreachable at ${url}: ${(e as Error).message} (see docs/setup-kokoro.md)`);
    });
    if (!res.ok) throw new Error(`kokoro server failed: ${res.status} ${await res.text()}`);
    writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
    return { audioPath: outPath, charTimestamps: null, costUsd: 0 };
  },
};
