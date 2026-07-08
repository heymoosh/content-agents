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
// Two destinations only: `source` (the essay/Substack link) and `project` (a PER-POST url read
// from the derivative's OWN `project_url` frontmatter — no config-level url, no shared landing
// page). "Work with me" is out of scope for this release (deferred to card ae602c84) — see
// config/content-types.yaml's header comment.

export type CtaDestination = "source" | "project";

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
}

const ctaEntrySchema = z.object({
  text: z.string(),
  destination: z.enum(["source", "project"]),
});

const contentTypeDefSchema = z.object({ primary: ctaEntrySchema, secondary: ctaEntrySchema.optional() });

const contentTypesYamlSchema = z
  .object({
    types: z.record(z.string(), contentTypeDefSchema).optional(),
  })
  .passthrough();

export function loadContentTypesConfig(): ContentTypesConfig {
  const cfg = loadYamlConfig(join(repoRoot, "config", "content-types.yaml"), contentTypesYamlSchema, {});
  return { types: cfg.types ?? {} };
}

export interface ResolvedCta {
  url: string;
  label: string;
}

// A `source` destination resolves exactly like resolveCta's `source` case (the essay's own
// canonical_url, else the configured homepage/fallback). A `project` destination resolves ONLY to
// this derivative's own `project_url` frontmatter value; a missing project_url means "omit this
// CTA," never a fallback to the essay link (that would mislabel the essay as "the project").
function resolveEntryUrl(
  entry: ContentTypeCtaEntry,
  projectUrl: string | null,
  canonicalUrl: string | null,
  cfg: CtaConfig
): { url: string | null; usedFallback: boolean } {
  if (entry.destination === "project") {
    return { url: projectUrl && projectUrl.trim() ? projectUrl.trim() : null, usedFallback: false };
  }
  return { url: canonicalUrl ?? cfg.fallbackUrl, usedFallback: canonicalUrl == null };
}

function resolveOneContentType(
  typeKey: string,
  ctCfg: ContentTypesConfig,
  cfg: CtaConfig,
  canonicalUrl: string | null,
  projectUrl: string | null
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
    const { url, usedFallback: uf } = resolveEntryUrl(e, projectUrl, canonicalUrl, cfg);
    if (url) {
      resolved.push({ url, label: e.text });
      if (uf) usedFallback = true;
    }
  }
  return { ctas: resolved, usedFallback };
}

// Resolve every content type a derivative was classified as (frontmatter `content_type`, a string
// or array of strings) into its CTA lines, stacking ALL matched types' CTAs — never picking one
// winner when a piece plausibly fits more than one type. Empty/missing `content_type` resolves to
// no CTAs (the caller's job to fall back to the plain `cta` path). `project` entries resolve from
// this derivative's own `project_url` frontmatter (per-post, not shared config).
export function resolveContentTypeCtas(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  ctCfg: ContentTypesConfig
): { ctas: ResolvedCta[]; usedFallback: boolean } {
  const raw = fm.content_type;
  const types = Array.isArray(raw)
    ? raw.filter((t): t is string => typeof t === "string")
    : typeof raw === "string" && raw.trim()
      ? [raw.trim()]
      : [];
  const projectUrl = typeof fm.project_url === "string" ? fm.project_url.trim() || null : null;
  const results = types.map((t) => resolveOneContentType(t, ctCfg, cfg, canonicalUrl, projectUrl));
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
  if (!rawCta) {
    const viaContentType = resolveContentTypeCtas(fm, canonicalUrl, cfg, ctCfg);
    if (viaContentType.ctas.length > 0) return viaContentType;
  }
  const { url, label, usedFallback } = resolveCta(fm, canonicalUrl, cfg, sourceKind);
  return { ctas: url ? [{ url, label }] : [], usedFallback };
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
// Note-derived content (source_kind: substack-note) defaults to `source`: a Substack Note is itself
// the destination, so a note card/post should link back to the original note. An empty `cta` on a
// note resolves to the note's canonical_url instead of "no link". An explicit `cta: none` or a
// literal url on the derivative still wins — only the EMPTY default is upgraded, and only for notes,
// so non-note content (essays etc.) is completely unaffected.
export function resolveCta(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig,
  sourceKind = ""
): { url: string | null; label: string; usedFallback: boolean } {
  let rawCta = typeof fm.cta === "string" ? fm.cta.trim() : "";
  let label = typeof fm.cta_label === "string" ? fm.cta_label : "";
  // Notes link to the original note by default: treat an empty cta as `source`.
  if (sourceKind === "substack-note" && !rawCta) rawCta = "source";
  if (!rawCta || rawCta.toLowerCase() === "none") {
    return { url: null, label, usedFallback: false };
  }
  if (rawCta.toLowerCase() === "source") {
    if (canonicalUrl) return { url: canonicalUrl, label, usedFallback: false };
    if (cfg.fallbackLabel) label = cfg.fallbackLabel;
    return { url: cfg.fallbackUrl, label, usedFallback: cfg.fallbackUrl != null };
  }
  return { url: rawCta, label, usedFallback: false };
}

