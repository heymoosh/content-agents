import { z } from "zod";

export const TASK_STATUSES = [
  "proposed",
  "awaiting-user",
  "ready",
  "leased",
  "building",
  "auditing",
  "needs-fix",
  "accepted",
  "integrated",
  "blocked",
] as const;

const shaSchema = z.string().regex(/^[0-9a-f]{40}$/i, "must be a full 40-character commit SHA");
const pathSchema = z.string().min(1).superRefine((value, context) => {
  const raw = value.endsWith("/**") ? value.slice(0, -3) : value;
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("*") && !value.endsWith("/**") ||
    raw.split("/").some((part) => part === "." || part === ".." || part === "")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "must be a normalized repo-relative path or a directory ending in /**",
    });
  }
});

export const taskSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  batch_id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  outcome: z.string().min(1),
  status: z.enum(TASK_STATUSES),
  depends_on: z.array(z.string().min(1)),
  base_sha: shaSchema.nullable(),
  context_paths: z.array(pathSchema),
  forbidden_paths: z.array(pathSchema),
  write_paths: z.array(pathSchema),
  semantic_locks: z.array(z.string().min(1)),
  builder_family: z.string().min(1),
  auditor_family: z.string().min(1),
  branch: z.string().min(1).nullable(),
  worktree: z.string().min(1).nullable(),
  acceptance_commands: z.array(z.string().min(1)),
  user_visible_behavior: z.boolean(),
  content_logic_change: z.boolean(),
  human_gate: z.string().min(1),
  commit_sha: shaSchema.nullable(),
  audit_verdict: z.enum(["pending", "passed", "failed"]),
}).strict();

export const workManifestSchema = z.object({
  version: z.literal(1),
  program: z.literal("content-studio"),
  coordinator: z.string().min(1),
  authoritative_documents: z.array(pathSchema).min(1),
  tasks: z.array(taskSchema),
}).strict();

export type StudioTask = z.infer<typeof taskSchema>;
export type WorkManifest = z.infer<typeof workManifestSchema>;

const ACTIVE_LEASE_STATUSES = new Set<StudioTask["status"]>([
  "leased",
  "building",
  "auditing",
  "needs-fix",
  "accepted",
]);
const BASELINE_REQUIRED_STATUSES = new Set<StudioTask["status"]>([
  "ready",
  "leased",
  "building",
  "auditing",
  "needs-fix",
  "accepted",
  "integrated",
]);
export const CANONICAL_PATTERN_LOCK = "canonical:data/patterns/**";

function schemaError(error: z.ZodError): Error {
  return new Error(error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; "));
}

function specParts(spec: string): { prefix: string; recursive: boolean } {
  return spec.endsWith("/**")
    ? { prefix: spec.slice(0, -3), recursive: true }
    : { prefix: spec, recursive: false };
}

export function pathMatches(spec: string, path: string): boolean {
  const parsed = specParts(spec);
  return parsed.recursive ? path === parsed.prefix || path.startsWith(`${parsed.prefix}/`) : path === parsed.prefix;
}

function pathSpecsOverlap(left: string, right: string): boolean {
  const a = specParts(left);
  const b = specParts(right);
  if (!a.recursive && !b.recursive) return a.prefix === b.prefix;
  if (a.recursive && b.recursive) {
    return a.prefix === b.prefix || a.prefix.startsWith(`${b.prefix}/`) || b.prefix.startsWith(`${a.prefix}/`);
  }
  return a.recursive ? pathMatches(left, b.prefix) : pathMatches(right, a.prefix);
}

function hasCanonicalPatternWrite(task: StudioTask): boolean {
  return task.write_paths.some((path) => pathSpecsOverlap(path, "data/patterns/**"));
}

function validateDependencies(tasks: StudioTask[]): void {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    for (const dependency of task.depends_on) {
      if (!byId.has(dependency)) throw new Error(`task ${task.id} has missing dependency ${dependency}`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string, chain: string[]): void {
    if (visiting.has(id)) throw new Error(`dependency cycle: ${[...chain, id].join(" -> ")}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const task = byId.get(id)!;
    for (const dependency of task.depends_on) visit(dependency, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of tasks) visit(task.id, []);
}

function validateLeaseConflicts(tasks: StudioTask[]): void {
  const active = tasks.filter((task) => ACTIVE_LEASE_STATUSES.has(task.status));
  for (let index = 0; index < active.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < active.length; otherIndex += 1) {
      const left = active[index]!;
      const right = active[otherIndex]!;
      const lockConflict = left.semantic_locks.find((lock) => right.semantic_locks.includes(lock));
      if (lockConflict) {
        const label = lockConflict === CANONICAL_PATTERN_LOCK ? "canonical pattern-data lock" : "semantic lock conflict";
        throw new Error(`${label} between ${left.id} and ${right.id}: ${lockConflict}`);
      }
      const writeConflict = left.write_paths.find((leftPath) =>
        right.write_paths.some((rightPath) => pathSpecsOverlap(leftPath, rightPath))
      );
      if (writeConflict) throw new Error(`write path conflict between ${left.id} and ${right.id}: ${writeConflict}`);
    }
  }
}

export function validateWorkManifest(input: unknown): WorkManifest {
  const result = workManifestSchema.safeParse(input);
  if (!result.success) throw schemaError(result.error);
  const manifest = result.data;
  const ids = new Set<string>();
  for (const task of manifest.tasks) {
    if (ids.has(task.id)) throw new Error(`duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (task.builder_family.toLowerCase() === task.auditor_family.toLowerCase()) {
      throw new Error(`task ${task.id} must use different model families for builder and auditor`);
    }
    if (BASELINE_REQUIRED_STATUSES.has(task.status) && task.base_sha === null) {
      throw new Error(`task ${task.id} requires a named base_sha before product work can start`);
    }
    if (BASELINE_REQUIRED_STATUSES.has(task.status) && task.acceptance_commands.length === 0) {
      throw new Error(`task ${task.id} requires at least one acceptance command`);
    }
    if (hasCanonicalPatternWrite(task) && !task.semantic_locks.includes(CANONICAL_PATTERN_LOCK)) {
      throw new Error(`task ${task.id} writes data/patterns/** and must hold ${CANONICAL_PATTERN_LOCK}`);
    }
    for (const writePath of task.write_paths) {
      const forbidden = task.forbidden_paths.find((path) => pathSpecsOverlap(path, writePath));
      if (forbidden) throw new Error(`task ${task.id} write path ${writePath} overlaps forbidden path ${forbidden}`);
    }
  }
  validateDependencies(manifest.tasks);
  validateLeaseConflicts(manifest.tasks);
  return manifest;
}

export function verifyChangedPaths(task: StudioTask, changedPaths: string[]): void {
  if (changedPaths.length === 0) throw new Error(`task ${task.id} diff is empty`);
  for (const path of changedPaths) {
    if (task.forbidden_paths.some((spec) => pathMatches(spec, path))) {
      throw new Error(`diff path ${path} is forbidden by task ${task.id}`);
    }
    if (!task.write_paths.some((spec) => pathMatches(spec, path))) {
      throw new Error(`diff path ${path} is outside task ${task.id}'s write lease`);
    }
  }
}

export function describeProgram(manifest: WorkManifest): {
  counts: Record<string, number>;
  tasks: Array<{ id: string; status: StudioTask["status"]; blockedBy: string[] }>;
} {
  const byId = new Map(manifest.tasks.map((task) => [task.id, task]));
  const counts: Record<string, number> = {};
  const tasks = manifest.tasks.map((task) => {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
    return {
      id: task.id,
      status: task.status,
      blockedBy: task.depends_on.filter((id) => byId.get(id)?.status !== "integrated"),
    };
  });
  return { counts, tasks };
}

export function claimTask(manifest: WorkManifest, taskId: string): WorkManifest {
  const task = manifest.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`unknown task: ${taskId}`);
  const byId = new Map(manifest.tasks.map((candidate) => [candidate.id, candidate]));
  const unresolved = task.depends_on.filter((id) => byId.get(id)?.status !== "integrated");
  if (unresolved.length > 0) throw new Error(`task ${task.id} dependencies must be integrated first: ${unresolved.join(", ")}`);
  let status: StudioTask["status"];
  if (task.status === "ready") status = "leased";
  else if (task.status === "leased" || task.status === "needs-fix") status = "building";
  else throw new Error(`task ${task.id} cannot be claimed from status ${task.status}`);
  return validateWorkManifest({ ...manifest, tasks: manifest.tasks.map((candidate) => candidate.id === taskId ? { ...candidate, status } : candidate) });
}

const commandResultSchema = z.object({ command: z.string().min(1), passed: z.boolean() }).strict();
export const builderReportSchema = z.object({
  type: z.literal("builder"),
  task_id: z.string().min(1),
  family: z.string().min(1),
  commit_sha: shaSchema,
  changed_paths: z.array(pathSchema).min(1),
  acceptance_commands: z.array(commandResultSchema),
  behavior_impact: z.string(),
  logic_impact: z.string(),
  risks: z.array(z.string()),
  unresolved_items: z.array(z.string()),
}).strict();
export const auditReportSchema = z.object({
  type: z.literal("audit"),
  task_id: z.string().min(1),
  family: z.string().min(1),
  verdict: z.enum(["passed", "failed"]),
  findings: z.array(z.string()),
}).strict();
export const integrationReportSchema = z.object({
  type: z.literal("integration"),
  task_id: z.string().min(1),
  family: z.string().min(1),
  verdict: z.literal("passed"),
}).strict();
export const taskReportSchema = z.discriminatedUnion("type", [builderReportSchema, auditReportSchema, integrationReportSchema]);
export type TaskReport = z.infer<typeof taskReportSchema>;
export type BuilderReport = z.infer<typeof builderReportSchema>;
export type AuditReport = z.infer<typeof auditReportSchema>;
export type IntegrationReport = z.infer<typeof integrationReportSchema>;

export interface RunRecord {
  task_id?: string;
  batch_id?: string;
  builder?: BuilderReport;
  audit?: AuditReport;
  integration?: IntegrationReport;
  diff_verified?: boolean;
  verified_commit?: string;
}

export const runRecordSchema = z.object({
  task_id: z.string().min(1),
  batch_id: z.string().min(1),
  builder: builderReportSchema.optional(),
  audit: auditReportSchema.optional(),
  integration: integrationReportSchema.optional(),
  diff_verified: z.boolean().optional(),
  verified_commit: shaSchema.optional(),
}).strict();

export function parseRunRecord(input: unknown): RunRecord {
  const result = runRecordSchema.safeParse(input);
  if (!result.success) throw schemaError(result.error);
  return result.data;
}

function parseReport(report: unknown): TaskReport {
  const result = taskReportSchema.safeParse(report);
  if (!result.success) throw schemaError(result.error);
  return result.data;
}

function passingAcceptance(task: StudioTask, builder: BuilderReport | undefined): void {
  if (!builder) throw new Error(`task ${task.id} has no builder report`);
  for (const command of task.acceptance_commands) {
    const result = builder.acceptance_commands.find((item) => item.command === command);
    if (!result) throw new Error(`acceptance command was not reported: ${command}`);
    if (!result.passed) throw new Error(`acceptance command failed: ${command}`);
  }
}

export function applyTaskReport(
  manifest: WorkManifest,
  inputReport: unknown,
  existing: RunRecord | null,
): { manifest: WorkManifest; run: RunRecord } {
  const report = parseReport(inputReport);
  const task = manifest.tasks.find((candidate) => candidate.id === report.task_id);
  if (!task) throw new Error(`unknown task: ${report.task_id}`);
  let updated: StudioTask;
  let run: RunRecord = { task_id: task.id, batch_id: task.batch_id, ...(existing ?? {}) };

  if (report.type === "builder") {
    if (!["leased", "building", "needs-fix"].includes(task.status)) {
      throw new Error(`builder report is not allowed from status ${task.status}`);
    }
    if (report.family.toLowerCase() !== task.builder_family.toLowerCase()) {
      throw new Error(`builder report family ${report.family} does not own task ${task.id}`);
    }
    verifyChangedPaths(task, report.changed_paths);
    run = { ...run, builder: report, audit: undefined, integration: undefined, diff_verified: false, verified_commit: undefined };
    updated = { ...task, status: "auditing", commit_sha: report.commit_sha, audit_verdict: "pending" };
  } else if (report.type === "audit") {
    if (task.status !== "auditing") throw new Error(`audit report is not allowed from status ${task.status}`);
    if (report.family.toLowerCase() === task.builder_family.toLowerCase()) {
      throw new Error(`audit must come from a different model family than the builder`);
    }
    if (report.family.toLowerCase() !== task.auditor_family.toLowerCase()) {
      throw new Error(`audit report family ${report.family} is not assigned to task ${task.id}`);
    }
    run = { ...run, audit: report };
    if (report.verdict === "failed") {
      updated = { ...task, status: "needs-fix", audit_verdict: "failed" };
    } else {
      passingAcceptance(task, run.builder);
      const status = run.diff_verified && run.verified_commit === task.commit_sha ? "accepted" : "auditing";
      updated = { ...task, status, audit_verdict: "passed" };
    }
  } else {
    if (task.status !== "accepted") throw new Error(`task ${task.id} must be accepted before integration`);
    if (report.family.toLowerCase() === task.builder_family.toLowerCase()) {
      throw new Error(`integration audit must come from a different model family than the builder`);
    }
    passingAcceptance(task, run.builder);
    if (run.audit?.verdict !== "passed" || task.audit_verdict !== "passed") {
      throw new Error(`task ${task.id} requires a passing cross-family audit before integration`);
    }
    if (run.audit.family.toLowerCase() !== task.auditor_family.toLowerCase() || run.audit.family.toLowerCase() === task.builder_family.toLowerCase()) {
      throw new Error(`task ${task.id} requires its assigned cross-family audit before integration`);
    }
    if (!run.diff_verified || run.verified_commit !== task.commit_sha) {
      throw new Error(`task ${task.id} requires a verified diff before integration`);
    }
    run = { ...run, integration: report };
    updated = { ...task, status: "integrated" };
  }

  return {
    manifest: validateWorkManifest({
      ...manifest,
      tasks: manifest.tasks.map((candidate) => candidate.id === task.id ? updated : candidate),
    }),
    run,
  };
}

export function recordVerifiedDiff(
  manifest: WorkManifest,
  taskId: string,
  commit: string,
  existing: RunRecord,
): { manifest: WorkManifest; run: RunRecord } {
  const task = manifest.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`unknown task: ${taskId}`);
  if (task.commit_sha !== commit) throw new Error(`verified commit ${commit} does not match task commit_sha ${task.commit_sha ?? "(missing)"}`);
  if (existing.builder?.commit_sha !== commit) throw new Error(`verified commit ${commit} does not match the builder report`);
  const run = { ...existing, task_id: task.id, batch_id: task.batch_id, diff_verified: true, verified_commit: commit };
  let updated = task;
  if (run.audit?.verdict === "passed") {
    if (run.audit.family.toLowerCase() !== task.auditor_family.toLowerCase() || run.audit.family.toLowerCase() === task.builder_family.toLowerCase()) {
      throw new Error(`task ${task.id} requires its assigned cross-family audit before acceptance`);
    }
    passingAcceptance(task, run.builder);
    updated = { ...task, status: "accepted", audit_verdict: "passed" };
  }
  return {
    manifest: validateWorkManifest({
      ...manifest,
      tasks: manifest.tasks.map((candidate) => candidate.id === task.id ? updated : candidate),
    }),
    run,
  };
}

export function validateTaskEvidence(task: StudioTask, run: RunRecord | null): void {
  if (!["auditing", "needs-fix", "accepted", "integrated"].includes(task.status)) return;
  if (!run?.builder) throw new Error(`task ${task.id} status ${task.status} requires a durable builder report`);
  if (run.task_id !== task.id || run.batch_id !== task.batch_id) throw new Error(`task ${task.id} run record identity does not match its lease`);
  if (run.builder.family.toLowerCase() !== task.builder_family.toLowerCase()) throw new Error(`task ${task.id} builder report family does not match its lease`);
  if (run.builder.commit_sha !== task.commit_sha) throw new Error(`task ${task.id} builder report commit does not match commit_sha`);
  verifyChangedPaths(task, run.builder.changed_paths);
  if (!["accepted", "integrated"].includes(task.status)) return;
  passingAcceptance(task, run.builder);
  if (!run.diff_verified || run.verified_commit !== task.commit_sha) throw new Error(`task ${task.id} has no verified final diff`);
  if (run.audit?.verdict !== "passed" || task.audit_verdict !== "passed") throw new Error(`task ${task.id} has no passing audit`);
  if (run.audit.family.toLowerCase() !== task.auditor_family.toLowerCase() || run.audit.family.toLowerCase() === task.builder_family.toLowerCase()) {
    throw new Error(`task ${task.id} audit is not cross-family`);
  }
  if (task.status === "integrated") {
    if (run.integration?.verdict !== "passed" || run.integration.family.toLowerCase() === task.builder_family.toLowerCase()) {
      throw new Error(`task ${task.id} integrated without a passing cross-family integration audit`);
    }
  }
}
