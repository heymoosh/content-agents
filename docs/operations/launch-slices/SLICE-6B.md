# SLICE-6B: Close two isolated 5O follow-ups

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this packet only.
Do not load the repository for context. Workers never commit.

## Goal

Verify and close accepted 5O unresolved items 2 and 4: queue-view must not tell users that the
retired repository ledger is the active destination, and the free-render cost assertion must
observe actual child-side logging rather than only inherited arguments. Check current source
first: historical findings are not proof that the present code is defective.

## Difficulty

Hard — bounded child-process outcome/isolation proof; queue text is a small independent fix.

## Depends on

5O and 5Z accepted; 6A reconciliation identified these as bounded source-check candidates.
Pinned runtime base `b74c8898b086dad41694f4c47755362b8b6fe41e`.
No active worker ownership is reassigned. Source-check checkpoint precedes implementation.

## Owned files

Coordinator owns this packet, master and integration. Workers initially own evidence only.
All initial source reads use `git show b74c8898b086dad41694f4c47755362b8b6fe41e:<path>`.
Implementation starts only after coordinator records exact ownership and frozen base checkout.

### Lane A — queue ledger-path truth

- Own `/private/tmp/slice-6b-evidence/queue/` for initial source/check plan.
- Read `src/publish/queue-view.ts`, `src/publish/queue-view.test.ts`, `src/publish/slots.ts`,
  `src/runtime/data-root.ts`, `package.json`; limited to ledger path, queue rendering and relevant
  tests/commands. If a named test path does not exist, report that; no broad tree search.
- Deliver exact current path:line, whether historical issue remains, minimal owned source/test
  paths for a fix, and fixture-only command proving actual visible output from current data-root
  configuration. Do not mutate real scheduler state or run provider work.
- Focused initial check: source evidence and immutable hashes, no execution before isolation plan.
- Handoff: source finding and proposed focused check. Wait for coordinator before edits.

### Lane B — render-child cost assertion

- Own `/private/tmp/slice-6b-evidence/render/` for initial source/check plan.
- Read `src/review/configured-media-runtime.test.ts`, `src/util/cost-log.ts`,
  `src/util/cost-log.test.ts`, `package.json`. Exact-symbol search in `src/review/` for the
  render command invoked by that test is allowed, followed only to its definition and referenced
  renderer entrypoint. No repository-wide context or unrelated callers.
- Deliver current path:line proof, exact test-only ownership and isolation plan for observing a
  deliberate fixture child log row alongside the free-render outcome. Use real Node child process
  and real logging helper, isolated explicit HOME/data/cost/temp roots and no live model/providers.
- Preserve production behavior. No production seam merely for convenient verification.
- Focused initial check: source evidence and immutable hashes; no implementation/execution yet.
- Handoff: source/check plan plus exact additional cited paths if required. Wait before editing.

Parallel-safe: A/B write disjoint evidence, no repo-wide rewriting, read pinned immutable inputs.
Shared runtime code is read-only. Implementation/check ownership is decided at completed initial
checkpoint; actual candidate verification waits for frozen handoff. Conflicting edits and full
gate are serialized. No duplicated inventory: A owns user-visible path, B owns process proof.

## Do not touch

- Other source/tests, real cost log, provider/scheduler/analytics data, content, credentials,
  approvals, backlog or other sessions' changes. No real publishing or model canaries; never 5P.
- No broad refactor, scheduler migration or production logging change.

## Cited headings

- `docs/operations/launch-slices/SLICE-5O.md` → `## RESULT BLOCK`, unresolved 2 and 4.
- `docs/operations/launch-slices/SLICE-5Q.md` → `## RESULT BLOCK` (page-only scope).
- `docs/operations/launch-slices/SLICE-5Z.md` → `## RESULT BLOCK` (job-chain proof retained).
- Named bounded source paths above. No master archive.

## Acceptance

- [x] A1: Present-source status established for each historical item with exact citations.
- [x] A2: Queue user-visible ledger location agrees with the actual configured destination;
      actual isolated output proves it; no production scheduler changes.
- [x] A3: Render test observes real child-side log output through the shared isolated log;
      free-render outcome remains cost-free and child/process/temp cleanup is bounded.
- [x] A4: Actual affected tests pass and material findings receive independent closure.
- [x] A5: Frozen final runtime gate, preservation, hygiene and coordinator integration pass.

## Verify

Meaningful behavior/high risk for subprocess test machinery; queue output is low-risk copy.
One bounded Claude audit of combined ready candidate before runtime gate. Initial checkpoint
pins exact commands from existing tests. Full unsandboxed `npm run check` once after closure,
on detached frozen checkout; fresh worktree setup once first. No live canary is necessary.
UI/browser: not applicable if queue-view is CLI output only; prove real emitted output. If a
browser surface is affected, stop that lane at checkpoint for exact journey requirements.

## Observable result

Queue instructions tell the truth about the scheduler ledger, and child-side cost logging is
covered by exercised outcome proof rather than a structurally plausible assertion.

## Risk

Medium — audit required for child-process isolation/cleanup machinery and combined capability
boundary. Coordinator reviews queue copy and actual output. Claude Sonnet medium effort for the
bounded candidate, with path:line; delta closure only for material repairs. Preserve accepted
5O/5Q/5Z findings and checks; no repeat audits. On outage retain review-blocked candidate and
continue independent authorized checks, never integrate without independent closure.

## Families

- Lane A: Codex Terra high for bounded source/copy work.
- Lane B: Codex Terra high for bounded child execution/isolation proof; raise one effort tier if omissions emerge.
- Auditor: Claude Sonnet medium; if Claude builds any repair, Codex independently closes that repair.

## Closeout

PASS — focused checks, independent closure and frozen full gate passed. Hygiene disposition
below records preserved leftovers. Only coordinator commits; no push.

## RESULT BLOCK

- Changed paths: `src/publish/queue-view.ts`, `src/publish/queue-view.test.ts`,
  `src/review/configured-media-runtime.test.ts`, this packet, master START HERE/progress.
- Outcome: accepted. Queue displays the active ledger; real fixture child cost logging is observed.
- Checks: queue 11/11, render 32/32; Claude initial PASS plus required R1 delta PASS;
  frozen unsandboxed check exit 0, 4347 tests / 494 suites, zero failures/cancelled/skips/todo.
- Evidence: `/private/tmp/slice-6b-evidence/`; manifests, raw TAP, Claude prompts/verdicts and gate exit.
- Unresolved: none blocking 6B. Optional extra credential/stderr controls retained as optional.

## Queue source-path correction checkpoint

Lane A paused after pinned package.json identified `src/publish/queue-view.ts` as the actual
entrypoint; the historical report had guessed `src/review/`. Corrected named renderer/test paths
to `src/publish/queue-view.ts` and `src/publish/queue-view.test.ts`. Same evidence ownership,
no implementation yet. Missing-file observation is not an engineering blocker or owner decision.

## Implementation checkpoint — source lanes completed

A confirmed the stale visible header at queue-view.ts:346; B confirmed env-only probe at
configured-media-runtime.test.ts:147–178/252–260. Source reports retained under queue/ and render/.
Both workers completed before this ownership update. No production cost defect is alleged.

- A now owns `/private/tmp/content-agents-6b-queue/src/publish/queue-view.ts` and
  `src/publish/queue-view.test.ts` in that checkout, its queue evidence directory and test-owned
  unique fixture roots. Correct stale comments/header via actual `ledgerPath()`, no scheduler
  semantics change. Add real CLI output proof with explicit isolated data/HOME/cwd/temp, seeded
  canonical fixture ledger, allowlisted environment and no credentials/provider requests.
  Command: `node --import tsx --test src/publish/queue-view.test.ts`.
- B now owns only `/private/tmp/content-agents-6b-render/src/review/configured-media-runtime.test.ts`,
  its render evidence directory and existing/new test-created fixtures in that dedicated checkout
  or unique temp root, all removed in finally. Add separate real Node fixture child calling the
  real `logCost` helper and assert the CSV row and free result/assets. Preserve the existing
  no-row free-render test. Command: `node --import tsx --test src/review/configured-media-runtime.test.ts`.
- B may read `src/review/configured-media-runtime.ts` at defaultConfiguredMediaRenderer and
  `src/video/render.ts` at renderStill, discovered by its authorized symbol/entrypoint trace.
- Both use immutable b74c889 runtime inputs; setup already passed once in each checkout. No
  production render/cost changes. Capture raw commands/output/exit, changed-file hashes and
  cleanup. Use bounded child timeouts, absolute Node, no installed provider/model commands.
- Separate checkouts ensure queue enumeration cannot read the render lane's changing fixture
  content. No shared writes, no repo-wide rewriting commands; checks depend only on own changed
  files and pinned base runtime. No full gate/typecheck in parallel lanes; coordinator runs final
  typecheck through the combined gate after audit closure.
- Frozen completed handoffs only; coordinator combines three files in a separate detached
  verification checkout and obtains Claude review. No worker commits.

## Pre-audit review checkpoint

Both initial focused suites passed (queue 11, render 32). Coordinator requested two bounded
same-owner refinements before freezing: remove remaining fresh-worktree-empty wording from the
queue source/output because canonical data is shared, and use a firm SIGKILL timeout for fixture
children instead of a TERM-only shell watchdog. Worker ownership stays unchanged; no full gate
or external audit has begun. Operational preservation hashes remain equal to the baseline.

## R1 — queue test repository-env isolation (audit follow-up)

Claude Sonnet medium audit PASS exit 0 at initial combined manifest, with one visibility gap:
`src/util/env.ts` was omitted. Coordinator supplied bounded source inspection and established
that it loads `<repoRoot>/.env` regardless of cwd. Existing isolated-checkout test passed because
no `.env` was present there; it does not prove safe execution from a user's normal checkout.
This is a material verification/isolation omission. No full gate has run and no runtime candidate
is accepted. Retain settled queue destination and render-child findings; delta review required.

Previous Lane A worker completed and paused. Reassign only queue test ownership to Codex Terra
xhigh (raised one notch from high for omitted verification):
- `/private/tmp/content-agents-6b-queue/src/publish/queue-view.test.ts` and queue evidence/fixtures.
- Queue source is frozen, no edits needed; render source/test remain frozen and unowned by R1.
- Additional bounded read-only inputs: `src/util/env.ts` entirety and `src/db/db.ts` ROOT/repoRoot
  definitions only; queue-view provider-credential checks in the already named source.
- Fix invariant: executing the real CLI in this test cannot read the user's actual repository
  `.env` or contact providers, even when that file exists. Explicitly exercise the condition with
  fixture-only input, never write/rename/read a real `.env`. Test-local preload/interception for
  the exact env-read boundary is allowed; no production seam or source behavior change.
- Keep real queue entry and ledgerPath output assertion. Assert no provider request was attempted;
  check every referenced provider credential use in queue-view. Do not copy the entire repository
  or add a generic harness. All new files under the unique test fixture root, removed in finally.
- Focused command unchanged; capture actual TAP/exit and frozen hash. Return only completed result,
  then independent Claude delta closure receives this finding, source excerpt, changed test and
  actual evidence. No repeat settled full audit.

## R1 frozen handoff

Queue test SHA256 `a4710389f61d92cc5f79bc669a10cd29faf633b817df3b994f3dab9383cceed3`.
Focused queue command exit 0, 11 tests / 3 suites; raw output `queue/r1-queue-view.tap`.
A narrow child module loader intercepts only env.ts's node:fs import and substitutes a fixture
for the exact repository .env request. Receipts prove the read was substituted, the real env
parser consumed the fixture sentinel, and no fetch was attempted. Real CLI output still names
the configured canonical ledger and all providers report credentials absent. Actual .env files
were never touched by this child test. Queue source and render test remain at initial audit hashes.

Render focused evidence remains 32/32 PASS; no rerun for unrelated queue changes. Its five-second
inner spawnSync uses SIGKILL. The outer ten-second node:test timeout is a test budget, not a
separate process-kill guarantee; prior audit wording is corrected here. The optional suggestion
to fail the fake shell earlier on child nonzero remains optional; observable CSV assertions
already detect absent child output. Claude delta closure is pending, then the frozen final gate.

## Independent closure — 2026-09-08

Initial Claude Sonnet medium audit PASS, exit 0, 90.99s. Actual `claude-sonnet-5`; CLI also
reported Haiku auxiliary usage. Retained `coordinator/claude.stdout.json`, `.exit.json`, exact
prompt and initial manifest. Coordinator investigated its env-loader visibility gap and required
R1; initial PASS alone was not used as integration proof.

Claude Sonnet medium delta closure PASS, exit 0, 106.85s, actual `claude-sonnet-5` plus Haiku
auxiliary usage. Exact prompt/result/exit under `coordinator/claude-delta-*`; final manifest
`coordinator/candidate-manifest.json`. Reviewer independently closed exact env-read substitution,
real parser consumption, no fetch attempts, cleanup and queue SIGKILL timeout. No established
defects remain. Coordinator verified manifest hashes and three-file scope from frozen files.

Supported dispositions: warning-free stderr is not required for the observable CLI outcome;
receipt assertion detects missed/substituted reads regardless of warnings. Supplying fake provider
keys to force network attempts is optional and outside this zero-provider fixture's goal. Exact
interception prevents actual .env access; receipt proves fixture parsing. No provider/canary run
is necessary. Initial settled render/copy outcomes retained. Full gate is now running once from
`/private/tmp/content-agents-6b-verify`, using the previously established serial Node test shim;
setup already ran once. Candidate is not accepted until its exit and closeout are recorded.

## Accepted closeout — 2026-09-08

PASS. Final frozen gate `PATH=/private/tmp/slice-5q-gate-bin:$PATH npm run check`, unsandboxed,
from `/private/tmp/content-agents-6b-verify`: exit 0, 4347 tests / 494 suites, no failures,
cancelled, skips or todo; 482.86s including typecheck. Raw stdout/stderr/exit retained under
`coordinator/final-gate.*`; stderr empty. Setup ran once in each dedicated checkout.

Final source SHA256:
- queue-view.ts: `2b0787bd66b1c4c8fc8f5c58ef89743b56bc9a1b18f4c946249d982f6b5e06c2`.
- queue-view.test.ts: `a4710389f61d92cc5f79bc669a10cd29faf633b817df3b994f3dab9383cceed3`.
- configured-media-runtime.test.ts: `d75fecb9c59da8861be4f9efacd9955845ec62d422918e49015887208660108b`.

All five protected operational hashes and all four pre-existing edit hashes equal the baseline.
No provider/model-generation canary ran. Functional QA was real isolated CLI output and child
process evidence; this CLI/test-only slice changes no browser/native interface. Main receives
only these three identical source/test files plus packet/master closeout; no push.

The next-work map remains `SLICE-6A.md`: its historical P2 operational/depth items need a bounded
current-readiness packet before any real run. No new provider/publication target or successor
runtime slice is selected here; this does not reopen accepted P0/P1 or 5B/5Q/5Y/5Z work.

Hygiene exit 1 fully dispositioned: main rescued at `a0155dd`, queue `5c28ef3`, render `e66eec1`,
verify `e641462` (refs/wip recovery snapshots, not integration commits). No prunable worktrees.
The three session-created checkouts `/private/tmp/content-agents-6b-queue`,
`/private/tmp/content-agents-6b-render`, and `/private/tmp/content-agents-6b-verify` were removed
only after their sole modified paths matched the accepted main copy and rescue refs existed.
No session-created untracked repository artifacts remain. Bounded evidence roots
`/private/tmp/slice-6a-evidence/` and `/private/tmp/slice-6b-evidence/` are intentionally retained.

Preserved pre-existing edits: `AGENTS.md`, `docs/operations/launch-slices/SLICE-TEMPLATE.md`,
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`,
`data/notes-spread-ledger.jsonl`. Preserved older branches `slice-5q-queue`, `slice-5r-routing`,
`agent/cs2-jobs-outreach-charles-extract`, `agent/cs2-page-room-pure-helpers`,
`agent/cs2-serve-walled-room-routes`, `agent/cs3-studio-durable-handoff`, and
`agent/cs6-parallel-safe-ui-completion`. None belongs to this slice. Closeout PASS with those
explicit preserved leftovers. Coordinator final diff/whitespace review passed; only five scoped
paths enter the accepted runtime commit. Primary checkout remains main, no push.
