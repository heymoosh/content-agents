import type { QueueRow } from "../publish/queue.js";
import type { Claim } from "../publish/slots.js";
import {
  normalizeGrowQueueFacts,
  normalizeGrowSchedulerFacts,
  type GrowQueueFacts,
  type GrowSchedulerFacts,
} from "./queue-facts.js";

export interface GrowSchedulerClaimFactsInput {
  readonly deliveryId?: unknown;
  readonly status?: unknown;
  readonly lineage?: unknown;
}

function addBlockers<T extends { readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] } }>(
  facts: T,
  blockers: readonly string[],
): T {
  if (blockers.length === 0) return facts;
  return {
    ...facts,
    readiness: {
      status: "blocked",
      blockers: [...new Set([...facts.readiness.blockers, ...blockers])],
    },
  };
}

function isMissingStatus(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/** Adapt one already-read review-queue row into Grow facts without changing its lifecycle state. */
export function adaptQueueRowToGrowFacts(row: QueueRow, lineage?: unknown): GrowQueueFacts {
  return normalizeGrowQueueFacts({
    artifactId: row.id,
    status: row.status,
    lineage,
  });
}

/**
 * Adapt explicit scheduler observations into Grow facts.
 *
 * Claim presence is evidence that a caller observed a claim, not permission to infer a status,
 * delivery id, or lineage. Without that evidence, even an explicit scheduled status is reduced to
 * unknown so the caller cannot accidentally treat an unobserved schedule as ready.
 */
export function adaptSchedulerClaimToGrowFacts(
  claim: Claim | null | undefined,
  input: GrowSchedulerClaimFactsInput,
): GrowSchedulerFacts {
  const claimObserved = claim !== null && claim !== undefined;
  const facts = normalizeGrowSchedulerFacts({
    deliveryId: input.deliveryId,
    status: claimObserved ? input.status : "unknown",
    lineage: input.lineage,
  });
  const blockers: string[] = [];
  if (!claimObserved) blockers.push("scheduler claim is missing");
  if (isMissingStatus(input.status)) blockers.push("scheduler status is missing");
  return addBlockers(facts, blockers);
}

export const adaptGrowQueueRowFacts = adaptQueueRowToGrowFacts;
export const adaptGrowSchedulerClaimFacts = adaptSchedulerClaimToGrowFacts;
