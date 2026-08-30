import { lstat, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FictionContentHandoff } from "./fiction-content-handoff.js";

export const FICTION_DRAFT_STATES = ["Draft", "In review", "Changes requested", "Approved", "Rejected"] as const;
export type FictionDraftState = (typeof FICTION_DRAFT_STATES)[number];
export type PreviewMetadata = { readonly platform: string; readonly media: string; readonly label: string };
export type FictionRevision =
  | { readonly kind: "direct-edit"; readonly body: string }
  | { readonly kind: "ai-revision"; readonly body: string; readonly model: string; readonly instruction: string };

export interface FictionPromotionDraftInput {
  readonly id: string;
  readonly request: FictionContentHandoff;
  readonly body: string;
  readonly state: FictionDraftState;
  readonly previews: readonly PreviewMetadata[];
  readonly revisionHistory?: readonly FictionRevision[];
}
export type FictionPromotionDraft = Required<FictionPromotionDraftInput>;

const required = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value;
};

function validateRequest(request: FictionContentHandoff): void {
  if (!request || request.origin !== "fiction") throw new Error("draft request must be a fiction handoff");
  if (!Number.isInteger(request.chapter?.number) || request.chapter.number < 1 || !required(request.chapter.title, "chapter.title")) throw new Error("draft chapter identity is invalid");
  if (!request.sourcePassages.length || request.sourcePassages.some((p) => p.locked !== true)) throw new Error("draft source passages must be locked");
  if (!request.restrictions.canon.length || !request.restrictions.provenance.length) throw new Error("draft canon/provenance restrictions are required");
}

function validatePreviews(previews: readonly PreviewMetadata[]): PreviewMetadata[] {
  if (!Array.isArray(previews)) throw new Error("previews are required");
  return previews.map((preview, index) => ({ platform: required(preview.platform, `previews[${index}].platform`), media: required(preview.media, `previews[${index}].media`), label: required(preview.label, `previews[${index}].label`) }));
}

export function createFictionPromotionDraft(input: FictionPromotionDraftInput): FictionPromotionDraft {
  const id = required(input.id, "id");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error("unsafe draft id");
  validateRequest(input.request);
  if (!FICTION_DRAFT_STATES.includes(input.state)) throw new Error("unknown draft state");
  const body = required(input.body, "body");
  const history = [...(input.revisionHistory ?? [])].map((entry) => {
    if (!entry || !["direct-edit", "ai-revision"].includes(entry.kind)) throw new Error("invalid revision history");
    required(entry.body, "revision body");
    if (entry.kind === "ai-revision") { required(entry.model, "revision model"); required(entry.instruction, "revision instruction"); return { kind: entry.kind, body: entry.body, model: entry.model, instruction: entry.instruction }; }
    return { kind: entry.kind, body: entry.body };
  });
  return { id, request: input.request, body, state: input.state, previews: validatePreviews(input.previews), revisionHistory: history };
}

export function directEdit(draft: FictionPromotionDraft, body: string): FictionPromotionDraft {
  const next = required(body, "body");
  return createFictionPromotionDraft({ ...draft, body: next, state: "In review", revisionHistory: [...draft.revisionHistory, { kind: "direct-edit", body: next }] });
}

export function applyTargetedRevision(draft: FictionPromotionDraft, revision: { readonly body: string; readonly model: string; readonly instruction: string }): FictionPromotionDraft {
  return createFictionPromotionDraft({ ...draft, body: required(revision.body, "revision body"), state: "Changes requested", revisionHistory: [...draft.revisionHistory, { kind: "ai-revision", body: revision.body, model: required(revision.model, "revision model"), instruction: required(revision.instruction, "revision instruction") }] });
}

async function safeRoot(root: string): Promise<string> {
  const resolved = await realpath(root).catch(() => { throw new Error("series directory does not exist"); });
  if (!(await stat(resolved)).isDirectory()) throw new Error("series directory must be a directory");
  return resolved;
}
function safePath(root: string, target: string): boolean { const rel = relative(root, target); return rel === "" || (!rel.startsWith("..") && !rel.includes("/../") && !rel.includes("\\..\\")); }

export async function saveFictionPromotionDraft(seriesDir: string, draft: FictionPromotionDraft): Promise<string> {
  const root = await safeRoot(seriesDir); const checked = createFictionPromotionDraft(draft);
  const dir = join(root, "promotion-drafts"); const target = join(dir, `${checked.id}.json`);
  if (!safePath(root, target)) throw new Error("unsafe draft path");
  await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
  const tempDir = await mkdtemp(join(root, ".promotion-draft-")); const temp = join(tempDir, `${checked.id}.json`);
  try { await writeFile(temp, JSON.stringify(checked, null, 2) + "\n", { mode: 0o600 }); await rename(temp, target); } finally { await rm(tempDir, { recursive: true, force: true }); }
  return target;
}

export async function loadFictionPromotionDraft(seriesDir: string, id: string): Promise<FictionPromotionDraft> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error("unsafe draft id");
  const root = await safeRoot(seriesDir); const target = join(root, "promotion-drafts", `${id}.json`);
  if (!safePath(root, target)) throw new Error("unsafe draft path");
  const details = await lstat(target); if (!details.isFile() || details.isSymbolicLink()) throw new Error("draft file is unsafe");
  let value: unknown; try { value = JSON.parse(await readFile(target, "utf8")); } catch { throw new Error("draft file is not valid JSON"); }
  return createFictionPromotionDraft(value as FictionPromotionDraftInput);
}
