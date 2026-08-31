import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildResearchDossier,
  buildResearchDossierReviewPacket,
  recordResearchDossierEvidenceReview,
  recordResearchDossierDecision,
  type ResearchDossier,
  type ResearchDossierDecision,
  type ResearchDossierEvidenceReviewDecision,
  type ResearchDossierInput,
  type ResearchDossierProposalInput,
  type ResearchDossierReviewPacket,
} from "./research-dossier.js";

type Format = "json" | "markdown" | "html";
type ParsedArgs =
  | { command: "propose"; inputPath: string; outputPath: string | null }
  | { command: "review"; packetPath: string; decisionPath: string; outputPath: string | null }
  | { command: "build"; inputPath: string; format: Format; outputPath: string | null }
  | { command: "decide"; dossierPath: string; decisionPath: string; outputPath: string | null };

export interface ResearchDossierCliIo {
  readFile(path: string): string;
  write(value: string): void;
  writeFile(path: string, value: string): void;
  error(value: string): void;
}

const defaultIo: ResearchDossierCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  writeFile: (path, value) => writeFileSync(path, value, "utf8"),
  error: (value) => process.stderr.write(value),
};

function required(options: Map<string, string>, key: string): string {
  const value = options.get(key);
  if (!value) throw new TypeError(`${key} is required`);
  return value;
}

function options(args: string[], allowed: Set<string>): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !allowed.has(key)) throw new TypeError(`unknown argument: ${key ?? "<missing>"}`);
    if (!value || value.startsWith("--")) throw new TypeError(`${key} requires a value`);
    if (result.has(key)) throw new TypeError(`${key} may appear only once`);
    result.set(key, value);
  }
  return result;
}

export function parseResearchDossierArgs(args: string[]): ParsedArgs {
  const [command, ...rest] = args;
  if (command === "propose") {
    const parsed = options(rest, new Set(["--file", "--output"]));
    return { command, inputPath: required(parsed, "--file"), outputPath: parsed.get("--output") ?? null };
  }
  if (command === "review") {
    const parsed = options(rest, new Set(["--packet", "--decision", "--output"]));
    return {
      command,
      packetPath: required(parsed, "--packet"),
      decisionPath: required(parsed, "--decision"),
      outputPath: parsed.get("--output") ?? null,
    };
  }
  if (command === "build") {
    const parsed = options(rest, new Set(["--file", "--format", "--output"]));
    const format = parsed.get("--format") ?? "json";
    if (!new Set(["json", "markdown", "html"]).has(format)) throw new TypeError("format must be json, markdown, or html");
    return { command, inputPath: required(parsed, "--file"), format: format as Format, outputPath: parsed.get("--output") ?? null };
  }
  if (command === "decide") {
    const parsed = options(rest, new Set(["--dossier", "--decision", "--output"]));
    return {
      command,
      dossierPath: required(parsed, "--dossier"),
      decisionPath: required(parsed, "--decision"),
      outputPath: parsed.get("--output") ?? null,
    };
  }
  throw new TypeError("command must be propose, review, build, or decide");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderResearchDossierMarkdown(dossier: ResearchDossier): string {
  const status = dossier.readiness.status === "pending_muxin_review" ? "Pending Muxin review" : dossier.readiness.status;
  const summaries = dossier.summaries.map((summary) => [
    `### ${summary.id}`,
    "",
    summary.statement,
    "",
    `Evidence: ${summary.evidenceRefs.join(", ")}`,
    `Originality: ${summary.originality.status}. ${summary.originality.note}`,
    ...summary.caveats.map((caveat) => `- Caveat: ${caveat}`),
  ].join("\n")).join("\n\n");
  const evidence = dossier.boundedEvidence.included.map((row) => [
    `- **${row.id}** (${row.platform}, ${row.pool})`,
    `  - ${row.evidenceLinks.join(", ")}`,
    `  - Metric: ${row.metric.numerator}/${row.metric.denominator} ${row.metric.name}; observed ${row.metric.observedAt}`,
    `  - Baseline: ${row.baselineRef}; ${row.baselineScope}`,
    ...row.caveats.map((caveat) => `  - Caveat: ${caveat}`),
  ].join("\n")).join("\n");
  const evidenceReview = dossier.evidenceReview
    ? ["## Evidence review receipt", "", dossier.evidenceReview.note, "", `Packet: ${dossier.evidenceReview.packetDigest}`, `Reviewed: ${dossier.evidenceReview.reviewedAt}`]
    : ["## Evidence review receipt", "", "No digest-bound evidence review receipt is attached."];
  return [
    "# Research dossier review", "", `**${status}**`, "", `Question: ${dossier.question.text}`,
    "", `Intended use: ${dossier.question.intendedUse}`, "", `Reviewed dossier digest: ${dossier.digest}`, "", "No winner claims are allowed.",
    "", "## Selection policy", "", dossier.selectionPolicy.description,
    "", "## Pattern summaries", "", summaries, "", "## Included evidence", "", evidence, "", ...evidenceReview,
    "", "## Decision", "", dossier.usabilityDecision ? `${dossier.usabilityDecision.disposition}: ${dossier.usabilityDecision.note}` : "Muxin must choose observation, hypothesis, experiment input, revise, or reject.",
    "",
  ].join("\n");
}

export function renderResearchDossierHtml(dossier: ResearchDossier): string {
  const status = dossier.readiness.status === "pending_muxin_review" ? "Pending Muxin review" : dossier.readiness.status;
  const summaries = dossier.summaries.map((summary) => `
    <article class="card"><h2>${escapeHtml(summary.statement)}</h2>
      <p class="meta">Evidence: ${summary.evidenceRefs.map(escapeHtml).join(", ")}</p>
      <p><strong>Originality:</strong> ${escapeHtml(summary.originality.note)}</p>
      <ul>${summary.caveats.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>`).join("");
  const evidence = dossier.boundedEvidence.included.map((row) => `
    <article class="evidence"><h3>${escapeHtml(row.id)} <span>${escapeHtml(row.platform)} · ${escapeHtml(row.pool)}</span></h3>
      <p>${row.evidenceLinks.map((link) => `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`).join(" · ")}</p>
      <p>${row.metric.numerator}/${row.metric.denominator} ${escapeHtml(row.metric.name)} · observed ${escapeHtml(row.metric.observedAt)}</p>
      <p>Baseline: ${escapeHtml(row.baselineRef)} · ${escapeHtml(row.baselineScope)}</p>
      <ul>${row.caveats.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>`).join("");
  const evidenceReview = dossier.evidenceReview
    ? `<section><h2>Evidence review receipt</h2><p>${escapeHtml(dossier.evidenceReview.note)}</p><p class="meta">Packet: ${escapeHtml(dossier.evidenceReview.packetDigest)} · Reviewed ${escapeHtml(dossier.evidenceReview.reviewedAt)}</p></section>`
    : `<section><h2>Evidence review receipt</h2><p>No digest-bound evidence review receipt is attached.</p></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Research dossier review</title><style>
  :root{color-scheme:light;background:#f5f1e8;color:#1e2824;font:16px/1.5 system-ui,sans-serif}body{max-width:960px;margin:0 auto;padding:48px 24px 80px}header{border-bottom:2px solid #1e2824;padding-bottom:28px;margin-bottom:28px}.status{display:inline-block;background:#f0c75e;padding:6px 10px;border-radius:999px;font-weight:700}.guard{background:#243c32;color:#fff;padding:14px 18px;border-radius:8px}.card,.evidence{background:#fff;border:1px solid #d6cdbd;border-radius:12px;padding:20px;margin:16px 0;box-shadow:0 2px 10px #21352a10}.card h2{font-size:1.25rem}.evidence h3 span,.meta{color:#66716b;font-size:.9rem}a{color:#12624a;overflow-wrap:anywhere}.decision{border:2px solid #243c32;padding:20px;border-radius:12px;margin-top:32px}ul{padding-left:22px}
  </style></head><body><header><span class="status">${escapeHtml(status)}</span><h1>Research dossier review</h1><p>${escapeHtml(dossier.question.text)}</p><p>Intended use: ${escapeHtml(dossier.question.intendedUse)}</p></header>
  <p class="guard"><strong>No winner claims.</strong> This bounded dossier remains unusable until Muxin records a disposition.</p><p class="meta">Reviewed dossier digest: ${escapeHtml(dossier.digest)}</p>
  <section><h2>Selection policy</h2><p>${escapeHtml(dossier.selectionPolicy.description)}</p></section>
  <section><h2>Pattern summaries</h2>${summaries}</section><section><h2>Included evidence</h2>${evidence}</section>${evidenceReview}
  <section class="decision"><h2>Decision required</h2><p>${dossier.usabilityDecision ? `${escapeHtml(dossier.usabilityDecision.disposition)}: ${escapeHtml(dossier.usabilityDecision.note)}` : "Choose: Observation, hypothesis, experiment input, revise, or reject."}</p></section>
  </body></html>`;
}

function render(dossier: ResearchDossier, format: Format): string {
  if (format === "markdown") return renderResearchDossierMarkdown(dossier);
  if (format === "html") return renderResearchDossierHtml(dossier);
  return `${JSON.stringify(dossier, null, 2)}\n`;
}

export function main(args = process.argv.slice(2), io: ResearchDossierCliIo = defaultIo): number {
  try {
    const parsed = parseResearchDossierArgs(args);
    let output: string;
    if (parsed.command === "propose") {
      const input = JSON.parse(io.readFile(parsed.inputPath)) as ResearchDossierProposalInput;
      output = `${JSON.stringify(buildResearchDossierReviewPacket(input), null, 2)}\n`;
    } else if (parsed.command === "review") {
      const packet = JSON.parse(io.readFile(parsed.packetPath)) as ResearchDossierReviewPacket;
      const decision = JSON.parse(io.readFile(parsed.decisionPath)) as ResearchDossierEvidenceReviewDecision;
      output = `${JSON.stringify(recordResearchDossierEvidenceReview(packet, decision), null, 2)}\n`;
    } else if (parsed.command === "build") {
      const input = JSON.parse(io.readFile(parsed.inputPath)) as ResearchDossierInput;
      output = render(buildResearchDossier(input), parsed.format);
    } else {
      const dossier = JSON.parse(io.readFile(parsed.dossierPath)) as ResearchDossier;
      const decision = JSON.parse(io.readFile(parsed.decisionPath)) as ResearchDossierDecision;
      output = `${JSON.stringify(recordResearchDossierDecision(dossier, decision), null, 2)}\n`;
    }
    if (parsed.outputPath) io.writeFile(parsed.outputPath, output);
    else io.write(output);
    return 0;
  } catch (error) {
    io.error(`patterns:research-dossier: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
