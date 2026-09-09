# SLICE-5Y: Publish migrated job-log directories only after the copy completes

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this packet only.
Do not load the repository for context. Workers never commit.

## Goal

Close accepted 5O's recorded directory-migration defect: a future migration exposes either no
canonical directory or a complete copied tree, never an in-progress copy. Failed/interrupted
copies cannot suppress a later successful migration. Preserve the legacy tree and existing
canonical precedence. No attempt to guess whether an older canonical tree is partial.

## Difficulty

Hard — interruption safety and concurrent readers of durable job logs.

## Depends on

5O and 5X accepted; base 9237aecdcf9f56da749023c2efbd7777e62b6393.
Read-only preparation confirmed direct cpSync into canonical at data-root.ts:92–99, whose only
caller is jobs.ts:70 for GUI job logs. A seeded partial canonical suppresses later migration.
Card-publishing/reuse gaps mentioned historically by 5H are already closed by 5J/5K; do not rebuild.

## Owned files

Preparation finished before these assignments. Coordinator owns packet/master, the next-step
`SLICE-5Z.md` verification packet and integration.
Independent implementation and verifier preparation run concurrently, actual candidate checks wait
for frozen builder handoff. All shared source inputs are pinned to base 9237aec until that handoff.

### Lane C — implementation

- Own `src/runtime/data-root.ts`, `src/runtime/data-root.test.ts` in coordinator-created
  `/private/tmp/content-agents-5y-build`; retained logs `/private/tmp/slice-5y-evidence/builder/`.
  Each test invocation owns its unique `mkdtemp` directory `content-agents-directory-migration-*`
  under the OS temporary directory and removes it in finally; no shared fixture paths.
- Deliver complete staged directory migration plus focused regression tests. Use a uniquely named
  sibling staging directory and same-filesystem rename under the existing migration lock; clean
  this invocation's staging on ordinary copy/rename failure. Abrupt death may leave a private
  orphan; it must not become canonical or block retry. Do not sweep unknown directories.
- Keep existing canonical precedence and missing-source/same-path behavior. Preserve all legacy
  bytes and nested paths. Existing canonical directories are not repaired or overwritten.
- Relevant immutable inputs: data-root.ts/test, `src/runtime/file-lock.ts`,
  `src/publish/slots.test.ts` (existing atomic-file-migration regression patterns),
  `src/review/jobs.ts` only the migrateLegacyDataDirectory call and enclosing job-log initialization.
- Bounded symbol search for every use of migrateLegacyDataDirectory in src is allowed.
- Add only a narrow copy/rename dependency seam if useful, matching migrateLegacyDataFile.
- Focused checks below; return source hashes, diff, actual red/green evidence and RESULT BLOCK.

### Lane D — independent verification preparation and execution

- Own only `/private/tmp/slice-5y-evidence/verifier/`; no source edits.
- Prepare a deterministic isolated harness against this fixed contract while C builds. Read the
  named immutable inputs above as needed, but never C's changing source/output.
- Verify complete nested bytes; canonical absent while copy is paused/failed; one complete final
  tree; legacy unchanged; existing canonical unchanged; failed rename cleanup; retry succeeds.
- Include a child-process interruption/concurrency check with bounded signals and unconditional
  child cleanup. Use an isolated data root/legacy root, no real job logs or models. A seeded
  partial fixture alone does not prove the new migration avoids publishing partial state.
- Actual candidate execution waits for coordinator's frozen source hashes and checkout handoff.
- Retain scripts, stdout/stderr and exit codes. Preparation is not candidate PASS.

Verifier preparation v1 is frozen and NOT accepted. Coordinator found omitted verification:
child ROOT was not wired to CONTENT_AGENTS_DATA_ROOT; main interruption retry retained the prior
case's root; utimes alone does not expire JSON createdAt; interrupted-child cleanup lacked an
unconditional kill/reap; unbounded done awaits could hang; legacy comparisons lacked a before
snapshot. V1 owner finished. Reassign D to Terra xhigh (high→xhigh, one variable) to repair the
same harness paths. Prove each child uses its fixture root, age JSON metadata only after death,
bound all waits with cleanup, compare complete trees to original snapshots and assert both
callers' returned paths. Retain v1 source as evidence outside the repository.

Parallel-safe: C and D have disjoint writes and temp directories; no repo-wide rewriting commands;
checks read only pinned shared inputs and write lane-owned fixtures. Coordinator alone runs final
setup/gate and integrates. Prior investigator owns no active edits after its completed handoff.

## Do not touch

- Any other production/test source; migrateLegacyDataFile behavior; publishing/scheduling,
  analytics DB, job logs, credentials, backlog, content or other builds. No live canary.
- Preserve existing AGENTS.md, SLICE-TEMPLATE.md, the 2026-09-07 Human Inference review queue and
  notes-spread-ledger.jsonl edits. Workers do not stage or commit anything.
- No automatic repair/removal of pre-existing canonical or orphan trees. Do not rerun 5P.

## Cited headings

- `docs/operations/launch-slices/SLICE-5O.md` → `## RESULT BLOCK`, Unresolved item 1 only.
- Implementation inputs explicitly named under lanes above.
- Coordinator reconciliation evidence only: retained sequence reports under
  `/private/tmp/slice-5y-evidence/sequence/`; no worker needs the master archive.

## Acceptance

- [x] A1: nested legacy tree appears complete at canonical only after copy finishes; legacy unchanged.
- [x] A2: copy failure and rename failure leave no partial canonical and clean this attempt's staging;
      an ordinary retry succeeds with all bytes intact.
- [x] A3: abrupt interruption leaves canonical absent; a later invocation completes. Concurrent
      callers/readers cannot observe the migrating helper's partial canonical or overwrite a
      complete winner. Tests must release/terminate all children even on assertion failure.
      Preserve withFileLock's existing five-minute stale/dead-owner policy: restart retry means
      after that expiry. Tests may age only fixture lock metadata after confirming child death;
      report that simulation explicitly. No immediate stale-lock recovery claim.
- [x] A4: existing canonical wins unchanged; no legacy source and identical source/destination keep
      their current behavior. Pre-existing partial canonical is intentionally not guessed/repaired.
- [x] A5: focused checks, relevant file-migration regression and independent actual harness PASS;
      Grok material findings independently closed; frozen unsandboxed full gate PASS.
- [x] A6: coordinator reviews final diff, records hygiene, updates master and commits only this slice.

## Verify

```
node --import tsx --test src/runtime/data-root.test.ts src/publish/slots.test.ts
```

Independent harness command comes from D's frozen handoff. Coordinator runs worktree:setup once
per fresh checkout, then unsandboxed npm run check once last on a detached audit-cleared candidate.
The retained `/private/tmp/slice-5q-gate-bin/node` serial test shim may be used. No provider or
generation canary; the authorized Grok review is the only external model audit.

## Observable result

A crash during initial job-log migration no longer makes a partial log directory authoritative.
A restart retries the copy and exposes all retained logs; existing canonical logs remain intact.

## Risk

High — audit required: yes, Grok before integration. Staging and canonical share a filesystem;
existing file lock coordinates migrating callers. Do not broaden the lock or recovery contract.

## Families

- Builder C: Codex Terra xhigh; bounded backend durability repair.
- Verifier D: Codex Terra high→xhigh for omitted verification; independent contract harness.
- Auditor: Grok 4.5 workspace sandbox, no edits, bounded criteria/diff/checks, path:line findings.

## Closeout

```
bash scripts/repo-hygiene.sh --rescue
```

PASS — focused checks, independent actual verification, Grok audit and full gate passed.
Coordinator closeout and retained leftovers are recorded below.

## RESULT BLOCK

- Changed paths: two source/test paths, this packet, SLICE-5Z.md and master START HERE/progress.
- Outcome: PASS. Future directory migrations publish a complete staged tree atomically.
- Checks: focused 51/51; typecheck PASS; independent actual harness PASS; old base expected FAIL;
  Grok PASS; frozen unsandboxed full gate 4342/4342, zero failures, exit 0, 431.56 seconds.
- Evidence: `/private/tmp/slice-5y-evidence/`, with gate/audit exits under coordinator/.
- Unresolved: no blocking finding. Existing canonical precedence and five-minute stale-lock policy
  are retained; historical partial directories are not guessed or automatically repaired.

## Preparation evidence

Read protocol → START HERE → 5X packet, then template. The current handoff named no next slice.
A bounded heading/sequence reconciliation found historical next entries superseded by later
accepted packets. 5O's directory-copy finding remains in current source; isolated reproduction
and exact citations are `/private/tmp/slice-5y-evidence/directory/directory-summary.txt`.
This packet was refined at completed ownership checkpoints from inventory to that concrete repair.
