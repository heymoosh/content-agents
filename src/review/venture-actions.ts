import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../db/db.js';
import { dataRoot } from '../runtime/data-root.js';
import { withFileLock } from '../runtime/file-lock.js';
import { readArtifact } from '../venture/artifacts.js';
import { writeContentRequest } from './content-request-store.js';
import type { BrandId } from '../identity/brand.js';
import Database from 'better-sqlite3';
import { DB_PATH } from '../db/db.js';
import { readQueue } from '../publish/queue.js';

/** Public, source-selected work only. Never copies intake, decisions or survey responses to Signals. */
export interface VentureSeries {
  id: string;
  ventureSlug: string;
  brandId: 'human-inference';
  title: string;
  planUpdatedAt: string;
  sourceRef: string;
  sourceDigest: string;
  questions: string[];
  posts: { id: string; title: string; contentSlug: string; bodyDigest: string; draftCount?: number; matches?: {id:number;platform:string;url:string|null;postedAt:string|null}[] }[];
  createdAt: string;
}
export interface WebsiteMeasurement {
  brandId: 'human-inference';
  capturedAt: string;
  firstSignupAt: string | null;
  signups: number;
  surveyCompletions: number;
  activeSubscribers: number;
  source: 'website-postgres' | 'website-analytics-api';
  measuredSessions?: number;
  newSignups?: number;
  newSignupSessions?: number;
  unattributedSessions?: number;
  newSignupsWithoutSession?: number;
}
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const storePath = () => join(dataRoot(), 'venture-series.json');
export function readVentureSeries(brand: BrandId, path = storePath()): VentureSeries[] {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as VentureSeries[]).filter(s => s.brandId === brand) : [];
}
export function normalizedPost(text: string): string {
  return text.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
}
/** Exact whole-text matching only, scoped to the series brand. A missing import is not a zero. */
export function readSeriesProgress(brand: BrandId, options: {path?:string;contentRoot?:string;dbPath?:string} = {}): VentureSeries[] {
  const series = readVentureSeries(brand, options.path);
  if (!series.length) return [];
  const dbPath = options.dbPath ?? DB_PATH;
  let rows: {id:number;platform:string;url:string|null;posted_at:string|null;content_text:string|null}[] = [];
  if (existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly:true, fileMustExist:true });
    try { rows=db.prepare('SELECT id,platform,url,posted_at,content_text FROM posts WHERE brand_id = ? AND provider_account_id IS NOT NULL').all(brand) as typeof rows; }
    finally { db.close(); }
  }
  return series.map(s=>({...s,posts:s.posts.map(p=>{
    const folder=join(options.contentRoot??join(repoRoot,'content'),p.contentSlug);
    const requestPath=join(folder,'content-request.json');
    const request=existsSync(requestPath)?JSON.parse(readFileSync(requestPath,'utf8')):null;
    const body=request?.originalInput;
    if(typeof body!=='string'||digest(body)!==p.bodyDigest) return {...p,draftCount:undefined,matches:[]};
    const matches=rows.filter(r=>r.content_text&&normalizedPost(r.content_text)===normalizedPost(body)).map(r=>({id:r.id,platform:r.platform,url:r.url,postedAt:r.posted_at}));
    const draftCount=readQueue(folder).rows.filter(r=>r.status!=='discard').length;
    return {...p,draftCount,matches};
  })}));
}
export function readWebsiteMeasurement(path = join(dataRoot(), 'website-measurements.json')): WebsiteMeasurement | null {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
export function saveWebsiteMeasurement(value: WebsiteMeasurement, path = join(dataRoot(), 'website-measurements.json')): void {
  if (value.brandId !== 'human-inference' || !['website-postgres', 'website-analytics-api'].includes(value.source) || !Number.isFinite(Date.parse(value.capturedAt))
    || [value.signups, value.surveyCompletions, value.activeSubscribers].some(n => !Number.isSafeInteger(n) || n < 0)
    || value.surveyCompletions > value.signups || value.activeSubscribers > value.signups
    || (value.firstSignupAt !== null && !Number.isFinite(Date.parse(value.firstSignupAt)))
    || [value.measuredSessions, value.newSignups, value.newSignupSessions, value.unattributedSessions, value.newSignupsWithoutSession]
      .some(n => n !== undefined && (!Number.isSafeInteger(n) || n < 0))) throw new Error('Invalid website aggregate');
  // Explicit field projection prevents private fields hitching a ride into the public read.
  const safe = { brandId: value.brandId, source: value.source, capturedAt: value.capturedAt, firstSignupAt: value.firstSignupAt,
    signups: value.signups, surveyCompletions: value.surveyCompletions, activeSubscribers: value.activeSubscribers,
    ...(value.measuredSessions === undefined ? {} : { measuredSessions: value.measuredSessions }),
    ...(value.newSignups === undefined ? {} : { newSignups: value.newSignups }),
    ...(value.newSignupSessions === undefined ? {} : { newSignupSessions: value.newSignupSessions }),
    ...(value.unattributedSessions === undefined ? {} : { unattributedSessions: value.unattributedSessions }),
    ...(value.newSignupsWithoutSession === undefined ? {} : { newSignupsWithoutSession: value.newSignupsWithoutSession }), };
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path + '.tmp', JSON.stringify(safe, null, 2) + '\n', { mode: 0o600 });
  renameSync(path + '.tmp', path);
}

/** Deterministic selection, not model-generated copy or inferred editorial approval. */
export function selectedPosts(markdown: string, heading: string): string[] {
  const marker = '# ' + heading;
  const lines = markdown.split('\n');
  const index = lines.findIndex(line => line.trim() === marker);
  if (index < 0 || lines.filter(line => line.trim() === marker).length !== 1) throw new Error('Select one exact source heading');
  const tail = lines.slice(index + 1);
  const nextHeading = tail.findIndex(line => /^# /.test(line));
  const section = (nextHeading < 0 ? tail : tail.slice(0, nextHeading)).join('\n');
  const posts = section.split(/^---\s*$/m).map(s => s.trim()).filter(Boolean);
  if (!posts.length || posts.length > 20) throw new Error('Select between one and twenty existing posts');
  return posts;
}

/** Called only for an owner-selected existing source. Does not set any Venture approval field. */
export async function queueExistingSeries(input: {
  ventureSlug: string; title: string; sourceRef: string; sourceText: string; heading: string;
  questions: string[]; expectedPosts: number;
}, options: { contentRoot?: string; path?: string } = {}): Promise<VentureSeries> {
  if (!/^[a-z0-9][\w-]*$/.test(input.ventureSlug)) throw new Error('Invalid venture');
  const plan = readArtifact(input.ventureSlug, 'p1-research-plan');
  if (!plan || plan.fields?.reviewed_by_muxin !== true || plan.editorial_status === 'discarded') throw new Error('Review the research plan first');
  const bodies = selectedPosts(input.sourceText, input.heading);
  if (bodies.length !== input.expectedPosts) throw new Error('Source post count changed; review the selection');
  const sourceDigest = digest(bodies.join('\n\n---\n\n'));
  const id = input.ventureSlug + '-' + digest(input.sourceRef + '#' + input.heading).slice(0, 12);
  const path = options.path ?? storePath();
  const contentRoot = options.contentRoot ?? join(repoRoot, 'content');
  const series: VentureSeries = { id, ventureSlug: input.ventureSlug, brandId: 'human-inference', title: input.title,
    planUpdatedAt: plan.updated_at, sourceRef: input.sourceRef + '#' + input.heading, sourceDigest,
    questions: input.questions, createdAt: new Date().toISOString(),
    posts: bodies.map((body, i) => ({ id: `${id}-${i + 1}`, title: body.split('\n')[0]!.slice(0, 120),
      contentSlug: `venture-${id}-${i + 1}`, bodyDigest: digest(body) })) };
  const existing = readVentureSeries('human-inference', path).find(s => s.id === id);
  if (existing && existing.sourceDigest !== sourceDigest) throw new Error('Existing source changed. Preserve the queued version and review a new selection.');
  // Stable folder IDs make partial failures retryable. Never overwrite an existing source/request.
  for (const [i, post] of series.posts.entries()) {
    const folder = join(contentRoot, post.contentSlug);
    const body = bodies[i]!;
    mkdirSync(join(folder, 'cuts', 'existing-post'), { recursive: true });
    for (const sub of ['derivatives', 'images', 'video', 'ready-to-paste']) mkdirSync(join(folder, sub), { recursive: true });
    const source = `---\ntitle: ${JSON.stringify(post.title)}\norigin: ${JSON.stringify('file:' + series.sourceRef)}\nsource_kind: substack-note\npublished_at: null\nbrand_id: human-inference\n---\n\n${body}\n`;
    const sourcePath = join(folder, 'source.md');
    if (existsSync(sourcePath) && readFileSync(sourcePath, 'utf8') !== source) throw new Error('Queued source differs; refusing overwrite');
    if (!existsSync(sourcePath)) writeFileSync(sourcePath, source, { flag: 'wx' });
    const start = source.split('\n').length - body.split('\n').length;
    const refs = [`${start}-${start + body.split('\n').length - 1}`];
    const cut = `---\ntitle: ${JSON.stringify(post.title)}\nsource_lines: ${JSON.stringify(refs)}\n---\n\n${body}\n`;
    const cutPath = join(folder, 'cuts', 'existing-post', 'cut.md');
    if (existsSync(cutPath) && readFileSync(cutPath, 'utf8') !== cut) throw new Error('Selected source differs; refusing overwrite');
    if (!existsSync(cutPath)) writeFileSync(cutPath, cut, { flag: 'wx' });
    const queuePath=join(folder,'review-queue.md');
    const emptyQueue='# Review queue\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n';
    if (!existsSync(queuePath)) writeFileSync(queuePath, emptyQueue.replace('# Review queue','# '+post.title), { flag:'wx' });
    else if(readFileSync(queuePath,'utf8')===emptyQueue) writeFileSync(queuePath,emptyQueue.replace('# Review queue','# '+post.title));
    if (!existsSync(join(folder, 'content-request.json'))) await writeContentRequest(folder, {
      id: post.contentSlug, origin: 'human-inference', ventureId: input.ventureSlug, descriptor: post.title,
      originalInput: body, sourceProvenance: { kind: 'approved-cut', lens: 'existing-post', sourceLines: refs },
      treatments: ['platform-framing'], platforms: ['linkedin', 'bluesky'], media: ['none'], includeUntreatedControl: false,
    });
  }
  mkdirSync(join(path, '..'), { recursive: true });
  return withFileLock(path + '.lock', () => {
    const rows = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as VentureSeries[] : [];
    const found = rows.find(s => s.id === id);
    if (found) { if (found.sourceDigest !== sourceDigest) throw new Error('Series changed'); return found; }
    rows.push(series);
    writeFileSync(path + '.tmp', JSON.stringify(rows, null, 2) + '\n', { mode: 0o600 });
    renameSync(path + '.tmp', path);
    return series;
  });
}
