import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Quote+image cards: a distinct asset from the typographic-only QuoteCard (render.ts's --still
// path, unchanged — Muxin's June 2026 call that the plain card stays "just quotes, not
// illustrations" still holds). This variant composites the SAME verbatim quote over a generated
// illustration. The image concept prompt is authored by Claude during /atomize step 7, derived
// from the source content (extraction-first spirit: the image is a visual concept, not new text
// in Muxin's voice) — same pattern as video/image-prompts.txt for B-roll.

export interface QuoteImageCardData {
  quote: string;
  attribution: string;
  source?: string;
  accent: string;
}

export function imagePromptPath(folder: string, quoteName: string): string {
  return join(folder, "derivatives", `${quoteName}-image-prompt.txt`);
}

export function readImagePrompt(folder: string, quoteName: string): string {
  const path = imagePromptPath(folder, quoteName);
  if (!existsSync(path)) {
    throw new Error(
      `missing ${path} — write a one-line image concept prompt derived from the source ` +
        `(/atomize step 7) before rendering --with-image.`
    );
  }
  const prompt = readFileSync(path, "utf8").trim();
  if (!prompt) {
    throw new Error(`${path} is empty — write an image concept prompt before rendering --with-image.`);
  }
  return prompt;
}

// Distinct filename from the typographic card's images/<quoteName>.png so both variants can
// coexist for the same quote-card definition without colliding.
export function withImageOutPath(folder: string, quoteName: string): string {
  return join(folder, "images", `${quoteName}-image.png`);
}

export function buildQuoteImageProps(
  card: QuoteImageCardData,
  imageRelPath: string
): { quote: string; attribution: string; source?: string; accent: string; image: string } {
  return {
    quote: card.quote,
    attribution: card.attribution,
    source: card.source,
    accent: card.accent,
    image: imageRelPath,
  };
}
