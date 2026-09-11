# SLICE-6M: realign the two stale Content approval journeys with the shipped two-step flow

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`npm run test:e2e` fails two journeys for a reason that is not a defect. Commit `7c6815f`
("separate approval from durable explicit scheduling (5S)") deliberately split approval from
scheduling: approving a draft now records a decision and nothing else, and dispatch happens only
when the owner presses Schedule in Publishing. Neither `e2e/pass-a-reads.ts` nor
`e2e/pass-b-writes.ts` was updated, so both still assert the pre-5S combined behaviour: one
against sheet copy that no longer exists anywhere in `src/`, one by expecting a provider result
from a click that no longer dispatches. They fail deterministically on every checkout.

When this slice is done both journeys assert the two-step flow the product ships, they still fail
if it breaks, and `npm run test:e2e` exits 0 on this candidate.

## Difficulty

easy — the product behaviour is already decided and already shipped; this is realigning two
assertions to it. The only real risk is a worker "fixing" a red test by weakening it.

## Depends on

none. SLICE-6L is stopped and its retained diff sits uncommitted in the main checkout; this
slice is independent of it and must not touch those paths (see `## Do not touch`).

Delivery batch: 6M only. One implementation deliverable. Stop condition: accepted, or stopped
under `### Stopping without acceptance`. A free slot does not authorize a second slice.
Owner checkpoint: none. The owner has confirmed the product behaviour 5S shipped — she controls
when things go out, approval alone does not send. Which selectors and assertion shapes express
that is an engineering choice.

## Owned files

Parallel-safe: no. Both files are exercised by one `npm run test:e2e` run — a single ~5 minute
shared execution budget producing one shared result ledger — and the whole change is dozens of
lines. A second lane would re-run the same suite to verify the same artifact and return no
independent deliverable, so it would add coordination cost and nothing else.

### Lane A — the two realigned journeys

- `e2e/pass-a-reads.ts` — the `"Content opens request-grouped approval before the separate
  Publish step"` record only
- `e2e/pass-b-writes.ts` — the `"Content grouped approval reports injected provider success and
  retained failure separately"` record, plus whatever navigation it now needs

## Do not touch

- Every path under `src/`. The product is correct; the tests are stale. If a journey cannot pass
  without a product change, that is a finding to report, not a change to make.
- `e2e/run-all.ts`, `src/operations/e2e-summary*.ts`, `.gitignore` — SLICE-6L's retained,
  uncommitted work. Never stage or revert them.
- `e2e/harness.ts` and `e2e/isolation.test.ts` — see the non-goal in `## Verify`.
- `package.json`, `docs/content-studio-master-status.md`, `docs/content-agents-backlog.md`,
  `data/**`, `.env`, and every other e2e pass file.
- Any journey's presence, order, viewport, flag state or fixture-versus-live posture. Do not add,
  delete, reorder or skip a journey.

## Cited headings

none

## Acceptance

- [ ] Every string the `pass-a-reads.ts` record asserts against the rendered `#reviewSheet` is
      present in `src/review/page.ts` at this candidate's sha. Verifiable by grep, string by
      string, with no match relying on a substring the page never renders.
- [ ] That same record still proves approval is presented as separate from scheduling: at least
      one asserted string names the later Publishing/Schedule step. An assertion reduced to only
      the sheet heading does not satisfy this item.
- [ ] The `pass-b-writes.ts` record drives an explicit scheduling action through the UI after
      approving, rather than expecting approval alone to dispatch. No assertion in that file
      expects a `publishingStatus` to exist on a row whose only action was `#reviewApproveSelected`.
- [ ] After that explicit scheduling action the record still asserts both injected provider
      outcomes, unchanged in substance: the `e2e-provider-success` row reaches state `planned`
      with `providerObjectId` `e2e-provider-object`, and the `e2e-provider-failure` row reaches
      state `uncertain` with error `injected provider timeout`.
- [ ] Neither record was deleted, commented out, downgraded to `blocked`, or made to record a
      status other than `pass`/`fail`. Both still record `fail` when the flow they describe is
      broken. Demonstrate this for at least one of the two by temporarily breaking its expected
      condition, observing `fail`, and restoring — record what was broken and what was observed.
- [ ] `node --import tsx --test e2e/isolation.test.ts` exits 0 (this file is not discovered by
      `npm test`, so it must be run by name).
- [ ] `npm run test:e2e` exits 0, run unsandboxed from the dedicated worktree. If any journey
      fails, the RESULT BLOCK names it and its reason and the slice takes `### Stopping without
      acceptance`.
- [ ] `npm run check` was run unsandboxed and its result recorded. It is currently red on this
      repository for a pre-existing reason outside this slice: `src/review/jobs.test.ts` (SLICE-5Z)
      fails on `main`. Do not assert exit 0. Assert instead that every failure it reports is
      reproduced with this slice's changes stashed out, and name each one.
- [ ] `bash scripts/repo-hygiene.sh --rescue` was run and settled per the `### Hygiene
      disposition` form (not a bare exit code).

## Verify

Classification and applicable gate: meaningful behavior / high risk. `e2e/*.ts` are executable
inputs and this slice changes what a gate reports. The repository-wide gate applies; the
documentation-only exception does not.

For UI changes: this slice changes no page, no component and no user-visible copy — record that
in the RESULT BLOCK rather than leaving it unstated, and the standing design sanity check does
not apply. The affected journeys are the two named above, in the Content room's Approve Drafts
and Publishing sheets. Viewports, feature-flag state and fixture-versus-live posture stay exactly
as the existing suite sets them. Live integration: unchanged — the provider outcomes come from
the suite's existing hermetic injected seam, which is controlled-response proof, not live
provider proof, and already was.

Run everything from a worktree dedicated to this session that no other session is writing to.
Not housekeeping: `run-all.ts` snapshots its launch worktree's bytes including ignored runtime
data, and a fresh worktree has no `data/analytics.db`, so nothing there can open it and the
sidecar churn that tripped SLICE-6L cannot recur.

Explicit non-goal: do not "fix" that isolation guard by excluding `*.db-wal` / `*.db-shm` from
the snapshot. SQLite in WAL mode lands a write in the sidecar and only checkpoints into the `.db`
later, so excluding sidecars could hide a real leak into the caller's checkout.

Known unknown for preflight: a fresh worktree lacks gitignored runtime data. If a journey fails
only because such a file is absent, record it as a finding and stop — do not copy the owner's
real `data/` in, and do not write anything back to the main checkout.

```
npm run worktree:setup                       # once, in the fresh worktree
node --import tsx --test e2e/isolation.test.ts
npm run test:e2e                             # unsandboxed; record exit code, do not pipe through tail
npm run check                                # unsandboxed; under the sandbox it reports ~196 phantom venture failures
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

`npm run test:e2e` exits 0 with no journey failing, and the two records that failed on SLICE-6L's
candidate now pass by driving Approve and then Schedule as two separate acts. Breaking either
step still turns them red.

## Risk

medium — audit required: yes. The cheapest way to make a red test green is to weaken it, and a
weakened journey would let a real regression in the approve/schedule split ship unnoticed while
the suite reads green. That is the failure this audit exists to catch.
Review boundary: this candidate.
Review scope/budget: ordinary effort, one bounded review. Three fixed questions for the auditor:
(1) does each realigned assertion still fail if the behaviour it describes breaks, or is it now
trivially true; (2) does the `pass-b-writes` record obtain its provider outcomes from an explicit
scheduling action rather than from approval; (3) does any part of the diff change product
behaviour rather than test expectations.
Prior accepted evidence: none retained; the prior run of these journeys is the red result in
`SLICE-6L.md` → `## Stopped`, which this slice supersedes for these two records only.
On reviewer outage: mark the candidate review-blocked, record the retry condition in `## Stopped`,
and do not integrate.

## Families

- Builder: Claude, mid-tier model, medium effort — one lane, fresh packet-sized context. Escalate
  only if a first pass fails acceptance.
- Auditor: Codex (GPT), different family from the builder, ordinary effort. Launch
  `codex exec --sandbox read-only` unsandboxed locally — the sandboxed launch fails with
  `Operation not permitted` here, and the default model is required because `gpt-5.1-codex` is
  rejected on this account. Supply the acceptance list and the candidate diff, not only prose.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md`
for the closeout gate item — a `**PASS**` line with a date or an explicit leftover list, never a
fenced command.

Preflight: candidate sha pinned and changed paths listed; every acceptance item mapped to a named
command output or a quoted diff hunk; both `npm run test:e2e` and `npm run check` exit codes
captured by exit status, not by reading piped output; the deliberate-break demonstration recorded
with what was broken and what was observed; audit findings separated into established defects,
verification gaps and optional improvements, each closed by a fix plus evidence or an explicit
disposition.
Gate cost: `npm run check` on the frozen candidate, run once, last, after the journey run. Record
measured local elapsed time per command separately from model usage; mark provider-reported usage
`unknown` if unavailable. Do not rerun either for paperwork.

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for the
hygiene item — not a bare exit code. Expect a non-zero exit: other sessions have pending work,
several `/private/tmp/content-agents-*` checkouts and unmerged branches. Name each path this
session created and settled, and each path left in place. Regenerated `e2e/results.jsonl` and
`e2e/RESULTS.md` are this session's paths and must be settled by name.

Use the `### Read-set measurement` form in `docs/operations/slice-protocol-environment.md` for the
closeout read-set print — not an ad hoc re-derivation.

## Stopped

Full RESULT BLOCK/evidence: `SLICE-6M-LOG.md` → `## Stopped — 2026-09-11` (not read at start).
Blocker: `test:e2e` exit 1 from pre-existing `pass-d-editorial.ts`/`pass-d-content-generation.ts`
timeouts, reproduced with this diff stashed against `main` — unrelated, out of scope here.
Verified: both owned target records pass clean, twice; isolation clean; check/hygiene/audit
not reached. Retained: `pass-a-reads.ts`/`pass-b-writes.ts` uncommitted in
`wt-slice-6m` (branch `slice-6m-worker`), snapshotted to `refs/wip/wt-slice-6m` (`d881432`).
Next: owner accepts on the narrower bar, or a new slice fixes Pass D first. Original usage budget
and handoff moved to `SLICE-6M-LOG.md` (superseded by this stop).
