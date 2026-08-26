import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyTaskReport,
  builderReportSchema,
  claimTask,
  describeProgram,
  recordVerifiedDiff,
  rerouteAuditor,
  advanceStateRevision,
  commitCoordinatorMutation,
  verifyChangedPaths,
  validateWorkManifest,
  type AuditReport,
  type BuilderReport,
  type WorkManifest,
} from "./coordinator.js";

const SHA = "a".repeat(40);

function task(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    batch_id: "batch-001",
    outcome: `Complete ${id}`,
    status: "ready",
    depends_on: [],
    base_sha: SHA,
    context_paths: ["docs/content-studio-vision.md"],
    forbidden_paths: ["data/patterns/**"],
    write_paths: [`src/${id}/**`],
    semantic_locks: [`room:${id}`],
    builder_family: "codex",
    auditor_family: "grok",
    branch: `feat/${id}`,
    worktree: `/tmp/${id}`,
    acceptance_commands: ["npm run check"],
    user_visible_behavior: false,
    content_logic_change: false,
    human_gate: "batch-approved",
    commit_sha: null,
    audit_verdict: "pending",
    ...overrides,
  };
}

function manifest(tasks: unknown[]): WorkManifest {
  return {
    version: 1,
    program: "content-studio",
    coordinator: "codex",
    coordinator_branch: "agent/content-studio-program",
    state_revision: 0,
    authoritative_documents: ["docs/content-system-blueprint.md"],
    tasks: tasks as WorkManifest["tasks"],
  };
}

test("accepts two disjoint running tasks and reports a dependency-blocked ready task", () => {
  const work = validateWorkManifest(manifest([
    task("client", { status: "building" }),
    task("server", { status: "auditing" }),
    task("room", { depends_on: ["client", "server"], write_paths: ["src/studio/room/**"] }),
  ]));

  const status = describeProgram(work);
  assert.deepEqual(status.counts, { auditing: 1, building: 1, ready: 1 });
  assert.deepEqual(status.tasks.find((item) => item.id === "room")?.blockedBy, ["client", "server"]);
});

test("rejects missing and cyclic dependencies", () => {
  assert.throws(
    () => validateWorkManifest(manifest([task("a", { depends_on: ["missing"] })])),
    /missing dependency/i,
  );
  assert.throws(
    () => validateWorkManifest(manifest([
      task("a", { depends_on: ["b"] }),
      task("b", { depends_on: ["a"] }),
    ])),
    /dependency cycle/i,
  );
});

test("rejects active file overlaps, semantic conflicts, and same-family audits", () => {
  assert.throws(
    () => validateWorkManifest(manifest([
      task("a", { status: "building", write_paths: ["src/studio/**"] }),
      task("b", { status: "auditing", write_paths: ["src/studio/client/**"] }),
    ])),
    /write path conflict/i,
  );
  assert.throws(
    () => validateWorkManifest(manifest([
      task("a", { status: "building", semantic_locks: ["studio:conversation"] }),
      task("b", { status: "building", semantic_locks: ["studio:conversation"] }),
    ])),
    /semantic lock conflict/i,
  );
  assert.throws(
    () => validateWorkManifest(manifest([task("a", {
      builder_family: "codex-builder",
      auditor_family: "codex-independent-auditor",
    })])),
    /different model families/i,
  );
});

test("normalizes task family aliases and stores different canonical providers", () => {
  const work = validateWorkManifest(manifest([task("a", {
    builder_family: "Codex-builder",
    auditor_family: "Grok-independent-auditor",
  })]));

  assert.equal(work.tasks[0]?.builder_family, "codex");
  assert.equal(work.tasks[0]?.auditor_family, "grok");
});

test("advances coordinator state only from the expected manifest revision", () => {
  const work = validateWorkManifest(manifest([task("a")]));
  assert.equal(work.state_revision, 0);
  assert.equal(advanceStateRevision(work, 0).state_revision, 1);
  assert.throws(() => advanceStateRevision(work, 1), /state revision.*changed/i);
});

test("persists run evidence before committing the manifest revision", () => {
  const calls: string[] = [];
  assert.throws(
    () => commitCoordinatorMutation({
      expectedRevision: 3,
      currentRevision: 3,
      writeRun: () => calls.push("run"),
      writeManifest: () => {
        calls.push("manifest");
        throw new Error("simulated manifest write failure");
      },
    }),
    /simulated manifest write failure/,
  );
  assert.deepEqual(calls, ["run", "manifest"]);
  assert.throws(
    () => commitCoordinatorMutation({
      expectedRevision: 2,
      currentRevision: 3,
      writeRun: () => calls.push("stale-run"),
      writeManifest: () => calls.push("stale-manifest"),
    }),
    /state revision changed/i,
  );
  assert.deepEqual(calls, ["run", "manifest"]);
});

test("reroutes an unavailable auditor with durable evidence and keeps cross-family enforcement", () => {
  const work = validateWorkManifest(manifest([task("a", {
    status: "auditing",
    auditor_family: "claude",
    commit_sha: "b".repeat(40),
  })]));
  const existing = {
    task_id: "a",
    batch_id: "batch-001",
    builder: {
      type: "builder" as const,
      task_id: "a",
      family: "codex",
      commit_sha: "b".repeat(40),
      changed_paths: ["src/a/index.ts"],
      acceptance_commands: [{ command: "npm run check", passed: true, summary: "check passed" }],
      behavior_impact: "none",
      logic_impact: "none",
      risks: [],
      unresolved_items: [],
    },
  };

  const rerouted = rerouteAuditor(
    work,
    "a",
    "grok",
    "Claude CLI was unavailable before the audit could start.",
    "2026-08-25T20:00:00.000Z",
    existing,
  );
  assert.equal(rerouted.manifest.tasks[0]?.auditor_family, "grok");
  assert.deepEqual(rerouted.run.audit_routing, [{
    from_family: "claude",
    to_family: "grok",
    reason: "Claude CLI was unavailable before the audit could start.",
    recorded_at: "2026-08-25T20:00:00.000Z",
  }]);
  assert.throws(
    () => rerouteAuditor(work, "a", "codex", "Fallback", "2026-08-25T20:00:00.000Z", existing),
    /different model family/i,
  );
  assert.throws(
    () => rerouteAuditor(
      validateWorkManifest(manifest([task("a", { status: "integrated", commit_sha: "b".repeat(40), audit_verdict: "passed" })])),
      "a",
      "grok",
      "Too late",
      "2026-08-25T20:00:00.000Z",
      existing,
    ),
    /cannot reroute.*integrated/i,
  );

  const completedAudit = {
    ...existing,
    audit: {
      type: "audit" as const,
      task_id: "a",
      family: "claude",
      verdict: "failed" as const,
      findings: ["Correction required"],
    },
  };
  assert.throws(
    () => rerouteAuditor(work, "a", "grok", "Audit shopping", "2026-08-25T20:00:00.000Z", completedAudit),
    /completed audit/i,
  );
});

test("archives the completed audit and audited commit when a correction replaces the builder report", () => {
  const priorCommit = "b".repeat(40);
  const nextCommit = "c".repeat(40);
  const priorBuilder: BuilderReport = {
    type: "builder",
    task_id: "a",
    family: "codex",
    commit_sha: priorCommit,
    changed_paths: ["src/a/index.ts"],
    acceptance_commands: [{ command: "npm run check", passed: true, summary: "passed" }],
    behavior_impact: "none",
    logic_impact: "none",
    risks: [],
    unresolved_items: [],
  };
  const failedAudit: AuditReport = {
    type: "audit",
    task_id: "a",
    family: "grok",
    verdict: "failed",
    findings: ["Correction required"],
  };
  const correctedBuilder = { ...priorBuilder, commit_sha: nextCommit };
  const work = validateWorkManifest(manifest([task("a", {
    status: "needs-fix",
    commit_sha: priorCommit,
    audit_verdict: "failed",
  })]));

  const updated = applyTaskReport(work, correctedBuilder, {
    task_id: "a",
    batch_id: "batch-001",
    builder: priorBuilder,
    audit: failedAudit,
  });

  assert.deepEqual(updated.run.audit_history, [{ ...failedAudit, commit_sha: priorCommit }]);
  assert.equal(updated.run.audit, undefined);
});

test("rejects unknown task and report families", () => {
  assert.throws(
    () => validateWorkManifest(manifest([task("a", { builder_family: "llama-builder" })])),
    /unknown model family/i,
  );

  assert.throws(
    () => applyTaskReport(
      validateWorkManifest(manifest([task("a", { status: "building" })])),
      {
        type: "builder",
        task_id: "a",
        family: "llama-builder",
        commit_sha: "b".repeat(40),
        changed_paths: ["src/a/index.ts"],
        acceptance_commands: [{ command: "npm run check", passed: true, summary: "check completed without errors" }],
        behavior_impact: "none",
        logic_impact: "none",
        risks: [],
        unresolved_items: [],
      },
      null,
    ),
    /unknown model family/i,
  );
});

test("rejects builder command results without a non-empty summary", () => {
  const report = {
    type: "builder" as const,
    task_id: "a",
    family: "codex",
    commit_sha: "b".repeat(40),
    changed_paths: ["src/a/index.ts"],
    acceptance_commands: [{ command: "npm run check", passed: true }],
    behavior_impact: "none",
    logic_impact: "none",
    risks: [],
    unresolved_items: [],
  };

  assert.equal(builderReportSchema.safeParse(report).success, false);
  assert.equal(
    builderReportSchema.safeParse({
      ...report,
      acceptance_commands: [{ ...report.acceptance_commands[0], summary: "" }],
    }).success,
    false,
  );
});

test("compares and stores report families by normalized provider", () => {
  let work = validateWorkManifest(manifest([task("a", {
    status: "building",
    builder_family: "codex-builder",
    auditor_family: "grok-independent-auditor",
  })]));
  const builder: BuilderReport = {
    type: "builder",
    task_id: "a",
    family: "codex-builder",
    commit_sha: "b".repeat(40),
    changed_paths: ["src/a/index.ts"],
    acceptance_commands: [{ command: "npm run check", passed: true, summary: "check completed without errors" }],
    behavior_impact: "none",
    logic_impact: "none",
    risks: [],
    unresolved_items: [],
  };

  let run;
  ({ manifest: work, run } = applyTaskReport(work, builder, null));
  assert.equal(run.builder?.family, "codex");

  const audit: AuditReport = {
    type: "audit",
    task_id: "a",
    family: "grok-independent-auditor",
    verdict: "passed",
    findings: [],
  };
  ({ manifest: work, run } = applyTaskReport(work, audit, run));
  assert.equal(run.audit?.family, "grok");

  ({ manifest: work, run } = recordVerifiedDiff(work, "a", builder.commit_sha, run));
  ({ manifest: work, run } = applyTaskReport(work, {
    type: "integration",
    task_id: "a",
    family: "grok-integration",
    verdict: "passed",
  }, run));
  assert.equal(run.integration?.family, "grok");
  assert.equal(work.tasks[0]?.status, "integrated");
});

test("rejects a same-provider audit hidden behind a role suffix", () => {
  const work = validateWorkManifest(manifest([task("a", {
    status: "auditing",
    builder_family: "codex-builder",
    auditor_family: "grok-auditor",
    commit_sha: "b".repeat(40),
  })]));

  assert.throws(
    () => applyTaskReport(work, {
      type: "audit",
      task_id: "a",
      family: "codex-independent-auditor",
      verdict: "passed",
      findings: [],
    }, {
      builder: {
        type: "builder",
        task_id: "a",
        family: "codex-builder",
        commit_sha: "b".repeat(40),
        changed_paths: ["src/a/index.ts"],
        acceptance_commands: [{ command: "npm run check", passed: true, summary: "check completed without errors" }],
        behavior_impact: "none",
        logic_impact: "none",
        risks: [],
        unresolved_items: [],
      },
    }),
    /different model family/i,
  );
});

test("allows only one active canonical pattern-data steward", () => {
  const steward = {
    forbidden_paths: [],
    write_paths: ["data/patterns/reviewed/**"],
    semantic_locks: ["canonical:data/patterns/**"],
    status: "building",
  };
  assert.throws(
    () => validateWorkManifest(manifest([task("a", steward), task("b", steward)])),
    /canonical pattern-data|semantic lock conflict/i,
  );
  assert.throws(
    () => validateWorkManifest(manifest([task("a", {
      forbidden_paths: [],
      write_paths: ["data/patterns/reviewed/**"],
      semantic_locks: [],
    })])),
    /canonical:data\/patterns/i,
  );
});

test("rejects unnamed baselines for product work and out-of-lease diffs", () => {
  assert.throws(
    () => validateWorkManifest(manifest([task("a", { status: "building", base_sha: null })])),
    /base_sha/i,
  );
  assert.throws(
    () => verifyChangedPaths(task("a") as never, ["src/a/index.ts", "src/b/surprise.ts"]),
    /outside.*lease/i,
  );
  assert.doesNotThrow(() => verifyChangedPaths(task("a") as never, ["src/a/index.ts"]));
});

test("claim refuses unresolved dependencies and advances an approved task through lease handoff", () => {
  const blocked = validateWorkManifest(manifest([
    task("upstream", { status: "accepted" }),
    task("downstream", { depends_on: ["upstream"] }),
  ]));
  assert.throws(() => claimTask(blocked, "downstream"), /dependencies.*integrated/i);

  const ready = validateWorkManifest(manifest([task("a")]));
  assert.equal(claimTask(ready, "a").tasks[0]?.status, "leased");
  const leased = claimTask(ready, "a");
  assert.equal(claimTask(leased, "a").tasks[0]?.status, "building");
});

test("audit failure prevents integration and passing cross-family evidence permits it", () => {
  let work = validateWorkManifest(manifest([task("a", { status: "building" })]));
  const builder: BuilderReport = {
    type: "builder",
    task_id: "a",
    family: "codex",
    commit_sha: "b".repeat(40),
    changed_paths: ["src/a/index.ts"],
    acceptance_commands: [{ command: "npm run check", passed: true, summary: "check completed without errors" }],
    behavior_impact: "none",
    logic_impact: "none",
    risks: [],
    unresolved_items: [],
  };
  ({ manifest: work } = applyTaskReport(work, builder, null));

  const failedAudit: AuditReport = {
    type: "audit",
    task_id: "a",
    family: "grok",
    verdict: "failed",
    findings: ["Missing boundary case"],
  };
  ({ manifest: work } = applyTaskReport(work, failedAudit, { builder }));
  assert.equal(work.tasks[0]?.status, "needs-fix");
  assert.throws(
    () => applyTaskReport(work, { type: "integration", task_id: "a", family: "grok", verdict: "passed" }, {
      builder,
      audit: failedAudit,
      diff_verified: true,
      verified_commit: builder.commit_sha,
    }),
    /accepted|audit/i,
  );

  work = validateWorkManifest(manifest([task("a", { status: "auditing", commit_sha: builder.commit_sha })]));
  const audit: AuditReport = { ...failedAudit, verdict: "passed", findings: [] };
  let run;
  ({ manifest: work, run } = applyTaskReport(work, audit, { builder }));
  assert.equal(work.tasks[0]?.status, "auditing", "passing audit waits for final diff verification");
  ({ manifest: work, run } = recordVerifiedDiff(work, "a", builder.commit_sha, run));
  assert.equal(work.tasks[0]?.status, "accepted");
  ({ manifest: work } = applyTaskReport(work, {
    type: "integration",
    task_id: "a",
    family: "grok",
    verdict: "passed",
  }, run));
  assert.equal(work.tasks[0]?.status, "integrated");
});

test("integration rejects failed commands and same-family audit reports", () => {
  const work = validateWorkManifest(manifest([task("a", {
    status: "auditing",
    commit_sha: "b".repeat(40),
  })]));
  const builder: BuilderReport = {
    type: "builder",
    task_id: "a",
    family: "codex",
    commit_sha: "b".repeat(40),
    changed_paths: ["src/a/index.ts"],
    acceptance_commands: [{ command: "npm run check", passed: false, summary: "check reported a failing assertion" }],
    behavior_impact: "none",
    logic_impact: "none",
    risks: [],
    unresolved_items: [],
  };
  assert.throws(
    () => applyTaskReport(work, {
      type: "audit",
      task_id: "a",
      family: "codex",
      verdict: "passed",
      findings: [],
    }, { builder, diff_verified: true, verified_commit: builder.commit_sha }),
    /different model family/i,
  );
  assert.throws(
    () => recordVerifiedDiff(work, "a", builder.commit_sha, {
      builder,
      audit: {
        type: "audit",
        task_id: "a",
        family: "codex",
        verdict: "passed",
        findings: [],
      },
    }),
    /assigned cross-family audit/i,
  );
  assert.throws(
    () => applyTaskReport(work, {
      type: "audit",
      task_id: "a",
      family: "grok",
      verdict: "passed",
      findings: [],
    }, { builder, diff_verified: true, verified_commit: builder.commit_sha }),
    /acceptance command.*failed/i,
  );
});
