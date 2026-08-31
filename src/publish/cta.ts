import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { repoRoot } from "../db/db.js";
import { loadYamlConfig } from "../config/load.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// Shared funnel layer for ALL publishers (typefully text posts + cards image posts), so the CTA
// rules live in exactly one place and the two paths can't drift. config/cta.yaml owns: which url a
// derivative's `cta` resolves to, the per-platform `placement` (where the link goes), and the
// source fallback. WHERE a resolved link is placed is publisher-specific (Typefully can thread a
// reply; the image relays can only inline or omit) — that lives in each publisher, not here.

export interface CtaConfig {
  placement: Record<string, string>;
  fallbackUrl: string | null;
  fallbackLabel: string;
}

const ctaYamlSchema = z
  .object({
    placement: z.record(z.string(), z.string()).optional(),
    source_fallback: z
      .object({
        url: z.string().optional(),
        label: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export function loadCtaConfig(): CtaConfig {
  const cfg = loadYamlConfig(join(repoRoot, "config", "cta.yaml"), ctaYamlSchema, {});
  return {
    placement: cfg.placement ?? {},
    fallbackUrl: cfg.source_fallback?.url ?? null,
    fallbackLabel: cfg.source_fallback?.label ?? "",
  };
}

// --- Content-type CTA routing (Smarter routing, card 6dcaee98) -------------------------------
// A derivative is classified by CONTENT TYPE (frontmatter `content_type`, an array — possibly
// more than one type applies), not pillar. config/content-types.yaml carries each type's
// documented primary + (optional) secondary CTA text. This lives in code (not just skill
// judgment, like the old pillar `targets:` block) so the routing table is one source of truth.
//
// Three destinations: `source` (the essay/Substack link), `project` (a PER-POST url read from the
// derivative's OWN `project_url` frontmatter — only ever set when genuinely relevant to that post,
// never just because the content type matched), and `work_with_me` (a fixed config-level url —
// Muxin's LinkedIn profile, standing in for the not-yet-built "work with me" landing-page
// destination). See config/content-types.yaml's header comment.

export type CtaDestination = "source" | "project" | "work_with_me";

export interface ContentTypeCtaEntry {
  text: string;
  destination: CtaDestination;
}

export interface ContentTypeDef {
  primary: ContentTypeCtaEntry;
  secondary?: ContentTypeCtaEntry;
}

export interface ContentTypesConfig {
  types: Record<string, ContentTypeDef>;
  workWithMeUrl: string | null;
}

const ctaEntrySchema = z.object({
  text: z.string(),
  destination: z.enum(["source", "project", "work_with_me"]),
});

const contentTypeDefSchema = z.object({ primary: ctaEntrySchema, secondary: ctaEntrySchema.optional() });

const contentTypesYamlSchema = z
  .object({
    types: z.record(z.string(), contentTypeDefSchema).optional(),
    work_with_me_url: z.string().optional(),
  })
  .passthrough();

export function loadContentTypesConfig(): ContentTypesConfig {
  const cfg = loadYamlConfig(join(repoRoot, "config", "content-types.yaml"), contentTypesYamlSchema, {});
  return { types: cfg.types ?? {}, workWithMeUrl: cfg.work_with_me_url ?? null };
}

export interface ResolvedCta {
  url: string;
  label: string;
}

// The one source/fallback resolution both CTA paths (resolveEntryUrl's `source` destination and
// resolveCta's `source` value) share: a source-style link is the derivative's own canonical_url,
// else the configured homepage/fallback. `usedFallback` is the raw "canonical was absent" signal
// -- callers decide whether a null fallback still counts as a fallback (resolveCta narrows it;
// resolveEntryUrl uses it as-is).
function resolveSourceUrl(canonicalUrl: string | null, cfg: CtaConfig): { url: string | null; usedFallback: boolean } {
  return { url: canonicalUrl ?? cfg.fallbackUrl, usedFallback: canonicalUrl == null };
}

// A `source` destination resolves exactly like resolveCta's `source` case (the essay's own
// canonical_url, else the configured homepage/fallback). A `project` destination resolves ONLY to
// this derivative's own `project_url` frontmatter value; a missing project_url means "omit this
// CTA," never a fallback to the essay link (that would mislabel the essay as "the project," and
// wouldn't serve a work-with-me ask anyway even when the essay IS on-topic). A `work_with_me`
// destination resolves to the fixed `workWithMeUrl` from config/content-types.yaml — always
// available, never a fallback.
function resolveEntryUrl(
  entry: ContentTypeCtaEntry,
  projectUrl: string | null,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  workWithMeUrl: string | null
): { url: string | null; usedFallback: boolean } {
  if (entry.destination === "project") {
    return { url: projectUrl && projectUrl.trim() ? projectUrl.trim() : null, usedFallback: false };
  }
  if (entry.destination === "work_with_me") {
    return { url: workWithMeUrl, usedFallback: false };
  }
  return resolveSourceUrl(canonicalUrl, cfg);
}

function resolveOneContentType(
  typeKey: string,
  ctCfg: ContentTypesConfig,
  cfg: CtaConfig,
  canonicalUrl: string | null,
  projectUrl: string | null,
  workWithMeLabelOverride: string | null
): { ctas: ResolvedCta[]; usedFallback: boolean } {
  const def = ctCfg.types[typeKey];
  if (!def) {
    console.warn(`  ↳ warning: content_type "${typeKey}" not found in config/content-types.yaml — no CTA for it`);
    return { ctas: [], usedFallback: false };
  }
  const entries = def.secondary ? [def.primary, def.secondary] : [def.primary];
  const resolved: ResolvedCta[] = [];
  let usedFallback = false;
  for (const e of entries) {
    const { url, usedFallback: uf } = resolveEntryUrl(e, projectUrl, canonicalUrl, cfg, ctCfg.workWithMeUrl);
    if (url) {
      // A per-post cta_label overrides ONLY the work_with_me-destination line's text (card
      // d2746598, Muxin DECISION 2026-07-14/15: tie source topic to a TACTICAL, immediately-usable
      // CTA on the 4 "connect for work" content types, instead of the generic canned "Connect on
      // LinkedIn" every post got before). source/project entries keep their own config text
      // unconditionally -- this override is scoped to the work-with-me ask specifically, not a
      // general per-post label override for every stacked CTA line.
      const label = e.destination === "work_with_me" && workWithMeLabelOverride ? workWithMeLabelOverride : e.text;
      resolved.push({ url, label });
      if (uf) usedFallback = true;
    }
  }
  return { ctas: resolved, usedFallback };
}

// Resolve every content type a derivative was classified as (frontmatter `content_type`, a string
// or array of strings) into its CTA lines, stacking ALL matched types' CTAs — never picking one
// winner when a piece plausibly fits more than one type. Empty/missing `content_type` resolves to
// no CTAs (the caller's job to fall back to the plain `cta` path). `project` entries resolve from
// this derivative's own `project_url` frontmatter (per-post, not shared config). An optional
// `cta_label` frontmatter value (the same field the explicit-`cta` override path already reads)
// overrides the work_with_me entry's text specifically -- omitted, behavior is unchanged from
// before this card (the generic config text from content-types.yaml).
export function resolveContentTypeCtas(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  ctCfg: ContentTypesConfig
): { ctas: ResolvedCta[]; usedFallback: boolean } {
  const workWithMeLabelOverride = typeof fm.cta_label === "string" && fm.cta_label.trim() ? fm.cta_label.trim() : null;
  const raw = fm.content_type;
  const types = Array.isArray(raw)
    ? raw.filter((t): t is string => typeof t === "string")
    : typeof raw === "string" && raw.trim()
      ? [raw.trim()]
      : [];
  const projectUrl = typeof fm.project_url === "string" ? fm.project_url.trim() || null : null;
  const results = types.map((t) =>
    resolveOneContentType(t, ctCfg, cfg, canonicalUrl, projectUrl, workWithMeLabelOverride)
  );
  return {
    ctas: results.flatMap((r) => r.ctas),
    usedFallback: results.some((r) => r.usedFallback),
  };
}

// The top-level entry point publishers call: an explicit frontmatter `cta` (source | literal url |
// none) still wins, exactly as before (backward compatible with notes/civic-tech/etc. overrides).
// Only when there's no explicit `cta` does a `content_type` classification drive the CTA(s) — and
// then it can resolve to 0, 1, or several stacked lines instead of exactly one. `usedFallback`
// mirrors resolveCta's diagnostic flag either way, so callers can log the same "no canonical_url"
// note regardless of which path resolved the link.
export function resolveCtaLines(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  sourceKind: string,
  ctCfg: ContentTypesConfig
): { ctas: ResolvedCta[]; usedFallback: boolean } {
  const rawCta = typeof fm.cta === "string" ? fm.cta.trim() : "";
  if (sourceKind === "substack-note" && (!rawCta || rawCta.toLowerCase() === "source")) {
    return { ctas: [], usedFallback: false };
  }
  if (rawCta) {
    const { url, label, usedFallback } = resolveCta(fm, canonicalUrl, cfg, sourceKind);
    return { ctas: url ? [{ url, label }] : [], usedFallback };
  }
  // POSSE default: when a real published source exists, every derivative points back to it.
  // Content-type lead routing must never displace the essay or chapter that produced the
  // post. A deliberate literal/none override above remains the only stronger instruction.
  if (canonicalUrl) {
    const { url, label, usedFallback } = resolveCta({ cta: "source" }, canonicalUrl, cfg, sourceKind);
    return { ctas: url ? [{ url, label }] : [], usedFallback };
  }
  const promotionalCtaApproved = fm.cta_reviewed === true && fm.cta_fit === "high" && fm.cta_value === "high";
  if (promotionalCtaApproved) {
    const viaContentType = resolveContentTypeCtas(fm, canonicalUrl, cfg, ctCfg);
    if (viaContentType.ctas.length > 0) return viaContentType;
  }
  // No published source and no reviewed high-fit/high-value destination means no forced link.
  // This path never fabricates a lead magnet or substitutes a generic homepage.
  return { ctas: [], usedFallback: false };
}

// First content_type entry (array + primary/secondary order) whose url actually resolves — the
// SAME entry resolveContentTypeCtas would place first in its stacked ctas[]. Reuses resolveEntryUrl
// (the single source of truth for how each destination resolves) rather than re-deriving urls;
// only the SELECTION strategy differs here (first-match, for classification, vs. collect-all).
function firstResolvedContentTypeDestination(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  ctCfg: ContentTypesConfig
): CtaDestination | null {
  const raw = fm.content_type;
  const types = Array.isArray(raw)
    ? raw.filter((t): t is string => typeof t === "string")
    : typeof raw === "string" && raw.trim()
      ? [raw.trim()]
      : [];
  const projectUrl = typeof fm.project_url === "string" ? fm.project_url.trim() || null : null;
  for (const typeKey of types) {
    const def = ctCfg.types[typeKey];
    if (!def) continue;
    const entries = def.secondary ? [def.primary, def.secondary] : [def.primary];
    for (const e of entries) {
      const { url } = resolveEntryUrl(e, projectUrl, canonicalUrl, cfg, ctCfg.workWithMeUrl);
      if (url) return e.destination;
    }
  }
  return null;
}

// The primary CTA destination a published post will actually use — mirrors resolveCtaLines'
// precedence (explicit fm.cta wins, else canonical long-form source, else reviewed content-type routing)
// exactly, by delegating to the same two leaf resolvers (firstResolvedContentTypeDestination /
// resolveCta) rather than re-implementing the branching. Returns null when nothing resolves to a
// url (no CTA was actually placed) or the CTA is a literal override url (not one of the three
// known destinations to bucket it under). Used to persist a post's CTA destination for strategy
// lever E (card d80411bc) — see src/db/tag-source.ts / src/strategy/cta-fit.ts.
export function resolvePrimaryCtaDestination(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  sourceKind: string,
  ctCfg: ContentTypesConfig
): CtaDestination | null {
  const rawCta = typeof fm.cta === "string" ? fm.cta.trim() : "";
  if (!rawCta && canonicalUrl && sourceKind !== "substack-note") return "source";
  if (!rawCta && fm.cta_reviewed === true && fm.cta_fit === "high" && fm.cta_value === "high") {
    const dest = firstResolvedContentTypeDestination(fm, canonicalUrl, cfg, ctCfg);
    if (dest) return dest;
  }
  const { url } = resolveCta(fm, canonicalUrl, cfg, sourceKind);
  if (!url) return null;
  let effectiveCta = rawCta;
  return effectiveCta.toLowerCase() === "source" ? "source" : null;
}

// The source essay's own URL — what `cta: source` derivatives point at. Pasted into source.md
// `canonical_url` (auto-filled when atomized from a live URL). Null until it's a real http(s) url.
export function loadCanonicalUrl(folder: string): string | null {
  try {
    const { fm } = splitFrontmatter(readFileSync(join(folder, "source.md"), "utf8"));
    const u = typeof fm.canonical_url === "string" ? fm.canonical_url.trim() : "";
    return /^https?:\/\//.test(u) ? u : null;
  } catch {
    return null;
  }
}

// The content's `source_kind` from source.md (e.g. "substack-note"). Drives note-specific CTA
// behavior below. Empty string when absent or unreadable.
export function loadSourceKind(folder: string): string {
  try {
    const { fm } = splitFrontmatter(readFileSync(join(folder, "source.md"), "utf8"));
    return typeof fm.source_kind === "string" ? fm.source_kind.trim() : "";
  } catch {
    return "";
  }
}

// Resolve a derivative's CTA to a concrete url + label. Mirrors the funnel rule: none/empty → no
// link; `source` → the essay's canonical_url, falling back to the configured home; any other value
// → a literal url. `usedFallback` lets callers note when `source` fell back to the homepage.
//
// Note-derived content (source_kind: substack-note) never links back to the Note. Empty and
// `cta: source` both resolve to no link. Literal non-source destinations remain explicit overrides.
export function resolveCta(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  sourceKind = ""
): { url: string | null; label: string; usedFallback: boolean } {
  let rawCta = typeof fm.cta === "string" ? fm.cta.trim() : "";
  let label = typeof fm.cta_label === "string" ? fm.cta_label : "";
  // Notes are already complete short-form objects. Empty/source CTAs never link back to a Note.
  if (sourceKind === "substack-note" && (!rawCta || rawCta.toLowerCase() === "source")) {
    return { url: null, label: "", usedFallback: false };
  }
  if (!rawCta || rawCta.toLowerCase() === "none") {
    return { url: null, label, usedFallback: false };
  }
  if (rawCta.toLowerCase() === "source") {
    const { url, usedFallback } = resolveSourceUrl(canonicalUrl, cfg);
    if (!label && cfg.fallbackLabel) label = cfg.fallbackLabel;
    return { url, label, usedFallback: usedFallback && url != null };
  }
  return { url: rawCta, label, usedFallback: false };
}
