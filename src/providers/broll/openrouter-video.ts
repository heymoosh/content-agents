import "../../util/env.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { VideoBrollProvider } from "../types.js";

// Animated scene generation via OpenRouter's video API — default Kling v3.0 (first+last-frame
// interpolation). Give it a start and end still; it animates the transition between them.
// Async: submit → poll → download. Runs on OPENROUTER_API_KEY; frames are passed as base64
// data URIs (no image hosting needed). Verified June 2026. costUsd ≈ durationSeconds * cost_per_sec.
const BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "kwaivgi/kling-v3.0-std"; // cheapest Kling tier with first/last-frame support
const DEFAULT_COST_PER_SEC = 0.08;

function dataUri(path: string): string {
  return "data:image/png;base64," + readFileSync(path).toString("base64");
}

export const provider: VideoBrollProvider = {
  name: "openrouter-video",
  async interpolate({ prompt, firstFramePath, lastFramePath, aspect, durationSeconds, outPath, params }) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY missing in .env (see .env.example)");
    const model = (params?.model as string) ?? DEFAULT_MODEL;
    const resolution = (params?.resolution as string) ?? "720p";
    const costPerSec = (params?.cost_per_sec as number) ?? DEFAULT_COST_PER_SEC;
    const auth = { authorization: `Bearer ${key}` };

    const submit = await fetch(`${BASE}/videos`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        frame_images: [
          { type: "image_url", image_url: { url: dataUri(firstFramePath) }, frame_type: "first_frame" },
          { type: "image_url", image_url: { url: dataUri(lastFramePath) }, frame_type: "last_frame" },
        ],
        aspect_ratio: aspect,
        resolution,
        duration: durationSeconds,
      }),
    });
    const sd = (await submit.json()) as { id?: string };
    if (!submit.ok || !sd.id) {
      throw new Error(`openrouter video submit failed: ${submit.status} ${JSON.stringify(sd).slice(0, 300)}`);
    }

    // Poll the async job — Kling typically completes in ~1-3 min.
    let pd: { status?: string; unsigned_urls?: string[] } = {};
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      const pr = await fetch(`${BASE}/videos/${sd.id}`, { headers: auth });
      pd = (await pr.json()) as typeof pd;
      if (pd.status === "completed" || pd.unsigned_urls) break;
      if (pd.status === "failed") {
        throw new Error(`openrouter video job failed: ${JSON.stringify(pd).slice(0, 300)}`);
      }
    }
    const url = pd.unsigned_urls?.[0] ?? `${BASE}/videos/${sd.id}/content?index=0`;
    const vid = await fetch(url, { headers: auth });
    if (!vid.ok) throw new Error(`openrouter video download failed: ${vid.status}`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(await vid.arrayBuffer()));
    return { videoPath: outPath, costUsd: durationSeconds * costPerSec };
  },
};
