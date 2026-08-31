import { readFile, writeFile } from "node:fs/promises";
import { buildGrowExperimentDecision, buildGrowExperimentProposal, renderGrowExperimentProposalHtml, type GrowExperimentDecisionInput, type GrowExperimentProposal, type GrowExperimentProposalInput } from "./experiment-slice.js";

export interface GrowExperimentSliceCliIo {
  read(path: string): Promise<string>;
  write(path: string, body: string): Promise<void>;
  output(body: string): Promise<void> | void;
  error(body: string): Promise<void> | void;
}

const defaultIo: GrowExperimentSliceCliIo = {
  read: (path) => readFile(path, "utf8"),
  write: (path, body) => writeFile(path, body, "utf8"),
  output: (body) => { process.stdout.write(body); },
  error: (body) => { process.stderr.write(body); },
};

function value(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const result = args[index + 1];
  if (!result || result.startsWith("--")) throw new Error(`${flag} requires a value`);
  return result;
}

async function json(io: GrowExperimentSliceCliIo, path: string): Promise<unknown> {
  try { return JSON.parse(await io.read(path)); } catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : "invalid JSON"}`); }
}

export async function runGrowExperimentSliceCli(args: readonly string[], io: GrowExperimentSliceCliIo = defaultIo): Promise<number> {
  try {
    const command = args[0];
    const inputPath = value(args, "--input");
    if (!inputPath) throw new Error("--input is required");
    const outputPath = value(args, "--output");
    if (command === "propose") {
      const proposal = buildGrowExperimentProposal(await json(io, inputPath) as GrowExperimentProposalInput);
      const rendered = args.includes("--html") ? renderGrowExperimentProposalHtml(proposal) : JSON.stringify(proposal, null, 2) + "\n";
      if (outputPath) await io.write(outputPath, rendered); else await io.output(rendered);
      return 0;
    }
    if (command === "decide") {
      const decisionPath = value(args, "--decision");
      if (!decisionPath) throw new Error("--decision is required");
      const proposal = await json(io, inputPath) as GrowExperimentProposal;
      const decision = await json(io, decisionPath) as GrowExperimentDecisionInput;
      const result = buildGrowExperimentDecision(proposal, decision);
      const rendered = JSON.stringify(result, null, 2) + "\n";
      if (outputPath) await io.write(outputPath, rendered); else await io.output(rendered);
      return 0;
    }
    throw new Error("command must be propose or decide");
  } catch (error) {
    await io.error(`grow:experiment-slice: ${error instanceof Error ? error.message : "invalid input"}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runGrowExperimentSliceCli(process.argv.slice(2));
}
