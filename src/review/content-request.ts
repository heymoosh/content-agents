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

export interface VentureContentSource {
  readonly artifactId: string;
  readonly phase: number;
  readonly artifactKind: "substack-post" | "text-post-note";
  readonly messageId: string;
  readonly bodyPath: string;
  readonly claimRefs: readonly { readonly claim: string; readonly ref: string }[];
  readonly approval: { readonly editorialStatus: "approved"; readonly provenance: "muxin-editorial-approval" };
}

export interface FictionSourceContext {
  readonly kind: "fiction-approved-promotion";
  readonly authoritativeBody: string;
  readonly series: { readonly id: string; readonly title: string };
  readonly chapter: { readonly number: number; readonly title: string };
  readonly sourcePassages: readonly { readonly ref: string; readonly text: string; readonly locked: true }[];
  readonly restrictions: { readonly canon: readonly string[]; readonly provenance: readonly string[] };
}

export interface CharlesSourceContext {
  readonly kind: "charles-approved-post";
  readonly authoritativeBody: string;
  readonly personaRef: "charles/config/persona.yaml";
  readonly identity: "charles-lord-featherbottom";
  readonly restrictions: readonly string[];
}

export type ContentSourceContext = FictionSourceContext | CharlesSourceContext;

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
  readonly ventureSource?: VentureContentSource | null;
  readonly sourceProvenance?: ContentSourceProvenance | null;
  readonly sourceContext?: ContentSourceContext | null;
  /** Server-owned experiment lineage. Plan approval authorizes drafting, never copy approval. */
  readonly experiment?: ContentExperimentContextInput | null;
}

export interface ContentExperimentContextInput {
  readonly id: string;
  readonly recommendationId: string;
  readonly planProposalDigest: string;
  readonly planDecisionDigest: string;
  readonly planApprovedAt: string;
  readonly hypothesis: string;
  readonly controlledVariable: string;
  readonly variablesByVariant: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface ContentExperimentContext extends ContentExperimentContextInput {
  readonly planApprovedBy: "muxin";
  readonly copyApproval: "pending-in-content";
}

export interface ContentSourceProvenance {
  readonly kind: "source" | "approved-cut";
  readonly sourceLines: readonly (number | string)[];
  readonly lens?: string;
  readonly canonicalUrl?: string;
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
  readonly ventureSource: VentureContentSource | null;
  readonly sourceProvenance: ContentSourceProvenance | null;
  readonly sourceContext: ContentSourceContext | null;
  readonly experiment: ContentExperimentContext | null;
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

function ventureSource(value: VentureContentSource | null | undefined): VentureContentSource | null {
  if (value == null) return null;
  if (!Number.isInteger(value.phase) || value.phase < 1 || value.phase > 4) throw new Error("venture source phase is invalid");
  if (!["substack-post", "text-post-note"].includes(value.artifactKind)) throw new Error("venture source artifact kind is invalid");
  if (value.approval?.editorialStatus !== "approved" || value.approval?.provenance !== "muxin-editorial-approval") throw new Error("venture source approval provenance is invalid");
  return {
    artifactId: required(value.artifactId, "venture source artifactId"), phase: value.phase,
    artifactKind: value.artifactKind, messageId: required(value.messageId, "venture source messageId"),
    bodyPath: required(value.bodyPath, "venture source bodyPath"),
    claimRefs: (value.claimRefs ?? []).map((item, index) => ({
      claim: required(item.claim, `venture source claimRefs[${index}].claim`),
      ref: required(item.ref, `venture source claimRefs[${index}].ref`),
    })),
    approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" },
  };
}

function sourceProvenance(value: ContentSourceProvenance | null | undefined): ContentSourceProvenance | null {
  if (value == null) return null;
  if (value.kind !== "source" && value.kind !== "approved-cut") throw new Error("source provenance kind is invalid");
  if (!Array.isArray(value.sourceLines) || value.sourceLines.length === 0) throw new Error("source provenance requires source_lines");
  const sourceLines = value.sourceLines.map((ref, index) => {
    if (typeof ref === "number" && Number.isInteger(ref) && ref > 0) return ref;
    if (typeof ref === "string" && /^\d+-\d+$/.test(ref)) return ref;
    throw new Error(`source provenance source_lines[${index}] is invalid`);
  });
  const lens = value.lens?.trim();
  const canonicalUrl = value.canonicalUrl?.trim();
  if (canonicalUrl) {
    let parsed: URL;
    try { parsed = new URL(canonicalUrl); } catch { throw new Error("source provenance canonicalUrl is invalid"); }
    if (parsed.protocol !== "https:") throw new Error("source provenance canonicalUrl must use https");
  }
  if (value.kind === "approved-cut" && !lens) throw new Error("approved-cut provenance requires a lens");
  if (value.kind === "source" && lens) throw new Error("source provenance cannot name a cut lens");
  return { kind: value.kind, sourceLines, ...(lens ? { lens } : {}), ...(canonicalUrl ? { canonicalUrl } : {}) };
}

function sourceContext(value: ContentSourceContext | null | undefined, origin: ContentOrigin): ContentSourceContext | null {
  if (value == null) return null;
  const authoritativeBody = required(value.authoritativeBody, "source context authoritativeBody");
  if (value.kind === "fiction-approved-promotion") {
    if (origin !== "fiction") throw new Error("Fiction source context requires a Fiction origin");
    if (!Number.isInteger(value.chapter?.number) || value.chapter.number < 1) throw new Error("source context chapter.number is invalid");
    if (!value.sourcePassages?.length) throw new Error("fiction source context passages are required");
    return {
      kind: value.kind, authoritativeBody,
      series: { id: required(value.series?.id, "source context series.id"), title: required(value.series?.title, "source context series.title") },
      chapter: { number: value.chapter.number, title: required(value.chapter.title, "source context chapter.title") },
      sourcePassages: value.sourcePassages.map((item, index) => {
        if (item.locked !== true) throw new Error(`source context passage[${index}] must be locked`);
        return { ref: required(item.ref, `source context passage[${index}].ref`), text: required(item.text, `source context passage[${index}].text`), locked: true as const };
      }),
      restrictions: { canon: selections(value.restrictions?.canon, "source context canon"), provenance: selections(value.restrictions?.provenance, "source context provenance") },
    };
  }
  if (value.kind === "charles-approved-post") {
    if (origin !== "charles") throw new Error("Charles source context requires a Charles origin");
    if (value.personaRef !== "charles/config/persona.yaml" || value.identity !== "charles-lord-featherbottom") throw new Error("Charles source identity is invalid");
    const restrictions = selections(value.restrictions, "source context restrictions");
    if (!restrictions.length) throw new Error("Charles source restrictions are required");
    return { kind: value.kind, authoritativeBody, personaRef: value.personaRef, identity: value.identity, restrictions };
  }
  throw new Error("source context kind is invalid");
}

function experimentContext(value: ContentExperimentContextInput | null | undefined, variants: readonly ContentVariant[]): ContentExperimentContext | null {
  if (value == null) return null;
  const digest = (item: unknown, field: string): string => {
    const normalized = required(item, field);
    if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) throw new Error(`${field} is invalid`);
    return normalized;
  };
  const planApprovedAt = required(value.planApprovedAt, "experiment planApprovedAt");
  if (Number.isNaN(Date.parse(planApprovedAt))) throw new Error("experiment planApprovedAt is invalid");
  const variantIds = variants.map((variant) => variant.identity.id).sort();
  const suppliedIds = Object.keys(value.variablesByVariant ?? {}).sort();
  if (JSON.stringify(variantIds) !== JSON.stringify(suppliedIds)) throw new Error("experiment variables must cover every configured variant exactly");
  const variablesByVariant = Object.fromEntries(variantIds.map((variantId) => {
    const source = value.variablesByVariant[variantId];
    if (!source || typeof source !== "object" || Array.isArray(source) || Object.keys(source).length === 0) throw new Error(`experiment variables for ${variantId} must not be empty`);
    return [variantId, Object.fromEntries(Object.entries(source).sort(([a], [b]) => a.localeCompare(b)).map(([name, option]) => [required(name, `experiment variable name for ${variantId}`), required(option, `experiment variable ${name} for ${variantId}`)]))];
  }));
  return {
    id: required(value.id, "experiment id"),
    recommendationId: required(value.recommendationId, "experiment recommendationId"),
    planProposalDigest: digest(value.planProposalDigest, "experiment planProposalDigest"),
    planDecisionDigest: digest(value.planDecisionDigest, "experiment planDecisionDigest"),
    planApprovedAt,
    hypothesis: required(value.hypothesis, "experiment hypothesis"),
    controlledVariable: required(value.controlledVariable, "experiment controlledVariable"),
    variablesByVariant,
    planApprovedBy: "muxin",
    copyApproval: "pending-in-content",
  };
}

export function buildContentRequest(input: ContentRequestInput): ContentRequest {
  const id = required(input.id, "id");
  if (!ORIGINS.has(input.origin)) throw new Error("origin is unknown");
  if (input.ventureSource != null && input.origin !== "venture") throw new Error("Venture source provenance requires a Venture origin");
  if (input.ventureSource != null && (typeof input.ventureId !== "string" || input.ventureId.trim() === "")) throw new Error("Venture source provenance requires a ventureId");
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
    ventureId: input.ventureId ?? null, ventureSource: ventureSource(input.ventureSource), sourceProvenance: sourceProvenance(input.sourceProvenance), sourceContext: sourceContext(input.sourceContext, input.origin), experiment: experimentContext(input.experiment, variants), selections: selected, recommendations: recs,
    control: { enabled: controlEnabled }, variants,
  };
}

/** A configuration save may edit choices only; source identity/provenance stays server-owned. */
export function mergeContentConfiguration(existing: ContentRequest, incoming: ContentRequestInput): ContentRequestInput {
  return {
    id: existing.id,
    origin: existing.origin,
    descriptor: existing.descriptor,
    originalInput: existing.originalInput,
    ventureId: existing.ventureId,
    ventureSource: existing.ventureSource,
    sourceProvenance: existing.sourceProvenance,
    sourceContext: existing.sourceContext,
    experiment: existing.experiment,
    treatments: incoming.treatments,
    media: incoming.media,
    platforms: incoming.platforms,
    recommendationEvidence: incoming.recommendationEvidence,
    includeUntreatedControl: incoming.includeUntreatedControl,
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
