// House quote-card color schemes (New Yorker DNA: serif type, keyline, ornament, small-caps
// byline — memory: image-style-newyorker). ONE source of truth, shared by render.ts (the
// `--still` path) and card.ts (the one-shot animated card), so the palette never drifts between
// them. Every card uses DEFAULT_SCHEME unless a `scheme:` pins one; only the three colors change.
export const CARD_SCHEMES: Record<string, { paper: string; ink: string; accent: string }> = {
  classic: { paper: "#f2ead9", ink: "#1a1a1a", accent: "#e2552f" }, // beige paper, ink, persimmon
  "teal-accent": { paper: "#e7e9e7", ink: "#1a1a1a", accent: "#2f7e7e" }, // cool grey paper, ink, teal
  "teal-block": { paper: "#2f7e7e", ink: "#f2ead9", accent: "#d8a23a" }, // teal paper, cream type, ochre
  ink: { paper: "#1a1a1a", ink: "#f2ead9", accent: "#2f7e7e" }, // dark paper, cream type, teal
};

export const DEFAULT_SCHEME = "teal-accent";

export function resolveScheme(fm: Record<string, unknown>): { paper: string; ink: string; accent: string } {
  const name = typeof fm.scheme === "string" ? fm.scheme.toLowerCase() : "";
  return CARD_SCHEMES[name] ?? CARD_SCHEMES[DEFAULT_SCHEME];
}
