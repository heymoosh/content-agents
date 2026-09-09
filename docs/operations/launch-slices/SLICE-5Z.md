# SLICE-5Z: Verify the GUI job-to-child-process execution chain

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this packet only.
Do not load the repository for context. Workers never commit.

## Goal

Close or explicitly disposition the verification gap recorded by accepted 5O: proof of the
`runAgentSpawn` → `buildEngineSpawn` → `runCommandSpawn` chain, using observable isolated process
output and isolated cost-log evidence. First confirm whether later tests already cover it.
This is a bounded verification slice; no real model invocation or broader job-system redesign.

## Difficulty

Hard — subprocess isolation and proving execution rather than an argument passed to a spy.

## Depends on

5O and 5Y accepted. Lane A assigned at base `8b30f072729731dd6f25223db78a39e814c7fd36`.
5O's historical gap is a claim to verify at current HEAD, not proof that current tests are missing.

## Owned files

### Lane A — bounded verification inventory, first checkpoint

- Own only `/private/tmp/slice-5z-evidence/inventory/`.
- Read `src/review/jobs.ts`, `src/review/jobs.test.ts`, `src/util/cost-log.ts` and
  `src/util/cost-log.test.ts`, limited to the named execution chain, its test seams and cost logging.
- Bounded exact-symbol search for runAgentSpawn, buildEngineSpawn, runCommandSpawn in src is allowed;
  inspect only matching definitions/callers/tests needed to trace that chain.
- Pin source inputs to coordinator-recorded HEAD before assignment.
- Deliver a coverage matrix with path:line evidence and exact isolated reproduction/check commands.
  If the gap is already closed, demonstrate that with existing checks. No implementation yet.

At the completed inventory checkpoint, coordinator amends this packet with exact disjoint builder
and verifier ownership if work remains. Expected test ownership is `src/review/jobs.test.ts`;
any production seam must be justified by the observed gap before it is authorized. Do not change
production behavior merely to make a test convenient.

Parallel-safe: the small initial inventory establishes the actual chain and available test seams;
a second inventory would duplicate that deliverable. Implementation and independent harness
preparation split after that frozen checkpoint if useful. No repo-wide rewriting commands.

### Checkpoint — 2026-09-08, inventory complete before builder assignment

Inventory established the gap at jobs.ts:1818–1838 and jobs.test.ts:2210–2294:
existing queue/argv assertions do not execute the full chain. No production seam is needed.

### Lane B — outcome regression tests

- Own only `/private/tmp/content-agents-5z-build/src/review/jobs.test.ts`,
  `/private/tmp/slice-5z-evidence/builder/`, and unique OS temporary fixture directories
  created and unconditionally removed by those tests. Existing focused regressions may create
  their normal temporary content fixtures inside this dedicated build checkout, but must remove
  them before handoff; this does not authorize retained source/content changes.
- Immutable inputs: base `8b30f072729731dd6f25223db78a39e814c7fd36`, named Lane A source inputs.
- Deliver full-chain tests using fixture-only executables for successful output, nonzero exit,
  and timeout; assert job outcome, child-produced receipt/artifact, persisted log and fixture cost.
  Exercise Claude and Codex command construction with fake executables; no real model calls.
- Use an allowlisted child environment, isolated HOME/data/cost/temp roots and PATH containing
  only fixture executables, absolute Node interpreter, bounded waits and unconditional reap.
- Focused command: `node --import tsx --test src/review/jobs.test.ts src/util/cost-log.test.ts`.
  Also run `npx tsc --noEmit`. Capture exit codes and output under owned evidence directory.
- No production edits. Return frozen changed-file hash and check outputs; never commit.

### Lane C — independent verification preparation, then frozen-candidate verification

- Own only `/private/tmp/slice-5z-evidence/verifier/` and fixtures beneath it.
- Prepare a bounded coverage/negative-control verification plan from A1–A4 and the immutable
  named sources at base `8b30f072729731dd6f25223db78a39e814c7fd36`.
- Do not read Lane B output before the coordinator announces its frozen handoff.
- At handoff review actual test evidence for false positives, isolation and unconditional cleanup;
  run narrowly scoped independent checks or mutation controls only within owned fixtures.
- Actual check: `node --import tsx --test --test-name-pattern=SLICE-5Z src/review/jobs.test.ts`,
  with TMPDIR under verifier ownership. Do not run older tests that create checkout fixtures.
- Deliver path:line findings and actual results. Preparation is not a passing candidate verdict.

Parallel-safe: B and C have disjoint write paths; neither runs repository-wide rewriting commands;
checks write only owned fixtures/evidence and read pinned base inputs. Candidate verification
waits for B's frozen handoff. Separate verifier preparation provides adversarial validation,
not a duplicate implementation. Coordinator alone owns packet/master and integration.

### Repair checkpoint R1 — test cleanup only

Lane B completed and frozen at test SHA d27bd10a4de232fbcc53c409b811d051483d2c00440a5370589c64fc1447153b.
Lane C actual scoped test passed, but identified material A3 verification-machinery defects:
- jobs.test.ts:2369–2401 setup outside try can leak a root on setup failure.
- jobs.test.ts:2420–2422 reap rejection skips rmSync.
- jobs.test.ts:2337–2350 all process errors are mistaken for absence; only ESRCH establishes it.
R1 builder owns the same Lane B paths after that completed checkpoint. Raise Terra effort
xhigh → max for omitted failure-path verification; family unchanged, auditor remains Grok.
Move all post-mkdtemp setup into try; use nested cleanup finally; propagate unexpected process
errors and bound TERM/KILL cleanup. Add meaningful failure-injection evidence for these cleanup
paths, within test-only scope. Search all uses of slice5ZReapFixture/withSlice5ZFixture and
close findings with path:line and actual focused checks/typecheck. No production edits.
Independent closure waits for R1 frozen handoff. Grok V1 audit may finish against its pinned V1
while repair runs; its source inputs are immutable in the separate verification checkout.

## Do not touch

- Real job stores/logs, provider/scheduler state, analytics, content, credentials, approvals,
  backlog, other builds or unrelated source. No real Claude/Codex/Grok generation processes.
- Preserve other sessions' edits. All test children must use fixtures and explicit isolated
  data/cost roots; bounded timeouts and unconditional child cleanup are required.
- Do not rerun 5P or any accepted provider canary.

## Cited headings

- `docs/operations/launch-slices/SLICE-5O.md` → `## RESULT BLOCK`, Unresolved item 3.
- `docs/operations/launch-slices/SLICE-5N.md` → `## RESULT BLOCK — ACCEPTED 2026-09-07`,
  the recorded runAgentSpawn linkage limitation only.
- Named implementation/test inputs above. No master archive headings.

## Acceptance

- [x] A1: current execution chain and existing coverage established from bounded source and checks.
- [x] A2: actual isolated child execution proves the intended job reaches the process runner;
      observe its output/artifact and resulting job outcome, not only mocked call arguments.
- [x] A3: cost evidence lands only in the fixture log; real cost/job/provider data remains unchanged.
      Errors/timeouts clean up children and do not claim successful execution.
- [x] A4: any gap is closed with checks and independent cross-family review, or shown already closed by
      existing outcome-based evidence; no speculative refactor.
- [x] A5: final changed candidate passes the frozen unsandboxed gate; coordinator reviews and commits
      packet/master with only scoped changes. No behavioral change without renewed exact ownership.

## Verify

Inventory starts with the relevant existing tests in `src/review/jobs.test.ts` and
`src/util/cost-log.test.ts`; coordinator pins exact commands after the coverage report.
No full gate during investigation or pending repair. If the proof already exists, retain its
actual check output and close the documentation handoff without duplicating tests.

## Observable result

The reported GUI job completion is backed by evidence that its intended isolated child process
actually ran, with observable output and isolated logging.

## Risk

Meaningful behavior/high risk — medium operational risk, audit required for subprocess verification
machinery and material A3 cleanup closure. No production behavior changes. Runtime gate applies.
Review boundary: final test SHA `7764497b1716182b158001efb86cf4c023aba8f12479421b28e6d2f418d722db`.
Review scope/budget: one Claude Sonnet medium-effort delta review of A3 cleanup and its failure
injections; retain V1 Grok dispositions at SHA `d27bd10a4de232fbcc53c409b811d051483d2c00440a5370589c64fc1447153b`.
Only changed evidence or demonstrated invalidation reopens settled findings; symmetric failures
remain optional. Supply V1-to-final diff, line-numbered bounded source and final raw scoped TAP.
No real generation/provider canaries. UI/native QA: not applicable to this test-only slice.
On reviewer outage: preserve review-blocked status and continue independent evidence/preservation
work; never integrate without required closure. User authorized Claude substitution 2026-09-08.

## Families

- Initial inventory: Codex Terra high.
- Builder/verifier if needed: Codex Terra xhigh, disjoint ownership after checkpoint.
- Auditor: Claude Sonnet, medium effort for bounded delta closure (user-selected family on resume); prior Grok 4.5 V1 disposition retained. No edits; path:line and explicit verdict.

## Closeout

```
bash scripts/repo-hygiene.sh --rescue
```

PASS — accepted 2026-09-08. Claude delta closure and frozen repository gate passed. Historical stopping record retained below.

## RESULT BLOCK

- Changed paths: `src/review/jobs.test.ts`, this packet, `docs/content-studio-master-status.md`.
- Outcome: accepted; full job-to-child outcome proof and cleanup failure-path coverage.
- Checks: final scoped 3/3 exit 0 retained; Claude delta audit PASS exit 0;
  frozen unsandboxed `npm run check` PASS, 4345 tests / 494 suites, zero failures/skips,
  exit 0, 541.38 seconds including typecheck.
- Evidence: `/private/tmp/slice-5z-evidence/`; final gate/audit files under `coordinator/`.
- Unresolved: none blocking 5Z; extra setup-injection sites and symmetric failure cases optional.

Full evidence-checkpoint trail (base/V1/R1/final SHAs and TAP locations) and the superseded
2026-09-08 mid-session `## Stopped` record (blocked on exhausted Grok balance, since resolved by
the Claude resume above) are archived in `SLICE-5Z-LOG.md`.
