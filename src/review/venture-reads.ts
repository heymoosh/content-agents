// The Venture room's read side: nine GETs over the Build 3 backend.
//
// Every one of these wraps a function that already existed in src/venture/**. Nothing here decides
// anything, drafts anything, or advances a phase — the room could not open at all before this,
// because not one venture read was reachable over HTTP.
//
// Three properties this file exists to hold, in priority order:
//
//   1. NOTHING WRITES. A GET that repairs state is still a write, and the Venture tree is real
//      committed state. Two of the wrapped functions did write — deriveState() refreshes state.md
//      (and mkdirSync's the venture directory on the way, so merely *asking about* an unknown slug
//      would have created it), and formatStatus() fires maybeCompletePhase4(), which can append a
//      canon ledger event. Both got a pure sibling in their own module (computeState,
//      formatStatusReadOnly); this file calls the pure one. venture-routes.test.ts snapshots the
//      whole venture tree around a full sweep of every route and asserts it is byte-identical.
//
//   2. RESPONSE CONTENT NEVER LEAVES. venture/<slug>/responses.jsonl is gitignored and holds raw
//      quotes and keyed respondent hashes, under the same privacy treatment as data/analytics.db
//      (responses.ts:14-15). There is no route that reads it. /gate returns ResponseGateState —
//      four counts and a timestamp, the entire legal read model — and /clusters returns the
//      cluster analysis, whose evidence is by construction the REDACTED quote Claude selected
//      (phase3.ts), never exact_quote and never a respondent hash.
//
//   3. THREE STATES, NEVER TWO (docs/prototype-port-rules.md, Rule 3). An unknown slug 404s. A
//      slug that exists but has no data yet answers 200 with an honest empty — [] for a log, null
//      for "not computed yet". The room must be able to tell "there is no such venture" from
//      "nothing has happened yet" from "the answer is zero", so no route collapses them.

import { existsSync } from "node:fs";
import { readArtifacts } from "../venture/artifacts.js";
import { readCanonEvents } from "../venture/canon.js";
import { readDecisions } from "../venture/decisions.js";
import { readIntakeAnswers } from "../venture/intake.js";
import { listVentures, ventureDir } from "../venture/paths.js";
import { readClusterAnalysis } from "../venture/phase3.js";
import { getResponseGateState } from "../venture/responses.js";
import { loadRules } from "../venture/rules.js";
import { computeState } from "../venture/state.js";
import { formatStatusReadOnly } from "../venture/status.js";
import { buildVentureThread } from "./venture-thread.js";

export interface VentureReadResult {
  status: number;
  body: unknown;
}

// The same allowlist src/review/fiction.ts:113 uses for a fiction series, deliberately rather than
// paths.ts's safeSlug blocklist. A blocklist that names "/", "\" and ".." has to be right about
// every other way a path can escape; an allowlist of [a-z0-9][\w-]* has nothing left to be wrong
// about. Percent-encoding is covered by two independent layers: WHATWG URL normalizes "%2e%2e"
// away as a dot segment before serve.ts ever dispatches, and any "%" that did survive fails the
// allowlist here. The tests drive this function directly with raw strings, so what they exercise
// is the second layer rather than trusting the first. A `?slug=../../..` traversal was a real, fixed bug in this repo — this is
// the gate every venture read passes before a slug reaches the filesystem.
const SAFE_SLUG = /^[a-z0-9][\w-]*$/;

/**
 * Dispatch one venture read. Returns null when the request is not a venture read at all, so
 * serve.ts falls through to its own routes and its 404 exactly as before.
 */
export function handleVentureRead(method: string, pathname: string): VentureReadResult | null {
  if (method !== "GET" || !pathname.startsWith("/api/venture/")) return null;

  if (pathname === "/api/venture/list") {
    return { status: 200, body: { ok: true, ventures: listVentures() } };
  }

  // /api/venture/<slug>/<rest...>. The slug is ONE segment by construction, so a multi-segment
  // traversal ("/api/venture/../../state") cannot present itself as a slug at all: `rest` comes
  // out as "../state", matches no read, and the request falls through to serve.ts's 404. A
  // single-segment bad slug ("..", "%2e%2e", "Upper") does reach the allowlist and is refused by
  // name. Both are refusals; neither ever reaches the filesystem.
  const m = /^\/api\/venture\/([^/]+)\/(.+)$/.exec(pathname);
  if (!m) return null;
  const [, slug, rest] = m;
  if (!VENTURE_READS[rest]) return null;

  if (!SAFE_SLUG.test(slug)) {
    return { status: 400, body: { ok: false, error: "bad venture slug" } };
  }
  // Distinct from the empty answers below on purpose: this is "no such venture", not "nothing
  // recorded yet".
  if (!existsSync(ventureDir(slug))) {
    return { status: 404, body: { ok: false, error: `no such venture: ${slug}` } };
  }
  return { status: 200, body: { ok: true, ...VENTURE_READS[rest](slug) } };
}

// TWO reads, deliberately. There were ten: one per underlying file, plus the composed thread. The
// eight fine-grained ones are gone, and the reason is honesty rather than tidiness.
//
// A single write can change several panels at once -- approving an artifact moves the checkpoint's
// completion count, can append a canon event, and changes the card, all in one action. With
// granular reads the room could refetch one of those and render a fresh artifact beside a stale
// checkpoint stamp: a half-updated state presented as a whole one, which is the exact class of lie
// the three-states rule exists to prevent. Rebuilding the WHOLE thread after every write makes that
// unrepresentable. These are local file reads; the cost of doing it that way is nothing.
//
// The secondary reason is that all eight sat parked in page.test.ts's PENDING_UI_VENTURE with no
// caller, which is the accumulation the self-deleting mechanism exists to stop.
//
// `list` stays because the picker genuinely needs it before any slug is known. Everything the
// deleted eight returned is inside the thread: `rules_version` on the thread itself, the intake
// answers in the quotes panel, the gate counts in the gate panel, the clusters panel absent
// entirely when the analysis is null.
const VENTURE_READS: Record<string, (slug: string) => Record<string, unknown>> = {
  // The whole room in one read: the derived thread (src/review/venture-thread.ts) over every read
  // below it. A tenth route rather than the client assembling it from the other nine, because the
  // builder is several hundred lines of honesty-critical derivation and page.ts's Rule 5 mirror
  // convention would mean maintaining two hand-synced copies of it. Composed from the SAME pure
  // reads as the routes above, so it inherits their no-write and no-response-content guarantees.
  thread: (slug) => {
    const rules = loadRules();
    return { thread: buildVentureThread({
      slug,
      state: computeState(slug),
      statusText: formatStatusReadOnly(slug),
      artifacts: readArtifacts(slug),
      decisions: readDecisions(slug),
      canon: readCanonEvents(slug),
      gate: getResponseGateState(slug),
      clusters: readClusterAnalysis(slug),
      answers: readIntakeAnswers(slug) ?? null,
      rulesVersion: rules.rules_version,
      minEvidence: Object.fromEntries(Object.entries(rules.artifact_kinds).map(([k, v]) => [k, v.min_evidence])),
      selectCounts: {
        "idea-ranking": rules.idea_ranking.select_count,
        "lead-magnet-concept": rules.lead_magnet_concept.select_count,
      },
      day14Candidates: rules.day_14_decision.candidates,
      now: new Date().toISOString(),
    }) };
  },

};

/** Every venture read path this module answers, for the wiring guard. */
export const VENTURE_READ_PATHS = ["/api/venture/list", ...Object.keys(VENTURE_READS).map((r) => `/api/venture/:slug/${r}`)];
