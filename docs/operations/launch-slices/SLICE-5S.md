# SLICE-5S: approve means approved, the Publishing room does the publishing

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin's decision, 2026-09-07, in her words: "approve only means that it's approved to be
published. The publishing section is where we have the list of things that go through our
publishing logic, like, based on campaigns, scheduling, batch scheduling and rescheduling,
pending vs already published etc."

Today the review server fires the real publish call the moment a row is set to `approve`
(`src/review/serve.ts:1141-1163`, header comment `serve.ts:5-13`). During SLICE-5P that turned
three approve clicks into three real publish attempts, which failed only because the first
provider's discovery call could not connect. Approve and publish must be two actions.

Demonstrably true when done: setting a row to `approve` writes the status and nothing else; the
Publishing room lists approved-but-not-yet-scheduled rows as pending; a "Schedule" action there
(one row, or a selection) is the only thing in the GUI that calls the publishers; the existing
reschedule, batch reschedule and resolve actions are unchanged.

## Difficulty

Hard — two files that must agree (server and page), an existing in-flight guard to keep, and a
change to what a click Muxin makes every week actually does.

## Depends on

SLICE-5Q (owns `src/review/page.ts` queue rows; this slice edits the same file, so they cannot run
together). SLICE-5P is closed as not accepted; this slice is one of its repairs.

## Owned files

Parallel-safe: **no — single lane.** The server change and the page change must ship together,
or the GUI has no way to publish at all.

### Lane A — split the actions

- `src/review/serve.ts`
  - `/api/status` (`serve.ts:1136-1164`): after `updateRow`, return `{ ok: true }` and stop. Remove
    the dispatch block. Keep `updateRow` exactly as it is.
  - New `POST /api/publishing/schedule`: body `{ slug, id }` or `{ selection }` in the same shape
    `batch-reschedule` (`serve.ts:1222`) accepts. For each row that is `approve` and not yet
    scheduled, call `scheduleApprovedOnce` when `scheduleKind(row)` is set, otherwise
    `scheduleApproved`, exactly as the removed block did, under the same `schedulingInFlight`
    key. Return per-row `{ id, scheduled, scheduleError, publishing }`. Rows that are not `approve`
    are refused with a reason, never scheduled.
  - Rewrite the header comment (`serve.ts:5-13`) so it no longer says approve fires the publish.
- `src/review/page.ts` — the Publishing view: a "Pending" group of approved rows with no live
  schedule, a Schedule button per row and for the selection, calling the new endpoint. The
  approve control in the queue view no longer shows scheduling results. Reuse the existing
  publishing state helpers (`page.ts:1840` `publishingState`, `page.ts:1852` `publishingProvider`).
- `src/review/serve.test.ts` and `src/review/page.test.ts` — see Acceptance.

## Do not touch

- `src/review/studio-scheduling.ts`, `src/review/publishing-status.ts`, `src/publish/**` — the
  publishers and the ledger are not in scope. The endpoint moves; the calls behind it do not change.
- `/api/cancel`, `/api/publishing/reschedule`, `/api/publishing/batch-reschedule`,
  `/api/publishing/resolve`.
- The write-then-dispatch ordering finding from 5P disappears with the dispatch; do not add a
  new ordering.
- `review-queue.md` files, `content/`, `.claude/skills/**`, `docs/content-studio-master-status.md`.

## Cited headings

`## Standing constraints` → "Design sanity check on every GUI slice", reproduced here so the worker does not open the master.

Check rendered HTML: body type at least 1.125rem with line height at least 1.5; content first with backend IDs and folder slugs muted; a clear divider between thoughts; errors persist until read; scannable at arm's length without zoom.

## Acceptance

- [ ] A1 — `POST /api/status` with `status: "approve"` writes the status and makes no call into
      `scheduleApproved` or `scheduleApprovedOnce`. A test asserts the scheduler dependency is
      never invoked.
- [ ] A2 — `POST /api/publishing/schedule` on an `approve` row calls the same scheduler the old
      approve path called, under the same in-flight key, and returns its result per row.
- [ ] A3 — The same endpoint refuses a `pending`, `revise`, `discard` or already-scheduled row
      with a reason and calls nothing.
- [ ] A4 — A selection (slug / pillar / platform / ids, the `batch-reschedule` shape) schedules
      only the eligible rows and reports the rest as skipped.
- [ ] A5 — The Publishing view renders approved-unscheduled rows in a Pending group with a
      Schedule control; scheduled and published rows render where they do today.
- [ ] A6 — The header comment at `serve.ts:5-13` describes the new behaviour.
- [ ] A7 — Every existing `serve.test.ts` and `page.test.ts` case still passes.
- [ ] A8 — No em dashes introduced in any user-visible string.
- [ ] A9 — The design sanity check passes for the Publishing view: `docs/content-studio-master-status.md`
      → `## Standing constraints` → "Design sanity check on every GUI slice". Record each of the
      five in the RESULT BLOCK with the CSS or HTML that satisfies it.

## Verify

Run unsandboxed (tsx needs a socket under `$TMPDIR`).

```
node --import tsx --test src/review/serve.test.ts src/review/page.test.ts
```

Visual: use a disposable fixture root, isolated HOME/operational ledger and a fake scheduler.
Bind the fixture review server to a loopback port chosen for this session. Open it in the browser,
approve a fixture row and confirm it appears in Publishing > Pending with zero publisher calls.
Exercise one-row and selection Schedule against the fake scheduler only; capture the rendered
Publishing view to `/private/tmp/slice-5s-evidence/publishing.png`. Never change a real review
queue, use production credentials, or click Schedule against a real row. No authenticated
publishing canary is authorized or needed for this slice.

## Observable result

Muxin approves a row and nothing leaves the machine. She goes to the Publishing room, sees it
under Pending, and decides when it goes out.

## Risk

Medium — audit required: **yes.** This is the publish trigger. The auditor checks from the diff
and tests that no code path reaches a publisher from `/api/status`, and that the new endpoint
cannot schedule a row that is not `approve`. Coordinator and independent auditor verify the
rendered Publishing view before integration. The user instructed autonomous engineering decisions
and a stop only at acceptance or a major product-scope decision; a routine visual-approval pause
is therefore not required.

## Families

- Builder: Claude, strong tier.
- Auditor: Grok, strong tier (Muxin requested this route on 2026-09-07). Receives the diff, the changed-file list, the focused test
  output and this Acceptance list only.

## Coordinator confirmation — 2026-09-07

Dependency 5Q is accepted; 5R is accepted at `71f2df9`. Single Claude strong-tier builder,
independent Grok strong-tier audit, then a frozen candidate and the full unsandboxed gate.
Worker owns only the four implementation/test files above and disposable evidence outside the
repository. Coordinator owns this packet and the master status update. Workers do not commit.
The worker is not alone in the repository: preserve other sessions' edits; do not revert them.
Read owned files and their narrowly necessary imports/test harness dependencies only after this
packet; do not load general repository context. Report any additional required edit first.
Do not run the repository-wide gate; coordinator runs it once after audit closure. Existing
serial Node test-runner workaround from 5R may be used for the gate, explicitly recorded.
Return the RESULT BLOCK in the final response; coordinator persists it here.

## Closeout

No closeout tool in this repository. **NOT ACCEPTED**: implementation, focused checks, visual proof, cross-family audit and the frozen repository-wide gate remain pending; see `## Stopped`.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Stopped

- Blocker: Claude session usage limit before implementation; CLI reports reset at 8:50 p.m. America/Chicago.
- Verified: ordered protocol/START HERE/packet reads; 5Q and 5R dependencies accepted; clean isolated worker branch based on `71f2df9`; worktree setup exited 0. Worker exited 1 with `is_error: true` and no candidate diff. No focused checks, audit, visual proof or full gate ran.
- Retained work: coordinator packet changes here and master START HERE/progress update; `/private/tmp/slice-5s-evidence/build-prompt.txt`, `build-result.json`, `audit-criteria.md`. Claude session `005d30e8-4fb0-4203-9fad-ac342ff83034`. No implementation files changed.
- Next action: rerun this confirmed packet with the Claude builder after capacity returns, then obtain the Grok audit and continue the declared verification sequence.
- Audit routing update, 2026-09-07: Muxin requested Grok instead. Grok is the designated independent auditor. No audit was launched because the builder produced no implementation candidate or focused-check evidence; changing the auditor does not clear the builder usage-limit blocker.
- Hygiene disposition: rescue pass exited 1 solely for the four known tracked modifications; snapshot `refs/wip/content-agents` (`6ad9148`). This session created no untracked repository paths. The unused clean worktree and empty `slice-5s-approval` branch were removed. Existing local-only branches are preserved. Only this packet and the master update are committed. Pre-existing `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` and `data/notes-spread-ledger.jsonl` are preserved.
