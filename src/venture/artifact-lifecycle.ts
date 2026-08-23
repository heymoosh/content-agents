import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { ventureDir } from "./paths.js";
import { readArtifact, readArtifacts, transitionArtifact, type ClaimRef, type VentureArtifact } from "./artifacts.js";
import { appendCanonEvent } from "./canon.js";
import type { VentureRules } from "./rules.js";

// Shared artifact-lifecycle commands, extracted out of phase1.ts so phase2.ts (and any later
// phase script) can reuse the exact same approve/discard/restore/list behavior instead of
// duplicating the editorial-state-machine logic. Pure extraction -- no behavior change from what
// phase1.ts had inline.

export function now(): string {
  return new Date().toISOString();
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// --- CLI arg-parsing helpers -------------------------------------------------------------------
// Extracted out of phase1.ts so phase2.ts (and any later phase script) can reuse the exact same
// argv parsing instead of duplicating it. Pure extraction -- no behavior change.

export function readStdin(): string {
  return readFileSync(0, "utf8");
}

export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Strips each named flag AND its following value out of a positional-args array -- naively
// filtering out only strings starting with "--" leaves a multi-word flag VALUE (e.g.
// `--rationale "several words"`, which argv splits into separate entries) sitting in the
// positional list. Caught this the hard way running the real CLI by hand before writing tests.
export function positionalArgs(rest: string[], ...knownFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (knownFlags.includes(rest[i])) {
      i++; // skip the flag's value too
      continue;
    }
    out.push(rest[i]);
  }
  return out;
}

// --- shared draft validators ---------------------------------------------------------------------
// Extracted so phase1.ts and phase2.ts share one em-dash check and one claim_refs warning instead
// of each reimplementing it with slightly different null-safety. See phase1.ts/phase2.ts call
// sites for how a single-field check (phase1) and a multi-field check (phase2) both use these.

export function checkNoEmDash(fields: Record<string, string | string[] | undefined>): void {
  for (const [key, val] of Object.entries(fields)) {
    if (!val) continue;
    const text = Array.isArray(val) ? val.join(" ") : val;
    if (text.includes("—")) fail(`draft field "${key}" contains an em dash -- config/voice.yaml bans them, no exceptions`);
  }
}

export function warnIfNoClaimRefs(rules: VentureRules, claimRefs: ClaimRef[] | undefined): void {
  if (rules.draft.require_claim_refs && (claimRefs?.length ?? 0) === 0) {
    console.warn(
      `warning: no claim_refs on this draft -- if it makes ANY concrete factual claim, that claim ` +
        `needs a ref to intake:qN or a confirmed_known, or it must be cut/reframed as a hypothesis`
    );
  }
}

// --- approve / discard / restore / list ------------------------------------------------------

// SPLIT (Venture room write routes): each of the three lifecycle commands below is a pure
// transition plus a console.log. The transition half is real policy -- which delivery_status an
// approve/discard/restore lands on is decided HERE, not by transitionArtifact (which only checks
// that the resulting pair is legal). A caller that is not a CLI (the review server) needs the
// policy without the logging, and reaching for transitionArtifact directly would mean a second
// copy of these three derivations, free to drift from this one. So the policy moved into
// *Artifact() functions that return the record, and cmd*() are the logging wrappers they always
// were. No behavior change: the CLI produces the same lines it did before.

export function approveArtifact(slug: string, artifactId: string, at: string = now()): VentureArtifact {
  const a = requireArtifact(slug, artifactId);
  // delivery_mode "none" artifacts (e.g. Phase 3's product-outline/price-decision) never go
  // through a delivery step -- they must land on "not_applicable", not "ready", or state.ts's
  // completion check (which requires not_applicable for these) can never see them as complete.
  const delivery = a.delivery_mode === "none" ? "not_applicable" : "ready";
  return transitionArtifact(slug, artifactId, { editorial_status: "approved", delivery_status: delivery }, at);
}

export function discardArtifact(slug: string, artifactId: string, at: string = now()): VentureArtifact {
  const a = requireArtifact(slug, artifactId);
  const delivery = a.delivery_status === "not_applicable" ? "not_applicable" : "cancelled";
  return transitionArtifact(slug, artifactId, { editorial_status: "discarded", delivery_status: delivery }, at);
}

export function restoreArtifact(slug: string, artifactId: string, at: string = now()): VentureArtifact {
  const a = requireArtifact(slug, artifactId);
  const delivery = a.delivery_mode === "none" ? "not_applicable" : "awaiting_approval";
  return transitionArtifact(slug, artifactId, { editorial_status: "draft", delivery_status: delivery }, at);
}

// The takedown path (docs/venture-schema-contract.md §2.1), and the only transition that walks
// something back after it was public. Four things the contract is explicit about, in order:
//
//   1. Only from `live_confirmed`. This has to be checked HERE, first, because nothing downstream
//      will: transitionArtifact validates the resulting PAIR, and `discarded:cancelled` is already
//      legal for an ordinary discard. Without this check a never-live draft could be "retracted",
//      which would write "this was public and came down" into a venture's history.
//   2. The attestation is required. The system can no more verify a takedown than it could verify
//      the original posting, so Muxin's own sentence IS the record -- an empty one is refused
//      rather than stored as a blank.
//   3. `evidence` is untouched. The artifact really was live, and a cleared checkpoint rests on
//      that fact; erasing it would falsify the history the venture was already built on.
//   4. A cleared checkpoint does NOT silently un-clear. A `retracted` event lands in canon.md and
//      surfaces on the phase screen instead, because unwinding a cleared checkpoint automatically
//      would rewrite history the venture was already built on. So this deliberately touches no
//      checkpoint state at all.
//
// The ledger event id carries `at`, unlike every other canon event id in this codebase. Those are
// keyed to a thing that happens once (a kickoff, a checkpoint clearing) and dedupe by identity.
// A takedown is not: retract, restore, publish again, retract again is a legitimate sequence, and
// keying on the artifact alone would silently swallow the second takedown. Including `at` keeps a
// retried identical call idempotent while letting two genuine takedowns both be recorded.
export function retractArtifact(slug: string, artifactId: string, attestation: string, at: string = now()): VentureArtifact {
  const a = requireArtifact(slug, artifactId);
  if (a.delivery_status !== "live_confirmed") {
    throw new Error(
      `${artifactId} is ${a.editorial_status}/${a.delivery_status}, not live -- only something that ` +
        `actually went out can be retracted (venture-schema-contract.md §2.1). Discard it instead.`
    );
  }
  if (!attestation.trim()) {
    throw new Error(
      `a retraction needs your own sentence saying what happened (taken down, unpublished, link ` +
        `dead) -- the system cannot verify a takedown any more than it could verify the posting`
    );
  }
  const next = transitionArtifact(
    slug,
    artifactId,
    {
      editorial_status: "discarded",
      delivery_status: "cancelled",
      retraction: { attestation: attestation.trim(), retracted_at: at, retracted_by: "muxin" },
    },
    at
  );
  appendCanonEvent(slug, "retracted", `${slug}/${artifactId}/retracted/${at}`, { artifact: artifactId }, at);
  return next;
}

function requireArtifact(slug: string, artifactId: string): VentureArtifact {
  const a = readArtifact(slug, artifactId);
  if (!a) throw new Error(`no such artifact: ${artifactId}`);
  return a;
}

export function cmdApprove(slug: string, artifactId: string) {
  if (!readArtifact(slug, artifactId)) fail(`no such artifact: ${artifactId}`);
  const next = approveArtifact(slug, artifactId);
  console.log(
    `${artifactId} approved -- ${next.delivery_status === "not_applicable" ? "no delivery needed" : "ready for delivery"} (${next.delivery_mode})`
  );
}

export function cmdDiscard(slug: string, artifactId: string) {
  if (!readArtifact(slug, artifactId)) fail(`no such artifact: ${artifactId}`);
  const next = discardArtifact(slug, artifactId);
  console.log(`${artifactId} discarded`);
  return next;
}

export function cmdRestore(slug: string, artifactId: string) {
  if (!readArtifact(slug, artifactId)) fail(`no such artifact: ${artifactId}`);
  const next = restoreArtifact(slug, artifactId);
  console.log(`${artifactId} restored to draft`);
  return next;
}

export function cmdList(slug: string) {
  for (const a of readArtifacts(slug)) {
    console.log(`${a.artifact_id}  ${a.artifact_kind}  ${a.editorial_status}/${a.delivery_status}  "${a.title}"`);
  }
}

// --- the body file ------------------------------------------------------------------------------
//
// Approving or discarding a draft was the whole of Muxin's say over an artifact: there was no way
// to change a word of it without opening the file in an editor. These two functions are that way,
// and they live here rather than in the route that calls them because a body edit is an editorial
// act with its own rules, and venture-writes.ts's standing rule is that no route may invent one.
//
// What an edit means, and why it is recorded:
//
//   An artifact body starts as AI-written prose, and the room says so in the AI register (purple,
//   "I DRAFTED THIS"). The moment Muxin rewrites it, that stops being true of the file on disk, and
//   leaving it purple would be the exact defect docs/prototype-port-rules.md Rule 4 names: her
//   prose rendered as the AI's. So the edit stamps body_edited_by_muxin_at, and the register
//   follows the stamp. It is deliberately a timestamp and not a flag, because the screen shows the
//   day, and the day has to be one something actually recorded.
//
//   There is no partial state and no diffing. Once she has been through it, the file is hers; the
//   room does not try to work out which sentences survived.

function resolveBodyFile(slug: string, a: VentureArtifact): string {
  if (!a.body_path) {
    throw new Error(`"${a.artifact_id}" has no body file to edit -- this kind of artifact keeps its content in fields, not in a document`);
  }
  const dir = ventureDir(slug);
  const full = resolve(dir, a.body_path);
  // body_path is written by the phase scripts and has never been user input, but this read and
  // write are reachable from an HTTP route now, and a containment check costs nothing.
  if (full !== dir && !full.startsWith(dir + sep)) {
    throw new Error(`"${a.artifact_id}" points outside its own venture folder -- refusing to touch ${a.body_path}`);
  }
  return full;
}

export function readArtifactBody(slug: string, artifactId: string): { body: string; editedAt: string | null } {
  const a = requireArtifact(slug, artifactId);
  const file = resolveBodyFile(slug, a);
  // A body_path whose file is not there is a real state (a draft recorded, the file lost) and it
  // reads as empty rather than throwing, so the editor can open and put something there.
  const body = existsSync(file) ? readFileSync(file, "utf8") : "";
  return { body, editedAt: a.body_edited_by_muxin_at };
}

/**
 * Muxin's own rewrite of one artifact body. Refuses on the two states where the file and the world
 * would stop agreeing:
 *
 *   handed_off / live_confirmed — the words are already out there. Editing the file afterwards
 *     would leave the record claiming that this text went live when a different one did. The
 *     refusal says what to do instead, because there IS something to do: take it down (retract),
 *     or report the delivery failed, and then edit.
 *   discarded — it is off the desk. Restore it first, so the record shows it came back before it
 *     changed rather than changing while it was out.
 *
 * Everything else can be edited: a draft, an approved-and-ready artifact that has not gone
 * anywhere yet, and one whose delivery failed and is waiting to be tried again.
 */
export function editArtifactBody(slug: string, artifactId: string, body: string, at: string = now()): VentureArtifact {
  const a = requireArtifact(slug, artifactId);
  if (a.editorial_status === "discarded") {
    throw new Error(`"${a.artifact_id}" is discarded -- put it back on the desk first, then edit it`);
  }
  if (a.delivery_status === "live_confirmed" || a.delivery_status === "handed_off") {
    throw new Error(
      `"${a.artifact_id}" has already gone out, so the file and what people saw would stop matching. ` +
        `Take it down or report the delivery failed, then edit it`
    );
  }
  if (!body.trim()) {
    throw new Error(`an empty body would throw the draft away without recording that you meant to -- discard it instead`);
  }
  const file = resolveBodyFile(slug, a);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body.endsWith("\n") ? body : body + "\n");
  return transitionArtifact(slug, artifactId, { body_edited_by_muxin_at: at }, at);
}
