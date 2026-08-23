import type { PlatformPuller, PullPlatform } from "./types.js";
import { linkedin } from "./platforms/linkedin.js";
import { x } from "./platforms/x.js";
import { substack } from "./platforms/substack.js";
import { threads } from "./platforms/threads.js";

// LinkedIn proved the pattern; X and Substack clone its exact shape (navigate → auth check →
// export + capture → save into data/inbox/<platform>/). Their selectors are first-pass and get
// refined from the live `--headed` diagnostics run, same loop LinkedIn went through.
//
// Threads is here for its saved session, not for analytics: it feeds the pattern corpus
// (data/patterns/inbox/) rather than the ingest inbox. See DEFAULT_PULL_PLATFORMS below.
export const PULLERS: Partial<Record<PullPlatform, PlatformPuller>> = {
  linkedin,
  x,
  substack,
  threads,
};

// What a bare `npm run pull` sweeps. Deliberately NOT every key of PULLERS: `npm run pull:weekly`
// runs `npm run pull -- --ingest` on a schedule, and that job exists to refresh Muxin's own
// analytics. Threads collects OTHER creators' posts for `/patterns`, which is a different job on a
// different cadence, so it is opt-in by name: `npm run pull -- threads`.
export const DEFAULT_PULL_PLATFORMS: PullPlatform[] = ["linkedin", "x", "substack"];
