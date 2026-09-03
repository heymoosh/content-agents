import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseDocument } from "yaml";
import { repoRoot } from "../db/db.js";
import { dataPath } from "../runtime/data-root.js";
import type { SignalsRecommendationType } from "./signals-decisions.js";
import { withFileLock } from "../runtime/file-lock.js";
import { isBrandId, type BrandId } from "../identity/brand.js";

export type SignalsDelta =
  | { kind: "cadence"; file: "config/platforms.yaml"; platform: string; field: "posts_per_week"; before: number; after: number }
  | { kind: "routing"; file: "config/routing.yaml"; pillar: string; platform: string; before: boolean; after: boolean };
export type ProposalStatus = "pending" | "approved" | "applying" | "rejected" | "applied" | "apply_failed" | "blocked" | "superseded" | "rolled_back";

export interface SignalsChangeProposal {
  id: string;
  /** New proposals carry the caller's canonical brand scope; legacy rows are unassigned. */
  brandId?: BrandId;
  recommendation: { type: SignalsRecommendationType; title: string; rationale: string };
  status: ProposalStatus;
  configVersion: string;
  delta: SignalsDelta | null;
  blockedReason: string | null;
  proposedBy: "muxin";
  proposedAt: string;
  reviewedBy?: "muxin";
  reviewedAt?: string;
  reviewEvidence?: string;
  appliedAt?: string;
}

export type SignalsProposalEvent = {
  event: "proposed" | "blocked" | "approved" | "rejected" | "apply_intent" | "applied" | "apply_failed" | "superseded" | "rolled_back";
  proposalId: string;
  actor: "muxin" | "system";
  at: string;
  evidence: string;
  proposal?: SignalsChangeProposal;
  configVersion?: string;
  delta?: SignalsDelta;
};

export const SIGNALS_PROPOSALS_PATH = dataPath("review", "signals-change-proposals.jsonl");

function hashFiles(root: string): string {
  const hash = createHash("sha256");
  for (const rel of ["config/platforms.yaml", "config/routing.yaml"]) {
    hash.update(rel).update("\0").update(readFileSync(join(root, rel))).update("\0");
  }
  return hash.digest("hex");
}

export function signalsConfigVersion(root = repoRoot): string { return hashFiles(root); }

function currentDelta(title: string, root: string): SignalsDelta | null {
  let m = title.match(/^Set ([a-z0-9-]+) cadence to (\d+) posts?\/week$/i);
  if (m) {
    const platform = m[1].toLowerCase();
    const after = Number(m[2]);
    if (!Number.isInteger(after) || after < 1 || after > 14) return null;
    const doc = parseDocument(readFileSync(join(root, "config/platforms.yaml"), "utf8"));
    const before = doc.getIn(["platforms", platform, "posts_per_week"]);
    if (typeof before !== "number") return null;
    return { kind: "cadence", file: "config/platforms.yaml", platform, field: "posts_per_week", before, after };
  }
  m = title.match(/^(Route|Stop routing) ([a-z0-9-]+) (?:to|on) ([a-z0-9:-]+)$/i);
  if (m) {
    const after = m[1].toLowerCase() === "route";
    const pillar = m[2].toLowerCase();
    const platform = m[3].toLowerCase();
    const doc = parseDocument(readFileSync(join(root, "config/routing.yaml"), "utf8"));
    const values = (doc.toJS() as { defaults?: Record<string, unknown> }).defaults?.[pillar];
    if (!Array.isArray(values) || !/^(x|linkedin|bluesky|mastodon|threads|community:[a-z0-9-]+)$/.test(platform)) return null;
    return { kind: "routing", file: "config/routing.yaml", pillar, platform, before: values.includes(platform), after };
  }
  return null;
}

function appendUnlocked(event: SignalsProposalEvent, path: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current.length && !current.endsWith("\n")) appendFileSync(path, "\n");
  const fd = openSync(path, "a", 0o600);
  try { writeSync(fd, JSON.stringify(event) + "\n", undefined, "utf8"); fsyncSync(fd); }
  finally { closeSync(fd); }
}

function append(event: SignalsProposalEvent, path: string): void {
  withFileLock(`${path}.lock`, () => appendUnlocked(event, path));
}
function withTransition<T>(path: string, fn: () => T): T { return withFileLock(`${path}.transition.lock`, fn); }

function readEvents(path: string): SignalsProposalEvent[] {
  if (!existsSync(path)) return [];
  const events: SignalsProposalEvent[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    try { const e = JSON.parse(line) as SignalsProposalEvent; if (e?.proposalId && e.event) events.push(e); }
    catch { /* preserve the valid append-only prefix */ }
  }
  return events;
}

export function readSignalsProposals(path = SIGNALS_PROPOSALS_PATH): SignalsChangeProposal[] {
  const state = new Map<string, SignalsChangeProposal>();
  for (const e of readEvents(path)) {
      if (e.proposal) state.set(e.proposalId, e.proposal);
      else {
        const p = state.get(e.proposalId); if (!p) continue;
        p.status = e.event === "apply_intent" ? "applying" : e.event as ProposalStatus;
        if (e.event === "approved" || e.event === "rejected") { p.reviewedBy = "muxin"; p.reviewedAt = e.at; p.reviewEvidence = e.evidence; }
        if (e.event === "applied") p.appliedAt = e.at;
      }
  }
  return [...state.values()].sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));
}

export function proposeSignalsChange(input: { type: SignalsRecommendationType; title: string; rationale: string; actor: "muxin"; brandId?: BrandId }, opts: { root?: string; path?: string; now?: string } = {}): SignalsChangeProposal {
  if (input.brandId !== undefined && !isBrandId(input.brandId)) throw new Error("a Signals proposal needs a valid brand id");
  const root = opts.root ?? repoRoot, path = opts.path ?? SIGNALS_PROPOSALS_PATH, now = opts.now ?? new Date().toISOString();
  return withFileLock(`${path}.lock`, () => {
    const version = signalsConfigVersion(root);
    const existing = readSignalsProposals(path).find(p => p.brandId === input.brandId && p.recommendation.type === input.type && p.recommendation.title === input.title && p.configVersion === version && ["pending", "approved", "applied", "blocked"].includes(p.status));
    if (existing) return existing;
    for (const old of readSignalsProposals(path).filter(p => p.brandId === input.brandId && p.recommendation.type === input.type && p.recommendation.title === input.title && ["pending", "approved"].includes(p.status)))
      appendUnlocked({ event: "superseded", proposalId: old.id, actor: "system", at: now, evidence: `superseded by a proposal against config ${version}` }, path);
    const delta = currentDelta(input.title.trim(), root);
    const proposal: SignalsChangeProposal = { id: randomUUID(), ...(input.brandId ? { brandId: input.brandId } : {}), recommendation: { type: input.type, title: input.title.trim(), rationale: input.rationale.trim() }, status: delta ? "pending" : "blocked", configVersion: version, delta, blockedReason: delta ? null : "Recommendation is outside the current allowlist. Supported forms are routing and posts/week cadence changes.", proposedBy: input.actor, proposedAt: now };
    appendUnlocked({ event: delta ? "proposed" : "blocked", proposalId: proposal.id, actor: input.actor, at: now, evidence: delta ? "intent recorded; exact allowlisted delta previewed" : proposal.blockedReason!, proposal }, path);
    return proposal;
  });
}

export function reviewSignalsProposal(id: string, action: "approve" | "reject", evidence: string, actor: "muxin", opts: { path?: string; now?: string } = {}): SignalsChangeProposal {
  const path = opts.path ?? SIGNALS_PROPOSALS_PATH;
  return withTransition(path, () => {
    const p = readSignalsProposals(path).find(x => x.id === id);
    if (!p || p.status !== "pending") throw new Error("only a pending Signals proposal can be reviewed");
    if (!evidence.trim()) throw new Error("review evidence is required");
    append({ event: action === "approve" ? "approved" : "rejected", proposalId: id, actor, at: opts.now ?? new Date().toISOString(), evidence: evidence.trim() }, path);
    return readSignalsProposals(path).find(x => x.id === id)!;
  });
}

function updateConfig(delta: SignalsDelta, root: string, reverse = false): void {
  const path = join(root, delta.file), doc = parseDocument(readFileSync(path, "utf8"));
  const target = reverse ? delta.before : delta.after;
  if (delta.kind === "cadence") doc.setIn(["platforms", delta.platform, delta.field], target);
  else {
    const key = ["defaults", delta.pillar], values = ((doc.toJS() as { defaults: Record<string, string[]> }).defaults[delta.pillar]);
    const next = values.filter(x => x !== delta.platform);
    if (target) next.push(delta.platform);
    doc.setIn(key, next);
  }
  const temp = `${path}.signals-${process.pid}.tmp`;
  writeFileSync(temp, String(doc), { encoding: "utf8", mode: 0o600 }); renameSync(temp, path);
}

function currentDeltaValue(delta: SignalsDelta, root: string): number | boolean {
  const doc = parseDocument(readFileSync(join(root, delta.file), "utf8"));
  return delta.kind === "cadence"
    ? doc.getIn(["platforms", delta.platform, delta.field]) as number
    : (doc.toJS() as { defaults: Record<string, string[]> }).defaults[delta.pillar].includes(delta.platform);
}

/** Recover a write-ahead apply intent after process restart without making a silent guess. */
function reconcileSignalsApplyIntentsUnlocked(opts: { root?: string; path?: string; now?: string } = {}): SignalsChangeProposal[] {
  const root = opts.root ?? repoRoot, path = opts.path ?? SIGNALS_PROPOSALS_PATH;
  const events = readEvents(path), completed = new Set(events.filter(e => e.event === "applied" || e.event === "apply_failed").map(e => e.proposalId));
  for (const intent of events.filter(e => e.event === "apply_intent" && !completed.has(e.proposalId))) {
    const p = readSignalsProposals(path).find(x => x.id === intent.proposalId), delta = intent.delta ?? p?.delta;
    if (!p || !delta) continue;
    const current = currentDeltaValue(delta, root);
    if (current === delta.after) {
      append({ event: "applied", proposalId: p.id, actor: "system", at: opts.now ?? new Date().toISOString(), evidence: `recovered apply intent: config contains the exact preview in ${delta.file}` }, path);
    } else {
      const safe = current === delta.before;
      append({ event: "apply_failed", proposalId: p.id, actor: "system", at: opts.now ?? new Date().toISOString(), evidence: safe ? "recovered apply intent: config remains at exact before value; no mutation to roll back" : "recovered apply intent: config matches neither exact before nor after; refused recovery mutation" }, path);
    }
  }
  return readSignalsProposals(path);
}
export function reconcileSignalsApplyIntents(opts: { root?: string; path?: string; now?: string } = {}): SignalsChangeProposal[] {
  const path = opts.path ?? SIGNALS_PROPOSALS_PATH;
  return withTransition(path, () => withFileLock(`${opts.root ?? repoRoot}/config/.signals-change.lock`, () => reconcileSignalsApplyIntentsUnlocked(opts)));
}

export function applySignalsProposal(id: string, actor: "muxin", opts: { root?: string; path?: string; now?: string; afterConfigRename?: () => void } = {}): SignalsChangeProposal {
  const root = opts.root ?? repoRoot, path = opts.path ?? SIGNALS_PROPOSALS_PATH;
  return withTransition(path, () => withFileLock(join(root, "config", ".signals-change.lock"), () => {
  reconcileSignalsApplyIntentsUnlocked({ root, path, now: opts.now });
  const p = readSignalsProposals(path).find(x => x.id === id);
  if (!p) throw new Error("Signals proposal not found");
  if (p.status === "applied") return p;
  if (p.status === "apply_failed") throw new Error("incomplete apply recovery found a config conflict; create a new proposal");
  if (p.status !== "approved" || !p.delta) throw new Error("only an approved allowlisted proposal can be applied");
  if (p.brandId !== undefined && p.brandId !== "human-inference") throw new Error("brand-specific configuration is not available; refusing to mutate shared configuration");
  if (signalsConfigVersion(root) !== p.configVersion) throw new Error("configuration changed since preview; create a new proposal");
  append({ event: "apply_intent", proposalId: id, actor, at: opts.now ?? new Date().toISOString(), evidence: `write-ahead intent for exact preview in ${p.delta.file}`, configVersion: p.configVersion, delta: p.delta }, path);
  updateConfig(p.delta, root);
  opts.afterConfigRename?.();
  append({ event: "applied", proposalId: id, actor, at: opts.now ?? new Date().toISOString(), evidence: `applied exact preview to ${p.delta.file}` }, path);
  return readSignalsProposals(path).find(x => x.id === id)!;
  }));
}

export function rollbackSignalsProposal(id: string, evidence: string, actor: "muxin", opts: { root?: string; path?: string; now?: string } = {}): SignalsChangeProposal {
  const root = opts.root ?? repoRoot, path = opts.path ?? SIGNALS_PROPOSALS_PATH;
  return withTransition(path, () => withFileLock(join(root, "config", ".signals-change.lock"), () => {
  const p = readSignalsProposals(path).find(x => x.id === id);
  if (!p || p.status !== "applied" || !p.delta) throw new Error("only an applied proposal can be rolled back");
  const doc = parseDocument(readFileSync(join(root, p.delta.file), "utf8"));
  const current = p.delta.kind === "cadence" ? doc.getIn(["platforms", p.delta.platform, p.delta.field]) : (doc.toJS() as { defaults: Record<string, string[]> }).defaults[p.delta.pillar].includes(p.delta.platform);
  if (current !== p.delta.after) throw new Error("configuration changed since apply; refusing rollback");
  updateConfig(p.delta, root, true);
  append({ event: "rolled_back", proposalId: id, actor, at: opts.now ?? new Date().toISOString(), evidence: evidence.trim() || "Muxin requested rollback" }, path);
  return readSignalsProposals(path).find(x => x.id === id)!;
  }));
}
