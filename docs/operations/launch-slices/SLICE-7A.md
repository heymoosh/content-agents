# SLICE-7A: a reuse-guard refusal stops leaving a permanent dispatch fence

Protocol: `AGENTS.md` → `## Slice protocol`, plus `docs/operations/slice-protocol-environment.md`.
Read those and this file only. Do not load the repository for context. Do not commit.

## Goal

When the reuse guard refuses a row, that row stays schedulable later. Today the refusal leaves a
durable dispatch fence in the approval journal that nothing ever clears, so the row is bricked
permanently and Studio offers no way out. Observed 2026-09-12 on `bluesky-1` of
`2026-09-07-the-world-s-broken-what-do-we-do-human-inference`, repaired by hand with
`resolveDispatchFence`. Full diagnosis in `SLICE-7A-LOG.md`.

Two things are wrong, both in `scheduleApprovedOnce` (`src/review/publishing-status.ts`): the fence
is resolved only for a Postiz rate limit (`:395-398`), and the ledger state is chosen by
`result.scheduleError.startsWith("blocked by reuse guard")` (`:377`). Exactly one of the four guard
refusal strings in `src/review/studio-scheduling.ts` matches that prefix. The other three land as
`uncertain`, which falsely asserts the provider may hold a draft and independently blocks retry
through `publishingRetryBlock` (`:148-150`).

Done means: a refused row can be scheduled again once its window opens, with no hand repair, and a
row that may actually hold a provider object still cannot.

## Difficulty

hard — it relaxes a fail-closed guard on the live-posting path. A wrong relaxation lets a second
dispatch run against a provider that already accepted the first one.

## Depends on

6Z (accepted). Delivery batch: 7A alone; acceptance order is 7A then stop. A free agent slot does
not authorize another slice.

Owner checkpoint: Muxin asked for this fixed after hitting the fence on `bluesky-1` (2026-09-12).
Coordinator scope decisions, already resolved, do not reopen them:

1. No string sniffing. The prefix test is replaced by an explicit typed signal on the schedule
   outcome. A prefix is not evidence about whether a network call happened.
2. The signal means exactly **no provider request was made for this row on this attempt**. Not
   "the guard refused", not "nothing was created". *(Amended in audit: the two questions split.
   See `SLICE-7A-LOG.md`.)*
3. Absence keeps today's behavior byte for byte: fence retained, `uncertain`, retry refused. The
   field is optional and fails closed when unset.
4. Only sites provably ahead of every provider call may set it. The Postiz pre-flight refusal
   (`:673`) qualifies: it returns before `publishPostizFn` and before any slot claim. The recovery
   branch at `:565` runs **after** the publisher was invoked, so it does NOT get the signal unless
   the worker can prove from the publisher sources that no request was made. Default is no signal.
5. Deferral is not refusal and is out of scope.
6. No new reconcile UI. Once refusals stop fencing, the dead end closes on its own.

## Owned files

Parallel-safe: no. One worker. The behavior change, its unit tests and the e2e journey all turn on
the same selection path, so a second lane would own no independently verifiable deliverable.

### Lane A — the typed pre-dispatch signal and its proof

- `src/review/studio-scheduling.ts`
- `src/review/publishing-status.ts`
- `src/review/publishing-status.test.ts`
- `src/review/studio-scheduling-postiz-reuse.test.ts`
- `docs/operations/launch-slices/SLICE-7A.md` (RESULT BLOCK only)

## Do not touch

- `.env` — read it, write it, or print its values and the slice is void. The coordinator owns it.
- Anything under `data/`, the real data root `~/.content-agents/**`, and `briefs/**`. The Placed
  log is Muxin's append-only shipping record: read it, never modify it. Tests use
  `CONTENT_AGENTS_TEST_BETS_PATH` / `CONTENT_AGENTS_TEST_BRIEFS_ROOT`.
- `src/review/approval-provenance.ts`. `resolveDispatchFence` is already correct and already
  refuses when there is no active attempt. Call it, do not change it.
- `src/publish/reuse-guard.ts`, `config/platforms.yaml` — 6Z is accepted. The guard's verdicts are
  unchanged; only what the caller does with a refusal changes.
- `src/publish/slots.ts` and the slot ledger. The scheduler owns timing.
- `docs/content-agents-backlog.md` (board writes via `prose_kanban` only),
  `docs/operations/launch-slices/evidence/**`.
- No live provider or network call of any kind. Discovery is stubbed in every test.

## Cited headings

none

## Acceptance

- [x] A Postiz row refused by the guard at the pre-flight leaves NO active fence: after the
      attempt, `approvalDispatchDisposition` no longer returns the durable-fence refusal, and a
      second Schedule on the same row is refused by the guard again rather than by the fence.
- [x] That same attempt records ledger state `blocked`, and `publishingRetryBlock` permits a retry.
- [x] All four guard refusal strings behave identically on both counts. A test names each of the
      four and asserts fence-cleared plus `blocked` for each, so none is left to the old prefix.
- [x] The signal is typed, not inferred from message text. A test proves a refusal whose wording
      changed still clears the fence, and `startsWith("blocked by reuse guard")` no longer appears
      in `src/review/publishing-status.ts`.
- [x] Fail closed, the load-bearing half: a schedule outcome with a `scheduleError` and NO signal
      still retains the fence and still records `uncertain`. Assert this for a generic provider
      error and for a thrown callback.
- [x] The Postiz rate-limit path is unchanged: still `failed`, still fence-resolved.
- [x] A successful schedule is unchanged: no fence resolution, terminal state from the provider.
- [x] `resolveDispatchFence` is called with resolution `not-created`, never `exists`, on this path.
- [x] A row with no fence (a `legacy` disposition that never fenced) takes the same refusal path
      without throwing.
- [x] Ordering holds: the terminal ledger event is appended BEFORE the fence is resolved, matching
      the rate-limit path, so a crash between them leaves a fence and not a bare clearance.
- [x] `src/review/reconcile.ts`'s `reuseGuardEligibility` still parses the `min_reuse_days` refusal
      string. Quote the reader and the producer in the RESULT BLOCK and prove the bytes match.
- [x] Every refusal string a human reads passes `config/voice.yaml`: no em dashes, no AI tells.
- [x] No production path reads `.env` differently and no secret value appears in any test, fixture,
      error string or log line.
- [x] Every new test is load-bearing: reverting the production change alone makes named tests fail.

## Verify

Meaningful behavior on the live-posting path, high risk: full repository gate, focused tests, e2e.
Run every command unsandboxed; under the sandbox the suite reports roughly 196 phantom venture
failures. Nothing may touch the working tree while `test:e2e` runs, or it fails its own isolation
check. No UI change is in scope. The affected journey is Publishing room → Schedule a row the guard
refuses → Schedule it again. Fixture backend only, never live. If no existing e2e pass covers it,
state that plainly rather than adding one.

```
npx tsc --noEmit -p tsconfig.json
node --import tsx --test src/review/publishing-status.test.ts src/review/studio-scheduling.test.ts src/review/studio-scheduling-postiz-reuse.test.ts
npm run check
npm run test:e2e
```

Record the exact commands, exit codes and pass/fail/skip counts. Do not weaken, rewrite or delete
an existing test to make anything pass; if one genuinely encodes the old prefix rule, quote it in
the RESULT BLOCK and stop for the coordinator to adjudicate rather than editing it.

## Observable result

Muxin clicks Schedule on a row whose window is still closed. It refuses with the guard's reason.
She comes back later, clicks Schedule again, and it schedules. No hand repair, no stuck row, no
message about a dispatch fence.

## Risk

high — audit required: yes. This relaxes a guard whose whole job is stopping a second dispatch
after a provider may have accepted the first. A wrongly permissive signal posts real content twice
under Muxin's byline with no undo. A wrongly strict one only leaves a row needing hand repair,
which is today's behavior, so every ambiguous case must retain the fence.
Review boundary: this candidate. Ordinary effort: one cross-family audit of the candidate diff,
changed-file list and focused check output, with bounded questions on whether every site that sets
the signal is provably ahead of all provider contact.
Prior accepted evidence: 6Z's two-window guard is unchanged here; reopened only if this candidate
edits `reuse-guard.ts` or `config/platforms.yaml`, which it must not.
On reviewer outage: mark the candidate review-blocked and do not integrate. Codex is capped until
2026-09-15, so Grok is the auditor. If Grok is also unavailable, stop; never a Claude auditor.

## Families

- Builder: Claude, opus tier — Lane A. Standing routing decision (2026-09-11).
- Auditor: Grok, reasoning effort high. Codex capped until 2026-09-15. Never a Claude auditor.

## Closeout

Use the `### Closeout gate disposition`, `### Hygiene disposition` and `### Read-set measurement`
forms in `docs/operations/slice-protocol-environment.md`.

Preflight: every acceptance item mapped to a named test or a quoted string; changed paths within
Lane A ownership; `.env` untouched and unread; `git status --porcelain -- data briefs` empty; check
exit codes recorded; audit findings and their disposition written down before integration.
Gate cost: one `npm run check` on the pinned candidate. No paperwork-only rerun.

**PASS** 2026-09-11

- Acceptance: 13 of 14 met as written. Item 3 is AMENDED by the audit's P0 (`SLICE-7A-LOG.md`,
  `## Amendments to the packet`): wording cannot determine provider state, so the four refusal
  strings must NOT behave identically. Every guard refusal records `blocked`; only a provably
  pre-dispatch site clears the fence.
- Gate, unsandboxed: `npm run check` 0, 4482/0/0. Focused 0, 70/0/0. `tsc` 0. `test:e2e` journeys
  55/0/16, `failures: []`; harness exit 1 on its own shared-worktree isolation check, caused by
  concurrent sessions writing this checkout.
- Audit: Grok `grok-4.5`. Round 1 FAIL on a confirmed P0. Round 2 bounded delta `CLOSED`.
- Coordinator grep: `startsWith("blocked by reuse guard")` occurs 0 times under `src/`.
- Hygiene: `--rescue` exit 1, nothing created by this slice, nothing removed.
- Read set: `## Slice protocol` 24560 B, this packet 12130 B as read.

## RESULT BLOCK (worker fills this in and returns it)

Full record, both audit rounds, the four amendments and the load-bearing table live in
`SLICE-7A-LOG.md`.

- **Changed:** `src/review/studio-scheduling.ts`, `src/review/publishing-status.ts` and their two
  test files, plus `SLICE-7A-LOG.md`. Every do-not-touch path untouched; `.env` never read.
- **Outcome:** the prefix sniff is gone. `ScheduleOutcome` carries
  `refusal?: "no-provider-request" | "publisher-declined"`. A pre-flight refusal, provably ahead of
  every provider call, records `blocked` and resolves its own fence `not-created`, closing the
  `bluesky-1` dead end with no hand repair. A post-publisher recovery refusal records `blocked` and
  RETAINS its fence: an empty publisher result is not proof nothing was created. Absent is
  unchanged. Both recovery sites are marked, including the `unscheduled-draft` route the builder
  found unprompted. No refusal wording changed, so `reconcile.ts`'s reader round-trips.
- **Checks and load-bearing:** counts in `## Closeout`. Reverting the consumer alone fails 8 named
  tests, the pre-flight mark alone 2, the P0 repair alone 4. No existing test weakened or deleted.
- **Unresolved:** none blocking. Four amendments recorded in the log.
- **Delivery state:** accepted. See `## Closeout`.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- One Claude opus worker, fresh context, frozen handoff at the completed RESULT BLOCK.
- Evidence return: commands, exits, counts, candidate identity, short result, artifact pointers.
- Capability boundary: the worker returns the RESULT BLOCK and stops. The coordinator runs the
  audit, the gate and the single integration commit.
