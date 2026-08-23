// Pass D: what this suite deliberately did NOT test.
//
// These features are real and reachable in the app, but every one of them is behind a route that
// spawns a `claude -p` process or hits a paid API. Triggering them from a test would cost real
// subscription time or money, take minutes, and make the run non-deterministic — so the suite
// aborts those calls at the browser (harness.ts EXPENSIVE_ROUTES).
//
// They are recorded as BLOCKED rather than omitted. A feature nobody tested must not be invisible
// in a report whose whole point is saying what works: an empty "blocked" column would read as
// "everything was covered", which is the same class of lie as rendering a number nobody measured.

import { record, results } from "./harness.js";

const NOT_COVERED: { feature: string; route: string; pr?: string }[] = [
  { feature: "Atomize a piece into platform drafts", route: "POST /api/atomize" },
  { feature: "Hand a thought to the creative director (develop)", route: "POST /api/develop/start|reply|format", pr: "#349" },
  { feature: "Ask Claude to revise a draft", route: "POST /api/revise" },
  { feature: "Generate a video / storyboard", route: "POST /api/video/generate" },
  { feature: "Draft a fiction scene, re-pass, check, fix the line", route: "POST /api/fiction/draft|repass|check|fix", pr: "#352" },
  { feature: "Draft a Charles post", route: "POST /api/charles/draft" },
  { feature: "Ask the strategy brief a question / refresh it / pull analytics", route: "POST /api/strategy/ask|insights|ask-insights|refresh-brief|pull" },
  { feature: "Draft an outreach message", route: "POST /api/outreach/draft", pr: "#351" },
  { feature: "Scout for new leads or companies", route: "POST /api/outreach/scout", pr: "#378" },
  { feature: "Revise a locked outreach message", route: "POST /api/outreach/message/revise" },
  { feature: "Browse and spread Substack Notes", route: "GET /api/notes (live Substack fetch)" },
  { feature: "Stamp captured_at on newly captured evidence", route: "behind the scout/research-capture job", pr: "#383" },
];

function main(): void {
  console.log("\n=== Pass D: deliberately not covered (model-job routes) ===\n");
  for (const n of NOT_COVERED) {
    record({
      feature: n.feature,
      pr: n.pr,
      status: "blocked",
      detail: `${n.route} — spawns a model job or hits a paid API; the suite refuses to trigger it, so this flow is UNVERIFIED end to end`,
    });
  }
  console.log(`\nPass D: ${results.length} features recorded as not covered\n`);
  process.exit(0);
}

main();
