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
- `src/review/publishing-status.ts` — implement a materially safer provenance design for new status-only approvals while preserving legacy missing-history and uncertain-attempt guards. Do not apply the rejected explicit-schedule bypass.
- `src/review/publishing-status.test.ts` — focused regressions for new-approval provenance and unchanged legacy missing-history, persisted-attempt and default-caller guards.

### Approved repair ownership expansion — 2026-09-07

Coordinator authorizes these engineering changes to establish positive creation provenance, after advisor review found that status alone cannot prove history absence:

- New `src/review/approval-provenance.ts` and `.test.ts`: durable provenance and taint, fail closed on malformed/incomplete records; bind canonical queue identity and dispatch fingerprint. No production operational data edits.
- `src/publish/queue.ts` and its focused test file: canonical `appendRows` stamps only demonstrably newly appended rows after successful creation; pre-existing or reused IDs never gain fresh trusted provenance.
- `src/review/jobs.ts` and its focused test file: stamp initial rows only in newly created GUI atomize folders after validated creation. Never stamp pre-existing folders or relabel unknown-history rows.

All other publisher implementation remains out of scope. Expand focused verification to the changed helpers and callers. This authorizes provenance plumbing, not the rejected missing-history bypass. Existing legacy unknown-history rows retain refusal with a persistent, clear reason; recorded uncertain attempts remain refused. Prove failure ordering, restart, status cycling, ID reuse, and concurrent status/schedule cannot manufacture eligibility. Rows created through unsupported paths remain conservatively untrusted; document this limitation explicitly for acceptance review.

## Do not touch

- `src/review/studio-scheduling.ts`, `src/publish/**` except the approved queue provenance expansion above — the
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

- [x] A1 — `POST /api/status` with `status: "approve"` writes the status and makes no call into
      `scheduleApproved` or `scheduleApprovedOnce`. A test asserts the scheduler dependency is
      never invoked.
- [x] A2 — `POST /api/publishing/schedule` on an `approve` row calls the same scheduler the old
      approve path called, under the same in-flight key, and returns its result per row.
- [x] A3 — The same endpoint refuses a `pending`, `revise`, `discard` or already-scheduled row
      with a reason and calls nothing.
- [x] A4 — A selection (slug / pillar / platform / ids, the `batch-reschedule` shape) schedules
      only the eligible rows and reports the rest as skipped.
- [x] A5 — The Publishing view renders approved-unscheduled rows in a Pending group with a
      Schedule control; scheduled and published rows render where they do today.
- [x] A6 — The header comment at `serve.ts:5-13` describes the new behaviour.
- [x] A7 — Every existing `serve.test.ts` and `page.test.ts` case still passes.
- [x] A8 — No em dashes introduced in any user-visible string.
- [x] A9 — The design sanity check passes for the Publishing view: `docs/content-studio-master-status.md`
      → `## Standing constraints` → "Design sanity check on every GUI slice". Record each of the
      five in the RESULT BLOCK with the CSS or HTML that satisfies it.

## Verify

Run unsandboxed (tsx needs a socket under `$TMPDIR`).

```
node --import tsx --test src/review/serve.test.ts src/review/page.test.ts src/review/publishing-status.test.ts
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

- Builder: OpenAI Codex, `gpt-5.6-terra`, xhigh effort after protocol escalation for omitted checks (Muxin authorized a non-highest-tier Codex route on 2026-09-07).
- Auditor: Grok, strong tier (Muxin requested this route on 2026-09-07). Receives the diff, the changed-file list, the focused test
  output and this Acceptance list only.

## Closeout

No closeout tool in this repository. **PASS / ACCEPTED**: A1–A9 verified, independent Grok source/behavior and rendered closure PASS, frozen unsandboxed repository gate 4321/4321 tests, zero failures, exit0. See `## Accepted closeout` below.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Engineering clarification — explicit scheduling intent

The old status route passed a pre-approval row to `scheduleApprovedOnce`; the new endpoint necessarily reads an approved row. The legacy no-attempt approval guard would reject it. Coordinator proposed the narrow helper option above, but automatic approval review REJECTED it. It is not authorized to execute without a materially safer design or informed user approval; no bypass or patch artifact was applied. Any eventual design must preserve legacy missing-history and recorded uncertain-attempt protection while permitting demonstrably new approvals to schedule. `/api/status` also drops publishing eligibility prechecks so approval is solely a status update. This changes no product scope.
