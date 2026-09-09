# SLICE-5O: the slot ledger's real claims survive the data-root move, and the suite stops writing two real ledgers

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

SLICE-6E note (historical): this packet's completed `## RESULT BLOCK` moved to
`SLICE-5O-LOG.md`, leaving it 12,549 B, 261 B over the 12,288 cap. No further content was
eligible to move under SLICE-6E's rule (only dated records, RESULT BLOCKs and superseded Stopped
sections move); `## Traps` below is live builder guidance, not a dated record, so it stayed uncut.
SLICE-6G's compression pass removed the overage without cutting a rule.

## Goal

Two durable files this repo treats as operational memory are lost or polluted. When this slice is
done both are safe, proved by an outcome not a call.

**1. The slot ledger's history is orphaned.** Production resolves it through
`dataPath("scheduler", "publish-schedule.jsonl")` (`src/publish/slots.ts:160`), under `dataRoot()`
— `~/.content-agents/<basename>-<fingerprint>/` when `CONTENT_AGENTS_DATA_ROOT` is unset
(`src/runtime/data-root.ts:22-29`). Eleven other production stores call `migrateLegacyDataFile` to carry
their pre-move file forward; the ledger does not.

Verified on this machine, not inferred: `~/.content-agents/content-agents-154a8dd69ae2/scheduler/`
**does not exist**, while `data/publish-schedule.jsonl` holds 8689 bytes of real history (July dates,
real slugs, `by: "typefully"` and `by: "cards"`). Grep confirms `slots.ts:160` is the **only** path
resolution for this file in `src/`; every other mention is a comment naming a stale location. So the first real publish run after this move starts from an empty ledger, and
every prior claim is invisible to it. The ledger's own header (`slots.ts:12`) promises claims
"survive across /publish runs AND across streams" — defeated for everything written before the
move. Latent only because nothing has published since the July freeze; it bites on the first run after.

**2. Two test suites write real operational files.**

`src/publish/slots.test.ts` defines `LEDGER` as `join(repoRoot, "data", "publish-schedule.jsonl")`
(`:30`) — the legacy file holding the only copy of those claims — seeds it (`:47`), and
`beforeEach` (`:63`) truncates it to empty before every test in the first `describe`.
`before`/`after` (`:51-61`) snapshot and restore the bytes, so a clean run preserves them; a crash
or interrupt mid-block leaves the only copy empty or fixture-filled. The suite relies on its own header comment (`:5`),
*"the ledger path is hardcoded"*, which is false: `CONTENT_AGENTS_TEST_LEDGER` already exists
(`slots.ts:160`), and the **second** block in the same file (`:186`) already points it at an
isolated fixture; the first block assigns the override to the real path instead (`:52`), a no-op.

`src/util/cost-log.ts` hardcodes `COST_LOG = join(repoRoot, "data", "cost-log.csv")` with no
override. `src/outreach/draft.ts:370` calls `logCost` unconditionally, so the suite appends fixture rows
to Muxin's real spend ledger — confirmed after yesterday's gate run: three
`outreach:draft,"Acme Co",0.0000,claude` rows at `2026-09-07T01:53:31`. They are `$0` and appended,
never truncating, so nothing is destroyed; the defect is synthetic rows permanently mixed into a real
financial record, unmarked, uncleanable.

## Difficulty

hard — not in lines changed, but Lane A changes how a production file path resolves.
Getting it wrong fails silently: a wrong path reads an empty ledger and looks fine.

## Depends on

none

## Owned files

Parallel-safe: **yes** — all three conditions hold. The lanes share no path and neither creates,
moves or deletes anything inside the other's directories (Lane A confined to `src/publish/`,
Lane B to `src/util/`, `src/outreach/` and one file in `src/review/`). Neither runs a repo-wide
rewriting command: no formatter, codegen or `--fix` step in either lane's verification, and each
lane's focused verification names only its own test files.

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
  `migrateLegacyDataFile` signature cannot express this migration (see the trap below). If changed,
  every one of its eleven existing callers keeps its current behaviour, and you say so in the
  RESULT BLOCK naming how you checked.

## Cited headings

none

## Traps, all verified in source before this packet was written

**The legacy and canonical paths have different shapes.** `migrateLegacyDataFile(parts,
legacyDataRoot)` computes legacy as `join(legacyDataRoot, ...parts)` — the same `parts` as the
canonical path. The canonical path here is `<root>/scheduler/publish-schedule.jsonl`, but the
legacy file is `data/publish-schedule.jsonl` with no `scheduler/` segment, so the existing
signature can't express the mapping. Bridging it is your call; two routes are obviously available
and either is fine if verified. **Not** acceptable: quietly changing the canonical location so the
parts line up without saying so, or a migration that silently no-ops because it looked for
`data/scheduler/publish-schedule.jsonl`.

**`scheduler/` has exactly one referent.** Verified: `'"scheduler"'` appears in `src/` only at
`slots.ts:160` (the two hits in `src/grow/delivery-binding.ts` are an unrelated string label).
Nothing else depends on that name.

**A migration that runs at import time is a different hazard from one that runs on first read.**
Several existing callers do this at module scope (`captures.ts:20`, `room-queue.ts:134`). Either
way, `migrateLegacyDataFile` must not overwrite an existing canonical file — guarded at
`data-root.ts:48` — and your test must prove the guard holds, not assume it.

**`dataRoot()` already isolates tests.** Under `NODE_TEST_CONTEXT` an unconfigured data root is a
per-process `mkdtemp` (`data-root.ts:15-19`) — why most suites here are already safe, and the
mechanism Lane B should prefer over inventing a new one. It's also why Lane A's *production* fix
is not itself a test hazard.

**Lane B must not move production's cost log.** The root `CLAUDE.md` names `data/cost-log.csv` by
path as where every paid call is logged. Moving it under the data root, the way the eleven other
stores moved, is a change the owner hasn't decided, so this slice doesn't make it. Keep the
destination byte-identical when neither a test override nor `NODE_TEST_CONTEXT` applies, and
prove it.

**Do not widen this slice.** A prior audit flagged fourteen other test sites suspected of writing
real trees. All have since been measured and found benign — uniquely-named fixtures with
self-scoped cleanup. Out of scope; do not "tidy" them.

## Acceptance

Assert the observable outcome. A test that proves `migrateLegacyDataFile` was *called* proves
nothing about which file was read.

- [ ] **A1.** With a temp data root holding no canonical ledger, and a legacy
      `data/publish-schedule.jsonl` with known claims, reading the ledger returns those claims —
      assert on the claims read back, not a path string or a spy.
- [ ] **A2.** The legacy file still exists and is byte-identical after that migration.
- [ ] **A3.** When a canonical ledger already exists, a legacy file with different contents does
      **not** overwrite it — a read returns the canonical contents.
- [ ] **A4.** With neither `CONTENT_AGENTS_TEST_LEDGER` nor `CONTENT_AGENTS_DATA_ROOT` set, outside
      a test context, the resolved production path is unchanged from today's
      `<dataRoot>/scheduler/publish-schedule.jsonl` — or, if changed, state the new path, why, and
      that the migration reaches it.
- [ ] **A5.** `src/publish/slots.test.ts` neither reads nor writes
      `join(repoRoot, "data", "publish-schedule.jsonl")`. Prove it from the test source **and** a
      digest assertion in the suite itself that the real file stays byte-identical across the run,
      the way `src/review/studio-scheduling.test.ts` already does for `briefs/`. A clean
      `git status` proves restoration, not that it was never written.
- [ ] **A6.** The false header comment at `slots.test.ts:5` is corrected, and the stale
      `data/publish-schedule.jsonl` location named in `slots.ts:12` and in
      `queue-view.ts:14,16,346` is either corrected or left with a one-line note on where the file
      now lives. `queue-view.ts` logic stays untouched — comments only, and only if it doesn't
      touch Lane B's files.
- [ ] **B1.** After a full repository-gate run, `data/cost-log.csv` has gained **zero** rows.
      Prove with a line count and digest taken before and after, quoted in the RESULT BLOCK, and
      confirm no `"Acme Co"` row was added.
- [ ] **B2.** Outside a test context, with no override set, `logCost` writes to the same absolute
      path it does today.
- [ ] **B3.** A test can point the cost log somewhere readable and assert a `logCost` call landed a
      row there — the observability 5N couldn't get. State plainly whether this now covers the
      `runAgentSpawn` → `runCommandSpawn` linkage or only the `logCost` write.
- [ ] **B4.** `configured-media-runtime.test.ts`'s "a free render appends nothing" assertion
      (`:187`, `:229`) still proves that, against wherever the cost log now resolves under test.
      If it can't, say so rather than deleting it.

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
ledger present picks up her July claims instead of starting empty — what stops the scheduler
placing a second post into a slot it already used.

## Risk

medium — audit required: **yes**. Lane A changes production path resolution for a file whose
wrongness is silent; tell the auditor an empty read looks identical to a correct one.

## Families

- Builder: Claude, strong tier — one worker per lane, both lanes concurrently
- Auditor: Codex / GPT, strong tier — different family from the builder

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in the
`RESULT BLOCK` below before this slice can close.
