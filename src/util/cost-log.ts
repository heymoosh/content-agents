import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { repoRoot } from "../db/db.js";

const COST_LOG = join(repoRoot, "data", "cost-log.csv");

export function logCost(entry: {
  step: string; // e.g. "image:gemini-imagen", "tts:elevenlabs"
  detail: string; // e.g. content slug or file name
  costUsd: number;
}): void {
  mkdirSync(dirname(COST_LOG), { recursive: true });
  if (!existsSync(COST_LOG)) {
    appendFileSync(COST_LOG, "timestamp,step,detail,cost_usd\n");
  }
  const line = [
    new Date().toISOString(),
    entry.step,
    `"${entry.detail.replace(/"/g, '""')}"`,
    entry.costUsd.toFixed(4),
  ].join(",");
  appendFileSync(COST_LOG, line + "\n");
}
