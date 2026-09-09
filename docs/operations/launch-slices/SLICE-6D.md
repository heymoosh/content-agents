# SLICE-6D: Correct Fiction's Grok sandbox launch mode

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open the master archive. Do not load the repository for context. Workers do not commit.

## Goal

Fiction's idea classification/cleanup and comment-revision Grok launches use the Mac-compatible
workspace sandbox, preserving their text-return contract and all other engine constraints.
Prove the affected local execution paths with isolated fixture children. No authenticated run.

## Difficulty

Easy — two bounded launch-argument changes with meaningful subprocess outcome/isolation proof.

## Depends on

6C accepted before assignment; 6B runtime baseline accepted at
`ea77d5bcb28d31c626fce0cd43a42a5b849650b2`. 6C changes documentation only. At assignment,
record the actual main commit and freeze runtime inputs; stop if these four files changed meanwhile.

## Owned files

Coordinator owns this packet, master, evidence reconciliation and integration.

### Lane A — Fiction Grok compatibility

- Own `src/fiction/idea-inbox.ts`, `src/fiction/idea-inbox.test.ts`,
  `src/fiction/review-pr.ts`, `src/fiction/review-pr.test.ts` in a coordinator-created isolated
  checkout, and `/private/tmp/slice-6d-evidence/builder/` plus unique test-created fixture roots.
- Deliver both corrected launch modes and focused outcome/regression proof. Initial checkpoint
  inspects existing tests and shared engine adapter; report exact fixture design before edits if
  more source ownership would be necessary. No generic shared-harness refactor.
- Pinned read-only inputs: `stories/AGENTS.md`, `src/review/engines.ts` at buildEngineSpawn,
  extractEngineText and GROK_FINAL_TEXT_SYSTEM_PROMPT; `src/util/env.ts`; `src/db/db.ts` repoRoot
  definitions; `package.json`; own four files. Targeted references to buildIdeaSpawn,
  buildRevisionSpawn, classifyIdeaWithEngine, cleanupIdeaWithEngine and reviseSpanWithEngine
  within `src/fiction/` may be searched to establish affected caller coverage, snippets only.
- Checks write only owned evidence and fixture roots. Immutable shared runtime inputs are pinned
  to the assignment commit. No real `.env`, installed model CLI, GitHub, provider or live data use.
- Handoff: completed RESULT BLOCK, diff/changed list, source hashes, raw check output and exit,
  cleanup proof, and precise limitations. Stop edits before coordinator freezes the candidate.

Parallel-safe: single worker. Splitting the two small, analogous builders would add coordination
and duplicate fixture design without a useful independent deliverable; the worker owns both
launch paths and their tests. Cross-family review remains separate and waits for frozen handoff.

## Do not touch

- Other production code/tests, root or scoped rules, real `.env`, content, analytics/cost logs,
  scheduler/provider state, backlog, or unrelated edits. No publication, GitHub PR or paid calls.
- Preserve non-Grok sandbox/tool/permission choices. Do not widen fiction's content-edit approval
  or canonical-update permissions. Workspace sandbox is not a promise of read-only enforcement.
- Do not rerun 5P or accepted runtime/browser/model checks as substitutes for this slice's proof.

## Cited headings

- `SLICE-6C.md` → reconciliation and accepted result, once recorded.
- `/private/tmp/slice-6c-evidence/workflow/RESULT.md` → Fiction row and follow-up ownership.
- Pinned `idea-inbox.ts` buildIdeaSpawn at lines 330–341 and `review-pr.ts` buildRevisionSpawn at
  lines 348–358 currently append `--sandbox read-only`; the protocol mandates workspace on this Mac.
- Named bounded source paths above. No master archive.

## Acceptance

- [ ] Both effective Grok launch configurations use `workspace` without duplicate/conflicting
      sandbox flags; all relevant Fiction callers are accounted for by a scoped symbol search.
- [ ] Non-Grok behavior, JSON extraction, text-only prompt constraints, disabled web/subagents and
      existing review-before-apply behavior remain intact. Update misleading read-only comments
      where the changed Grok launch is described; do not claim sandbox-enforced nonmutation.
- [ ] Exercise the actual idea classification/cleanup and comment-revision execution paths with
      credential-free fake Grok child processes; observe returned classification/replacement text,
      not only constructed argument arrays. Fixture child rejects the retired sandbox mode, allowing
      the changed behavior to have a focused regression check. Retain non-Grok regression coverage.
- [ ] Fixture runs use isolated HOME/data/cost/temp roots, bounded child termination and cleanup;
      they cannot read the user's repository `.env` or invoke an installed model/provider binary.
      Preserve sentinel files/state through execution. No production seam solely to ease a test.
- [ ] Focused checks pass; Claude independently closes material findings; frozen full gate and
      hygiene pass before coordinator integration. Fixture proof does not claim real Grok startup.

## Verify

Meaningful behavior — model subprocess launch configuration and test isolation. Bounded Claude
review of exact changed evidence and preserved permission/text-return invariants. No UI change;
functional proof is real isolated child execution. Authenticated Mac/Grok verification remains
a separate budgeted workflow; no live canary is necessary for this fixture-only correction.

```
node --import tsx --test src/fiction/idea-inbox.test.ts src/fiction/review-pr.test.ts
git diff --check
```

Coordinator runs fresh-checkout setup once before checks. After independent closure freeze a
detached combined candidate and run unsandboxed `npm run check` once, last. The established
serial Node test shim may be reused after verifying its identity; record actual command/exit.

## Observable result

Fiction no longer emits the known incompatible Grok sandbox option, and fixture execution proves
classification, cleanup and revision outputs still reach their callers with isolated state.

## Risk

Medium — audit required: yes. Workspace permits more than read-only; preserve the existing
text-only/no-subagent/no-web contract, and have the reviewer assess the actual effective adapter
configuration rather than assume a prompt enforces filesystem isolation. If current confinement
requires a material redesign, record evidence and narrow the follow-up; do not silently widen it.
One ordinary-effort bounded review, then delta closure only for material changes. No speculative
hardening. Retain settled 6B checks and 6C source evidence; do not repeat them. During reviewer
outage retain candidate and continue independent evidence preparation; no integration before closure.

## Families

- Builder: Codex Terra high, bounded backend/CLI work; raise effort one notch for omitted verification.
- Auditor: Claude Sonnet medium, cross-family review of this candidate. Actual model/exit required.

## Closeout

Not started. Record focused proof, independent closure, frozen gate, preservation and hygiene
disposition before marking accepted. No worker commits; coordinator integrates locally on main.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
