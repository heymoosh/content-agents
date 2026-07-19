// Studio home aggregation (Content Studio Riff 3c): the one screen that spans every room. It
// never starts work — it shows what needs Muxin and what the team is doing, from data other
// modules already own: review queues (rows.ts), outreach leads (status.ts), the follow-ups fold
// (tracker.ts), the job queue (jobs.ts), the scout run log, and the publish slot ledger.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { listPieces } from "./rows.js";
import { listLeads } from "../outreach/status.js";
import { buildFollowups, summarizeFollowups } from "../outreach/tracker.js";
import { jobs, publicJob } from "./jobs.js";

export interface NeedsYouItem {
  room: "content" | "outreach" | "followups" | "signals";
  label: string; // 82px-mono room label in the design ("Outreach", "Content", ...)
  text: string; // the sentence, written to Muxin
  detail: string; // gray tail
  action: string; // the click-through verb ("Review", "Read", "Open")
  // navigation hint for the client: which room to open (and lead dir when applicable)
  dir?: string;
  urgent: boolean; // renders the amber accent (due today etc.)
}

export interface TeamMember {
  name: string;
  state: "working" | "recent" | "idle";
  line: string; // "shaping "fear AI, fear power" · 2m 08s" — built server-side, honest data only
}

export interface StudioHome {
  counts: {
    draftsToReview: number;
    dossiersToRead: number;
    followupsDue: number;
    postsHolding: number; // approved posts holding future slots in the publish ledger
  };
  needsYou: NeedsYouItem[];
  team: TeamMember[];
}

// Future claims in the publish slot ledger — "Publisher: holding N approved posts for slots".
export function countFutureSlotClaims(nowIso: string = new Date().toISOString(), path?: string): number {
  const ledger = path ?? join(repoRoot, "data", "publish-schedule.jsonl");
  if (!existsSync(ledger)) return 0;
  let count = 0;
  for (const line of readFileSync(ledger, "utf8").split("\n").filter(Boolean)) {
    try {
      const claim = JSON.parse(line) as { time?: string };
      if (claim.time && claim.time > nowIso) count++;
    } catch {
      /* skip malformed line */
    }
  }
  return count;
}

// Last completed scout sweep, from the outreach run log (newest timestamp wins).
export function lastScoutRun(path?: string): string | null {
  const log = path ?? join(repoRoot, "data", "outreach", "run-log.jsonl");
  if (!existsSync(log)) return null;
  let latest: string | null = null;
  for (const line of readFileSync(log, "utf8").split("\n").filter(Boolean)) {
    try {
      const entry = JSON.parse(line) as { timestamp?: string };
      if (entry.timestamp && (!latest || entry.timestamp > latest)) latest = entry.timestamp;
    } catch {
      /* skip */
    }
  }
  return latest;
}

const UNDECIDED_LEAD_STATUSES = new Set(["intake", "researched", "qualified"]);

// Friendly team-member name per job kind — the design's cast (Formatter, Scout, Publisher, ...).
function teamNameFor(kind: string): string {
  if (kind === "develop" || kind === "develop-reply") return "Director";
  if (kind === "scout") return "Scout";
  if (kind === "strategy" || kind === "insights" || kind === "ask-insights" || kind === "brief-revise") return "Analyst";
  if (kind === "pull") return "Analyst";
  if (kind === "video") return "Illustrator";
  if (kind === "draft-follow-up") return "Ghostwriter";
  return "Formatter"; // url/file/text/notes/continue/revise/duplicate — the production crew
}

export async function buildStudioHome(nowIso: string = new Date().toISOString()): Promise<StudioHome> {
  const pieces = await listPieces();
  const pending = pieces.reduce((n, p) => n + p.pending, 0);
  const leads = listLeads();
  const undecided = leads.filter((l) => UNDECIDED_LEAD_STATUSES.has(l.status) && l.kind !== "content-example");
  const followups = buildFollowups(nowIso);
  const fuSummary = summarizeFollowups(followups);
  const followupsDue = fuSummary.reduce((n, b) => n + b.due + b.overdue, 0);

  const needsYou: NeedsYouItem[] = [];
  for (const bucket of ["client", "platform"] as const) {
    for (const row of followups.buckets[bucket]) {
      if (row.status !== "due" && row.status !== "overdue") continue;
      needsYou.push({
        room: "followups", label: "Outreach", urgent: true,
        text: `Follow up with ${row.who}.`,
        detail: `${row.status === "overdue" ? "Worth a call on moving on. " : "Due now. "}${row.why.slice(0, 90)}`,
        action: "Open", dir: row.dir,
      });
    }
  }
  for (const piece of pieces) {
    if (!piece.pending) continue;
    needsYou.push({
      room: "content", label: "Content", urgent: false,
      text: `${piece.pending} draft${piece.pending === 1 ? "" : "s"} ready for your yes or no.`,
      detail: `From "${piece.title}".`,
      action: "Review",
    });
  }
  for (const lead of undecided) {
    needsYou.push({
      room: "outreach", label: "Outreach", urgent: false,
      text: `${lead.name} dossier, worth a minute.`,
      detail: lead.pitchAngle ? lead.pitchAngle.slice(0, 110) : "Researched and waiting on your pursue-or-pass.",
      action: "Read", dir: lead.dir,
    });
  }
  // Urgent first, then content, then dossiers — the design's "ranked by my day".
  needsYou.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  const team: TeamMember[] = [];
  const running = jobs.find((j) => j.status === "running");
  if (running) {
    const pub = publicJob(running);
    const mins = pub.elapsedMs != null ? Math.floor(pub.elapsedMs / 60000) : 0;
    const secs = pub.elapsedMs != null ? Math.floor((pub.elapsedMs % 60000) / 1000) : 0;
    team.push({ name: teamNameFor(pub.kind), state: "working", line: `${pub.label} · ${mins}m ${String(secs).padStart(2, "0")}s` });
  }
  const queued = jobs.filter((j) => j.status === "queued").length;
  if (queued) team.push({ name: "Queue", state: "recent", line: `${queued} job${queued === 1 ? "" : "s"} waiting their turn` });
  const scoutAt = lastScoutRun();
  team.push({
    name: "Scout",
    state: scoutAt ? "recent" : "idle",
    line: scoutAt ? `last swept ${scoutAt.slice(0, 10)}` : "no sweep on record",
  });
  const holding = countFutureSlotClaims(nowIso);
  team.push({
    name: "Publisher",
    state: holding ? "recent" : "idle",
    line: holding ? `holding ${holding} approved post${holding === 1 ? "" : "s"} for slots` : "no posts holding",
  });
  if (!running) team.push({ name: "Formatter", state: "idle", line: "idle, waiting on a cut" });

  return {
    counts: { draftsToReview: pending, dossiersToRead: undecided.length, followupsDue, postsHolding: holding },
    needsYou: needsYou.slice(0, 8),
    team,
  };
}
