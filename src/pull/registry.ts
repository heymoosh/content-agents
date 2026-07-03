import type { PlatformPuller, PullPlatform } from "./types.js";
import { linkedin } from "./platforms/linkedin.js";

// v1 proves the whole pattern on LinkedIn (the most painful manual export). X and
// Substack clone this exact shape — add their module here once LinkedIn is verified.
export const PULLERS: Partial<Record<PullPlatform, PlatformPuller>> = {
  linkedin,
};
