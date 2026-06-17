import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import type {
  Capability,
  TTSProvider,
  ImageProvider,
  TranscriptionProvider,
  TextPolishProvider,
  VideoBrollProvider,
} from "./types.js";

// Adapter lookup: config/providers.yaml maps capability → provider name → module in
// src/providers/<capability-dir>/<name>.ts exporting `provider`.
// Adding a provider = one new file + one yaml line. "none" disables the capability.

const DIR_FOR: Record<Capability, string> = {
  tts: "tts",
  image: "image",
  transcription: "transcription",
  "text-polish": "polish",
  "video-broll": "broll",
};

function readProviders(): Record<string, unknown> {
  return parse(readFileSync(join(repoRoot, "config", "providers.yaml"), "utf8")) as Record<
    string,
    unknown
  >;
}

function configuredName(capability: Capability): string {
  const name = readProviders()[capability];
  if (typeof name !== "string" || !name) {
    throw new Error(`config/providers.yaml has no entry for "${capability}"`);
  }
  return name;
}

async function importProvider<T>(dir: string, name: string): Promise<T> {
  if (name === "none") {
    throw new Error(`adapter is disabled ("none") in config/providers.yaml`);
  }
  const modPath = `./${dir}/${name}.js`;
  let mod: { provider?: T };
  try {
    mod = await import(modPath);
  } catch (e) {
    throw new Error(
      `no adapter "${name}" — expected src/providers/${dir}/${name}.ts exporting \`provider\` ` +
        `(configured in config/providers.yaml). (${(e as Error).message})`
    );
  }
  if (!mod.provider) {
    throw new Error(`src/providers/${dir}/${name}.ts does not export \`provider\``);
  }
  return mod.provider;
}

async function load<T>(capability: Capability): Promise<T> {
  return importProvider<T>(DIR_FOR[capability], configuredName(capability));
}

export function isEnabled(capability: Capability): boolean {
  const name = readProviders()[capability];
  return typeof name === "string" && name !== "none";
}

// Image generation runs under named profiles in config/providers.yaml so one adapter can serve
// many models. The returned `params` are passed straight to provider.generate():
//   image: <adapter>   + image_params: { model, ... }   → default workhorse
//   image_hero:  { provider, ...params }                 → premium override (render --hero)
//   image_cheap: { provider, ...params }                 → cheap/bulk override (render --cheap)
export type ImageProfile = "pro" | "hero";
export async function getImage(
  profile?: ImageProfile
): Promise<{ provider: ImageProvider; params: Record<string, unknown> }> {
  const cfg = readProviders();
  if (profile) {
    const o = cfg[`image_${profile}`] as Record<string, unknown> | undefined;
    if (!o || typeof o.provider !== "string") {
      throw new Error(`config/providers.yaml has no "image_${profile}: { provider, ... }" profile`);
    }
    const { provider: name, ...params } = o;
    return { provider: await importProvider<ImageProvider>("image", name as string), params };
  }
  const provider = await load<ImageProvider>("image");
  return { provider, params: (cfg.image_params as Record<string, unknown>) ?? {} };
}

export const getTTS = () => load<TTSProvider>("tts");
export const getTranscription = () => load<TranscriptionProvider>("transcription");
export const getTextPolish = () => load<TextPolishProvider>("text-polish");

// Animated scene engine. Like getImage(), returns the adapter plus its `video_broll_params`
// (model/resolution/cost), passed straight to provider.interpolate().
export async function getBroll(): Promise<{
  provider: VideoBrollProvider;
  params: Record<string, unknown>;
}> {
  const provider = await load<VideoBrollProvider>("video-broll");
  return { provider, params: (readProviders().video_broll_params as Record<string, unknown>) ?? {} };
}
