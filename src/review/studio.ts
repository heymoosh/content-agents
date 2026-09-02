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
import { listCharlesPosts } from "./charles.js";
import { listVentures } from "../venture/paths.js";
import { readDecisions } from "../venture/decisions.js";
import { readArtifacts } from "../venture/artifacts.js";
import { ledgerPath } from "../publish/slots.js";

export interface NeedsYouItem {
  room: "content" | "outreach" | "followups" | "signals" | "charles" | "venture";
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
  const ledger = path ?? ledgerPath();
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
/**
 * Wrap a title in quotes exactly once. A Substack note's own title usually arrives already
 * quoted, and wrapping it again rendered `From """Why do we fear AI…"""` on the Studio queue.
 */
export function quoteOnce(title: string): string {
  const bare = title.trim().replace(/^["“”']+/, "").replace(/["“”']+$/, "");
  return `"${bare}"`;
}

/**
 * Cut on a word boundary with a single ellipsis. Keeps approx `max` characters of the source.
 *
 * It also repairs " -- " on the way through. Scout and matchmaker prose arrives with an em dash
 * already flattened to a double hyphen, and Muxin's voice rules strip an em dash to real
 * punctuation, never to that. This is system-written description, not her own words, so a colon is
 * safe here. Anything she wrote goes to the screen untouched.
 */
export function clipOnWord(text: string, max: number): string {
  const t = (text || "").replace(/ +-- +/g, ": ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max).replace(/[\s,;:]+\S*$/, "").replace(/\s+$/, "");
  return (cut || t.slice(0, max).trimEnd()) + "…";
}

function teamNameFor(kind: string): string {
  if (kind === "develop" || kind === "develop-reply") return "Director";
  if (kind === "scout") return "Scout";
  if (kind === "strategy" || kind === "insights" || kind === "ask-insights" || kind === "brief-revise") return "Analyst";
  if (kind === "pull") return "Analyst";
  if (kind === "video") return "Illustrator";
  if (kind === "draft-follow-up") return "Ghostwriter";
  return "Formatter"; // url/file/text/notes/continue/revise/duplicate — the production crew
}

/** Charles drafts whose queue status is exactly `pending` (missing/empty status is not pending). */
export function charlesNeedsYou(root?: string): NeedsYouItem[] {
  try {
    const pending = listCharlesPosts(root).filter((p) => p.status === "pending");
    if (!pending.length) return [];
    const n = pending.length;
    return [{
      room: "charles",
      label: "Charles",
      urgent: false,
      text: n === 1
        ? "A Charles draft is waiting on your yes."
        : `${n} Charles drafts are waiting on your yes.`,
      detail: n === 1
        ? `${pending[0].type} · ${pending[0].id}`
        : "Pending in his review queue.",
      action: "Review",
    }];
  } catch {
    return [];
  }
}

/**
 * Venture decisions awaiting a selection, and artifacts still in editorial draft.
 * Read-only: never writes a gate, checkpoint, or decision. Failure-tolerant per venture.
 */
export function ventureNeedsYou(): NeedsYouItem[] {
  try {
    let decisions = 0;
    let drafts = 0;
    for (const slug of listVentures()) {
      try {
        decisions += readDecisions(slug).filter((d) => d.status === "awaiting_user").length;
      } catch {
        /* skip unreadable decisions for this slug */
      }
      try {
        drafts += readArtifacts(slug).filter((a) => a.editorial_status === "draft").length;
      } catch {
        /* skip unreadable artifacts for this slug */
      }
    }
    if (!decisions && !drafts) return [];

    let text: string;
    let detail: string;
    if (decisions && drafts) {
      text = "Venture work is waiting on your decision.";
      detail = `${decisions} decision${decisions === 1 ? "" : "s"} · ${drafts} draft${drafts === 1 ? "" : "s"}.`;
    } else if (decisions) {
      text = decisions === 1
        ? "A Venture decision is waiting on your pick."
        : `${decisions} Venture decisions are waiting on your pick.`;
      detail = "Awaiting your selection.";
    } else {
      text = drafts === 1
        ? "A Venture draft is waiting on your yes."
        : `${drafts} Venture drafts are waiting on your yes.`;
      detail = "Editorial approval still open.";
    }
    return [{
      room: "venture",
      label: "Venture",
      urgent: false,
      text,
      detail,
      action: "Open",
    }];
  } catch {
    return [];
  }
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
  for (const bucket of ["client", "platform", "peer"] as const) {
    for (const row of followups.buckets[bucket]) {
      if (row.status !== "due" && row.status !== "overdue") continue;
      const detailPrefix = bucket === "peer"
        ? (row.status === "overdue" ? "Overdue. " : "Due now. ")
        : (row.status === "overdue" ? "Worth a call on moving on. " : "Due now. ");
      needsYou.push({
        room: "followups", label: "Outreach", urgent: true,
        text: `Follow up with ${row.who}.`,
        detail: `${detailPrefix}${clipOnWord(row.why, 90)}`,
        action: "Open", dir: row.dir,
      });
    }
  }
  for (const piece of pieces) {
    if (!piece.pending) continue;
    needsYou.push({
      room: "content", label: "Content", urgent: false,
      text: `${piece.pending} draft${piece.pending === 1 ? "" : "s"} ready for your yes or no.`,
      detail: `From ${quoteOnce(piece.title)}.`,
      action: "Review",
    });
  }
  for (const lead of undecided) {
    needsYou.push({
      room: "outreach", label: "Outreach", urgent: false,
      text: `${lead.name} dossier, worth a minute.`,
      detail: lead.pitchAngle ? clipOnWord(lead.pitchAngle, 110) : "Researched and waiting on your pursue-or-pass.",
      action: "Read", dir: lead.dir,
    });
  }
  needsYou.push(...charlesNeedsYou());
  needsYou.push(...ventureNeedsYou());
  // Urgent first, then content, then dossiers — the design's "ranked by my day".
  needsYou.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  const team: TeamMember[] = [];
  const running = jobs.find((j) => j.status === "running");
  if (running) {
    const pub = publicJob(running);
    // Null elapsedMs means no measurement yet. Printing 0m 00s would invent a clock reading.
    // formatElapsed / jobElapsedText in studio-job-ui.ts exist, but formatElapsed drops the
    // always-Xm-YYs pad this rail uses, and jobElapsedText's null text is "not started", which
    // is wrong for a job that is already running.
    const line = pub.elapsedMs != null
      ? `${pub.label} · ${Math.floor(pub.elapsedMs / 60000)}m ${String(Math.floor((pub.elapsedMs % 60000) / 1000)).padStart(2, "0")}s`
      : `${pub.label} · started, time not measured yet`;
    team.push({ name: teamNameFor(pub.kind), state: "working", line });
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
