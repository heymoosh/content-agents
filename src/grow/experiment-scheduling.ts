import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { scheduleApproved } from "../review/studio-scheduling.js";
import {
  PUBLISHING_STATUS_PATH,
  scheduleApprovedOnce,
  type PublishingStatus,
} from "../review/publishing-status.js";
import { normalizeGrowSchedulerFacts } from "./queue-facts.js";
import { adaptQueueRowToGrowFacts } from "./live-facts.js";
import { buildGrowDeliveryBinding, type GrowDeliveryBinding, type GrowDeliveryBindingProviderFacts } from "./delivery-binding.js";
import type { AppliedGrowExperimentQueueHandoff } from "./experiment-queue-handoff.js";

export const GROW_EXPERIMENT_SCHEDULING_VERSION = "grow-experiment-scheduling-v1" as const;

export interface GrowExperimentScheduleAttempt {
  readonly kind: "grow_experiment_schedule_attempt";
  readonly version: typeof GROW_EXPERIMENT_SCHEDULING_VERSION;
  readonly proposalDigest: string;
  readonly variantId: string;
  readonly attempted: true;
  readonly scheduled: unknown;
  readonly scheduleError: string | null;
  readonly publishing: PublishingStatus;
  readonly binding: GrowDeliveryBinding;
  readonly autoApproval: false;
  readonly autoScheduling: false;
  readonly autoPublishing: false;
}

type ScheduleOnce = (
  folder: string,
  slug: string,
  row: QueueRow,
) => Promise<{ scheduled: unknown; scheduleError: string | null; publishing: PublishingStatus }>;

export interface GrowExperimentSchedulingDeps {
  readonly schedule?: ScheduleOnce;
  readonly publishingStatusPath?: string;
}

function safeAsset(folder: string, asset: string): string {
  const path = join(folder, asset);
  const rel = relative(folder, path);
  if (!rel || rel.startsWith("..") || !existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
    throw new Error("approved Grow asset is missing or unsafe");
  }
  return path;
}

function schedulerStatus(status: PublishingStatus): "scheduled" | "published" | "unknown" {
  if (status.state === "live" || status.state === "delivered") return "published";
  if (status.state === "planned") return "scheduled";
  return "unknown";
}

function providerFacts(status: PublishingStatus): GrowDeliveryBindingProviderFacts | null {
  const reference = status.providerObjectId ?? status.ref ?? null;
  const scheduledAt = status.plannedFor ?? null;
  if (reference === null && scheduledAt === null) return null;
  const live = status.state === "live" || status.state === "delivered";
  return {
    provider: status.provider,
    reference,
    scheduledAt,
    liveCheck: live
      ? { status: "confirmed", checkedAt: status.at, liveAt: status.providerPublishedAt ?? status.at }
      : { status: "not_confirmed", checkedAt: status.at, liveAt: null },
  };
}

/**
 * Dispatch exactly one already-approved Grow handoff through Studio's canonical, attempt-ledgered
 * scheduler and immediately bind the observed queue/provider result back to Phase 3. Merely
 * importing or constructing this function does nothing: calling it is the explicit schedule act.
 */
export async function scheduleGrowExperimentVariant(
  handoff: AppliedGrowExperimentQueueHandoff,
  variantId: string,
  deps: GrowExperimentSchedulingDeps = {},
): Promise<GrowExperimentScheduleAttempt> {
  const planned = handoff.rows.find((row) => row.id === variantId);
  const asset = handoff.assets.find((item) => item.variantId === variantId);
  const priorBinding = handoff.bindings.find((binding) => binding.candidateId === variantId);
  if (!planned || !asset || !priorBinding) throw new Error(`approved Grow handoff has no candidate ${variantId}`);
  if (priorBinding.status !== "approved" || priorBinding.readiness.status !== "ready") {
    throw new Error(`Grow candidate ${variantId} is not ready for explicit scheduling`);
  }
  const before = readQueue(handoff.folder).rows.find((row) => row.id === variantId);
  if (!before || before.status !== "approve") throw new Error(`Grow candidate ${variantId} must still be explicitly approved`);
  if (before.asset !== planned.asset || before.platform !== planned.platform || before.format !== planned.format) {
    throw new Error(`Grow candidate ${variantId} no longer matches its approved queue handoff`);
  }
  if (readFileSync(safeAsset(handoff.folder, before.asset), "utf8") !== asset.content) {
    throw new Error(`Grow candidate ${variantId} no longer matches its approved body`);
  }

  const schedule: ScheduleOnce = deps.schedule ?? ((folder, slug, row) =>
    scheduleApprovedOnce(folder, slug, row, scheduleApproved, deps.publishingStatusPath ?? PUBLISHING_STATUS_PATH));
  const attempt = await schedule(handoff.folder, basename(handoff.folder), before);
  if (attempt.publishing.rowId !== variantId) throw new Error("scheduler observation row does not match the Grow candidate");

  const after = readQueue(handoff.folder).rows.find((row) => row.id === variantId);
  if (!after) throw new Error(`Grow candidate ${variantId} disappeared after scheduling`);
  const bundle = handoff.decision.reviewBundles.find((item) => item.id === planned.reviewBundleId);
  const capacitySlice = handoff.decision.capacityManifest.slices.find((slice) =>
    slice.day === handoff.decision.capacityManifest.days[0] && slice.platform === planned.platform) ?? null;
  if (!bundle) throw new Error(`Grow candidate ${variantId} lost its review bundle`);
  const observedPublishId = attempt.publishing.providerObjectId ?? attempt.publishing.ref ?? null;
  const observedLineage = { ...planned.lineage, publishId: observedPublishId };
  const queueFacts = adaptQueueRowToGrowFacts(after, observedLineage);
  const schedulerFacts = normalizeGrowSchedulerFacts({
    deliveryId: priorBinding.deliveryId,
    status: schedulerStatus(attempt.publishing),
    lineage: observedLineage,
  });
  const binding = buildGrowDeliveryBinding({
    reviewBundle: bundle,
    candidate: {
      id: planned.id,
      day: handoff.decision.capacityManifest.days[0]!,
      platform: planned.platform,
      variantId: planned.lineage.variantId,
      lineage: planned.lineage,
    },
    capacitySlice,
    queueFacts: { ...queueFacts, lineage: observedLineage },
    schedulerFacts: { ...schedulerFacts, lineage: observedLineage },
    providerFacts: providerFacts(attempt.publishing),
    deliveryMode: attempt.publishing.deliveryMode ?? "unknown",
  });
  return {
    kind: "grow_experiment_schedule_attempt",
    version: GROW_EXPERIMENT_SCHEDULING_VERSION,
    proposalDigest: handoff.proposalDigest,
    variantId,
    attempted: true,
    scheduled: attempt.scheduled,
    scheduleError: attempt.scheduleError,
    publishing: attempt.publishing,
    binding,
    autoApproval: false,
    autoScheduling: false,
    autoPublishing: false,
  };
}
