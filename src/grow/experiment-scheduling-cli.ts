import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyGrowExperimentQueueHandoff, buildGrowExperimentQueueHandoff } from "./experiment-queue-handoff.js";
import { scheduleGrowExperimentVariant } from "./experiment-scheduling.js";
import type { GrowExperimentDecisionInput, GrowExperimentProposal } from "./experiment-slice.js";

interface Args { proposal: string; decision: string; folder: string; variant: string; schedule: boolean }
interface CliIo {
  out(text: string): Promise<void>;
  error(text: string): Promise<void>;
  readJson(path: string): Promise<unknown>;
  apply: typeof applyGrowExperimentQueueHandoff;
  schedule: typeof scheduleGrowExperimentVariant;
}

const defaultIo: CliIo = {
  out: async (value) => { process.stdout.write(value); },
  error: async (value) => { process.stderr.write(value); },
  readJson: async (path) => JSON.parse(await readFile(path, "utf8")),
  apply: applyGrowExperimentQueueHandoff,
  schedule: scheduleGrowExperimentVariant,
};

function args(argv: readonly string[]): Args {
  const value = (flag: string): string => {
    const index = argv.indexOf(flag);
    const found = index >= 0 ? argv[index + 1] : undefined;
    if (!found || found.startsWith("--")) throw new Error(`${flag} is required`);
    return found;
  };
  const known = new Set(["--proposal", "--decision", "--folder", "--variant", "--schedule"]);
  for (const item of argv) if (item.startsWith("--") && !known.has(item)) throw new Error(`unknown option: ${item}`);
  return {
    proposal: resolve(value("--proposal")), decision: resolve(value("--decision")),
    folder: resolve(value("--folder")), variant: value("--variant"), schedule: argv.includes("--schedule"),
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2), io: CliIo = defaultIo): Promise<number> {
  try {
    const input = args(argv);
    const proposal = await io.readJson(input.proposal) as GrowExperimentProposal;
    const decision = await io.readJson(input.decision) as GrowExperimentDecisionInput;
    const preview = buildGrowExperimentQueueHandoff(proposal, decision);
    const candidate = preview.rows.find((row) => row.id === input.variant);
    if (!candidate) throw new Error(`decision has no unchanged approved variant ${input.variant}`);
    if (!input.schedule) {
      await io.out(JSON.stringify({ mode: "preview", candidate, autoScheduling: false, autoPublishing: false }, null, 2) + "\n");
      return 0;
    }
    const handoff = io.apply(input.folder, proposal, decision);
    const result = await io.schedule(handoff, input.variant);
    await io.out(JSON.stringify(result, null, 2) + "\n");
    return result.scheduleError === null && result.binding.readiness.status === "ready" ? 0 : 1;
  } catch (error) {
    await io.error(`grow:experiment-schedule: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
