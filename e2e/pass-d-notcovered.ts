// Pass D: what this suite deliberately did NOT drive, and the honest reason for each.
//
// An earlier version of this file called all of these "paid API" routes. That was wrong, and the
// correction matters: almost every one of them runs on a SUBSCRIPTION at $0 marginal cost —
// `claude -p` through runClaudeSpawn (CLAUDE.md rule 6), or the local Codex CLI on the ChatGPT
// subscription for the analyst capability (config/providers.yaml: `analyst: routed`, codex first,
// claude-cli fallback). Scout logs costUsd: 0 outright.
//
// So cost is NOT the reason most of these are skipped. The real reasons, per route:
//
//   time         a model job takes minutes; a browser suite that waits on several is unusable
//   nondeterm    the output differs every run, so there is no stable thing to assert
//   metered      genuinely bills per token or per render — the only true "paid" cases
//   live         reaches a third-party service or drives a saved browser session
//
// They are recorded as BLOCKED rather than omitted. A feature nobody tested must not be invisible
// in a report whose whole point is saying what works: an empty "blocked" column would read as
// "everything was covered", which is the same class of lie as rendering a number nobody measured.

import { record, results } from "./harness.js";
import { pathToFileURL } from "node:url";

type Reason = "time+nondeterm" | "metered" | "live";

const ROUTE_COST: Record<Reason, string> = {
  "time+nondeterm": "$0 on subscription; skipped for runtime and non-deterministic output, not cost",
  metered: "genuinely bills per token or per render",
  live: "$0, but reaches a live third-party service or a saved browser session",
};

export const NOT_COVERED: { feature: string; route: string; engine: string; why: Reason; pr?: string }[] = [
  { feature: "Atomize a piece into platform drafts", route: "POST /api/atomize", engine: "claude -p (subscription)", why: "time+nondeterm" },
  { feature: "Run configured Content generation against an authenticated live CLI", route: "POST /api/content/generate", engine: "selected Studio CLI engine (Codex, Claude, or Grok)", why: "time+nondeterm" },
  { feature: "Hand a thought to the creative director (develop)", route: "POST /api/develop/start|reply|format", engine: "claude -p (subscription)", why: "time+nondeterm", pr: "#349" },
  { feature: "Ask Claude to revise a draft", route: "POST /api/revise", engine: "claude -p (subscription)", why: "time+nondeterm" },
  { feature: "Draft or re-pass a fiction scene", route: "POST /api/fiction/draft|repass", engine: "claude -p (subscription); grok-openrouter only if a series opts in", why: "time+nondeterm", pr: "#352" },
  { feature: "Run the continuity check on a chapter", route: "POST /api/fiction/check", engine: "local tsx process, free", why: "time+nondeterm", pr: "#352" },
  { feature: "Draft a Charles post", route: "POST /api/charles/draft", engine: "claude -p (subscription)", why: "time+nondeterm" },
  { feature: "Ask the strategy brief a question", route: "POST /api/strategy/ask|refresh-brief", engine: "claude -p (subscription)", why: "time+nondeterm" },
  { feature: "Generate insights from the data", route: "POST /api/strategy/insights|ask-insights", engine: "Codex CLI on the ChatGPT subscription, claude-cli fallback", why: "time+nondeterm" },
  { feature: "Draft an outreach message / revise a locked one", route: "POST /api/outreach/draft|message/revise", engine: "claude -p (subscription)", why: "time+nondeterm", pr: "#351" },
  { feature: "Scout for new leads or companies", route: "POST /api/outreach/scout", engine: "local process, logs costUsd: 0", why: "time+nondeterm", pr: "#378" },
  { feature: "Stamp captured_at on newly captured evidence", route: "inside the scout / research-capture run", engine: "local process", why: "time+nondeterm", pr: "#383" },
  { feature: "Browse and spread Substack Notes", route: "GET /api/notes", engine: "live Substack fetch, free", why: "live" },
  { feature: "Pull fresh analytics", route: "POST /api/strategy/pull", engine: "saved real-Chrome session, free", why: "live" },
  { feature: "Generate a video / storyboard render", route: "POST /api/video/generate", engine: "claude -p for the script, then openrouter-image + Kling for the render", why: "metered", pr: "#352" },
  { feature: "Transcribe an audio memo (the /atomize audio path)", route: "inside POST /api/atomize", engine: "Gemini transcription, a deliberate paid opt-in", why: "metered" },
];

function main(): void {
  console.log("\n=== Pass E: deliberately not covered ===\n");
  for (const n of NOT_COVERED) {
    record({
      feature: n.feature,
      pr: n.pr,
      status: "blocked",
      detail: `${n.route} — ${n.engine}. ${ROUTE_COST[n.why]}. UNVERIFIED end to end.`,
    });
  }
  const metered = NOT_COVERED.filter((n) => n.why === "metered").length;
  console.log(
    `\nPass E: ${results.length} features not covered. Only ${metered} of them cost money; the rest are $0 subscription or free-local and were skipped for runtime and non-determinism.\n`
  );
  process.exit(0);
}

if (process.env.E2E_PASS === "E-notcovered" || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) main();
