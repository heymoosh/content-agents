import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { repoRoot } from "../db/db.js";
import { withFileLock } from "./file-lock.js";

// Under the node:test runner (it sets NODE_TEST_CONTEXT in every test process) an unconfigured
// data root is a throwaway per-process directory. Before this guard the gate wrote its fixture
// jobs into Muxin's real store: on 2026-09-02 her Studio showed 172 "tasks", every one a test
// fixture ("asks a question", "killed mid-run", ...). A test that wants the real resolution sets
// CONTENT_AGENTS_DATA_ROOT explicitly.
let testRoot: string | undefined;
function throwawayTestRoot(): string | undefined {
  if (!process.env.NODE_TEST_CONTEXT) return undefined;
  testRoot ??= mkdtempSync(join(tmpdir(), "content-agents-test-data-"));
  return testRoot;
}

/** One operational root for mutable scheduler and worker state. */
export function dataRoot(): string {
  const configured = process.env.CONTENT_AGENTS_DATA_ROOT?.trim();
  if (configured) return resolve(configured);
  const throwaway = throwawayTestRoot();
  if (throwaway) return throwaway;
  const fingerprint = createHash("sha256").update(resolve(repoRoot)).digest("hex").slice(0, 12);
  return join(homedir(), ".content-agents", `${basename(repoRoot)}-${fingerprint}`);
}

export function dataPath(...parts: string[]): string {
  const root = dataRoot();
  mkdirSync(root, { recursive: true, mode: 0o700 });
  return join(root, ...parts);
}

/** Preserve pre-fingerprinted operational paths unless an operator explicitly isolates the run. */
export function configuredDataPathOrLegacy(...parts: string[]): string {
  if (process.env.CONTENT_AGENTS_DATA_ROOT?.trim()) return dataPath(...parts);
  const throwaway = throwawayTestRoot();
  return throwaway ? join(throwaway, ...parts) : join(homedir(), ".content-agents", ...parts);
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
