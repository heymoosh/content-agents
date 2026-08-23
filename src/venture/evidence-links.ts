import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { readArtifacts, type VentureArtifact } from "./artifacts.js";
import { findCanonEvent } from "./canon.js";
import { evidenceLinksPath, ventureDir } from "./paths.js";

// venture/<slug>/evidence-links.jsonl -- this venture's links into the account-level
// research_observations store (docs/venture-schema-contract.md §5.4a), carrying every judgment
// that is relative to ONE venture: evidence_role, unknown_ids, target_audience_fit, which
// classification this venture reads, and inclusion/exclusion (§5.4b).
//
// The whole point of the split: the same March Note reply is `historical_prior` to a venture that
// kicked off in August and `current_organic` to one that kicked off in February. One value cannot
// be right for both, so the role lives on the link and is DERIVED -- never stamped by whatever
// collected the row, and never settable by a caller (§5.4b; v5 handoff §9.6).
//
// Gitignored (.gitignore line 7), same privacy posture as responses.jsonl: an observation's text
// and respondent hash never reach git.

export type EvidenceRole = "historical_prior" | "current_probe" | "current_organic";

export type EvidenceRoleRule =
  | "published_before_kickoff"
  | "matches_venture_probe"
  | "published_after_kickoff_not_a_probe";

export interface EvidenceRoleBasis {
  rule: EvidenceRoleRule;
  kickoff_at: string;
  published_at: string;
  probe_id: string | null;
}

/** A role plus WHY it got that role. §5.4b requires the basis so the call is auditable, and
 *  docs/prototype-port-rules.md Rule 3 requires it so no screen can ever render the role bare. */
export interface DerivedEvidenceRole {
  role: EvidenceRole;
  basis: EvidenceRoleBasis;
}

/** §5.4b: "An observation whose role cannot be determined is **not** silently defaulted." A
 *  missing kickoff or an undatable observation produces this, and the link is written excluded. */
export interface UndeterminedEvidenceRole {
  role: null;
  basis: null;
  reason: string;
}

export type EvidenceRoleVerdict = DerivedEvidenceRole | UndeterminedEvidenceRole;

export interface DeriveEvidenceRoleInput {
  /** The venture's kickoff timestamp, from canon.md. null when the venture has no kickoff event. */
  kickoffAt: string | null;
  publishedAt: string | null;
  /** §5.4b: a source with no meaningful publication time (a DM) falls back to observed_at. */
  observedAt: string | null;
  /** Non-null iff the observation's content item resolves to one of THIS venture's Phase 1 probes. */
  probeId: string | null;
}

function parsed(at: string | null): number | null {
  if (!at) return null;
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? null : ms;
}

// The rule, evaluated in §5.4b's order. Pure and file-I/O-free so the ordering itself is directly
// testable -- the ordering is load-bearing: rule 1 is unconditional and checked FIRST, because
// nothing published before a venture existed can be that venture's controlled probe no matter what
// else it matches.
export function deriveEvidenceRole(input: DeriveEvidenceRoleInput): EvidenceRoleVerdict {
  const kickoffMs = parsed(input.kickoffAt);
  if (kickoffMs === null) {
    return {
      role: null,
      basis: null,
      reason: input.kickoffAt
        ? `venture kickoff timestamp "${input.kickoffAt}" is not a readable date`
        : "venture has no kickoff event in canon.md, so nothing can be dated relative to it",
    };
  }
  // published_at first, observed_at only as the documented fallback -- never the other way round.
  const effectiveAt = input.publishedAt ?? input.observedAt;
  const effectiveMs = parsed(effectiveAt);
  if (effectiveMs === null || effectiveAt === null) {
    return {
      role: null,
      basis: null,
      reason: effectiveAt
        ? `observation timestamp "${effectiveAt}" is not a readable date`
        : "observation has neither a published_at nor an observed_at to date it by",
    };
  }

  if (effectiveMs < kickoffMs) {
    return {
      role: "historical_prior",
      basis: {
        rule: "published_before_kickoff",
        kickoff_at: input.kickoffAt!,
        published_at: effectiveAt,
        probe_id: null,
      },
    };
  }
  if (input.probeId) {
    return {
      role: "current_probe",
      basis: {
        rule: "matches_venture_probe",
        kickoff_at: input.kickoffAt!,
        published_at: effectiveAt,
        probe_id: input.probeId,
      },
    };
  }
  return {
    role: "current_organic",
    basis: {
      rule: "published_after_kickoff_not_a_probe",
      kickoff_at: input.kickoffAt!,
      published_at: effectiveAt,
      probe_id: null,
    },
  };
}

/**
 * The roles that may clear a gate requiring controlled collection -- Checkpoint 1 and the Phase 3
 * response gate. Deliberately EMPTY, and deliberately written as code rather than left as an
 * absence: `venture/rules.md` §5.6 and §5.4b are explicit that **no** observation of **any** role
 * counts toward either. Checkpoint 1 requires the three Phase 1 posts to be freshly drafted,
 * approved and confirmed live through this venture; the 20/30 response gate belongs exclusively to
 * responses.jsonl. Letting an old Notes reply shortcut either would defeat the point of both.
 */
export const OBSERVATION_ROLES_CLEARING_CONTROLLED_GATES: readonly EvidenceRole[] = [];

export function observationMayClearControlledGate(role: EvidenceRole): boolean {
  return OBSERVATION_ROLES_CLEARING_CONTROLLED_GATES.includes(role);
}

/** The venture's kickoff timestamp from canon.md, the authority (§5.4b names canon.md by name). */
export function ventureKickoffAt(slug: string): string | null {
  return findCanonEvent(slug, `${slug}/kickoff`)?.at ?? null;
}

// §5.4b rule 2 needs to resolve an observation's `content_item_id` to "an artifact belonging to
// this venture whose post_or_probe_id is in this venture's Phase 1 probe set". In this repo a probe
// is a Phase 1 artifact carrying a non-null `probe_id`, and the identifier a captured observation
// carries back varies by surface, so every identifier that artifact is known by maps to its probe:
// the probe id itself, the artifact id, the message id, and the live URL/reference its delivery
// evidence recorded. Nothing else matches -- an unrecognized content_item_id falls through to
// rule 3 (`current_organic`), which is the correct default for "published during the sprint but
// not one of ours".
export function ventureProbeItemIds(slug: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of readArtifacts(slug)) {
    if (!a.probe_id || a.phase !== 1) continue;
    for (const key of [a.probe_id, a.artifact_id, a.message_id, a.evidence?.value]) {
      if (key) map.set(key, a.probe_id);
    }
  }
  return map;
}

export function resolveVentureProbeId(slug: string, contentItemId: string | null): string | null {
  if (!contentItemId) return null;
  return ventureProbeItemIds(slug).get(contentItemId) ?? null;
}

export type UnknownMappingStatus = "current" | "carried_forward" | "needs_review";
export type TargetAudienceFit = "confirmed" | "uncertain" | "off-target";

export interface EvidenceLink {
  link_id: string;
  venture_slug: string;
  observation_id: string;
  classification_id: string | null;
  evidence_role: EvidenceRole | null;
  evidence_role_basis: EvidenceRoleBasis | null;
  research_plan_version: number;
  unknown_ids: string[];
  unknown_mapping_status: UnknownMappingStatus;
  target_audience_fit: TargetAudienceFit | null;
  included_in_research_read: boolean;
  exclusion_reason: string | null;
  linked_by: "system" | "muxin";
  linked_at: string;
  muxin_reviewed: boolean;
}

export interface WriteEvidenceLinkInput {
  link_id: string;
  observation_id: string;
  classification_id?: string | null;
  /** The observation's own timestamps -- the derivation's inputs, not the role itself. */
  published_at?: string | null;
  observed_at?: string | null;
  content_item_id?: string | null;
  unknown_ids?: string[];
  target_audience_fit?: TargetAudienceFit | null;
  included_in_research_read?: boolean;
  exclusion_reason?: string | null;
  linked_by?: "system" | "muxin";
  muxin_reviewed?: boolean;
}

// docs/venture-schema-contract.md §5.5's `POST …/<slug>/evidence-link`: "`evidence_role` and
// `research_plan_version` are **derived** (§5.4b) and MUST NOT be settable through this mutation --
// a caller-supplied value is rejected, not honored." Rejected loudly rather than quietly dropped,
// so a caller that believes it is declaring a role finds out.
const DERIVED_ONLY_FIELDS = ["evidence_role", "evidence_role_basis", "research_plan_version"] as const;

function rejectDerivedFields(input: WriteEvidenceLinkInput): void {
  const supplied = DERIVED_ONLY_FIELDS.filter((f) => f in (input as unknown as Record<string, unknown>));
  if (supplied.length) {
    throw new Error(
      `${supplied.join(", ")} is derived, not declared -- an evidence link's role comes from the ` +
        `venture's kickoff, the observation's publication time, and this venture's probe set ` +
        `(venture-schema-contract.md §5.4b). Remove it and pass published_at/observed_at/content_item_id instead.`
    );
  }
}

function readLines(slug: string): EvidenceLink[] {
  const path = evidenceLinksPath(slug);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EvidenceLink);
}

// Append-only, folded to the latest line per link_id -- the same event-sourced read
// artifacts.jsonl, decisions.jsonl and responses.jsonl already use.
export function readEvidenceLinks(slug: string): EvidenceLink[] {
  const latest = new Map<string, EvidenceLink>();
  for (const l of readLines(slug)) latest.set(l.link_id, l);
  return [...latest.values()];
}

export function readEvidenceLink(slug: string, linkId: string): EvidenceLink | undefined {
  return readEvidenceLinks(slug).find((l) => l.link_id === linkId);
}

// The plan version a link's unknown_ids were assigned under (§5.4b). Read from this venture's
// phase_1_research_plan artifact, defaulting to 1 when no plan has been drafted yet. Recording it
// is what makes a link interpretable against the plan it was actually made against; the
// `more_probes` reconciliation loop that carries links forward across a plan revision is NOT built
// here (see this file's note in the PR) -- fresh links are `"current"`, which is what §5.4b says a
// link created under the current version is.
export function currentResearchPlanVersion(slug: string, artifacts?: VentureArtifact[]): number {
  const all = artifacts ?? readArtifacts(slug);
  const plan = all.find((a) => a.artifact_kind === "phase_1_research_plan");
  const raw = plan?.fields?.plan_version;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

export function writeEvidenceLink(slug: string, input: WriteEvidenceLinkInput, at: string): EvidenceLink {
  rejectDerivedFields(input);

  const verdict = deriveEvidenceRole({
    kickoffAt: ventureKickoffAt(slug),
    publishedAt: input.published_at ?? null,
    observedAt: input.observed_at ?? null,
    probeId: resolveVentureProbeId(slug, input.content_item_id ?? null),
  });

  // §5.4b: an undetermined role is never silently defaulted. The link is still written -- losing
  // the observation would be worse -- but excluded from the research read and carrying the reason,
  // so it surfaces for Muxin to resolve rather than sitting in the read under a guessed role.
  const callerExclusion = input.exclusion_reason ?? null;
  const included = verdict.role === null ? false : input.included_in_research_read ?? true;
  const exclusionReason =
    verdict.role === null
      ? callerExclusion ?? `evidence_role could not be determined: ${verdict.reason}`
      : included
        ? null
        : callerExclusion ?? "excluded from this venture's research read";

  const link: EvidenceLink = {
    link_id: input.link_id,
    venture_slug: slug,
    observation_id: input.observation_id,
    classification_id: input.classification_id ?? null,
    evidence_role: verdict.role,
    evidence_role_basis: verdict.basis,
    research_plan_version: currentResearchPlanVersion(slug),
    unknown_ids: input.unknown_ids ?? [],
    unknown_mapping_status: "current",
    target_audience_fit: input.target_audience_fit ?? null,
    included_in_research_read: included,
    exclusion_reason: exclusionReason,
    linked_by: input.linked_by ?? "system",
    linked_at: at,
    muxin_reviewed: input.muxin_reviewed ?? false,
  };

  mkdirSync(ventureDir(slug), { recursive: true });
  appendFileSync(evidenceLinksPath(slug), JSON.stringify(link) + "\n");
  return link;
}

// ---------------------------------------------------------------------------
// The artifact side of §9.6: a Phase 1 post's own evidence carries a role too.
// ---------------------------------------------------------------------------

/**
 * The role of the evidence behind one venture artifact, derived by the SAME rule §5.4b applies to
 * an observation. Computed on every read rather than stored on the artifact, so a role can never
 * drift from the facts it was derived from and no caller can declare one (v5 handoff §9.6: "never
 * let a caller declare it").
 *
 * The dating input mirrors §5.4b's published_at -> observed_at fallback: the evidence's
 * `published_at` when the confirming step recorded one (the §9.9 case -- confirming a post Muxin
 * had already published before this venture began), else when the evidence was confirmed, else
 * when the artifact was created. A probe artifact resolves to `current_probe` via its own
 * `probe_id`, which is what "a post this venture drafted, reviewed and published to answer a named
 * unknown" means here.
 */
export function deriveArtifactEvidenceRole(artifact: VentureArtifact, kickoffAt: string | null): EvidenceRoleVerdict {
  return deriveEvidenceRole({
    kickoffAt,
    publishedAt: artifact.evidence?.published_at ?? artifact.evidence?.confirmed_at ?? null,
    observedAt: artifact.created_at ?? null,
    probeId: artifact.probe_id,
  });
}

/** Human-readable basis, for a blocking reason or a later screen. Never renders a role bare. */
export function describeEvidenceRole(verdict: EvidenceRoleVerdict): string {
  if (verdict.role === null) return `evidence role not determined (${verdict.reason})`;
  const b = verdict.basis;
  switch (b.rule) {
    case "published_before_kickoff":
      return `historical: published ${b.published_at}, before this venture kicked off ${b.kickoff_at}`;
    case "matches_venture_probe":
      return `this venture's own probe ${b.probe_id}, published ${b.published_at} after kickoff ${b.kickoff_at}`;
    case "published_after_kickoff_not_a_probe":
      return `published ${b.published_at}, after kickoff ${b.kickoff_at}, but not one of this venture's probes`;
  }
}
