import { listVentures } from "../venture/paths.js";
import type { VentureCandidate } from "./room-queue.js";

/**
 * Venture name -> slug resolver (decision 11, slice 1.5b, build-order item 6).
 *
 * A venture has no name of its own beyond its directory slug (src/venture/paths.ts), so the display
 * name is the slug with its separators read as spaces. `resolveVentureMention` is pure and
 * deterministic: the same mention over the same list always gives the same answer, and it never
 * takes a client-supplied slug on trust. The server validates a chosen slug against the live list
 * separately (venture-queue.ts).
 *
 * Matching, in order, over text normalized by `normalize` (lower-case, every non-alphanumeric run
 * collapsed to one space, trimmed; so "zz-test-phase2" and "ZZ test phase2" are the same string):
 *   1. empty mention: one venture on disk resolves to it; none -> `none`; several -> `ambiguous`.
 *   2. exact: the mention equals a slug or a name -> `resolved`.
 *   3. partial: a venture matches when its normalized slug or name appears in the mention as a
 *      whole-word run ("an idea for zz test phase2"), or when the mention is a fragment of the
 *      slug or name ("phase2"). Exactly one match -> `resolved`; several -> `ambiguous` over the
 *      matches; none -> `none`.
 */

export type VentureResolution =
  | { readonly kind: "resolved"; readonly slug: string }
  | { readonly kind: "ambiguous"; readonly candidates: readonly VentureCandidate[] }
  | { readonly kind: "none" };

export function normalizeVentureMention(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function ventureDisplayName(slug: string): string {
  return slug.replace(/[-_]+/g, " ").trim();
}

/** The live venture list in resolver shape. Read-only; a missing venture root is an empty list. */
export function ventureCandidates(slugs: readonly string[] = listVentures()): VentureCandidate[] {
  return slugs.map((slug) => ({ slug, name: ventureDisplayName(slug) }));
}

export function resolveVentureMention(mention: string, ventures: readonly VentureCandidate[]): VentureResolution {
  const wanted = normalizeVentureMention(mention);
  if (!wanted) {
    if (ventures.length === 1) return { kind: "resolved", slug: ventures[0]!.slug };
    return ventures.length === 0 ? { kind: "none" } : { kind: "ambiguous", candidates: [...ventures] };
  }
  const keys = ventures.map((venture) => ({ venture, keys: [normalizeVentureMention(venture.slug), normalizeVentureMention(venture.name)].filter(Boolean) }));
  const exact = keys.filter(({ keys: k }) => k.includes(wanted)).map(({ venture }) => venture);
  if (exact.length === 1) return { kind: "resolved", slug: exact[0]!.slug };
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact };
  const padded = ` ${wanted} `;
  const partial = keys
    .filter(({ keys: k }) => k.some((key) => padded.includes(` ${key} `) || key.includes(wanted)))
    .map(({ venture }) => venture);
  if (partial.length === 1) return { kind: "resolved", slug: partial[0]!.slug };
  if (partial.length > 1) return { kind: "ambiguous", candidates: partial };
  return { kind: "none" };
}
