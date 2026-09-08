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

5O and 5Y accepted before assignment. Packet prepared during 5Y closeout; not yet assigned.
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

- [ ] A1: current execution chain and existing coverage established from bounded source and checks.
- [ ] A2: actual isolated child execution proves the intended job reaches the process runner;
      observe its output/artifact and resulting job outcome, not only mocked call arguments.
- [ ] A3: cost evidence lands only in the fixture log; real cost/job/provider data remains unchanged.
      Errors/timeouts clean up children and do not claim successful execution.
- [ ] A4: any gap is closed with checks and independent Grok review, or shown already closed by
      existing outcome-based evidence; no speculative refactor.
- [ ] A5: final changed candidate passes the frozen unsandboxed gate; coordinator reviews and commits
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

High — audit required: yes for new execution/verification machinery. Budget: zero real generation
or provider calls. Authorized Grok audit uses workspace sandbox and bounded evidence only.

## Families

- Initial inventory: Codex Terra high.
- Builder/verifier if needed: Codex Terra xhigh, disjoint ownership after checkpoint.
- Auditor: Grok 4.5 workspace; no edits; path:line and explicit verdict.

## Closeout

```
bash scripts/repo-hygiene.sh --rescue
```

Not started. Acceptance pending; this packet does not claim an established current defect.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
