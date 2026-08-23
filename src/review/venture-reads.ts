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
import { INTAKE_QUESTIONS, readIntakeAnswers } from "../venture/intake.js";
import { listVentures, ventureDir } from "../venture/paths.js";
import { readClusterAnalysis } from "../venture/phase3.js";
import { getResponseGateState } from "../venture/responses.js";
import { loadRules } from "../venture/rules.js";
import { computeState } from "../venture/state.js";
import { formatStatusReadOnly } from "../venture/status.js";

export interface VentureReadResult {
  status: number;
  body: unknown;
}

// The same allowlist src/review/fiction.ts:113 uses for a fiction series, deliberately rather than
// paths.ts's safeSlug blocklist. A blocklist that names "/", "\" and ".." has to be right about
// every other way a path can escape; an allowlist of [a-z0-9][\w-]* has nothing left to be wrong
// about. Percent-encoding is covered for free: Node leaves "%2e%2e" in url.pathname, and "%" is
// not in the allowlist. A `?slug=../../..` traversal was a real, fixed bug in this repo — this is
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

const VENTURE_READS: Record<string, (slug: string) => Record<string, unknown>> = {
  // The derived phase/checkpoint model plus the plain-language render of it. Both come from the
  // write-free pair; see property 1 above.
  state: (slug) => ({ state: computeState(slug), status: formatStatusReadOnly(slug) }),

  // Append-only logs, folded to latest-line-wins by their own readers. A venture with no
  // artifacts/decisions/events yet gets [], which is the honest "nothing has happened".
  artifacts: (slug) => ({ artifacts: readArtifacts(slug) }),
  decisions: (slug) => ({ decisions: readDecisions(slug) }),
  canon: (slug) => ({ events: readCanonEvents(slug) }),

  // Counts only. See property 2 — ResponseGateState is the entire legal read model for Phase 3's
  // response log, and `have` being 0 is a measured zero, not an absence.
  gate: (slug) => ({ gate: getResponseGateState(slug) }),

  // null before the gate opens and the clustering runs. Passed through as null rather than an
  // empty cluster list so the room renders nothing at all instead of "0 problems found" —
  // not-measured-at-all is not measured-as-zero.
  clusters: (slug) => ({ clusters: readClusterAnalysis(slug) }),

  // The provenance triple only. rules.yaml is the full runtime rubric; the room needs to show
  // which version and which sources a venture is being run against, and nothing else from it.
  rules: () => {
    const rules = loadRules();
    return {
      rules_version: rules.rules_version,
      sources: {
        starter_kit_sha256: rules.sources.starter_kit_sha256,
        welsh_note_sha256: rules.sources.welsh_note_sha256,
      },
    };
  },

  // Muxin's own 25 answers, verbatim. `answers: null` means there is no intake.md yet — the room
  // must not draw 25 blank rows for a venture that was never interviewed. The question text rides
  // along because the answers are keyed q1..q25 and the client has no other copy of the wording.
  "intake/answers": (slug) => ({
    answers: readIntakeAnswers(slug) ?? null,
    questions: INTAKE_QUESTIONS,
  }),
};

/** Every venture read path this module answers, for the wiring guard. */
export const VENTURE_READ_PATHS = ["/api/venture/list", ...Object.keys(VENTURE_READS).map((r) => `/api/venture/:slug/${r}`)];
