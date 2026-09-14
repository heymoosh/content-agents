import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireVentureDir } from './paths.js';

export const WORKING_CONTEXT_KEYS = ['underway', 'testing', 'next', 'gaps', 'constraints'] as const;
export type WorkingContextFields = Record<(typeof WORKING_CONTEXT_KEYS)[number], string>;
export interface WorkingContext extends WorkingContextFields {
  revision: number;
  savedAt: string | null;
}
const empty = (): WorkingContext => ({ revision: 0, savedAt: null, underway: '', testing: '', next: '', gaps: '', constraints: '' });
function path(slug: string): string {
  if (!/^[a-z0-9][\w-]*$/.test(slug)) throw new Error('Invalid venture slug');
  return join(requireVentureDir(slug), 'working-context.jsonl');
}
/** Owner-reported context, not delivery proof or a phase-gate decision. Never rewrites intake. */
export function readWorkingContext(slug: string): WorkingContext {
  const file = path(slug);
  if (!existsSync(file)) return empty();
  const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  if (!lines.length) return empty();
  const value = JSON.parse(lines.at(-1)!) as WorkingContext;
  if (!Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.savedAt !== 'string'
      || WORKING_CONTEXT_KEYS.some(k => typeof value[k] !== 'string')) throw new Error('Working context could not be read. Existing history was not changed.');
  return value;
}
/** Synchronous compare-and-append: no await between revision check and write in the local server. */
export function saveWorkingContext(slug: string, body: Record<string, unknown>): WorkingContext {
  const current = readWorkingContext(slug);
  if (body.revision !== current.revision) throw new Error('Another update was saved. Your edits are still here; reload the saved context before merging them.');
  const fields = {} as WorkingContextFields;
  for (const key of WORKING_CONTEXT_KEYS) {
    if (typeof body[key] !== 'string' || body[key].length > 12000) throw new Error(`${key} must be text of at most 12000 characters`);
    fields[key] = body[key];
  }
  const next = { ...fields, revision: current.revision + 1, savedAt: new Date().toISOString() };
  appendFileSync(path(slug), JSON.stringify(next) + '\n', 'utf8');
  return next;
}

export const VENTURE_PROGRESS_GUIDANCE = [
  'Reconcile the existing business before proposing work. Working context is the latest owner-reported update and supersedes conflicting intake descriptions, but never overwrites a selected decision or a verified artifact fact.',
  'Credit existing content, tools, signups, surveys and scheduled work. Scheduled is not live; owner-reported is not independently verified. Do not ask the owner to recreate work or manually reconstruct analytics available to Signals.',
  'Use existing work to frame the research plan: cite its source, identify hypotheses it can test and remaining evidence gaps. Missing Venture-native artifacts do not mean the business has done nothing.',
  'When audience location is unknown, propose a bounded cross-platform test through Content Studio. A primary platform is a reference channel, not exclusivity. Preserve per-platform attribution and review; do not publish everywhere automatically.',
  'Give one or two useful next actions, distinguish missing evidence from deliberately deferred choices, and keep paid offers, leads and sales as future stages when no offer exists. Views alone are not converted behavior or paid demand.',
  'Respect the saved operating constraints and time budget. Suggestions are proposals, not owner decisions. Working context cannot clear any approval, delivery, checkpoint or phase gate.',
].join('\n');
