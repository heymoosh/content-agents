/**
 * Write the `content-request.json` that makes an `/atomize` folder visible in the Content room.
 *
 * The Content room lists a piece for approval only when its folder carries a content request
 * (`rows.ts` sets `requestId`/`descriptor`/`originalInput` from one, and `page.ts` filters the
 * review list on those). `/atomize` appends review-queue rows and never wrote a request, so its
 * drafts were counted at step 1 of the room and hidden at step 3.
 *
 * This is bookkeeping, not generation. It records what the run already produced; it selects no
 * platforms, media or treatments, and it disables the untreated control, so the request derives
 * zero variants. Studio generated none of this content and the file must not claim it did.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readContentRequest, writeContentRequest } from "../review/content-request-store.js";
import type { ContentRequestInput, ContentSourceProvenance } from "../review/content-request.js";
import { requireBrandId, type BrandId } from "../identity/brand.js";

/** `/atomize` brands map one-to-one onto the content origins that name a real byline. */
export function originForBrand(brand: BrandId): "human-inference" | "charles" | "fiction" {
  return brand;
}

export function atomizeRequestId(folder: string): string {
  return `atomize:${basename(folder)}`;
}

/**
 * Union of every `source_lines` reference the run's derivatives cite. Line numbers and `N-M`
 * ranges are the only two forms the request schema accepts, so anything else is dropped rather
 * than reshaped — a provenance record must not invent a reference.
 */
export function collectSourceLines(folder: string): (number | string)[] {
  const dir = join(folder, "derivatives");
  if (!existsSync(dir)) return [];
  const numbers = new Set<number>();
  const ranges = new Set<string>();
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".md")) continue;
    const { fm } = splitFrontmatter(readFileSync(join(dir, name), "utf8"));
    const refs = fm.source_lines;
    if (!Array.isArray(refs)) continue;
    for (const ref of refs) {
      if (typeof ref === "number" && Number.isInteger(ref) && ref > 0) numbers.add(ref);
      else if (typeof ref === "string" && /^\d+-\d+$/.test(ref.trim())) ranges.add(ref.trim());
    }
  }
  return [...[...numbers].sort((a, b) => a - b), ...[...ranges].sort()];
}

function descriptorFor(folder: string, fm: Record<string, unknown>): string {
  const title = typeof fm.title === "string" ? fm.title.trim() : "";
  if (title) return title;
  const queue = join(folder, "review-queue.md");
  if (existsSync(queue)) {
    const heading = readFileSync(queue, "utf8").split("\n").find((line) => line.startsWith("# "));
    const text = heading?.slice(2).replace(/^Review queue\s*[—-]\s*/i, "").trim();
    if (text) return text;
  }
  return basename(folder);
}

/** Build the request input from what is on disk. Throws when the folder is not an atomize run. */
export function buildAtomizeRequestInput(folder: string, brand: BrandId): ContentRequestInput {
  const sourcePath = join(folder, "source.md");
  if (!existsSync(sourcePath)) throw new Error(`no source.md in ${folder}; not an /atomize content folder`);
  const { fm, body } = splitFrontmatter(readFileSync(sourcePath, "utf8"));
  if (!body) throw new Error(`source.md in ${folder} has no body`);

  const sourceLines = collectSourceLines(folder);
  const canonical = typeof fm.canonical_url === "string" ? fm.canonical_url.trim() : "";
  const sourceProvenance: ContentSourceProvenance | null = sourceLines.length
    ? {
        kind: "source",
        sourceLines,
        ...(canonical.startsWith("https://") ? { canonicalUrl: canonical } : {}),
      }
    : null;

  return {
    id: atomizeRequestId(folder),
    origin: originForBrand(brand),
    descriptor: descriptorFor(folder, fm),
    originalInput: body,
    // Nothing here was configured or generated in Studio. Empty selections plus no control is the
    // only honest record of that, and it keeps the derived variant list empty.
    treatments: [],
    media: [],
    platforms: [],
    includeUntreatedControl: false,
    sourceProvenance,
  };
}

export interface WriteAtomizeRequestResult {
  readonly written: boolean;
  readonly reason: "written" | "refreshed" | "foreign-request-kept" | "configured-request-kept";
  readonly id: string;
}

/**
 * A request carrying anything Muxin decided in Studio: an approved-cut provenance, a selected
 * platform/media/treatment, or an enabled control. A Content-room save keeps this writer's id
 * (`mergeContentConfiguration` preserves it), so the id alone cannot tell the two apart.
 */
function carriesStudioConfiguration(request: ContentRequestLike): boolean {
  return request.sourceProvenance?.kind === "approved-cut"
    || request.control.enabled
    || request.selections.platforms.length > 0
    || request.selections.media.length > 0
    || request.selections.treatments.length > 0;
}

type ContentRequestLike = Awaited<ReturnType<typeof readContentRequest>>;

/**
 * Idempotent: a bare request this writer owns is refreshed. One written by any other path, and
 * one this writer wrote that Muxin has since configured in Studio, are left exactly as they are.
 * A re-run of `/atomize` never clobbers a decision she made.
 */
export async function writeAtomizeContentRequest(folder: string, brand: BrandId): Promise<WriteAtomizeRequestResult> {
  const input = buildAtomizeRequestInput(folder, brand);
  if (existsSync(join(folder, "content-request.json"))) {
    const existing = await readContentRequest(folder).catch(() => null);
    if (!existing || existing.id !== input.id) {
      return { written: false, reason: "foreign-request-kept", id: existing?.id ?? "(unreadable)" };
    }
    if (carriesStudioConfiguration(existing)) {
      return { written: false, reason: "configured-request-kept", id: existing.id };
    }
    await writeContentRequest(folder, input);
    return { written: true, reason: "refreshed", id: input.id };
  }
  await writeContentRequest(folder, input);
  return { written: true, reason: "written", id: input.id };
}

function usage(): never {
  console.error("usage: npm run content-request -- <content-folder> --brand <human-inference|charles|fiction>");
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const brandIndex = args.indexOf("--brand");
  if (brandIndex === -1 || !args[brandIndex + 1]) usage();
  const brand = requireBrandId(args[brandIndex + 1]);
  const folder = args.filter((arg, index) => index !== brandIndex && index !== brandIndex + 1 && !arg.startsWith("--"))[0];
  if (!folder) usage();
  if (!existsSync(folder)) throw new Error(`content folder not found: ${folder}`);

  const result = await writeAtomizeContentRequest(folder, brand);
  if (result.reason === "foreign-request-kept") {
    console.log(`kept the existing content request (${result.id}) — it was not written by /atomize; nothing changed`);
    return;
  }
  if (result.reason === "configured-request-kept") {
    console.log(`kept the existing content request (${result.id}) — it carries Studio configuration; nothing changed`);
    return;
  }
  console.log(`${result.reason} ${result.id} — ${folder} is now visible in the Content room's approve step`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
