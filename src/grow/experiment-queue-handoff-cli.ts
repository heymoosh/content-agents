import { readFile } from "node:fs/promises";
import {
  applyGrowExperimentQueueHandoff,
  buildGrowExperimentQueueHandoff,
  type AppliedGrowExperimentQueueHandoff,
} from "./experiment-queue-handoff.js";
import type { GrowExperimentDecisionInput, GrowExperimentProposal } from "./experiment-slice.js";

export interface GrowExperimentQueueHandoffCliIo {
  read(path: string): Promise<string>;
  output(body: string): Promise<void> | void;
  error(body: string): Promise<void> | void;
  apply(
    folder: string,
    proposal: GrowExperimentProposal,
    decision: GrowExperimentDecisionInput,
  ): AppliedGrowExperimentQueueHandoff;
}

const defaultIo: GrowExperimentQueueHandoffCliIo = {
  read: (path) => readFile(path, "utf8"),
  output: (body) => { process.stdout.write(body); },
  error: (body) => { process.stderr.write(body); },
  apply: applyGrowExperimentQueueHandoff,
};

function value(args: readonly string[], flag: string): string {
  const index = args.indexOf(flag);
  const result = index < 0 ? undefined : args[index + 1];
  if (!result || result.startsWith("--")) throw new Error(`${flag} is required`);
  return result;
}

async function json(io: GrowExperimentQueueHandoffCliIo, path: string): Promise<unknown> {
  try { return JSON.parse(await io.read(path)); }
  catch (error) { throw new Error(`${path}: invalid JSON (${error instanceof Error ? error.message : String(error)})`); }
}

/** Preview is the default. `--apply` is the only mode with filesystem side effects. */
export async function runGrowExperimentQueueHandoffCli(
  args: readonly string[],
  io: GrowExperimentQueueHandoffCliIo = defaultIo,
): Promise<number> {
  try {
    const proposalPath = value(args, "--proposal");
    const decisionPath = value(args, "--decision");
    const folder = value(args, "--folder");
    const proposal = await json(io, proposalPath) as GrowExperimentProposal;
    const decision = await json(io, decisionPath) as GrowExperimentDecisionInput;
    const result = args.includes("--apply")
      ? io.apply(folder, proposal, decision)
      : { ...buildGrowExperimentQueueHandoff(proposal, decision), folder, mode: "preview" as const };
    await io.output(JSON.stringify(result, null, 2) + "\n");
    return 0;
  } catch (error) {
    await io.error(`grow:experiment-handoff: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runGrowExperimentQueueHandoffCli(process.argv.slice(2));
}

