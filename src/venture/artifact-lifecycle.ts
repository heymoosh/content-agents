import { readFileSync } from "node:fs";
import { readArtifact, readArtifacts, transitionArtifact, type ClaimRef } from "./artifacts.js";
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

export function cmdApprove(slug: string, artifactId: string) {
  const a = readArtifact(slug, artifactId);
  if (!a) fail(`no such artifact: ${artifactId}`);
  // delivery_mode "none" artifacts (e.g. Phase 3's product-outline/price-decision) never go
  // through a delivery step -- they must land on "not_applicable", not "ready", or state.ts's
  // completion check (which requires not_applicable for these) can never see them as complete.
  const delivery = a.delivery_mode === "none" ? "not_applicable" : "ready";
  const next = transitionArtifact(slug, artifactId, { editorial_status: "approved", delivery_status: delivery }, now());
  console.log(`${artifactId} approved -- ${delivery === "not_applicable" ? "no delivery needed" : "ready for delivery"} (${next.delivery_mode})`);
}

export function cmdDiscard(slug: string, artifactId: string) {
  const a = readArtifact(slug, artifactId);
  if (!a) fail(`no such artifact: ${artifactId}`);
  const delivery = a.delivery_status === "not_applicable" ? "not_applicable" : "cancelled";
  const next = transitionArtifact(slug, artifactId, { editorial_status: "discarded", delivery_status: delivery }, now());
  console.log(`${artifactId} discarded`);
  return next;
}

export function cmdRestore(slug: string, artifactId: string) {
  const a = readArtifact(slug, artifactId);
  if (!a) fail(`no such artifact: ${artifactId}`);
  const delivery = a.delivery_mode === "none" ? "not_applicable" : "awaiting_approval";
  const next = transitionArtifact(slug, artifactId, { editorial_status: "draft", delivery_status: delivery }, now());
  console.log(`${artifactId} restored to draft`);
  return next;
}

export function cmdList(slug: string) {
  for (const a of readArtifacts(slug)) {
    console.log(`${a.artifact_id}  ${a.artifact_kind}  ${a.editorial_status}/${a.delivery_status}  "${a.title}"`);
  }
}
