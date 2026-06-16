import React from "react";
import { Composition, Still } from "remotion";
import { Short, shortSchema, calculateShortMetadata } from "./Short";
import { QuoteCard, quoteCardSchema } from "./QuoteCard";
import {
  Illustration,
  illustrationSchema,
  calculateIllustrationMetadata,
} from "./Illustration";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Short"
        component={Short}
        schema={shortSchema}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={300}
        defaultProps={{
          audio: "",
          images: [] as string[],
          captions: [],
          durationMs: 10000,
        }}
        calculateMetadata={calculateShortMetadata}
      />
      <Still
        id="QuoteCard"
        component={QuoteCard}
        schema={quoteCardSchema}
        width={1080}
        height={1080}
        defaultProps={{
          quote: "Quote goes here",
          attribution: "Muxin Li",
          bgImage: null as string | null,
        }}
      />
      <Composition
        id="Illustration"
        component={Illustration}
        schema={illustrationSchema}
        width={1024}
        height={1024}
        fps={30}
        durationInFrames={1}
        defaultProps={{
          svg: "<svg xmlns='http://www.w3.org/2000/svg'/>",
          bg: "#f2ead9",
          width: 1024,
          height: 1024,
        }}
        calculateMetadata={calculateIllustrationMetadata}
      />
    </>
  );
};
