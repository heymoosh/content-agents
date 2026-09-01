import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { isBrandId, type BrandId } from "../identity/brand.js";
import { appendOutcomeRowsForBrand } from "../grow/outcome-ledger.js";
import { loadOutcomeLedgerEnvelope } from "../grow/outcome-ledger-cli.js";
import { migrateLegacyDataFile } from "../runtime/data-root.js";

export interface OutcomeIngestIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error: (value: string) => void | Promise<void>;
}

export interface OutcomeIngestOptions {
  readonly brandId: BrandId;
  readonly source: { readonly kind: "file"; readonly path: string } | { readonly kind: "json"; readonly value: string };
  readonly ledgerPath?: string;
}

function valueAfter(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseOutcomeIngestArgs(argv: readonly string[]): OutcomeIngestOptions {
  let brandId: BrandId | undefined, input: string | undefined, json: string | undefined, ledgerPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--brand") {
      const value = valueAfter(argv, index, arg);
      if (!isBrandId(value)) throw new Error("brand must be one of human-inference, charles, fiction");
      brandId = value; index += 1;
    } else if (arg === "--input" || arg === "--file") {
      if (input !== undefined || json !== undefined) throw new Error("exactly one of --input/--file or --json is allowed");
      input = valueAfter(argv, index, arg); index += 1;
    } else if (arg === "--json") {
      if (input !== undefined || json !== undefined) throw new Error("exactly one of --input/--file or --json is allowed");
      json = valueAfter(argv, index, arg); index += 1;
    } else if (arg === "--ledger") {
      ledgerPath = valueAfter(argv, index, arg); index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  if (!brandId) throw new Error("--brand is required");
  if (input === undefined && json === undefined) throw new Error("exactly one of --input/--file or --json is required");
  return {
    brandId,
    source: input !== undefined ? { kind: "file", path: input } : { kind: "json", value: json as string },
    ...(ledgerPath ? { ledgerPath } : {}),
  };
}

const defaultIo: OutcomeIngestIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(argv: readonly string[] = process.argv.slice(2), io: Partial<OutcomeIngestIo> = {}): Promise<number> {
  const effective = { ...defaultIo, ...io };
  try {
    const options = parseOutcomeIngestArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : await effective.readFile(options.source.path);
    if (typeof raw !== "string") throw new Error("input file must contain text");
    const rows = loadOutcomeLedgerEnvelope(raw);
    const ledgerPath = options.ledgerPath ?? migrateLegacyDataFile(["outcomes.jsonl"]);
    appendOutcomeRowsForBrand(rows, options.brandId, ledgerPath);
    await effective.write(`${JSON.stringify({ ok: true, brandId: options.brandId, appended: rows.length, ledger: ledgerPath })}\n`);
    return 0;
  } catch (error) {
    await effective.error(`ingest:outcomes: ${error instanceof Error ? error.message : "input is invalid"}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; });
}
