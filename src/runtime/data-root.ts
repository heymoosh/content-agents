import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
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

/**
 * Old releases kept mutable state inside the checkout. Copy it forward once, without deleting it.
 *
 * `legacyParts` defaults to `parts`, which is the shape every caller but one needs: the file sat at
 * the same relative path under the old root as it does under the new one. The slot ledger does not
 * fit that shape — it lives at `<root>/scheduler/publish-schedule.jsonl` today but sat at
 * `data/publish-schedule.jsonl` before the move, with no `scheduler/` segment — so it passes its own
 * legacy parts. Omitting the argument reproduces the previous behaviour exactly.
 *
 * The copy stages into a private sibling file and is installed with a same-directory renameSync,
 * which is atomic on one filesystem. It used to copyFileSync straight onto the canonical path, and
 * copyFileSync makes no atomicity promise, so the destination was visible while still partial. Two
 * things went wrong with that. A second process's fast-path `existsSync(canonical)` guard skips the
 * migration lock entirely, so it could read a half-copied store, act on it, and have its own write
 * overwritten when the first copy finished. Worse and needing no concurrency at all: a process
 * killed mid-copy left a truncated canonical file, and that same guard then suppressed the
 * migration forever, so the rest of the real data was silently gone. Staging makes both impossible
 * — the canonical path either does not exist or holds the complete file, never anything between.
 *
 * `deps` exists only so a test can inject a copy that fails partway and prove no partial canonical
 * file survives; production callers never pass it. Same convention as writeLedgerAtomic's `deps`.
 */
export function migrateLegacyDataFile(
  parts: readonly string[],
  legacyDataRoot = join(repoRoot, "data"),
  legacyParts: readonly string[] = parts,
  deps: { copyFileSync: typeof copyFileSync; renameSync: typeof renameSync } = { copyFileSync, renameSync }
): string {
  const canonical = dataPath(...parts);
  const legacy = join(legacyDataRoot, ...legacyParts);
  if (existsSync(canonical) || !existsSync(legacy) || canonical === legacy) return canonical;
  return withFileLock(`${canonical}.migration.lock`, () => {
    if (!existsSync(canonical) && existsSync(legacy)) {
      mkdirSync(dirname(canonical), { recursive: true, mode: 0o700 });
      const staging = `${canonical}.${process.pid}.migrating`;
      try {
        deps.copyFileSync(legacy, staging);
        deps.renameSync(staging, canonical);
      } finally {
        // After a successful rename there is nothing here; after a failure this is the partial copy.
        rmSync(staging, { force: true });
      }
    }
    return canonical;
  });
}

/**
 * Directory variant used for historical mutable trees such as GUI job logs.
 *
 * A directory copy cannot be installed safely by copying into `canonical`: readers treat an
 * existing canonical directory as authoritative, so they could otherwise observe a partial tree
 * or let an interrupted copy suppress every later retry. The private sibling from `mkdtempSync`
 * lives on the canonical directory's filesystem, and renaming it installs the complete tree in
 * one step. A process killed during `cpSync` can leave that private sibling and its lock behind;
 * neither is canonical, and the existing stale-lock policy controls when a later invocation can
 * retry. We deliberately only remove the staging directory created by this invocation.
 *
 * `deps` mirrors migrateLegacyDataFile's narrow failure seam. Production callers use the native
 * functions; tests use it to force observable copy and rename failure boundaries.
 */
export function migrateLegacyDataDirectory(
  parts: readonly string[],
  legacyDataRoot = join(repoRoot, "data"),
  deps: { cpSync: typeof cpSync; renameSync: typeof renameSync } = { cpSync, renameSync }
): string {
  const canonical = dataPath(...parts);
  const legacy = join(legacyDataRoot, ...parts);
  if (existsSync(canonical) || !existsSync(legacy) || canonical === legacy) return canonical;
  return withFileLock(`${canonical}.migration.lock`, () => {
    if (!existsSync(canonical) && existsSync(legacy)) {
      const staging = mkdtempSync(join(dirname(canonical), `${basename(canonical)}.migrating-`));
      try {
        deps.cpSync(legacy, staging, { recursive: true, errorOnExist: false });
        deps.renameSync(staging, canonical);
      } finally {
        // Successful rename leaves no path here; failed copies and renames leave only this attempt's staging tree.
        rmSync(staging, { recursive: true, force: true });
      }
    }
    return canonical;
  });
}
