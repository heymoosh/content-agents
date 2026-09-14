import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from '../db/db.js';
import { dataRoot } from '../runtime/data-root.js';
import { readWebsiteMeasurement } from './venture-actions.js';

let running: Promise<ReturnType<typeof readWebsiteMeasurement>> | null = null;
/** Explicit owner-requested refresh. Fixed destination, read-only SQL, no credentials saved. */
export function refreshWebsiteMeasurement() {
  if (running) return running;
  const website = join(homedir(), 'Documents/GitHub/landing-page');
  const script = `process.env.HUMAN_INFERENCE_DATABASE_URL=process.env.DATABASE_URL;process.chdir(${JSON.stringify(repoRoot)});process.argv[2]=${JSON.stringify(website)};await import(${JSON.stringify(join(repoRoot,'src/ingest/website-measurements.ts'))})`;
  running = promisify(execFile)('vercel', ['env','run','-e','production','--','node','--import',join(repoRoot,'node_modules/tsx/dist/loader.mjs'),'--input-type=module','-e',script], {
    cwd: website, timeout: 45000, maxBuffer: 128000,
    env: {...process.env, CONTENT_AGENTS_DATA_ROOT:dataRoot()},
  }).then(()=>readWebsiteMeasurement()).catch(()=>{
    // Child errors may contain credentials. Never return stderr or command arguments to the UI.
    throw new Error('Website refresh failed. Check Vercel sign-in and database access. Previously saved totals are unchanged.');
  }).finally(()=>{running=null;});
  return running;
}
