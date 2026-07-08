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
// docs/spin-experiment.md (re-angle, re-order, change the hook — never invent), scoped to the two
// platforms it was asked for. Bluesky already works near-verbatim; a Notes-sourced folder
// (source_kind: substack-note) is already a near-verbatim cross-post by design
// (references/notes-mode.md, "the whole note is the extract") — neither gets the extra pass.
export function appliesRehook(platform: string, sourceKind?: string): boolean {
  if (sourceKind === "substack-note") return false;
  return platform === "x" || platform === "linkedin";
}
