import { readArtifact, readArtifacts, transitionArtifact } from "./artifacts.js";

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

// --- approve / discard / restore / list ------------------------------------------------------

export function cmdApprove(slug: string, artifactId: string) {
  const a = readArtifact(slug, artifactId);
  if (!a) fail(`no such artifact: ${artifactId}`);
  const next = transitionArtifact(slug, artifactId, { editorial_status: "approved", delivery_status: "ready" }, now());
  console.log(`${artifactId} approved -- ready for delivery (${next.delivery_mode})`);
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
