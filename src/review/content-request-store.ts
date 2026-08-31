import { lstat, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { buildContentRequest, mergeContentConfiguration, type ContentRequest, type ContentRequestInput, type RecommendationEvidence } from "./content-request.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { extractSourceLines } from "./develop.js";

const FILE_NAME = "content-request.json";

function inside(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!path.startsWith("..") && !path.includes(".." + "/") && !path.includes(".." + "\\"));
}

async function existingRoot(contentRoot: string): Promise<string> {
  if (typeof contentRoot !== "string" || contentRoot.length === 0) throw new Error("content root is required");
  const root = await realpath(contentRoot).catch(() => { throw new Error("content root directory does not exist"); });
  const details = await stat(root);
  if (!details.isDirectory()) throw new Error("content root must be a directory");
  return root;
}

async function targetPath(contentRoot: string): Promise<{ root: string; target: string }> {
  const root = await existingRoot(contentRoot);
  const target = join(root, FILE_NAME);
  if (!inside(root, target)) throw new Error("content request target is outside root");
  return { root, target };
}

function inputFromStored(request: ContentRequest): ContentRequestInput {
  const evidence: RecommendationEvidence[] = [];
  for (const group of Object.values(request.recommendations)) {
    for (const recommendation of group) {
      for (const item of recommendation.evidence) evidence.push({ ...item, recommended: true });
    }
  }
  return {
    id: request.id,
    origin: request.origin,
    descriptor: request.descriptor,
    originalInput: request.originalInput,
    treatments: request.selections.treatments,
    media: request.selections.media,
    platforms: request.selections.platforms,
    recommendationEvidence: evidence,
    includeUntreatedControl: request.control.enabled,
    ventureId: request.ventureId,
    ventureSource: request.ventureSource,
    sourceProvenance: request.sourceProvenance,
    sourceContext: request.sourceContext,
    experiment: request.experiment,
  };
}

/** Validate and atomically persist one request in an existing content folder. */
export async function writeContentRequest(contentRoot: string, input: ContentRequestInput): Promise<ContentRequest> {
  const { root, target } = await targetPath(contentRoot);
  const request = buildContentRequest(input);
  try {
    const existing = await lstat(target);
    if (existing.isSymbolicLink()) throw new Error("content request target is a symlink");
    if (!existing.isFile()) throw new Error("content request target is not a file");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const tempRoot = await mkdtemp(join(root, ".content-request-"));
  const temp = join(tempRoot, FILE_NAME);
  try {
    await writeFile(temp, JSON.stringify(request, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    await rename(temp, target);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
  return request;
}

/**
 * Establish authority for an ordinary Content-room save from the source file on disk, including
 * upgrading an older request that predates persisted provenance.
 * The browser may choose configuration fields, but it cannot assert provenance, cross-room
 * context, or a different body/brand. Cross-room routes create their own already-authorized
 * requests before the Content room can edit configuration.
 */
export async function authorizeGuiContentRequest(contentRoot: string, input: ContentRequestInput, existing?: ContentRequest): Promise<ContentRequestInput> {
  const candidate = existing ? mergeContentConfiguration(existing, input) : input;
  // Cross-room handoffs establish their authority in their owning route. Preserve that authority
  // when the Content room changes configuration, but do not let ordinary Content requests use
  // this shortcut: every ordinary save must still revalidate its approved advisor cut on disk.
  if (existing && (existing.sourceContext || existing.ventureSource)) return candidate;
  if (existing && existing.origin === "charles" && existing.sourceProvenance) return candidate;
  if (existing && existing.origin !== "studio" && existing.origin !== "human-inference") {
    throw new Error(`existing ${existing.origin} request has no server-owned source authority`);
  }
  const { root } = await targetPath(contentRoot);
  const raw = await readFile(join(root, "source.md"), "utf8");
  const { fm } = splitFrontmatter(raw);
  const storedOrigin = String(fm.origin ?? "").trim().toLowerCase();
  const sourceKind = String(fm.source_kind ?? "").trim().toLowerCase();
  const canonicalUrl = String(fm.canonical_url ?? "").trim();
  const crossRoom = ["fiction-promotion", "charles", "venture"].includes(sourceKind)
    || /^(fiction|charles|venture):/.test(storedOrigin);
  if (crossRoom) {
    throw new Error("cross-room Content request is missing; recover it from its owning room instead of rebranding the source");
  }
  // The browser names the accepted cut, but the server re-reads its exact body and immutable
  // source-line provenance on every save. Whole-source configuration is intentionally forbidden:
  // the advisor and Muxin's explicit cut approval are the gate before formatting.
  const requested = input.sourceProvenance?.kind === "approved-cut"
    ? input.sourceProvenance
    : candidate.sourceProvenance?.kind === "approved-cut" ? candidate.sourceProvenance : null;
  if (!requested) throw new Error("an approved advisor cut is required before Content configuration");
  const lens = requested.lens?.trim() ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lens)) throw new Error("approved cut lens is invalid");
  const cutPath = join(root, "cuts", lens, "cut.md");
  if (!existsSync(cutPath)) throw new Error("approved advisor cut does not exist");
  const cut = splitFrontmatter(await readFile(cutPath, "utf8"));
  const refs = Array.isArray(cut.fm.source_lines) ? cut.fm.source_lines as (number | string)[] : [];
  if (!refs.length) throw new Error("approved cut has no server-owned source_lines");
  const resolved = extractSourceLines(root, refs);
  if (cut.body.trim() !== resolved.trim()) throw new Error("approved cut body does not match its cited source_lines");
  if (candidate.originalInput.trim() !== cut.body.trim()) throw new Error("content request body does not match the approved cut");
  return {
    ...candidate,
    origin: "human-inference",
    originalInput: cut.body.trim(),
    ventureId: null,
    ventureSource: null,
    sourceProvenance: { kind: "approved-cut", lens, sourceLines: refs, ...(canonicalUrl ? { canonicalUrl } : {}) },
    sourceContext: null,
  };
}

/** Read and rebuild a persisted request, applying the same domain validation as writes. */
export async function readContentRequest(contentRoot: string): Promise<ContentRequest> {
  const { root, target } = await targetPath(contentRoot);
  const details = await lstat(target);
  if (details.isSymbolicLink()) throw new Error("content request target is outside root (symlink)");
  if (!details.isFile()) throw new Error("content request target is not a file");
  const resolved = await realpath(target);
  if (!inside(root, resolved)) throw new Error("content request target is outside root");
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(target, "utf8")); }
  catch { throw new Error("content request file is not valid JSON"); }
  if (!parsed || typeof parsed !== "object") throw new Error("content request file must contain an object");
  return buildContentRequest(inputFromStored(parsed as ContentRequest));
}

export class ContentRequestStore {
  constructor(private readonly contentRoot: string) {}
  write(input: ContentRequestInput): Promise<ContentRequest> { return writeContentRequest(this.contentRoot, input); }
  read(): Promise<ContentRequest> { return readContentRequest(this.contentRoot); }
  save(input: ContentRequestInput): Promise<ContentRequest> { return this.write(input); }
  load(): Promise<ContentRequest> { return this.read(); }
}

export const saveContentRequest = writeContentRequest;
export const loadContentRequest = readContentRequest;
