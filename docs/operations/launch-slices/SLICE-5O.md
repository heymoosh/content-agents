# SLICE-5O: the slot ledger's real claims survive the data-root move, and the suite stops writing two real ledgers

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Two durable files this repository treats as operational memory are being lost or polluted. When
this slice is done, both are safe and the safety is demonstrated by an outcome, not by a call.

**1. The slot ledger's history is orphaned.** Production resolves the ledger through
`dataPath("scheduler", "publish-schedule.jsonl")` (`src/publish/slots.ts:160`), which lands under
`dataRoot()` — `~/.content-agents/<basename>-<fingerprint>/` when `CONTENT_AGENTS_DATA_ROOT` is
unset (`src/runtime/data-root.ts:22-29`). Eleven other production stores call
`migrateLegacyDataFile` to carry their pre-move in-checkout file forward. The ledger does not.

Verified on this machine, not inferred: `~/.content-agents/content-agents-154a8dd69ae2/scheduler/`
**does not exist**, while `data/publish-schedule.jsonl` holds 8689 bytes of real historical claims
(July dates, real content slugs, `by: "typefully"` and `by: "cards"`). Verified by grep that
`slots.ts:160` is the **only** path resolution for this file in `src/` — every other mention is a
comment, and all of those comments now name a stale location. So on the first real publish run
after this move, the scheduler starts from an empty ledger and every prior claim is invisible to
it. The ledger's stated purpose in its own header (`slots.ts:12`) — "claims survive across
/publish runs AND across streams" — is defeated for everything written before the move. It is
latent only because nothing has published since the July freeze, and it bites on the first run
after publishing resumes.

**2. Two test suites write real operational files.**

`src/publish/slots.test.ts` defines `LEDGER` as `join(repoRoot, "data", "publish-schedule.jsonl")`
(`:30`) — the legacy file holding the only copy of those real claims — seeds it (`:47`), and
`beforeEach` (`:63`) truncates it to empty before every test in the first `describe`. `before`/
`after` (`:51-61`) snapshot and restore the bytes, so a clean run preserves them; a crash or an
interrupt mid-block leaves the only copy empty or holding fixture claims. The suite does this on
the strength of its own header comment (`:5`), *"the ledger path is hardcoded"*, which is false:
`CONTENT_AGENTS_TEST_LEDGER` already exists (`slots.ts:160`) and the **second** block in the same
file (`:186`) already points it at an isolated fixture. The first block assigns the override to the
real path (`:52`), making it a no-op.

`src/util/cost-log.ts` hardcodes `COST_LOG = join(repoRoot, "data", "cost-log.csv")` with no
override of any kind. `src/outreach/draft.ts:370` calls `logCost` unconditionally, so the suite
appends fixture rows to Muxin's real spend ledger. Verified by reading the file after yesterday's
gate run — three `outreach:draft,"Acme Co",0.0000,claude` rows at `2026-09-07T01:53:31`. The rows
are `$0` and appended, never truncating, so nothing is destroyed; the defect is that synthetic
rows are permanently mixed into a real financial record with no marker distinguishing them and no
way to clean them up.

## Difficulty

hard — not in lines changed, but because Lane A changes how a production file path resolves. The
failure mode of getting it wrong is silent: a wrong path reads an empty ledger and looks fine.

## Depends on

none

## Owned files

Parallel-safe: **yes** — all three conditions hold. The lanes share no path and neither creates,
moves or deletes anything inside the other's directories (Lane A is confined to `src/publish/`,
Lane B to `src/util/`, `src/outreach/` and one file in `src/review/`). Neither lane runs a
repo-wide rewriting command; there is no formatter, codegen or `--fix` step in either lane's
verification. Each lane's focused verification names only its own test files.

### Lane A — the slot ledger's real claims survive, and the suite stops writing the legacy file

- `src/publish/slots.ts`
- `src/publish/slots.test.ts`

### Lane B — the cost log is isolated under test, with production's destination unchanged

- `src/util/cost-log.ts`
- `src/util/cost-log.test.ts` (create if absent)
- `src/review/configured-media-runtime.test.ts` — reads the real cost log at `:187` to assert a
  free render appends nothing (`:229`). If Lane B changes where a test-context cost log resolves,
  this assertion must be updated to read the same place, or it silently stops proving anything.
- any test file under `src/outreach/` whose run reaches `src/outreach/draft.ts:370`. Find it; do
  not assume which one.

## Do not touch

- `data/publish-schedule.jsonl` and `data/cost-log.csv` — **read them, never edit, truncate,
  delete or "tidy" them.** They are real operational records. The whole point of this slice is
  that they stop being written by anything except a real run. If your verification needs a
  before/after comparison, hash them; do not rewrite them.
- `src/outreach/draft.ts` and every other **production** `logCost` caller. Lane B changes where
  the log resolves, not who writes it.
- `docs/content-studio-master-status.md`, `docs/content-agents-backlog.md`, `.claude/skills/**`
  (the last is write-protected by the owner's settings — do not attempt it, and do not route
  around a refusal).
- `src/runtime/data-root.ts` — **unless** Lane A establishes that the existing
  `migrateLegacyDataFile` signature cannot express this migration (see the trap below). If you
  must change it, every one of its eleven existing callers keeps its current behaviour, and you
  say so in the RESULT BLOCK naming how you checked.

## Cited headings

none

## Traps, all verified in source before this packet was written

**The legacy and canonical paths have different shapes.** `migrateLegacyDataFile(parts,
legacyDataRoot)` computes legacy as `join(legacyDataRoot, ...parts)` — the same `parts` as the
canonical path. Here the canonical path is `<root>/scheduler/publish-schedule.jsonl` but the
legacy file is `data/publish-schedule.jsonl`, with no `scheduler/` segment. The existing signature
cannot express that mapping. Deciding how to bridge it is yours; two routes are obviously
available and both are acceptable if verified. What is **not** acceptable is quietly changing the
canonical location to make the parts line up without saying you did, or a migration that silently
no-ops because it looked for `data/scheduler/publish-schedule.jsonl`.

**`scheduler/` has exactly one referent.** Verified: `'"scheduler"'` appears in `src/` only at
`slots.ts:160` (the two hits in `src/grow/delivery-binding.ts` are an unrelated string label).
Nothing else depends on that directory name.

**A migration that runs at import time is a different hazard from one that runs on first read.**
Several existing callers do this at module scope (`captures.ts:20`, `room-queue.ts:134`). Whatever
you choose, `migrateLegacyDataFile` must not overwrite a canonical file that already exists — it
guards this at `data-root.ts:48`, and your test must prove the guard holds rather than assume it.

**`dataRoot()` already isolates tests.** Under `NODE_TEST_CONTEXT` an unconfigured data root is a
per-process `mkdtemp` (`data-root.ts:15-19`). That is why most of this repository's suites are
already safe, and it is the mechanism Lane B should prefer over inventing a new one. It is also
why Lane A's *production* fix is not itself a test hazard.

**Lane B must not move production's cost log.** The root `CLAUDE.md` names `data/cost-log.csv` by
path as the place every paid call is logged. Moving it under the data root the way the eleven
other stores moved is a change the owner would see and has not decided, so this slice does not
make it. Keep the destination byte-identical when neither a test override nor `NODE_TEST_CONTEXT`
applies, and prove that.

**Do not widen this slice.** A prior audit produced a list of fourteen other test sites suspected
of writing real trees. Every one has since been measured and found benign — uniquely-named
fixtures with self-scoped cleanup. They are not in scope and must not be "tidied."

## Acceptance

Assert the observable outcome. A test that proves `migrateLegacyDataFile` was *called* proves
nothing about which file was read.

- [ ] **A1.** With a temp data root containing no canonical ledger, and a legacy
      `data/publish-schedule.jsonl` containing known claims, reading the ledger returns those
      claims. The assertion is on the claims read back, not on a path string and not on a spy.
- [ ] **A2.** The legacy file still exists and is byte-identical after that migration.
- [ ] **A3.** When a canonical ledger already exists, a legacy file with different contents does
      **not** overwrite it, and the canonical contents are what a read returns.
- [ ] **A4.** With neither `CONTENT_AGENTS_TEST_LEDGER` nor `CONTENT_AGENTS_DATA_ROOT` set and
      outside a test context, the resolved production path is unchanged from today's
      `<dataRoot>/scheduler/publish-schedule.jsonl` — or, if you changed it, you state the new
      path, why, and that the migration reaches it.
- [ ] **A5.** `src/publish/slots.test.ts` neither reads nor writes
      `join(repoRoot, "data", "publish-schedule.jsonl")`. Prove it from the test source **and**
      with a digest assertion in the suite itself that the real file is byte-identical across the
      run, in the manner `src/review/studio-scheduling.test.ts` already uses for `briefs/`. A
      clean `git status` proves the file was restored, not that it was never written.
- [ ] **A6.** The false header comment at `slots.test.ts:5` is corrected, and the stale
      `data/publish-schedule.jsonl` location named in `slots.ts:12` and the comments in
      `queue-view.ts:14,16,346` is either corrected or left with a one-line note saying where the
      file actually lives now. Do not edit `queue-view.ts` logic; comments only, and only if you
      can do it without touching Lane B's files.
- [ ] **B1.** After a full run of the repository gate, `data/cost-log.csv` has gained **zero**
      rows. Prove with a line count and a digest taken before and after, quoted in the RESULT
      BLOCK, and specifically confirm no `"Acme Co"` row was added.
- [ ] **B2.** Outside a test context and with no override set, `logCost` writes to exactly the
      same absolute path it writes to today.
- [ ] **B3.** A test can point the cost log somewhere it can read, and assert that a `logCost`
      call landed a row there. This is the observability 5N could not get; state plainly whether
      it now covers the `runAgentSpawn` → `runCommandSpawn` linkage or only the `logCost` write.
- [ ] **B4.** `configured-media-runtime.test.ts`'s "a free render appends nothing" assertion
      (`:187`, `:229`) still proves that, against whatever path the cost log now resolves to under
      test. If it no longer can, say so rather than deleting it.

## Verify

Run unsandboxed. `npm test -- <files>` does **not** narrow the run; call the runner directly.

```
node --import tsx --test src/publish/slots.test.ts
node --import tsx --test src/util/cost-log.test.ts src/review/configured-media-runtime.test.ts
shasum -a 256 data/publish-schedule.jsonl data/cost-log.csv
wc -l data/publish-schedule.jsonl data/cost-log.csv
```

Take the last two **before and after** your work and quote both readings. Then the repository-wide
gate, once, last:

```
npm run check
```

## Observable result

Muxin can see two things. First, `data/publish-schedule.jsonl` and `data/cost-log.csv` have the
same sha256 after a full gate run as before it. Second, a publish run started with no canonical
ledger present picks up her July claims instead of starting empty — which is what stops the
scheduler placing a second post into a slot it already used.

## Risk

medium — audit required: **yes**. Lane A changes production path resolution for a file whose
wrongness is silent. The auditor must be told that an empty read looks identical to a correct one.

## Families

- Builder: Claude, strong tier — one worker per lane, both lanes concurrently
- Auditor: Codex / GPT, strong tier — different family from the builder

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in the
`RESULT BLOCK` below before this slice can close.

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
