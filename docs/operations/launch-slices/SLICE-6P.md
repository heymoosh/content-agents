# SLICE-6P: the e2e isolation check stops failing candidates for another session's SQLite sidecars

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`npm run test:e2e`'s shared-worktree isolation check partitions the changed-path list into paths
that are attributable to the candidate and a closed, named set of externally volatile paths —
SQLite sidecars (`<name>.db-shm`, `<name>.db-wal`, `<name>.db-journal`). Only the first set fails
the run. The second set is printed by name with an explicit "did not fail the run" statement.
`<name>.db` itself stays in the failing set, so a real write into the caller's database is still
caught. `snapshotWorktree` keeps recording sidecars; the split happens after snapshotting, so
nothing disappears from the snapshot.

Observed instance: `SLICE-6L.md` → `## Stopped` records the guard tripping on
`data/analytics.db-shm`/`-wal` written by a concurrent session, which sent that slice to the
not-accepted branch for a reason that was not the candidate's.

## Difficulty

easy — one exported pure function, one call site in the runner, three added tests.

## Depends on

none.

Delivery batch: 6P alone. Deliverable is implementation, not design. Independent of 6M (owns
`e2e/pass-a-reads.ts`, `e2e/pass-b-writes.ts`) and of 6O (owns `src/operations/freeze-candidate*`) —
no owned path is shared with either. Stop condition: every Acceptance item below is true, or the
slice takes the stopping-without-acceptance branch. A free slot does not authorize another slice.
Owner checkpoint: none. No product decision is open; the volatile set is fixed by this packet to
SQLite sidecars only and must not be widened by the worker.

## Owned files

Parallel-safe: no. The change is one predicate, one call site and its tests, all proved by one
`node --import tsx --test e2e/isolation.test.ts` run of a few seconds. A second lane would re-run
the same file to verify the same artifact and return no independent deliverable, so it would add
coordination cost and nothing else.

### Lane A — the partitioned isolation check

- `e2e/harness.ts` — add the exported partition function beside `changedWorktreePaths`
- `e2e/run-all.ts` — the isolation block in the `finally` clause only (currently the
  `E2E isolation failure` / `byte-identical` branch)
- `e2e/isolation.test.ts` — the added tests

Pinned read-only inputs: none outside the three files above. Temporary and check outputs: the
existing tests' `mkdtempSync` roots under `os.tmpdir()`, removed by the tests; nothing is written
inside the repository working tree.

## Do not touch

- `e2e/pass-a-reads.ts`, `e2e/pass-b-writes.ts` — SLICE-6M's lane
- `e2e/pass-c-*.ts`, `e2e/pass-d-*.ts`, `e2e/seed-phase3.ts`
- `src/operations/freeze-candidate.ts`, `src/operations/freeze-candidate.test.ts` — SLICE-6O's lane
- `snapshotWorktree` and `changedWorktreePaths` themselves — their behaviour is unchanged; the
  split is a new function applied to `changedWorktreePaths`' output
- `package.json`, `.gitignore`, `docs/**`, everything under `src/`

## Cited headings

none

## Acceptance

- [ ] `e2e/harness.ts` exports `partitionIsolationChanges(changed: string[])` returning
      `{ failing: string[]; volatile: string[] }`, a pure function with no fs or process access.
- [ ] It routes a path to `volatile` exactly when its basename ends `.db-shm`, `.db-wal` or
      `.db-journal`, and to `failing` otherwise. `data/analytics.db` lands in `failing`.
- [ ] Both returned arrays preserve the input's sort order and together contain every input path
      exactly once (no path is dropped).
- [ ] `e2e/run-all.ts`'s isolation block calls it on `changedWorktreePaths(...)`' result and sets
      the run to failed only when `failing.length > 0`; the existing
      `E2E isolation failure: shared worktree changed (...)` message lists only `failing` paths.
- [ ] When `volatile.length > 0`, `run-all.ts` prints one line naming each volatile path and
      stating it did not fail the run. When both arrays are empty the existing
      `E2E isolation: shared worktree byte-identical after disposable passes.` line is unchanged.
- [ ] `e2e/isolation.test.ts` proves all three cases: a changed `data/analytics.db-wal` alone
      yields empty `failing`; a changed `data/analytics.db` yields non-empty `failing`; a changed
      `data/analytics.db-wal` plus a changed `new-untracked-file` yields `failing` containing
      only `new-untracked-file`.
- [ ] A test proves `snapshotWorktree`/`changedWorktreePaths` still report a changed
      `data/analytics.db-wal` — the sidecar is split out downstream, not excluded upstream.
- [ ] `node --import tsx --test e2e/isolation.test.ts` exits 0 with 0 failures and a pass count
      strictly greater than 6 (the count before this slice).
- [ ] `npm run check`, run unsandboxed, exits 0; or every failure it reports is reproduced
      identically with this slice's three owned files stashed out, and each is named in the
      RESULT BLOCK as pre-existing.
- [ ] `git diff --check` reports nothing.
- [ ] No path outside the Owned files list is created, modified or deleted.

## Verify

Classification and applicable gate: meaningful behavior / high risk. This deliberately narrows a
safety guard whose whole purpose is to catch writes escaping into the caller's checkout, so the
failure mode of a bad change is silent — a real isolation violation stops failing. Required
checks: the focused test run, the repository-wide gate, and a cross-family audit before
integration.

Not a UI change; no journey, viewport or flag applies. `npm run test:e2e` is deliberately **not**
an acceptance gate here: it takes minutes, needs a checkout no other session is writing to, and
two of its journeys are known-red until SLICE-6M lands, so its exit code cannot discriminate this
change. The partition is proved by unit tests instead. If the worker does run it opportunistically,
record the isolation line's exact text as evidence only, never as a pass or fail for this slice.

```
node --import tsx --test e2e/isolation.test.ts
npm run typecheck
npm run check
git diff --check
```

## Observable result

The isolation check's own output now separates the two cases in plain words: another session's
`data/analytics.db-wal` is named and explicitly does not fail the run, while a real stray write
still prints `E2E isolation failure` and fails. The test file shows both branches side by side.

## Risk

medium — audit required: yes. The change can only be wrong by being too permissive, and a
too-permissive guard is invisible in a green run. Evidence-based reason: SLICE-6K's audit found a
HIGH defect of exactly this shape (an exception path suppressing a refusal it was not meant to
suppress), so the same class is known live in this repository.
Review boundary: this candidate, before integration.
Review scope/budget: one bounded ordinary-effort review answering one question — can any path a
candidate could write land in `volatile`? Inputs: this packet's Acceptance list, the candidate
diff, the changed-file list, and the focused test output. Nothing else.
Prior accepted evidence: none to reuse; this is the first slice on these paths.
On reviewer outage: the candidate is review-blocked and is not integrated. Retry when a
non-Claude CLI is usable. Independent authorized work: none in this batch, so the session takes
the stopping-without-acceptance branch rather than integrating.

## Families

- Builder: mid-tier model, medium effort (Claude) — one lane.
- Auditor: Codex (GPT family), ordinary effort — different family from the builder, per the
  bindings' `codex exec --sandbox read-only` route. If Codex is unavailable, Grok per the
  `### Grok CLI on this Mac` launch fix; never a second Claude.

## Closeout

**PASS** — 2026-09-10. Accepted and committed as `7ec5368` on `main` (fast-forward from `9b02cdb`).
One audit-driven repair (Codex, HIGH: basename-suffix match too permissive, narrowed to an
exact-path allowlist) landed before integration. Full record, hygiene disposition, read-set
measurement and RESULT BLOCK: `SLICE-6P-LOG.md` → `## Accepted — 2026-09-10`.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: serial — one predicate, one call site and one test file; delegation adds only
  overhead and no independent deliverable.
- Assignment: one mid-tier worker at medium effort, fresh packet-sized context. Reuse it for
  audit repairs, since its retained context saves re-investigation. Frozen handoff before audit.
- Evidence return: command, exit code, pass/fail/skip counts, candidate sha, one short result
  line, and pointers to the test output on disk.
- Capability boundary: this slice is one coherent capability — closeout runs once, at its end.
  Use completion notifications, not polling.
