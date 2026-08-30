import { lstat, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { buildContentRequest, type ContentRequest, type ContentRequestInput, type RecommendationEvidence } from "./content-request.js";

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
