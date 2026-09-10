// Load .env from the repo root into process.env (no dependency on dotenv).
// Import for side effect: `import "../util/env.js"`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";

const injected = new Set<string>();

try {
  const text = readFileSync(join(repoRoot, ".env"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      injected.add(m[1]);
    }
  }
} catch {
  // no .env yet — fine; scripts that need keys fail with their own message
}

/**
 * The keys this loader actually set. A key already present in the ambient environment is NOT in
 * here: the loader left it alone, so it was never `.env`-sourced. Empty when there is no `.env`.
 */
export const dotenvInjectedKeys: ReadonlySet<string> = injected;

/** The given environment minus exactly the keys `.env` injected into it. */
export function withoutDotenvKeys(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (!injected.has(key)) out[key] = value;
  }
  return out;
}
