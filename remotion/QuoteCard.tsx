import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";

// New Yorker–style typographic quote card: cream paper, ink serif, hairline keyline,
// one restrained accent. No illustration — the type IS the design.
// Palette mirrors the house screen-print look (memory: image-style-newyorker): cream + ink stay
// constant; the accent rotates across the three house colors (persimmon / teal / ochre), chosen
// per card by render.ts (frontmatter `scheme:` overrides; else rotates by the card's `option`).
export const quoteCardSchema = z.object({
  quote: z.string(),
  attribution: z.string(),
  paper: z.string().optional(), // background
  ink: z.string().optional(), // type, keyline, attribution
  accent: z.string().optional(), // ornament + rule
});

const DEFAULT_PAPER = "#f2ead9"; // cream
const DEFAULT_INK = "#1a1a1a"; // black ink
const DEFAULT_ACCENT = "#e2552f"; // persimmon

// High-contrast Didone / editorial serif stack (macOS-first; Chromium renders local fonts).
const SERIF = "'Didot', 'Bodoni 72', 'Hoefler Text', Georgia, 'Times New Roman', serif";

export const QuoteCard: React.FC<z.infer<typeof quoteCardSchema>> = ({
  quote,
  attribution,
  paper,
  ink,
  accent,
}) => {
  const PAPER = paper ?? DEFAULT_PAPER;
  const INK = ink ?? DEFAULT_INK;
  const ACCENT = accent ?? DEFAULT_ACCENT;
  const len = quote.length;
  const fontSize = len > 160 ? 50 : len > 110 ? 60 : len > 70 ? 72 : 88;

  return (
    <AbsoluteFill style={{ background: PAPER, justifyContent: "center", alignItems: "center" }}>
      {/* Inset hairline keyline — the editorial frame */}
      <div
        style={{
          position: "absolute",
          inset: 44,
          border: `1.5px solid ${INK}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 52,
          border: `0.75px solid ${INK}`,
          opacity: 0.55,
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 820,
          padding: "0 80px",
          textAlign: "center",
          color: INK,
        }}
      >
        {/* Opening ornament — the one persimmon touch */}
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 150,
            lineHeight: 0.2,
            color: ACCENT,
            height: 70,
            marginBottom: 28,
          }}
        >
          &ldquo;
        </div>

        <div
          style={{
            fontFamily: SERIF,
            fontSize,
            lineHeight: 1.32,
            fontWeight: 400,
            letterSpacing: "0.005em",
          }}
        >
          {quote}
        </div>

        {/* Short rule + attribution in tracked small caps */}
        <div
          style={{
            width: 56,
            height: 2,
            background: ACCENT,
            margin: "48px auto 22px",
          }}
        />
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 26,
            textTransform: "uppercase",
            letterSpacing: "0.32em",
            color: INK,
            opacity: 0.8,
            // letter-spacing pushes text right; nudge back to keep it optically centered
            paddingLeft: "0.32em",
          }}
        >
          {attribution}
        </div>
      </div>
    </AbsoluteFill>
  );
};
