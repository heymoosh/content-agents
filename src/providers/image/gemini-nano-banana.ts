import "../../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import type { ImageProvider } from "../types.js";
import { writeImageFile } from "./_write.js";

function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

// Direct Google adapter for the "Nano Banana" image models (Gemini *-image), via the
// generateContent endpoint (NOT Imagen's :predict). Default = Nano Banana Pro
// (gemini-3-pro-image-preview) — the /atomize image workhorse chosen in the bake-off. Runs on
// GEMINI_API_KEY (no OpenRouter, no ~5% markup). Override model/cost per call via params.
const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image-preview";
// These models bill by token, which is awkward to log per image; this is a per-1K-image
// estimate for the cost log (OpenRouter reported ~$0.138 for Pro, ~$0.039 for 2.5 Flash).
// Override per call with params.cost_usd.
const DEFAULT_COST = 0.134;

export const provider: ImageProvider = {
  name: "gemini-nano-banana",
  async generate({ prompt, aspect, outPath, params, referenceImages }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing in .env (see .env.example)");
    const model = (params?.model as string) ?? DEFAULT_MODEL;
    const cost = (params?.cost_usd as number) ?? DEFAULT_COST;

    // Reference images (character/style anchors) ride alongside the prompt — Nano Banana keeps
    // the same character + look across scenes. Missing paths are skipped.
    const refParts = (referenceImages ?? [])
      .filter((p) => existsSync(p))
      .map((p) => ({
        inlineData: { mimeType: mimeFor(p), data: readFileSync(p).toString("base64") },
      }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...refParts] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: aspect },
          },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`nano-banana request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) throw new Error(`nano-banana returned no image: ${JSON.stringify(data).slice(0, 300)}`);
    writeImageFile(outPath, Buffer.from(b64, "base64"));
    return { imagePath: outPath, costUsd: cost };
  },
};
