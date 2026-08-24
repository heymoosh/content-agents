import { pathToFileURL } from "node:url";
import { createGrowPlan, type GrowPlanRequest, type GrowSourceDescriptor } from "./index.js";

export interface GrowPlanCliIo {
  write: (value: string) => void;
  error?: (value: string) => void;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseGrowPlanArgs(argv: readonly string[]): GrowPlanRequest {
  let text: string | undefined;
  let file: string | undefined;
  let goal: string | undefined;
  const platforms: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--text") {
      text = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--file") {
      file = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--goal") {
      goal = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--platform") {
      platforms.push(...optionValue(argv, index, argument).split(",").map((platform) => platform.trim()).filter(Boolean));
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (text !== undefined && file !== undefined) {
    throw new Error("exactly one of --text or --file is allowed");
  }
  let source: GrowSourceDescriptor;
  if (text !== undefined) source = { kind: "inline-thought", text };
  else if (file !== undefined) source = { kind: "local-file", path: file };
  else throw new Error("exactly one of --text or --file is required");

  if (goal === undefined) throw new Error("--goal is required");
  if (!platforms.length) throw new Error("at least one --platform is required");
  return { source, goal, platforms };
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: GrowPlanCliIo = { write: (value) => process.stdout.write(value), error: (value) => process.stderr.write(value) },
): Promise<number> {
  try {
    io.write(`${JSON.stringify(createGrowPlan(parseGrowPlanArgs(argv)))}\n`);
    return 0;
  } catch (error) {
    io.error?.(`grow:plan: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
