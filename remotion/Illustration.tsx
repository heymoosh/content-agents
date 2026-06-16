import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";

// Full-bleed raster of an authored SVG. Dimensions come from props (set per aspect by the
// remotion-svg adapter) via calculateMetadata, so one composition renders any aspect ratio.
export const illustrationSchema = z.object({
  svg: z.string(),
  bg: z.string(),
  width: z.number(),
  height: z.number(),
});

export const calculateIllustrationMetadata = ({
  props,
}: {
  props: z.infer<typeof illustrationSchema>;
}) => ({ width: props.width, height: props.height });

export const Illustration: React.FC<z.infer<typeof illustrationSchema>> = ({ svg, bg }) => (
  <AbsoluteFill style={{ background: bg, justifyContent: "center", alignItems: "center" }}>
    <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: svg }} />
  </AbsoluteFill>
);
