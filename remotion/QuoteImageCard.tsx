import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";

// Quote+image card: the SAME verbatim quote as QuoteCard, composited over a generated
// illustration instead of plain paper. Distinct asset type, not a replacement — QuoteCard stays
// purely typographic (Muxin's call, June 2026). Full-bleed image + a bottom scrim so the quote
// stays legible regardless of what the illustration looks like underneath.
export const quoteImageCardSchema = z.object({
  quote: z.string(),
  attribution: z.string(),
  source: z.string().optional(),
  image: z.string(), // relative path (under remotion/public) to the generated background
  accent: z.string().optional(),
});

const DEFAULT_ACCENT = "#e2552f"; // persimmon
const SERIF = "'Didot', 'Bodoni 72', 'Hoefler Text', Georgia, 'Times New Roman', serif";

export const QuoteImageCard: React.FC<z.infer<typeof quoteImageCardSchema>> = ({
  quote,
  attribution,
  source,
  image,
  accent,
}) => {
  const ACCENT = accent ?? DEFAULT_ACCENT;
  const len = quote.length;
  const fontSize = len > 160 ? 42 : len > 110 ? 50 : len > 70 ? 60 : 72;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img
        src={staticFile(image)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Bottom scrim — keeps the quote legible over any illustration. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.08) 68%, rgba(0,0,0,0) 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 88,
        }}
      >
        <div
          style={{
            position: "relative",
            maxWidth: 860,
            padding: "0 80px",
            textAlign: "center",
            color: "#f2ead9",
          }}
        >
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 96,
              lineHeight: 0.6,
              color: ACCENT,
              height: 54,
              marginBottom: 8,
            }}
          >
            &ldquo;
          </div>

          <div
            style={{
              fontFamily: SERIF,
              fontSize,
              lineHeight: 1.3,
              fontWeight: 400,
              letterSpacing: "0.005em",
              textShadow: "0 2px 18px rgba(0,0,0,0.55)",
            }}
          >
            {quote}
          </div>

          <div
            style={{
              width: 56,
              height: 2,
              background: ACCENT,
              margin: "36px auto 18px",
            }}
          />
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 24,
              textTransform: "uppercase",
              letterSpacing: "0.32em",
              opacity: 0.9,
              paddingLeft: "0.32em",
            }}
          >
            {attribution}
          </div>
          {source ? (
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 22,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: 0.6,
                marginTop: 10,
              }}
            >
              {source}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
