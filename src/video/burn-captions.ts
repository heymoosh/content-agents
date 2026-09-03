import { writeFileSync, existsSync, rmSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { charsToWordCaptions, type Caption } from "./captions.js";
import { charsOrWhisper, type CharTs } from "./align.js";
import { remotion, withRemotionJob, REMOTION_ENTRY } from "./remotion-job.js";

// Burn house-style karaoke captions onto an existing vertical video (the Reelify replacement).
// One whisper.cpp pass (local, $0) aligns the spoken words; the AnimatedShort composition renders
// them with the SAME CaptionOverlay every short uses (remotion/Short.tsx is the single style
// definition), so every captioned clip looks identical. The source video's own audio track plays
// (OffthreadVideo is not muted), so no audio is extracted or doubled.
//
// Vertical-only by design: the composition is a fixed 1080x1920 with object-fit cover, so any
// landscape input would be cropped. We fail closed instead of guessing.

export interface VideoProbe { width: number; height: number; durationMs: number }

export interface BurnCaptionsDeps {
  probe: (path: string) => VideoProbe;
  align: (mediaPath: string) => Promise<CharTs[]>;
  render: (props: AnimatedShortRenderProps, sourcePath: string, outPath: string) => Promise<void>;
}

export interface AnimatedShortRenderProps {
  audio: string;
  clips: string[];
  clipFrames: number[];
  captions: Caption[];
  durationMs: number;
}

export interface BurnCaptionsInput {
  sourcePath: string;
  outPath: string;
  /** Optional sidecar outputs written from the same alignment pass. */
  transcriptPath?: string;
  captionsPath?: string;
}

export interface BurnCaptionsResult { captions: Caption[]; transcript: string; durationMs: number }

const FPS = 30;
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

export function ffprobeVideo(path: string): VideoProbe {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", path], { encoding: "utf8" });
  const data = JSON.parse(out) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
  const stream = data.streams?.[0];
  const seconds = Number(data.format?.duration ?? 0);
  if (!stream?.width || !stream.height || !(seconds > 0)) throw new Error(`ffprobe could not read a video stream from ${path}`);
  return { width: stream.width, height: stream.height, durationMs: Math.round(seconds * 1000) };
}

/** Render props through AnimatedShort with the source video staged as its single clip. */
export async function renderCaptionedVideo(props: AnimatedShortRenderProps, sourcePath: string, outPath: string): Promise<void> {
  await withRemotionJob(async (jobDir, jobName) => {
    const clipName = `source${extname(sourcePath).toLowerCase()}`;
    execFileSync("cp", [sourcePath, join(jobDir, clipName)]);
    const propsFile = join(jobDir, "props.json");
    writeFileSync(propsFile, JSON.stringify({ ...props, clips: [`${jobName}/${clipName}`] }));
    remotion(["render", REMOTION_ENTRY, "AnimatedShort", outPath, `--props=${propsFile}`]);
  });
}

export const defaultBurnCaptionsDeps: BurnCaptionsDeps = {
  probe: ffprobeVideo,
  align: (mediaPath) => charsOrWhisper(null, mediaPath),
  render: renderCaptionedVideo,
};

export function transcriptFromCaptions(captions: Caption[]): string {
  return captions.map((c) => c.text.trim()).filter(Boolean).join(" ");
}

export async function burnCaptions(input: BurnCaptionsInput, deps: BurnCaptionsDeps = defaultBurnCaptionsDeps): Promise<BurnCaptionsResult> {
  const { sourcePath, outPath } = input;
  if (!existsSync(sourcePath)) throw new Error(`missing source video: ${sourcePath}`);
  if (!VIDEO_EXTENSIONS.has(extname(sourcePath).toLowerCase())) throw new Error(`captions need a video file (.mp4/.mov/.m4v/.webm), got ${basename(sourcePath)}`);
  if (extname(outPath).toLowerCase() !== ".mp4") throw new Error(`captioned output must be an .mp4, got ${basename(outPath)}`);
  const probe = deps.probe(sourcePath);
  if (probe.height <= probe.width) {
    throw new Error(`${basename(sourcePath)} is ${probe.width}x${probe.height}; captions are rendered on a vertical 1080x1920 canvas, so supply a portrait video`);
  }
  const captions = charsToWordCaptions(await deps.align(sourcePath));
  if (captions.length === 0) throw new Error(`no spoken words were found in ${basename(sourcePath)}; nothing to caption`);
  const transcript = transcriptFromCaptions(captions);
  const durationMs = probe.durationMs;
  const props: AnimatedShortRenderProps = {
    audio: "", // the clip's own track plays; an extracted copy would double it
    clips: [],
    clipFrames: [Math.ceil((durationMs / 1000) * FPS)],
    captions,
    durationMs,
  };
  await deps.render(props, sourcePath, outPath);
  if (!existsSync(outPath)) throw new Error(`caption render produced no file at ${outPath}`);
  if (input.transcriptPath) writeFileSync(input.transcriptPath, transcript + "\n");
  if (input.captionsPath) writeFileSync(input.captionsPath, JSON.stringify(captions, null, 2) + "\n");
  return { captions, transcript, durationMs };
}

/**
 * Audiogram = a 1080x1920 waveform clip drawn from the audio (ffmpeg showwaves, $0) with the
 * same synced captions burned over it. The intermediate waveform clip is removed after the burn.
 */
export async function renderAudiogram(
  input: { audioPath: string; outPath: string; transcriptPath?: string; captionsPath?: string },
  deps: BurnCaptionsDeps & { waveform?: (audioPath: string, clipPath: string) => void } = defaultBurnCaptionsDeps,
): Promise<BurnCaptionsResult> {
  if (!existsSync(input.audioPath)) throw new Error(`missing source audio: ${input.audioPath}`);
  const clipPath = input.outPath.replace(/\.mp4$/i, "") + "-waveform.mp4";
  (deps.waveform ?? renderWaveformClip)(input.audioPath, clipPath);
  try {
    return await burnCaptions({ sourcePath: clipPath, outPath: input.outPath, transcriptPath: input.transcriptPath, captionsPath: input.captionsPath }, deps);
  } finally {
    rmSync(clipPath, { force: true }); // intermediate only; the captioned output is the artifact
  }
}

export function renderWaveformClip(audioPath: string, clipPath: string): void {
  execFileSync("ffmpeg", [
    "-y", "-i", audioPath,
    "-filter_complex", "[0:a]showwaves=s=1080x1920:mode=cline:colors=0x19a7a0:scale=sqrt,format=yuv420p[v]",
    "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-c:a", "aac", "-r", String(FPS), "-shortest", clipPath,
  ], { stdio: "ignore" });
}
