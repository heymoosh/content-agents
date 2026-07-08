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
// documented primary + secondary CTA text. Four types' primary needs the not-yet-built landing
// page: until `landing_page_live` flips true, those four ship their secondary alone; the other
// four ship primary + secondary as documented. This lives in code (not just skill judgment, like
// the old pillar `targets:` block) so flipping the flag later updates every already-drafted
// derivative at publish time, with no re-atomize.

export type CtaDestination = "source" | "landing_page" | "work_with_me";

export interface ContentTypeCtaEntry {
  text: string;
  destination: CtaDestination;
  url?: string;
}

export interface ContentTypeDef {
  primary: ContentTypeCtaEntry;
  secondary: ContentTypeCtaEntry;
}

export interface ContentTypesConfig {
  landingPageLive: boolean;
  types: Record<string, ContentTypeDef>;
}

const ctaEntrySchema = z.object({
  text: z.string(),
  destination: z.enum(["source", "landing_page", "work_with_me"]),
  url: z.string().optional(),
});

const contentTypeDefSchema = z.object({ primary: ctaEntrySchema, secondary: ctaEntrySchema });

const contentTypesYamlSchema = z
  .object({
    landing_page_live: z.boolean().optional(),
    types: z.record(z.string(), contentTypeDefSchema).optional(),
  })
  .passthrough();

export function loadContentTypesConfig(): ContentTypesConfig {
  const cfg = loadYamlConfig(join(repoRoot, "config", "content-types.yaml"), contentTypesYamlSchema, {});
  return { landingPageLive: cfg.landing_page_live ?? false, types: cfg.types ?? {} };
}

export interface ResolvedCta {
  url: string;
  label: string;
}

// A `source` destination resolves exactly like resolveCta's `source` case (the essay's own
// canonical_url, else the configured homepage). A `landing_page`/`work_with_me` destination
// resolves to its real `url` once the landing page is live; until then it falls back to the same
// source/homepage link, so a CTA is never a dead end. `usedFallback` mirrors resolveCta's own
// flag: true whenever this entry needed canonicalUrl and didn't have one.
function resolveEntryUrl(
  entry: ContentTypeCtaEntry,
  landingPageLive: boolean,
  canonicalUrl: string | null,
  cfg: CtaConfig
): { url: string | null; usedFallback: boolean } {
  if (entry.destination !== "source" && landingPageLive && entry.url) {
    return { url: entry.url, usedFallback: false };
  }
  return { url: canonicalUrl ?? cfg.fallbackUrl, usedFallback: canonicalUrl == null };
}

function resolveOneContentType(
  typeKey: string,
  ctCfg: ContentTypesConfig,
  cfg: CtaConfig,
  canonicalUrl: string | null
): { ctas: ResolvedCta[]; usedFallback: boolean } {
  const def = ctCfg.types[typeKey];
  if (!def) {
    console.warn(`  ↳ warning: content_type "${typeKey}" not found in config/content-types.yaml — no CTA for it`);
    return { ctas: [], usedFallback: false };
  }
  const primaryNeedsLandingPage = def.primary.destination !== "source";
  const entries =
    primaryNeedsLandingPage && !ctCfg.landingPageLive ? [def.secondary] : [def.primary, def.secondary];
  const resolved: ResolvedCta[] = [];
  let usedFallback = false;
  for (const e of entries) {
    const { url, usedFallback: uf } = resolveEntryUrl(e, ctCfg.landingPageLive, canonicalUrl, cfg);
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
// no CTAs (the caller's job to fall back to the plain `cta` path).
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
  const results = types.map((t) => resolveOneContentType(t, ctCfg, cfg, canonicalUrl));
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

