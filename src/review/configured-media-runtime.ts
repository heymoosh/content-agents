import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readQueue, writeCell } from "../publish/queue.js";
import { getImage, getTranscription } from "../providers/registry.js";
import { logCost } from "../util/cost-log.js";
import { tryAcquireFileLease } from "../runtime/file-lock.js";

export interface PersistedConfiguredMediaStage {
  version: "configured-media-stage-v1";
  id: string;
  media: string;
  status: "staged" | "approved" | "promotion-pending" | "rendered";
  stage: string;
  plan: unknown;
  primitives: string[];
  sourcePaths?: string[];
  approval?: { approvedAt: string; digest: string };
  rendered?: {
    primaryAsset: string;
    assets: string[];
    manifestPath: string;
    costUsd: number;
    renderedAt: string;
    provenance?: "provider-render" | "reviewed-attachment";
  };
}

export interface ConfiguredMediaRenderResult {
  primaryAsset: string;
  assets: string[];
  costUsd: number;
}

export type ConfiguredMediaRenderer = (
  stage: Readonly<PersistedConfiguredMediaStage>,
  folder: string,
) => Promise<ConfiguredMediaRenderResult>;

type ConfiguredMediaPromoter = (folder: string, id: string, update: { asset: string; notes: string }) => boolean;
const configuredMediaStageLanes = new Map<string, Promise<void>>();

async function withConfiguredMediaStageLane<T>(folder: string, id: string, task: () => Promise<T>): Promise<T> {
  stagePath(folder, id); // validates id before it participates in either an in-memory or filesystem lock path
  const key = `${resolve(folder)}\0${id}`;
  const previous = configuredMediaStageLanes.get(key) ?? Promise.resolve();
  let release!: () => void;
  const turn = new Promise<void>((resolveTurn) => { release = resolveTurn; });
  const tail = previous.catch(() => undefined).then(() => turn);
  configuredMediaStageLanes.set(key, tail);
  await previous.catch(() => undefined);
  const lease = tryAcquireFileLease(join(folder, "media-stages", ".locks", `${id}.execute.lock`), { staleMs: 30 * 60_000 });
  try {
    if (!lease) throw new Error(`configured media stage ${id} is already executing in another process`);
    return await task();
  } finally {
    lease?.release();
    release();
    if (configuredMediaStageLanes.get(key) === tail) configuredMediaStageLanes.delete(key);
  }
}

function stagePath(folder: string, id: string): string {
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad configured media id");
  return join(folder, "media-stages", `${id}.json`);
}

export function readConfiguredMediaStage(folder: string, id: string): PersistedConfiguredMediaStage {
  const parsed = JSON.parse(readFileSync(stagePath(folder, id), "utf8")) as PersistedConfiguredMediaStage;
  if (parsed.version !== "configured-media-stage-v1" || parsed.id !== id) throw new Error("invalid configured media stage");
  return parsed;
}

export function approveConfiguredMediaStage(folder: string, id: string): PersistedConfiguredMediaStage {
  const stage = readConfiguredMediaStage(folder, id);
  if (stage.status === "rendered" || stage.status === "promotion-pending") throw new Error("configured media stage has already rendered output");
  const approved = {
    ...stage, status: "approved" as const,
    approval: { approvedAt: new Date().toISOString(), digest: stageDigest(stage) },
  };
  writeFileSync(stagePath(folder, id), JSON.stringify(approved, null, 2) + "\n");
  return approved;
}

function stageDigest(stage: Pick<PersistedConfiguredMediaStage, "id" | "media" | "stage" | "plan" | "primitives" | "sourcePaths">): string {
  return createHash("sha256").update(JSON.stringify({ id: stage.id, media: stage.media, stage: stage.stage, plan: stage.plan, primitives: stage.primitives, sourcePaths: stage.sourcePaths ?? [] })).digest("hex");
}

function verifiedRelativeAsset(folder: string, relative: string): string {
  if (!relative || relative.startsWith("/") || relative.includes("..")) throw new Error("renderer returned an unsafe asset path");
  const absolute = resolve(folder, relative);
  const root = resolve(folder) + "/";
  if (!absolute.startsWith(root) || !existsSync(absolute)) throw new Error(`renderer did not create verified asset: ${relative}`);
  return relative;
}

function assertCurrentApproval(stage: PersistedConfiguredMediaStage): asserts stage is PersistedConfiguredMediaStage & { approval: { approvedAt: string; digest: string } } {
  if (!stage.approval || stage.approval.digest !== stageDigest(stage)) {
    throw new Error("configured media stage changed after approval; approve the current plan/source again");
  }
}

function assertStageReviewRow(folder: string, id: string): void {
  if (!readQueue(folder).rows.some((row) => row.id === id && row.asset === `media-stages/${id}.json`)) {
    throw new Error("configured media review row is missing or no longer points at its stage plan");
  }
}

function promotePendingConfiguredMedia(
  folder: string,
  id: string,
  stage: PersistedConfiguredMediaStage,
  promote: ConfiguredMediaPromoter,
): ConfiguredMediaRenderResult {
  assertCurrentApproval(stage);
  if (!stage.rendered) throw new Error("configured media promotion checkpoint is missing its rendered output record");
  const primaryAsset = verifiedRelativeAsset(folder, stage.rendered.primaryAsset);
  const assets = stage.rendered.assets.map((asset) => verifiedRelativeAsset(folder, asset));
  const manifestPath = verifiedRelativeAsset(folder, stage.rendered.manifestPath);
  const manifest = JSON.parse(readFileSync(join(folder, manifestPath), "utf8")) as {
    version?: string; id?: string; media?: string; primaryAsset?: string; assets?: string[]; costUsd?: number; approvalDigest?: string;
    provenance?: "provider-render" | "reviewed-attachment";
  };
  const provenance = stage.rendered.provenance ?? "provider-render";
  if (manifest.version !== "configured-media-render-v1" || manifest.id !== id || manifest.media !== stage.media
    || manifest.primaryAsset !== primaryAsset || JSON.stringify(manifest.assets) !== JSON.stringify(assets)
    || manifest.costUsd !== stage.rendered.costUsd || manifest.approvalDigest !== stage.approval.digest
    || (manifest.provenance ?? "provider-render") !== provenance) {
    throw new Error("configured media render manifest changed before queue promotion");
  }
  if (!assets.includes(primaryAsset)) throw new Error("configured media promotion checkpoint does not verify its primary asset");
  const action = provenance === "reviewed-attachment" ? `Attached reviewed ${stage.media}` : `Rendered ${stage.media}`;
  if (!promote(folder, id, { asset: primaryAsset, notes: `${action}; manifest ${stage.rendered.manifestPath}` })) {
    throw new Error("render succeeded but review row is missing; promotion remains pending");
  }
  writeFileSync(stagePath(folder, id), JSON.stringify({ ...stage, status: "rendered" }, null, 2) + "\n");
  return { primaryAsset, assets, costUsd: stage.rendered.costUsd };
}

function checkpointConfiguredMedia(
  folder: string,
  id: string,
  stage: PersistedConfiguredMediaStage & { approval: { approvedAt: string; digest: string } },
  result: ConfiguredMediaRenderResult,
  promote: ConfiguredMediaPromoter,
  provenance: "provider-render" | "reviewed-attachment" = "provider-render",
): ConfiguredMediaRenderResult {
  const manifestPath = `configured-media/${id}/render-manifest.json`;
  const manifestAbs = join(folder, manifestPath);
  mkdirSync(dirname(manifestAbs), { recursive: true });
  const renderedAt = new Date().toISOString();
  writeFileSync(manifestAbs, JSON.stringify({ version: "configured-media-render-v1", id, media: stage.media, primaryAsset: result.primaryAsset, assets: result.assets, costUsd: result.costUsd, renderedAt, approvalDigest: stage.approval.digest, provenance }, null, 2) + "\n");
  const pending: PersistedConfiguredMediaStage = {
    ...stage,
    status: "promotion-pending",
    rendered: { primaryAsset: result.primaryAsset, assets: result.assets, manifestPath, costUsd: result.costUsd, renderedAt, provenance },
  };
  writeFileSync(stagePath(folder, id), JSON.stringify(pending, null, 2) + "\n");
  return promotePendingConfiguredMedia(folder, id, pending, promote);
}

export async function executeConfiguredMediaStage(
  folder: string,
  id: string,
  renderer: ConfiguredMediaRenderer,
  promote: (folder: string, id: string, update: { asset: string; notes: string }) => boolean = writeCell,
): Promise<ConfiguredMediaRenderResult> {
  return withConfiguredMediaStageLane(folder, id, () => executeConfiguredMediaStageUnlocked(folder, id, renderer, promote));
}

async function executeConfiguredMediaStageUnlocked(
  folder: string,
  id: string,
  renderer: ConfiguredMediaRenderer,
  promote: ConfiguredMediaPromoter,
): Promise<ConfiguredMediaRenderResult> {
  const stage = readConfiguredMediaStage(folder, id);
  if (stage.status === "promotion-pending") {
    return promotePendingConfiguredMedia(folder, id, stage, promote);
  }
  if (stage.status !== "approved") throw new Error("configured media plan/source is not approved");
  assertCurrentApproval(stage);
  for (const sourcePath of stage.sourcePaths ?? []) verifiedRelativeAsset(folder, sourcePath);
  assertStageReviewRow(folder, id);
  const result = await renderer(stage, folder);
  const primaryAsset = verifiedRelativeAsset(folder, result.primaryAsset);
  const assets = [...new Set(result.assets.map((asset) => verifiedRelativeAsset(folder, asset)))];
  if (!assets.includes(primaryAsset)) throw new Error("renderer primary asset is missing from its verified asset list");
  if (!Number.isFinite(result.costUsd) || result.costUsd < 0) throw new Error("renderer returned an invalid cost");
  return checkpointConfiguredMedia(folder, id, stage, { primaryAsset, assets, costUsd: result.costUsd }, promote);
}

const REVIEWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function matchesImageBytes(absolute: string, extension: string): boolean {
  const signature = readFileSync(absolute).subarray(0, 12);
  if (extension === ".png") {
    return signature.length >= 8 && signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  }
  if (extension === ".gif") {
    const header = signature.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  return extension === ".webp"
    && signature.length >= 12
    && signature.subarray(0, 4).toString("ascii") === "RIFF"
    && signature.subarray(8, 12).toString("ascii") === "WEBP";
}

function verifiedReviewedImage(folder: string, relative: string): { absolute: string; extension: string } {
  if (!relative || relative.startsWith("/") || relative.split(/[\\/]/).includes("..")) {
    throw new Error("reviewed image has an unsafe path outside the content folder");
  }
  const absolute = resolve(folder, relative);
  const root = resolve(folder) + "/";
  if (!absolute.startsWith(root) || !existsSync(absolute)) throw new Error(`reviewed image is missing or has an unsafe path: ${relative}`);
  const stats = lstatSync(absolute);
  if (stats.isSymbolicLink()) throw new Error(`reviewed image must not be a symlink: ${relative}`);
  if (!stats.isFile()) throw new Error(`reviewed image must be a regular file: ${relative}`);
  const actualRoot = realpathSync(folder) + "/";
  const actual = realpathSync(absolute);
  if (!actual.startsWith(actualRoot)) throw new Error(`reviewed image resolves outside the content folder through a symlink: ${relative}`);
  if (stats.size === 0) throw new Error(`reviewed image must not be empty: ${relative}`);
  const extension = extname(absolute).toLowerCase();
  if (!REVIEWED_IMAGE_EXTENSIONS.has(extension)) throw new Error(`reviewed attachment is not a supported image file: ${relative}`);
  if (!matchesImageBytes(absolute, extension)) throw new Error(`reviewed image bytes do not match its ${extension} extension: ${relative}`);
  return { absolute, extension };
}

/** Promotes attended, externally generated image files only after their configured plan was approved. */
export async function attachReviewedConfiguredMediaFiles(
  folder: string,
  id: string,
  assetPaths: readonly string[],
  promote: ConfiguredMediaPromoter = writeCell,
): Promise<ConfiguredMediaRenderResult> {
  return withConfiguredMediaStageLane(folder, id, () => attachReviewedConfiguredMediaFilesUnlocked(folder, id, assetPaths, promote));
}

async function attachReviewedConfiguredMediaFilesUnlocked(
  folder: string,
  id: string,
  assetPaths: readonly string[],
  promote: ConfiguredMediaPromoter,
): Promise<ConfiguredMediaRenderResult> {
  const stage = readConfiguredMediaStage(folder, id);
  if (stage.media !== "image" && stage.media !== "image-carousel") {
    throw new Error("reviewed-file attachment supports only image and image-carousel stages");
  }
  if (stage.status === "promotion-pending") return promotePendingConfiguredMedia(folder, id, stage, promote);
  if (stage.status !== "approved") throw new Error("configured media plan/source is not approved");
  assertCurrentApproval(stage);
  assertStageReviewRow(folder, id);

  const expectedCount = stage.media === "image-carousel"
    && typeof stage.plan === "object" && stage.plan !== null
    && Array.isArray((stage.plan as { slides?: unknown }).slides)
    ? (stage.plan as { slides: unknown[] }).slides.length
    : 1;
  if (expectedCount < 1) throw new Error("reviewed image-carousel attachment requires an approved nonempty slide plan");
  if (assetPaths.length !== expectedCount) {
    throw new Error(`reviewed ${stage.media} attachment requires exactly ${expectedCount} image file${expectedCount === 1 ? "" : "s"}`);
  }
  const reviewed = assetPaths.map((assetPath) => verifiedReviewedImage(folder, assetPath));
  if (stage.media === "image-carousel") {
    reviewed.forEach(({ absolute }, index) => {
      const numbered = basename(absolute).match(/(?:^|[-_ ])slide[-_ ]?(\d+)(?:\D|$)/i);
      if (numbered && Number(numbered[1]) !== index + 1) {
        throw new Error(`reviewed carousel slide order does not match the approved slide plan at position ${index + 1}`);
      }
    });
  }

  const outDir = join(folder, "configured-media", id);
  mkdirSync(outDir, { recursive: true });
  if (stage.media === "image") {
    const primaryAsset = `configured-media/${id}/image${reviewed[0].extension}`;
    const destination = join(folder, primaryAsset);
    if (reviewed[0].absolute !== destination) copyFileSync(reviewed[0].absolute, destination);
    return checkpointConfiguredMedia(folder, id, stage, { primaryAsset, assets: [primaryAsset], costUsd: 0 }, promote, "reviewed-attachment");
  }

  const slides = reviewed.map(({ absolute, extension }, index) => {
    const relative = `configured-media/${id}/slide-${index + 1}${extension}`;
    const destination = join(folder, relative);
    if (absolute !== destination) copyFileSync(absolute, destination);
    return relative;
  });
  const primaryAsset = `configured-media/${id}/carousel-manifest.json`;
  writeFileSync(join(folder, primaryAsset), JSON.stringify({ version: "configured-carousel-v1", slides }, null, 2) + "\n");
  return checkpointConfiguredMedia(folder, id, stage, { primaryAsset, assets: [primaryAsset, ...slides], costUsd: 0 }, promote, "reviewed-attachment");
}

function wordCaptions(text: string): { text: string; startMs: number; endMs: number }[] {
  return text.split(/\s+/).filter(Boolean).map((word, index) => ({ text: word, startMs: index * 320, endMs: (index + 1) * 320 }));
}

/** Production dispatcher. It is called only after executeConfiguredMediaStage proves approval. */
export const defaultConfiguredMediaRenderer: ConfiguredMediaRenderer = async (stage, folder) => {
  const outDir = join(folder, "configured-media", stage.id);
  mkdirSync(outDir, { recursive: true });
  if (stage.media === "static-quote-card" || stage.media === "animated-quote-card") {
    execFileSync("npm", ["run", "render", "--", "--still", folder, "--quote", stage.id], { stdio: "inherit" });
    const primaryAsset = `images/${stage.id}${stage.media === "static-quote-card" ? ".png" : ".mp4"}`;
    const companion = `images/${stage.id}${stage.media === "static-quote-card" ? ".mp4" : ".png"}`;
    return { primaryAsset, assets: [primaryAsset, companion], costUsd: 0 };
  }
  if (stage.media === "short-video-script") {
    const plan = stage.plan as { sourceText?: string; scenes?: string[] };
    if (!plan.sourceText?.trim() || !plan.scenes?.length) throw new Error("approved short-video stage has no inspectable storyboard scenes");
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    mkdirSync(join(folder, "video"), { recursive: true });
    writeFileSync(join(folder, "derivatives", "video-script.md"), `---\nplatform: video-script\nsource_ref: media-stages/${stage.id}.json\n---\n\n${plan.sourceText.trim()}\n`);
    writeFileSync(join(folder, "video", "image-prompts.txt"), plan.scenes.map((scene) => `Source-bound visual treatment for: ${scene}`).join("\n") + "\n");
    // The configured stage is the storyboard: executeConfiguredMediaStage has already proved its
    // explicit approval and tamper digest. The low-level renderer retains every provider cost log.
    execFileSync("npm", ["run", "render", "--", "--video", folder], { stdio: "inherit" });
    const assets = ["video/short.mp4", "video/thumbnail.png", "video/transcript.txt", "video/captions.json"];
    return { primaryAsset: assets[0], assets, costUsd: 0 };
  }
  if (stage.media === "image") {
    const plan = stage.plan as { sourceExcerpt?: string };
    if (!plan.sourceExcerpt) throw new Error("approved image stage has no source-bound prompt brief");
    const relative = `configured-media/${stage.id}/image.png`;
    const { provider: image, params } = await getImage();
    const rendered = await image.generate({ prompt: plan.sourceExcerpt, aspect: "1:1", outPath: join(folder, relative), params });
    logCost({ step: `image:${image.name}`, detail: `${stage.id}/configured-image`, costUsd: rendered.costUsd });
    return { primaryAsset: relative, assets: [relative], costUsd: rendered.costUsd };
  }
  if (stage.media === "image-carousel") {
    const plan = stage.plan as { slides?: string[] };
    if (!plan.slides?.length) throw new Error("approved carousel stage has no source-bound slides");
    const { provider: image, params } = await getImage();
    const assets: string[] = [];
    let costUsd = 0;
    for (let index = 0; index < plan.slides.length; index++) {
      const relative = `configured-media/${stage.id}/slide-${index + 1}.png`;
      const rendered = await image.generate({ prompt: plan.slides[index], aspect: "1:1", outPath: join(folder, relative), params });
      costUsd += rendered.costUsd; assets.push(relative);
      logCost({ step: `image:${image.name}`, detail: `${stage.id}/carousel-${index + 1}`, costUsd: rendered.costUsd });
    }
    const primaryAsset = `configured-media/${stage.id}/carousel-manifest.json`;
    writeFileSync(join(folder, primaryAsset), JSON.stringify({ version: "configured-carousel-v1", slides: assets }, null, 2) + "\n");
    return { primaryAsset, assets: [primaryAsset, ...assets], costUsd };
  }
  if (stage.media === "video-caption-package") {
    let transcript = (stage.plan as { transcript?: string }).transcript ?? "";
    let costUsd = 0;
    if (stage.sourcePaths?.[0]) {
      const source = join(folder, stage.sourcePaths[0]);
      const audio = join(outDir, "source-audio.wav");
      execFileSync("ffmpeg", ["-y", "-i", source, "-vn", "-ac", "1", "-ar", "16000", audio], { stdio: "ignore" });
      const provider = await getTranscription();
      const result = await provider.transcribe({ audioPath: audio });
      transcript = result.text; costUsd = result.costUsd;
      logCost({ step: `transcription:${provider.name}`, detail: `${stage.id}/caption-package`, costUsd });
    }
    if (!transcript.trim()) throw new Error("caption package produced no transcript");
    const transcriptPath = `configured-media/${stage.id}/transcript.txt`;
    const captionsPath = `configured-media/${stage.id}/captions.json`;
    writeFileSync(join(folder, transcriptPath), transcript.trim() + "\n");
    writeFileSync(join(folder, captionsPath), JSON.stringify(wordCaptions(transcript), null, 2) + "\n");
    const primaryAsset = `configured-media/${stage.id}/caption-manifest.json`;
    writeFileSync(join(folder, primaryAsset), JSON.stringify({ version: "configured-caption-package-v1", transcriptPath, captionsPath }, null, 2) + "\n");
    return { primaryAsset, assets: [primaryAsset, transcriptPath, captionsPath], costUsd };
  }
  if (stage.media === "audiogram") {
    const sourcePath = stage.sourcePaths?.[0];
    if (!sourcePath) throw new Error("approved audiogram stage has no source audio");
    const primaryAsset = `configured-media/${stage.id}/audiogram.mp4`;
    execFileSync("ffmpeg", ["-y", "-i", join(folder, sourcePath), "-filter_complex", "[0:a]showwaves=s=1080x1080:mode=line:colors=0x19a7a0[v]", "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", join(folder, primaryAsset)], { stdio: "ignore" });
    return { primaryAsset, assets: [primaryAsset], costUsd: 0 };
  }
  throw new Error(`configured media renderer does not own ${stage.media}`);
};
