import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";

// Spin (docs/spin-experiment.md) reads its per-channel angle from config/platforms.yaml
// `spin_angles`. Promoted to the always-on default 2026-07-02; `--no-spin` is the only opt-out.

export interface SpinAngle {
  audience: string;
  angle: string;
}

export function loadSpinAngles(): Record<string, SpinAngle> {
  const config = parse(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
    spin_angles?: Record<string, SpinAngle>;
  };
  return config.spin_angles ?? {};
}

export function resolveAngle(platform: string): SpinAngle | undefined {
  return loadSpinAngles()[platform];
}

export function isSpinDefault(noSpinFlag: boolean): boolean {
  return !noSpinFlag;
}
