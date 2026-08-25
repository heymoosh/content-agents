export function followupDraftRequest(dir: string, person?: string, engine = "claude"): { dir: string; recipient?: string; engine: string } {
  return { dir, ...(person ? { recipient: person } : {}), engine: engine || "claude" };
}

export function outreachDraftRequest(dir: string, direction: string, recipient?: string, engine = "claude"): { dir: string; direction: string; recipient?: string; engine: string } {
  return { dir, direction, ...(recipient ? { recipient } : {}), engine: engine || "claude" };
}

export function outreachMessageReviseRequest(dir: string, file: string, instruction: string, engine = "claude"): { dir: string; file: string; instruction: string; engine: string } {
  return { dir, file, instruction, engine: engine || "claude" };
}

export interface OutreachContactView { name: string; role?: string; }
export interface OutreachEvidenceView { id?: string; signal?: string; person?: string; source?: string; quote?: string; description?: string; captured_at?: string | null; }
export interface OutreachMessageView { file?: string; channel?: string; status?: string; recipient?: string; body?: string; }
export interface OutreachLeadView {
  dir: string;
  kind?: string;
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
  if (lead.kind === "client") return lead.source === "jsa" ? "org-role" : "org-mission";
  return "content-example";
}

export const OUTREACH_SEGMENTS: { key: string; name: string; note: string }[] = [
  { key: "platform", name: "PLATFORMS", note: "Where the audience already is. Bring the work, not a pitch." },
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
  if (state === "locked") return "Paste it into your mail client and send it there. Tell me once it has gone.";
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
