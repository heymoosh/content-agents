// The Venture room's write side: the twelve POSTs behind its buttons.
//
// Sibling of venture-reads.ts and the same shape — one dispatcher, serve.ts wires it in five
// lines. What is different, and what this file is really about, is that every one of these
// changes real committed state, so the rule it obeys is narrower than "read nothing sensitive":
//
//   EVERY WRITE IS AUTHORIZED BY AN EXISTING RULE, NEVER BY THE ROUTE.
//
// Each handler is a thin call into the function that already owns the decision, and each of those
// functions refuses on its own terms: selectWithOverride refuses a non-recommended pick with no
// override reason; confirmManualDelivery refuses a proof below the artifact kind's evidence floor;
// clearCheckpoint refuses a partial pass; transitionArtifact refuses an illegal state pair;
// retractArtifact refuses anything that was never live; day14Decide refuses a decision made before
// Muxin approved the facts. This file's job is to pass those refusals through WORD FOR WORD — they
// are written to tell her what to bring instead — and to add no gate, no softening, and above all
// no bypass of its own.
//
// A refusal is a 400 with the underlying message. That is deliberate over a 500: none of these are
// server faults, they are the system declining to record something that is not true yet.
//
// Deliberately NOT here, and not half-built: POST :slug/deliver (deliverVenture makes real network
// calls and belongs behind the job queue, like every other long-running action in this server).
//
// Response ingest USED to sit in that same sentence, refused on the grounds that a pasted blob
// cannot supply a per-response attribution or an audience-eligibility judgment. That objection was
// right about a blob, and it is answered by not building one: :slug/responses below takes ONE
// response at a time with both of those judgments as explicit fields Muxin fills in, which is
// exactly the input ingestResponse has always demanded ("a judgment call by whoever transcribed
// this response ... it never infers it"). Nothing splits a paste into N responses, and nothing
// guesses who sent one. Muxin decided the room needs this: without it the Phase 3 response gate
// cannot be moved from the desk at all, which left Phase 3 a CLI-only phase inside a GUI build.

import { transitionArtifact, readArtifact, type VentureArtifact } from "../venture/artifacts.js";
import { approveArtifact, discardArtifact, restoreArtifact, retractArtifact } from "../venture/artifact-lifecycle.js";
import { updateResearchReadFinding } from "../venture/artifacts.js";
import { selectByKind } from "../venture/decisions.js";
import { clearCheckpoint, recordPace } from "../venture/checkpoint.js";
import { confirmManualDelivery, type ManualProof } from "../venture/deliver.js";
import { day14Decide } from "../venture/phase4.js";
import { ingestResponse, type EmotionalIntensity, type ResponseSource } from "../venture/responses.js";
import { loadRules } from "../venture/rules.js";
import { ventureDir } from "../venture/paths.js";
import { clearIntakeDrafts } from "./intake-draft.js";
import { commitIntake } from "./intake-commit.js";
import { existsSync } from "node:fs";

export interface VentureWriteResult {
  status: number;
  body: unknown;
}

// The same allowlist the reads use (src/review/venture-reads.ts, itself fiction.ts:113's).
const SAFE_SLUG = /^[a-z0-9][\w-]*$/;
// An artifact / decision / checkpoint / finding id also becomes part of a filesystem read or a
// ledger event id, so it gets the same treatment rather than being trusted because it "comes from
// our own UI". Slightly wider than a slug: ids in this codebase are lowercase-with-dashes and
// digits (p1-essay-01, checkpoint-1, transformation-01).
const SAFE_ID = /^[a-z0-9][\w-]*$/;

type Handler = (slug: string, params: string[], body: Record<string, unknown>) => Record<string, unknown>;

interface Route {
  method: "POST";
  pattern: RegExp; // group 1 is the slug; later groups are ids, in order
  handler: Handler;
  // Almost every write needs the venture to exist. The intake scratch buffer is the exception:
  // the interview fills it BEFORE kickoffVenture creates venture/<slug>/, so requiring the
  // directory would make the clear-on-commit call fail exactly when it is meant to run.
  requiresVenture?: false;
}

// Spelled out rather than imported as values because both are TYPE unions in responses.ts, so
// there is no runtime list to import. venture-writes.test.ts asserts each entry against the type,
// which is what stops a new source or intensity being added there and forgotten here.
const RESPONSE_SOURCES: readonly ResponseSource[] = ["survey", "email", "comment", "dm", "other"];
const EMOTIONAL_INTENSITIES: readonly EmotionalIntensity[] = ["low", "medium", "high"];

function now(): string {
  return new Date().toISOString();
}

function str(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  return typeof v === "string" ? v : undefined;
}

const ROUTES: Route[] = [
  // --- decisions -------------------------------------------------------------------------------
  //
  // One URL for every decision kind; decisions.ts reads the kind off the record and applies that
  // kind's own discipline (selectByKind). The route never decides which discipline applies, which
  // is what stops a caller sending two candidate ids at a single-pick decision and slipping past
  // the override-reason rule.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/decisions\/([^/]+)\/select$/,
    handler: (slug, [decisionId], body) => {
      const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds.filter((c): c is string => typeof c === "string") : [];
      if (!candidateIds.length) throw new Error("send the chosen option as candidateIds");

      // The Day 14 decision is the one kind that does not go through selectByKind: it carries
      // four Phase 4 rules (Phase 4 unlocked, the review approved first, a reason required, the
      // candidate one of rules.yaml's options) plus its own lazy record creation, all of which
      // live in phase4.ts. Matched by its fixed id rather than by decision_kind precisely BECAUSE
      // of the lazy creation — on the first call there is no record to read a kind from.
      if (decisionId === "p4-day-14-decision") {
        const { decision, phase4Complete } = day14Decide(slug, candidateIds[0], str(body, "rationale"), now());
        return { decision, phase4_complete: phase4Complete };
      }
      return { decision: selectByKind(slug, decisionId, loadRules(), { candidateIds, overrideReason: str(body, "overrideReason"), rationale: str(body, "rationale"), at: now() }) };
    },
  },

  // --- artifact lifecycle ----------------------------------------------------------------------
  //
  // Each of these calls the *Artifact() function that owns the delivery-status derivation, not
  // transitionArtifact directly: which delivery_status an approve or a discard lands on is real
  // policy (a delivery_mode "none" artifact must land on not_applicable, or state.ts can never see
  // it as complete), and a second copy of it here would be free to drift from the CLI's.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/artifacts\/([^/]+)\/approve$/,
    handler: (slug, [id]) => ({ artifact: approveArtifact(slug, id, now()) }),
  },
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/artifacts\/([^/]+)\/discard$/,
    handler: (slug, [id]) => ({ artifact: discardArtifact(slug, id, now()) }),
  },
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/artifacts\/([^/]+)\/restore$/,
    handler: (slug, [id]) => ({ artifact: restoreArtifact(slug, id, now()) }),
  },
  // The takedown. Separate from discard on purpose — both land on discarded x cancelled, and the
  // presence of the retraction object is the only thing that separates "this was never used" from
  // "this was public and came down" (venture-schema-contract.md §2.2).
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/artifacts\/([^/]+)\/retract$/,
    handler: (slug, [id], body) => ({ artifact: retractArtifact(slug, id, str(body, "attestation") ?? "", now()) }),
  },

  // Confirming something went live. The proof shape and the evidence floor are both
  // confirmManualDelivery's (#365) — a below-floor proof and an empty value are refused THERE, and
  // its refusal names what to bring instead ("Put it live, then confirm it with a link: a link can
  // be re-checked later, a sentence cannot"), so the message is passed through untouched.
  // confirmManualDelivery returns void; the record is re-read for the response rather than
  // changing its signature.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/artifacts\/([^/]+)\/confirm-live$/,
    handler: (slug, [id], body) => {
      const type = str(body, "type");
      if (type !== "url" && type !== "attestation") {
        throw new Error(`confirm with either a live link (type "url") or your own sentence (type "attestation")`);
      }
      const proof: ManualProof = { type, value: str(body, "value") ?? "" };
      confirmManualDelivery(slug, id, proof, now());
      return { artifact: requireArtifact(slug, id) };
    },
  },

  // Reporting a delivery that did not work. `provider` is null because this is Muxin's own report,
  // not a provider's (venture-schema-contract.md §4.1) — the string in `message` is hers.
  // `retryable` defaults to true: a manual hand-off she can simply attempt again, and §2.2 only
  // offers the Retry action when this is set. transitionArtifact is what refuses this on an
  // artifact that was never approved — draft:failed is not a legal pair.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/artifacts\/([^/]+)\/failed$/,
    handler: (slug, [id], body) => {
      const message = str(body, "message");
      if (!message?.trim()) throw new Error("say what went wrong -- a failure with no reason gives the screen nothing to show");
      const at = now();
      const retryable = typeof body.retryable === "boolean" ? body.retryable : true;
      return { artifact: transitionArtifact(slug, id, { delivery_status: "failed", failure: { provider: null, message, retryable, at } }, at) };
    },
  },

  // One research-read finding accepted or rejected. updateResearchReadFinding refuses a
  // non-emergent finding itself (muxin_confirmed_emergent only applies to emergent ones) and
  // refuses an unknown finding id; both messages pass through.
  //
  // NOTE the shape: the brief specified POST :slug/findings/:findingId, but a finding lives inside
  // ONE artifact's fields.findings[] and updateResearchReadFinding needs that artifact id — there
  // is no venture-level finding index to look it up in. Nested under the artifact instead, which
  // also matches every other artifact write above.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/artifacts\/([^/]+)\/findings\/([^/]+)$/,
    handler: (slug, [id, findingId], body) => {
      if (typeof body.accepted !== "boolean") throw new Error("send accepted as true or false");
      return { artifact: updateResearchReadFinding(slug, id, findingId, body.accepted, now()) };
    },
  },

  // --- checkpoint ------------------------------------------------------------------------------
  //
  // clearCheckpoint answers {cleared, alreadyCleared, reason} rather than throwing on a refusal,
  // and `reason` is the sentence the screen shows under a disabled button ("2/3 required artifacts
  // are approved+live -- no partial pass"). Passed through intact, and answered 200: a checkpoint
  // that is not ready yet is a fact about the venture, not a failed request.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/checkpoint\/([^/]+)\/clear$/,
    handler: (slug, [checkpointId]) => ({ result: clearCheckpoint(slug, checkpointId, now()) }),
  },
  // Checkpoint 1 cannot clear without this (rules.md §5.5). Free-text on purpose — it is what
  // Muxin says her ongoing pace is, not a number the system measured.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/pace$/,
    handler: (slug, _params, body) => {
      const postsPerWeek = str(body, "postsPerWeek");
      if (!postsPerWeek?.trim()) throw new Error("say what pace you can keep -- checkpoint 1 does not clear without it");
      return { result: recordPace(slug, postsPerWeek.trim(), now()) };
    },
  },

  // --- response log ----------------------------------------------------------------------------
  //
  // ONE response, transcribed by hand. Not a blob split into many: rules.md 7.2's eligibility is a
  // judgment about one person against the venture's target audience, and there is no honest way to
  // read it off a paste. Both judgments the log needs -- is this person in the audience, and is
  // there a stable identifier to dedupe them by -- arrive as explicit fields, never inferred here.
  //
  // The field names are the response-ingest CLI's own JSON keys (src/venture/phase3.ts), not a
  // second dialect: the same body works on both surfaces, and the required-field list below is the
  // same one the CLI's requireNonEmpty checks. Everything past shape is ingestResponse's, including
  // requireRulesVersionMatch and requireResearchHashKey (which fires only when an identifier is
  // actually supplied, and whose sentence names the env var to set).
  //
  // WHAT COMES BACK IS A CONFIRMATION, NEVER THE TEXT. venture-schema-contract.md 5.4 and the
  // room's own promise ("I never show you the answers, only the count") both say the response log
  // does not read back, so this returns the id, the duplicate flag and the gate counts -- never the
  // record, whose exact_quote and respondent_hash have no business crossing this boundary.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/responses$/,
    handler: (slug, _params, body) => {
      const source = str(body, "source");
      if (!source || !RESPONSE_SOURCES.includes(source as ResponseSource)) {
        throw new Error(`where did this response come from? one of: ${RESPONSE_SOURCES.join(", ")}`);
      }
      const intensity = str(body, "emotional_intensity");
      if (!intensity || !EMOTIONAL_INTENSITIES.includes(intensity as EmotionalIntensity)) {
        throw new Error(`how strongly did they say it? one of: ${EMOTIONAL_INTENSITIES.join(", ")}`);
      }
      // No default. Whether this person is in the audience decides whether they count toward the
      // 20/30, so a missing answer stops here rather than being read as a quiet yes or no.
      if (typeof body.target_audience_eligible !== "boolean") {
        throw new Error(
          "say whether this person is in the audience you are testing -- it decides whether they " +
            "count toward the goal, and it is your call, not something I can read off their words"
        );
      }
      const required = {
        exact_quote: str(body, "exact_quote"),
        redacted_quote: str(body, "redacted_quote"),
        stuck_point: str(body, "stuck_point"),
      };
      const missing = Object.entries(required)
        .filter(([, v]) => !v?.trim())
        .map(([k]) => k.replace(/_/g, " "));
      if (missing.length) throw new Error(`still needs: ${missing.join(", ")}`);

      const rawId = body.raw_identifier as { platform?: unknown; stable_user_id?: unknown } | undefined | null;
      const platform = typeof rawId?.platform === "string" ? rawId.platform.trim() : "";
      const stableUserId = typeof rawId?.stable_user_id === "string" ? rawId.stable_user_id.trim() : "";
      // Both halves or neither. A platform with no id cannot be hashed, and an id with no platform
      // would collide across platforms; either way a half-filled identifier silently becomes a
      // fresh unique respondent, which is the one outcome that quietly moves the count.
      if (Boolean(platform) !== Boolean(stableUserId)) {
        throw new Error(
          "an identifier needs both halves: which platform, and their id or email there. Leave both " +
            "empty and this response counts as its own person"
        );
      }
      const at = now();
      const result = ingestResponse(
        slug,
        {
          source: source as ResponseSource,
          receivedAt: str(body, "received_at")?.trim() || at,
          rawIdentifier: platform ? { platform, stableUserId } : null,
          targetAudienceEligible: body.target_audience_eligible,
          exactQuote: required.exact_quote!,
          redactedQuote: required.redacted_quote!,
          stuckPoint: required.stuck_point!,
          desiredOutcome: str(body, "desired_outcome")?.trim() || null,
          emotionalIntensity: intensity as EmotionalIntensity,
          exclusionReason: str(body, "exclusion_reason")?.trim() || null,
        },
        at
      );
      return {
        response_id: result.record.response_id,
        likely_duplicate: result.likelyDuplicate,
        gate: result.gate,
      };
    },
  },

  // --- intake scratch buffer -------------------------------------------------------------------
  //
  // Built in intake-draft.ts and never routed; its own comment says the room will call it right
  // after the interview's final write, so stale half-typed drafts never shadow the saved answers.
  // The one route here that must NOT require the venture directory to exist — the drafts are
  // written during the interview, which is before kickoffVenture creates it.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/intake\/drafts\/clear$/,
    requiresVenture: false,
    handler: (slug) => ({ result: clearIntakeDrafts(slug) }),
  },
  // The end of the interview: the one route that turns 25 scratch drafts into a real venture. Also
  // requiresVenture:false, and for the strongest form of that reason — this route is what CREATES
  // venture/<slug>/. See src/review/intake-commit.ts: it reads the answers back off the draft
  // store, adds the voice-evidence rule kickoffVenture does not carry, and hands everything else
  // to kickoffVenture unchanged.
  //
  // Answers a refusal as 200 with {ok:false} inside `result`, unlike every route above it. That is
  // deliberate: an unfinished interview is a fact about the drafts, not a bad request, and the
  // body carries the `missing` question numbers the screen marks its boxes from. A 400 would make
  // a normal half-finished interview read as an error.
  {
    method: "POST",
    pattern: /^\/api\/venture\/([^/]+)\/intake\/commit$/,
    requiresVenture: false,
    handler: (slug, _params, body) => ({ result: commitIntake(slug, { voice: body.voice, scorecard: body.scorecard }) }),
  },
];

function requireArtifact(slug: string, artifactId: string): VentureArtifact {
  const a = readArtifact(slug, artifactId);
  if (!a) throw new Error(`no such artifact: ${artifactId}`);
  return a;
}

/**
 * Dispatch one venture write. Returns null when the request is not one, so serve.ts falls through
 * to its own routes and its 404 exactly as before.
 */
export function handleVentureWrite(method: string, pathname: string, body: Record<string, unknown>): VentureWriteResult | null {
  if (method !== "POST" || !pathname.startsWith("/api/venture/")) return null;

  for (const route of ROUTES) {
    const m = route.pattern.exec(pathname);
    if (!m) continue;
    const [, slug, ...params] = m;

    if (!SAFE_SLUG.test(slug)) return { status: 400, body: { ok: false, error: "bad venture slug" } };
    const badId = params.find((p) => !SAFE_ID.test(p));
    if (badId !== undefined) return { status: 400, body: { ok: false, error: `bad id: ${JSON.stringify(badId)}` } };
    if (route.requiresVenture !== false && !existsSync(ventureDir(slug))) {
      return { status: 404, body: { ok: false, error: `no such venture: ${slug}` } };
    }

    try {
      return { status: 200, body: { ok: true, ...route.handler(slug, params, body) } };
    } catch (e) {
      // Verbatim. Every one of these messages was written to tell Muxin what to bring instead;
      // rewording it here would throw away the only useful half of the refusal.
      return { status: 400, body: { ok: false, error: e instanceof Error ? e.message : String(e) } };
    }
  }
  return null;
}

/** Every venture write path this module answers, for the wiring guard. */
export const VENTURE_WRITE_PATHS = [
  "/api/venture/:slug/decisions/:id/select",
  "/api/venture/:slug/artifacts/:id/approve",
  "/api/venture/:slug/artifacts/:id/discard",
  "/api/venture/:slug/artifacts/:id/restore",
  "/api/venture/:slug/artifacts/:id/retract",
  "/api/venture/:slug/artifacts/:id/confirm-live",
  "/api/venture/:slug/artifacts/:id/failed",
  "/api/venture/:slug/artifacts/:id/findings/:findingId",
  "/api/venture/:slug/checkpoint/:id/clear",
  "/api/venture/:slug/pace",
  "/api/venture/:slug/responses",
  "/api/venture/:slug/intake/drafts/clear",
  "/api/venture/:slug/intake/commit",
];

// Asserted by venture-writes.test.ts: the dispatch table has exactly this many routes, so a route
// added without a matching VENTURE_WRITE_PATHS entry (and so without a PENDING_UI entry) fails
// there rather than slipping past the wiring guard unnoticed.
export const VENTURE_WRITE_ROUTE_COUNT = ROUTES.length;
