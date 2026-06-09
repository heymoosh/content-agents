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

function configuredName(capability: Capability): string {
  const config = parse(readFileSync(join(repoRoot, "config", "providers.yaml"), "utf8")) as
    Record<string, string>;
  const name = config[capability];
  if (!name) throw new Error(`config/providers.yaml has no entry for "${capability}"`);
  return name;
}

async function load<T>(capability: Capability): Promise<T> {
  const name = configuredName(capability);
  if (name === "none") {
    throw new Error(
      `capability "${capability}" is disabled (set to "none" in config/providers.yaml)`
    );
  }
  const modPath = `./${DIR_FOR[capability]}/${name}.js`;
  let mod: { provider?: T };
  try {
    mod = await import(modPath);
  } catch (e) {
    throw new Error(
      `no adapter "${name}" for capability "${capability}" — expected src/providers/${DIR_FOR[capability]}/${name}.ts ` +
        `exporting \`provider\`. Configured in config/providers.yaml. (${(e as Error).message})`
    );
  }
  if (!mod.provider) {
    throw new Error(`src/providers/${DIR_FOR[capability]}/${name}.ts does not export \`provider\``);
  }
  return mod.provider;
}

export function isEnabled(capability: Capability): boolean {
  return configuredName(capability) !== "none";
}

export const getTTS = () => load<TTSProvider>("tts");
export const getImage = () => load<ImageProvider>("image");
export const getTranscription = () => load<TranscriptionProvider>("transcription");
export const getTextPolish = () => load<TextPolishProvider>("text-polish");
