import { existsSync, readFileSync, readdirSync } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { readArtifact, type VentureArtifact } from "../venture/artifacts.js";
import { ventureDir } from "../venture/paths.js";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { createVentureContentHandoff, type VentureContentHandoff } from "./venture-content-handoff.js";

export interface ApprovedVentureHandoffOptions { readonly slug: string; readonly artifactId: string; }

/** Recover an earlier/partial handoff by its exact source provenance instead of scaffolding twice. */
export function findExistingVentureContentFolder(
  ventureId: string,
  artifactId: string,
  contentRoot: string = join(repoRoot, "content"),
): string | null {
  if (!existsSync(contentRoot)) return null;
  const expected = `venture:${ventureId}:${artifactId}`;
  for (const entry of readdirSync(contentRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = join(contentRoot, entry.name);
    const source = join(folder, "source.md");
    if (!existsSync(source)) continue;
    try {
      const { fm } = splitFrontmatter(readFileSync(source, "utf8"));
      if (fm.origin === expected) return folder;
    } catch { /* one malformed source must not hide other recoverable handoffs */ }
  }
  return null;
}

function contained(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(`..${sep}`));
}

/** Read exactly one approved primary artifact, refusing lexical or symlink escapes. */
export async function createApprovedVentureHandoff(options: ApprovedVentureHandoffOptions): Promise<VentureContentHandoff> {
  const artifact = readArtifact(options.slug, options.artifactId);
  if (!artifact) throw new Error(`no such Venture artifact: ${options.artifactId}`);
  if (!artifact.body_path) throw new Error(`artifact ${artifact.artifact_id} has no body path`);
  const root = await realpath(ventureDir(options.slug));
  const target = resolve(root, artifact.body_path);
  if (!contained(root, target)) throw new Error("artifact body path is outside its Venture directory");
  const details = await lstat(target).catch(() => null);
  if (!details) throw new Error(`artifact body file is missing: ${artifact.body_path}`);
  if (details.isSymbolicLink() || !details.isFile()) throw new Error("artifact body path is not a regular file");
  const resolvedTarget = await realpath(target);
  if (!contained(root, resolvedTarget)) throw new Error("artifact body path resolves outside its Venture directory");
  const body = await readFile(resolvedTarget, "utf8");
  return createVentureContentHandoff({ artifact: artifact as VentureArtifact, body, expectedVentureId: options.slug });
}

export const createVentureContentHandoffFromArtifact = createApprovedVentureHandoff;
