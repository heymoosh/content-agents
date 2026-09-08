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

One worker owns CLI/ledger evidence; coordinator browser preparation ran independently in separate scratch paths. The create → exact-ID readback → deletion → absence steps are serialized because each consumes the preceding observed provider result. A second preparation worker would duplicate the bounded existing-source check without a useful independent deliverable.

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

- [x] A1 — Existing real source and atomization/routing evidence identified. The prior run used
  https://humaninference.ai/essays/the-worlds-broken-what-do-we-do, human-inference, 14 derivatives,
  all six platforms included (Bluesky data; others cold start). Verify retained evidence.
- [x] A2 — Exactly one eligible Muxin-approved Typefully text row is selected by the actual CLI;
  current approval and dispatch history satisfy shipped safeguards (fresh provenance or the existing
  known-safe prior-failure/reconciliation path).
  If neither current provenance nor supported known-safe retry history establishes eligibility,
  stop without an external call and state
  the supported next action. Never synthesize Muxin approval or bypass the unified route.
- [x] A3 — Production CLI creates exactly one live draft; retain returned providerObjectId and
  local private event, no plannedFor. There is no retry around createDraft.
- [x] A4 — Live readback of that exact ID confirms draft/unscheduled state and no scheduled_date
  or other scheduled publication time. Local state and scheduled-only --list are insufficient.
- [x] A5 — Scheduler claims are unchanged before/after. Migration already ran with 54 claims in
  the prior run; do not demand a new migration or a 55th claim. Draft mode consumes no slot.
- [x] A6 — Legacy ledger and unrelated operational records are byte-identical before/after;
  cost log unchanged, review queue unchanged. Preserve all legitimate durable canary events.
- [x] A7 — Delete only the returned canary ID with the existing cancelDraft helper; live readback
  verifies absence. Retain ID and output before cleanup. Do not erase local attempt history.
- [x] A8 — Every established defect has path:line and reproduction; no production repair here.
- [x] A9 — Grok preflight safety audit and final evidence audit closed; final frozen gate exit 0.

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
an auditor. Live draft readback may use an authenticated browser UI or an existing exact-ID provider
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
until A1–A9 are observed. PASS: A1–A9 observed. SLICE-5P ACCEPTED; no retained live canary draft.

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

## Live evidence — 2026-09-08

The earlier browser blocker is retired: Playwright connected and the owner signed in. The old
5V create-retry blocker remains closed. Current preflight matched HEAD 5d829cd and accepted
5V source/focused evidence (39/0, six single-POST fake outcomes); no production changes.

Read-only API discovery returned exactly one social set, 314868 Muxin Li. Authenticated browser
settings showed #314868, X @heymoosh and Human Inference-linked accounts. Grok's first review
released discovery only and held creation for evidence; closure review accepted this observed
identity binding and actual numbered source/ledger excerpts, then RELEASED one canary, exit 0.
For this run only, both create and cleanup used process-local
CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID=human-inference/typefully and TYPEFULLY_SOCIAL_SET_ID=314868.
No .env changes or new approval were made.

One actual --no-schedule --only-id x-1 CLI invocation succeeded, exit 0, returning draft
10682647. The local ledger appended uncertain then private; final event
a31fa1ab-6aad-491b-a53f-1761f77eebc2 retains providerObjectId 10682647 with no plannedFor.
Authenticated browser Drafts response matched that exact ID/title/account and showed status 0,
scheduled_date null, scheduled_natural_posting_time_enabled false and universal_published_on null.
Only X was enabled. Existing cancelDraft(10682647) then succeeded once, exit 0.
A fresh complete browser Drafts response returned the original four IDs, no 10682647.
No retry, scheduling, publishing, paid generation, or other draft deletion occurred.

Scheduler remains 54 claims. All protected repo bytes, both approvals and the unrelated x-2 row
are unchanged. The legitimate local publishing ledger now has seven events; its private record
is retained even after remote deletion, so repeat dispatch stays blocked. Do not clear history.

Evidence directories:

- Worker: /private/tmp/slice-5p-rerun-evidence/browser-20260908/ (preflight, actual source bodies,
  operator procedure, create-result.md, cleanup-result.md).
- Coordinator: /private/tmp/slice-5p-rerun-evidence/browser-coordinator-20260908/ (account match,
  live-readback.json, live-absence.json, before-hashes.json and Grok verdicts).
- Prior diagnostic evidence: /private/tmp/slice-5p-rerun-evidence/current-20260908/.

## RESULT BLOCK

- Changed paths: this packet and coordinator-owned master status only; no production changes.
- Outcome: ACCEPTED; A1–A9 observed.
- Checks: one CLI create and one exact-ID helper deletion exit 0; authenticated browser verifies
  unscheduled draft then absence; all protected hashes match and scheduler is 54.
- Evidence: directories above; Grok preflight closure RELEASE and final evidence PASS, both exit 0.
- Final frozen unsandboxed npm run check: exit 0, 4327 tests passed, 493 suites, zero failures;
  559.879 seconds wall time. setup ran once, exit 0.
- Unresolved: no slice blocker. Unrelated work is preserved as listed in Accepted closeout.

## Accepted closeout

2026-09-08: PASS. Grok final evidence audit found no established defects or material gaps.
The audited frozen candidate at base 5d829cd passed the single unsandboxed repository gate:
4327/4327 tests, 493 suites, no failure/skip/cancel, exit 0. No production edits or extra live
canary. Builder/operator was Codex Terra xhigh; coordinator handled browser verification and
integration; xAI Grok 4.5 supplied independent audits with --sandbox workspace and no edits.

The temporary detached checkout /private/tmp/content-agents-5p-browser-frozen was removed only
after matching its exact reviewed patch; no branch was created. Its patch, source hash, setup and
gate outputs remain in coordinator evidence. Four bounded browser snapshots moved there; six
transient navigation snapshots and four console logs were deleted, then empty .playwright-mcp/
was removed. Every individual source path/disposition is in browser-artifact-cleanup.json.
No session-created untracked repository path remains. Scratch evidence remains outside the repo.

Unrelated edits preserved and excluded from this commit:

- AGENTS.md
- docs/operations/launch-slices/SLICE-TEMPLATE.md
- content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md
- data/notes-spread-ledger.jsonl

Hygiene --rescue returned 1 because it lists the candidate and preserved unrelated work;
rescue snapshot 7756d4b protects the precommit state. No prunable worktrees or untracked repo
paths remain. Existing branches slice-5q-queue and slice-5r-routing are left intact, as are local
work branches agent/cs2-jobs-outreach-charles-extract, agent/cs2-page-room-pure-helpers,
agent/cs2-serve-walled-room-routes, agent/cs3-studio-durable-handoff and
agent/cs6-parallel-safe-ui-completion. These belong to other work, not a 5P blocker.
Exact hygiene output is retained in coordinator evidence.
Do not push or restart this canary; its local private history is deliberately retained after deletion.
Next plan work: durable per-piece X opt-in (5R A6), then analytics brand_id backfill.
