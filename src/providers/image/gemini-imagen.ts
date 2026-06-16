import "../../util/env.js";
import type { ImageProvider } from "../types.js";
import { writeImageFile } from "./_write.js";

// Gemini API → Imagen (direct, not via OpenRouter). Defaults to Imagen 4 Fast (~$0.02/image).
// The bakeoff can override the model + cost per contender via params; the main pipeline
// (render.ts) calls without params and gets the defaults.
const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-fast-generate-001";
const DEFAULT_COST = 0.02;

export const provider: ImageProvider = {
  name: "gemini-imagen",
  async generate({ prompt, aspect, outPath, params }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing in .env (see .env.example)");
    const model = (params?.model as string) ?? DEFAULT_MODEL;
    const cost = (params?.cost_usd as number) ?? DEFAULT_COST;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: aspect },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`imagen request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      predictions?: { bytesBase64Encoded?: string }[];
    };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error(`imagen returned no image: ${JSON.stringify(data).slice(0, 300)}`);
    writeImageFile(outPath, Buffer.from(b64, "base64"));
    return { imagePath: outPath, costUsd: cost };
  },
};
