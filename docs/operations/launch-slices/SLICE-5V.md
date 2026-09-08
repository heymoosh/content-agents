# SLICE-5V: make Typefully draft creation single-attempt

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

A Typefully draft creation invocation makes at most one draft-create POST, including when
429, 5xx, network errors, malformed responses, or errors containing “processing” occur.
Preserve the existing approval, selected-row, durable-attempt and no-slot draft safeguards.
This closes the 5P preflight retry blocker without live provider calls.

## Difficulty

Hard — a repeated non-idempotent create may duplicate a provider object after an ambiguous response.

## Depends on

5U accepted at 5a442f3. 5P is NOT ACCEPTED; its live verification remains separate.

## Owned files

Parallel-safe: no — one shared creation helper and its production-route tests form one lane.

### Lane A — one-attempt creation and fake outcome proof

- `src/publish/typefully.ts`
- `src/publish/typefully.test.ts`
- Scratch evidence under `/private/tmp/slice-5v-evidence/`.
- Coordinator alone owns this packet, 5P packet status and master updates.

## Do not touch

- Shared retry defaults or other provider behavior, production credentials, live APIs, review status,
  generated content, operational ledgers, `.claude/skills/**`, backlog, GUI or unrelated changes.
- Never clear durable history or claims, broaden dispatch eligibility, schedule or publish.
- No commits or push. Preserve other sessions' edits.

## Cited headings

No master headings. Bounded evidence:
- `/private/tmp/slice-5p-rerun-evidence/current-20260908/grok-result.txt` → retry finding only.
- `src/util/fetch-retry.ts` existing `FetchRetryOptions` and request loop (read-only).
- `src/review/publishing-status.ts` failure classification, durable fence and repeat protection.
- Narrow callers/imports of `createDraft` needed to confirm all uses; report search results.
- `package.json` only for check definitions.

Pre-repair finding, closed by this slice: typefully.ts:155-181 wrapped creation in a catch loop
keyed on `/processing/i`. The API error included response body, so an ambiguous 5xx containing
that word could re-enter the outer loop despite `retryOnNetworkError:false`. The shared wrapper
also retried 429 by default; createDraft now explicitly disables those retries.
Use the existing retry-options interface; do not change shared defaults or invent provider semantics.
Report the media-transcoding tradeoff: callers must see a surfaced failure instead of a hidden create retry.

## Acceptance

- [x] A1 — Exactly one create POST for success and each failure: 429, 5xx with “processing” in
  body, network exception with “processing”, ordinary 5xx, and malformed successful response.
  No catch loop, sleep or wrapper repeats create. Count actual fake fetch POST outcomes.
- [x] A2 — Actual unified CLI `--no-schedule --only-id x-1` still produces one private result
  with provider ID, no plannedFor, no slot claim; second approved row stays untouched.
- [x] A3 — Actual guarded route under ambiguous create failure retains durable duplicate
  protection: a repeated CLI invocation does not issue another create POST. Prove observable state
  and total POST count in isolated fake runtime, rather than asserting a retry option was passed.
- [x] A4 — Existing scheduled text/card callers retain signatures and scheduling semantics;
  shared safe-read/upload retries remain unchanged. Cover all createDraft call sites by bounded search.
- [x] A5 — No live calls, credential reads or operational changes. Focused checks and typecheck
  pass; Grok cross-family audit closes material findings; frozen final repository gate passes.

## Verify

```sh
npm run worktree:setup
node --import tsx --test --test-concurrency=1 src/publish/typefully.test.ts src/publish/unified-cli.test.ts src/review/publishing-status.test.ts
npm run typecheck
git diff --check
```

Use fake fetch and isolated runtime/data in temporary directories. Retain exact commands,
actual exit codes, focused output, outcome JSON, candidate patch and changed paths. No credentials.
Coordinator alone runs once, last after audit closure, on a frozen detached checkout:

```sh
npm run worktree:setup
PATH=/private/tmp/slice-5q-gate-bin:$PATH npm run check
```

Verify existing serial-node shim and run gate unsandboxed. No live canary in 5V.

## Observable result

One attempt yields one draft or an explicit failure. Ambiguous failure cannot cause a duplicate
POST either inside the provider helper or on a repeated guarded CLI attempt.

## Risk

High — audit required: yes. Stop on established adjacent defects; do not widen this repair.

## Families

- Builder: OpenAI Codex Terra xhigh — bounded backend repair, one lane.
- Auditor: xAI Grok 4.5, workspace sandbox, no edits, no subagents or web search.

## Closeout

No separate tool. Coordinator records PASS or actionable leftovers. 5P remains unaccepted;
Chrome exact-ID readback is still a prerequisite for its separate live phase.

## RESULT BLOCK

- Changed paths: `src/publish/typefully.ts`, `src/publish/typefully.test.ts`.
- Outcome: creation uses one POST with no outer processing loop; errors surface. Fake transport
  covers all six outcomes; ambiguous 503 leaves durable uncertain state and a second CLI call
  adds no POST. Shared retry defaults and caller payloads unchanged.
- Checks run and results: focused suite 39/0, exit 0; typecheck exit 0; diff-check exit 0.
  A comment-only clarification followed those checks, then diff-check passed again.
- Evidence locations: `/private/tmp/slice-5v-evidence/` — candidate.diff, source-hashes.txt,
  focused-check.txt, typecheck.txt, create-draft-outcomes.json, a4-create-draft-callers.txt.
- Unresolved: none for 5V; no live calls. 5P awaits Chrome and its separate live proof.

## Accepted closeout

2026-09-08: ACCEPTED. A1–A5 PASS. Grok independent audit PASS, exit 0, no material findings;
verified both source hashes. Frozen unsandboxed `npm run check` passed 4327 tests / 493 suites,
zero failures/skips/cancellations, exit 0. Test duration 815982.915125 ms. Setup exit 0.
The reviewed two-file candidate was unchanged through the gate and coordinator integration.

- Patch SHA256: `7ef8f421b12b14f33c29d5dfbe45f6c480f51df994d7b586a9175983fbc19038`.
- Source SHA256 typefully.ts: `4fac93702d777b38ef2a67d5e861996a34430037a1731bbaf124e28cd1c44f78`.
- Test SHA256 typefully.test.ts: `fe3eabf5170249febc7867792047e0fd5d15dee845ea4371a9f7c1d5fcc90007`.
- Evidence: `/private/tmp/slice-5v-evidence/` — raw candidate.diff, source-hashes.txt,
  focused-check.txt, create-draft-outcomes.json, grok-result.txt/grok-exit.json,
  final-gate.txt/final-gate-result.json, frozen-setup-result.json, protected-hashes.json.
- Optional naming cleanup was not required. Media processing failures surface once for review;
  no silent create retry remains. Shared read/upload retry defaults are unchanged.
- No live provider calls, credential reads, paid generation, scheduling, publishing or push.
  Protected operational hashes match the 5P baseline; preserve all durable history.
- 5P is still NOT ACCEPTED. Reconnect Chrome, recheck x-1 eligibility, then run its audited
  one-draft/readback/delete procedure. This repair does not claim that live proof.

Hygiene: PASS for this session. Precommit rescue exit 1 listed the expected candidate and prior
operational edits; rescue refs: main 4b5cb0e, frozen e2661e0, worker 82dd99d. Both temporary
worktrees (`/private/tmp/content-agents-5v-frozen`, `/private/tmp/content-agents-slice-5v`),
branch `slice-5v-single-attempt`, and `/private/tmp/slice-5v-evidence/candidate/` were removed
after source-hash verification. The worker packet copy was removed with its worktree; the only
new repository path is this canonical packet, included in the coordinator commit. Empty 5P
scratch `current-20260908/isolated-runtime/` was removed. Bounded patch/audit/check evidence remains.

Pre-existing `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`
and `data/notes-spread-ledger.jsonl` edits are preserved and excluded from this commit. Unrelated
merged branches `slice-5q-queue`, `slice-5r-routing` and local-only `agent/cs2-jobs-outreach-charles-extract`,
`agent/cs2-page-room-pure-helpers`, `agent/cs2-serve-walled-room-routes`, `agent/cs3-studio-durable-handoff`,
`agent/cs6-parallel-safe-ui-completion` are left intact. No prunable worktrees were reported.
Final hygiene output: `/private/tmp/slice-5v-evidence/final-precommit-hygiene.txt`; postcommit
status and cleanup evidence remain alongside it. Main stays main; no push.
