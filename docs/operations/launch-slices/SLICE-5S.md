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

`none`

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

## Verify

Run unsandboxed (tsx needs a socket under `$TMPDIR`).

```
node --import tsx --test src/review/serve.test.ts src/review/page.test.ts
```

Visual: `npm run review`, open `http://localhost:4600`, set a row to `approve` and confirm the
Publishing view shows it as Pending with no provider call recorded in
`~/.content-agents/content-agents-154a8dd69ae2/publishing-status.jsonl`. Do **not** click
Schedule against a real row; a scheduled draft auto-fires. Screenshot to
`$TMPDIR/slice-5s-publishing.png`.

## Observable result

Muxin approves a row and nothing leaves the machine. She goes to the Publishing room, sees it
under Pending, and decides when it goes out.

## Risk

Medium — audit required: **yes.** This is the publish trigger. The auditor checks from the diff
and tests that no code path reaches a publisher from `/api/status`, and that the new endpoint
cannot schedule a row that is not `approve`. Hold for Muxin's eyes on the Publishing view before
merge: it is a page she uses.

## Families

- Builder: Claude, strong tier.
- Auditor: Codex (GPT), strong tier. Receives the diff, the changed-file list, the focused test
  output and this Acceptance list only.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list here.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
