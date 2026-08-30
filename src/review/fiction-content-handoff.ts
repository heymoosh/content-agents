import type { ContentRequestInput } from "./content-request.js";

/** The dedicated ownership boundary for serialized Least of Us fiction. */
export const FICTION_VENTURE_ID = "least-of-us-fiction" as const;

export interface FictionSeriesIdentity {
  readonly id: string;
  readonly title: string;
}

export interface FictionChapterIdentity {
  readonly number: number;
  readonly title: string;
}

export interface LockedSourcePassage {
  /** A stable chapter/line (or equivalent) reference, not an array position. */
  readonly ref: string;
  readonly text: string;
  readonly locked: true;
}

export interface FictionSourcePassageInput {
  readonly ref: string;
  readonly text: string;
  readonly locked: boolean;
}

export interface FictionContentRestrictions {
  readonly canon: readonly string[];
  readonly provenance: readonly string[];
}

export interface FictionContentHandoffInput {
  readonly id: string;
  readonly series: FictionSeriesIdentity;
  readonly chapter: FictionChapterIdentity;
  readonly sourcePassages: readonly FictionSourcePassageInput[];
  readonly restrictions: FictionContentRestrictions;
  readonly suggestedPromotionalObjective: string;
  readonly descriptor: string;
  /** Preserved exactly as supplied, including whitespace and line breaks. */
  readonly originalInput: string;
}

export interface FictionContentHandoff extends Omit<FictionContentHandoffInput, "sourcePassages" | "restrictions"> {
  readonly origin: "fiction";
  readonly sourcePassages: readonly LockedSourcePassage[];
  readonly restrictions: FictionContentRestrictions;
}

function required(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value;
}

function restrictionList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} restrictions are required`);
  return value.map((item, index) => required(item, `${field}[${index}]`));
}

export function createFictionContentHandoff(input: FictionContentHandoffInput): FictionContentHandoff {
  const id = required(input.id, "id");
  const seriesId = required(input.series?.id, "series.id");
  const seriesTitle = required(input.series?.title, "series.title");
  if (!Number.isInteger(input.chapter?.number) || input.chapter.number < 1) throw new Error("chapter.number must be a positive integer");
  const chapterTitle = required(input.chapter?.title, "chapter.title");
  if (!Array.isArray(input.sourcePassages) || input.sourcePassages.length === 0) throw new Error("at least one source passage is required");
  const refs = new Set<string>();
  const sourcePassages = input.sourcePassages.map((passage, index) => {
    const ref = required(passage?.ref, `sourcePassages[${index}].ref`);
    if (refs.has(ref)) throw new Error(`source passage ref must be unique: ${ref}`);
    refs.add(ref);
    const text = required(passage?.text, `sourcePassages[${index}].text`);
    if (passage.locked !== true) throw new Error(`sourcePassages[${index}] must be locked`);
    return { ref, text, locked: true as const };
  });
  const restrictions = {
    canon: restrictionList(input.restrictions?.canon, "canon"),
    provenance: restrictionList(input.restrictions?.provenance, "provenance"),
  };
  return {
    id,
    origin: "fiction",
    series: { id: seriesId, title: seriesTitle },
    chapter: { number: input.chapter.number, title: chapterTitle },
    sourcePassages,
    restrictions,
    suggestedPromotionalObjective: required(input.suggestedPromotionalObjective, "suggestedPromotionalObjective"),
    descriptor: required(input.descriptor, "descriptor"),
    originalInput: required(input.originalInput, "originalInput"),
  };
}

/** Adapts a validated fiction handoff into the ordinary Content configuration step. */
export function toContentRequestInput(handoff: FictionContentHandoff): ContentRequestInput {
  if (handoff.origin !== "fiction") throw new Error("handoff origin must be fiction");
  return {
    id: handoff.id,
    origin: "fiction",
    descriptor: handoff.descriptor,
    originalInput: handoff.originalInput,
    ventureId: FICTION_VENTURE_ID,
  };
}

export const buildFictionContentHandoff = createFictionContentHandoff;
export const fictionHandoffToContentRequestInput = toContentRequestInput;
