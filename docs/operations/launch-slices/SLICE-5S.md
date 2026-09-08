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

- Builder: OpenAI Codex, `gpt-5.6-terra`, high effort (Muxin authorized a non-highest-tier Codex route on 2026-09-07).
- Auditor: Grok, strong tier (Muxin requested this route on 2026-09-07). Receives the diff, the changed-file list, the focused test
  output and this Acceptance list only.

## Coordinator confirmation — 2026-09-07

Dependency 5Q is accepted; 5R is accepted at `71f2df9`. Single Codex `gpt-5.6-terra` medium-effort builder,
independent Grok strong-tier audit, then a frozen candidate and the full unsandboxed gate.
Worker owns only the implementation/test files above and disposable evidence outside the
repository. Coordinator owns this packet and the master status update. Workers do not commit.
The worker is not alone in the repository: preserve other sessions' edits; do not revert them.
Read owned files and their narrowly necessary imports/test harness dependencies only after this
packet; do not load general repository context. Report any additional required edit first.
Do not run the repository-wide gate; coordinator runs it once after audit closure. Existing
serial Node test-runner workaround from 5R may be used for the gate, explicitly recorded.
Return the RESULT BLOCK in the final response; coordinator persists it here.

## Closeout

No closeout tool in this repository. **NOT ACCEPTED**: focused checks pass after the high-effort repair, but scheduling eligibility, visual proof, independent closure and the frozen repository-wide gate remain pending; see `## Stopped`.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Previous stop — superseded by Codex resume on 2026-09-07

- Blocker: Claude session usage limit before implementation; CLI reports reset at 8:50 p.m. America/Chicago.
- Verified: ordered protocol/START HERE/packet reads; 5Q and 5R dependencies accepted; clean isolated worker branch based on `71f2df9`; worktree setup exited 0. Worker exited 1 with `is_error: true` and no candidate diff. No focused checks, audit, visual proof or full gate ran.
- Retained work: coordinator packet changes here and master START HERE/progress update; `/private/tmp/slice-5s-evidence/build-prompt.txt`, `build-result.json`, `audit-criteria.md`. Claude session `005d30e8-4fb0-4203-9fad-ac342ff83034`. No implementation files changed.
- Next action: rerun this confirmed packet with the Claude builder after capacity returns, then obtain the Grok audit and continue the declared verification sequence.
- Audit routing update, 2026-09-07: Muxin requested Grok instead. Grok is the designated independent auditor. No audit was launched because the builder produced no implementation candidate or focused-check evidence; changing the auditor does not clear the builder usage-limit blocker.
- Hygiene disposition: rescue pass exited 1 solely for the four known tracked modifications; snapshot `refs/wip/content-agents` (`6ad9148`). This session created no untracked repository paths. The unused clean worktree and empty `slice-5s-approval` branch were removed. Existing local-only branches are preserved. Only this packet and the master update are committed. Pre-existing `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` and `data/notes-spread-ledger.jsonl` are preserved.

## Resume — 2026-09-07

Muxin authorized proceeding without Claude using a suitable non-highest-tier Codex model. The bounded server/UI change uses `gpt-5.6-terra` at medium effort; Grok remains independent auditor. Scope and acceptance criteria are unchanged. The prior Claude capacity blocker is superseded for this run.

## Engineering clarification — explicit scheduling intent

The old status route passed a pre-approval row to `scheduleApprovedOnce`; the new endpoint necessarily reads an approved row. The legacy no-attempt approval guard would reject it. Coordinator proposed the narrow helper option above, but automatic approval review REJECTED it. It is not authorized to execute without a materially safer design or informed user approval; no bypass or patch artifact was applied. Any eventual design must preserve legacy missing-history and recorded uncertain-attempt protection while permitting demonstrably new approvals to schedule. `/api/status` also drops publishing eligibility prechecks so approval is solely a status update. This changes no product scope.

## Stopped

- Blocker: automatic approval review rejected the higher-effort creation-provenance integration into the empty-history scheduling guard. 5S is NOT ACCEPTED.
- Exact rejection: “This patch bypasses the existing publishing retry guard whenever local provenance exists but the provider ledger is empty, which can re-dispatch after a provider call whose ledger write failed and create duplicate external schedules; the task does not specifically authorize this unsafe exception.”
- Verified: `gpt-5.6-terra` high-effort repair reports the declared focused suite PASS, 402 tests / 0 failures; focused approval HTTP/source checks PASS, 2 / 0; coordinator `git diff --check` PASS. No current browser fixture, rendered screenshot, new audit closure or full gate.
- Retained work: `/private/tmp/content-agents-slice-5s-codex`, branch `slice-5s-codex`; four tracked modified paths `src/review/serve.ts`, `src/review/page.ts`, `src/review/serve.test.ts`, `src/review/page.test.ts`. Schedule route now exists, but fresh approvals remain refused by the unchanged legacy empty-history guard. No rejected provenance code or untracked artifact remains. No implementation commit or push.
- Next action: obtain informed approval for scheduling rows with durable creation and committed-approval provenance but an empty provider ledger, acknowledging the stated duplicate-schedule risk, or establish a materially safer design without that exception. Then complete A2–A4 and independent/visual/full-gate verification.
- Closeout: NOT ACCEPTED. Existing operational changes in the primary checkout are preserved; hygiene disposition follows below.

## Grok candidate audit — 2026-09-07

Muxin explicitly requested CLI `--sandbox workspace` with no file modifications, superseding the read-only launch preference. Grok 4.5 completed (exit 0) against bounded acceptance criteria, candidate diff, changed paths, focused failure output and helper excerpts. No implementation requested or integrated. Evidence: `/private/tmp/slice-5s-evidence/grok-workspace-audit-prompt.txt`, `grok-workspace-audit-result.txt`, `grok-workspace-audit-stderr.txt`. This is review of an incomplete candidate, not acceptance or independent closure.

Coordinator dispositions / repair checklist:

- Established introduced blocker: `src/review/page.ts:1983` calls `/api/publishing/schedule`; no matching route exists in `serve.ts`. Implement A2–A4, verify eligible/refused/selection results and duplicate-dispatch prevention. Search all uses of `/api/publishing/schedule`, `schedulingInFlight`, `scheduleApprovedOnce` and `scheduleApproved` before closure.
- Established verification gap: `src/review/serve.test.ts:364-366` checks source strings, not the A1 runtime scheduler non-invocation invariant. Add observable dependency-call proof; rerun focused checks. Latest recorded run remains 398 pass / 3 fail, with one later assertion edit unverified.
- Existing guard / new integration conflict: `src/review/publishing-status.ts:175-177` blocks approved rows without known terminal history. Preserve duplicate-post protection; rejected exception remains unapplied. Resolve through materially safer design or informed user approval before completing the route. Search every use of `publishingRetryBlock` and `scheduleApprovedOnce`; prove legacy unknown and recorded uncertain attempts remain protected.
- Missing evidence: one-row/selection fixture behavior, Pending coverage, five rendered design checks and full gate. A9 criteria were accidentally omitted from the bounded audit input; Grok's A9 gap is an input omission, not an established visual defect. Supply them for final audit.
- Provisional observations only: removed outreach lock handling needs bounded tracing; the Content source assertion failure requires reproduction before attributing a regression. Grok's repeated missing-endpoint findings are one blocker, not several independent defects. Removing dispatch guards from status-only approval is intentional; protections belong on the explicit scheduling path.

Result: NOT ACCEPTED. Grok audit ran successfully; no candidate files changed in this audit session. Next action remains resolution of the rejected guard design, followed by implementation repairs and independent closure.

## Repair resume — 2026-09-07

Muxin requested closing Grok findings and raising the previous builder one tier. Use the same `gpt-5.6-terra` model at **high** effort (previous medium); Grok remains independent. Resume the retained candidate. The rejected bypass is still prohibited: design durable evidence distinguishing demonstrably new status-only approvals from legacy unknown-history approvals, with conservative behavior after failures/restarts and unchanged uncertain-attempt protection. Legacy approve→pending→approve cycling, fingerprint changes, concurrency and restart must not launder unknown history into trusted fresh provenance; add explicit regression evidence. If required persistence changes lie outside owned files, return a bounded proposal before editing them. This is an engineering repair, not authorization to schedule legacy unknown-history rows.

Complete every checklist item in the Grok audit section, focused tests and disposable visual/behavior evidence. Do not run the full gate or commit. If the guard design remains technically difficult after reasonable investigation, use `sol_advisor` for guidance rather than guessing. Return a RESULT BLOCK including the exact safety invariant and evidence.

## High-effort repair result — 2026-09-07

Worker `/root/repair_5s_high` used the same `gpt-5.6-terra` model at high effort, escalating one notch from medium as requested. Four retained changed paths are listed in Stopped. Added the Schedule route and corrected stale UI assertions; focused suite 402/0 and A1 HTTP/source cases 2/0. The HTTP test observes no publishing-ledger growth, but the exact dependency-call assertion still needs independent acceptance review. Advisor rejected transition-only provenance because legacy status cycling can manufacture it. Coordinator approved a bounded creation-provenance ownership expansion; automatic approval review rejected its integration with the empty-history guard. Worker removed unintegrated provenance changes; no rejected artifact remains. All original publisher helpers remain unchanged. No browser fixture or fresh Grok closure was run because the known integration blocker remains.

Hygiene for high-effort stop: exit 1 solely for two intentionally retained dirty checkouts. Rescue refs: `refs/wip/content-agents` (`60a4d57`), `refs/wip/content-agents-slice-5s-codex` (`624881e`). No untracked repository paths created or left by this session. Preserve the pre-existing review queue and notes-spread ledger edits, candidate worktree, and existing local-only branches. Coordinator commits only AGENTS guidance plus packet/master documentation.
