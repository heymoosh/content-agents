# SLICE-5T: explicit unscheduled Typefully drafts through the unified route

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Repair the command path that stopped 5P: an explicitly requested unscheduled Typefully draft
must travel through the unified publishing route, require a reviewed/approved row, and create
no scheduled or auto-posting object. Ordinary scheduling remains unchanged. This slice delivers
the repair and isolated fake-provider proof; a later 5P run supplies live authenticated proof.
Do not replace the unified route with a one-off direct createDraft script.

The prior 5P finding: src/publish/typefully.ts rejected --no-schedule and TYPEFULLY_SCHEDULE=off;
unified-cli.ts and the authoritative publishing-status wrapper offered no unscheduled mode.
5S is now accepted: approval only changes review state; explicit dispatch consumes a durable
first-attempt capability before external work. Legacy unknown history remains blocked.

## Difficulty

Hard — draft intent must survive command parsing, provider routing, dispatch protection and
persisted outcomes without being converted into a scheduled post or a repeatable attempt.

## Depends on

5S accepted at 7c6815f; 5O accepted. This is the bounded repair needed before rerunning 5P.

## Owned files

Parallel-safe: no — single lane. Command intent, provider payload and durable state must agree.

### Lane A — unified draft mode

- src/publish/typefully.ts and src/publish/typefully.test.ts
- src/publish/unified-cli.ts and src/publish/unified-cli.test.ts
- src/review/publishing-status.ts and src/review/publishing-status.test.ts
- src/review/studio-scheduling.ts and src/review/studio-scheduling.test.ts (approved router intent propagation)
- src/review/approval-provenance.test.ts for affected safety regression if needed
- src/publish/reply-approval-gate.test.ts for confirmed direct-caller regression
- src/publish/delivery-policy.test.ts and src/publish/all.ts, src/cron/notes-daily.ts (bounded caller verification only; no production edits)
- Disposable fixtures and evidence under /private/tmp/slice-5t-evidence/

Coordinator owns this packet and the master status document. Before implementing, trace only
these files and narrowly necessary imports/callers. Return a bounded proposal naming any extra
files required (provider interface, router, ledger types, etc.), the exact public CLI syntax,
state representation, and focused commands. The coordinator may extend ownership based on that
produced evidence. Do not invent a parallel ledger or bypass the authoritative dispatch wrapper.
You are not alone in the codebase. Preserve other sessions' changes; never revert them.

## Do not touch

- Real content/, review queues, operational data/, real HOME ledgers or credentials.
- .claude/skills/**, backlog, GUI page layout, or unrelated provider behavior.
- No real authenticated canary, paid model call, provider discovery, draft creation, schedule,
  publishing, cancellation or credential read. Tests must inject fake network/providers and
  isolate HOME, queues, ledgers, ports and environment.
- No provider fallback that can create a scheduled object from draft intent.
- No approval/status automation for real rows; only Muxin approves content.
- No history/provenance bypass for legacy approved rows or uncertain prior attempts.
- No worker commits, full repository gate, repo-wide rewrite commands or push.

## Cited headings

none. The predecessor findings and necessary constraints are reproduced here.

## Acceptance

- [x] A1 — Explicit unscheduled CLI intent is accepted and propagated through the unified route.
      Define and test --no-schedule behavior and TYPEFULLY_SCHEDULE=off compatibility. Invalid or
      conflicting scheduling intent fails before external calls; normal scheduled mode is unchanged.
- [x] A2 — A fake-network end-to-end run of the production command route on an approved fixture
      creates exactly one Typefully draft. Inspect the actual request payload: unscheduled status,
      no scheduled_date or next-free-slot value. A flag/argument-only assertion is insufficient.
- [x] A3 — Draft mode selects only a provider capable of an unscheduled Typefully draft. It cannot
      silently fall back to Postiz or a scheduled provider, and does not perform irrelevant provider
      discovery. Unsupported platforms/modes refuse before an external write with a useful reason.
- [x] A4 — Pending/revise/discard fixture rows make zero provider calls. Approval remains status-only.
      Fresh dispatch uses the same durable claim/fence as 5S, before any external write; repeated,
      concurrent or restarted calls and ambiguous provider/terminal-save failures cannot create a
      second object. Legacy unknown history and malformed/uncertain history still refuse.
- [x] A5 — Persist the returned draft id and an honest unscheduled outcome using the existing
      publishing-state architecture. Do not claim scheduled/published success. An existing draft
      must block another create through both draft and ordinary schedule entry points unless the
      existing exact-attempt reconciliation proves no remaining external object. Never automatically
      convert, cancel or reschedule an existing draft in this slice.
- [x] A6 — An unscheduled draft does not consume an automatic posting slot. Tests establish no
      production ledger mutation and no leftover fixture slot claims. Preserve successful provider
      output when local validation/persistence fails; report ambiguity without automatic retries.
- [x] A7 — Focused command/provider/state tests and relevant 5S safety regressions pass. Capture
      exact commands, exit codes and fake end-to-end request/result evidence. No real providers used.
- [x] A8 — Document the runnable unscheduled command, eligibility requirements, cleanup/readback
      procedure available to the later 5P operator, and any supported limitations here. 5P remains
      unaccepted; it must re-check live evidence and adapt its obsolete extra-slot/migration premise.

## Verify

Initial bounded command (extend only for authorized changed files and necessary regressions):

```
node --import tsx --test --test-concurrency=1 src/publish/typefully.test.ts src/publish/unified-cli.test.ts src/review/publishing-status.test.ts src/review/approval-provenance.test.ts
```

Run focused checks unsandboxed because tsx uses a socket. Use fake providers and isolated scratch
state. Add an observable fake-network end-to-end fixture through the real command route, not a
mock of the authoritative scheduler. Record request bodies, callback counts, persisted outcomes
and before/after fixture slot state without secrets. Run typecheck. Coordinator freezes the
Grok-cleared candidate and runs npm run check unsandboxed once, last, after all repairs close.
Fresh worktree requires npm run worktree:setup once. Existing serial test runner workaround may
be used and recorded. No GUI change is planned; if a GUI change becomes necessary, propose it
before editing and add the rendered design checks before acceptance.

## Observable result

The documented command creates an unscheduled Typefully draft from an approved eligible row
through the normal unified safety path. Its local result identifies the draft without claiming it
will post. The subsequent 5P run can verify this against the live service under its own budget.

## Risk

High — audit required: yes. Review payload intent, provider selection, fail-closed history,
pre-dispatch durability, and cross-mode duplicate prevention. Grok must separate established
defects, missing evidence and optional improvements, cite path:line, and never modify files.

## Families

- Builder: OpenAI Codex gpt-5.6-terra, xhigh effort after omitted-verification escalation, one lane. Suitable backend model below highest tier.
- Auditor: Grok 4.5, CLI --sandbox workspace --no-subagents; no file edits. Never grok_spawn_readonly
  on this Mac: Docker Desktop's /var/run/docker.sock symlink prevents read-only sandbox startup.

## Closeout

No closeout tool. **PASS / ACCEPTED**: A1-A8 verified; Grok independent closure PASS; frozen
unsandboxed full gate 4326 tests / 0 failures / exit 0. See Accepted closeout below. Stop at
acceptance; do not start the live 5P canary.

## RESULT BLOCK

- Changed paths: src/publish/typefully.ts and .test.ts; src/publish/unified-cli.ts;
  src/review/publishing-status.ts and .test.ts; src/review/studio-scheduling.ts and .test.ts;
  src/review/approval-provenance.test.ts. Coordinator: this packet and master status.
- Outcome: explicit unified unscheduled Typefully mode; durable private/id result and duplicate
  refusal across modes; no slot claims or Postiz discovery. Legacy direct helper behavior retained.
- Checks run and results: repaired focused 77/0, typecheck 0, diffcheck0; independent Grok closure0;
  frozen full gate 4326/0, exit 0. Diagnostic earlier missing-setup run is not passing evidence.
- Evidence locations: /private/tmp/slice-5t-evidence/; exact files in Accepted closeout.
- Unresolved: no 5T blockers. Live 5P proof remains separate; legacy unknown-history rows refused.

## Approved engineering design

Bounded builder trace identified studio-scheduling as the existing provider router. Ownership
extends to it and its test. Carry explicit draft intent through unified CLI, the authoritative
scheduleApprovedOnce fence, and scheduleApproved. Typefully text drafts only; unsupported kinds
refuse and cannot silently schedule. Reuse existing `private` state for an observed
`autoPublishes: false` draft, record its providerObjectId, and omit planned time. Existing private
state and consumed claim must block duplicate creation through either mode. No new ledger schema
or parallel dispatch path. Existing publishText noSchedule behavior skips slot claims.

Operator syntax: `node --import tsx src/publish/typefully.ts <content-folder> --no-schedule`;
compatibility `TYPEFULLY_SCHEDULE=off` with the same command. Verify actual command parsing as well
as production function routing and outbound fake-network payload. Use pinned fake account
configuration to avoid unrelated discovery. Inspect supported flags and reject explicit conflicting
intent before external calls. Include studio-scheduling tests in focused commands. Builder remains
Terra high; this is an ownership clarification, not an effort/model escalation.

## Audit and repair checklist

Grok source audit exit 0: A1-A6 supported. A7 blocked by incorrectly reported frozen focused output;
coordinator reproduced missing tsx, ran worktree:setup exit 0 and actual frozen focused 59/0 +
typecheck exit 0, captured in frozen-focused.txt and coordinator-focused-result.json. The earlier
failed output remains diagnostic, never passing proof. A8 operator documentation is below and
will be included in integration diff. Independent closure subsequently passed; see Accepted closeout.

Bounded caller trace found an existing direct publishText noSchedule test failing because the new
branch left its queue row approved. The only production caller is studio-scheduling; notes-daily
comments were stale. Preserve direct helper compatibility: scope deferred local completion to the
unified draft router, which owns the durable private result; direct legacy noSchedule helper calls
keep their existing completion behavior. Do not add another dispatcher/fence or broaden into cron.
Reproduce reply-approval-gate failure, repair through an explicit narrow option passed by the
unified router, and prove both legacy direct behavior and unified private/id/no-queue-mutation.
Search every publishText/noSchedule use. Add private-to-private repeated-create refusal alongside
existing private-to-scheduled case. Correct touched stale comments. Run all affected focused tests
including reply-approval-gate and delivery-policy. Retain stdout/stderr and exact exit codes via
subprocess capture; inspect actual output before reporting. Escalate same Terra high → xhigh for
omitted caller verification and incorrect check record; Grok remains independent.

## Operator procedure for the later 5P run

- Command: `node --import tsx src/publish/typefully.ts <content-folder> --no-schedule`.
  Compatibility: `TYPEFULLY_SCHEDULE=off node --import tsx src/publish/typefully.ts <content-folder>`.
- The command considers approved Typefully text rows in that folder. A later one-row canary must
  establish that exactly one eligible approved row is selected before invoking it. Approval alone
  is insufficient: trusted current creation/approval provenance or supported exact reconciliation
  is required; legacy unknown history, private/planned/uncertain attempts remain refused.
- Retain printed Typefully draft id and local `private` event/providerObjectId with no plannedFor.
  Inspect that exact id/title `<rowId> (content-agents)` in Typefully UI and confirm unscheduled
  live state. `--list` enumerates scheduled drafts and cannot establish unscheduled readback.
- The later authorized operator cancels only the observed canary id with existing `cancelDraft`
  (`src/publish/typefully.ts`) and verifies absence live. No automatic cleanup, conversion or
  retry is added here. Reconcile the exact local attempt only after verified provider absence;
  never clear a fence merely because local history is missing. On terminal persistence failure,
  retain the returned id in the error and investigate that exact object before any retry.
- Draft mode claims no posting slot. Before rerunning 5P, revise its historical 54+1 slot claim /
  first-migration premise: the migration already ran, and the repaired draft must add no slot.
  Preserve the legacy ledger and operational records byte-identically. 5P is still not accepted.
- 5T uses only fake providers. It neither authorizes nor performs this later live canary.

## Accepted closeout

Coordinator accepts SLICE-5T on 2026-09-07. A1-A8 PASS. Independent Grok 4.5 source/behavior audit
and follow-up closure used --sandbox workspace with no file edits; both processes exited0.
Initial A7 evidence mismatch and A8 documentation gap were closed with actual captured output
and persisted operator instructions. The confirmed direct-helper compatibility regression was
repaired by the same Terra builder at xhigh (high → xhigh for omitted checks), reviewed by Grok.
No remaining established defects. Optional older scheduled-only module-header prose is not the
operator procedure; no GUI changed and no rendered review was needed for this backend slice.

- Repaired focused command: node --import tsx --test --test-concurrency=1
  src/publish/typefully.test.ts src/publish/unified-cli.test.ts
  src/review/publishing-status.test.ts src/review/approval-provenance.test.ts
  src/review/studio-scheduling.test.ts src/publish/reply-approval-gate.test.ts
  src/publish/delivery-policy.test.ts. Actual captured 77 pass / 0 fail / exit 0; typecheck exit 0.
- Final gate: detached /private/tmp/content-agents-5t-frozen based on 7c6815f;
  worktree:setup exit 0, then PATH=/private/tmp/slice-5q-gate-bin:$PATH npm run check unsandboxed
  once after audit closure. Serial Node shim retained from 5S. Exit0; 4326 tests / 493 suites,
  4326 pass / 0 fail / 0 skip; wall 570.36s. All 8 source hashes unchanged after gate.
- Final reviewed patch SHA256: 88a10fd831cc7c103e4707d4351383839ef736ae89c45995f0543b3bd76393a4.
- Evidence /private/tmp/slice-5t-evidence/: candidate.patch, source-hashes.json,
  focused-repair.{stdout,stderr,result.json}, typecheck-repair.{stdout,stderr,result.json},
  typefully-fake-e2e.json, grok-audit-result.txt, grok-closure-result.txt,
  operator-procedure.md, final-gate.txt and final-gate-result.json. Earlier failed focused-final.txt
  is retained as diagnostic, with corrected metadata; it was not used as final passing proof.
- No real providers, live drafts, publishing, paid model calls for product workflows or push.
  Next: refresh 5P packet's retired slot/migration expectations and one-row eligibility/readback
  procedure, then run its separately bounded live proof. 5P remains not accepted.

Hygiene disposition: this session's new repository artifact is docs/operations/launch-slices/SLICE-5T.md,
included with the eight source/test changes and master update. Preserve existing operational edits
in content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md and
data/notes-spread-ledger.jsonl, and unrelated local branches. After commit, remove the two
byte-verified disposable 5T worktrees and redundant snapshot source copies; retained patch, hashes,
check/audit output and fake-provider evidence remain outside the repository. Hygiene details follow.

Precommit hygiene exit 1 enumerated only the reviewed candidate in main/two worktrees, this new
packet, the two pre-existing operational edits, and existing local branches. Rescue snapshots:
main 57ffc2b, frozen 02ea0b0, builder 629aed5. All are intentionally accounted for above; no owner
decision is needed. Commit only the accepted slice paths, then remove its redundant worktrees.
