#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import {
  applyTaskReport,
  claimTask,
  describeProgram,
  parseRunRecord,
  recordVerifiedDiff,
  taskReportSchema,
  validateTaskEvidence,
  validateWorkManifest,
  type RunRecord,
  type StudioTask,
  type WorkManifest,
} from "./coordinator.js";
import { inspectCleanBaseline, inspectCleanWorktree, verifyTaskCommit } from "./git.js";

const root = process.cwd();
const programDir = join(root, "docs", "content-studio-program");
const workPath = join(programDir, "work.yaml");

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: invalid JSON: ${(error as Error).message}`);
  }
}

function loadManifest(): WorkManifest {
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(workPath, "utf8"));
  } catch (error) {
    throw new Error(`${workPath}: could not read valid YAML: ${(error as Error).message}`);
  }
  return validateWorkManifest(parsed);
}

function runPath(task: StudioTask): string {
  return join(programDir, "runs", task.batch_id, `${task.id}.json`);
}

function loadRun(task: StudioTask, required = false): RunRecord | null {
  const path = runPath(task);
  if (!existsSync(path)) {
    if (required) throw new Error(`task ${task.id} requires run record ${path}`);
    return null;
  }
  return parseRunRecord(readJson(path));
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tempPath, content);
  renameSync(tempPath, path);
}

function saveManifest(manifest: WorkManifest): void {
  atomicWrite(workPath, stringifyYaml(manifest, { lineWidth: 0 }));
}

function saveRun(task: StudioTask, run: RunRecord): void {
  atomicWrite(runPath(task), `${JSON.stringify(run, null, 2)}\n`);
}

function taskById(manifest: WorkManifest, id: string): StudioTask {
  const task = manifest.tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`unknown task: ${id}`);
  return task;
}

function validateDurableState(manifest: WorkManifest): void {
  for (const task of manifest.tasks) {
    validateTaskEvidence(task, loadRun(task));
    if (task.status === "leased") inspectCleanBaseline(task);
  }
}

function status(): void {
  const manifest = loadManifest();
  const summary = describeProgram(manifest);
  console.log(`Content Studio coordinator: ${manifest.tasks.length} task(s)`);
  if (Object.keys(summary.counts).length > 0) {
    console.log(Object.entries(summary.counts).sort().map(([state, count]) => `${state}=${count}`).join(" "));
  }
  for (const task of summary.tasks) {
    const blocked = task.blockedBy.length > 0 ? ` (waiting on ${task.blockedBy.join(", ")})` : "";
    console.log(`${task.id}: ${task.status}${blocked}`);
  }
}

function validate(): void {
  const manifest = loadManifest();
  validateDurableState(manifest);
  console.log(`valid: ${manifest.tasks.length} task(s), no lease or evidence conflicts`);
}

function claim(id: string): void {
  const manifest = loadManifest();
  const task = taskById(manifest, id);
  if (task.status === "ready" || task.status === "leased") inspectCleanBaseline(task);
  else if (task.status === "needs-fix") inspectCleanWorktree(task);
  const updated = claimTask(manifest, id);
  saveManifest(updated);
  console.log(`${id}: ${task.status} -> ${taskById(updated, id).status}`);
}

function verifyDiff(id: string, commit: string): void {
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error("commit must be a full 40-character SHA");
  const manifest = loadManifest();
  const task = taskById(manifest, id);
  const run = loadRun(task, true)!;
  const changed = verifyTaskCommit(task, commit);
  const updated = recordVerifiedDiff(manifest, id, commit, run);
  saveRun(task, updated.run);
  saveManifest(updated.manifest);
  console.log(`${id}: verified ${changed.length} changed path(s) at ${commit}`);
}

function report(id: string, reportFile: string): void {
  const manifest = loadManifest();
  const task = taskById(manifest, id);
  const parsed = taskReportSchema.safeParse(readJson(resolve(reportFile)));
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  const input = parsed.data;
  if (input.task_id !== id) throw new Error(`report task_id ${input.task_id} does not match ${id}`);
  const updated = applyTaskReport(manifest, input, loadRun(task));
  saveRun(task, updated.run);
  saveManifest(updated.manifest);
  console.log(`${id}: recorded ${input.type} report; status=${taskById(updated.manifest, id).status}`);
}

function usage(): never {
  throw new Error(
    "usage: npm run studio:coord -- <status|validate|claim TASK|verify-diff TASK COMMIT|report TASK REPORT_FILE>",
  );
}

function main(args: string[]): void {
  const [command, ...rest] = args;
  if (command === "status" && rest.length === 0) return status();
  if (command === "validate" && rest.length === 0) return validate();
  if (command === "claim" && rest.length === 1) return claim(rest[0]!);
  if (command === "verify-diff" && rest.length === 2) return verifyDiff(rest[0]!, rest[1]!);
  if (command === "report" && rest.length === 2) return report(rest[0]!, rest[1]!);
  usage();
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`studio coordinator: ${(error as Error).message}`);
  process.exitCode = 1;
}
