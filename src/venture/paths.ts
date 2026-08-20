import { existsSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";

export const VENTURE_ROOT = join(repoRoot, "venture");

// Mirrors safeFolder's traversal guard in src/review/rows.ts: reject anything that isn't a bare
// slug segment before it ever touches the filesystem.
export function safeSlug(slug: string): string {
  if (!slug || slug.includes("/") || slug.includes("\\") || slug.includes("..")) {
    throw new Error(`bad venture slug: ${JSON.stringify(slug)}`);
  }
  return slug;
}

export function ventureDir(slug: string): string {
  return join(VENTURE_ROOT, safeSlug(slug));
}

export function requireVentureDir(slug: string): string {
  const dir = ventureDir(slug);
  if (!existsSync(dir)) throw new Error(`no such venture: ${slug}`);
  return dir;
}

export function phase1Dir(slug: string): string {
  return join(ventureDir(slug), "phase-1-attention");
}

export function phase2Dir(slug: string): string {
  return join(ventureDir(slug), "phase-2-audience");
}

export function phase3Dir(slug: string): string {
  return join(ventureDir(slug), "phase-3-offer");
}

export function readyToPasteDir(slug: string): string {
  return join(ventureDir(slug), "ready-to-paste");
}

export function intakePath(slug: string): string {
  return join(ventureDir(slug), "intake.md");
}

export function canonPath(slug: string): string {
  return join(ventureDir(slug), "canon.md");
}

export function statePath(slug: string): string {
  return join(ventureDir(slug), "state.md");
}

export function artifactsPath(slug: string): string {
  return join(ventureDir(slug), "artifacts.jsonl");
}

export function decisionsPath(slug: string): string {
  return join(ventureDir(slug), "decisions.jsonl");
}

// Phase 3 (rules.md §7.2, venture-schema-contract.md §5.4). Gitignored (see .gitignore) --
// raw quotes and respondent hashes never reach git, same treatment as data/analytics.db.
export function responsesPath(slug: string): string {
  return join(ventureDir(slug), "responses.jsonl");
}

// Phase 3 (rules.md §7.5, venture-schema-contract.md §5.4). The durable, re-readable per-cluster
// analysis output -- count, redacted evidence, common stuck point, desired outcome, and visible
// consequences per cluster (see src/venture/phase3.ts's ClusterAnalysis). A top-level file, same
// treatment as responses.jsonl/artifacts.jsonl/decisions.jsonl, not nested under phase-3-offer/
// (which holds rendered body files, not analysis data). Gitignored -- its `evidence` field carries
// redacted-but-still-audience-derived quotes, same privacy posture as responses.jsonl.
export function clusterAnalysisPath(slug: string): string {
  return join(ventureDir(slug), "cluster-analysis.json");
}
