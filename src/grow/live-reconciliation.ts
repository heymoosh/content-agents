import type { QueueRow } from "../publish/queue.js";
import type { Claim } from "../publish/slots.js";
import {
  adaptQueueRowToGrowFacts,
  adaptSchedulerClaimToGrowFacts,
  type GrowSchedulerClaimFactsInput,
} from "./live-facts.js";
import type { GrowQueueFacts, GrowSchedulerFacts } from "./queue-facts.js";

/** Version of the read-side queue/scheduler composition artifact. */
export const GROW_LIVE_FACTS_VERSION = "grow-live-facts-v1" as const;

export interface GrowLiveFactsInput {
  /** An already-read review-queue row. No filesystem read happens here. */
  readonly queueRow?: QueueRow | null;
  /** Alias for callers that name the source by its repository record. */
  readonly reviewQueueRow?: QueueRow | null;
  /** Lineage is not present on QueueRow, so it must be supplied explicitly. */
  readonly queueLineage?: unknown;
  /** An already-observed scheduler claim. Claim presence is not a lifecycle status. */
  readonly schedulerClaim?: Claim | null;
  /** Alias for callers that use the scheduler's shorter claim name. */
  readonly claim?: Claim | null;
  /** Explicit scheduler observations; none are inferred from the claim. */
  readonly schedulerObservation?: GrowSchedulerClaimFactsInput | null;
}

export interface GrowLiveFacts {
  readonly kind: "grow_live_facts";
  readonly version: typeof GROW_LIVE_FACTS_VERSION;
  readonly queue: GrowQueueFacts | null;
  readonly scheduler: GrowSchedulerFacts;
  readonly readiness: {
    readonly status: "ready" | "blocked";
    readonly blockers: string[];
  };
  readonly sideEffects: "none";
}

const LINEAGE_KEYS = ["sourceId", "cutId", "variantId", "experimentId", "publishId"] as const;

function selectedQueueRow(input: GrowLiveFactsInput): QueueRow | null | undefined {
  return input.reviewQueueRow !== undefined ? input.reviewQueueRow : input.queueRow;
}

function selectedSchedulerClaim(input: GrowLiveFactsInput): Claim | null | undefined {
  return input.schedulerClaim !== undefined ? input.schedulerClaim : input.claim;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function lineageConflicts(queue: GrowQueueFacts, scheduler: GrowSchedulerFacts): string[] {
  if (queue.lineage === null || scheduler.lineage === null) return [];
  return LINEAGE_KEYS
    .filter((key) => {
      const queueValue = queue.lineage?.[key];
      const schedulerValue = scheduler.lineage?.[key];
      return queueValue !== null
        && queueValue !== undefined
        && schedulerValue !== null
        && schedulerValue !== undefined
        && queueValue !== schedulerValue;
    })
    .map((key) => `queue and scheduler lineage conflict at ${key}`);
}

/**
 * Compose already-adapted live queue and scheduler observations for reconciliation.
 *
 * This function is a pure join. It does not read or write a queue, claim a slot, infer a
 * delivery id, approval, publish, measured outcome, status, or lineage, and it never chooses
 * between conflicting facts. Missing inputs remain null/unknown and become readiness blockers.
 */
export function composeGrowLiveFacts(input: GrowLiveFactsInput): GrowLiveFacts {
  const row = selectedQueueRow(input);
  const claim = selectedSchedulerClaim(input);
  const queue = row === null || row === undefined
    ? null
    : adaptQueueRowToGrowFacts(row, input.queueLineage);
  const scheduler = adaptSchedulerClaimToGrowFacts(claim, input.schedulerObservation ?? {});

  const blockers: string[] = [];
  if (queue === null) blockers.push("review queue row is missing");
  else blockers.push(...queue.readiness.blockers);
  blockers.push(...scheduler.readiness.blockers);
  if (queue !== null) blockers.push(...lineageConflicts(queue, scheduler));

  const readinessBlockers = unique(blockers);
  return {
    kind: "grow_live_facts",
    version: GROW_LIVE_FACTS_VERSION,
    queue,
    scheduler,
    readiness: {
      status: readinessBlockers.length === 0 ? "ready" : "blocked",
      blockers: readinessBlockers,
    },
    sideEffects: "none",
  };
}

export const buildGrowLiveFacts = composeGrowLiveFacts;
export const createGrowLiveFacts = composeGrowLiveFacts;
