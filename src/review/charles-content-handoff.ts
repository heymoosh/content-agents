import type { ContentRequestInput } from "./content-request.js";

export const CHARLES_VENTURE_ID = "charles" as const;
export const CHARLES_IDENTITY = "charles-lord-featherbottom" as const;
export const CHARLES_OUTPUTS = ["one-liner", "essay", "reply"] as const;
export type CharlesOutput = (typeof CHARLES_OUTPUTS)[number];

export interface CharlesContentHandoffInput {
  readonly id: string;
  readonly thought: string;
  readonly replySource?: string;
  readonly selectedOutputs: readonly string[];
  readonly descriptor: string;
  readonly originalInput: string;
  readonly approvedPostBody: string;
  /** A value here represents an attempted CTA/venture inheritance and is refused unless Charles-owned. */
  readonly inheritedVentureId?: string | null;
}

export interface CharlesContentHandoff extends Omit<CharlesContentHandoffInput, "selectedOutputs" | "inheritedVentureId"> {
  readonly origin: "charles";
  readonly identity: { readonly persona: typeof CHARLES_IDENTITY; readonly ventureId: typeof CHARLES_VENTURE_ID };
  readonly selectedOutputs: readonly CharlesOutput[];
  readonly ctaRestrictions: readonly string[];
}

function required(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value;
}

export function createCharlesContentHandoff(input: CharlesContentHandoffInput): CharlesContentHandoff {
  const id = required(input.id, "id");
  const thought = required(input.thought, "thought");
  const descriptor = required(input.descriptor, "descriptor");
  const originalInput = required(input.originalInput, "originalInput");
  if (input.inheritedVentureId && input.inheritedVentureId !== CHARLES_VENTURE_ID) {
    throw new Error("Charles CTA cannot inherit a different venture");
  }
  if (!Array.isArray(input.selectedOutputs) || input.selectedOutputs.length === 0) throw new Error("at least one Charles output is required");
  const selectedOutputs = [...new Set(input.selectedOutputs)];
  if (selectedOutputs.some((output): output is string => !CHARLES_OUTPUTS.includes(output as CharlesOutput))) throw new Error("unknown Charles output");
  return {
    id, origin: "charles", thought,
    replySource: input.replySource === undefined ? undefined : required(input.replySource, "replySource"),
    selectedOutputs: selectedOutputs as CharlesOutput[], descriptor, originalInput,
    approvedPostBody: required(input.approvedPostBody, "approvedPostBody"),
    identity: { persona: CHARLES_IDENTITY, ventureId: CHARLES_VENTURE_ID },
    ctaRestrictions: ["Use Charles-specific lead magnets only; never inherit Fiction, Venture, or Human Inference CTAs."],
  };
}

export function toCharlesContentRequestInput(handoff: CharlesContentHandoff): ContentRequestInput {
  if (handoff.origin !== "charles" || handoff.identity.ventureId !== CHARLES_VENTURE_ID) throw new Error("invalid Charles ownership");
  return {
    id: handoff.id, origin: "charles", descriptor: handoff.descriptor, originalInput: handoff.originalInput, ventureId: CHARLES_VENTURE_ID,
    sourceContext: {
      kind: "charles-approved-post", authoritativeBody: handoff.approvedPostBody,
      personaRef: "charles/config/persona.yaml", identity: CHARLES_IDENTITY,
      restrictions: [
        "Preserve Charles Lord Featherbottom's persona identity and voice.",
        "Useful leaks must remain truthful to charles/config/persona.yaml sources.",
        "Delivery is manual and ready-to-paste only; never publish automatically.",
        "Do not use em dashes.",
        ...handoff.ctaRestrictions,
      ],
    },
  };
}
