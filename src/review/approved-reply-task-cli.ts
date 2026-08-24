import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  assessApprovedReplyTaskReadiness,
  normalizeApprovedReplyTask,
  type ApprovedReplyTask,
  type ApprovedReplyTaskInput,
} from "./approved-reply-task.js";

export type ApprovedReplyTaskCliFormat = "json" | "markdown" | "both";

export interface ApprovedReplyTaskCliIO {
  readonly readFile: (path: string) => string;
}

interface CliOptions {
  readonly input: string;
  readonly format: ApprovedReplyTaskCliFormat;
}

function parseOptions(args: readonly string[], io: ApprovedReplyTaskCliIO): CliOptions {
  let json: string | undefined;
  let file: string | undefined;
  let format: ApprovedReplyTaskCliFormat = "both";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") json = args[++index];
    else if (arg?.startsWith("--json=")) json = arg.slice("--json=".length);
    else if (arg === "--file") file = args[++index];
    else if (arg?.startsWith("--file=")) file = arg.slice("--file=".length);
    else if (arg === "--format") format = args[++index] as ApprovedReplyTaskCliFormat;
    else if (arg?.startsWith("--format=")) format = arg.slice("--format=".length) as ApprovedReplyTaskCliFormat;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (json !== undefined && file !== undefined) throw new Error("exactly one of --json or --file is required");
  if (json === undefined && file === undefined) throw new Error("exactly one of --json or --file is required");
  if (format !== "json" && format !== "markdown" && format !== "both") throw new Error("format must be json, markdown, or both");

  if (json !== undefined) return { input: json, format };
  return { input: io.readFile(file as string), format };
}

function projection(task: ApprovedReplyTask): ApprovedReplyTask {
  return {
    kind: task.kind,
    version: task.version,
    id: task.id,
    commentObservationId: task.commentObservationId,
    draftText: task.draftText,
    replyPurpose: task.replyPurpose,
    claimRefs: [...task.claimRefs],
    targetPlatform: task.targetPlatform,
    humanDecision: task.humanDecision,
    decidedBy: task.decidedBy,
    decidedAt: task.decidedAt,
    deliveryStatus: task.deliveryStatus,
    sentAt: task.sentAt,
    lineage: task.lineage.map((entry) => ({ ...entry })),
    status: task.status,
    readiness: { status: task.readiness.status, blockers: [...task.readiness.blockers] },
    autoSend: false,
    autoPublish: false,
    sideEffects: "none",
  };
}

function jsonOutput(task: ApprovedReplyTask): string {
  return `${JSON.stringify(projection(task), null, 2)}\n`;
}

function markdownOutput(task: ApprovedReplyTask): string {
  const blockers = task.readiness.blockers.length === 0
    ? "None"
    : task.readiness.blockers.map((blocker) => `- ${blocker}`).join("\n");
  const refs = task.claimRefs.length === 0 ? "None" : task.claimRefs.join(", ");
  const lineage = task.lineage.length === 0
    ? "None"
    : task.lineage.map((entry) => `${entry.recordType}:${entry.id}${entry.relation === null ? "" : ` (${entry.relation})`}`).join(", ");

  return [
    "# Approved reply task",
    "",
    `- ID: ${task.id}`,
    `- Status: ${task.status}`,
    `- Human decision: ${task.humanDecision}`,
    `- Delivery: ${task.deliveryStatus}`,
    `- Readiness: ${task.readiness.status.toUpperCase()}`,
    "",
    "## Blockers",
    "",
    blockers,
    "",
    "## Comment observation",
    "",
    `- Reference: ${task.commentObservationId}`,
    `- Platform: ${task.targetPlatform}`,
    `- Reply purpose: ${task.replyPurpose}`,
    `- Claim refs: ${refs}`,
    `- Lineage: ${lineage}`,
    "",
    "## Proposed reply",
    "",
    "```text",
    task.draftText,
    "```",
    "",
  ].join("\n");
}

export function renderApprovedReplyTaskCli(args: readonly string[], io: ApprovedReplyTaskCliIO = { readFile: (path) => readFileSync(path, "utf8") }): string {
  const options = parseOptions(args, io);
  const parsed: unknown = JSON.parse(options.input);
  const normalized = normalizeApprovedReplyTask(parsed as ApprovedReplyTaskInput);
  const task: ApprovedReplyTask = {
    ...normalized,
    readiness: assessApprovedReplyTaskReadiness(normalized),
  };
  if (options.format === "json") return jsonOutput(task);
  if (options.format === "markdown") return markdownOutput(task);
  return `${jsonOutput(task)}---\n${markdownOutput(task)}`;
}

export function main(args: readonly string[] = process.argv.slice(2)): void {
  process.stdout.write(renderApprovedReplyTaskCli(args));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
