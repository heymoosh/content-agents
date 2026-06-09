import React from "react";
import { Composition, Still } from "remotion";
import { Short, shortSchema, calculateShortMetadata } from "./Short";
import { QuoteCard, quoteCardSchema } from "./QuoteCard";

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
    </>
  );
};
