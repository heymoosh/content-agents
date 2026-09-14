import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { repoRoot } from '../db/db.js';
import { splitFrontmatter } from '../util/frontmatter.js';
import { conversionDestinations, readConversionPlan, safeDestinationUrl, type ConversionPlan } from '../venture/conversions.js';
import { readVentureSeries } from './venture-actions.js';

/** A read-through catalogue. Source files and Venture artifacts remain the authority. */
export function ventureResources(slug: string, root = join(repoRoot, 'content'), plan: ConversionPlan = readConversionPlan(slug)) {
  const destinations = conversionDestinations(slug, plan).map(d => ({ ...d, kind: d.kind || 'Venture resource', provenance: 'Venture', usedBy: [] as { id: string; title: string }[] }));
  const pieces: { id: string; title: string; resourceIds: string[] }[] = [];
  const series = readVentureSeries('human-inference');
  if (!existsSync(root)) return { destinations, pieces };
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = join(root, entry.name), requestPath = join(folder, 'content-request.json'), sourcePath = join(folder, 'source.md');
    if (![requestPath, sourcePath].every(p => existsSync(p) && lstatSync(p).isFile())) continue;
    let request;
    try { request = JSON.parse(readFileSync(requestPath, 'utf8')); } catch { continue; }
    if (!request || typeof request !== 'object') continue;
    if (!['human-inference', 'studio', 'venture'].includes(request.origin)) continue;
    const owners = [...new Set([request.ventureId, ...series.filter(s => s.posts.some(p => p.contentSlug === entry.name)).map(s => s.ventureSlug)].filter(Boolean))];
    if (owners.length !== 1 || owners[0] !== slug || request.id !== entry.name) continue;
    const { fm, body } = splitFrontmatter(readFileSync(sourcePath, 'utf8'));
    const title = String(fm.title || request.descriptor || entry.name);
    const links = [...body.matchAll(/(?<!!)\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g)].map(m => ({ name: m[1]!, url: m[2]! }));
    if (typeof fm.canonical_url === 'string' && !/\/note(?:\/|$)/i.test(fm.canonical_url)) links.push({ name: title, url: fm.canonical_url });
    const resourceIds: string[] = [];
    for (const link of links) {
      if (!safeDestinationUrl(link.url) || /\/note(?:\/|$)/i.test(new URL(link.url).pathname)) continue;
      const url = new URL(link.url).href;
      let resource = destinations.find(d => d.url && new URL(d.url).href === url);
      if (!resource) {
        const id = 'source-' + createHash('sha256').update(url).digest('hex').slice(0, 20);
        const essay = /\/(?:essays|p)\//.test(new URL(url).pathname);
        resource = { id, name: link.name, url, status: 'linked', audience: 'Readers of the linked content', benefit: link.name,
          action: essay ? 'Read the full essay:' : 'Explore the resource:', measurement: 'Not connected yet',
          kind: essay ? 'Essay' : 'Linked resource', provenance: 'Existing content link (not live-verified)', usedBy: [] };
        destinations.push(resource);
      }
      if (!resourceIds.includes(resource.id)) { resourceIds.push(resource.id); resource.usedBy.push({ id: entry.name, title }); }
    }
    pieces.push({ id: entry.name, title, resourceIds });
  }
  return { destinations, pieces };
}
