export type Capability =
  | "tts"
  | "image"
  | "transcription"
  | "text-polish"
  | "video-broll"
  | "prose";

export interface TTSResult {
  audioPath: string;
  // Character-level alignment from the provider; null → caller must run forced alignment.
  charTimestamps: { char: string; startMs: number; endMs: number }[] | null;
  costUsd: number;
}

export interface TTSProvider {
  name: string;
  synthesize(req: { text: string; voiceId?: string; outPath: string }): Promise<TTSResult>;
}

export interface ImageProvider {
  name: string;
  generate(req: {
    prompt: string;
    aspect: "9:16" | "1:1" | "16:9";
    outPath: string;
    // Optional per-call settings (model variant, quality, OpenRouter slug, cost override).
    // The main pipeline omits it; the bakeoff passes a contender's `params` from
    // config/bakeoff.yaml so one adapter can stand in for many model/setting combos.
    params?: Record<string, unknown>;
    // Optional reference image paths for character/style consistency (e.g. an anchor frame +
    // the previous scene keyframe). Adapters that can't condition on images ignore them.
    referenceImages?: string[];
  }): Promise<{ imagePath: string; costUsd: number }>;
}

export interface TranscriptionProvider {
  name: string;
  transcribe(req: { audioPath: string }): Promise<{ text: string; costUsd: number }>;
}

export interface TextPolishProvider {
  name: string;
  polish(req: {
    draft: string;
    platform: string;
    instructions: string;
  }): Promise<{ text: string; costUsd: number }>;
}

// Long-form fiction generation (Build 2 — Fiction). Unlike TextPolishProvider, prose needs
// the whole story context (bible + canon + prior chapters) alongside the per-chapter ask, so
// it takes a system prompt (craft + style), a context pack, and chapter instructions.
export interface ProseProvider {
  name: string;
  generate(req: {
    system: string; // craft + narrative style + voice rules (config/fiction/*)
    context: string; // assembled context pack: bible, canon, character sheets, prior chapters
    instructions: string; // what THIS chapter should do (beat sheet / Muxin's direction)
  }): Promise<{ text: string; costUsd: number }>;
}

export interface VideoBrollProvider {
  name: string;
  // Animate between a first and last keyframe (e.g. Kling first/last-frame interpolation).
  // Async under the hood (submit → poll → download); resolves once the clip is written.
  interpolate(req: {
    prompt: string;
    firstFramePath: string;
    lastFramePath: string;
    aspect: "9:16" | "1:1" | "16:9";
    durationSeconds: number;
    outPath: string;
    // Per-call settings from config/providers.yaml `video_broll_params` (model, resolution, cost).
    params?: Record<string, unknown>;
  }): Promise<{ videoPath: string; costUsd: number }>;
}
