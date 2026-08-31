import type { ClaimRef } from "../venture/artifacts.js";
import type { ContentRequestInput } from "./content-request.js";

/** The only Venture artifacts that can become ordinary Content sources. */
export const VENTURE_PRIMARY_ARTIFACT_KINDS = ["substack-post", "text-post-note"] as const;
export type VenturePrimaryArtifactKind = (typeof VENTURE_PRIMARY_ARTIFACT_KINDS)[number];

/** The durable fields this boundary reads; optional fields support older artifact rows. */
export interface VentureArtifactForHandoff {
  readonly artifact_id: string;
  readonly phase: number;
  readonly artifact_kind: string;
  readonly title: string;
  readonly body_path: string | null;
  readonly venture_id: string;
  readonly venture_phase: number;
  readonly message_id: string;
  readonly editorial_status: string;
  readonly delivery_status: string;
  readonly delivery_mode: string;
  readonly publishable: boolean;
  readonly claim_refs: readonly ClaimRef[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly origin_type?: string;
}

export interface VentureContentHandoff {
  readonly origin: "venture";
  readonly id: string;
  readonly ventureId: string;
  readonly artifactId: string;
  readonly phase: number;
  readonly artifactKind: VenturePrimaryArtifactKind;
  readonly bodyPath: string;
  readonly body: string;
  readonly claimRefs: readonly ClaimRef[];
  readonly messageId: string;
  readonly approval: { readonly editorialStatus: "approved"; readonly provenance: "muxin-editorial-approval" };
  readonly descriptor: string;
  readonly originalInput: string;
}

function required(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value;
}

export function createVentureContentHandoff(input: {
  readonly artifact: VentureArtifactForHandoff;
  /** Body read from the artifact's declared body_path by the store boundary. */
  readonly body: string;
  /** Optional owner asserted by the caller (the store supplies its slug). */
  readonly expectedVentureId?: string;
}): VentureContentHandoff {
  const artifact = input?.artifact;
  if (!artifact || artifact.origin_type !== undefined && artifact.origin_type !== "venture") throw new Error("artifact does not belong to Venture");
  const artifactId = required(artifact?.artifact_id, "artifact_id");
  if (!VENTURE_PRIMARY_ARTIFACT_KINDS.includes(artifact.artifact_kind as VenturePrimaryArtifactKind)) throw new Error("artifact is not an eligible primary Venture artifact");
  if (artifact.editorial_status !== "approved") throw new Error("artifact must be editorially approved before handoff");
  if (artifact.delivery_status !== "ready") throw new Error("artifact must be ready for delivery before handoff (duplicate or already handed off)");
  if (artifact.body_path === null || artifact.body_path === undefined || artifact.body_path.trim() === "") throw new Error("approved artifact has no body path");
  if (typeof input.body !== "string" || input.body.trim() === "") throw new Error("approved artifact body is required");
  const ventureId = required(artifact.venture_id, "venture_id");
  if (input.expectedVentureId !== undefined && ventureId !== input.expectedVentureId) throw new Error("artifact belongs to a different Venture");
  if (!Number.isInteger(artifact.phase) || artifact.phase < 1 || artifact.phase > 4) throw new Error("artifact phase is invalid");
  if (artifact.venture_phase !== artifact.phase) throw new Error("artifact phase and venture phase disagree");
  return {
    origin: "venture", id: artifactId, ventureId, artifactId, phase: artifact.phase,
    artifactKind: artifact.artifact_kind as VenturePrimaryArtifactKind, bodyPath: artifact.body_path,
    body: input.body, claimRefs: [...(artifact.claim_refs ?? [])], messageId: required(artifact.message_id, "message_id"),
    approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" },
    descriptor: required(artifact.title, "title"), originalInput: input.body,
  };
}

/** Adapt an approved Venture artifact into the ordinary pending Content configuration input. */
export function toContentRequestInput(handoff: VentureContentHandoff): ContentRequestInput {
  if (handoff.origin !== "venture" || handoff.approval.editorialStatus !== "approved") throw new Error("invalid Venture handoff");
  return {
    id: handoff.id, origin: "venture", ventureId: handoff.ventureId,
    descriptor: handoff.descriptor, originalInput: handoff.originalInput,
    ventureSource: {
      artifactId: handoff.artifactId, phase: handoff.phase, artifactKind: handoff.artifactKind,
      messageId: handoff.messageId, bodyPath: handoff.bodyPath, claimRefs: handoff.claimRefs,
      approval: handoff.approval,
    },
  };
}

export const buildVentureContentHandoff = createVentureContentHandoff;
export const ventureHandoffToContentRequestInput = toContentRequestInput;
