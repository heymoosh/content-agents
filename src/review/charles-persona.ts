import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseDocument } from "yaml";
import { repoRoot } from "../db/db.js";
import { dataPath } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

export type CharlesPersonaProposalStatus = "pending" | "approved" | "rejected" | "applied";

export interface CharlesPersonaProposal {
  id: string;
  status: CharlesPersonaProposalStatus;
  beforeYaml: string;
  afterYaml: string;
  beforeDigest: string;
  afterDigest: string;
  payloadDigest: string;
  proposedBy: "muxin";
  proposedAt: string;
  reviewedBy?: "muxin";
  reviewedAt?: string;
  reviewEvidence?: string;
  appliedAt?: string;
}

type PersonaProposalEvent = {
  event: "proposed" | "approved" | "rejected" | "applied";
  proposalId: string;
  at: string;
  actor: "muxin";
  payloadDigest: string;
  evidence: string;
  proposal?: CharlesPersonaProposal;
  previousEventDigest: string | null;
  eventDigest: string;
};
type PersonaProposalEventInput = Omit<PersonaProposalEvent, "previousEventDigest" | "eventDigest">;

export interface CharlesPersonaOptions {
  root?: string;
  proposalsPath?: string;
  now?: string;
  /** Test/recovery seam: simulates interruption after the atomic rename but before the applied event. */
  afterPersonaRename?: () => void;
}

const MAX_PERSONA_BYTES = 512 * 1024;
const REQUIRED_CONTENT_TYPES = ["one_liner", "reply", "essay"] as const;
const PERSONA_PROPOSAL_ID = /^charles-persona-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function charlesRoot(root?: string): string { return root ?? join(repoRoot, "charles"); }
function personaPath(root?: string): string { return join(charlesRoot(root), "config", "persona.yaml"); }
function proposalsPath(path?: string): string { return path ?? dataPath("review", "charles-persona-proposals.jsonl"); }
export function digestCharlesPersona(yaml: string): string { return createHash("sha256").update(yaml, "utf8").digest("hex"); }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`schema-invalid persona: ${context}.${key} must be a non-empty string`);
  return value;
}
function requiredRecord(record: Record<string, unknown>, key: string, context = "persona"): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) throw new Error(`schema-invalid persona: ${context}.${key} must be an object`);
  return value;
}
function validHttpUrl(value: string): boolean {
  try { const url = new URL(value); return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname); }
  catch { return false; }
}

type Leak = { id: string; claim: string; source: string | null };

/** Parse and validate the complete production persona contract. No partial YAML is accepted. */
export function validateCharlesPersonaYaml(yaml: string): { value: Record<string, unknown>; leaks: Leak[] } {
  if (!yaml.trim()) throw new Error("malformed persona YAML: empty input");
  if (Buffer.byteLength(yaml, "utf8") > MAX_PERSONA_BYTES) throw new Error("malformed persona YAML: input is too large");
  if (yaml.includes("\0")) throw new Error("malformed persona YAML: NUL bytes are not allowed");
  const document = parseDocument(yaml, { uniqueKeys: true });
  if (document.errors.length) throw new Error(`malformed persona YAML: ${document.errors[0].message}`);
  const value = document.toJS({ maxAliasCount: 0 }) as unknown;
  if (!isRecord(value)) throw new Error("schema-invalid persona: root must be an object");

  const identity = requiredRecord(value, "identity");
  for (const key of ["full_name", "short_name", "species", "job", "secret"]) requiredString(identity, key, "identity");
  if (typeof identity.wants_help_ordinary_people !== "boolean") throw new Error("schema-invalid persona: identity.wants_help_ordinary_people must be boolean");

  const voice = requiredRecord(value, "voice");
  for (const key of ["register", "caps_and_exclamation", "structural_tic", "reassurance_loop", "avoid"]) requiredString(voice, key, "voice");
  if (!Array.isArray(voice.vocabulary) || voice.vocabulary.length === 0 || voice.vocabulary.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("schema-invalid persona: voice.vocabulary must contain non-empty strings");
  }

  const comicEngine = requiredRecord(value, "comic_engine");
  requiredString(comicEngine, "summary", "comic_engine");
  if (!Array.isArray(comicEngine.angles) || comicEngine.angles.length === 0) throw new Error("schema-invalid persona: comic_engine.angles must be a non-empty array");
  const angleIds = new Set<string>();
  for (const [index, raw] of comicEngine.angles.entries()) {
    if (!isRecord(raw)) throw new Error(`schema-invalid persona: comic_engine.angles[${index}] must be an object`);
    const id = requiredString(raw, "id", `comic_engine.angles[${index}]`);
    requiredString(raw, "category", `comic_engine.angles[${index}]`);
    requiredString(raw, "description", `comic_engine.angles[${index}]`);
    if (angleIds.has(id)) throw new Error(`schema-invalid persona: duplicate comic angle id ${id}`);
    angleIds.add(id);
  }

  const contentTypes = requiredRecord(value, "content_types");
  for (const type of REQUIRED_CONTENT_TYPES) {
    const entry = requiredRecord(contentTypes, type, "content_types");
    requiredString(entry, "length", `content_types.${type}`);
    requiredString(entry, "shape", `content_types.${type}`);
  }

  if (!Array.isArray(value.leak_bank) || value.leak_bank.length === 0) throw new Error("schema-invalid persona: leak_bank must be a non-empty array");
  const leakIds = new Set<string>();
  const leaks = value.leak_bank.map((raw, index): Leak => {
    if (!isRecord(raw)) throw new Error(`schema-invalid persona: leak_bank[${index}] must be an object`);
    const id = requiredString(raw, "id", `leak_bank[${index}]`);
    const claim = requiredString(raw, "claim", `leak_bank[${index}]`);
    if (leakIds.has(id)) throw new Error(`schema-invalid persona: duplicate leak id ${id}`);
    leakIds.add(id);
    if (raw.source !== null && (typeof raw.source !== "string" || !validHttpUrl(raw.source))) {
      throw new Error(`schema-invalid persona: leak_bank[${index}].source must be a valid HTTP(S) URL or null`);
    }
    return { id, claim, source: raw.source as string | null };
  });
  return { value, leaks };
}

function assertLeakSourcesRetained(beforeYaml: string, afterYaml: string): void {
  const before = validateCharlesPersonaYaml(beforeYaml).leaks;
  const after = new Map(validateCharlesPersonaYaml(afterYaml).leaks.map((leak) => [leak.id, leak]));
  for (const leak of before) {
    if (!leak.source) continue;
    const next = after.get(leak.id);
    if (!next) throw new Error(`leak-bank source retention failed: ${leak.id} was removed`);
    if (next.source !== leak.source) throw new Error(`leak-bank source retention failed: ${leak.id} source URL changed or was removed`);
  }
}

function proposalPayloadDigest(input: Pick<CharlesPersonaProposal, "id" | "beforeYaml" | "afterYaml" | "beforeDigest" | "afterDigest" | "proposedBy" | "proposedAt">): string {
  return digestCharlesPersona(JSON.stringify({
    id: input.id, beforeYaml: input.beforeYaml, afterYaml: input.afterYaml,
    beforeDigest: input.beforeDigest, afterDigest: input.afterDigest,
    proposedBy: input.proposedBy, proposedAt: input.proposedAt,
  }));
}

function verifyProposal(proposal: CharlesPersonaProposal): void {
  if (!PERSONA_PROPOSAL_ID.test(proposal.id)) throw new Error("tampered persona proposal: invalid server id");
  if (digestCharlesPersona(proposal.beforeYaml) !== proposal.beforeDigest) throw new Error("tampered persona proposal: before digest mismatch");
  if (digestCharlesPersona(proposal.afterYaml) !== proposal.afterDigest) throw new Error("tampered persona proposal: after digest mismatch");
  if (proposalPayloadDigest(proposal) !== proposal.payloadDigest) throw new Error("tampered persona proposal: payload digest mismatch");
  validateCharlesPersonaYaml(proposal.beforeYaml);
  validateCharlesPersonaYaml(proposal.afterYaml);
  assertLeakSourcesRetained(proposal.beforeYaml, proposal.afterYaml);
}

function personaEventDigest(event: Omit<PersonaProposalEvent, "eventDigest">): string {
  return digestCharlesPersona(JSON.stringify({
    event: event.event,
    proposalId: event.proposalId,
    at: event.at,
    actor: event.actor,
    payloadDigest: event.payloadDigest,
    evidence: event.evidence,
    ...(event.proposal ? { proposal: event.proposal } : {}),
    previousEventDigest: event.previousEventDigest,
  }));
}

function appendEvent(input: PersonaProposalEventInput, path: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const priorEvents = events(path);
  const previousEventDigest = priorEvents.length ? priorEvents[priorEvents.length - 1].eventDigest : null;
  const unsigned = { ...input, previousEventDigest };
  const event: PersonaProposalEvent = { ...unsigned, eventDigest: personaEventDigest(unsigned) };
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const fd = openSync(path, "a", 0o600);
  try {
    if (existing.length && !existing.endsWith("\n")) writeSync(fd, "\n");
    writeSync(fd, JSON.stringify(event) + "\n", undefined, "utf8");
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

function events(path: string): PersonaProposalEvent[] {
  if (!existsSync(path)) return [];
  const result: PersonaProposalEvent[] = [];
  let previousEventDigest: string | null = null;
  for (const [index, line] of readFileSync(path, "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    let event: PersonaProposalEvent;
    try { event = JSON.parse(line) as PersonaProposalEvent; }
    catch { throw new Error(`malformed persona proposal ledger at line ${index + 1}`); }
    if (!event || !["proposed", "approved", "rejected", "applied"].includes(event.event) || typeof event.proposalId !== "string" || typeof event.payloadDigest !== "string" || event.actor !== "muxin" || typeof event.at !== "string" || typeof event.evidence !== "string" || typeof event.eventDigest !== "string" || (event.previousEventDigest !== null && typeof event.previousEventDigest !== "string")) {
      throw new Error(`malformed persona proposal ledger at line ${index + 1}`);
    }
    if (event.previousEventDigest !== previousEventDigest || event.eventDigest !== personaEventDigest(event)) {
      throw new Error(`persona proposal event digest mismatch at line ${index + 1}`);
    }
    result.push(event);
    previousEventDigest = event.eventDigest;
  }
  return result;
}

export function readCharlesPersonaProposals(path?: string): CharlesPersonaProposal[] {
  const state = new Map<string, CharlesPersonaProposal>();
  for (const event of events(proposalsPath(path))) {
    if (event.event === "proposed") {
      if (!event.proposal || event.proposal.id !== event.proposalId || event.proposal.payloadDigest !== event.payloadDigest) throw new Error("tampered persona proposal event");
      verifyProposal(event.proposal);
      state.set(event.proposalId, { ...event.proposal });
      continue;
    }
    const proposal = state.get(event.proposalId);
    if (!proposal || proposal.payloadDigest !== event.payloadDigest) throw new Error("tampered persona proposal transition");
    if (event.event === "approved") {
      if (proposal.status !== "pending") throw new Error("malformed persona proposal transition: approval from non-pending state");
      proposal.status = "approved"; proposal.reviewedBy = "muxin"; proposal.reviewedAt = event.at; proposal.reviewEvidence = event.evidence;
    } else if (event.event === "rejected") {
      if (proposal.status !== "pending") throw new Error("malformed persona proposal transition: rejection from non-pending state");
      proposal.status = "rejected"; proposal.reviewedBy = "muxin"; proposal.reviewedAt = event.at; proposal.reviewEvidence = event.evidence;
    } else {
      if (proposal.status !== "approved") throw new Error("malformed persona proposal transition: apply without approval");
      proposal.status = "applied"; proposal.appliedAt = event.at;
    }
    verifyProposal(proposal);
  }
  return [...state.values()].sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));
}

export function readCharlesPersona(opts: CharlesPersonaOptions = {}): { yaml: string; digest: string; proposals: CharlesPersonaProposal[] } {
  const yaml = readFileSync(personaPath(opts.root), "utf8");
  validateCharlesPersonaYaml(yaml);
  return { yaml, digest: digestCharlesPersona(yaml), proposals: readCharlesPersonaProposals(opts.proposalsPath) };
}

export function proposeCharlesPersonaEdit(afterYaml: string, actor: "muxin", opts: CharlesPersonaOptions = {}): CharlesPersonaProposal {
  if (actor !== "muxin") throw new Error("only Muxin can propose a Charles persona edit");
  const root = charlesRoot(opts.root), path = proposalsPath(opts.proposalsPath);
  return withFileLock(join(root, "config", ".persona-edit.lock"), () => withFileLock(`${path}.transition.lock`, () => {
    const beforeYaml = readFileSync(personaPath(root), "utf8");
    validateCharlesPersonaYaml(beforeYaml);
    validateCharlesPersonaYaml(afterYaml);
    assertLeakSourcesRetained(beforeYaml, afterYaml);
    const beforeDigest = digestCharlesPersona(beforeYaml), afterDigest = digestCharlesPersona(afterYaml);
    if (beforeDigest === afterDigest) throw new Error("persona proposal has no changes");
    const proposedAt = opts.now ?? new Date().toISOString();
    const proposal: CharlesPersonaProposal = {
      id: `charles-persona-${randomUUID()}`, status: "pending", beforeYaml, afterYaml,
      beforeDigest, afterDigest, payloadDigest: "", proposedBy: actor, proposedAt,
    };
    proposal.payloadDigest = proposalPayloadDigest(proposal);
    appendEvent({ event: "proposed", proposalId: proposal.id, at: proposedAt, actor, payloadDigest: proposal.payloadDigest, evidence: "digest-bound old/new persona YAML saved for explicit review", proposal }, path);
    return proposal;
  }));
}

function atomicWriteExact(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    const fd = openSync(temporary, "wx", 0o600);
    try { writeSync(fd, value, undefined, "utf8"); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
  const directoryFd = openSync(dirname(path), "r");
  try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
}

export function approveCharlesPersonaProposal(id: string, evidence: string, actor: "muxin", opts: CharlesPersonaOptions = {}): CharlesPersonaProposal {
  if (actor !== "muxin") throw new Error("only Muxin can approve a Charles persona edit");
  const root = charlesRoot(opts.root), path = proposalsPath(opts.proposalsPath), at = opts.now ?? new Date().toISOString();
  return withFileLock(join(root, "config", ".persona-edit.lock"), () => withFileLock(`${path}.transition.lock`, () => {
    let proposal = readCharlesPersonaProposals(path).find((item) => item.id === id);
    if (!proposal) throw new Error("persona proposal not found");
    verifyProposal(proposal);
    const current = readFileSync(personaPath(root), "utf8"), currentDigest = digestCharlesPersona(current);
    if (proposal.status === "applied") return proposal;
    if (proposal.status === "rejected") throw new Error("rejected persona proposal cannot be approved");
    if (proposal.status === "pending") {
      if (currentDigest !== proposal.beforeDigest) throw new Error("stale persona proposal: production persona changed since preview");
      const reviewEvidence = evidence.trim();
      if (!reviewEvidence) throw new Error("approval evidence is required");
      appendEvent({ event: "approved", proposalId: id, at, actor, payloadDigest: proposal.payloadDigest, evidence: reviewEvidence }, path);
      proposal = readCharlesPersonaProposals(path).find((item) => item.id === id)!;
    }
    if (proposal.status !== "approved") throw new Error("only an approved persona proposal can be applied");
    if (currentDigest === proposal.afterDigest) {
      appendEvent({ event: "applied", proposalId: id, at, actor, payloadDigest: proposal.payloadDigest, evidence: "recovered exact reviewed persona after atomic rename" }, path);
      return readCharlesPersonaProposals(path).find((item) => item.id === id)!;
    }
    if (currentDigest !== proposal.beforeDigest) throw new Error("stale persona proposal: production persona changed since preview");
    atomicWriteExact(personaPath(root), proposal.afterYaml);
    opts.afterPersonaRename?.();
    appendEvent({ event: "applied", proposalId: id, at, actor, payloadDigest: proposal.payloadDigest, evidence: "atomically applied exact reviewed persona YAML" }, path);
    return readCharlesPersonaProposals(path).find((item) => item.id === id)!;
  }));
}

export function rejectCharlesPersonaProposal(id: string, evidence: string, actor: "muxin", opts: CharlesPersonaOptions = {}): CharlesPersonaProposal {
  if (actor !== "muxin") throw new Error("only Muxin can reject a Charles persona edit");
  const path = proposalsPath(opts.proposalsPath), at = opts.now ?? new Date().toISOString();
  return withFileLock(`${path}.transition.lock`, () => {
    const proposal = readCharlesPersonaProposals(path).find((item) => item.id === id);
    if (!proposal) throw new Error("persona proposal not found");
    verifyProposal(proposal);
    if (proposal.status === "rejected") return proposal;
    if (proposal.status !== "pending") throw new Error("only a pending persona proposal can be rejected");
    const reviewEvidence = evidence.trim();
    if (!reviewEvidence) throw new Error("rejection reason is required");
    appendEvent({ event: "rejected", proposalId: id, at, actor, payloadDigest: proposal.payloadDigest, evidence: reviewEvidence }, path);
    return readCharlesPersonaProposals(path).find((item) => item.id === id)!;
  });
}
