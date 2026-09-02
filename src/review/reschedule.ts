import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { claimSlots, laDayKey, moveClaim, type Claim } from "../publish/slots.js";
import { createPostizTransport, findPostizPost, reschedulePostizPost, type PostizTransport } from "../publish/postiz.js";
import { appendPublishingStatus, publishingKey, readPublishingStatuses, PUBLISHING_STATUS_PATH, type PublishingStatus } from "./publishing-status.js";
import { buildPostizInput, scheduleKind } from "./studio-scheduling.js";
import { safeFolder } from "./rows.js";
import { isQuoteCardRow, cardTarget, basePlatform } from "../publish/cards.js";

/** Either an exact instant or "the first free cadence slot at or after this instant". */
export interface RescheduleTarget {
  to?: string;
  notBefore?: string;
}

export interface RescheduleDeps {
  transport?: PostizTransport;
  statusPath?: string;
  now?: () => Date;
  buildInput?: typeof buildPostizInput;
  resolveFolder?: (slug: string) => string;
}

export interface RescheduleOutcome {
  slug: string;
  id: string;
  platform: string;
  from: string | null;
  to?: string;
  ok: boolean;
  error?: string;
  publishing?: PublishingStatus;
}

/** The destination a row's slot is claimed under (mirrors studio-scheduling's postizShape). */
export function rowDestination(row: QueueRow): string {
  return isQuoteCardRow(row.platform) ? cardTarget(row.platform) ?? basePlatform(row.platform) : row.platform;
}

/** Pillar named in `routing.md`'s title line (`# Routing — <pillar> — <date>`); the theme a batch selects on. */
export function readPillar(folder: string): string | null {
  const path = join(folder, "routing.md");
  if (!existsSync(path)) return null;
  const first = readFileSync(path, "utf8").split("\n")[0] ?? "";
  return first.match(/^#\s*Routing\s*[—-]+\s*(.+?)\s*[—-]+\s*\d{4}-\d{2}-\d{2}/)?.[1]?.trim() ?? null;
}

function movable(status: PublishingStatus | undefined, now: Date): string | null {
  if (!status) return "this row has no publishing record; approve it first";
  if (status.provider !== "postiz") return `automatic rescheduling covers Postiz rows only; ${status.provider} has no reschedule API, so cancel and re-approve it, or move it in ${status.provider} by hand`;
  if (status.state !== "planned") return `only a planned (scheduled, unpublished) row can move; this one is ${status.state}`;
  if (!status.providerObjectId) return "the publishing record has no Postiz post id";
  if (!status.providerAccountId) return "the publishing record has no Postiz account id";
  if (!status.plannedFor || Date.parse(status.plannedFor) <= now.getTime()) return "the planned time already passed; Postiz will not move a post whose time is behind";
  return null;
}

function resolveTime(row: QueueRow, target: RescheduleTarget, now: Date): string {
  if (target.to) {
    const at = Date.parse(target.to);
    if (!Number.isFinite(at)) throw new Error("the new time is not a valid date");
    if (at <= now.getTime()) throw new Error("the new time must be in the future");
    return new Date(at).toISOString();
  }
  const floor = target.notBefore ? Date.parse(target.notBefore) : NaN;
  if (!Number.isFinite(floor)) throw new Error("give either an exact time or a not-before date");
  const destination = rowDestination(row);
  const { times } = claimSlots({ windowKey: destination, conflictPlatforms: [destination], count: 1, asset: row.asset, by: "postiz", dryRun: true, now: new Date(Math.max(floor, now.getTime())) });
  if (!times[0] || times[0] === "next-free-slot") throw new Error(`${destination} has no cadence in config/platforms.yaml, so give an exact time`);
  return times[0];
}

/**
 * Move one scheduled Postiz row: provider first (in-place re-save with the row's rebuilt body, which
 * restarts Postiz's publish timer), then the slot ledger, then one appended publishing event so the
 * Content page shows the new time at once. Never touches published rows.
 */
export async function rescheduleRow(folder: string, slug: string, row: QueueRow, target: RescheduleTarget, deps: RescheduleDeps = {}): Promise<RescheduleOutcome> {
  const now = deps.now?.() ?? new Date();
  const statusPath = deps.statusPath ?? PUBLISHING_STATUS_PATH;
  const status = readPublishingStatuses(statusPath)[publishingKey(slug, row.id)];
  const platform = rowDestination(row);
  const base = { slug, id: row.id, platform, from: status?.plannedFor ?? null };
  const blocked = movable(status, now);
  if (blocked || !status) return { ...base, ok: false, error: blocked ?? "unknown" };
  if (!scheduleKind(row)) return { ...base, ok: false, error: "no publishing provider owns this row" };
  try {
    const to = resolveTime(row, target, now);
    if (Date.parse(to) === Date.parse(status.plannedFor!)) return { ...base, to, ok: true, publishing: status };
    const transport = deps.transport ?? createPostizTransport();
    const input = await (deps.buildInput ?? buildPostizInput)(folder, row, status.providerAccountId!, to, transport);
    const current = await findPostizPost(transport, status.providerObjectId!, status.plannedFor!, now).catch(() => null);
    if (!current) return { ...base, ok: false, error: "Postiz no longer lists this post at its planned time; reconcile it before moving" };
    if (current.status !== "scheduled") return { ...base, ok: false, error: `Postiz reports the post as ${current.status}; only scheduled posts move` };
    const moved = await reschedulePostizPost(transport, { id: current.id, group: current.group }, input, to, now);
    const previous: Claim = { platform, day: laDayKey(new Date(status.plannedFor!)), time: status.plannedFor!, asset: row.asset, by: "postiz" };
    moveClaim(previous, { time: moved.scheduledAt!, day: laDayKey(new Date(moved.scheduledAt!)) });
    const publishing: PublishingStatus = {
      ...status, state: "planned", at: new Date().toISOString(), plannedFor: moved.scheduledAt!,
      providerUpdatedAt: new Date().toISOString(), error: undefined, schemaVersion: undefined, eventId: undefined,
    };
    appendPublishingStatus(publishing, statusPath);
    return { ...base, to: moved.scheduledAt!, ok: true, publishing: readPublishingStatuses(statusPath)[publishingKey(slug, row.id)] ?? publishing };
  } catch (error) {
    return { ...base, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface BatchSelection {
  /** Content slugs (one essay and everything atomized from it). */
  slugs?: string[];
  /** Pillars from each folder's routing.md, e.g. `human-ai`. */
  pillars?: string[];
  /** Destinations (x, linkedin, bluesky, ...). */
  platforms?: string[];
  /** Explicit `slug/rowId` keys. */
  ids?: string[];
}

export type BatchPlan =
  | { mode: "shift"; days: number }
  | { mode: "after"; notBefore: string };

export interface BatchCandidate {
  slug: string;
  folder: string;
  row: QueueRow;
  status: PublishingStatus;
  platform: string;
  pillar: string | null;
}

/** Every scheduled Postiz row the selection matches, earliest planned time first. */
export function listBatchCandidates(selection: BatchSelection, deps: RescheduleDeps = {}): BatchCandidate[] {
  if (!Object.values(selection).some((values) => values?.length)) throw new Error("select at least one pillar, slug, platform, or id; an empty selection would move every scheduled post");
  const now = deps.now?.() ?? new Date();
  const statuses = readPublishingStatuses(deps.statusPath ?? PUBLISHING_STATUS_PATH);
  const resolve = deps.resolveFolder ?? safeFolder;
  const wanted = (values: string[] | undefined, value: string | null): boolean => !values?.length || (value !== null && values.includes(value));
  const out: BatchCandidate[] = [];
  const folders = new Map<string, { folder: string; rows: QueueRow[]; pillar: string | null } | null>();
  for (const status of Object.values(statuses)) {
    if (movable(status, now)) continue;
    if (!wanted(selection.ids, publishingKey(status.slug, status.rowId))) continue;
    if (!wanted(selection.slugs, status.slug)) continue;
    if (!folders.has(status.slug)) {
      try { const folder = resolve(status.slug); folders.set(status.slug, { folder, rows: readQueue(folder).rows, pillar: readPillar(folder) }); }
      catch { folders.set(status.slug, null); }
    }
    const entry = folders.get(status.slug);
    if (!entry) continue;
    const row = entry.rows.find((item) => item.id === status.rowId);
    if (!row) continue;
    const platform = rowDestination(row);
    if (!wanted(selection.platforms, platform) || !wanted(selection.pillars, entry.pillar)) continue;
    out.push({ slug: status.slug, folder: entry.folder, row, status, platform, pillar: entry.pillar });
  }
  return out.sort((a, b) => Date.parse(a.status.plannedFor!) - Date.parse(b.status.plannedFor!));
}

/**
 * Move a cluster together. `shift` keeps the cluster's internal spacing (each row moves the same
 * number of days); `after` re-flows the cluster through the cadence, earliest first, starting at
 * the first free slot on or after the date, so a theme can wait behind a newer essay or campaign.
 */
export async function batchReschedule(selection: BatchSelection, plan: BatchPlan, deps: RescheduleDeps = {}): Promise<{ candidates: number; results: RescheduleOutcome[] }> {
  const candidates = listBatchCandidates(selection, deps);
  const results: RescheduleOutcome[] = [];
  for (const candidate of candidates) {
    const target: RescheduleTarget = plan.mode === "shift"
      ? { to: new Date(Date.parse(candidate.status.plannedFor!) + plan.days * 24 * 60 * 60 * 1000).toISOString() }
      : { notBefore: plan.notBefore };
    results.push(await rescheduleRow(candidate.folder, candidate.slug, candidate.row, target, deps));
  }
  return { candidates: candidates.length, results };
}
