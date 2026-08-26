# Content Studio coordinator protocol

## Contract

This protocol is vendor-neutral. Codex is the first coordinator, but any host may implement the
same state transitions. The TypeScript tool validates and records coordination state; it does not
spawn agents, create branches or worktrees, edit product code, or write product state.

Only the attended coordinator edits `work.yaml` and the files under `runs/`. Workers write only in
their leased worktrees, return a commit and JSON report, and never edit coordination records. Do
not use the repository backlog, conductor, shared worker state, or a worker-authored `STATE.md`.

All coordinator mutations run from the single linked worktree on the `coordinator_branch` recorded
in `work.yaml`. The CLI rejects coordinator writes from the primary checkout or another branch.
Every durable manifest write compares and advances `state_revision`; a stale coordinator must
reload instead of overwriting newer state. Read-only `status` and `validate` remain available from
any checkout.

## Standing authorization and continuation loop

Muxin has authorized the coordinator to continue the entire approved Content Studio program without
requesting ordinary batch-by-batch approval. This authorization covers reconciling the baseline,
creating decision-complete packets and isolated worktrees, dispatching and returning bounded work,
testing, cross-family auditing, sequential integration, commits, pushes, pull requests, and
auto-merge for verified non-logic work.

The coordinator is persistent: after every task or batch it re-reads `work.yaml`, records the
completed result, identifies every newly eligible disjoint task, and starts the next safe batch.
Completing a phase, tranche, or batch is never a stopping condition.

Pause only for a genuine human gate or blocker: Muxin's candidate-account-slate decision before a
canonical `data/patterns/**` write; Muxin's before/after review for a content-generation-logic
change; a material unresolved product decision; destructive, irreversible, paid, credentialed, or
scope-expanding action; a persistent external/CI blocker; or a product-decision merge conflict.
Before presenting a gate, finish every other disjoint eligible task and provide one consolidated
decision packet that names the blocked work and the work that will resume after Muxin answers.

## Broad pattern-research policy

Muxin authorized the coordinator to treat the current 65 evidence-bearing accounts as a broad
research seed shortlist, not as viral, approved, best, complete, ranked, or exclusive candidates.
Researchers may identify additional candidates from the 371-account catalog or bounded public
research. All new research belongs in isolated, noncanonical staging packages until Muxin reviews
one consolidated candidate-account slate; never write canonical JSONL datasets before that gate.

Do not use a universal definition or score for "viral." Keep niche relevance, broad-platform
performance, format-specific performance, relative outperformance against a valid baseline,
repeatability, and evidence quality separate. Every proposed classification must name identity and
platform, evidence links or local identifiers, topic/niche, medium/formats, relevant examples,
available performance and baseline/gap, pool rationale, caveats, confidence, and a recommendation
to include, exclude, hold, or research further. Absolute reach or engagement must name a
denominator and measurement context. Unknown remains unknown.

Per-platform decision packets are body-free. They may summarize mechanisms and name useful
examples but never reproduce creator content. Finish disjoint eligible work before presenting the
single consolidated candidate-slate gate, including recommended niche/broad/format pools, held or
rejected candidates, missing platforms/formats, evidence/baseline gaps, and the exact decisions
Muxin must make. After that answer, continue immediately with exclusive canonical-data stewardship
and the remaining approved program.

## Durable layout

- `charter.md`: north star, preserved behavior, safety walls, and authoritative links.
- `work.yaml`: sole record of task status, dependencies, ownership, and leases.
- `tasks/<task-id>.md`: decision-complete packet for one task.
- `runs/<batch-id>/<task-id>.json`: combined builder, diff, auditor, and integration evidence,
  written by the coordinator from submitted reports.

Task IDs and batch IDs use lowercase letters, digits, and hyphens. Paths are repo-relative exact
paths or directory leases ending in `/**`. A worker may read only its packet, root/scoped rules,
and `context_paths`; it may edit only `write_paths` and must not read `forbidden_paths`.

## Task record

Every task records:

```text
id, batch_id, outcome, status, depends_on, base_sha,
context_paths, forbidden_paths, write_paths, semantic_locks,
builder_family, auditor_family, branch, worktree, acceptance_commands,
user_visible_behavior, content_logic_change, human_gate,
commit_sha, audit_verdict
```

Statuses are `proposed`, `awaiting-user`, `ready`, `leased`, `building`, `auditing`, `needs-fix`,
`accepted`, `integrated`, and `blocked`. `proposed` and `awaiting-user` may have a null baseline,
branch, or worktree. Product work from `ready` onward needs a full 40-character `base_sha` and at
least one acceptance command. Claiming requires an actual clean worktree on the named branch at
the exact base SHA.

The semantic lock `canonical:data/patterns/**` is mandatory for any `data/patterns/**` write and
may be held by only one active task. Other locks name behavior shared across otherwise separate
files, for example `studio:conversation-routing` or `publish:approval-gate`.

## Attended batch

1. A bounded scoper reads one relevant product document and implementation area. It proposes one
   to three decision-complete packets. The coordinator receives metadata and summaries only.
2. Muxin approves the batch and resolves product decisions. The coordinator marks approved tasks
   `ready` in `work.yaml`.
3. The coordinator records one common clean `base_sha`, then creates a branch and worktree per
   task. `claim <task-id>` verifies the baseline and moves `ready -> leased`; a second claim records
   handoff with `leased -> building`.
4. Up to three builders run in parallel only when active file leases and semantic locks are
   disjoint. Hosts spawn agents with their native facilities. Subscription/local CLIs are the
   default; this protocol introduces no paid model routing.
5. Each worker reads the root rules, any scoped `AGENTS.md`, its packet, and named context only. It
   does not read other vision documents, packets, backlog files, unrelated corpus data, or raw
   pattern bodies.
6. The builder commits its work and returns a `builder` JSON report. `report` checks report paths
   against the lease and moves the task to `auditing`.
7. The named auditor family must differ from the builder family. It receives the packet, commit
   diff, and test output, not the builder conversation, and does not edit code. A failed audit
   moves the task to `needs-fix`; `claim` returns it to the original builder.
   If the assigned auditor is unavailable before completing an audit, the coordinator may use
   `reroute-auditor` to select another available cross-family auditor. The run record retains the
   original family, replacement family, timestamp, and concrete availability reason. Unavailability
   is not an audit failure, and the coordinator must not block while an authorized fallback exists.
8. The coordinator runs `verify-diff` on the final full commit SHA. The task becomes `accepted`
   only after the final diff is in lease, all named acceptance commands passed, and the
   cross-family audit passed. Audit and diff verification may arrive in either order.
9. Accepted commits integrate one at a time into a batch branch. The coordinator never resolves a
   conflict; it returns the task to its builder. An `integration` report from a non-builder family
   is required to move `accepted -> integrated`.
10. Run the final batch integration audit. Run `npm run test:e2e` once in a disposable worktree
    only if the batch changes user-visible Studio behavior. Heavy matrices and mutation tests stay
    in CI. After pushing, inspect `gh pr checks` once; do not poll.

Non-logic batches may merge after verification and green CI. Content-generation-logic batches are
separate draft PRs with side-by-side before/after samples and wait for Muxin's review.

## Commands

```bash
npm run studio:coord -- status
npm run studio:coord -- validate
npm run studio:coord -- claim <task-id>
npm run studio:coord -- verify-diff <task-id> <full-commit-sha>
npm run studio:coord -- report <task-id> <report-file>
npm run studio:coord -- reroute-auditor <task-id> <family> <reason-file>
```

`status` is read-only and shows unresolved dependencies. `validate` checks schema, dependencies,
cycles, active file/semantic conflicts, family separation, canonical pattern ownership, and durable
evidence for accepted/integrated work. `claim`, `verify-diff`, `report`, and `reroute-auditor` are
coordinator writes and therefore enforce the named linked-worktree and state-revision boundary.

## Report shapes

Builder:

```json
{
  "type": "builder",
  "task_id": "studio-client-extract",
  "family": "codex",
  "commit_sha": "<40-char-sha>",
  "changed_paths": ["src/review/studio/client/room.ts"],
  "acceptance_commands": [{ "command": "npm run check", "passed": true }],
  "behavior_impact": "none",
  "logic_impact": "none",
  "risks": [],
  "unresolved_items": []
}
```

Audit:

```json
{
  "type": "audit",
  "task_id": "studio-client-extract",
  "family": "grok",
  "verdict": "passed",
  "findings": []
}
```

Integration:

```json
{
  "type": "integration",
  "task_id": "studio-client-extract",
  "family": "grok",
  "verdict": "passed"
}
```

The coordinator combines these with `diff_verified` and `verified_commit` in the run record. A
passing claim in a report is evidence, not permission to skip the command: the coordinator must
receive the actual command output from the worker/auditor and retain its short summary outside raw
product or corpus context.

## Family rotation

- Deterministic TypeScript or architecture: Codex builds, Grok audits.
- Pattern/template abstraction: Grok builds, Codex audits.
- Voice-sensitive/editorial workflows: Claude builds, Grok or Codex audits.

These are defaults, not routing logic. A batch may choose another pair as long as builder and
auditor families differ and repository cost/safety rules remain intact.
