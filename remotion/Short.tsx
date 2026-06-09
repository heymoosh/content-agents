import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createTikTokStyleCaptions, Caption } from "@remotion/captions";
import { z } from "zod";

export const shortSchema = z.object({
  audio: z.string(),
  images: z.array(z.string()),
  captions: z.array(
    z.object({
      text: z.string(),
      startMs: z.number(),
      endMs: z.number(),
      timestampMs: z.number().nullable(),
      confidence: z.number().nullable(),
    })
  ),
  durationMs: z.number(),
});

type ShortProps = z.infer<typeof shortSchema>;

export const calculateShortMetadata = ({ props }: { props: ShortProps }) => {
  const fps = 30;
  return {
    durationInFrames: Math.max(30, Math.ceil((props.durationMs / 1000) * fps)),
    props,
  };
};

const KenBurnsImage: React.FC<{ src: string; index: number; durationInFrames: number }> = ({
  src,
  index,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const zoomIn = index % 2 === 0;
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    zoomIn ? [1.0, 1.18] : [1.18, 1.0],
    { extrapolateRight: "clamp" }
  );
  const drift = interpolate(frame, [0, durationInFrames], [0, index % 2 === 0 ? -30 : 30], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#0c0c14" }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateY(${drift}px)`,
        }}
      />
      <AbsoluteFill style={{ background: "rgba(8,8,16,0.25)" }} />
    </AbsoluteFill>
  );
};

const CaptionOverlay: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions,
        combineTokensWithinMilliseconds: 900,
      }),
    [captions]
  );

  const page = pages.find(
    (p, i) =>
      currentMs >= p.startMs &&
      (i === pages.length - 1 || currentMs < pages[i + 1].startMs)
  );
  if (!page) return null;

  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 420 }}
    >
      <div
        style={{
          maxWidth: 880,
          textAlign: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          fontSize: 64,
          fontWeight: 800,
          lineHeight: 1.25,
          color: "white",
          textShadow: "0 4px 24px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)",
          padding: "0 40px",
        }}
      >
        {page.tokens.map((t, i) => (
          <span
            key={i}
            style={{
              color: currentMs >= t.fromMs ? "#ffd34d" : "white",
              transition: "none",
            }}
          >
            {t.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Short: React.FC<ShortProps> = ({ audio, images, captions, durationMs }) => {
  const { fps } = useVideoConfig();
  const totalFrames = Math.ceil((durationMs / 1000) * fps);
  const perImage = images.length > 0 ? Math.ceil(totalFrames / images.length) : totalFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0c14" }}>
      {images.map((src, i) => (
        <Sequence key={src} from={i * perImage} durationInFrames={perImage}>
          <KenBurnsImage src={src} index={i} durationInFrames={perImage} />
        </Sequence>
      ))}
      {audio ? <Audio src={staticFile(audio)} /> : null}
      <CaptionOverlay captions={captions as Caption[]} />
    </AbsoluteFill>
  );
};
