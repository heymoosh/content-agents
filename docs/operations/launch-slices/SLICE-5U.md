# SLICE-5U: select one reviewed row for the Typefully draft canary

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open the master document or load the repository for context. Do not commit.
Status source: `docs/content-studio-master-status.md` → `## START HERE`.

## Goal

Allow the production Typefully CLI to dispatch exactly one explicitly named, already approved
text row without changing any review status. This unblocks 5P's one-unscheduled-draft budget when
the source folder contains multiple approved rows. This slice uses fake providers only.

## Difficulty

Easy implementation, high-consequence boundary — validate selection before external effects and
preserve all existing approval, provenance, policy, retry and duplicate-attempt protections.

## Depends on

5T accepted at e78d2a9. 5P read-only preflight found two approved X rows selected by the folder-wide
CLI; current latest failed events record no provider request, so missing newer approval journal
alone does not block their known-safe retry path. Do not retrofit provenance or change approvals.

## Owned files

Parallel-safe: no — parser, shared selector and their tests form one coupled behavior.

### Lane A — explicit row selection and outcome verification

- `src/publish/typefully.ts`
- `src/publish/typefully.test.ts`
- `src/publish/unified-cli.ts`
- `src/publish/unified-cli.test.ts`
- Scratch evidence under `/private/tmp/slice-5u-evidence/`.

Coordinator owns this packet, 5P packet refresh and master updates. Worker returns RESULT BLOCK;
no worker commits. Preserve other sessions' work. Build in coordinator-assigned isolated worktree.

## Do not touch

- Every other production/test file, GUI, generation, .claude/skills, backlog, real content or data.
- User approvals, existing identities, provider history, claims/fences and credentials.
- No real provider discovery, drafts, scheduling, publishing, cleanup or paid product model calls.
- No real 5P canary, git push or worker commit.

## Cited headings

No master archive. Bounded dependencies: `src/review/publishing-status.ts` selection/attempt
interface; `src/review/studio-scheduling.ts` scheduleKind and fake provider seam;
`src/review/approval-provenance.ts` approval fixture helpers; `src/publish/queue.ts` read/append
helpers; current owned tests' necessary imports. Narrow named callers of changed APIs may be
searched to preserve compatibility; report consulted paths. Do not broaden into a repo survey.

## Acceptance

- [x] A1 — `node --import tsx src/publish/typefully.ts <folder> --no-schedule --only-id <row-id>`
  uses the same production unified path but considers exactly that row; no alternate dispatch route.
- [x] A2 — Missing/empty/duplicate --only-id, unknown ID, unapproved row or non-text/wrong-kind row
  fails before any provider call. Parser conflict checks and unsupported flags still fail closed.
  A selector with --list must be rejected; never silently ignored. Validate exact IDs, no substring.
- [x] A3 — No selector preserves existing folder-wide behavior. Existing scheduled/no-schedule/env
  compatibility remains. Force-reuse stays refused on unified route. No review status is modified.
- [x] A4 — A hermetic outcome check invokes actual runTypefullyCli parser plus unified route with
  two approved text rows and fake provider: exactly one create for selected row, returned ID durable
  as private, no plannedFor/publish_at, zero slot claims; unselected row has no dispatch event.
- [x] A5 — Selected row still runs existing approval/provenance, policy, retry and durable fence
  checks. Prove duplicate selected private attempt cannot create again. Invalid selections have
  zero provider effects. Include known pre-dispatch failed legacy retry fixture if useful to ensure
  the real 5P case is supported; do not change its existing safety semantics.
- [x] A6 — Focused regression checks pass; Grok independent audit/closure and final frozen gate pass.
  Record exact operator command for later 5P. No live canary in this slice.

## Verify

Worker: focused tests, capture actual stdout/stderr and exit codes; no metadata-only passing claims.

```sh
node --import tsx --test --test-concurrency=1 src/publish/typefully.test.ts src/publish/unified-cli.test.ts src/review/publishing-status.test.ts src/review/approval-provenance.test.ts src/review/studio-scheduling.test.ts src/publish/reply-approval-gate.test.ts src/publish/delivery-policy.test.ts
npm run typecheck
```

Hermetic proof may be an owned test or scratch harness; isolate all queues, ledgers, slots, models
and provider calls. Capture outcome evidence, not only mocked argument assertions. Do not contact
providers or read credentials. Fresh worktree requires npm run worktree:setup before tests.

Coordinator, once after independent audit closure, frozen detached candidate, unsandboxed:

```sh
npm run worktree:setup
PATH=/private/tmp/slice-5q-gate-bin:$PATH npm run check
```

Verify existing serial-node shim before use. Never start final gate with unresolved audit findings.

## Observable result

The later operator can select x-1 explicitly while x-2 remains approved and untouched. This slice
proves that selection with fake providers; 5P still must observe and delete a real unscheduled draft.

## Risk

High — audit required: yes. Grok separates established defects, verification gaps and optional
hardening; audit criteria/diff/changed paths/focused output only, requesting bounded excerpts.

## Families

- Builder: OpenAI Codex Terra xhigh — bounded backend work; raised effort for the preceding
  preflight's incomplete retry-path analysis, without changing model family.
- Auditor: xAI Grok 4.5, --sandbox workspace, no edits, no subagents, no web search.

## Closeout

No standalone tool. Record PASS or actionable leftovers. Stop after this repair slice is accepted;
5P live verification is the next dependency-ready slice.

## Operator procedure for later 5P

```sh
node --import tsx src/publish/typefully.ts content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference --no-schedule --only-id x-1
```

Do not run this live until 5P repeats current eligibility checks and its audited release.
The selected row must still be approved and pass current history/policy safeguards. Other approved
rows stay approved and receive no dispatch. Retain exact returned draft ID, read it back live as
unscheduled, delete only that ID and verify absence. No slot is claimed; --list is scheduled-only.

## Review evidence

- Builder OpenAI Terra xhigh; three changed source/test paths only. Exact-ID selector narrows the
  existing unified route and rejects invalid/unapproved/wrong-kind targets before provider work.
- Actual focused checks: 77 pass / 0 fail / 10 suites, exit 0, 9.49 seconds; typecheck and diffcheck
  exit 0. Metadata is in check-results.json, with actual TAP in focused-tests.txt.
- Hermetic production-entry test: selected x-1 produces one fake private draft with returned ID,
  no publish_at/plannedFor and no slot; unselected x-2 has no dispatch; selected private repeat and
  invalid targets make no new provider call. A separate selected x-legacy invocation proves the
  existing pre-dispatch failed retry; the outcome's two callbacks are two distinct invocations.
- Independent Grok 4.5 audit, --sandbox workspace, no edits, exit 0: PASS, no established defects.
  Optional empty/substring test cases and outcome-field naming were not scope expansion.
  Exit metadata supplies the clean typecheck/diffcheck evidence that audit prose noted separately.
- Evidence: /private/tmp/slice-5u-evidence/candidate.patch, source-hashes.json, check-results.json,
  focused-tests.txt, typecheck.txt, typefully-outcome.json, grok-result.txt and final-gate artifacts.
- Adjacent 5P preflight: Grok confirmed multi-row selection blocker and known-safe legacy retry;
  its three requested source-excerpt gaps closed. Eight operational-file hashes stayed unchanged.

## RESULT BLOCK

- Changed paths: src/publish/typefully.ts, src/publish/unified-cli.ts, src/publish/typefully.test.ts.
  Coordinator owns this packet, refreshed 5P packet and master update.
- Outcome: ACCEPTED. Selector implementation, independent audit and final frozen gate pass.
- Checks run and results: focused 77/0, typecheck 0, diffcheck 0, Grok PASS/exit 0.
- Evidence locations: /private/tmp/slice-5u-evidence/ and /private/tmp/slice-5p-rerun-evidence/.
- Unresolved: none for 5U. Live 5P is a later slice.

## Accepted closeout

2026-09-08: PASS / ACCEPTED. A1–A6 met. Grok independent audit PASS (exit 0), no established defects.
Frozen detached candidate /private/tmp/content-agents-5u-frozen based on e78d2a9: setup exit 0;
unsandboxed PATH=/private/tmp/slice-5q-gate-bin:$PATH npm run check once after audit closure,
exit 0, 4326 tests / 493 suites, 4326 passed / 0 failed / 0 skipped, wall 558.23 seconds.
Three source hashes unchanged after gate and matched builder/audit snapshots.
Reviewed patch SHA256: 953502454dcc8b1bc27e570c3660098d0693cb218e5f4814beb31e06524b0472.
No live provider calls, publishing, generation or push. Coordinator commits the three source/test
files, this new packet, refreshed 5P packet and master update. Preserve existing review-queue and
notes-spread-ledger edits; they are not part of this commit. No other session's work is included.

Session-created repository artifact: docs/operations/launch-slices/SLICE-5U.md, committed here.
Disposable builder packet copy is superseded by this coordinator record. After integration, remove
byte-verified builder/frozen worktrees and redundant candidate source copies; retain bounded patch,
hashes, fake outcome, checks/audits and cleanup record under /private/tmp/slice-5u-evidence/.
Next dependency-ready: 5P current-state eligibility check, then one live unscheduled draft for x-1,
exact-ID readback/deletion/absence verification. 5P remains NOT ACCEPTED until that live proof.

Precommit hygiene exit 1 enumerated only this reviewed candidate/new packet, the two preserved
operational edits and existing local branches. Rescue snapshots: main d594210, frozen a5d0928,
builder eec141c. Preserve unrelated merged and local-only branches; remove only this session's
slice-5u-selector branch after its byte-verified worktree cleanup. No untracked owner work is touched.
