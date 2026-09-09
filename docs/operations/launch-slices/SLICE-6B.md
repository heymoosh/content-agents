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
