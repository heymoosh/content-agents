import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIGURED_MEDIA,
  configuredMediaCapability,
  configuredMediaStage,
  configuredMediaPlan,
  assertConfiguredMediaSupported,
} from "./configured-media.js";

test("configured media registry exactly covers every option exposed by Content configuration", () => {
  assert.deepEqual(Object.keys(CONFIGURED_MEDIA).sort(), [
    "animated-quote-card",
    "audiogram",
    "image",
    "image-carousel",
    "short-video-script",
    "static-quote-card",
    "video-caption-package",
  ]);
});

test("static and animated quote cards stage through the existing still render gate", () => {
  const still = configuredMediaStage("static-quote-card", "card-1");
  assert.deepEqual(still.queue, { format: "image", asset: "media-stages/card-1.json" });
  assert.equal(still.stage, "render-required");
  assert.equal(still.command, undefined);

  const animated = configuredMediaStage("animated-quote-card", "card-1");
  assert.deepEqual(animated.queue, { format: "video", asset: "media-stages/card-1.json" });
  assert.equal(animated.stage, "render-required");
});

test("short-video script stages an inspectable draft behind the existing storyboard approval gate", () => {
  const stage = configuredMediaStage("short-video-script", "video-1");
  assert.equal(stage.stage, "storyboard-required");
  assert.deepEqual(stage.queue, { format: "storyboard", asset: "media-stages/video-1.json" });
  assert.equal(stage.recordPath, "media-stages/video-1.json");
  assert.equal(stage.command, undefined);
});

test("every configured media choice has a supported staged pipeline contract", () => {
  for (const media of Object.keys(CONFIGURED_MEDIA)) {
    const capability = configuredMediaCapability(media);
    assert.equal(capability.supported, true, media);
  }
  assert.throws(() => assertConfiguredMediaSupported("made-up"), /unknown configured media/i);
});

test("standalone image and carousel create inspectable approval plans without claiming final assets", () => {
  const image = configuredMediaStage("image", "image-1");
  assert.equal(image.stage, "prompt-approval-required");
  assert.deepEqual(image.queue, { format: "image", asset: "media-stages/image-1.json" });
  assert.equal(image.command, undefined);
  assert.match(image.primitives.join(" "), /image provider/i);

  const carousel = configuredMediaStage("image-carousel", "slides-1");
  assert.equal(carousel.stage, "slide-plan-approval-required");
  assert.deepEqual(carousel.queue, { format: "image", asset: "media-stages/slides-1.json" });
});

test("caption packages and audiograms fail closed per request when required source media is missing", () => {
  assert.throws(() => configuredMediaStage("video-caption-package", "captions-1"), /requires an approved storyboard or source video/i);
  assert.throws(() => configuredMediaStage("audiogram", "audio-1"), /requires a source audio file/i);

  const captions = configuredMediaStage("video-caption-package", "captions-1", { sourceVideoPath: "incoming/talk.mp4" });
  assert.equal(captions.stage, "source-approval-required");
  assert.deepEqual(captions.sourcePaths, ["incoming/talk.mp4"]);
  assert.match(captions.primitives.join(" "), /transcription|caption/i);

  const audiogram = configuredMediaStage("audiogram", "audio-1", { sourceAudioPath: "incoming/talk.wav" });
  assert.equal(audiogram.stage, "source-approval-required");
  assert.deepEqual(audiogram.sourcePaths, ["incoming/talk.wav"]);
  assert.match(audiogram.primitives.join(" "), /transcription|ffmpeg showwaves/i);
});

test("image, carousel, caption, and audiogram plans are deterministic and source-bound", () => {
  const body = "First exact sentence. Second exact sentence.\n\nThird exact paragraph.";
  assert.deepEqual(configuredMediaPlan("image", body), {
    kind: "image-prompt-brief", sourceExcerpt: body,
    constraints: ["derive the visual only from this approved source excerpt", "no new factual claims or in-asset copy"],
  });
  const carousel = configuredMediaPlan("image-carousel", body);
  assert.equal(carousel.kind, "carousel-slide-plan");
  assert.deepEqual(carousel.slides, ["First exact sentence. Second exact sentence.", "Third exact paragraph."]);
  assert.deepEqual(configuredMediaPlan("video-caption-package", body), { kind: "caption-source-plan", transcript: body });
  assert.deepEqual(configuredMediaPlan("audiogram", body), { kind: "audiogram-source-plan", transcript: body });
});
