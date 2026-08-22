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
