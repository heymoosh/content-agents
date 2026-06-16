import "../../util/env.js";
import type { ImageProvider } from "../types.js";
import { writeImageFile } from "./_write.js";

// One adapter for OpenRouter's whole image catalog — the model is just a param, so every
// model OpenRouter carries is a one-line contender in config/bakeoff.yaml (no new keys
// beyond OPENROUTER_API_KEY, which the repo already uses for the Grok script writer).
//
// OpenRouter generates images through the chat-completions endpoint with
// modalities: ["image","text"]; the image comes back as a base64 data URL in
// choices[0].message.images[]. With usage.include the response also reports the real
// billed cost, which we prefer over any hardcoded estimate for the price ranking.

export const provider: ImageProvider = {
  name: "openrouter-image",
  async generate({ prompt, aspect, outPath, params }) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY missing in .env (see .env.example)");
    const model = params?.model as string | undefined;
    if (!model) {
      throw new Error(
        "openrouter-image contender missing params.model (e.g. google/gemini-2.5-flash-image)"
      );
    }
    const imageSize = (params?.image_size as string) ?? "1K";
    const fallbackCost = (params?.cost_usd as number) ?? 0;
    // Image-only models (FLUX, Seedream, Riverflow, Grok) reject ["image","text"] with a 404
    // "no endpoints support the requested output" — they can't emit text. Let each contender
    // set its own modalities; default to both for models that also return text (Gemini, GPT).
    const modalities = (params?.modalities as string[]) ?? ["image", "text"];
    // Cap max_tokens so OpenRouter only RESERVES a little credit up front. Token-based image
    // models (Gemini 3.x, GPT-5) otherwise reserve their full 32k ceiling × the high image-token
    // price and 402 with "requested up to 32768 tokens" even though the real image is ~1-4k
    // tokens. 8192 comfortably covers a 1K image; bump params.max_tokens for larger sizes.
    const maxTokens = (params?.max_tokens as number) ?? 8192;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities,
        max_tokens: maxTokens,
        image_config: { aspect_ratio: aspect, image_size: imageSize },
        usage: { include: true },
      }),
    });
    if (!res.ok) {
      throw new Error(`openrouter image request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
      usage?: { cost?: number };
    };
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error(`openrouter returned no image: ${JSON.stringify(data).slice(0, 300)}`);
    if (!url.startsWith("data:")) throw new Error(`openrouter image is not a data URL: ${url.slice(0, 80)}`);
    const b64 = url.slice(url.indexOf(",") + 1);
    writeImageFile(outPath, Buffer.from(b64, "base64"));
    const costUsd = typeof data.usage?.cost === "number" ? data.usage.cost : fallbackCost;
    return { imagePath: outPath, costUsd };
  },
};
