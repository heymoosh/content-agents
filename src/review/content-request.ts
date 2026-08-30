/** Pure domain objects for configuring one piece of content. No persistence or generation. */
export const CONTENT_REQUEST_VERSION = "content-request-v1" as const;

export type ContentOrigin = "studio" | "fiction" | "charles" | "venture" | "human-inference";
export type SelectionKind = "treatment" | "media" | "platform";
export type VariantKind = "control" | "treated";

export interface RecommendationEvidence {
  readonly option: string;
  readonly kind: SelectionKind;
  readonly reason: string;
  readonly source: string;
  readonly recommended?: boolean;
}

export interface ContentRequestInput {
  readonly id: string;
  readonly origin: ContentOrigin;
  readonly descriptor: string;
  /** The exact input supplied by the user; this is deliberately not normalized. */
  readonly originalInput: string;
  readonly treatments?: readonly string[];
  readonly media?: readonly string[];
  readonly platforms?: readonly string[];
  readonly recommendationEvidence?: readonly RecommendationEvidence[];
  readonly includeUntreatedControl?: boolean;
  readonly ventureId?: string | null;
}

export interface ContentSelections {
  readonly treatments: string[];
  readonly media: string[];
  readonly platforms: string[];
}

export interface Recommendation {
  readonly option: string;
  readonly evidence: RecommendationEvidence[];
}

export interface VariantIdentity {
  readonly id: string;
  readonly requestId: string;
  readonly kind: VariantKind;
}

export interface ContentVariant {
  readonly identity: VariantIdentity;
  readonly platform: string;
  readonly media: string;
  readonly treatments: string[];
}

export interface ContentRequest {
  readonly kind: "content_request";
  readonly version: typeof CONTENT_REQUEST_VERSION;
  readonly id: string;
  readonly origin: ContentOrigin;
  readonly descriptor: string;
  readonly originalInput: string;
  readonly ventureId: string | null;
  readonly selections: ContentSelections;
  readonly recommendations: {
    readonly treatments: Recommendation[];
    readonly media: Recommendation[];
    readonly platforms: Recommendation[];
  };
  readonly control: { readonly enabled: boolean };
  readonly variants: ContentVariant[];
}

export interface LeadMagnet {
  readonly id: string;
  readonly name: string;
  readonly origin: ContentOrigin;
  readonly ventureId?: string | null;
}

export interface ResolvedContentCta {
  readonly leadMagnetId: string;
  readonly requestId: string;
  readonly origin: ContentOrigin;
  readonly ventureId: string | null;
}

function required(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value;
}

const ORIGINS = new Set<ContentOrigin>(["studio", "fiction", "charles", "venture", "human-inference"]);

function selections(value: readonly string[] | undefined, field: string, fallback: readonly string[] = []): string[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return [...new Set(value.map((item, index) => required(item, `${field}[${index}]`)))];
}

function recommendations(evidence: readonly RecommendationEvidence[], kind: SelectionKind): Recommendation[] {
  const grouped = new Map<string, RecommendationEvidence[]>();
  for (const item of evidence) {
    if (item.kind !== kind || item.recommended !== true) continue;
    const option = required(item.option, "recommendation option");
    const reason = required(item.reason, "recommendation reason");
    const source = required(item.source, "recommendation source");
    const entries = grouped.get(option) ?? [];
    entries.push({ ...item, option, reason, source });
    grouped.set(option, entries);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([option, entries]) => ({ option, evidence: entries }));
}

function variantId(kind: VariantKind, ...parts: string[]): string {
  return [kind, ...parts.map((part) => Buffer.from(part, "utf8").toString("base64url"))].join("-");
}

export function buildContentRequest(input: ContentRequestInput): ContentRequest {
  const id = required(input.id, "id");
  if (!ORIGINS.has(input.origin)) throw new Error("origin is unknown");
  const descriptor = required(input.descriptor, "descriptor");
  // Do not trim this field: verbatim preservation is part of the domain contract.
  if (typeof input.originalInput !== "string" || input.originalInput.length === 0) throw new Error("originalInput is required");
  const evidence = input.recommendationEvidence ?? [];
  const recs = {
    treatments: recommendations(evidence, "treatment"),
    media: recommendations(evidence, "media"),
    platforms: recommendations(evidence, "platform"),
  };
  // Omitted selections use evidence-backed recommendations. Supplied selections are
  // authoritative, including an explicit empty array (the user may deselect everything).
  const selected = {
    treatments: selections(input.treatments, "treatments", recs.treatments.map((item) => item.option)),
    media: selections(input.media, "media", recs.media.map((item) => item.option)),
    platforms: selections(input.platforms, "platforms", recs.platforms.map((item) => item.option)),
  };
  const controlEnabled = input.includeUntreatedControl !== false;
  const variants: ContentVariant[] = [];
  if (controlEnabled) {
    for (const platform of selected.platforms) for (const media of selected.media.length ? selected.media : ["none"]) {
      variants.push({ identity: { id: variantId("control", platform, media), requestId: id, kind: "control" }, platform, media, treatments: [] });
    }
  }
  for (const platform of selected.platforms) for (const media of selected.media.length ? selected.media : ["none"]) for (const treatment of selected.treatments) {
    variants.push({ identity: { id: variantId("treated", platform, media, treatment), requestId: id, kind: "treated" }, platform, media, treatments: [treatment] });
  }
  return {
    kind: "content_request", version: CONTENT_REQUEST_VERSION, id, origin: input.origin, descriptor, originalInput: input.originalInput,
    ventureId: input.ventureId ?? null, selections: selected, recommendations: recs,
    control: { enabled: controlEnabled }, variants,
  };
}

export function resolveContentCta(request: ContentRequest, candidates: readonly LeadMagnet[]): ResolvedContentCta {
  if ((request.origin === "venture" || request.origin === "fiction") && !request.ventureId) {
    throw new Error("CTA mapping is missing a venture ownership mapping");
  }
  const matches = candidates.filter((candidate) => candidate.origin === request.origin && (candidate.ventureId ?? null) === request.ventureId);
  if (matches.length === 0) throw new Error("CTA mapping is missing or belongs to a different origin/venture");
  if (matches.length !== 1) throw new Error("CTA mapping is ambiguous");
  return { leadMagnetId: matches[0].id, requestId: request.id, origin: request.origin, ventureId: request.ventureId };
}

export const createContentRequest = buildContentRequest;
export const resolveCta = resolveContentCta;
