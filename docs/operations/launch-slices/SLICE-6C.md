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
