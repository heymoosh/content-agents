import "../../util/env.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ImageProvider } from "../types.js";

// Gemini API → Imagen 4 Fast (~$0.02/image). Override model via GEMINI_IMAGE_MODEL.
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-fast-generate-001";
const COST_PER_IMAGE = 0.02;

export const provider: ImageProvider = {
  name: "gemini-imagen",
  async generate({ prompt, aspect, outPath }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing in .env (see .env.example)");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`,
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
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(b64, "base64"));
    return { imagePath: outPath, costUsd: COST_PER_IMAGE };
  },
};
