# SLICE-5P: prove the posting path with one unscheduled live Typefully draft

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open the master document or load the repository for context. Do not commit.
Status and decisions: `docs/content-studio-master-status.md` → `## START HERE`.

## Goal

Observe one previously atomized, Muxin-approved real source row travel through the production
unified Typefully CLI to a live unscheduled draft; read back that exact draft, delete it, and
verify absence. Nothing schedules or publishes. Preserve operational records and durable attempt
history. This is verification only: record defects and stop; production repairs get a separate slice.

## Difficulty

Hard — live account access, exact single-row selection, durable provenance and cleanup evidence.

## Depends on

5O accepted (migration), 5S accepted at 7c6815f (approval separated from dispatch and durable
first-attempt protection), 5T accepted at e78d2a9 (unified unscheduled draft mode); 5U accepted at 5a442f3 (explicit row selection); 5V accepted (single-attempt creation).

## Owned files

Parallel-safe: no — one sequential live canary against one account and one durable attempt.

### Lane A — preflight, bounded run and evidence

- Scratch evidence under `/private/tmp/slice-5p-rerun-evidence/` (redact credentials).
- This packet's RESULT BLOCK and evidence record, only when the coordinator requests it.
- Coordinator alone owns packet requirements and master updates.

No production code is owned. Preflight is read-only; do not run a provider command or write any
operational record until the coordinator releases the audited live phase.

## Do not touch

- Production source/tests, `.claude/skills/**`, backlog, generated copy and review status.
- Other sessions' changes, including the existing review-queue and notes-spread-ledger edits.
- `data/cost-log.csv`: no paid product model calls; preserve bytes, never truncate or rewrite.
- `data/publish-schedule.jsonl`: preserve bytes; historical SHA256
  `3a1d30a6f0f8093c251b46b75947e8d4a8fbc817e57ea596a3ef8702be25ca58`.
- `data/notes-spread-ledger.jsonl`, `data/community-log.md`, `briefs/bets.md`: preserve bytes.
- Never clear a claim/fence or rewrite attempt history to make the row eligible.
- No scheduling, publishing, Postiz discovery, bulk draft creation, fresh atomization, paid model
  generation, or git push. Workers never commit.

## Cited headings

No master archive heading. Bounded read inputs:

- `docs/operations/launch-slices/SLICE-5T.md` → `## Operator procedure for the later 5P run`.
- `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/`: review-queue.md,
  content-request.json, routing.json if present, source/extract provenance and selected derivative
  only as needed to establish the existing source and exactly one eligible text row.
- `src/publish/typefully.ts`, `src/publish/unified-cli.ts`, `src/review/publishing-status.ts`,
  `src/review/studio-scheduling.ts`, `src/review/approval-provenance.ts`, `src/publish/slots.ts`:
  read only the selection, provenance, draft creation/readback/deletion and ledger interfaces.
  Narrow imports/callers needed to establish those interfaces may be read; report them.
- The repository's exact operational publishing/approval/claim ledgers as resolved by those
  interfaces. Read only records for the selected folder/row; scheduler counts and hashes are allowed.
- Prior evidence `/tmp/claude-501/slice-5p-transcript.md` → stages 1–4, if still available.
  Missing old evidence must be reported, never invented.
- `package.json` only for exact verification command definitions if needed.

## Acceptance

- [ ] A1 — Existing real source and atomization/routing evidence identified. The prior run used
  https://humaninference.ai/essays/the-worlds-broken-what-do-we-do, human-inference, 14 derivatives,
  all six platforms included (Bluesky data; others cold start). Verify retained evidence.
- [ ] A2 — Exactly one eligible Muxin-approved Typefully text row is selected by the actual CLI;
  current approval and dispatch history satisfy shipped safeguards (fresh provenance or the existing
  known-safe prior-failure/reconciliation path).
  If neither current provenance nor supported known-safe retry history establishes eligibility,
  stop without an external call and state
  the supported next action. Never synthesize Muxin approval or bypass the unified route.
- [ ] A3 — Production CLI creates exactly one live draft; retain returned providerObjectId and
  local private event, no plannedFor. There is no retry around createDraft.
- [ ] A4 — Live readback of that exact ID confirms draft/unscheduled state and no scheduled_date
  or other scheduled publication time. Local state and scheduled-only --list are insufficient.
- [ ] A5 — Scheduler claims are unchanged before/after. Migration already ran with 54 claims in
  the prior run; do not demand a new migration or a 55th claim. Draft mode consumes no slot.
- [ ] A6 — Legacy ledger and unrelated operational records are byte-identical before/after;
  cost log unchanged, review queue unchanged. Preserve all legitimate durable canary events.
- [ ] A7 — Delete only the returned canary ID with the existing cancelDraft helper; live readback
  verifies absence. Retain ID and output before cleanup. Do not erase local attempt history.
- [ ] A8 — Every established defect has path:line and reproduction; no production repair here.
- [ ] A9 — Grok preflight safety audit and final evidence audit closed; final frozen gate exit 0.

## Verify

Phase 1, worker read-only: establish A1/A2 with the explicit selector and exact safe create/readback/delete commands; capture
before hashes/counts, CLI selection and provenance evidence with path:line. No credentials in output.
Return RESULT BLOCK and stop for coordinator audit. If no eligible row exists, report precise
supported reconciliation/re-approval options from code, without executing them.

Phase 2, after coordinator audit release: one authenticated workflow canary, at most one retry
for a safe transient read operation. Never retry createDraft after ambiguity, 5xx or lost response.
Use the actual CLI:

```sh
node --import tsx src/publish/typefully.ts content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference --no-schedule --only-id x-1
```

After accepted 5U, --only-id x-1 selects exactly that approved text row. Do not run unless phase 1
establishes its eligibility and no changes invalidate that proof immediately before run. Without
--only-id the command processes all approved text rows; that default is outside this canary budget.
Production credentials may be used only in this released phase; never print or export them to
an auditor. Live draft readback may use authenticated Chrome UI or an existing exact-ID provider
read interface. --list is scheduled-only. Observe unscheduled state before deletion, then absence.
On an ambiguous create result, preserve evidence and stop; do not retry or guess an object ID.
On cleanup failure, preserve exact ID and report the unresolved live object immediately.

Capture before/after hashes and counts with read-only tools for the named operational files and
resolved scheduler ledger. Do not invoke a migrating read helper merely to count; inspect its
behavior first. Audit bounded source excerpts/fake evidence before any live mutation.

Coordinator final gate, only after audit closure, on a frozen detached checkout:

```sh
npm run worktree:setup
PATH=/private/tmp/slice-5q-gate-bin:$PATH npm run check
```

Run unsandboxed. The existing serial-node shim is permitted after verifying its contents. One
final gate; verify exit code. If stopped before live verification with docs-only changes, follow
protocol Stopping without acceptance; do not claim the slice passed or run a costly gate for a stop.

## Observable result

One real reviewed derivative appears in Typefully as an unscheduled draft and then disappears
following exact-ID deletion. Evidence connects source, approved row, durable attempt and provider ID.

## Risk

High — audit required: yes. Grok must distinguish established defects, verification gaps and
optional hardening. A read-only preflight followed by audited release bounds external effects.

## Families

- Builder/operator: OpenAI Codex Terra high, one lane; raise to xhigh only for omitted verification.
- Auditor: xAI Grok 4.5, --sandbox workspace, no edits, no subagents, no web search. Supply only
  criteria, diff/changed paths, focused evidence and bounded excerpts; never secrets or master.

## Closeout

No separate tool. Record PASS or actionable leftovers here; coordinator commits. Not accepted
until A1–A9 are observed. Current phase: stopped before live call on unavailable Chrome readback; 5V retry repair accepted.

## Previous run — diagnostic history, superseded requirements

2026-09-07: stopped before createDraft. A1/A2 observed; migration had already copied 54 claims;
no Typefully draft or new slot. The old unified CLI rejected unscheduled mode; 5T repaired that.
Old GUI approval dispatched automatically; 5S separated approval and dispatch. Three x-1 failures
reported no provider request, but these legacy records must still meet current safeguards; do not
infer eligibility. Old requirements to witness first migration, add a slot or release a draft slot
are retired: the rerun must add zero slots. No provider safety guard is bypassed.
Earlier diagnostics: queue flash repaired separately; analytics brand_id backfill remains a later
slice. Write-protected atomize skill bare-tsx/caption-list corrections still need Muxin and do not
require fresh atomization here. Prior evidence: /tmp/claude-501/slice-5p-transcript.md. Git history
retains the full previous packet; current requirements above replace the retired assertions.

## Stopped

2026-09-08 resumed after 5U: NOT ACCEPTED. Current x-1 selection and eligibility pass,
but the then-current createDraft could repeat POSTs on 429 or errors containing processing.
That blocker is retired by accepted SLICE-5V; the final frozen gate passed 4327/0.
Chrome currently exposes no connected browser, so exact unscheduled readback is also unavailable.
No live create, delete, scheduling or publishing occurred.

Verified: A1 real source/routing and 14 queued derivatives; A2 unique approved x-1 selected by
--only-id, supported prior pre-dispatch failed history, no active claim, retryBlock null.
Missing newer journal does not invalidate those known-safe failed retries. Both x-1 and x-2
approvals are preserved. Focused fake-provider check: 20 tests passed, exit 0. All protected hashes
unchanged; scheduler still 54 records. Grok audit and source-gap closure HOLD, both exit 0; source review confirmed the outer
processing loop can retry ambiguous 5xx/network errors. Selector and eligibility evidence closed. The earlier folder-wide selection blocker is retired by accepted 5U.

Retained work: `/private/tmp/slice-5p-rerun-evidence/current-20260908/` contains preflight,
actual source excerpts, focused check metadata/outcome, safe procedure and Grok findings.
Single next action: reconnect Chrome, then recheck eligibility before releasing
one live draft/readback/delete. No costly repository-wide gate for this verification stop.

## RESULT BLOCK

- Changed paths: this packet's status; coordinator also owns 5V packet and master updates.
- Outcome: NOT ACCEPTED; no provider call. Creation retry repair delegated as 5V.
- Checks run and results: real read-only eligibility predicates pass; focused Typefully tests
  20/20, exit 0; protected hashes and scheduler counts unchanged. The pre-repair Grok HOLD
  identified the retry defect; accepted 5V closes it. Chrome readback and live proof remain pending.
- Evidence locations: `/private/tmp/slice-5p-rerun-evidence/current-20260908/`.
- Unresolved: connected Chrome, then live A3–A7 and final audit/gate. 5V is accepted.
