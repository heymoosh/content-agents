import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { repoRoot } from "../db/db.js";
import { withFileLock } from "./file-lock.js";

/** One operational root for mutable scheduler and worker state. */
export function dataRoot(): string {
  const configured = process.env.CONTENT_AGENTS_DATA_ROOT?.trim();
  if (configured) return resolve(configured);
  const fingerprint = createHash("sha256").update(resolve(repoRoot)).digest("hex").slice(0, 12);
  return join(homedir(), ".content-agents", `${basename(repoRoot)}-${fingerprint}`);
}

export function dataPath(...parts: string[]): string {
  const root = dataRoot();
  mkdirSync(root, { recursive: true, mode: 0o700 });
  return join(root, ...parts);
}

/** Old releases kept mutable state inside the checkout. Copy it forward once, without deleting it. */
export function migrateLegacyDataFile(parts: readonly string[], legacyDataRoot = join(repoRoot, "data")): string {
  const canonical = dataPath(...parts);
  const legacy = join(legacyDataRoot, ...parts);
  if (existsSync(canonical) || !existsSync(legacy) || canonical === legacy) return canonical;
  return withFileLock(`${canonical}.migration.lock`, () => {
    if (!existsSync(canonical) && existsSync(legacy)) {
      mkdirSync(dirname(canonical), { recursive: true, mode: 0o700 });
      copyFileSync(legacy, canonical);
    }
    return canonical;
  });
}

/** Directory variant used for historical mutable trees such as GUI job logs. */
export function migrateLegacyDataDirectory(parts: readonly string[], legacyDataRoot = join(repoRoot, "data")): string {
  const canonical = dataPath(...parts);
  const legacy = join(legacyDataRoot, ...parts);
  if (existsSync(canonical) || !existsSync(legacy) || canonical === legacy) return canonical;
  return withFileLock(`${canonical}.migration.lock`, () => {
    if (!existsSync(canonical) && existsSync(legacy)) cpSync(legacy, canonical, { recursive: true, errorOnExist: false });
    return canonical;
  });
}
