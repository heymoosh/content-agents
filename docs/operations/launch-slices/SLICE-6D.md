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

## Assignment — 2026-09-08

Baseline: `f286169917c4e77a564c24d8242e58f974287775`; four Fiction files unchanged from accepted 6B.
Lane A checkout: `/private/tmp/content-agents-6d-fiction`.
Lane B checkout: `/private/tmp/content-agents-6d-recommendations`.
Both builders: Codex Terra high. No prior active owner is reassigned. Coordinator owns docs.

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

## Coordinator finding R1 — fixture isolation

Initial Lane A handoff omitted credential allowlisting and pre-import `.env` isolation. Merely
having no `.env` in the build checkout does not make the committed test safe elsewhere. Its added
production revision timeout is unnecessary scope and only sends SIGTERM. Initial worker paused.
Reassign the same four paths to Codex Terra xhigh (one effort notch) in the same checkout.

- Remove the newly introduced production timeout; preserve non-Grok behavior.
- Run affected runtime imports/execution inside a credential-free, bounded real child harness.
  Ensure repository `.env` cannot be read before imports (loader interception or equivalent),
  observe fixture loading and real outputs, use SIGKILL deadline for fixture processes and finally cleanup.
- Bounded additional read-only reference: `src/publish/queue-view.test.ts` for the accepted 6B
  subprocess/env-loader isolation pattern. Do not edit or rerun that test. May use Node module loader
  in test-only code, no production seams. Scope-search every affected test/import path.
- Rerun only Fiction focused checks; handoff exact final diff/check evidence. Claude review remains
  required before integration. No accepted audit exists for this initial candidate.

R1 final coordinator check also requires blocking the outer test module's runtime import before
it can load repository `.env`; protecting only the spawned fixture is insufficient for the stated
whole-invocation guarantee. Same paused/completed R1 owner resumed at Terra xhigh, same paths.
Lane B independently found the analogous transitive import and added an exact-path dynamic-import
FS guard; its final two-test proof is ready for independent review.

## Independent review — 2026-09-08

Final candidate hashes: `/private/tmp/slice-6d-evidence/coordinator/candidate-manifest.json`.
Initial Claude Sonnet medium review completed (actual `claude-sonnet-5`, exit 0, is_error false,
108.97 seconds): no established defects; PASS subject to caller-search and diff-check receipts.
Supplied those exact command/output/exit receipts without changing source. Delta closure returned
PASS, no unresolved findings (same actual model, exit 0, is_error false, 43.60 seconds).
Evidence: coordinator `audit.*`, `audit-delta.*`, `audit-gap-evidence.txt` and `candidate.diff`.

Coordinator disposition: continuity's separate adapter does not emit the affected explicit Grok
read-only flag; its Codex option is unchanged. Do not infer filesystem enforcement for Grok from
legacy continuity prose or the auditor's shorthand. No change to that adapter is claimed here.
Optional duplicated fixture helper extraction is deferred; no generic harness refactor in this slice.

Focused final proof: Fiction 33/33, recommendation 2/2; all pass with no skips. Both outer Fiction
imports and the new recommendation import block the exact repository `.env` read. Fiction's child
fixtures use a credential-free environment allowlist, receipt-verified `.env` substitution, isolated
roots and a 10-second SIGKILL deadline. The fake children return real parsed helper outputs.
No live Grok startup, real recommendations/input readiness, browser journey or publication is claimed.

Lane B establishes the existing specialized reviewed-dossier path through GUI authorization,
persistence/reload and generation authorization. It does not establish a generic Pattern adapter.
Its initial missing import isolation was repaired on Terra high before independent review; Lane A's
omitted isolation received Terra xhigh as specified. All worker edits stopped before review.

Full gate: running on `/private/tmp/content-agents-6d-verify`, detached baseline `f286169` plus the
five audited files; manifest equality verified. Fresh setup passed once; serial Node shim identity
matched prior accepted gate infrastructure. No implementation edits permitted during this gate.

## Stopped — owner-requested Claude handoff, 2026-09-08

Not accepted: owner requested closeout to conserve Codex usage while the frozen full gate is still
running. Both builders have stopped. Required independent Claude source audit and evidence-gap
closure PASS; final focused checks PASS (33 Fiction + 2 recommendation tests). No source commit.

Retained candidate: four Fiction files in `/private/tmp/content-agents-6d-fiction`; new
`src/review/recommendation-request-integration.test.ts` in
`/private/tmp/content-agents-6d-recommendations`; combined five-file candidate in detached
`/private/tmp/content-agents-6d-verify`. All match coordinator `candidate-manifest.json`.
All evidence is under `/private/tmp/slice-6d-evidence/`; the exact combined patch is
`coordinator/candidate.diff`. Main still has only coordinator docs plus four pre-existing edits.

Single next action: Claude reads `coordinator/full-gate.exit.json` once it exists and the final
`full-gate.stdout.txt`/`full-gate.stderr.txt`; do not restart the running valid gate. The background
wrapper is `/private/tmp/slice-6d-evidence/coordinator/run-gate.py` (Codex exec session 24364).
It writes durable exit and elapsed-time evidence on completion. PASS requires actual exit 0,
then final hash comparison, hygiene and coordinator integration of the five reviewed files plus
packet/master. If the gate fails, repair only established failures and independently close material
changes before a new frozen gate. If no exit receipt appears and the process is gone, record an
incomplete gate; do not infer PASS from trailing output. No source changes since audit.

Preserve accepted 6B/6C evidence, current policy, operational state, other sessions' four edits,
and the 5X backup. Never rerun 5P. No live workflow budget consumed by this slice.

### Handoff hygiene disposition

Hygiene exited 1 with all leftovers retained intentionally for handoff; no prunable worktrees.
Rescue refs: main `4a521fd`, Fiction `dce3f0c`, recommendations `e0824d4`, verification `65511ac`
under their matching `refs/wip/content-agents*` names. These snapshots preserve work, not acceptance.
Keep all three session checkouts until Claude finishes integration. Session-created untracked
`src/review/recommendation-request-integration.test.ts` exists in recommendation and verification
checkouts and is rescued in both refs; retain it under the stopping-without-acceptance branch.
The packet copy in each build checkout is assignment-time context; canonical handoff is this file
on main. External session artifacts are confined to `/private/tmp/slice-6d-evidence/`.

Pre-existing main edits preserved unchanged: `AGENTS.md`,
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`,
`data/notes-spread-ledger.jsonl`, and `docs/operations/launch-slices/SLICE-TEMPLATE.md`.
Older branches retained untouched: `slice-5q-queue`, `slice-5r-routing`,
`agent/cs2-jobs-outreach-charles-extract`, `agent/cs2-page-room-pure-helpers`,
`agent/cs2-serve-walled-room-routes`, `agent/cs3-studio-durable-handoff`,
`agent/cs6-parallel-safe-ui-completion`. No user decision is needed for these unrelated leftovers.
Closeout: handoff recorded; runtime acceptance remains pending the full gate. No push.
