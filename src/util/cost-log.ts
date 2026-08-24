import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { repoRoot } from "../db/db.js";

const COST_LOG = join(repoRoot, "data", "cost-log.csv");

export function logCost(entry: {
  step: string; // e.g. "image:gemini-imagen", "tts:elevenlabs"
  detail: string; // e.g. content slug or file name
  costUsd?: number;
  engine?: string;
}): void {
  mkdirSync(dirname(COST_LOG), { recursive: true });
  if (!existsSync(COST_LOG)) {
    appendFileSync(COST_LOG, "timestamp,step,detail,cost_usd,engine\n");
  } else {
    const existing = readFileSync(COST_LOG, "utf8");
    const lines = existing.split("\n");
    if (lines[0] && !lines[0].split(",").includes("engine")) {
      const migrated = lines.map((line, i) => i === 0 ? `${line},engine` : line ? `${line},` : line).join("\n");
      writeFileSync(COST_LOG, migrated);
    }
  }
  const line = [
    new Date().toISOString(),
    entry.step,
    `"${entry.detail.replace(/"/g, '""')}"`,
    entry.costUsd === undefined ? "" : entry.costUsd.toFixed(4),
    entry.engine ?? "",
  ].join(",");
  appendFileSync(COST_LOG, line + "\n");
}
