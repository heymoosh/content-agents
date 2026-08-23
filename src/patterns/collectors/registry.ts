// The collector registry. Same shape as src/pull/registry.ts: a partial record keyed by platform,
// so an unimplemented platform is a missing key rather than a lying stub.
//
// The contract and the shared parsing helpers live in ./shared.ts, and are re-exported here so a
// caller can import either from one place. See the note at the top of that file for why the two
// are not one module.

import { x } from "./x.js";
import { linkedin } from "./linkedin.js";
import { substack } from "./substack.js";
import { isAutoPlatform, type AutoPlatform, type PatternCollector } from "./shared.js";

export * from "./shared.js";

export const PATTERN_COLLECTORS: Partial<Record<AutoPlatform, PatternCollector>> = {
  x,
  linkedin,
  substack,
};

export function collectorFor(platform: string): PatternCollector | null {
  if (!isAutoPlatform(platform)) return null;
  return PATTERN_COLLECTORS[platform] ?? null;
}
