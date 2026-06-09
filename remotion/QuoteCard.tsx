import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";

export const quoteCardSchema = z.object({
  quote: z.string(),
  attribution: z.string(),
  bgImage: z.string().nullable(),
});

export const QuoteCard: React.FC<z.infer<typeof quoteCardSchema>> = ({
  quote,
  attribution,
  bgImage,
}) => {
  const fontSize = quote.length > 120 ? 52 : quote.length > 60 ? 64 : 78;
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(150deg, #131320 0%, #1d2440 55%, #2a1f3d 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {bgImage ? (
        <>
          <Img
            src={staticFile(bgImage)}
            style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }}
          />
          <AbsoluteFill style={{ background: "rgba(12,12,24,0.72)" }} />
        </>
      ) : null}
      <div
        style={{
          position: "relative",
          maxWidth: 860,
          padding: "0 60px",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "white",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 130, lineHeight: 0.4, color: "#ffd34d", marginBottom: 36 }}>“</div>
        <div style={{ fontSize, lineHeight: 1.35, fontWeight: 500 }}>{quote}</div>
        <div
          style={{
            marginTop: 48,
            fontSize: 34,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
            color: "#b9bdd1",
            letterSpacing: 1,
          }}
        >
          — {attribution}
        </div>
      </div>
    </AbsoluteFill>
  );
};
