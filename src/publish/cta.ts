import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
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

export function loadCtaConfig(): CtaConfig {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "cta.yaml"), "utf8")) as {
      placement?: Record<string, string>;
      source_fallback?: { url?: string; label?: string };
    };
    return {
      placement: cfg.placement ?? {},
      fallbackUrl: cfg.source_fallback?.url ?? null,
      fallbackLabel: cfg.source_fallback?.label ?? "",
    };
  } catch {
    return { placement: {}, fallbackUrl: null, fallbackLabel: "" };
  }
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

// Resolve a derivative's CTA to a concrete url + label. Mirrors the funnel rule: none/empty → no
// link; `source` → the essay's canonical_url, falling back to the configured home; any other value
// → a literal url. `usedFallback` lets callers note when `source` fell back to the homepage.
export function resolveCta(
  fm: Record<string, unknown>,
  canonicalUrl: string | null,
  cfg: CtaConfig
): { url: string | null; label: string; usedFallback: boolean } {
  const rawCta = typeof fm.cta === "string" ? fm.cta.trim() : "";
  let label = typeof fm.cta_label === "string" ? fm.cta_label : "";
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

// One line that drops a resolved CTA into a post body. `null` url → body unchanged.
export function appendCtaLine(body: string, url: string | null, label: string): string {
  if (!url) return body;
  return `${body}\n\n${`${label} ${url}`.trim()}`;
}
