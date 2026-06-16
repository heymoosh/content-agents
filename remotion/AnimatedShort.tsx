import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  staticFile,
} from "remotion";
import { Caption } from "@remotion/captions";
import { z } from "zod";
import { CaptionOverlay } from "./Short";

// Like Short, but the background is Kling-interpolated video clips (one per scene transition)
// played back-to-back, instead of Ken Burns over stills. Reuses Short's CaptionOverlay so the
// karaoke captions are identical. Kokoro voiceover rides on top.
export const animatedShortSchema = z.object({
  audio: z.string(),
  clips: z.array(z.string()),
  clipFrames: z.array(z.number()), // frames each clip occupies, in order
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

type AnimatedShortProps = z.infer<typeof animatedShortSchema>;

export const calculateAnimatedShortMetadata = ({ props }: { props: AnimatedShortProps }) => {
  const fps = 30;
  return {
    durationInFrames: Math.max(30, Math.ceil((props.durationMs / 1000) * fps)),
    props,
  };
};

export const AnimatedShort: React.FC<AnimatedShortProps> = ({
  audio,
  clips,
  clipFrames,
  captions,
}) => {
  let offset = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0c14" }}>
      {clips.map((src, i) => {
        const from = offset;
        const dur = clipFrames[i] ?? 90;
        offset += dur;
        return (
          <Sequence key={src} from={from} durationInFrames={dur}>
            <OffthreadVideo
              src={staticFile(src)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
        );
      })}
      {/* Scrim so white captions stay legible over bright/light animated backgrounds.
          (The image-motion path darkens its stills; the video clips here are not dimmed.) */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      {audio ? <Audio src={staticFile(audio)} /> : null}
      <CaptionOverlay captions={captions as Caption[]} />
    </AbsoluteFill>
  );
};
