import { existsSync, readFileSync, lstatSync, realpathSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { requireVentureDir } from './paths.js';
import { readArtifacts } from './artifacts.js';
import { readDecisions } from './decisions.js';
import { withFileLock } from '../runtime/file-lock.js';

const text = z.string().trim().min(1).max(2000);
export const destinationSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/), name: text,
  audience: text, benefit: text, action: text, measurement: text,
  status: z.enum(['proposed', 'building', 'ready', 'retired', 'linked']),
  url: z.string().max(2000).default(''),
}).refine(d => !d.url || safeDestinationUrl(d.url), 'Use a public HTTPS destination without credentials')
  .refine(d => !['ready', 'linked'].includes(d.status) || !!d.url, 'A ready or linked destination needs its existing URL');
export type ConversionDestination = z.infer<typeof destinationSchema>;
const planSchema = z.object({
  version: z.literal(1), revision: z.number().int().nonnegative(),
  goal: z.string().max(4000), destinations: z.array(destinationSchema).max(100),
  assignments: z.array(z.object({ contentId: text, destinationId: text, reason: text })).max(500),
});
export type ConversionPlan = z.infer<typeof planSchema>;

export function safeDestinationUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && u.hostname.includes('.') && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)
      && !/\.(local|internal|test)$/.test(u.hostname);
  } catch { return false; }
}
function planPath(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('Invalid venture');
  const dir = requireVentureDir(slug);
  if (lstatSync(dir).isSymbolicLink()) throw new Error('Venture directory must not be a symlink');
  const path = join(realpathSync(dir), 'conversions.json');
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Conversion file must not be a symlink');
  return path;
}
export function readConversionPlan(slug: string): ConversionPlan {
  const path = planPath(slug);
  return existsSync(path) ? planSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    : { version: 1, revision: 0, goal: '', destinations: [], assignments: [] };
}
/** Existing Venture artifacts are discovered, never marked approved/live by this registry. */
export function conversionDestinations(slug: string, plan = readConversionPlan(slug)): (ConversionDestination & { kind?: string })[] {
  const artifacts = readArtifacts(slug).filter(a => ['lead-magnet', 'landing-page'].includes(a.artifact_kind));
  const derived = artifacts.map(a => {
    const url = a.evidence?.type === 'url' && safeDestinationUrl(a.evidence.value) ? a.evidence.value : '';
    const ready = a.editorial_status === 'approved' && a.delivery_status === 'live_confirmed' && !!url;
    return { id: a.artifact_id, name: a.title, kind: a.artifact_kind === 'lead-magnet' ? 'Lead magnet' : 'Landing page', audience: 'See the Venture research plan', benefit: a.title,
      action: a.artifact_kind === 'lead-magnet' ? 'Get the resource' : 'Visit the landing page',
      measurement: 'Not connected yet', status: a.editorial_status === 'discarded' ? 'retired' as const : ready ? 'ready' as const : 'building' as const, url };
  });
  // Registry metadata can enrich an artifact, but cannot promote an unready artifact.
  const concepts = artifacts.some(a => a.artifact_kind === 'lead-magnet') ? [] : readDecisions(slug)
    .filter(d => d.decision_kind === 'lead-magnet-concept' && d.status !== 'superseded')
    .flatMap(d => d.candidates.filter(c => d.status !== 'selected' || d.selected_candidate_ids.includes(c.candidate_id)).map(c => ({
      id: 'concept-' + c.candidate_id, name: c.label, kind: 'Lead magnet concept', audience: 'See the Venture research plan', benefit: c.rationale,
      action: 'Resource not built yet', measurement: 'Not connected yet', status: 'proposed' as const, url: '',
    })));
  return [...plan.destinations.filter(d => !derived.some(a => a.id === d.id) && !concepts.some(c => c.id === d.id)), ...concepts, ...derived.map(a => {
    const metadata = plan.destinations.find(d => d.id === a.id);
    return metadata ? { ...metadata, kind: a.kind, status: a.status, url: a.url } : a;
  })];
}
/** Explicit owner save only. Revision comparison protects another tab/session's edits. */
export async function saveConversionPlan(slug: string, input: unknown): Promise<ConversionPlan> {
  const candidate = planSchema.parse(input);
  if (new Set(candidate.destinations.map(d => d.id)).size !== candidate.destinations.length) throw new Error('Duplicate destination ID');
  if (new Set(candidate.assignments.map(a => a.contentId)).size !== candidate.assignments.length) throw new Error('Each piece can have one Venture CTA');
  const ids = new Set(conversionDestinations(slug, candidate).map(d => d.id));
  if (candidate.assignments.some(a => !ids.has(a.destinationId))) throw new Error('Assignment destination is missing');
  const path = planPath(slug);
  return withFileLock(path + '.lock', () => {
    if (readConversionPlan(slug).revision !== candidate.revision) throw new Error('Destinations changed in another tab. Reload before saving.');
    const next = { ...candidate, revision: candidate.revision + 1 };
    const temp = path + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      renameSync(temp, path);
    } finally { if (existsSync(temp)) rmSync(temp); }
    return next;
  });
}
