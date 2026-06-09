// Load .env from the repo root into process.env (no dependency on dotenv).
// Import for side effect: `import "../util/env.js"`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";

try {
  const text = readFileSync(join(repoRoot, ".env"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // no .env yet — fine; scripts that need keys fail with their own message
}
