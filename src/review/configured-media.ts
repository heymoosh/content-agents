import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitFrontmatter } from "../util/frontmatter.js";

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

/** The two media values that paint a quote onto an image and therefore need a separate quote text. */
export const CONFIGURED_CARD_MEDIA = ["static-quote-card", "animated-quote-card"] as const;

export function isConfiguredCardMedia(media: string): boolean {
  return (CONFIGURED_CARD_MEDIA as readonly string[]).includes(media);
}

/**
 * The companion definition derivative that holds the short verbatim quote drawn ON a card, kept
 * apart from `derivatives/<id>.md`, which stays the per-platform post text that frames it. One
 * naming rule so generation, the stage record, and the renderer cannot drift onto two names.
 */
const CARD_QUOTE_SUFFIX = "-quote";

export function configuredCardQuoteDerivative(id: string): string {
  return `${id}${CARD_QUOTE_SUFFIX}`;
}

/** True for the quote companion itself, so the post-text rules are never applied to the quote. */
export function isConfiguredCardQuoteDerivative(name: string): boolean {
  return name.length > CARD_QUOTE_SUFFIX.length && name.endsWith(CARD_QUOTE_SUFFIX);
}

/**
 * Everything that determines the pixels of ONE configured card render.
 *
 * `definition` is the exact text of the quote definition file the renderer reads: its body is the
 * quote painted on the card and its frontmatter carries the `scheme:` that picks the palette, so
 * two definitions differing in any byte are two different cards. `sourceLine` is the in-asset
 * source line the still renderer reads from the folder's source.md. `media` is part of the set
 * because a static card's deliverable is the `.png` and an animated card's is the `.mp4`: those are
 * never one render, even when the text on them is the same.
 *
 * This set is the WHOLE key. A future aspect ratio would be one more field here, so sharing would
 * split on aspect — one extra render — rather than degrading to one render per platform. Muxin's
 * 2026-09-05 decision keeps every card square at 1080x1080, so no such field exists today.
 */
export interface ConfiguredCardRenderInputs {
  readonly media: string;
  readonly definition: string;
  readonly sourceLine: string;
}

const CARD_RENDER_PREFIX = "card-";
const CARD_RENDER_KEY_CHARS = 32;

export function configuredCardRenderKey(inputs: ConfiguredCardRenderInputs): string {
  return createHash("sha256")
    .update(JSON.stringify([inputs.media, inputs.sourceLine, inputs.definition]))
    .digest("hex")
    .slice(0, CARD_RENDER_KEY_CHARS);
}

/**
 * The shared, content-addressed name of a card render: its definition `derivatives/<name>.md` and
 * its rendered `images/<name>.png` / `.mp4`.
 *
 * Derived from the render inputs and never from a variant id or a platform name, so several
 * platforms in one request whose card is byte-identical resolve to ONE definition file and ONE
 * rendered file, while two genuinely different cards can never land on the same name.
 */
export function configuredCardRenderDerivative(inputs: ConfiguredCardRenderInputs): string {
  return `${CARD_RENDER_PREFIX}${configuredCardRenderKey(inputs)}${CARD_QUOTE_SUFFIX}`;
}

/**
 * True for a content-addressed render name, false for the legacy per-variant `<id>-quote`. Only a
 * content-addressed name is safe to reuse off disk: its bytes are provably the ones that produced
 * the file, whereas a per-variant name can outlive the quote it was rendered from.
 */
export function isConfiguredCardRenderName(name: string): boolean {
  return new RegExp(`^${CARD_RENDER_PREFIX}[0-9a-f]{${CARD_RENDER_KEY_CHARS}}${CARD_QUOTE_SUFFIX}$`).test(name);
}

/** Where the still renderer writes a card of this media. Square 1080x1080 either way. */
export function configuredCardImagePath(media: string, renderName: string): string {
  return `images/${renderName}${media === "static-quote-card" ? ".png" : ".mp4"}`;
}

/**
 * The in-asset source line the still renderer paints under the attribution: source.md's title,
 * suppressed for a Substack Note (whose first line is not a title). Read here rather than inferred,
 * because it is a render input: editing it changes the pixels and must therefore change the key.
 */
export function configuredCardSourceLine(folder: string): string {
  try {
    const { fm } = splitFrontmatter(readFileSync(join(folder, "source.md"), "utf8"));
    return typeof fm.title === "string" && fm.source_kind !== "substack-note" ? fm.title : "";
  } catch {
    return ""; // no source.md (e.g. a bare quote) — the renderer omits the source line
  }
}

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

/**
 * Deterministic, source-bound material a human can inspect before any renderer/provider runs.
 *
 * For card media the `body` is the QUOTE that gets painted on the image (the companion
 * `configuredCardQuoteDerivative` file's body), never the post text that frames it, because the
 * plan's `sourceText` is what the renderer draws.
 */
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
