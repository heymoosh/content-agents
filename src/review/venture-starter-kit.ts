import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Fixed local reference only. No caller-supplied path or directory browsing.
export function readStarterKit(): Buffer | null {
  const path = join(homedir(), 'Documents/Personal Obsidian/Projects/Monetizing Projects/The Solo Business Starter Kit.pdf');
  return existsSync(path) ? readFileSync(path) : null;
}
