import { readFileSync } from 'node:fs';
import { queueExistingSeries } from '../review/venture-actions.js';

// Explicit owner-selected source only. No model, approval mutation, generation or publication.
const [slug, file, heading, count] = process.argv.slice(2);
if (!slug || !file || !heading || !count) throw new Error('Usage: queue-existing <venture> <source.md> <heading> <post-count>');
const result = await queueExistingSeries({ ventureSlug: slug, sourceRef: file, sourceText: readFileSync(file, 'utf8'),
  heading, expectedPosts: Number(count), title: 'Magic Outcome content test',
  questions: ['Which ideas help people move from overwhelm to agency, despair to hope, or outrage to joyful creation?',
    'Which platforms and formats reach people who respond?', 'Which posts lead to useful actions, essay visits, newsletter signups and survey responses?'] });
console.log(JSON.stringify({ id: result.id, sourcePosts: result.posts.length, contentSlugs: result.posts.map(p => p.contentSlug), status: 'ready-for-content-configuration' }));
