import { loadPlatforms, type SpinAngle } from "../config/platforms.js";

// Spin (docs/spin-experiment.md) reads its per-channel angle from config/platforms.yaml
// `spin_angles`. Promoted to the always-on default 2026-07-02; `--no-spin` is the only opt-out.

export type { SpinAngle };

export function loadSpinAngles(): Record<string, SpinAngle> {
  return loadPlatforms().spin_angles;
}

export function resolveAngle(platform: string): SpinAngle | undefined {
  return loadSpinAngles()[platform];
}

export function isSpinDefault(noSpinFlag: boolean): boolean {
  return !noSpinFlag;
}

// Storytelling re-hook/re-order latitude (Muxin, 2026-07-04): an extension of guardrail #1 in
// docs/spin-experiment.md (re-angle, re-order, change the hook, never invent).
//
// Originally scoped to X and LinkedIn, the two platforms it was asked for, because Bluesky already
// worked near-verbatim. Muxin widened it to EVERY platform on 2026-08-22, so the platform side of
// the gate is now config-driven: config/platforms.yaml `rehook: false` opts a channel out, and an
// absent key means true. Only quote-card carries the opt-out today (its own style rule is "pulled
// verbatim from the source"). A platform missing from the config entirely also gets the pass.
//
// The SOURCE carve-out is unchanged and still absolute: a Notes-sourced folder (source_kind:
// substack-note) is already a near-verbatim cross-post by design (references/notes-mode.md, "the
// whole note is the extract"), so it never gets the extra pass on any platform.
export function appliesRehook(platform: string, sourceKind?: string): boolean {
  if (sourceKind === "substack-note") return false;
  return loadPlatforms().platforms[platform]?.rehook !== false;
}

// The per-platform spin decision, shared so /atomize and the configured Content generation path
// (src/review/jobs.ts generateConfiguredContent) declare spin the SAME way rather than each
// reinventing it — porting /atomize's config-driven spin, never widening it. A variant is "spun"
// (it applies the platform's approved spin_angles beat template as a source-grounded re-hook) when
// ALL hold:
//   - it is source-traceable — it cites `source_lines` to re-hook WITHIN. A composed origin with
//     no source essay (Venture, Charles, fiction promo) has nothing to re-hook from, so it is
//     never spun and is never forced into the case-skeleton beat/class its scoped exception does
//     not provide (CLAUDE.md rule 1);
//   - the platform has an approved angle in config/platforms.yaml `spin_angles` (resolveAngle);
//   - the re-hook latitude applies for the platform and source kind (appliesRehook — quote-card
//     opts out via `rehook: false`, and a substack-note source stays near-verbatim everywhere).
// When spun, `angle` is the platform key, matching /atomize's frontmatter contract and exactly
// what validate.ts's checkSkeletonGate reads (`spin===true && angle===platform`). This is the
// EXTRACTION-first re-hook latitude only: it never authorizes a claim outside `source_lines`.
export interface SpinDescriptor {
  spin: boolean;
  angle?: string;
}

export function resolvePlatformSpin(
  platform: string,
  opts: { traceable: boolean; sourceKind?: string }
): SpinDescriptor {
  if (!opts.traceable) return { spin: false };
  if (!resolveAngle(platform)) return { spin: false };
  if (!appliesRehook(platform, opts.sourceKind)) return { spin: false };
  return { spin: true, angle: platform };
}
