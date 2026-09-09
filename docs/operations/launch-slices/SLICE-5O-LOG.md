# SLICE-5O archive log

Moved sections from SLICE-5O.md, newest first.

## RESULT BLOCK

**ACCEPTED 2026-09-07. Outcome: PASS.**

**Changed paths**

- `src/publish/slots.ts` — the ledger migrates its pre-data-root file forward
- `src/runtime/data-root.ts` — `legacyParts` parameter; the copy is now staged and installed atomically
- `src/publish/slots.test.ts` — migration tests, fixtures moved out of the real tree, digest assertion
- `src/util/cost-log.ts` — `costLogPath()`; production destination unchanged
- `src/util/cost-log.test.ts` — new
- `src/review/configured-media-runtime.test.ts` — shares one cost log with its render child
- `src/outreach/draft.test.ts` — the suite that was appending `"Acme Co"` rows to the real ledger

**What shipped**

*Lane A.* `ledgerPath()` now returns `migrateLegacyDataFile(["scheduler","publish-schedule.jsonl"],
dirname(legacy), [basename(legacy)])`, carrying `data/publish-schedule.jsonl` forward to the
canonical location on first read. The helper gained an optional `legacyParts` (defaulting to
`parts`) because the legacy file has no `scheduler/` segment and the old signature could not express
that mapping. The canonical path is unchanged and the migration never runs at import.

*Lane B.* `logCost` resolves per call through a new `costLogPath()`: an explicit
`CONTENT_AGENTS_TEST_COST_LOG` wins, else a test process gets `join(dataRoot(), "cost-log.csv")`,
else production — byte-identically `join(repoRoot, "data", "cost-log.csv")` as before. Production
was deliberately **not** moved under the data root the way eleven other stores moved: the root
`CLAUDE.md` names that path, so relocating it is Muxin's decision, not an engineering one.

**Checks**

- Gate: `npm run check` → **4293 pass, 491 suites, 0 fail**, exit 0 (from 4278/489).
- `data/publish-schedule.jsonl` `3a1d30a6f0f8093c251b46b75947e8d4a8fbc817e57ea596a3ef8702be25ca58`,
  54 lines, and `data/cost-log.csv` `dc3c71d27714fd8a9901b70c013c5a44acbf4efa26e20515a9d825e7a53a86ce`,
  439 lines — **identical before the slice and after a full gate run**, measured by the coordinator
  against a baseline taken before any worker started. That is the slice's actual acceptance.
- Hygiene: exit 1 on five August-era local-only branches needing a decision. Pre-existing, unrelated.

**Audit history** — two Codex passes, two repair cycles.

Pass 1 returned DO NOT ACCEPT on one established defect. **R1: the migration published an
incomplete destination.** `migrateLegacyDataFile` copied straight into the canonical path with
`copyFileSync`, and its own fast-path guard skips the migration lock the moment that file exists.
Two failures followed: a second process could read a half-copied ledger, claim an occupied slot and
have its own write overwritten (reproduced with an injected pause, returning legacy slot
`2026-07-07T16:00:00.000Z`); and — needing no concurrency at all — a process killed mid-copy left a
truncated canonical file that suppressed the migration permanently, losing the rest of the claims
silently. Repaired by staging into `${canonical}.${pid}.migrating` and installing with a
same-directory `renameSync` under the lock, with a `finally` that removes the staging file. The
weakness predates this change and all eleven other callers had it; exposing the publish ledger to it
was introduced here, so fixing the shared helper fixed them too.

**R2, found by the same pass: this slice *removed* coverage.** Before it, the hardcoded cost-log
path meant a render subprocess wrote the file the parent read, so the "a free render appends
nothing" assertion could see child-side writes. A per-process temp root broke that. Repaired by
sharing one explicit log path, which the child inherits — verified not by reading the spawn but by
having the shell renderer write back its own inherited value, then mutation-testing that assertion.

Pass 2 closed R1 and R2 and found **R3: the concurrency test could hang the gate.** If child B
failed to start, child A blocked forever on a `GO` signal only written after B had reported in, with
no cleanup. A startup failure would stall `npm run check` rather than fail it. Repaired with
retained child handles, a `finally` that releases and reaps unconditionally, and a shortened cap;
proved by injecting `process.exit(3)` into B and observing a red test in 32s with zero stray
children.

**One finding declined.** `CONTENT_AGENTS_TEST_LEGACY_LEDGER` is not gated on `NODE_TEST_CONTEXT`
and can therefore affect production — factually correct. Declined because it matches the house
pattern for six existing overrides, and because the production-shape child test *depends* on it
being ungated: that child runs deliberately without `NODE_TEST_CONTEXT`, and a guard would point it
at Muxin's real ledger instead of a fixture. Do not re-raise without also solving that.

**Two builder overclaims corrected rather than coded around.** The mutation proof was reported as
two detectors; only the interrupted-copy test fails deterministically against the old code, since
the concurrent one passes if B is delayed past A's rename. And "cannot go flaky-red" was too
absolute — the migration lock's own 10s timeout can expire on a loaded machine. Both restated in
the code's own comments.

**Item (f) was mostly a false alarm, and that is the finding.** The prior audit's list of fourteen
suspect sites was measured before this packet was written: every one is benign (uniquely-named
fixtures, self-scoped cleanup) and one cited line is not a write at all. The reason is that
`dataRoot()` already hands every test process a throwaway `mkdtemp` root under `NODE_TEST_CONTEXT`.
Only two files were ever at risk, and the more valuable one was not test hygiene but a production
bug the item did not mention.

**Scale correction worth keeping.** The master doc recorded the stray cost rows as "untracked and
harmless." They were 404 of 439 rows — 92% of Muxin's spend ledger was `outreach:draft,"Acme Co"`
fixtures accumulating since 2026-07-15. Real spend is 34 rows totalling $0.708. The rows were left
in place: deleting entries from a cost log to tidy test noise is her call, not a worker's.

**Unresolved**

1. **`migrateLegacyDataDirectory` has R1's defect through `cpSync`** (sole caller `jobs.ts:70`,
   `JOB_LOG_DIR`). Same shape, not fixed here — a directory copy needs a different atomic install
   than a file rename, and it was outside the packet. Fix it before anything durable moves onto it.
2. **`queue-view.ts:14,16,346` still names `data/publish-schedule.jsonl`.** Line 346 is user-visible
   runtime output, not a comment, so it prints a path that is no longer where the ledger lives.
   Outside Lane A's owned files; `slots.ts`'s header carries the pointer note instead.
3. **The `runAgentSpawn` → `runCommandSpawn` linkage is still uncovered.** Lane B built the
   mechanism that would let a test observe it — a cost row lands at `jobs.ts:1838` after
   `runCommandSpawn` resolves — but the test belongs in `jobs.test.ts`, outside this slice.
4. **The free-render assertion's child-side force is structural, not exercised.** That test
   substitutes a `/bin/sh` renderer which never invokes Node, so nothing logs from either side. It
   would catch a real render child's row; it does not today.

**Process lessons**

- **Measure before scoping, and the measurement can shrink the slice to nothing.** Item (f) was
  recorded from an audit list marked "unverified by me." Twelve of its fourteen sites were fine, the
  one flagged worst was pointing at a file production no longer reads, and the real defect was
  somewhere the item never looked. A list inherited from an audit is evidence that someone was
  worried, not evidence of a defect.
- **A stale comment is how a defect survives.** `slots.test.ts:5` asserted "the ledger path is
  hardcoded" while the override it denied existed two lines away in production and the same file's
  second block already used it. Nobody re-read the claim because it was written down.
- **Ask whether the change removed coverage, not only whether it added a defect.** R2 was invisible
  to both builders and to the acceptance criteria until an auditor compared before against after.
