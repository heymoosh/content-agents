import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { repoRoot } from "../db/db.js";
import { dataRoot } from "../runtime/data-root.js";

/**
 * Where a cost row lands.
 *
 * Production is deliberately UNCHANGED: the root CLAUDE.md names `data/cost-log.csv` by path as
 * the place every paid call is logged, so with no override and outside a test context this is
 * byte-identical to the path this module has always written. Only two things move it:
 *
 * - `CONTENT_AGENTS_TEST_COST_LOG` — an explicit path, for a test that wants to read back the row
 *   it caused.
 * - a test process (`NODE_TEST_CONTEXT`) with no override — the row goes to the throwaway
 *   per-process `dataRoot()` instead of Muxin's real spend ledger. Before this, the suite appended
 *   synthetic rows (`outreach:draft,"Acme Co"`, `agent:claude,"Note: a Charles note"`) to a real
 *   financial record with no marker separating them from real spend.
 *
 * Resolved per call, not at import: a test may set either variable after this module loads.
 */
export function costLogPath(): string {
  const override = process.env.CONTENT_AGENTS_TEST_COST_LOG?.trim();
  if (override) return resolve(override);
  if (process.env.NODE_TEST_CONTEXT) return join(dataRoot(), "cost-log.csv");
  return join(repoRoot, "data", "cost-log.csv");
}

export function logCost(entry: {
  step: string; // e.g. "image:gemini-imagen", "tts:elevenlabs"
  detail: string; // e.g. content slug or file name
  costUsd?: number;
  engine?: string;
}): void {
  const costLog = costLogPath();
  mkdirSync(dirname(costLog), { recursive: true });
  if (!existsSync(costLog)) {
    appendFileSync(costLog, "timestamp,step,detail,cost_usd,engine\n");
  } else {
    const existing = readFileSync(costLog, "utf8");
    const lines = existing.split("\n");
    if (lines[0] && !lines[0].split(",").includes("engine")) {
      const migrated = lines.map((line, i) => i === 0 ? `${line},engine` : line ? `${line},` : line).join("\n");
      writeFileSync(costLog, migrated);
    }
  }
  const line = [
    new Date().toISOString(),
    entry.step,
    `"${entry.detail.replace(/"/g, '""')}"`,
    entry.costUsd === undefined ? "" : entry.costUsd.toFixed(4),
    entry.engine ?? "",
  ].join(",");
  appendFileSync(costLog, line + "\n");
}
