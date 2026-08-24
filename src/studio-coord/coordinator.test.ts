import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyTaskReport,
  claimTask,
  describeProgram,
  recordVerifiedDiff,
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
    () => validateWorkManifest(manifest([task("a", { auditor_family: "codex" })])),
    /different model families/i,
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
    acceptance_commands: [{ command: "npm run check", passed: true }],
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
    acceptance_commands: [{ command: "npm run check", passed: false }],
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
