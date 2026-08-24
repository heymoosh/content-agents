import { basename, join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { readQueue, rowLens, type QueueRow } from "../publish/queue.js";
import { readAdvice } from "../review/develop.js";
import { findLoggedRef, type LoggedRef } from "../review/reconcile.js";
import {
  buildGrowThisPlan,
  type GrowThisCutDecision,
  type GrowThisPlan,
  type GrowThisPlanInput,
  type GrowThisStageStatus,
} from "./grow-this-plan.js";
import type {
  GrowReviewBundle,
  GrowReviewReference,
} from "./review-bundle.js";

/**
 * Read-only bridge from the legacy content folder to the reference-only Grow plan.
 *
 * The legacy pipeline has useful durable artifacts, but it does not persist all of the richer
 * Grow metadata. This adapter preserves what is observable and marks the rest blocked. It never
 * reads or returns source, cut, derivative, or creator body text.
 */
export const LEGACY_CONTENT_ADAPTER_VERSION = "legacy-content-adapter-v1" as const;

export type LegacyVariantStatus = "pending" | "approved" | "scheduled" | "published" | "discarded" | "unknown";

export interface LegacyContentVariant {
  readonly rowId: string;
  readonly ref: GrowReviewReference;
  readonly platform: string;
  readonly format: string;
  readonly asset: string;
  readonly status: LegacyVariantStatus;
  readonly queueOrigin: string | null;
  readonly publishedInLog: boolean;
  readonly publishRef: LoggedRef | null;
}

export interface LegacyPublishLogSummary {
  readonly present: boolean;
  readonly entryCount: number;
  readonly publishedVariantIds: string[];
}

export interface LegacyContentCut {
  readonly lens: string;
  readonly cutRef: GrowReviewReference;
  readonly variantRefs: GrowReviewReference[];
  readonly variants: LegacyContentVariant[];
  readonly sourceStatus: GrowThisStageStatus;
  readonly cutStatus: GrowThisStageStatus;
  readonly cutDecision: GrowThisCutDecision | null;
  readonly blockers: string[];
  readonly growThisInput: GrowThisPlanInput;
}

export interface LegacyContentAdapterResult {
  readonly kind: "legacy_grow_lineage";
  readonly version: typeof LEGACY_CONTENT_ADAPTER_VERSION;
  readonly folder: string;
  readonly slug: string;
  readonly sourceRef: GrowReviewReference;
  readonly cuts: LegacyContentCut[];
  readonly publishLog: LegacyPublishLogSummary;
  readonly blockers: string[];
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function ref(recordType: string, id: string, relation: string): GrowReviewReference {
  return { recordType, id, relation };
}

function stableSlug(folder: string): string {
  const normalized = folder.trim().replace(/[\\/]+$/, "");
  if (!normalized) throw new Error("content folder is required");
  const slug = basename(normalized);
  if (!slug || slug === "." || slug === "..") throw new Error("content folder must have a stable slug");
  return slug;
}

function normalizeVariantStatus(status: string, publishedInLog: boolean): LegacyVariantStatus {
  if (publishedInLog || status === "published") return "published";
  if (["approve", "approved"].includes(status)) return "approved";
  if (["schedule", "scheduled"].includes(status)) return "scheduled";
  if (["discard", "discarded", "rejected"].includes(status)) return "discarded";
  if (["pending", "draft", "needs-review", "needs-human-judgment"].includes(status)) return "pending";
  return "unknown";
}

function readPublishLog(folder: string, queueRows: readonly QueueRow[]): { summary: LegacyPublishLogSummary; text: string } {
  const path = join(folder, "publish-log.md");
  if (!existsSync(path)) return { summary: { present: false, entryCount: 0, publishedVariantIds: [] }, text: "" };
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const queueIds = new Set(queueRows.map((row) => row.id));
  const published = new Set<string>();
  let entryCount = 0;
  for (const line of lines) {
    if (!/^\s*-\s+/.test(line)) continue;
    entryCount += 1;
    const match = line.match(/—\s+(.+?)\s+→/);
    if (match && queueIds.has(match[1].trim())) published.add(match[1].trim());
  }
  return {
    text,
    summary: {
      present: true,
      entryCount,
      publishedVariantIds: [...published].sort((left, right) => left.localeCompare(right)),
    },
  };
}

function queueVariant(
  slug: string,
  row: QueueRow,
  publishLogText: string,
  publishedIds: ReadonlySet<string>,
): LegacyContentVariant {
  const publishedInLog = publishedIds.has(row.id);
  return {
    rowId: row.id,
    ref: ref("variant", "variant:" + slug + ":" + row.id, "legacy-review-queue-row"),
    platform: row.platform,
    format: row.format,
    asset: row.asset,
    status: normalizeVariantStatus(row.status, publishedInLog),
    queueOrigin: row.origin ?? null,
    publishedInLog,
    publishRef: findLoggedRef(publishLogText, row.id),
  };
}

function reviewBundle(
  slug: string,
  sourceRef: GrowReviewReference,
  cutRef: GrowReviewReference,
  variantRefs: readonly GrowReviewReference[],
): GrowReviewBundle {
  const blockingFields = [
    "evidenceRefs",
    "treatmentRationale",
    "voiceCheck",
    "originalityCheck",
    "growReviewDecision",
  ];
  return {
    kind: "grow_review_bundle",
    version: "grow-review-bundle-v1",
    id: "review:" + slug + ":" + (cutRef.id.split(":").at(-1) ?? "extract"),
    reviewQueueRef: "review-queue:" + slug,
    sourceRef,
    cutRef,
    variantRefs: [...variantRefs],
    publishRefs: null,
    lineage: null,
    evidenceStatus: "blocked",
    evidenceRefs: [],
    evidenceNote: "Legacy content folders do not persist normalized Grow evidence refs.",
    voiceCheck: "not-run",
    originalityCheck: "not-run",
    readiness: {
      status: "blocked",
      blockingFields,
      reason: "Legacy content artifacts are missing normalized Grow review metadata.",
    },
    humanDecision: {
      status: "candidate",
      decidedBy: null,
      decidedAt: null,
      note: "Legacy queue statuses are observations, not a Grow review-bundle decision.",
    },
    status: "candidate",
    generatesCopy: false,
    sideEffects: "none",
  };
}

function cutInput(
  slug: string,
  sourceRef: GrowReviewReference,
  cut: Omit<LegacyContentCut, "growThisInput">,
): GrowThisPlanInput {
  return {
    id: "grow:" + slug + ":" + cut.lens,
    sourceRef,
    cutRef: cut.cutRef,
    variantRefs: cut.variantRefs,
    sourceStatus: cut.sourceStatus,
    cutStatus: cut.cutStatus,
    cutDecision: cut.cutDecision,
    reviewBundle: reviewBundle(slug, sourceRef, cut.cutRef, cut.variantRefs),
    evidenceRefs: [],
  };
}

function cutLenses(folder: string, rows: readonly QueueRow[]): string[] {
  const lenses = new Set<string>(["extract"]);
  for (const row of rows) lenses.add(rowLens(row.id));
  const cutsRoot = join(folder, "cuts");
  if (existsSync(cutsRoot)) {
    for (const entry of readdirSync(cutsRoot).sort((left, right) => left.localeCompare(right))) {
      if (existsSync(join(cutsRoot, entry, "cut.md"))) lenses.add(entry);
    }
  }
  return ["extract", ...[...lenses].filter((lens) => lens !== "extract").sort((left, right) => left.localeCompare(right))];
}

function cutArtifactPath(folder: string, lens: string): string {
  return lens === "extract" ? join(folder, "source.md") : join(folder, "cuts", lens, "cut.md");
}

function acceptedCutDecision(folder: string, lens: string): GrowThisCutDecision | null {
  const advice = readAdvice(folder);
  if (advice === null) return null;
  const matches = advice.rounds.flatMap((round) => round.cards).filter((card) =>
    card.kind === "angle" && card.status === "accepted" && card.acceptedLens === lens);
  if (matches.length !== 1) return null;
  const decidedAt = matches[0]?.decidedAt;
  if (decidedAt === null || decidedAt === undefined || Number.isNaN(Date.parse(decidedAt))) return null;
  return { status: "approved", decidedBy: "muxin", decidedAt };
}

/** Build a body-free normalized lineage view from one existing legacy content folder. */
export function adaptLegacyContentFolder(folder: string): LegacyContentAdapterResult {
  const slug = stableSlug(folder);
  if (!existsSync(folder)) throw new Error("content folder does not exist: " + folder);
  const queue = existsSync(join(folder, "review-queue.md")) ? readQueue(folder).rows : [];
  const publishLogRead = readPublishLog(folder, queue);
  const publishedIds = new Set(publishLogRead.summary.publishedVariantIds);
  const sourceRef = ref("source", "source:" + slug, "legacy-content-folder");
  const cuts = cutLenses(folder, queue).map((lens): LegacyContentCut => {
    const rows = queue.filter((row) => rowLens(row.id) === lens);
    const variants = rows.map((row) => queueVariant(slug, row, publishLogRead.text, publishedIds));
    const cutRef = ref("cut", "cut:" + slug + ":" + lens, "legacy-cut-artifact");
    const sourceStatus: GrowThisStageStatus = existsSync(join(folder, "source.md")) ? "ready" : "blocked";
    const cutStatus: GrowThisStageStatus = existsSync(cutArtifactPath(folder, lens)) ? "ready" : "blocked";
    const cutDecision = acceptedCutDecision(folder, lens);
    const blockers = [
      ...(sourceStatus === "ready" ? [] : ["source.md is missing"]),
      ...(cutStatus === "ready" ? [] : ["cut artifact is missing"]),
      ...(rows.length ? [] : ["review-queue has no variant rows for this cut"]),
      ...(cutDecision ? [] : ["Muxin cut decision is not persisted in the legacy folder"]),
      "treatment rationale is not persisted in the legacy queue",
      "evidence refs are not persisted in the legacy queue",
      "voice and originality checks are not persisted in the legacy queue",
    ];
    const base = {
      lens,
      cutRef,
      variantRefs: variants.map((variant) => variant.ref),
      variants,
      sourceStatus,
      cutStatus,
      cutDecision,
      blockers: uniqueSorted(blockers),
    } satisfies Omit<LegacyContentCut, "growThisInput">;
    return { ...base, growThisInput: cutInput(slug, sourceRef, base) };
  });
  const blockers = uniqueSorted(cuts.flatMap((cut) => cut.blockers));
  return {
    kind: "legacy_grow_lineage",
    version: LEGACY_CONTENT_ADAPTER_VERSION,
    folder,
    slug,
    sourceRef,
    cuts,
    publishLog: publishLogRead.summary,
    blockers,
    bodyIncluded: false,
    sideEffects: "none",
  };
}

function selectedCut(result: LegacyContentAdapterResult, lens: string): LegacyContentCut {
  const cut = result.cuts.find((candidate) => candidate.lens === lens);
  if (!cut) throw new Error("legacy content folder has no " + lens + " cut");
  return cut;
}

/** Project one selected legacy cut through the existing Grow lifecycle projection. */
export function buildLegacyGrowPlan(result: LegacyContentAdapterResult, lens = "extract"): GrowThisPlan {
  return buildGrowThisPlan(selectedCut(result, lens).growThisInput);
}

export const createLegacyContentAdapter = adaptLegacyContentFolder;
