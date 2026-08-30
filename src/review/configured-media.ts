/**
 * Authoritative capability registry for media choices exposed by the Content workbench.
 *
 * A supported entry means configured generation can create an inspectable stage that feeds named
 * render/transcript primitives behind an approval gate. It does not mean the final asset exists.
 * Request-specific source requirements are checked by configuredMediaStage, not misreported as a
 * permanently unsupported product capability.
 */
export const CONFIGURED_MEDIA = {
  "static-quote-card": {
    supported: true,
    stage: "render-required",
    renderer: "quote-card-still",
    outputExtension: ".png",
  },
  "animated-quote-card": {
    supported: true,
    stage: "render-required",
    renderer: "quote-card-still",
    outputExtension: ".mp4",
  },
  image: {
    supported: true,
    stage: "prompt-approval-required",
    renderer: "configured-image-provider",
  },
  "image-carousel": {
    supported: true,
    stage: "slide-plan-approval-required",
    renderer: "configured-carousel-images",
  },
  "short-video-script": {
    supported: true,
    stage: "storyboard-required",
    renderer: "storyboard-video",
  },
  "video-caption-package": {
    supported: true,
    stage: "source-approval-required",
    renderer: "configured-caption-package",
  },
  audiogram: {
    supported: true,
    stage: "source-approval-required",
    renderer: "configured-audiogram",
  },
} as const;

export type ConfiguredMedia = keyof typeof CONFIGURED_MEDIA;
export type SupportedConfiguredMedia = {
  [K in ConfiguredMedia]: (typeof CONFIGURED_MEDIA)[K]["supported"] extends true ? K : never
}[ConfiguredMedia];

export function configuredMediaCapability(media: string):
  | (typeof CONFIGURED_MEDIA)[ConfiguredMedia]
  | { readonly supported: false; readonly reason: string } {
  if (Object.prototype.hasOwnProperty.call(CONFIGURED_MEDIA, media)) {
    return CONFIGURED_MEDIA[media as ConfiguredMedia];
  }
  return { supported: false, reason: `unknown configured media: ${media}` };
}

export function assertConfiguredMediaSupported(media: string): asserts media is SupportedConfiguredMedia {
  const capability = configuredMediaCapability(media);
  if (!capability.supported) throw new Error(capability.reason);
}

export interface ConfiguredMediaStage {
  readonly media: SupportedConfiguredMedia;
  readonly stage:
    | "render-required"
    | "storyboard-required"
    | "prompt-approval-required"
    | "slide-plan-approval-required"
    | "source-approval-required";
  readonly recordPath: string;
  readonly queue: { readonly format: "image" | "video" | "storyboard"; readonly asset: string };
  readonly command?: readonly string[];
  readonly primitives: readonly string[];
  readonly sourcePaths?: readonly string[];
}

export interface ConfiguredMediaSourceInputs {
  readonly sourceAudioPath?: string;
  readonly sourceVideoPath?: string;
  readonly approvedStoryboard?: boolean;
  readonly stagedStoryboard?: boolean;
}

export type ConfiguredMediaPlan =
  | { readonly kind: "quote-render-plan"; readonly sourceText: string }
  | { readonly kind: "short-video-storyboard-plan"; readonly sourceText: string; readonly scenes: readonly string[] }
  | { readonly kind: "image-prompt-brief"; readonly sourceExcerpt: string; readonly constraints: readonly string[] }
  | { readonly kind: "carousel-slide-plan"; readonly slides: readonly string[]; readonly constraints: readonly string[] }
  | { readonly kind: "caption-source-plan" | "audiogram-source-plan"; readonly transcript: string };

/** Deterministic, source-bound material a human can inspect before any renderer/provider runs. */
export function configuredMediaPlan(media: string, body: string): ConfiguredMediaPlan {
  assertConfiguredMediaSupported(media);
  const source = body.trim();
  if (!source) throw new Error(`configured ${media} plan requires nonempty approved source text`);
  if (media === "image") {
    return {
      kind: "image-prompt-brief", sourceExcerpt: source,
      constraints: ["derive the visual only from this approved source excerpt", "no new factual claims or in-asset copy"],
    };
  }
  if (media === "image-carousel") {
    const paragraphs = source.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    const slides = paragraphs.length > 1
      ? paragraphs.slice(0, 8)
      : (source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [source]).map((part) => part.trim()).filter(Boolean).slice(0, 8);
    return {
      kind: "carousel-slide-plan", slides,
      constraints: ["slide copy remains verbatim from approved source", "no invented bridge, claim, or example"],
    };
  }
  if (media === "video-caption-package") return { kind: "caption-source-plan", transcript: source };
  if (media === "audiogram") return { kind: "audiogram-source-plan", transcript: source };
  if (media === "short-video-script") {
    const scenes = (source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [source])
      .map((part) => part.trim()).filter(Boolean).slice(0, 7);
    return { kind: "short-video-storyboard-plan", sourceText: source, scenes };
  }
  return { kind: "quote-render-plan", sourceText: source };
}

export function configuredMediaStage(media: string, id: string, inputs: ConfiguredMediaSourceInputs = {}): ConfiguredMediaStage {
  assertConfiguredMediaSupported(media);
  const recordPath = `media-stages/${id}.json`;
  if (media === "short-video-script") {
    return {
      media,
      stage: "storyboard-required",
      recordPath,
      queue: { format: "storyboard", asset: recordPath },
      primitives: ["approved source-bound storyboard plan", "existing storyboard-derived video renderer and paid cost logs"],
    };
  }
  if (media === "image" || media === "image-carousel") {
    const carousel = media === "image-carousel";
    return {
      media,
      stage: carousel ? "slide-plan-approval-required" : "prompt-approval-required",
      recordPath,
      queue: { format: "image", asset: recordPath },
      primitives: carousel
        ? ["approved source-derived slide plan", "existing configured image provider per approved slide"]
        : ["approved source-derived image prompt", "existing configured image provider"],
    };
  }
  if (media === "video-caption-package") {
    if (!inputs.sourceVideoPath && !inputs.approvedStoryboard && !inputs.stagedStoryboard) {
      throw new Error("configured video caption package requires an approved storyboard or source video for this request");
    }
    return {
      media,
      stage: "source-approval-required",
      recordPath,
      queue: { format: "video", asset: recordPath },
      primitives: inputs.approvedStoryboard || inputs.stagedStoryboard
        ? ["existing approved-storyboard transcript", "existing caption alignment and captions.json writer"]
        : ["existing transcription provider", "caption-package normalization"],
      ...(inputs.sourceVideoPath ? { sourcePaths: [inputs.sourceVideoPath] } : {}),
    };
  }
  if (media === "audiogram") {
    if (!inputs.sourceAudioPath) throw new Error("configured audiogram requires a source audio file for this request");
    return {
      media,
      stage: "source-approval-required",
      recordPath,
      queue: { format: "video", asset: recordPath },
      primitives: ["existing transcription provider", "existing caption alignment", "local ffmpeg showwaves waveform composition"],
      sourcePaths: [inputs.sourceAudioPath],
    };
  }
  return {
    media,
    stage: "render-required",
    recordPath,
    queue: { format: media === "static-quote-card" ? "image" : "video", asset: recordPath },
    primitives: ["existing deterministic QuoteCard render", "existing missing-asset approval gate"],
  };
}
