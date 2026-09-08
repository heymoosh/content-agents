# SLICE-5W: Durable per-piece X opt-in

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin can deliberately include X for one otherwise excluded piece, and that decision survives
routing reruns and continuation. Default X exclusions accepted in 5R remain intact. An opt-in
changes routing only; it never approves, schedules, publishes, or changes derivative text.

## Difficulty

Hard — durable editorial intent must override the X editorial veto only for its own piece,
without weakening ordinary routing or approval/provider safety.

## Depends on

5R accepted (A6 durable opt-in follow-up); 5P accepted at 99336e2.

## Owned files

Preparation completed; exact immutable contract: `/private/tmp/slice-5w-evidence/preparation/interface.md`.
Actual bounded source evidence: `source-excerpts.md`; input pins: `input-hashes.json` in that directory.
These three files are packet-cited inputs for both lanes. Starting context remains protocol + packet.

Parallel-safe: **yes**, implementation A and independent verification preparation B have disjoint
write ownership. Neither runs repo-wide rewriting commands. Each check writes only lane-owned paths;
shared inputs are the preparation handoff plus repository HEAD 99336e2bfe16ee3dc62716acbc3fa4607372a041.
B may not read A's unfinished output. Actual candidate verification waits for A's completed frozen
handoff and coordinator-provided detached verification checkout. Integration and audit remain serial.

### Lane A — implementation and focused regression proof

- Worktree: `/private/tmp/content-agents-5w-build` (detached base 99336e2; do not commit).
- Owned: `src/strategy/route.ts`, `src/strategy/route.test.ts` in that worktree only;
  `/private/tmp/slice-5w-evidence/builder/` for all temporary fixtures/logs.
- Deliver the frozen interface's strict versioned `routing-intent.json`, opt-in/revoke/help CLI,
  X-only transform before source-triage/origin safety, documentation in generated routing header/help,
  and outcome-focused regression tests. Required brand + pillar + folder; mutually exclusive
  management flags; reject --all/--flags/--explore combinations before writes.
- Exact schema `{ "version": 1, "x_opt_in": true|false }`; absent=false. Unknown fields are
  rejected without mutation, not silently discarded. Reject escaping paths and metadata symlinks;
  failed writes do not reroute. Avoid exposing internal exception plumbing in user copy.
- Bounded read-only imports/callers needed for these paths permitted; no broad repository context.
  Existing tests using temporary folders must remain supported where possible; management must
  validate canonical content containment. Frozen compatibility decision: ordinary external/temp
  --folder routing remains supported but never consumes X intent outside canonical repo/content;
  malformed in-content intent aborts before rewriting routing. Reject duplicate/missing CLI values
  before management writes. No persisted routing confidence grammar change.
- Check: `node --import tsx --test src/strategy/route.test.ts`, unsandboxed, retain TAP + exit.
  Temp tests must write only builder-owned temporary locations (set TMPDIR if necessary).
- Handoff: stop edits; return candidate diff, changed list, actual numbered relevant source bodies,
  focused proof, hashes, and every affected symbol's bounded use search. No full gate.

### Lane B — independent black-box verification preparation, then frozen-candidate check

- Own only `/private/tmp/slice-5w-evidence/verifier/` (harness, fixture construction, logs).
- Prepare against immutable interface and pinned package.json/router/source-triage/config excerpts;
  may read pinned imports required to isolate analytics and determine safe fixture context.
- Build a black-box harness that invokes the real `npm run route` commands from the interface.
  No helper-only proof. Cover two folders, separate-process rerun, revoke/repeat, malformed and
  unsupported metadata, later reflective source veto, path/metadata symlink rejection and write
  failure where feasible. Compare non-X output and source/extract/queue sentinel hashes.
- No source edits. No real repository content/data or provider/model calls. Isolate analytics,
  operational context and fixture paths. Harness preparation is not a passing result.
- Handoff checkpoint: report ready with harness hash and required setup. Wait for coordinator's
  immutable candidate path before running actual verification. Run only within your fixture root
  using that candidate; no reads of builder's changing worktree.

### Coordinator

Owns packet/master and `/private/tmp/slice-5w-evidence/coordinator/`; freezes worker handoffs,
arranges isolated checkouts/setup, submits bounded Grok review, final gate and commit. Prior
preparation ownership is complete; these assignments replace it at the frozen checkpoint.

## Do not touch

- Existing `content/<slug>/**`, operational data, databases, provider state, credentials.
- `AGENTS.md`, `SLICE-TEMPLATE.md`, other sessions' edits, backlog, protected `.claude/skills/**`.
- Other platforms' hard-veto behavior; publishing/approval/scheduler policy.

## Cited headings

`docs/operations/launch-slices/SLICE-5R.md` → A6 and Accepted closeout evidence (read-only).
No master archive headings.

## Acceptance

- [x] A1 — Without an explicit opt-in, all six pillar routing defaults and mixed-tag hard veto
      behavior remain unchanged, including high-score data routing.
- [x] A2 — An explicit operation opts one selected piece into X, records durable intent, and
      rerouting/continuation preserves an X include despite that piece's nontechnical editorial veto.
- [x] A3 — A second folder remains excluded. The generated routing reason identifies the explicit
      exception. Other platforms and extraction/source provenance remain unchanged.
- [x] A4 — Explicit revoke restores ordinary routing on the next rerun; repeated set/revoke is
      deterministic and does not erase unrelated metadata or artifacts.
- [x] A5 — Missing metadata means no exception; malformed/unsupported metadata and failed writes
      do not silently authorize X. Metadata handling uses bounded validated folder paths.
- [x] A6 — User-facing help or existing routing documentation gives exact set, rerun, and revoke
      steps. It does not suggest hand-editing generated routing.md as a durable solution.
- [x] A7 — Disposable end-to-end verification invokes the actual supported routing interface,
      checks output after a separate-process rerun and revoke, and verifies isolation/defaults.
      No live provider or paid model calls; no real content or operational state mutations.
- [x] A8 — Cross-family Grok audit closes established defects/material gaps, then a frozen
      unsandboxed repository-wide gate passes. Coordinator commits only reviewed slice paths.

## Verify

Lane A (unsandboxed, in its implementation checkout):
```
node --import tsx --test src/strategy/route.test.ts
```
Lane B: prepare `/private/tmp/slice-5w-evidence/verifier/verify.mjs`; exact invocation and
isolation contract must be recorded before frozen-candidate execution. Assert actual CLI outcomes.
No live canary or paid model budget.
Coordinator runs `npm run worktree:setup` once per fresh worktree; after Grok audit closure,
run unsandboxed `npm run check` once on frozen candidate with the existing serial Node shim.

## Observable result

Muxin deliberately enables X for one piece, reruns routing, and still sees X included with a
clear opt-in reason; revoking restores its ordinary exclusions.

## Risk

Medium — cross-family audit required: yes. Routing exception only, no dispatch authorization.

## Families

- Preparation: Codex GPT-5.6 Terra, high effort (bounded source/interface investigation).
- Lane A builder: Codex GPT-5.6 Terra, high effort (initial bounded backend implementation; thread limit prevents a new tier-specific worker).
- Lane B verifier: Codex GPT-5.6 Terra, high effort (independent bounded black-box harness).
- Auditor: Grok 4.5, `--sandbox workspace`, no modifications, path:line evidence.

## Closeout

PASS — accepted 2026-09-08. Grok PASS; focused 46/46; independent CLI 12 groups;
frozen unsandboxed `npm run check` exit 0, 4332/4332 tests, 494 suites, no failure/cancel/skip/todo.
Coordinator runs `bash scripts/repo-hygiene.sh --rescue` and commits only the reviewed four paths.

## RESULT BLOCK

- Changed paths: `src/strategy/route.ts`, `src/strategy/route.test.ts`; coordinator owns this
  packet and `docs/content-studio-master-status.md` in the same integration commit.
- Outcome: PASS. Explicit per-piece X opt-in survives normal continuation routing; revoke
  restores defaults. Source/origin safety, other platforms, extraction and approvals unchanged.
- Checks: 46 focused tests; 12 independent actual CLI groups; Grok audit PASS; final frozen
  full gate 4332/4332, exit 0. Dangling-symlink finding reproduced, fixed and independently closed.
- Evidence: `/private/tmp/slice-5w-evidence/` (`preparation/`, `builder/`, `verifier/`, `coordinator/`).
- Unresolved: no material defects. Optional broader CLI matrix/skill docs recorded below.

## Findings checkpoint

F1 was established by independent black-box verification: dangling metadata symlink was followed and
created an outside target before exit 1. Closed by explicit lstat and O_NOFOLLOW; focused regression,
independent full harness rerun and Grok audit all pass.
Evidence: `/private/tmp/slice-5w-evidence/verifier/result-2026-09-08T18-04-12.884Z.json`.
Closure: lstat/no-follow validation before mutation; regression asserts target absent and
prior routing unchanged; affected-symbol search, independent rerun and Grok review completed.
F2 closed: generated multi-pillar header acknowledges explicit X exception and later safety
restrictions. Same owned-file repair, reviewed in final candidate.

## Audit-cleared handoff — 2026-09-08

- Candidate: only `src/strategy/route.ts` and `src/strategy/route.test.ts`; base `99336e2`.
  Hashes: `9ea90526350b85e489ff5886ce72001d1a8d4516e282e6208f9c17262306e61a` and
  `59b162c75be5079051e8f62c15c7dc9077cab7efe2ad73320088076c792cd7f3`.
- Focused route check: 46/46 pass, unsandboxed exit 0; builder evidence `route-test-repair.tap`.
- Independent actual npm CLI harness: 12 groups pass, exit 0; verifier evidence
  `result-2026-09-08T18-07-29.981Z.json`. Set/repeat/fresh rerun/revoke/repeat preserve non-X
  rows, source/extract/queue sentinels and other folder; later reflective veto remains effective.
  Malformed/unsupported intent, symlinks (including dangling), and write failures fail safely.
- Grok 4.5 `--sandbox workspace`, exit 0, PASS A1–A7 and audit portion A8. Both F1/F2 closed.
  Evidence `/private/tmp/slice-5w-evidence/coordinator/grok-result.txt` and `grok-exit.json`.
- Nonmaterial coverage dispositions: all-six/high-score defaults are existing focused tests plus
  unchanged decision logic; origin-after-opt-in and outside-folder management rejection are
  focused-tested. Harness covers one cold-start pillar and later source-triage veto. Extra CLI
  matrices are optional, not blockers. Protected atomize skill edits remain out of scope; help
  and generated routing header document exact commands. No speculative filesystem race expansion.
- Preparation and implementation/verifier handoffs were serialized; implementation and verifier
  tooling preparation ran concurrently with disjoint ownership. Actual verifier waited for each
  frozen candidate. Two harness rationale assumptions were corrected separately from the real
  F1 defect; see verifier `run-history.md`. No source work duplicated across workers.
- Gate completed afterward: exit 0, 4332/4332 tests, 494 suites; duration 668848 ms.
  Exact process timing in coordinator `final-gate-exit.json`; full TAP in `final-gate.txt`.

## Accepted closeout

2026-09-08: PASS. Both coordinator findings closed by focused regression, independent CLI outcomes
and Grok review before the one final gate. No provider/model canary or real content/database edits.
The canonical `routing-intent.json` records a boolean; it grants routing inclusion only, never approval.
The completed gate candidate stayed byte-identical to its retained frozen diff. Only acceptance
and hygiene prose was added afterward; source hashes match the audited and tested candidate.

Three session-created worktrees removed after exact patch/untracked checks:
`/private/tmp/content-agents-5w-build`, `/private/tmp/content-agents-5w-verify`,
`/private/tmp/content-agents-5w-frozen`. No branches created. A temporary packet copy in the builder
worktree was removed at the initial assignment checkpoint; the primary packet is canonical.
Verifier removed every unique fixture and fixture database. Evidence and harness remain outside
the repo under `/private/tmp/slice-5w-evidence/`; no shadow source files remain in the repo.

Actual builder/verifier model: Codex Terra high. Runtime agent thread capacity prevented a new
xhigh assignment; no claim of a model-tier increase is made. The bounded repair produced new
evidence and closed in one cycle; cross-family Grok 4.5 remained the independent auditor.

Hygiene --rescue returned 1 for expected candidate/unrelated changes and existing branches;
retained rescue snapshot `9ec98da`. No prunable worktrees. The only session-created untracked
repository path, `docs/operations/launch-slices/SLICE-5W.md`, is committed with the candidate.
Pre-existing paths preserved, hash-verified unchanged and excluded:

- `AGENTS.md`
- `docs/operations/launch-slices/SLICE-TEMPLATE.md`
- `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`
- `data/notes-spread-ledger.jsonl`

Other work is left intact: merged `slice-5q-queue`, `slice-5r-routing`; local-only
`agent/cs2-jobs-outreach-charles-extract`, `agent/cs2-page-room-pure-helpers`,
`agent/cs2-serve-walled-room-routes`, `agent/cs3-studio-durable-handoff`,
`agent/cs6-parallel-safe-ui-completion`. These are outside this slice, not acceptance blockers.
Exact output retained in coordinator `hygiene.txt`; no push.
Next dependency-ready plan work: analytics brand_id backfill; a bounded packet is needed.
