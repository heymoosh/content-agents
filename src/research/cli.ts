import "../util/env.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDb, repoRoot } from "../db/db.js";
import { COVERAGE_PATH, runResearchCapture } from "./capture.js";
import { loadResearchTaxonomy, runClassification } from "./classification.js";
import { buildResearchReport, renderResearchReport } from "./read.js";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredFlag(name: string): string {
  const value = flag(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function numericFlag(name: string): number | undefined {
  const value = flag(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive number`);
  return parsed;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "backfill" || command === "sync") {
    const handle = process.env.SUBSTACK_HANDLE?.trim();
    if (!handle) throw new Error("SUBSTACK_HANDLE is required for research capture");
    const result = await runResearchCapture({
      mode: command,
      handle,
      limit: numericFlag("--limit"),
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.notesPartial > 0 || result.notesErrored > 0) process.exitCode = 1;
    return;
  }
  if (command === "classify" || command === "reclassify") {
    const taxonomyId = requiredFlag("--taxonomy");
    const taxonomyPath = flag("--taxonomy-file") ?? join(repoRoot, "config", "research-taxonomies", `${taxonomyId}.yaml`);
    const taxonomy = loadResearchTaxonomy(taxonomyPath);
    const db = openDb();
    try {
      const result = await runClassification({
        db,
        taxonomy,
        reclassify: command === "reclassify",
        limit: numericFlag("--limit"),
      });
      process.stdout.write(JSON.stringify(result) + "\n");
    } finally {
      db.close();
    }
    return;
  }
  if (command === "report") {
    const format = flag("--format") ?? "markdown";
    if (format !== "markdown" && format !== "json") throw new Error("--format must be markdown or json");
    const outputPath = flag("--out");
    const db = openDb();
    try {
      const report = buildResearchReport(db, flag("--coverage-file") ?? COVERAGE_PATH);
      const output = format === "json" ? JSON.stringify(report, null, 2) + "\n" : renderResearchReport(report);
      if (outputPath) {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, output, { mode: 0o600 });
      } else {
        process.stdout.write(output);
      }
    } finally {
      db.close();
    }
    return;
  }
  throw new Error("usage: research:backfill|research:sync|research:classify|research:reclassify|research:report");
}

main().catch((error: unknown) => {
  // Do not print thrown endpoint details: they can contain a handle, URL, or other identifier.
  const message = error instanceof Error ? error.message : "research command failed";
  if (/RESEARCH_HASH_KEY|SUBSTACK_HANDLE|gold-set|thresholds|taxonomy|usage:/.test(message)) console.error(message);
  else console.error("research command failed; inspect the local command context and retry");
  process.exitCode = 1;
});
