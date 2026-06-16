export type Capability = "tts" | "image" | "transcription" | "text-polish" | "video-broll";

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
