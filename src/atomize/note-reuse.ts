// Note-reuse state for the GUI's Substack Notes picker (and `npm run new-notes`'s CLI listing).
//
// The old rule was a single Set of origin URLs: a note EVER scaffolded into a content/ folder was
// "already drafted" and permanently un-selectable — even when every derivative from that folder
// was later discarded and nothing ever published (Muxin, 2026-07-16: "the drafts were never
// published... ppl reuse content all the time"). This module replaces that with a per-origin
// state folded from what each matching content folder actually did:
//
//   - any undecided review row (pending/approve/revise, or a scaffolded folder with no rows yet)
//     → still "in review" — blocked, so two concurrent drafts of the same note can't pile up
//   - published, less than REUSE_COOLDOWN_DAYS ago → blocked ("published N days ago") — the
//     repeat-yourself guard Muxin still wants
//   - published, REUSE_COOLDOWN_DAYS+ ago → selectable again, labeled so the reuse is deliberate
//   - drafted but every row discarded → selectable immediately ("drafted before, discarded")
//
// Publish dates come from each folder's publish-log.md (the same append-only audit trail every
// schedule call writes — see src/review/rows.ts readPublishLogSafe); review statuses come from
// the same readQueue() parser the publish step and review GUI use. Deterministic, no LLM.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue } from "../publish/queue.js";

export const REUSE_COOLDOWN_DAYS = 30;

// A row is out of the review inbox once it's one of these — mirrors rows.ts's DECIDED set.
const DECIDED = new Set(["published", "discard", "locked"]);

export interface OriginState {
  undecided: boolean; // some matching folder still has rows awaiting review (or no rows yet)
  lastPublishedAt: string | null; // newest publish-log timestamp across matching folders (ISO)
  publishedUndated: boolean; // a row says "published" but no publish-log date was found
}

export interface NoteReuse {
  drafted: boolean; // a content folder was ever scaffolded from this note (drives show/hide)
  reusable: boolean; // may this note be selected for another draft right now?
  draftedTag: string; // human label for the picker ("" when never drafted)
}

// Pure: the `- <ISO> — <rowId> → ...` timestamps out of a publish-log.md's text.
export function parsePublishLogDates(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^- (\d{4}-\d{2}-\d{2}T[0-9:.]+Z)\s/);
    if (m) out.push(m[1]);
  }
  return out;
}

// Pure: one folder's rows + publish-log dates → its OriginState. A folder with zero rows is a
// fresh scaffold mid-atomize — treated as undecided (in flight), not as free to re-draft.
export function foldFolderState(rows: { status: string }[], publishDates: string[]): OriginState {
  const undecided = rows.length === 0 || rows.some((r) => !DECIDED.has(r.status.trim().toLowerCase()));
  const published = rows.some((r) => r.status.trim().toLowerCase() === "published");
  const lastPublishedAt = publishDates.length ? [...publishDates].sort()[publishDates.length - 1] : null;
  return {
    undecided,
    // publish-log dates count even if no row currently reads "published" (a hand-edited row);
    // conversely a "published" row with no log line is publishedUndated (handled conservatively).
    lastPublishedAt,
    publishedUndated: published && !lastPublishedAt,
  };
}

// Pure: merge two folders' states for the same origin (a note re-drafted on different days has
// one folder per draft). Any undecided wins; newest publish date wins.
export function mergeOriginStates(a: OriginState, b: OriginState): OriginState {
  return {
    undecided: a.undecided || b.undecided,
    lastPublishedAt:
      a.lastPublishedAt && b.lastPublishedAt
        ? (a.lastPublishedAt > b.lastPublishedAt ? a.lastPublishedAt : b.lastPublishedAt)
        : a.lastPublishedAt ?? b.lastPublishedAt,
    publishedUndated: a.publishedUndated || b.publishedUndated,
  };
}

// Pure: calendar-day difference, matching serve.ts's daysAgo (kept local to avoid an import cycle
// through serve.ts, which imports new-notes.ts).
function daysAgo(dateStr: string, nowMs: number): number {
  const then = new Date(dateStr.slice(0, 10) + "T00:00:00Z").getTime();
  const now = new Date(nowMs);
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((nowMidnight - then) / 86_400_000));
}

// Pure: the picker-facing verdict for one note. `state` undefined = never drafted.
export function noteReuse(state: OriginState | undefined, nowMs: number): NoteReuse {
  if (!state) return { drafted: false, reusable: true, draftedTag: "" };
  if (state.undecided) {
    return { drafted: true, reusable: false, draftedTag: "in review now" };
  }
  if (state.lastPublishedAt) {
    const days = daysAgo(state.lastPublishedAt, nowMs);
    if (days < REUSE_COOLDOWN_DAYS) {
      return { drafted: true, reusable: false, draftedTag: `published ${days}d ago` };
    }
    return { drafted: true, reusable: true, draftedTag: `published ${days}d ago, ok to reuse` };
  }
  if (state.publishedUndated) {
    // Says published but no dated log line — can't prove the cooldown has passed, so stay blocked.
    return { drafted: true, reusable: false, draftedTag: "published (date unknown)" };
  }
  return { drafted: true, reusable: true, draftedTag: "drafted before, discarded" };
}

// Filesystem scan: every content/<slug> folder's source.md `origin:` → folded OriginState.
// A folder whose review-queue.md is missing/unreadable counts as undecided (conservative).
export function readOriginStates(contentDir: string): Map<string, OriginState> {
  const states = new Map<string, OriginState>();
  if (!existsSync(contentDir)) return states;
  for (const folder of readdirSync(contentDir)) {
    const dir = join(contentDir, folder);
    const sourcePath = join(dir, "source.md");
    if (!existsSync(sourcePath)) continue;
    let origin: unknown;
    try {
      origin = splitFrontmatter(readFileSync(sourcePath, "utf8")).fm.origin;
    } catch {
      continue;
    }
    if (typeof origin !== "string" || !origin) continue;
    let state: OriginState;
    try {
      const { rows } = readQueue(dir);
      let logText = "";
      try {
        logText = readFileSync(join(dir, "publish-log.md"), "utf8");
      } catch {
        // no publish log yet — nothing published from this folder
      }
      state = foldFolderState(rows, parsePublishLogDates(logText));
    } catch {
      state = { undecided: true, lastPublishedAt: null, publishedUndated: false };
    }
    const prev = states.get(origin);
    states.set(origin, prev ? mergeOriginStates(prev, state) : state);
  }
  return states;
}
