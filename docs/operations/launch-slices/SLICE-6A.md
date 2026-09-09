# SLICE-6A: Reconcile remaining requirements into safe parallel assignments

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this packet only.
Do not load the repository for context. Workers never commit.

## Goal

Produce an evidence-backed next-work map from the remaining master requirements, preserving
accepted slices and identifying independent dependency-ready deliverables with exact ownership.
This is planning/status reconciliation, not permission to implement speculative changes.

## Difficulty

Easy — bounded requirement reconciliation; distinguish stale historical tasks from open work.

## Depends on

5Z accepted at `b74c8898b086dad41694f4c47755362b8b6fe41e`.
All prior workers completed; no active ownership is reassigned.

## Owned files

Coordinator owns this packet, master START HERE/progress edits and successor packet creation.
Workers own separate retained evidence directories only. All master/packet/source reads use
`git show b74c8898b086dad41694f4c47755362b8b6fe41e:<path>` rather than mutable working files.
No repository-wide rewriting commands. Checks write only each lane's evidence directory.
No worker reads another worker's unfinished output. Candidate reconciliation/integration is serial.

### Lane A — safety and truthfulness remaining-work map

- Deliverable: requirement/disposition/dependency/next-experiment matrix with path:line citations.
- Own `/private/tmp/slice-6a-evidence/safety/` only.
- Read master `### P0: safety and truthfulness before broader use` plus shared cited sections below.
- Follow only concrete file paths or slice IDs named in those bounded sections to their relevant
  status/acceptance/result sections; do not recursively follow archive links or scan repository trees.
- If a proposed open task needs source verification, name the exact cited source files and symbols
  for a next packet; do not claim a defect or read unassigned implementation.
- Focused check: ensure every matrix row has evidence, disposition and dependency; record command
  and pinned input hashes. Output `RESULT.md` with recommendations, not an implementation verdict.
- Handoff: frozen RESULT.md plus hashes before coordinator compares the lanes.

### Lane B — promised operating loop and product-depth remaining-work map

- Deliverable: operating-loop/depth requirement matrix, next dependency-ready deliverables and
  explicit disjoint file ownership candidates. Own `/private/tmp/slice-6a-evidence/operating/` only.
- Read master `### P1: complete the promised operating loop`, `### P2: complete product depth`,
  and shared cited sections below. Same bounded follow-up rule and no implementation as Lane A.
- Focused check: every recommendation cites a requirement, known dependency and exact next
  evidence needed; record pinned input hashes. Output `RESULT.md` and return its hash.
- Handoff: frozen RESULT.md; do not consume Lane A unfinished output.

Parallel-safe: yes. A/B write disjoint evidence directories, run no repo-wide mutation commands,
and read only immutable named inputs. Their independent requirement classes can be reconciled
without either lane depending on the other's work. Runtime execution and integration wait for
exact requirements and ownership, then receive a separately specified packet.

## Do not touch

- Runtime/source/tests, real data, content, provider/scheduler state, credentials, backlog,
  other sessions' AGENTS/template/content/ledger edits. No model generation or provider canaries.
- Do not rerun 5P, settled audits or accepted slice checks. No browser needed for planning prose.

## Cited headings

`docs/content-studio-master-status.md`, limited to:
- `## Standing constraints` (the actual heading, not malformed historical text).
- `### P0: safety and truthfulness before broader use` (A only).
- `### P1: complete the promised operating loop` and `### P2: complete product depth` (B only).
- `### Do this next, in this order`.
- `### Decision 11 build order — REVISED to contracts-first (Codex review, Muxin 2026-09-03)`.
- `## Room-model execution order — start here in a new session`.
Shared status evidence: accepted 5Z packet and named predecessor packets as needed, bounded to
Goal/Depends on/Acceptance/RESULT BLOCK/accepted closeout. These establish settled status,
not permission to repeat checks. Do not read the master archive beyond listed sections.

## Acceptance

- [x] A1: Two independent matrices identify current versus historical requirements with citations.
- [x] A2: Settled accepted work is retained; uncertainties are labelled, not invented defects.
- [x] A3: Next dependency-ready work has explicit deliverables, dependencies, ownership and checks;
      parallelism meets all three protocol conditions or affected operations are serialized.
- [x] A4: Master points to next concrete packet(s); scoped frozen documentation review passes.

## Verify

Documentation only: status/planning prose, no executable inputs changed. Coordinator checks cited
requirements, packet links, dependencies, rule consistency and frozen diff. No runtime/full gate
or external audit required by documentation exception. UI/live integration not applicable.

```
git diff --check -- docs/operations/launch-slices/SLICE-6A.md docs/content-studio-master-status.md
```

## Observable result

A concrete next-work packet with useful parallel assignments, rather than duplicated investigation
or speculative changes to already accepted capabilities.

## Risk

Low — no runtime changes; external audit not required for this documentation boundary.
Review boundary: coordinator documentation review of matrices and exact packet/master diff.
Retain accepted 5Z and earlier results; reopen only on demonstrated changed evidence.
Reviewer outage does not affect this documentation-only boundary. Future behavior changes require
Claude audit when Codex builds (Codex when Claude builds), before integration.

## Families

- Lane A/B: Codex Terra high, appropriate for bounded requirement reconciliation.
- Auditor: not required for documentation only; coordinator reviews actual evidence.

## Closeout

Scoped documentation review PASS; hygiene disposition recorded at integration checkpoint below.

## RESULT BLOCK

- Changed paths: this packet, `SLICE-6B.md`, master START HERE/progress.
- Outcome: accepted documentation reconciliation; 6B source checkpoints assigned, not accepted.
- Checks run and results: both lane matrix checks exit 0; coordinator frozen scope/link/rule
  review and `git diff --check` PASS. No runtime gate required for planning prose.
- Evidence locations: `/private/tmp/slice-6a-evidence/`.
- Unresolved: no 6A blockers; actual 6B source status remains its own checkpoint.

## Reconciliation checkpoint

Two frozen reports received and reviewed:
- safety/RESULT.md SHA256 `d5456fb8697f4a8b875fe78e6a9bb824a0c4a441a9e65911d51ea443a5de05c5`.
- operating/RESULT.md SHA256 `ff58991e88aef1497e2dc957a2bdbad99ba01995856afa543b593c9de44bca75`.
Paths are beneath `/private/tmp/slice-6a-evidence/`; their structural checks exited 0.

Coordinator disposition: accepted packets retain P0/P1 implementation evidence. The stale 5B
recommendation was withdrawn before assignment. P2 rows describe historical operational/depth
requirements, not newly verified current behavior or authority to publish. In particular, this
map does not reinstate historical Charles manual-only policy or undo accepted attribution.
Worker-proposed packet numbers were provisional and are not assignments.

Selected successor: `docs/operations/launch-slices/SLICE-6B.md`, two independent source checkpoints
for 5O unresolved 2 (queue-view ledger path) and 4 (render-child cost observability). They are
unverified historical gaps, not asserted current defects. 5Q changed page files, and 5Z tested
the fake-model job chain; neither establishes these separate outcomes. Source verification is
ready without an owner decision. Exact implementation ownership follows completed checkpoints.
No runtime checks or external audit were needed for this planning-only result.

## Accepted closeout

Documentation-only PASS. Hygiene exit 1 rescued `refs/wip/content-agents` at `3ba234d`.
No prunable worktrees. Preserve pre-existing AGENTS/template/content review-queue/notes-ledger
edits and all seven older branches named by hygiene; none belong to this slice. This session
created `SLICE-6A.md` and `SLICE-6B.md`, both included in the documentation commit. Retain only
bounded evidence roots `/private/tmp/slice-6a-evidence/` and `/private/tmp/slice-6b-evidence/`.
Main remains main; no push. 6B implementation and acceptance remain pending.
