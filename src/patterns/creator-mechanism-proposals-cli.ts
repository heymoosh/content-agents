// CLI for the creator-corpus lane: inventory the tracked creator-content Markdown, validate the
// body-free mechanism proposals against it, and report the tracked raw-body storage footprint.
//
// It reads the corpus and writes only inside the staging package. It never writes the corpus, the
// index, canonical pattern data, the reviewed hook-template ledger, or anything Content reads.
//
//   npm run patterns:creator-corpus -- inventory            # summary to stdout
//   npm run patterns:creator-corpus -- report               # regenerate staged inventory + coverage
//   npm run patterns:creator-corpus -- validate             # acceptance check, exits non-zero on findings
//   npm run patterns:creator-corpus -- storage              # tracked raw-body footprint

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  buildCorpusInventory,
  COVERAGE_FIELD_KINDS,
  CREATOR_CONTENT_DIR,
  CREATOR_CONTENT_INDEX,
  parseCreatorFile,
  type CorpusInventory,
  type ParsedCreatorFile,
} from "./creator-content-normalization.js";
import {
  buildCorpusIndex,
  MECHANISM_FAMILIES,
  readMechanismProposals,
  validateProposalsAgainstCorpus,
  type MechanismProposalSet,
  type ProposalValidationReport,
} from "./creator-mechanism-proposals.js";

export const CREATOR_MECHANISM_PROPOSALS_CLI_VERSION = "creator-mechanism-proposals-cli-v1" as const;

export const STAGING_DIR = "docs/content-studio-program/staging/creator-mechanism-proposals-20260827" as const;
export const INVENTORY_FILE = `${STAGING_DIR}/creator-corpus-inventory.json` as const;
export const COVERAGE_FILE = `${STAGING_DIR}/creator-corpus-coverage.md` as const;
export const PROPOSALS_FILE = `${STAGING_DIR}/mechanism-proposals.jsonl` as const;
export const VALIDATION_FILE = `${STAGING_DIR}/mechanism-proposal-validation.json` as const;

export type CreatorCorpusCommand = "inventory" | "report" | "validate" | "storage";

export interface CreatorCorpusCliOptions {
  readonly command: CreatorCorpusCommand;
  readonly root: string;
}

export interface CreatorCorpusCliIo {
  readonly readFile: (path: string) => string;
  readonly listDir: (path: string) => readonly string[];
  readonly writeFile: (path: string, value: string) => void;
  readonly write: (value: string) => void;
  readonly error: (value: string) => void;
}

function fail(message: string): never {
  throw new Error(message);
}

export function parseCreatorCorpusArgs(argv: readonly string[]): CreatorCorpusCliOptions {
  let command: CreatorCorpusCommand | undefined;
  let root = ".";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail("--root requires a value");
      root = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      fail(`unknown argument: ${argument}`);
    } else if (command !== undefined) {
      fail("only one command may be supplied");
    } else if (argument === "inventory" || argument === "report" || argument === "validate" || argument === "storage") {
      command = argument;
    } else {
      fail(`unknown command: ${argument}`);
    }
  }
  if (command === undefined) fail("a command is required: inventory, report, validate, or storage");
  return { command, root };
}

interface LoadedCorpus {
  readonly files: readonly ParsedCreatorFile[];
  readonly rawTextByFile: ReadonlyMap<string, string>;
  readonly indexText: string;
}

export function loadCorpus(root: string, io: CreatorCorpusCliIo): LoadedCorpus {
  const dir = `${root}/${CREATOR_CONTENT_DIR}`;
  const names = [...io.listDir(dir)].filter((name) => name.endsWith(".md")).sort();
  if (names.length === 0) fail(`no creator-content Markdown found under ${dir}`);
  const rawTextByFile = new Map<string, string>();
  const files = names.map((name) => {
    const text = io.readFile(`${dir}/${name}`);
    rawTextByFile.set(name, text);
    return parseCreatorFile(name, text);
  });
  return { files, rawTextByFile, indexText: io.readFile(`${root}/${CREATOR_CONTENT_INDEX}`) };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderInventoryJson(inventory: CorpusInventory): string {
  return `${JSON.stringify({ ...inventory, cli_version: CREATOR_MECHANISM_PROPOSALS_CLI_VERSION }, null, 2)}\n`;
}

function cell(value: unknown): string {
  return String(value ?? "").replace(/[|\r\n]/g, (character) => (character === "|" ? "\\|" : " ")).replace(/\s+/g, " ").trim();
}

function windowText(creator: CorpusInventory["creators"][number]): string {
  const window = creator.capture_window;
  if (window.earliest && window.latest) return `${window.earliest} to ${window.latest}`;
  if (window.relative_only > 0) return `relative only (${window.relative_only})`;
  if (window.source_undated > 0) return `source published no date (${window.source_undated})`;
  return "unknown";
}

export function renderCoverageMarkdown(inventory: CorpusInventory): string {
  const totals = inventory.totals;
  const reconciliation = inventory.index_reconciliation;
  const lines: string[] = [
    "# Creator-content corpus coverage",
    "",
    "Generated by `npm run patterns:creator-corpus -- report`. Regenerating it on an unchanged",
    "corpus produces an identical file. Every number here was measured from the Markdown, not",
    "taken from a claim inside it.",
    "",
    "This is a coverage account of research evidence. Nothing in it is reviewed, approved, best,",
    "a winner, proven, or available to Content generation.",
    "",
    "## Totals",
    "",
    `- Creator files: **${totals.files}** (${totals.creators_with_entries} with entries, ${totals.creators_with_zero_entries} with none)`,
    `- Parsed entries: **${totals.entries}**`,
    `- Entries with readable platform counts: ${totals.entries_with_available_metrics} of ${totals.entries}`,
    `- Entries with a partial capture: ${totals.entries_partial_capture} (of which paywall-gated: ${totals.entries_paywalled})`,
    `- Entries authored by someone other than the account owner: ${totals.entries_third_party_authored}`,
    `- Entries captured as a segmented thread: ${totals.entries_segmented_thread}`,
    `- Entries whose opening is visual rather than worded: ${totals.entries_visual_only_hook}`,
    `- Video entries: ${totals.transcript_expected}; carrying a transcript field: ${totals.transcript_field_present}; whose transcript field held text: ${totals.transcript_available}`,
    `- Tracked corpus size: ${totals.tracked_bytes} bytes`,
    "",
    "## Entries by platform",
    "",
    "| Platform | Entries |",
    "|---|---|",
    ...Object.entries(inventory.entries_by_platform).map(([platform, count]) => `| ${cell(platform)} | ${count} |`),
    "",
    "## Entries by evidence kind",
    "",
    "| Evidence kind | Entries |",
    "|---|---|",
    ...Object.entries(inventory.entries_by_evidence_kind).map(([kind, count]) => `| ${cell(kind)} | ${count} |`),
    "",
    "## Field coverage",
    "",
    "`present` means the field carried evidence, `partial` means the capture stopped early (a",
    "paywall gate, an excerpt, a visible-portion-only note), `absent` means the corpus recorded",
    "honestly that there was nothing to capture, `missing` means the field does not appear on the",
    "entry at all. `missing` is not a defect on its own: a wordless video has no transcript.",
    "",
    "| Field kind | Present | Partial | Absent | Missing |",
    "|---|---|---|---|---|",
    ...COVERAGE_FIELD_KINDS.map((kind) => {
      const coverage = inventory.field_coverage[kind];
      return `| ${cell(kind)} | ${coverage.present} | ${coverage.partial} | ${coverage.absent} | ${coverage.missing} |`;
    }),
    "",
    "## Recognized field-label variants",
    "",
    `The corpus spells its fields ${inventory.field_variants.length} different ways. Every variant below is`,
    "recognized by the parser and mapped to one field kind; a bold label outside this taxonomy is",
    "treated as the creator's own body copy, counted, and redacted rather than recorded.",
    "",
    "| Raw label | Kind | Qualifiers | Occurrences | Files |",
    "|---|---|---|---|---|",
    ...inventory.field_variants.map((variant) => `| ${cell(variant.raw_label)} | ${cell(variant.kind)} | ${cell(variant.qualifiers.join(", "))} | ${variant.occurrences} | ${variant.files} |`),
    "",
    "## Per-creator coverage",
    "",
    "| File | Platform | Claimed | Actual | Completeness | Metrics | Capture window | Partial | Paywalled | Third-party |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...inventory.creators.map((creator) => [
      "",
      cell(creator.file),
      cell(creator.platform ?? "unmapped"),
      cell(creator.claimed_captured === null ? "n/a" : `${creator.claimed_captured}/${creator.claimed_target}`),
      String(creator.actual_entries),
      cell(creator.capture_completeness),
      `${creator.metrics_available_entries}/${creator.actual_entries}`,
      cell(windowText(creator)),
      String(creator.flag_counts.partialCapture ?? 0),
      String(creator.flag_counts.paywalled ?? 0),
      String(creator.flag_counts.thirdPartyAuthored ?? 0),
      "",
    ].join(" | ").trim()),
    "",
    "## Index reconciliation",
    "",
    `- Index rows: ${reconciliation.index_rows}; distinct linked files: ${reconciliation.distinct_linked_files}; files on disk: ${totals.files}`,
    `- The index's own status line declares ${reconciliation.declared_captured_count ?? "no"} captured creators`,
    `- Rows carrying no file link: ${reconciliation.rows_without_file_link.length === 0 ? "none" : reconciliation.rows_without_file_link.map(cell).join("; ")}`,
    `- Files linked more than once: ${reconciliation.duplicate_linked_files.length === 0 ? "none" : reconciliation.duplicate_linked_files.join("; ")}`,
    `- Files on disk missing from the index: ${reconciliation.files_missing_from_index.length === 0 ? "none" : reconciliation.files_missing_from_index.join("; ")}`,
    `- Index links pointing at no file: ${reconciliation.index_links_to_missing_files.length === 0 ? "none" : reconciliation.index_links_to_missing_files.join("; ")}`,
    "",
    "| File | Index claim | Actual entries |",
    "|---|---|---|",
    ...reconciliation.per_file_count_mismatches.map((row) => `| ${cell(row.file)} | ${cell(row.index_claim)} | ${row.actual} |`),
    "",
    "## Anomalies",
    "",
    "| Kind | Count |",
    "|---|---|",
    ...Object.entries(inventory.anomaly_counts).map(([kind, count]) => `| ${cell(kind)} | ${count} |`),
    "",
    "| File | Line | Kind | Detail |",
    "|---|---|---|---|",
    ...inventory.anomalies.map((anomaly) => `| ${cell(anomaly.file)} | ${anomaly.line} | ${cell(anomaly.kind)} | ${cell(anomaly.detail)} |`),
    "",
  ];
  return `${lines.join("\n")}`;
}

export function renderStorageReport(inventory: CorpusInventory): string {
  const rows = [...inventory.creators].sort((left, right) => right.byte_length - left.byte_length);
  const lines = [
    `Tracked raw creator-body footprint under ${CREATOR_CONTENT_DIR}`,
    "",
    `files: ${inventory.totals.files}`,
    `entries: ${inventory.totals.entries}`,
    `bytes: ${inventory.totals.tracked_bytes}`,
    `lines: ${inventory.creators.reduce((total, creator) => total + creator.line_count, 0)}`,
    "",
    "largest files:",
    ...rows.slice(0, 10).map((creator) => `  ${creator.byte_length.toString().padStart(9)}  ${creator.file}`),
    "",
    "This command reports only. It moves nothing, deletes nothing, and rewrites no history.",
    "",
  ];
  return lines.join("\n");
}

export function renderValidationJson(report: ProposalValidationReport, set: MechanismProposalSet): string {
  return `${JSON.stringify({
    ...report,
    cli_version: CREATOR_MECHANISM_PROPOSALS_CLI_VERSION,
    proposals_by_family: set.by_family,
    summary: set.summary,
    body_included: false,
    available_to_generation: false,
  }, null, 2)}\n`;
}

function renderInventorySummary(inventory: CorpusInventory): string {
  const totals = inventory.totals;
  return [
    `creator files: ${totals.files}`,
    `entries: ${totals.entries}`,
    `entries with readable metrics: ${totals.entries_with_available_metrics}`,
    `partial captures: ${totals.entries_partial_capture} (paywalled ${totals.entries_paywalled})`,
    `third-party entries: ${totals.entries_third_party_authored}`,
    `video entries / transcript field present / transcript text present: ${totals.transcript_expected}/${totals.transcript_field_present}/${totals.transcript_available}`,
    `recognized field-label variants: ${inventory.field_variants.length}`,
    `anomalies: ${inventory.anomalies.length}`,
    `index rows: ${inventory.index_reconciliation.index_rows}, linked files: ${inventory.index_reconciliation.distinct_linked_files}, declared: ${inventory.index_reconciliation.declared_captured_count ?? "n/a"}`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const defaultIo: CreatorCorpusCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  listDir: (path) => readdirSync(path),
  writeFile: (path, value) => writeFileSync(path, value, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

export function runCreatorCorpusCli(argv: readonly string[], io: Partial<CreatorCorpusCliIo> = {}): number {
  const effectiveIo: CreatorCorpusCliIo = { ...defaultIo, ...io };
  try {
    const options = parseCreatorCorpusArgs(argv);
    const corpus = loadCorpus(options.root, effectiveIo);
    const inventory = buildCorpusInventory(corpus.files, corpus.indexText);

    if (options.command === "inventory") {
      effectiveIo.write(renderInventorySummary(inventory));
      return 0;
    }
    if (options.command === "storage") {
      effectiveIo.write(renderStorageReport(inventory));
      return 0;
    }
    if (options.command === "report") {
      effectiveIo.writeFile(`${options.root}/${INVENTORY_FILE}`, renderInventoryJson(inventory));
      effectiveIo.writeFile(`${options.root}/${COVERAGE_FILE}`, renderCoverageMarkdown(inventory));
      effectiveIo.write(`wrote ${INVENTORY_FILE}\nwrote ${COVERAGE_FILE}\n`);
      return 0;
    }

    const set = readMechanismProposals(effectiveIo.readFile(`${options.root}/${PROPOSALS_FILE}`));
    const index = buildCorpusIndex(corpus.files, corpus.rawTextByFile);
    const report = validateProposalsAgainstCorpus(set, index);
    effectiveIo.writeFile(`${options.root}/${VALIDATION_FILE}`, renderValidationJson(report, set));
    const familyLine = MECHANISM_FAMILIES.map((family) => `${family}=${set.by_family[family]}`).join(" ");
    effectiveIo.write([
      `proposals: ${set.summary.total} (${familyLine})`,
      `cross-creator: ${set.summary.cross_creator}, single-creator: ${set.summary.single_creator}`,
      `pending review: ${set.summary.pending_review}, pending originality: ${set.summary.pending_originality}`,
      `source refs checked: ${report.source_refs_checked}`,
      `findings: ${report.findings.length}`,
      "",
    ].join("\n"));
    if (!report.passed) {
      for (const finding of report.findings) {
        effectiveIo.error(`  ${finding.proposal_id}: ${finding.kind}: ${finding.detail}\n`);
      }
      return 1;
    }
    return 0;
  } catch (error) {
    effectiveIo.error(`patterns:creator-corpus: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCreatorCorpusCli(process.argv.slice(2));
}
