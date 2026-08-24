import type { CommentLearningView } from "./comment-learning.js";
import type { GrowDeliveryRecord } from "./delivery-record.js";
import type { GenerationBrief } from "./generation-brief.js";
import type { GrowGenerationReviewDelivery } from "./generation-review-delivery.js";
import type { GrowReviewBundle } from "./review-bundle.js";

/** A body-free aggregate of already-produced Studio lifecycle facts. */
export const STUDIO_READINESS_VERSION = "studio-readiness-v1" as const;

export type StudioReadinessStage = "source" | "brief" | "treatment-coverage" | "volume" | "generation" | "review" | "delivery" | "learning";
export type StudioReadinessStatus = "ready" | "blocked";
export type StudioHumanGateStatus = "pending" | "approved" | "rejected" | "needs-another-pass";

export interface StudioReadinessHumanGateFact {
  readonly required?: boolean;
  readonly before?: string;
  readonly approvalOwner?: string;
  readonly status?: string;
}

export interface StudioReadinessVolumeSlot {
  readonly id?: string | null;
  readonly slotId?: string | null;
  readonly slotKey?: string | null;
  readonly platform?: string | null;
  readonly dayIndex?: number | null;
  readonly slotIndex?: number | null;
  readonly variantId?: string | null;
  readonly readiness?: "ready" | "blocked" | { readonly status?: string; readonly blockers?: readonly string[] };
  readonly status?: "ready" | "blocked" | string;
  readonly blockers?: readonly string[];
  readonly humanReviewRequired?: boolean;
  readonly humanGate?: StudioReadinessHumanGateFact;
}

/** Minimal structural seam for the body-free volume-plan artifact. */
export interface StudioReadinessVolumePlan {
  readonly slots?: readonly StudioReadinessVolumeSlot[];
  readonly humanReviewRequired?: boolean;
  readonly humanGate?: StudioReadinessHumanGateFact;
  readonly generatesCopy?: boolean;
  readonly creatorBodyCopyAllowed?: boolean;
  readonly sideEffects?: string;
}

/** Structural seam for an already-produced, body-free treatment coverage report. */
export interface StudioReadinessTreatmentCoverage {
  readonly readiness?: {
    readonly status?: string;
    readonly blockers?: readonly string[];
  } | null;
  readonly generatesCopy?: boolean;
  readonly creatorBodyCopyAllowed?: boolean;
  readonly bodyFree?: boolean;
  readonly sideEffects?: string;
}

export interface StudioReadinessGenerationCoverage {
  readonly status?: string;
  readonly oneToOne?: boolean;
  readonly one_to_one?: boolean;
  readonly expectedVariantIds?: readonly string[];
  readonly generatedVariantIds?: readonly string[];
  readonly duplicateVariantIds?: readonly string[];
  readonly missingVariantIds?: readonly string[];
  readonly blockers?: readonly string[];
}

export interface StudioReadinessGenerationRow {
  readonly id?: string | null;
  readonly slotId?: string | null;
  readonly slotKey?: string | null;
  readonly volumeSlotId?: string | null;
  readonly volumePlanSlotId?: string | null;
  readonly variantId?: string | null;
  readonly platform?: string | null;
  readonly dayIndex?: number | null;
  readonly slotIndex?: number | null;
  readonly status?: string;
  readonly generatedArtifactRef?: string | null;
  readonly reviewQueueRef?: string | null;
  readonly reviewQueueStatus?: string | null;
  readonly readiness?: { readonly status?: string; readonly blockers?: readonly string[] } | string;
  readonly blockers?: readonly string[];
  readonly humanReviewRequired?: boolean;
  readonly humanGate?: StudioReadinessHumanGateFact;
}

/** Minimal structural seam for the forthcoming generation-run manifest. */
export interface StudioReadinessGenerationRun {
  readonly kind?: string;
  readonly version?: string;
  readonly sourceReference?: string;
  readonly substanceReference?: string;
  /** The canonical generation-run output uses `slots`; `rows` remains a structural alias. */
  readonly slots?: readonly StudioReadinessGenerationRow[];
  readonly rows?: readonly StudioReadinessGenerationRow[];
  readonly unexpectedCandidates?: readonly StudioReadinessGenerationRow[];
  readonly coverage?: StudioReadinessGenerationCoverage;
  readonly summary?: {
    readonly slots?: number;
    readonly ready?: number;
    readonly blocked?: number;
    readonly missing?: number;
    readonly duplicate?: number;
    readonly unexpected?: number;
  };
  readonly readiness?: { readonly status?: string; readonly blockers?: readonly string[] };
  readonly treatmentCoverage?: { readonly status?: string; readonly blockers?: readonly string[] };
  readonly humanReviewRequired?: boolean;
  readonly reviewGate?: StudioReadinessHumanGateFact;
  readonly humanGate?: StudioReadinessHumanGateFact;
  readonly generatesCopy?: boolean;
  readonly creatorBodyCopyAllowed?: boolean;
  readonly sideEffects?: string;
  readonly autoApproval?: boolean;
  readonly autoScheduling?: boolean;
  readonly autoPublishing?: boolean;
}

export interface StudioReadinessInput {
  /** Source readiness is always caller-supplied; the aggregate never classifies a source. */
  readonly sourceStatus: StudioReadinessStatus | null | undefined;
  /** `generationBrief` is an explicit alias for callers that prefer the type name. */
  readonly brief?: GenerationBrief | null;
  readonly generationBrief?: GenerationBrief | null;
  /** `treatmentCoverage` is canonical; `coverage` and `treatmentCoverageView` are aliases. */
  readonly treatmentCoverage?: StudioReadinessTreatmentCoverage | null;
  readonly coverage?: StudioReadinessTreatmentCoverage | null;
  readonly treatmentCoverageView?: StudioReadinessTreatmentCoverage | null;
  /** `volumePlan` and `volume` are explicit aliases for the body-free volume allocation. */
  readonly volumePlan?: StudioReadinessVolumePlan | null;
  readonly volume?: StudioReadinessVolumePlan | null;
  readonly volumePlanManifest?: StudioReadinessVolumePlan | null;
  /** `generationRunManifest`, `generationRun`, and `generation` are explicit aliases. */
  readonly generationRunManifest?: StudioReadinessGenerationRun | null;
  readonly generationRun?: StudioReadinessGenerationRun | null;
  readonly generationManifest?: StudioReadinessGenerationRun | null;
  readonly generation?: StudioReadinessGenerationRun | null;
  /** Optional per-slot review-to-delivery join. It adds blockers; it never replaces a delivery record. */
  readonly generationReviewDelivery?: GrowGenerationReviewDelivery | null;
  /** `review` is an explicit alias for callers that prefer the stage name. */
  readonly review?: GrowReviewBundle | null;
  readonly reviewBundle?: GrowReviewBundle | null;
  readonly delivery?: GrowDeliveryRecord | null;
  readonly deliveryRecord?: GrowDeliveryRecord | null;
  readonly learning?: CommentLearningView | null;
  readonly commentLearning?: CommentLearningView | null;
  readonly commentLearningView?: CommentLearningView | null;
}

export interface StudioReadinessStageProjection {
  readonly stage: StudioReadinessStage;
  readonly status: StudioReadinessStatus;
  readonly blockers: string[];
}

export interface StudioHumanGate {
  readonly required: true;
  readonly owner: "human";
  readonly status: StudioHumanGateStatus;
  readonly blockers: string[];
}

export interface StudioReadiness {
  readonly kind: "studio_readiness";
  readonly version: typeof STUDIO_READINESS_VERSION;
  readonly stages: StudioReadinessStageProjection[];
  readonly gates: {
    readonly brief: StudioHumanGate;
    readonly treatmentCoverage: StudioHumanGate;
    readonly volume: StudioHumanGate;
    readonly generation: StudioHumanGate;
    readonly review: StudioHumanGate;
    readonly delivery: StudioHumanGate;
    readonly learning: StudioHumanGate;
  };
  readonly readiness: {
    readonly status: StudioReadinessStatus;
    readonly blockers: string[];
  };
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stage(
  name: StudioReadinessStage,
  status: StudioReadinessStatus,
  blockers: readonly string[] = [],
): StudioReadinessStageProjection {
  return { stage: name, status, blockers: uniqueSorted(blockers) };
}

function gate(
  status: StudioHumanGateStatus,
  blockers: readonly string[] = [],
): StudioHumanGate {
  return { required: true, owner: "human", status, blockers: uniqueSorted(blockers) };
}

function supplied<T>(primary: T | null | undefined, alias: T | null | undefined): T | null {
  if (primary !== undefined) return primary;
  return alias === undefined ? null : alias;
}

function sourceStage(status: StudioReadinessInput["sourceStatus"]): StudioReadinessStageProjection {
  if (status === "ready") return stage("source", "ready");
  if (status === "blocked") return stage("source", "blocked", ["source status is blocked"]);
  return stage("source", "blocked", ["source status is missing"]);
}

function briefStage(brief: GenerationBrief | null): StudioReadinessStageProjection {
  if (brief === null) return stage("brief", "blocked", ["generation brief is missing"]);

  const blockers = brief.variants.flatMap((variant) => {
    if (variant.readiness?.status !== "blocked") return [];
    return variant.readiness.blockers.length > 0
      ? variant.readiness.blockers
      : ["brief variant readiness is blocked"];
  });
  if (brief.variants.length === 0) blockers.push("generation brief has no variants");
  if (brief.generatesCopy !== false) blockers.push("generation brief must not generate copy");
  if (brief.sideEffects !== "none") blockers.push("generation brief has side effects");
  if (brief.templateReusePolicy?.creatorBodyCopy !== "forbidden") blockers.push("creator body copying is not forbidden");
  if (brief.modelBoundary?.modelInvocation !== "deferred") blockers.push("generation model invocation is not deferred");
  if (brief.modelBoundary?.sideEffects !== "none") blockers.push("generation model boundary has side effects");
  if (brief.modelBoundary?.boundaries?.composesBody !== false) blockers.push("generation model boundary composes body copy");
  if (brief.modelBoundary?.boundaries?.creatorBodyCopyAllowed !== false) blockers.push("generation model boundary allows creator body copy");
  return stage("brief", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function stringStatus(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const status = (value as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }
  return null;
}

function treatmentCoverageStage(
  coverage: StudioReadinessTreatmentCoverage | null,
): StudioReadinessStageProjection {
  if (coverage === null) return stage("treatment-coverage", "blocked", ["treatment coverage is missing"]);

  const blockers: string[] = [];
  if (coverage.readiness?.status !== "ready") {
    blockers.push(...(coverage.readiness?.blockers?.length
      ? coverage.readiness.blockers
      : ["treatment coverage readiness is blocked"]));
  }
  if (coverage.generatesCopy !== false) blockers.push("treatment coverage must not generate copy");
  if (coverage.creatorBodyCopyAllowed !== false) blockers.push("treatment coverage must not allow creator body copy");
  if (coverage.bodyFree !== undefined && coverage.bodyFree !== true) blockers.push("treatment coverage must be body-free");
  if (coverage.sideEffects !== "none") blockers.push("treatment coverage has side effects");
  return stage("treatment-coverage", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function factBlockers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((blocker): blocker is string => typeof blocker === "string");
}

function volumeSlotBlockers(slot: StudioReadinessVolumeSlot): string[] {
  const readinessBlockers = typeof slot.readiness === "object" && slot.readiness !== null
    ? factBlockers(slot.readiness.blockers)
    : [];
  return [...new Set([...factBlockers(slot.blockers), ...readinessBlockers])];
}

function volumeSlotReady(slot: StudioReadinessVolumeSlot): string | null {
  return stringStatus(slot.readiness ?? slot.status);
}

function volumeStage(plan: StudioReadinessVolumePlan | null): StudioReadinessStageProjection {
  if (plan === null) return stage("volume", "blocked", ["volume plan is missing"]);

  const blockers: string[] = [];
  if (!Array.isArray(plan.slots)) {
    blockers.push("volume plan slots are missing");
  } else if (plan.slots.length === 0) {
    blockers.push("volume plan has no slots");
  } else {
    for (const slot of plan.slots) {
      const readiness = volumeSlotReady(slot);
      const slotBlockers = volumeSlotBlockers(slot);
      if (readiness === "blocked") {
        blockers.push(...(slotBlockers.length ? slotBlockers : ["volume plan contains blocked slots"]));
      } else if (readiness !== "ready") {
        blockers.push("volume slot readiness is missing or invalid");
      } else if (slotBlockers.length > 0) {
        blockers.push(...slotBlockers);
      }
      if (slot.humanReviewRequired !== true) blockers.push("volume plan slots are not human-gated");
      if (slot.humanGate?.required !== true || slot.humanGate.approvalOwner !== "human") {
        blockers.push("volume plan slots are not human-gated");
      }
    }
  }
  if (plan.humanReviewRequired !== true) blockers.push("volume plan is not human-gated");
  if (plan.humanGate !== undefined
    && (plan.humanGate.required !== true || plan.humanGate.approvalOwner !== "human")) {
    blockers.push("volume plan is not human-gated");
  }
  if (plan.generatesCopy !== false) blockers.push("volume plan must not generate copy");
  if (plan.creatorBodyCopyAllowed === true) blockers.push("volume plan permits creator body copy");
  if (plan.sideEffects !== "none") blockers.push("volume plan has side effects");
  return stage("volume", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function ids(value: readonly string[] | undefined): string[] | null {
  return value === undefined ? null : [...value];
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function rowBlockers(row: StudioReadinessGenerationRow): string[] {
  const readinessBlockers = typeof row.readiness === "object" && row.readiness !== null
    ? factBlockers(row.readiness.blockers)
    : [];
  return [...new Set([...factBlockers(row.blockers), ...readinessBlockers])];
}

function rowStatus(row: StudioReadinessGenerationRow): string | null {
  return stringStatus(row.readiness ?? row.status);
}

function generationVariantIds(plan: StudioReadinessVolumePlan | null): string[] | null {
  if (plan === null || !Array.isArray(plan.slots)) return null;
  const values = plan.slots.map((slot) => slot.variantId);
  return values.every((value): value is string => typeof value === "string") ? values : null;
}

function generationRows(run: StudioReadinessGenerationRun): readonly StudioReadinessGenerationRow[] | null {
  if (Array.isArray(run.slots)) return run.slots;
  if (Array.isArray(run.rows)) return run.rows;
  return null;
}

function generationRowIdentity(row: StudioReadinessGenerationRow): string | null {
  if (typeof row.platform !== "string"
    || typeof row.dayIndex !== "number"
    || typeof row.slotIndex !== "number"
    || typeof row.variantId !== "string") return null;
  return JSON.stringify([row.platform, row.dayIndex, row.slotIndex, row.variantId]);
}

function generationCoverageBlockers(
  run: StudioReadinessGenerationRun,
  plan: StudioReadinessVolumePlan | null,
): string[] {
  const blockers: string[] = [];
  const rows = generationRows(run);
  const coverage = run.coverage;
  const summary = run.summary;
  if (run.readiness?.status === "blocked") {
    blockers.push(...(run.readiness.blockers?.length ? run.readiness.blockers : ["generation run readiness is blocked"]));
  }

  if (summary !== undefined) {
    if (summary.slots === undefined || summary.ready === undefined || summary.blocked === undefined
      || summary.missing === undefined || summary.duplicate === undefined || summary.unexpected === undefined) {
      blockers.push("generation run summary is incomplete");
    } else {
      if (rows !== null && summary.slots !== rows.length) blockers.push("generation run summary does not match its slots");
      if (summary.blocked > 0) blockers.push("generation run contains blocked slots");
      if (summary.missing > 0) blockers.push("generation run has missing slots");
      if (summary.duplicate > 0) blockers.push("generation run has duplicate slots");
      if (summary.unexpected > 0) blockers.push("generation run has unexpected candidates");
      if (summary.ready !== summary.slots) blockers.push("generation run coverage is not complete");
    }
  } else if (coverage?.status !== "complete") {
    blockers.push("generation run coverage is incomplete");
  }

  const expected = ids(coverage?.expectedVariantIds);
  const generated = ids(coverage?.generatedVariantIds);
  const duplicate = ids(coverage?.duplicateVariantIds);
  const missing = ids(coverage?.missingVariantIds);
  const rowIds = rows !== null
    ? rows.map((row) => row.variantId).filter((value): value is string => typeof value === "string")
    : [];
  const plannedIds = generationVariantIds(plan);

  if (rows !== null && run.slots !== undefined) {
    const identities = rows.map(generationRowIdentity);
    if (identities.some((value) => value === null)) blockers.push("generation run slots have incomplete identity");
    const present = identities.filter((value): value is string => value !== null);
    if (new Set(present).size !== present.length) blockers.push("generation run contains duplicate slot identities");
    if (plan !== null && Array.isArray(plan.slots)) {
      const plannedIdentities = plan.slots.map(generationRowIdentity);
      if (plannedIdentities.some((value) => value === null)) blockers.push("volume plan slots have incomplete identity");
      const sortedPlanned = plannedIdentities.filter((value): value is string => value !== null).sort();
      const sortedGenerated = present.slice().sort();
      if (!sameIds(sortedPlanned, sortedGenerated)) blockers.push("generation run slots do not match the volume plan");
    }
  }
  if (run.unexpectedCandidates !== undefined && run.unexpectedCandidates.length > 0) {
    blockers.push("generation run has unexpected candidates");
  }

  const declaredOneToOne = coverage?.oneToOne ?? coverage?.one_to_one;
  let oneToOne = declaredOneToOne === true;
  if (summary !== undefined) {
    oneToOne = summary.slots !== undefined
      && summary.ready !== undefined
      && summary.ready === summary.slots
      && (summary.blocked ?? 1) === 0
      && (summary.missing ?? 1) === 0
      && (summary.duplicate ?? 1) === 0
      && (summary.unexpected ?? 1) === 0;
  } else if (expected !== null && generated !== null) {
    const sortedExpected = [...expected].sort();
    const sortedGenerated = [...generated].sort();
    const identifiersAreOneToOne = sameIds(sortedExpected, sortedGenerated)
      && (duplicate?.length ?? 0) === 0
      && (missing?.length ?? 0) === 0;
    oneToOne = declaredOneToOne === false ? false : oneToOne || identifiersAreOneToOne;
    if (plannedIds !== null && !sameIds([...plannedIds].sort(), sortedExpected)) oneToOne = false;
    if (!sameIds([...rowIds].sort(), sortedGenerated)) oneToOne = false;
  } else if (plannedIds !== null) {
    oneToOne = oneToOne
      && sameIds([...plannedIds].sort(), [...rowIds].sort())
      && new Set(rowIds).size === rowIds.length;
  } else {
    oneToOne = false;
  }

  if ((duplicate?.length ?? 0) > 0 || (missing?.length ?? 0) > 0 || !oneToOne) {
    blockers.push("generation run coverage is not one-to-one");
  }
  blockers.push(...factBlockers(coverage?.blockers));
  return blockers;
}

function generationStage(
  run: StudioReadinessGenerationRun | null,
  plan: StudioReadinessVolumePlan | null,
  volumeProjection: StudioReadinessStageProjection,
  treatmentCoverageProjection: StudioReadinessStageProjection,
): StudioReadinessStageProjection {
  if (run === null) return stage("generation", "blocked", ["generation run manifest is missing"]);

  const blockers: string[] = [];
  const rows = generationRows(run);
  if (rows === null) {
    blockers.push("generation run rows are missing");
  } else if (rows.length === 0) {
    blockers.push("generation run has no rows");
  } else {
    for (const row of rows) {
      const status = rowStatus(row);
      const rowBlockerValues = rowBlockers(row);
      if (status === "blocked") {
        blockers.push(...(rowBlockerValues.length ? rowBlockerValues : ["generation run contains blocked rows"]));
      } else if (status !== "ready") {
        blockers.push("generation run row readiness is missing or invalid");
      } else if (rowBlockerValues.length > 0) {
        blockers.push(...rowBlockerValues);
      }
      if (row.humanReviewRequired === false) blockers.push("generation run rows do not require human review");
      if (run.slots !== undefined) {
        if (typeof row.generatedArtifactRef !== "string" || row.generatedArtifactRef.trim() === "") {
          blockers.push("generation run slot artifact reference is missing");
        }
        if (typeof row.reviewQueueRef !== "string" || row.reviewQueueRef.trim() === "") {
          blockers.push("generation run slot review queue reference is missing");
        }
        if (row.reviewQueueStatus !== "pending") blockers.push("generation run slot review queue is not pending");
      }
    }
  }
  blockers.push(...generationCoverageBlockers(run, plan));
  if (treatmentCoverageProjection.status !== "ready") blockers.push("generation waits for treatment coverage");
  if (volumeProjection.status !== "ready") {
    blockers.push(plan === null ? "generation waits for volume plan" : "generation waits for volume readiness");
  }
  if (run.humanReviewRequired !== true
    && run.reviewGate?.required !== true
    && run.humanGate?.required !== true) {
    blockers.push("generation run must require human review");
  }
  if (run.generatesCopy !== false) blockers.push("generation run must not generate copy");
  if (run.creatorBodyCopyAllowed === true) blockers.push("generation run permits creator body copy");
  if (run.sideEffects !== "none") blockers.push("generation run has side effects");
  if (run.autoApproval !== false) blockers.push("generation run permits auto-approval");
  if (run.autoScheduling !== false) blockers.push("generation run permits auto-scheduling");
  if (run.autoPublishing !== false) blockers.push("generation run permits auto-publishing");
  return stage("generation", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function reviewApproved(review: GrowReviewBundle): boolean {
  return review.status === "approved"
    && review.humanDecision.status === "approved"
    && review.humanDecision.decidedBy === "muxin"
    && review.humanDecision.decidedAt !== null;
}

function reviewStage(review: GrowReviewBundle | null): StudioReadinessStageProjection {
  if (review === null) return stage("review", "blocked", ["review bundle is missing"]);

  const blockers: string[] = [];
  if (review.readiness.status === "blocked") {
    blockers.push(...review.readiness.blockingFields);
    if (review.readiness.blockingFields.length === 0) blockers.push("review readiness is blocked");
  }
  if (!reviewApproved(review)) blockers.push("review is not approved by Muxin");
  if (review.generatesCopy !== false) blockers.push("review bundle must not generate copy");
  if (review.sideEffects !== "none") blockers.push("review bundle has side effects");
  return stage("review", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function deliveryStage(
  delivery: GrowDeliveryRecord | null,
  review: GrowReviewBundle | null,
  reviewProjection: StudioReadinessStageProjection,
  source: StudioReadinessStageProjection,
  brief: StudioReadinessStageProjection,
  generationReviewDelivery: GrowGenerationReviewDelivery | null,
): StudioReadinessStageProjection {
  if (delivery === null) return stage("delivery", "blocked", ["delivery record is missing"]);

  const blockers: string[] = [];
  if (review === null) {
    blockers.push("review bundle is missing");
  } else if (delivery.reviewBundleId !== review.id) {
    blockers.push("delivery record does not match review bundle");
  } else if (!reviewApproved(review)) {
    blockers.push("review is not approved by Muxin");
  }
  if (reviewProjection.status !== "ready") blockers.push("delivery waits for review readiness");
  if (source.status !== "ready") blockers.push("delivery waits for source readiness");
  if (brief.status !== "ready") blockers.push("delivery waits for generation brief");
  if (delivery.readiness.status === "blocked") {
    blockers.push(...delivery.readiness.blockers);
    if (delivery.readiness.blockers.length === 0) blockers.push("delivery readiness is blocked");
  }
  if (delivery.autoPublishing !== false) blockers.push("delivery record permits auto-publishing");
  if (delivery.sideEffects !== "none") blockers.push("delivery record has side effects");
  blockers.push(...generationReviewDeliveryBlockers(generationReviewDelivery));
  return stage("delivery", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function generationReviewDeliveryBlockers(join: GrowGenerationReviewDelivery | null): string[] {
  if (join === null) return [];
  const blockers: string[] = [];
  if (join.readiness.status !== "ready") {
    blockers.push(...(join.readiness.blockers.length > 0
      ? join.readiness.blockers
      : ["generation review delivery is blocked"]));
  }
  if (join.bodyFree !== true) blockers.push("generation review delivery must be body-free");
  if (join.generatesCopy !== false) blockers.push("generation review delivery must not generate copy");
  if (join.creatorBodyCopyAllowed !== false) blockers.push("generation review delivery must not allow creator body copy");
  if (join.humanApprovalRequired !== true) blockers.push("generation review delivery must require human approval");
  if (join.autoApproval !== false) blockers.push("generation review delivery permits auto-approval");
  if (join.autoScheduling !== false) blockers.push("generation review delivery permits auto-scheduling");
  if (join.autoPublishing !== false) blockers.push("generation review delivery permits auto-publishing");
  if (join.sideEffects !== "none") blockers.push("generation review delivery has side effects");
  for (const row of join.rows) {
    if (row.readiness.status !== "ready") {
      blockers.push(...(row.readiness.blockers.length > 0
        ? row.readiness.blockers
        : ["generation review delivery row is blocked"]));
    }
    if (row.deliveryBinding.readiness.status !== "ready") {
      blockers.push(...(row.deliveryBinding.readiness.blockers.length > 0
        ? row.deliveryBinding.readiness.blockers
        : ["generation review delivery binding is blocked"]));
    }
  }
  return uniqueSorted(blockers);
}

function learningStage(learning: CommentLearningView | null): StudioReadinessStageProjection {
  if (learning === null) return stage("learning", "blocked", ["comment-learning view is missing"]);
  if (learning.readiness.status === "ready") return stage("learning", "ready");
  return stage(
    "learning",
    "blocked",
    learning.readiness.blockers.length > 0 ? learning.readiness.blockers : ["learning readiness is blocked"],
  );
}

function briefGate(brief: GenerationBrief | null): StudioHumanGate {
  if (brief === null) return gate("pending", ["generation brief is missing"]);
  return gate(brief.humanGate.status, brief.humanGate.status === "pending" ? ["brief human approval is pending"] : []);
}

function treatmentCoverageGate(
  coverage: StudioReadinessTreatmentCoverage | null,
  projection: StudioReadinessStageProjection,
): StudioHumanGate {
  if (coverage === null) return gate("pending", ["treatment coverage is missing"]);
  return gate("pending", projection.status === "ready" ? ["treatment coverage human review is pending"] : projection.blockers);
}

function reviewGate(review: GrowReviewBundle | null): StudioHumanGate {
  if (review === null) return gate("pending", ["review bundle is missing"]);
  const status = review.humanDecision.status === "candidate" ? "pending" : review.humanDecision.status;
  const blockers: string[] = [];
  if (status === "pending") blockers.push("human review is pending");
  if (status === "rejected") blockers.push("human review was rejected");
  if (status === "needs-another-pass") blockers.push("human review needs another pass");
  if (review.readiness.status === "blocked") blockers.push(...review.readiness.blockingFields);
  return gate(status, blockers);
}

function deliveryGate(delivery: GrowDeliveryRecord | null, blockers: readonly string[]): StudioHumanGate {
  return delivery !== null && blockers.length === 0
    ? gate("approved")
    : gate("pending", blockers.length > 0 ? blockers : ["delivery record is missing"]);
}

function volumeGate(volume: StudioReadinessVolumePlan | null, projection: StudioReadinessStageProjection): StudioHumanGate {
  if (volume === null) return gate("pending", ["volume plan is missing"]);
  return gate("pending", projection.status === "ready" ? ["volume human review is pending"] : projection.blockers);
}

function generationGate(
  generation: StudioReadinessGenerationRun | null,
  projection: StudioReadinessStageProjection,
): StudioHumanGate {
  if (generation === null) return gate("pending", ["generation run manifest is missing"]);
  return gate("pending", projection.status === "ready" ? ["generation human review is pending"] : projection.blockers);
}

function learningGate(learning: CommentLearningView | null): StudioHumanGate {
  if (learning === null) return gate("pending", ["comment-learning view is missing"]);
  if (learning.muxinDecision === "adopted") return gate("approved");
  if (learning.muxinDecision === "declined") return gate("rejected", ["Muxin declined the learning handoff"]);
  return gate("pending", ["Muxin learning decision is pending"]);
}

function firstSupplied<T>(...values: readonly (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return null;
}

/**
 * Compose explicit Studio facts into a deterministic lifecycle readiness view.
 *
 * This function reads status and readiness metadata only. It does not read bodies, invoke a
 * model, create downstream artifacts, call a publisher or reply path, or perform any I/O.
 */
export function buildStudioReadiness(input: StudioReadinessInput): StudioReadiness {
  const brief = supplied(input.brief, input.generationBrief);
  const treatmentCoverage = firstSupplied(input.treatmentCoverage, input.coverage, input.treatmentCoverageView);
  const volume = firstSupplied(input.volumePlan, input.volume, input.volumePlanManifest);
  const generation = firstSupplied(
    input.generationRunManifest,
    input.generationRun,
    input.generationManifest,
    input.generation,
  );
  const review = supplied(input.reviewBundle, input.review);
  const learning = input.learning !== undefined
    ? input.learning
    : input.commentLearning !== undefined
      ? input.commentLearning
      : input.commentLearningView === undefined ? null : input.commentLearningView;

  const source = sourceStage(input.sourceStatus);
  const briefProjection = briefStage(brief);
  const treatmentCoverageProjection = treatmentCoverageStage(treatmentCoverage);
  const volumeProjection = volumeStage(volume);
  const generationProjection = generationStage(generation, volume, volumeProjection, treatmentCoverageProjection);
  const reviewProjection = reviewStage(review);
  const deliveryRecord = input.delivery !== undefined ? input.delivery : input.deliveryRecord ?? null;
  const generationReviewDelivery = input.generationReviewDelivery === undefined
    ? null
    : input.generationReviewDelivery;
  const deliveryProjection = deliveryStage(
    deliveryRecord,
    review,
    reviewProjection,
    source,
    briefProjection,
    generationReviewDelivery,
  );
  const learningProjection = learningStage(learning);
  const stages = [
    source,
    briefProjection,
    treatmentCoverageProjection,
    volumeProjection,
    generationProjection,
    reviewProjection,
    deliveryProjection,
    learningProjection,
  ];
  const blockers = uniqueSorted(stages.flatMap((current) => current.blockers));

  return {
    kind: "studio_readiness",
    version: STUDIO_READINESS_VERSION,
    stages,
    gates: {
      brief: briefGate(brief),
      treatmentCoverage: treatmentCoverageGate(treatmentCoverage, treatmentCoverageProjection),
      volume: volumeGate(volume, volumeProjection),
      generation: generationGate(generation, generationProjection),
      review: reviewGate(review),
      delivery: deliveryGate(deliveryRecord, deliveryProjection.blockers),
      learning: learningGate(learning),
    },
    readiness: {
      status: blockers.length === 0 ? "ready" : "blocked",
      blockers,
    },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    autoPublishing: false,
    sideEffects: "none",
  };
}

export const createStudioReadiness = buildStudioReadiness;
export const aggregateStudioReadiness = buildStudioReadiness;
