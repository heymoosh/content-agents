import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ventureResources } from './venture-resources.js';
import { readConversionPlan, conversionDestinations } from '../venture/conversions.js';
import { readArtifact } from '../venture/artifacts.js';
import { readVentureSeries } from './venture-actions.js';
import { readAdvice } from './develop.js';
import type { ContentRequest, ContentRequestInput } from './content-request.js';
import type { ReaderAction } from './reader-action.js';
import { readQueue } from '../publish/queue.js';

/** Identity comes from the durable owning-room handoff, never from the browser. */
export function contentConversionContext(folder: string, request?: Pick<ContentRequest, 'id' | 'origin' | 'ventureId' | 'ventureSource'> | null) {
  if (request === undefined) {
    const path = join(folder, 'content-request.json');
    request = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  }
  const empty = { ventureId: null as string | null, goal: '', questions: [] as string[], destinations: [] as ReturnType<typeof conversionDestinations>, intended: null as { destinationId: string; reason: string } | null };
  if (!request || !['human-inference', 'venture', 'studio'].includes(request.origin)) return empty;
  const series = readVentureSeries('human-inference').filter(s => s.posts.some(p => p.contentSlug === request!.id));
  const ids = [...new Set([request.ventureId, ...series.map(s => s.ventureSlug)].filter((id): id is string => !!id))];
  if (ids.length > 1) throw new Error('Conflicting Venture ownership for this piece');
  const ventureId = ids[0];
  if (!ventureId) return empty;
  const plan = readConversionPlan(ventureId);
  const artifact = request.ventureSource ? readArtifact(ventureId, request.ventureSource.artifactId) : undefined;
  const research = readArtifact(ventureId, 'p1-research-plan');
  const probes = research?.fields?.reviewed_by_muxin === true && Array.isArray(research.fields.probes)
    ? research.fields.probes as {unknown_id?:string;hypothesis?:string}[] : [];
  const questions = series.length ? series.flatMap(s => s.questions) : probes
    .filter(p=>!artifact?.unknown_id || p.unknown_id===artifact.unknown_id)
    .map(p=>p.hypothesis).filter((h):h is string=>typeof h==='string').slice(0,20);
  const resources = ventureResources(ventureId, dirname(folder), plan);
  const linkedEssays = resources.destinations.filter(d => d.kind === 'Essay' && d.usedBy.some(p => p.id === request!.id));
  const intended = plan.assignments.find(a => a.contentId === request!.id)
    ?? (artifact?.cta_id ? { destinationId: artifact.cta_id, reason: 'CTA attached to the Venture post' } : null);
  return { ventureId, goal: plan.goal, questions, destinations: resources.destinations, intended: intended ?? (linkedEssays.length === 1 ? { destinationId: linkedEssays[0]!.id, reason: 'Full essay already linked in this piece. Preserve the existing reader path.' } : null) };
}

/** Resolve IDs to authoritative URLs; the owner reviews fit, not model-created links. */
export function authorizeReaderAction(folder: string, input: unknown, request: ContentRequestInput): ReaderAction | null {
  if (input == null) return null;
  const choice = input as Record<string, unknown>;
  if (choice.mode === 'none') return { mode: 'none' };
  if (choice.mode === 'source') {
    if (!request.sourceProvenance?.canonicalUrl || /substack\.com\/(?:@[^/]+\/)?note\//.test(request.sourceProvenance.canonicalUrl)) throw new Error('This piece has no eligible long-form source CTA');
    return { mode: 'source' };
  }
  if (choice.mode !== 'destination' || choice.reviewed !== true) throw new Error('Review the CTA fit and reader value before creating drafts');
  const context = contentConversionContext(folder);
  const destination = context.destinations.find(d => d.id === choice.destinationId);
  if (!context.ventureId || !destination || !['ready', 'linked'].includes(destination.status) || !destination.url) throw new Error('Choose a ready or existing linked destination belonging to this Venture');
  const reason = typeof choice.reason === 'string' ? choice.reason.trim() : '';
  if (!reason) throw new Error('Explain why this destination helps readers of this piece');
  const suggested = readAdvice(folder)?.rounds.flatMap(r => r.cards).some(c => c.kind === 'cta' && c.status !== 'dismissed' && c.destinationId === destination.id);
  return { mode: 'destination', destinationId: destination.id, ventureId: context.ventureId,
    url: destination.url, label: destination.action, measurement: destination.measurement, reason,
    from: context.intended?.destinationId === destination.id ? 'venture' : suggested ? 'advisor' : 'owner', reviewed: true };
}
export function verifyReaderAction(folder: string, request: ContentRequest): void {
  const action = request.readerAction;
  if (!action || action.mode !== 'destination') return;
  const context = contentConversionContext(folder, request);
  const d = context.destinations.find(d => d.id === action.destinationId);
  if (context.ventureId !== action.ventureId || !d || !['ready', 'linked'].includes(d.status) || d.url !== action.url || d.action !== action.label) {
    throw new Error('The CTA destination changed or is not ready. Review the Content plan again.');
  }
}
export function protectDraftReaderAction(folder: string, previous: ContentRequest | undefined, next: ReaderAction | null): void {
  if (JSON.stringify(previous?.readerAction ?? null) !== JSON.stringify(next) && existsSync(join(folder,'review-queue.md')) && readQueue(folder).rows.length) {
    throw new Error('This piece already has drafts. Its CTA cannot be silently changed; keep the saved choice or create a new piece for a different CTA.');
  }
}
