import type { GrowDeliveryLineage } from "./delivery-record.js";
import type { GrowQueueStatus, GrowSchedulerStatus } from "./reconciliation.js";

/** Raw, caller-owned facts accepted by the pure queue/scheduler adapters. */
export interface GrowQueueFactsInput {
  readonly artifactId?: unknown;
  readonly artifact_id?: unknown;
  readonly status?: unknown;
  readonly lineage?: unknown;
}

export interface GrowSchedulerFactsInput {
  readonly deliveryId?: unknown;
  readonly delivery_id?: unknown;
  readonly status?: unknown;
  readonly lineage?: unknown;
}

export interface GrowQueueFacts {
  readonly artifactId: string | null;
  readonly status: GrowQueueStatus;
  readonly lineage: GrowDeliveryLineage | null;
  readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] };
  readonly sideEffects: "none";
}

export interface GrowSchedulerFacts {
  readonly deliveryId: string | null;
  readonly status: GrowSchedulerStatus;
  readonly lineage: GrowDeliveryLineage | null;
  readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] };
  readonly sideEffects: "none";
}

const RAW_STATUSES = new Set(["pending", "approve", "approved", "scheduled", "published", "measured", "blocked", "unknown"]);
const LINEAGE_KEYS = ["sourceId", "cutId", "variantId", "experimentId", "publishId"] as const;

type LineageKey = typeof LINEAGE_KEYS[number];

function id(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function rawStatus(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim().toLowerCase() : null;
}

function lineage(value: unknown, blockers: string[]): GrowDeliveryLineage | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    blockers.push("lineage is invalid");
    return null;
  }
  const source = value as Record<string, unknown>;
  const result: Record<LineageKey, string | null> = {
    sourceId: null,
    cutId: null,
    variantId: null,
    experimentId: null,
    publishId: null,
  };
  let present = false;
  for (const key of LINEAGE_KEYS) {
    const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const supplied = Object.hasOwn(source, key) ? source[key] : source[snake];
    if (supplied !== undefined) present = true;
    if (supplied === null || supplied === undefined) {
      result[key] = null;
    } else if (typeof supplied === "string" && supplied.trim() !== "") {
      result[key] = supplied.trim();
    } else {
      result[key] = null;
      blockers.push(`lineage ${key} is invalid`);
    }
  }
  return present ? result : null;
}

function queueStatus(value: unknown, blockers: string[]): GrowQueueStatus {
  const status = rawStatus(value);
  if (status === null || !RAW_STATUSES.has(status)) {
    blockers.push("status is invalid or missing");
    return "unknown";
  }
  if (status === "pending") {
    blockers.push("status is pending");
    return "unknown";
  }
  if (status === "unknown") {
    blockers.push("status is unknown");
    return "unknown";
  }
  if (status === "blocked") {
    blockers.push("status is blocked");
    return "blocked";
  }
  if (status === "approve") return "approved";
  return status as GrowQueueStatus;
}

function schedulerStatus(value: unknown, blockers: string[]): GrowSchedulerStatus {
  const status = rawStatus(value);
  if (status === null || !RAW_STATUSES.has(status)) {
    blockers.push("status is invalid or missing");
    return "unknown";
  }
  if (status === "approve" || status === "approved") return "unscheduled";
  if (status === "pending") {
    blockers.push("status is pending");
    return "unknown";
  }
  if (status === "blocked") {
    blockers.push("status is blocked");
    return "unknown";
  }
  if (status === "unknown") {
    blockers.push("status is unknown");
    return "unknown";
  }
  return status as GrowSchedulerStatus;
}

function requireLineage(
  value: GrowDeliveryLineage | null,
  status: GrowQueueStatus | GrowSchedulerStatus,
  blockers: string[],
): void {
  if (status === "unknown" || status === "blocked") return;
  if (value === null) {
    blockers.push("lineage is missing");
    return;
  }
  for (const key of ["sourceId", "cutId", "variantId", "experimentId"] as const) {
    if (value[key] === null) blockers.push(`lineage ${key} is missing`);
  }
  if ((status === "published" || status === "measured") && value.publishId === null) {
    blockers.push("lineage publishId is missing");
  }
}

function result<T extends { readiness: { status: "ready" | "blocked"; blockers: string[] } }>(value: T, blockers: string[]): T {
  return {
    ...value,
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)] },
  };
}

/** Normalize review-queue facts without approving drafts, unknown rows, or invalid input. */
export function normalizeGrowQueueFacts(input: GrowQueueFactsInput): GrowQueueFacts {
  const blockers: string[] = [];
  const artifactId = id(input.artifactId ?? input.artifact_id);
  if (artifactId === null) blockers.push("artifact id is missing or invalid");
  const status = queueStatus(input.status, blockers);
  const normalizedLineage = lineage(input.lineage, blockers);
  requireLineage(normalizedLineage, status, blockers);
  const output = {
    artifactId,
    status,
    lineage: normalizedLineage,
    readiness: { status: "ready" as const, blockers: [] as string[] },
    sideEffects: "none" as const,
  };
  return result(output, blockers);
}

/** Normalize scheduler facts without claiming, scheduling, publishing, or measuring anything. */
export function normalizeGrowSchedulerFacts(input: GrowSchedulerFactsInput): GrowSchedulerFacts {
  const blockers: string[] = [];
  const deliveryId = id(input.deliveryId ?? input.delivery_id);
  if (deliveryId === null) blockers.push("delivery id is missing or invalid");
  const status = schedulerStatus(input.status, blockers);
  const normalizedLineage = lineage(input.lineage, blockers);
  requireLineage(normalizedLineage, status, blockers);
  const output = {
    deliveryId,
    status,
    lineage: normalizedLineage,
    readiness: { status: "ready" as const, blockers: [] as string[] },
    sideEffects: "none" as const,
  };
  return result(output, blockers);
}

export const normalizeGrowReviewQueueFacts = normalizeGrowQueueFacts;
export const normalizeGrowPublishSchedulerFacts = normalizeGrowSchedulerFacts;
