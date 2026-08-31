import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGrowExperimentRun } from "./experiment-run.js";
import type { GrowExperimentScheduleAttempt } from "./experiment-scheduling.js";
import type { GrowExperimentDecisionInput, GrowExperimentProposal } from "./experiment-slice.js";

interface InputEnvelope {
  proposal: GrowExperimentProposal;
  decision: GrowExperimentDecisionInput;
  attempts: GrowExperimentScheduleAttempt[];
}

interface CliIo {
  out(text: string): Promise<void>;
  error(text: string): Promise<void>;
  readJson(path: string): Promise<unknown>;
}

const defaultIo: CliIo = {
  out: async (value) => { process.stdout.write(value); },
  error: async (value) => { process.stderr.write(value); },
  readJson: async (path) => JSON.parse(await readFile(path, "utf8")),
};

function inputPath(argv: readonly string[]): string {
  const known = new Set(["--input"]);
  for (const item of argv) if (item.startsWith("--") && !known.has(item)) throw new Error(`unknown option: ${item}`);
  const index = argv.indexOf("--input");
  const found = index >= 0 ? argv[index + 1] : undefined;
  if (!found || found.startsWith("--")) throw new Error("--input is required");
  return resolve(found);
}

function envelope(value: unknown): InputEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input must be an object");
  const candidate = value as Partial<InputEnvelope>;
  if (!candidate.proposal) throw new Error("input.proposal is required");
  if (!candidate.decision) throw new Error("input.decision is required");
  if (!Array.isArray(candidate.attempts)) throw new Error("input.attempts must be an array");
  return candidate as InputEnvelope;
}

export async function main(argv: readonly string[] = process.argv.slice(2), io: CliIo = defaultIo): Promise<number> {
  try {
    const input = envelope(await io.readJson(inputPath(argv)));
    await io.out(JSON.stringify(buildGrowExperimentRun(input.proposal, input.decision, input.attempts), null, 2) + "\n");
    return 0;
  } catch (error) {
    await io.error(`grow:experiment-run: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
