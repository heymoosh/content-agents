import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { loadOutreachConfig, type OutreachConfig, type FollowUpBucket } from "./config.js";
import { listByVerdict, type JsaRecord } from "./jsa.js";

// Follow-up tracker (docs/outreach-engine-plan.md §3 "Follow-up tracker" + §6 Phase 4, backlog
// card 659b50f0 / 21a5eb84). Append-only event log, same pattern as
// data/notes-spread-ledger.jsonl / data/publish-schedule.jsonl: current state for any lead is
// always DERIVED by folding its events, never stored directly.
//
// Canonical-state split (plan §3): a lead's outreach/leads/<dir>/lead.md frontmatter owns
// pre-send lifecycle state (intake -> locked). This file owns post-send state (contacted ->
// done/abandoned). The Follow-ups tab reads ONLY this file plus each lead's locked message for
// context -- it never reads lead.md's own `status` field.

export type Bucket = FollowUpBucket;
export const BUCKETS: readonly Bucket[] = ["client", "platform", "inbound", "jobsearch"];
export function isBucket(x: string): x is Bucket {
  return (BUCKETS as readonly string[]).includes(x);
}

export type TrackerEventType =
  | "contacted"
  | "responded"
  | "no_response"
  | "followup_sent"
  | "scheduled"
  | "done"
  | "abandoned"
  | "re_researched"
  | "inbound_received";

export interface TrackerEvent {
  ts: string; // ISO timestamp
  lead: string; // outreach/leads/<dir> basename (client/platform), JSA company name (jobsearch), or a free-form id (inbound)
  bucket: Bucket;
  event: TrackerEventType;
  // The PERSON this touch concerns (design: "Different people at the same org get separate
  // clocks, both linked to the one org dossier"). Absent on lead-level events (the pre-person
  // rows) and on buckets that key on a person already (inbound handles).
  person?: string;
  channel?: string;
  message?: string;
  next?: string;
  due?: string;
  note?: string;
}

export const TRACKER_PATH = join(repoRoot, "data", "outreach", "tracker.jsonl");

// `path` is injectable so tests never touch the real committed ledger (mirrors
// src/cron/ledger.ts's notes-spread-ledger.jsonl pattern).
export function appendTrackerEvent(event: TrackerEvent, path: string = TRACKER_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(event) + "\n");
}

// Skips (rather than throws on) an unparseable line -- appendFileSync isn't atomic, so a crash
// mid-append can leave a truncated final line; one bad line shouldn't take down the whole tab.
export function readTrackerEvents(path: string = TRACKER_PATH): TrackerEvent[] {
  if (!existsSync(path)) return [];
  const events: TrackerEvent[] = [];
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    try {
      events.push(JSON.parse(line) as TrackerEvent);
    } catch {
      // skip malformed line
    }
  }
  return events;
}

export type LeadStatus = "not_contacted" | "waiting" | "due" | "overdue" | "responded" | "scheduled" | "done" | "abandoned";

export interface LeadState {
  lead: string;
  bucket: Bucket;
  lastEvent: TrackerEventType | null;
  lastTouch: string | null; // ISO ts of the most recent event
  lastNote?: string;
  channel?: string;
  status: LeadStatus;
  dueDate: string | null; // YYYY-MM-DD -- a follow-up touch is due
  abandonDate: string | null; // YYYY-MM-DD -- "move on" becomes a legal, non-punitive outcome
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Events whose most recent occurrence has no further due-date pressure -- Muxin has already moved
// this lead past the plain "waiting on a reply" clock.
const TERMINAL_STATUS: Partial<Record<TrackerEventType, LeadStatus>> = {
  responded: "responded",
  scheduled: "scheduled",
  done: "done",
  abandoned: "abandoned",
};

// Fold every event for ONE lead (already filtered to one lead+bucket) into its current state.
// Most-recent event (by ts) wins. contacted/followup_sent/no_response (re)start the follow-up
// clock from that event's own date (an event-supplied `due` overrides the computed date, so a
// human-authored event can set its own). re_researched legally resets the lead to
// "not_contacted" (plan §3: "an unclear lead can re-enter the pipeline when new evidence
// appears"). inbound_received is the mirror case for the inbound bucket: someone else spoke
// first, so there's no due-date clock on MUXIN yet -- the ball is in her court, same
// "not_contacted"-shaped state (nextActionLabel gives it inbound-specific copy), until she
// actually replies with a normal contacted/followup_sent event and the shared clock takes over.
// A later inbound_received after she's replied correctly flips the row back (latest-event-wins).
// Everything else in TERMINAL_STATUS has no due-date pressure at all.
export function foldLeadEvents(
  leadKey: string,
  bucket: Bucket,
  events: TrackerEvent[],
  config: OutreachConfig,
  nowIso: string = new Date().toISOString(),
): LeadState {
  if (events.length === 0) {
    return { lead: leadKey, bucket, lastEvent: null, lastTouch: null, status: "not_contacted", dueDate: null, abandonDate: null };
  }
  const sorted = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  const latest = sorted[sorted.length - 1];
  // The channel survives channel-less events: a nudge or reply doesn't change HOW Muxin first
  // reached out, so the row keeps showing the channel from the last event that named one.
  const channel = latest.channel ?? [...sorted].reverse().find((e) => e.channel)?.channel;

  if (latest.event === "re_researched" || latest.event === "inbound_received") {
    return {
      lead: leadKey, bucket, lastEvent: latest.event, lastTouch: latest.ts, lastNote: latest.note,
      channel, status: "not_contacted", dueDate: null, abandonDate: null,
    };
  }

  const terminal = TERMINAL_STATUS[latest.event];
  if (terminal) {
    return {
      lead: leadKey, bucket, lastEvent: latest.event, lastTouch: latest.ts, lastNote: latest.note,
      channel, status: terminal, dueDate: null, abandonDate: null,
    };
  }

  // contacted | followup_sent | no_response: (re)start the clock.
  const windows = config.followUp[bucket];
  const clockStart = latest.ts.slice(0, 10);
  const dueDate = latest.due ?? addDaysIso(clockStart, windows.followUpAfterDays);
  const abandonDate = addDaysIso(clockStart, windows.abandonAfterDays);
  const today = nowIso.slice(0, 10);
  const status: LeadStatus = today >= abandonDate ? "overdue" : today >= dueDate ? "due" : "waiting";
  return {
    lead: leadKey, bucket, lastEvent: latest.event, lastTouch: latest.ts, lastNote: latest.note,
    channel, status, dueDate, abandonDate,
  };
}

// Plain, calm next-step text -- explicit anti-pattern from backlog card 659b50f0: no CRM
// aesthetics, no red-alert/guilt-inducing overdue styling, "abandon" reads as closing a chapter,
// not failure. Kept as a single line of copy here so the GUI never invents its own wording.
export function nextActionLabel(state: LeadState): string {
  switch (state.status) {
    case "not_contacted":
      // Inbound v. outbound share every other state's mechanics -- this is the one place they
      // diverge: an inbound lead in "not_contacted" means someone else spoke first and Muxin
      // owes a reply, not that nobody's reached out yet.
      return state.bucket === "inbound" ? "draft reply" : "not yet contacted";
    case "waiting":
      return `waiting${state.dueDate ? ` (check back ${state.dueDate})` : ""}`;
    case "due":
      return `follow up${state.dueDate ? ` (due ${state.dueDate})` : ""}`;
    case "overdue":
      return `worth considering moving on${state.abandonDate ? ` (past ${state.abandonDate})` : ""}`;
    case "responded":
      return "responded — plan the next step";
    case "scheduled":
      return "scheduled";
    case "done":
      return "done";
    case "abandoned":
      return "closed — moved on";
  }
}

export interface FollowupRow {
  key: string; // `${bucket}:${lead}:${person}` -- unique row id for the GUI's row actions
  bucket: Bucket;
  lead: string; // the tracker `lead` key (what mark-responded/move-on/draft-follow-up address)
  person?: string; // set when this row is one person's clock at a multi-contact lead
  who: string;
  why: string;
  dir?: string; // repo-relative outreach/leads/<dir>, client/platform rows only (draft-follow-up target)
  channel?: string;
  lastTouch: string | null;
  lastEvent: TrackerEventType | null;
  status: LeadStatus;
  nextAction: string;
  dueDate: string | null;
  abandonDate: string | null;
  // Origin context (design 3g: "you won't have to remember any of it"): what you said (locked
  // message excerpt + file) and the dossier's fit read -- client/platform rows only.
  saidExcerpt?: string;
  messageFile?: string;
  fit?: string;
}

function rowFromState(state: LeadState, who: string, why: string, dir?: string, person?: string): FollowupRow {
  return {
    key: `${state.bucket}:${state.lead}:${person ?? ""}`,
    bucket: state.bucket,
    lead: state.lead,
    ...(person ? { person } : {}),
    who,
    why,
    dir,
    channel: state.channel,
    lastTouch: state.lastTouch,
    lastEvent: state.lastEvent,
    status: state.status,
    nextAction: nextActionLabel(state),
    dueDate: state.dueDate,
    abandonDate: state.abandonDate,
  };
}

const LEADS_ROOT = join(repoRoot, "outreach", "leads");

export interface LockedMessageInfo {
  messageId: string;
  channel?: string;
  excerpt?: string; // first line-ish of the locked body -- the ledger's "What you said" cell
}

// The most recently LOCKED message under a lead folder's messages/ dir, if any -- draft.ts
// numbers messages sequentially (message-01, message-02, ...) and a follow-up touch reframes
// the current locked core message (plan §5 stage 9), so the highest-numbered locked one wins.
// Exported for serve.ts's mark-sent route: the message a first send most plausibly refers to.
export function latestLockedMessage(leadDirAbs: string): LockedMessageInfo | null {
  const messagesDir = join(leadDirAbs, "messages");
  if (!existsSync(messagesDir)) return null;
  const files = readdirSync(messagesDir).filter((f) => /^message-\d+\.md$/.test(f)).sort();
  let latest: LockedMessageInfo | null = null;
  for (const f of files) {
    const { fm, body } = splitFrontmatter(readFileSync(join(messagesDir, f), "utf8"));
    if (String(fm.status ?? "") === "locked") {
      const excerpt = body.trim().replace(/\s+/g, " ").slice(0, 160);
      latest = {
        messageId: f.replace(/\.md$/, ""),
        channel: typeof fm.channel === "string" ? fm.channel : undefined,
        excerpt: excerpt || undefined,
      };
    }
  }
  return latest;
}

// client/platform rows: fold tracker.jsonl into every outreach/leads/<kind>-* folder. A lead only
// becomes a Follow-ups row once it has EITHER a locked message (ready to send/sent) OR at least
// one tracker event on file -- the canonical-state split means a lead still mid-pipeline (no
// locked message, no post-send state yet) belongs on the Outreach tab, not here. A locked lead
// with no tracker event yet is still a legal row: "not yet contacted, no due-date pressure" (the
// same treatment the jobsearch bucket gives an untouched JSA TARGET below).
export function buildClientPlatformRows(
  kind: "client" | "platform",
  events: TrackerEvent[],
  config: OutreachConfig,
  leadsRoot: string = LEADS_ROOT,
  nowIso: string = new Date().toISOString(),
): FollowupRow[] {
  if (!existsSync(leadsRoot)) return [];
  const rows: FollowupRow[] = [];
  const dirs = readdirSync(leadsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(`${kind}-`))
    .map((e) => e.name)
    .sort();

  for (const leadDirName of dirs) {
    const leadDirAbs = join(leadsRoot, leadDirName);
    const leadPath = join(leadDirAbs, "lead.md");
    if (!existsSync(leadPath)) continue;

    const locked = latestLockedMessage(leadDirAbs);
    const leadEvents = events.filter((e) => e.bucket === kind && e.lead === leadDirName);
    if (!locked && leadEvents.length === 0) continue;

    const { fm } = splitFrontmatter(readFileSync(leadPath, "utf8"));
    const leadName = String(fm.name ?? leadDirName);
    const why = String(fm.pitch_angle ?? "").trim() || "(no pitch angle recorded)";
    const dir = `outreach/leads/${leadDirName}`;

    // One clock PER PERSON at the lead: events carrying `person` fold into their own row
    // ("Annika L. · PostHog" and "James H. · PostHog" run separate clocks, both linked to the one
    // dossier). Events without a person stay a lead-level row -- also the shape of every event
    // written before person tracking existed, so history keeps rendering unchanged.
    const persons = [...new Set(leadEvents.map((e) => e.person ?? ""))].sort();
    if (!persons.includes("")) persons.unshift("");
    for (const person of persons) {
      const personEvents = leadEvents.filter((e) => (e.person ?? "") === person);
      // Skip an empty lead-level group when person rows exist -- the persons carry the state.
      if (person === "" && personEvents.length === 0 && persons.length > 1) continue;
      const state = foldLeadEvents(leadDirName, kind, personEvents, config, nowIso);
      const who = person ? `${person} · ${leadName}` : leadName;
      const row = rowFromState({ ...state, channel: state.channel ?? locked?.channel }, who, why, dir, person || undefined);
      if (locked) {
        row.saidExcerpt = locked.excerpt;
        row.messageFile = `messages/${locked.messageId}.md`;
      }
      const fit = String((kind === "platform" ? fm.fit : fm.classification) ?? "").trim();
      if (fit) row.fit = fit;
      rows.push(row);
    }
  }
  return rows;
}

// inbound bucket: schema-ready from day one; populated by src/cron/inbound-to-tracker.ts, which
// folds each platform's listening ledger (e.g. data/bluesky-mentions-ledger.jsonl) into
// bucket:"inbound" `inbound_received` events keyed by author handle. There is no lead-folder
// source to join against (unlike client/platform), so this just folds whatever tracker events
// already exist per unique lead key -- `who` is the handle, `why` is the mention text carried on
// the event's `note`.
export function buildInboundRows(
  events: TrackerEvent[],
  config: OutreachConfig,
  nowIso: string = new Date().toISOString(),
): FollowupRow[] {
  const inboundEvents = events.filter((e) => e.bucket === "inbound");
  const leadKeys = [...new Set(inboundEvents.map((e) => e.lead))].sort();
  return leadKeys.map((leadKey) => {
    const leadEvents = inboundEvents.filter((e) => e.lead === leadKey);
    const state = foldLeadEvents(leadKey, "inbound", leadEvents, config, nowIso);
    return rowFromState(state, leadKey, state.lastNote ?? "(mention)");
  });
}

// A hard cap on the jobsearch bucket's JSA pull, independent of anything the caller asks for --
// same "never an unfiltered dump" posture as jsa.ts's own MAX_LIST_LIMIT.
const JOBSEARCH_ROW_LIMIT = 50;

export interface JobsearchBucketResult {
  rows: FollowupRow[];
  note: string | null; // non-null only when the JSA pull degraded (e.g. JSA_DB_PATH unset) -- never thrown
}

// jobsearch bucket: joins JSA's live TARGET verdicts (read-only, display-only per plan §2b)
// against any bucket:"jobsearch" tracker events keyed by company name (case-insensitive). A
// TARGET company with no tracker event yet is a legal row: "not yet contacted, no due date
// pressure" (plan §2b/§6 Phase 4). jsa.ts throws when JSA_DB_PATH isn't set or the db file is
// missing -- this degrades that to an empty bucket + a note instead of failing the whole
// /api/followups response, since a fresh worktree/checkout has no JSA_DB_PATH configured by
// default.
export function buildJobsearchRows(
  events: TrackerEvent[],
  config: OutreachConfig,
  nowIso: string = new Date().toISOString(),
): JobsearchBucketResult {
  let targets: JsaRecord[];
  try {
    targets = listByVerdict(["TARGET"], JOBSEARCH_ROW_LIMIT);
  } catch (e) {
    return { rows: [], note: e instanceof Error ? e.message : String(e) };
  }

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const jobsearchEvents = events.filter((e) => e.bucket === "jobsearch");
  const rows = targets.map((record) => {
    const leadEvents = jobsearchEvents.filter((e) => norm(e.lead) === norm(record.companyName));
    const state = foldLeadEvents(record.companyName, "jobsearch", leadEvents, config, nowIso);
    const why = (record.founderPersona || record.persona || "").trim() || "(no JSA persona note on file)";
    return rowFromState(state, record.companyName, why);
  });
  return { rows, note: null };
}

export interface FollowupsResult {
  buckets: Record<Bucket, FollowupRow[]>;
  jobsearchNote: string | null;
}

// The one call the Follow-ups tab (serve.ts's GET /api/followups) needs: every bucket, folded and
// ready to render.
export function buildFollowups(nowIso: string = new Date().toISOString()): FollowupsResult {
  const config = loadOutreachConfig();
  const events = readTrackerEvents();
  const jobsearch = buildJobsearchRows(events, config, nowIso);
  return {
    buckets: {
      client: buildClientPlatformRows("client", events, config, LEADS_ROOT, nowIso),
      platform: buildClientPlatformRows("platform", events, config, LEADS_ROOT, nowIso),
      inbound: buildInboundRows(events, config, nowIso),
      jobsearch: jobsearch.rows,
    },
    jobsearchNote: jobsearch.note,
  };
}

export interface FollowupBucketSummary {
  bucket: Bucket;
  total: number;
  due: number;
  overdue: number;
  responded: number;
}

// Usable by /strategy later (not wired in there yet -- out of this card's scope). Exported so a
// future weekly-brief pass has counts to cite without re-deriving fold logic of its own.
export function summarizeFollowups(result: FollowupsResult): FollowupBucketSummary[] {
  return BUCKETS.map((bucket) => {
    const rows = result.buckets[bucket];
    return {
      bucket,
      total: rows.length,
      due: rows.filter((r) => r.status === "due").length,
      overdue: rows.filter((r) => r.status === "overdue").length,
      responded: rows.filter((r) => r.status === "responded").length,
    };
  });
}

// ── GUI actions (src/review/serve.ts) ──────────────────────────────────────────────────────────
// Both just append a tracker event -- neither contacts anyone or transmits anything (CLAUDE.md
// rule 2 analog / plan §7: no send path exists anywhere in this codebase).

export function markResponded(bucket: Bucket, lead: string, note?: string, path: string = TRACKER_PATH, person?: string): TrackerEvent {
  const event: TrackerEvent = { ts: new Date().toISOString(), lead, bucket, event: "responded", ...(person ? { person } : {}), ...(note ? { note } : {}) };
  appendTrackerEvent(event, path);
  return event;
}

// Manual "I sent this by hand" tracker touch -- for a follow-up Muxin sent outside this tool
// (e.g. in his email client), so the Follow-ups tab's due-date clock still (re)starts correctly.
export function markContacted(bucket: Bucket, lead: string, note?: string, path: string = TRACKER_PATH, person?: string): TrackerEvent {
  const event: TrackerEvent = { ts: new Date().toISOString(), lead, bucket, event: "followup_sent", ...(person ? { person } : {}), ...(note ? { note } : {}) };
  appendTrackerEvent(event, path);
  return event;
}

// "Mark as sent" (design 3d): the FIRST send of a locked message to a specific person over a
// specific channel. This is the step that puts the person on the follow-ups ledger -- it appends
// the previously-unused `contacted` event with person + channel + which message, and the
// due-date clock starts from here. Nothing is transmitted; Muxin already sent it by hand.
export function markSent(
  bucket: Bucket,
  lead: string,
  opts: { person?: string; channel?: string; message?: string; note?: string },
  path: string = TRACKER_PATH,
): TrackerEvent {
  const event: TrackerEvent = {
    ts: new Date().toISOString(), lead, bucket, event: "contacted",
    ...(opts.person ? { person: opts.person } : {}),
    ...(opts.channel ? { channel: opts.channel } : {}),
    ...(opts.message ? { message: opts.message } : {}),
    ...(opts.note ? { note: opts.note } : {}),
  };
  appendTrackerEvent(event, path);
  return event;
}

// "Move on" reads as closing a chapter, not failure (659b50f0's explicit anti-pattern) -- the
// event type is `abandoned` internally, but nothing in the GUI copy should say that word.
export function moveOn(bucket: Bucket, lead: string, note?: string, path: string = TRACKER_PATH, person?: string): TrackerEvent {
  const event: TrackerEvent = { ts: new Date().toISOString(), lead, bucket, event: "abandoned", ...(person ? { person } : {}), ...(note ? { note } : {}) };
  appendTrackerEvent(event, path);
  return event;
}
