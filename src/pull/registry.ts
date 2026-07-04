import type { PlatformPuller, PullPlatform } from "./types.js";
import { linkedin } from "./platforms/linkedin.js";
import { x } from "./platforms/x.js";
import { substack } from "./platforms/substack.js";

// LinkedIn proved the pattern; X and Substack clone its exact shape (navigate → auth check →
// export + capture → save into data/inbox/<platform>/). Their selectors are first-pass and get
// refined from the live `--headed` diagnostics run, same loop LinkedIn went through.
export const PULLERS: Partial<Record<PullPlatform, PlatformPuller>> = {
  linkedin,
  x,
  substack,
};
