import "../../util/env.js";
import type { ProseProvider } from "../types.js";

// Grok via OpenRouter chat-completions, for Build 2 fiction prose. This is the deliberate
// composition path (NOT extraction-first): it drafts original chapters from the story bible +
// canon. Allowed only because every chapter is human-reviewed on a PR before anything ships
// (see CLAUDE.md — Build 2). Model + cost are env-overridable; temperature runs hot for prose.
const MODEL = process.env.OPENROUTER_PROSE_MODEL ?? process.env.OPENROUTER_GROK_MODEL ?? "x-ai/grok-4";
const COST_PER_1K_OUT = Number(process.env.OPENROUTER_PROSE_COST_PER_1K ?? "0.015");
const TEMPERATURE = Number(process.env.OPENROUTER_PROSE_TEMPERATURE ?? "0.9");

export const provider: ProseProvider = {
  name: "grok-openrouter",
  async generate({ system, context, instructions }) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY missing in .env (see .env.example)");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${context}\n\n---\n\n# Write this chapter\n\n${instructions}` },
        ],
        temperature: TEMPERATURE,
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
