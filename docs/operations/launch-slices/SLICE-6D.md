# SLICE-6D: Fiction Grok compatibility and reviewed recommendation integration proof

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open the master archive. Do not load the repository for context. Workers do not commit.

## Goal

Fiction's idea classification/cleanup and comment-revision Grok launches use the Mac-compatible
workspace sandbox, preserving their text-return contract and all other engine constraints.
Prove the affected local execution paths with isolated fixture children. In parallel, build a
fixture integration check for the existing reviewed recommendation-to-request contract, resolving
the 6C caller uncertainty without inventing a generic adapter. No authenticated run.

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

### Lane B — reviewed recommendation integration proof

- Own only new `src/review/recommendation-request-integration.test.ts` in a separate
  coordinator-created checkout and `/private/tmp/slice-6d-evidence/recommendations/` plus unique fixtures.
- Deliver an executable fixture test through the existing recommendation/request authorization
  boundary, covering valid evidence and stale/forged/unreviewed rejection where the actual contract
  supports it. Trace actual persisted/authorized outcomes, not only function arguments.
- Immutable read-only inputs at assignment commit: `src/review/recommendations.ts`,
  `src/review/content-request.ts`, `src/review/content-request-store.ts`, `src/review/treatment.ts`,
  `src/review/reviewed-mechanism-recommendations.ts` and their same-basename tests; the dossier path
  explicitly referenced by that reader, limited to its schema/fixture contract. May search exact
  imported symbols within these files and request bounded dependencies needed to execute fixtures.
- First checkpoint: report actual seam and proposed test outcomes before writing. No generic adapter,
  production changes, real evidence rows, generation or content bodies. Avoid duplicating existing
  unit checks: exercise the combined boundary or report that existing tests already establish it.
- Checks: `node --import tsx --test src/review/recommendation-request-integration.test.ts` and
  `git diff --check`; writes only isolated fixtures/evidence, no repository `.env` reads or model calls.
- Handoff: test, exact contract/disposition with path:line, raw check output/exit, hashes and cleanup.

Parallel-safe: yes. A and B have disjoint source/test paths and separate checkouts/evidence/temp
roots; neither creates paths in the other's owned directories. No repo-wide rewriting commands.
Both consume immutable runtime inputs at `f286169917c4e77a564c24d8242e58f974287775`, never
unfinished lane output. A single worker keeps the two tiny Fiction builders together; B supplies
an independent recommendation integration test. Candidate review, full gate and integration serialize.

## Do not touch

- Other production code/tests outside lane ownership, root or scoped rules, real `.env`, content, analytics/cost logs,
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

- [ ] Lane B establishes the existing recommendation/request integration contract with a meaningful
      passing fixture test or demonstrates equivalent existing coverage with exact source evidence;
      no generic adapter or real-input readiness is inferred.

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
review of exact changed evidence and preserved permission/text-return invariants, plus the
recommendation fixture's canonical identity, persistence and fail-closed assertions. No UI change;
functional proof is real isolated child execution. Authenticated Mac/Grok verification remains
a separate budgeted workflow; no live canary is necessary for this fixture-only correction.

```
node --import tsx --test src/fiction/idea-inbox.test.ts src/fiction/review-pr.test.ts
node --import tsx --test src/review/recommendation-request-integration.test.ts
git diff --check
```

Coordinator runs fresh-checkout setup once before checks. After independent closure freeze a
detached combined candidate and run unsandboxed `npm run check` once, last. The established
serial Node test shim may be reused after verifying its identity; record actual command/exit.

## Observable result

Fiction no longer emits the known incompatible Grok sandbox option, and fixture execution proves
classification, cleanup and revision outputs still reach their callers with isolated state.
The reviewed recommendation test proves canonical evidence survives request persistence and
that forged/stale evidence cannot grant generation authorization.

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

Assigned in parallel; not accepted. Record focused proof, independent closure, frozen gate, preservation and hygiene
disposition before marking accepted. No worker commits; coordinator integrates locally on main.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Accepted — Claude integration, 2026-09-08

Full gate finished: `full-gate.exit.json` reports exit 0 in ~404.9s
(`PATH=/private/tmp/slice-5q-gate-bin:$PATH npm run check`). Coordinator hash-verified the frozen
`/private/tmp/content-agents-6d-verify` candidate's five files against `candidate-manifest.json`
(sha256 match, all five). Independent Claude audit and delta-audit closure (both exit 0, retained
from the Stopped handoff below) still hold — no source changes since audit. Coordinator copied the
five reviewed files into main and committed them with this packet and master-status update, in one
reviewed commit. Hygiene leftovers (worktrees, rescue refs, other sessions' four preserved edits)
are unchanged from the disposition already recorded below and remain retained, not superseded.
