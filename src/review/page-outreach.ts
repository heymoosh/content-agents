import {
  conciseFitSummary,
  contactDiscoveryState,
  filterOutreachRecommendations,
  gmailSendReadiness,
  type GmailConnectionState,
} from "./outreach-domain.js";

export type OutreachEngine = "codex" | "grok";

export const OUTREACH_ENGINE_OPTIONS: readonly { value: OutreachEngine; label: string }[] = [
  { value: "codex", label: "ChatGPT" },
  { value: "grok", label: "Grok" },
];

export function isOutreachEngine(value: unknown): value is OutreachEngine {
  return value === "codex" || value === "grok";
}

function requireOutreachEngine(value: unknown): OutreachEngine {
  // Missing selection gets the deliberate GPT/Codex default. An explicit Claude or unknown
  // selection is a caller error and must not be silently remapped to another model.
  if (value === undefined) return "codex";
  if (!isOutreachEngine(value)) throw new Error(`Outreach engine must be ChatGPT or Grok; received ${String(value)}`);
  return value;
}

function escOutreach(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

/** Render the main list from fit-cleared leads only. The caller can attach its existing selection handler. */
export function renderOutreachRecommendations(leads: OutreachLeadView[]): string {
  const eligible = filterOutreachRecommendations(leads.map((lead) => ({
    ...lead,
    kind: lead.kind ?? "",
    classification: lead.classification ?? (lead.kind !== "platform" ? lead.classificationOrFit : undefined),
    fit: lead.fit ?? (lead.kind === "platform" ? lead.classificationOrFit : undefined),
  })));
  if (!eligible.length) return '<div class="outreach-empty">No good-fit leads yet.</div>';
  return eligible.map((lead) =>
    `<button type="button" class="outreach-recommendation" data-outreach-dir="${escOutreach(lead.dir)}">` +
    `<span class="outreach-recommendation-name">${escOutreach(lead.name || lead.dir)}</span>` +
    `<span class="outreach-recommendation-fit">${escOutreach(conciseFitSummary(lead))}</span></button>`,
  ).join("");
}

/** Render the focused writing surface. Sending stays manual and is recorded only after the user confirms it. */
export function renderSelectedOutreachComposer(lead: OutreachLeadView, gmail: GmailConnectionState = {}): string {
  const summary = conciseFitSummary(lead);
  const contacts = contactDiscoveryState({ contacts: lead.contacts });
  const contactCopy = contacts.state === "found"
    ? contacts.contacts.map((contact) => `${escOutreach(contact.name)}${contact.role ? ` · ${escOutreach(contact.role)}` : ""}`).join(", ")
    : contacts.state === "not-searched" ? "Contact discovery has not run yet." : "No contact found yet.";
  return `<section class="outreach-composer" data-outreach-dir="${escOutreach(lead.dir)}">` +
    `<h3>${escOutreach(lead.name || lead.dir)}</h3>` +
    `<p class="outreach-fit-summary">${escOutreach(summary)}</p>` +
    `<div class="outreach-decision"><button type="button" class="outreach-pursue">Interested</button><button type="button" class="outreach-pass">Not for me</button></div>` +
    `<details class="outreach-why"><summary>Why this lead?</summary><p class="outreach-angle">${escOutreach(lead.pitchAngle || "No angle recorded yet.")}</p></details>` +
    `<label for="outreachDirection">What can you discuss?</label>` +
    `<textarea id="outreachDirection" name="direction" rows="3"></textarea>` +
    `<label for="outreachMessageEditor">Message to edit before sending</label>` +
    `<textarea id="outreachMessageEditor" name="message" rows="10"></textarea>` +
    `<label for="outreachEngine">Draft with</label><select id="outreachEngine" class="engine-select">` +
    OUTREACH_ENGINE_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join("") + `</select>` +
    `<p class="outreach-contacts"><strong>Contact:</strong> ${contactCopy}</p>` +
    `<button type="button" class="outreach-draft">Draft outreach note</button>` +
    `<button type="button" class="outreach-copy">Copy message</button>` +
    (gmailSendReadiness(gmail).ready ? `<button type="button" class="outreach-send">Send with Gmail</button>` : "") +
    `<button type="button" class="outreach-mark-sent">I sent this by hand</button>` +
    `</section>`;
}

export function followupDraftRequest(dir: string, person?: string, engine?: unknown): { dir: string; recipient?: string; engine: OutreachEngine } {
  return { dir, ...(person ? { recipient: person } : {}), engine: requireOutreachEngine(engine) };
}

export function outreachDraftRequest(dir: string, direction: string, recipient?: string, engine?: unknown): { dir: string; direction: string; recipient?: string; engine: OutreachEngine } {
  return { dir, direction, ...(recipient ? { recipient } : {}), engine: requireOutreachEngine(engine) };
}

export function outreachMessageReviseRequest(dir: string, file: string, instruction: string, engine?: unknown): { dir: string; file: string; instruction: string; engine: OutreachEngine } {
  return { dir, file, instruction, engine: requireOutreachEngine(engine) };
}

export interface OutreachContactView { name: string; role?: string; }
export interface OutreachEvidenceView { id?: string; signal?: string; person?: string; source?: string; quote?: string; description?: string; captured_at?: string | null; }
export interface OutreachMessageView { file?: string; channel?: string; status?: string; recipient?: string; body?: string; }
export interface OutreachLeadView {
  dir: string;
  kind?: string;
  classification?: string;
  fit?: string;
  classificationOrFit?: string;
  name?: string;
  source?: string;
  status?: string;
  segment?: string;
  pitchAngle?: string;
  pitch?: string;
  whyThem?: string;
  whyMe?: string;
  whyMutual?: string;
  contacts?: OutreachContactView[];
  evidence?: OutreachEvidenceView[];
  latestMessage?: OutreachMessageView | null;
}

export function outreachSegment(lead: OutreachLeadView): string {
  if (lead.segment) return lead.segment;
  if (lead.kind === "platform") return "platform";
  if (lead.kind === "peer") return "peer";
  if (lead.kind === "client") return lead.source === "jsa" ? "org-role" : "org-mission";
  return "content-example";
}

export const OUTREACH_SEGMENTS: { key: string; name: string; note: string }[] = [
  { key: "platform", name: "PLATFORMS", note: "Where the audience already is. Bring the work, not a pitch." },
  { key: "peer", name: "PEERS", note: "People to know. An intro, not a pitch." },
  { key: "org-mission", name: "ORGANIZATIONS · MISSION FIT", note: "They do the thing you write about. Bring the overlap." },
  { key: "org-role", name: "ORGANIZATIONS · OPEN ROLES", note: "They are hiring for what you already built. Bring the receipt." },
  { key: "content-example", name: "EXAMPLES", note: "raw material for a writing angle" },
];

export function groupLeadsBySegment(leads: OutreachLeadView[]): { key: string; name: string; note: string; leads: OutreachLeadView[] }[] {
  return OUTREACH_SEGMENTS.map((s) => ({ ...s, leads: leads.filter((l) => outreachSegment(l) === s.key) })).filter((g) => g.leads.length > 0);
}

export function lastPitchedLabel(lastTouch: string | null | undefined): string {
  const t = (lastTouch ?? "").trim();
  return t ? `pitched ${t.slice(0, 10)}, by hand` : "never pitched";
}

export function threadSegLabel(segment: string): string {
  if (segment === "platform") return "PLATFORM · SELECTED";
  if (segment === "peer") return "PEER · SELECTED";
  if (segment === "org-mission") return "MISSION FIT · SELECTED";
  if (segment === "org-role") return "OPEN ROLE · SELECTED";
  return "EXAMPLE · SELECTED";
}

export function matchmakerRead(lead: OutreachLeadView): { legacy: boolean; headline: string; rows: { k: string; v: string }[] } {
  const hasMatchmaker = !!(lead.whyMutual || lead.whyThem || lead.whyMe);
  if (!hasMatchmaker) return { legacy: true, headline: (lead.pitchAngle || lead.pitch || "").trim() || "(no read recorded yet)", rows: [] };
  const rows: { k: string; v: string }[] = [];
  if (lead.whyThem) rows.push({ k: "Why them, for you", v: lead.whyThem });
  if (lead.whyMe) rows.push({ k: "Why you, for them", v: lead.whyMe });
  if (lead.whyMutual) rows.push({ k: "Why the two of you", v: lead.whyMutual });
  return { legacy: false, headline: (lead.whyMutual || lead.whyThem || lead.whyMe || "").trim(), rows };
}

export function contactsLine(contacts: OutreachContactView[] | undefined): string {
  const n = (contacts ?? []).length;
  if (n === 0) return "No named contact yet. Add one, or write to the organization.";
  if (n === 1) {
    const name = (contacts ?? [])[0].name;
    return `You are writing to ${name}${/[.!?]$/.test(name) ? "" : "."}`;
  }
  return `${n} people here. Each one gets its own message and its own follow-up clock.`;
}

const OUTREACH_PLACEHOLDER_SOURCES = new Set(["(none)", "none", "n/a", "na", "tbd", "unknown", ""]);
export function isEvidenceSourceValid(source: string | undefined): boolean {
  const trimmed = (source ?? "").trim();
  if (!trimmed || OUTREACH_PLACEHOLDER_SOURCES.has(trimmed.toLowerCase())) return false;
  if (/^vault:/i.test(trimmed)) {
    const path = trimmed.slice("vault:".length).trim();
    return path.length > 0 && !OUTREACH_PLACEHOLDER_SOURCES.has(path.toLowerCase());
  }
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try { return new URL(trimmed).hostname.includes("."); } catch { return false; }
}

export const NO_SOURCE_RECORDED = "no source recorded";
export function evidenceSourceView(source: string | undefined): { kind: "link" | "text" | "none"; text: string } {
  const trimmed = (source ?? "").trim();
  if (!isEvidenceSourceValid(trimmed)) return { kind: "none", text: NO_SOURCE_RECORDED };
  if (/^https?:\/\//i.test(trimmed)) return { kind: "link", text: trimmed };
  return { kind: "text", text: trimmed };
}

export const NO_CAPTURE_DATE_RECORDED = "no capture date recorded";
export function evidenceCapturedView(capturedAt: string | null | undefined): { dated: boolean; text: string } {
  const trimmed = (capturedAt ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { dated: false, text: NO_CAPTURE_DATE_RECORDED };
  return { dated: true, text: "captured " + trimmed };
}

export type OutreachSendState = "none" | "draft" | "locked";
export function outreachSendState(message: OutreachMessageView | null | undefined): OutreachSendState {
  if (!message) return "none";
  return (message.status ?? "").trim() === "locked" ? "locked" : "draft";
}
export function outreachSendNote(state: OutreachSendState): string {
  if (state === "draft") return "Locking readies it. You send it by hand, and nothing here can send it for you.";
  if (state === "locked") return "Copy the locked message, send it in the channel you choose, then record that you sent it.";
  return "";
}
export function outreachSendBadge(state: OutreachSendState, hasLoggedSend: boolean): string {
  if (state !== "locked") return "";
  return hasLoggedSend ? "LOCKED · NOT EDITABLE" : "LOCKED · NOT EDITABLE, NOT SENT";
}
export function leadSendLogLine(lastTouch: string | null | undefined): string {
  const t = (lastTouch ?? "").trim();
  return t ? `A send was logged ${t.slice(0, 10)}, by hand. See Follow-ups.` : "";
}

export type OutreachThreadPhase = "asking" | "drafting" | "drafted";
export function outreachThreadPhase(message: OutreachMessageView | null | undefined, drafting: boolean): OutreachThreadPhase {
  if (drafting) return "drafting";
  return message ? "drafted" : "asking";
}
export function firstSentence(text: string | undefined, cap: number): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const m = t.match(/^[\s\S]*?[.?!](?=\s|$)/);
  let s = (m ? m[0] : t).trim();
  if (s.length > cap) s = `${s.slice(0, cap).replace(/[\s,;:]+\S*$/, "")}...`;
  return s;
}
export function outreachOpeningLine(lead: OutreachLeadView): string {
  const who = (lead.name || lead.dir || "this one").trim();
  const read = matchmakerRead(lead);
  const reason = firstSentence(read.headline, 180);
  if (!reason || reason === "(no read recorded yet)") return `I put ${who} in front of you, and there is no research read on file yet. Tell me what you want this message to say and I will write it in your voice.`;
  const tail = /[.?!]$/.test(reason) ? "" : ".";
  return `I put ${who} in front of you for this reason: ${reason}${tail} Want to lead with that, or keep it short and just ask for a quick chat?`;
}
