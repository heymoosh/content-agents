import "../../util/env.js";
import type { TextPolishProvider } from "../types.js";

// Grok via OpenRouter chat-completions. Used ONLY for video scripts (atomize step 7a) —
// the one place AI drafts in Muxin's idea-space rather than extracting verbatim. Text
// derivatives never call this; see CLAUDE.md rule 1 and the atomize skill.
// Model + approximate cost are overridable via env.
const MODEL = process.env.OPENROUTER_GROK_MODEL ?? "x-ai/grok-4";
const COST_PER_1K_OUT = Number(process.env.OPENROUTER_GROK_COST_PER_1K ?? "0.015");

export const provider: TextPolishProvider = {
  name: "grok-openrouter",
  async polish({ draft, instructions }) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY missing in .env (see .env.example)");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: draft },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`openrouter request failed: ${res.status} ${await res.text()}`);

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`openrouter returned no text: ${JSON.stringify(data).slice(0, 300)}`);

    const costUsd = ((data.usage?.completion_tokens ?? 0) / 1000) * COST_PER_1K_OUT;
    return { text, costUsd };
  },
};
