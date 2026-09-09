# SLICE-6C: Identify concrete work behind remaining product-depth requirements

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Turn the remaining historical product-depth requirements into current, evidence-backed next
assignments: workflow readiness, Charles persona-edit disposition, and recommendation evidence.
Distinguish missing implementation, missing input, missing live proof, and already accepted work.
The owner authorized these three parallel investigations. This slice performs no live workflow.

## Difficulty

Easy — bounded source and history reconciliation; ambiguous historical prose is not a defect.

## Depends on

6A and 6B accepted. Pin repository inputs to `ea77d5bcb28d31c626fce0cd43a42a5b849650b2`.
All previous builders finished. Preserve their accepted checks and all unrelated working edits.

## Owned files

Coordinator owns this packet and master status. Workers write only their evidence directories.
Preparation is independent; any authenticated execution or runtime implementation needs a later
packet. Final reconciliation and integration are serialized. Up to three workers execute at
once with the coordinator, within the four available agent slots.

Common immutable inputs: this packet, the protocol snapshot at
`/private/tmp/slice-6c-evidence/coordinator/protocol.md`, pinned 6A/6B packets and cited master
section. Read repository files with `git show <pinned-commit>:<path>`; no mutable source inputs.
Discovery is allowed only as filename listing and targeted symbol/text search for the lane's
named capability. Do not enumerate or read unrelated source, full master archive, credentials,
operational databases, real cost logs, or content bodies. Each lane may inspect at most twelve
relevant source/spec/test files after filename/symbol discovery; report a precise follow-up if
that boundary leaves a material question unresolved. Keep snippets with path:line and input hash.
No recursive archive traversal; no tests, model CLI, provider calls, browser, or application runs.

### Lane A — workflow readiness

- Own `/private/tmp/slice-6c-evidence/workflow/` only.
- Deliver a readiness matrix for Fiction's GitHub/model flow, Outreach Scout, and per-brand
  Strategy/Signals. Identify implemented entrypoints, required input, signed-in system, isolation
  boundary, observable output, existing proof, and smallest missing experiment or implementation.
- Discover capability-specific paths in pinned `src/`, `stories/`, and `docs/` using terms
  `fiction`, `scout`, `outreach`, `strategy`, `signals`, `account`, `brand`; do not dump whole trees.
- Read scoped `stories/AGENTS.md` if following fiction source. For specs read only relevant
  workflow/dependency/status sections. Historical P2 is a lead, not current acceptance evidence.
- Focused check: every row cites current symbols/files and names a concrete dependency; identify
  exact files/checks for a follow-up packet. No real input selection or authenticated run here.
- Handoff: frozen `RESULT.md` plus cited input hashes and check outcome. Do not read B/C output.

### Lane B — Charles pending changes

- Own `/private/tmp/slice-6c-evidence/charles/` only.
- Deliver the exact persona-edit candidate commit/changed paths and whether it is already on main,
  still pending, or cannot be located from bounded evidence. Identify next review boundary.
- Read pinned `charles/AGENTS.md`. Discover only persona/edit-related paths in pinned `charles/`,
  `src/`, and `docs/`. Git refs and path-limited log/diff/ancestry checks are allowed; freeze any
  candidate ref to a commit before reading it. No checkout, restore, merge, or branch mutation.
- Search the master only for exact `persona-edit` or `recovery branch` matches with up to eight
  surrounding lines to identify the historical reference; do not read other archive sections.
- Trace only candidate persona files and the associated documented browser evidence. Do not claim
  that historical browser proof establishes current candidate behavior. No new browser run here.
- Focused check: exact commit ancestry and scoped changed-file evidence or a precise unresolved
  reference. Record whether a later review/build is needed and exact ownership/checks.
- Handoff: frozen `RESULT.md` with hashes/commands/outcomes. Do not read A/C output.

### Lane C — recommendation evidence

- Own `/private/tmp/slice-6c-evidence/recommendations/` only.
- Deliver the implemented path from pattern/account/baseline/mechanism evidence to recommendations,
  available input schemas/import routes, safeguards for unsupported claims, and exact missing work.
- Discover evidence/recommendation-specific paths in pinned `src/`, `config/`, and `docs/` with
  terms `recommendation`, `baseline`, `mechanism`, `pattern`, `evidence`; inspect only relevant
  definitions, callers and tests within the twelve-file bound. Shared Strategy/Signals source
  may be read only as immutable input; A owns run readiness, C owns recommendation/data logic.
- Inspect schemas and fixture evidence, not real analytics rows or private source content.
  Distinguish data existence from data sufficiency. Name a bounded follow-up inventory if needed.
- Focused check: trace at least one recommendation from input contract to output/guard and test;
  list concrete gaps with path:line, or explicitly state no defect established. Name dependencies,
  owned file candidates and observable checks for the smallest useful next slice.
- Handoff: frozen `RESULT.md` with input hashes and check outcome. Do not read A/B output.

Parallel-safe: yes. All lane writes and temporary outputs are disjoint. No repo-wide rewriting
commands. All shared reads are pinned immutable inputs; no check consumes another lane's output.
Any unavailable agent slot staggers dispatch only; the lanes have no execution dependency.

## Do not touch

- Source/tests, operational data, content, credentials, provider state, backlog, or other edits.
- No paid calls, live model generation, publication, account changes, or repeated 5P canary.
- Do not reinstate stale Charles manual-only policy or undo accepted 5X attribution. Legacy X and
  LinkedIn are non-Human Inference experimental data; Substack is Human Inference. Where a current
  policy is needed, request an exact bounded evidence excerpt rather than infer from historical P2.

## Cited headings

- Pinned master → `### P2: complete product depth` only; B has the targeted historical search above.
- `SLICE-6A.md` → `## Reconciliation checkpoint`; `SLICE-6B.md` → `## Accepted closeout`.
- Capability-specific files discovered within each lane's explicit boundary, relevant sections only.

## Acceptance

- [x] Three frozen reports establish current evidence and separate build gaps from input/live-proof gaps.
- [x] Each recommendation names dependencies, exact next ownership and observable acceptance proof.
- [x] Historical claims do not reopen accepted work or reverse current attribution/Charles policy.
- [x] Coordinator selects the next dependency-ready packet or records the precise unresolved decision.
- [x] Scoped documentation review, preservation check, diff check and hygiene disposition pass.

## Verify

Documentation only — investigation and planning prose, no executable inputs change. Coordinator
checks source citations, immutable hashes, requirement coverage, dependencies and links. No runtime
gate, detached runtime checkout or external audit is required. No UI changes or live proof claimed.

```
git diff --check -- docs/operations/launch-slices/SLICE-6C.md docs/content-studio-master-status.md
```

## Observable result

The owner can see which product-depth requirements actually need code and the next concrete
assignment, with real-workflow and input requirements stated separately.

## Risk

Low — audit required: no, documentation-only boundary. Coordinator reviews frozen report evidence
and final document diff. Runtime findings are candidates, not accepted repairs. A later Codex build
requires Claude independent review at the appropriate capability boundary. Retain 6B and prior
accepted evidence; reopen only on changed behavior or new contradictory evidence.

## Families

- Builder: Codex Terra high per lane, bounded source/history reconciliation at the established tier.
- Auditor: not required for this documentation-only slice; coordinator evidence/diff review.

## Closeout

PASS — documentation-only source/evidence, dependency, packet/link and diff review. Three frozen
reports and all four pre-existing edit hashes verified. Hygiene disposition below.

## RESULT BLOCK

- Changed paths: this packet, `SLICE-6D.md`, master START HERE/progress; three external evidence reports.
- Outcome: investigations complete; one concrete Fiction Grok launch gap, Charles represented on main,
  remaining workflow live/input proof, and a bounded unresolved recommendation integration question.
- Checks run and results: three lane source/history checks PASS; coordinator 24 source SHA checks PASS,
  Charles ancestry and seven-blob comparison PASS. Final documentation closeout recorded below.
- Evidence locations: `/private/tmp/slice-6c-evidence/`.
- Unresolved: no engineering/owner blocker for 6C. Runtime 6D is prepared, not implemented or accepted.

## Reconciliation — 2026-09-08

All source inputs pinned to ea77d5b. A/B ran concurrently; the third dispatch hit the agent thread
limit. After A finished its frozen report, that worker was reassigned to C's disjoint evidence
directory. No active write ownership was reassigned. No application or authenticated workflow ran.

Frozen reports and final SHA256:
- `workflow/RESULT.md`: `097191ec4c6b7873026109e5fae6e6531099b0bef33d84da63e6f5175dadad8a`.
- `charles/RESULT.md`: `2f67ee07ff2e9335f994b612f7084486591c700e057ba357de9d51458666f39b`.
- `recommendations/RESULT.md`: `b07f07986f2a823529e3210fd8c6d97cfff6fc9676549f4746b6adeacd81809e`.
Paths are relative to the retained evidence root. Coordinator verification receipts are under
`coordinator/`; 24 cited source SHA256 values match their pinned files. No runtime PASS is inferred.

### Current findings and next work

1. **Concrete code gap: Fiction Grok launch compatibility.** `buildIdeaSpawn` in
   `src/fiction/idea-inbox.ts:330-341` and `buildRevisionSpawn` in
   `src/fiction/review-pr.ts:348-358` still append `--sandbox read-only`. Coordinator inspected both
   definitions and their execution paths. Prepared `SLICE-6D.md` owns those source/test pairs and
   requires actual fixture-child outcomes, not only argument assertions. Workspace mode does not
   enforce read-only behavior; preserve the existing text-return constraints and audit this boundary.
2. **Charles: no pending merge/build established.** Held commit
   `8aca13b1a7ecd11c63b513c231287bde71ed321b` is not an ancestor, but representative
   `4b95944de4f3ab297fe723fa9b0a2c5af7ee7c2a` is on main. Seven of nine changed artifacts match;
   remaining differences are master status and shared page, with no persona-specific difference
   found. Do not merge the held branch. Corrected the report's stale manual-policy inference;
   current publication policy is unchanged. Historical browser material is not new runtime proof.
3. **Fiction, Outreach and Human Inference Strategy/Signals:** source entrypoints/guards exist;
   the requested live exercises remain unrun. Future packets must pin selected inputs, disposable
   Git/data/secrets, execution budget and observable outputs. No repeated accepted canaries or real
   publication is authorized by this inventory. Data sufficiency remains uninspected.
4. **Recommendations:** account/source/baseline ledgers, readiness checks and pending mechanism
   safeguards exist, as does a specialized reviewed-dossier recommendation path. Corrected the
   initial worker's unsupported repository-wide missing-adapter claim. A limited file sample cannot
   establish absence. The exact next read-only assignment is the contracts/callers in
   `src/review/recommendations.ts`, `src/review/content-request.ts`,
   `src/review/content-request-store.ts`, and `src/review/treatment.ts`, their relevant tests, and
   the already cited dossier reader. It must identify whether reviewed Pattern evidence can reach
   a request and which guard applies, with a fixture acceptance proposal. No generic adapter is
   yet selected. Real reviewed inputs gate operational recommendations; they do not block independent
   fixture/interface preparation. Routine implementation choices within P2 remain coordinator-owned;
   only a major new product requirement needs an owner decision.

Selected next runtime packet: **6D**, dependency-ready once 6C closes. Recommendation integration
inspection can be prepared independently in a separately bounded packet. No Charles repair, policy
reversal, general recommendation feature, live input or publication target is invented here.

## Accepted closeout — 2026-09-08

Accepted documentation reconciliation. Coordinator reviewed the final three-path scope, exact Grok
definitions, source-hash receipts, Charles ancestry and all corrected reports. Whitespace, template
sections, links, START HERE fifteen-line limit and four pre-existing edit hashes passed. No runtime
gate, detached runtime checkout, browser check or external-model audit is required for these prose
changes; no runtime completion or real recommendation sufficiency is claimed.

Hygiene command exited 1: main rescued at `refs/wip/content-agents` snapshot `4435140`; no prunable
worktrees. All reported leftovers are explicitly dispositioned. This session created
`docs/operations/launch-slices/SLICE-6C.md` and `docs/operations/launch-slices/SLICE-6D.md`; both enter
the coordinator documentation commit with the master. No session source/worktree was created.
Retain bounded `/private/tmp/slice-6c-evidence/` (three reports and coordinator receipts); no duplicate
repository artifact is left untracked. No worker committed.

Preserve unchanged pre-existing edits in `AGENTS.md`, `docs/operations/launch-slices/SLICE-TEMPLATE.md`,
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`, and
`data/notes-spread-ledger.jsonl`. Preserve older branches `slice-5q-queue`, `slice-5r-routing`,
`agent/cs2-jobs-outreach-charles-extract`, `agent/cs2-page-room-pure-helpers`,
`agent/cs2-serve-walled-room-routes`, `agent/cs3-studio-durable-handoff`, and
`agent/cs6-parallel-safe-ui-completion`; none belongs to this slice. The hygiene tool's generic
decision count requires no owner escalation because these unrelated branches are intentionally
retained. Primary checkout stays main, no push. 6D is prepared but remains unstarted.
