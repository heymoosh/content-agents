# SLICE-6X: first-time approved rows schedule in Studio without a per-row one-off

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin can approve a queue row in Studio's Publishing room and schedule it, first time, with no
coordinator running a one-off seeding script — and the safety property that produced the block is
still intact: a row with no recorded creation-and-approval provenance is still refused, never
silently treated as approved.

6W shipped `bluesky-2` only by seeding that one row's journal by hand
(`scripts/slice-6w-seed-provenance.ts`). Every other approved row in the tree is still refused by
`approvalSchedulingBlock` with "this row has no verifiable creation and approval provenance".
This slice makes that general: production row creation records provenance, and rows that predate
the journal get one explicit, fingerprint-checked adoption path instead of a bespoke script.

## Difficulty

hard — the module being changed is the double-post safety gate for real social accounts, so a
loosened disposition is a live-account defect, not a test failure.

## Depends on

6W (accepted).

Delivery batch: 6X alone. Deliverable: implementation. Acceptance order: acceptance items below in
order; stop when all are closed or one is engineering-blocked. A free slot does not authorize
pulling another slice.
Owner checkpoint: none required before work. Muxin's only human step is the design sanity check
confirmation on the refusal/recovery copy at acceptance. Do not ask her to choose a route: the
product goal is fixed above and the route is an engineering decision.

## Owned files

Parallel-safe: **no**. The creation path (`src/publish/queue.ts`), the disposition/gate
(`src/review/approval-provenance.ts`) and the route that renders the refusal
(`src/review/serve.ts`) are one invariant expressed in three places; any split has two lanes
editing the same disposition type and the same test files, which the protocol's disjoint-write
condition forbids. Verification tooling is not separable either — the e2e journey asserts the
exact strings the gate returns. A second assignment would re-read the same module to reach the
same conclusion, so it adds coordination cost with no independent deliverable.

### Lane A — the general provenance fix and its proof (single worker)

- `src/review/approval-provenance.ts`
- `src/review/approval-provenance.test.ts`
- `src/publish/queue.ts`
- `src/publish/queue.test.ts`
- `src/review/serve.ts`
- `src/review/serve.test.ts`
- `src/review/publishing-status.ts`
- `src/review/publishing-status.test.ts`
- `scripts/slice-6w-seed-provenance.ts`
- `scripts/reconcile-approval-provenance.ts` (new, if the adoption path lands as a script)
- `e2e/pass-e-provenance.ts` (new, if a new pass file is used)
- `e2e/run-all.ts` (registration line only)
- this packet, and `docs/operations/launch-slices/SLICE-6X-LOG.md` if dated records accrue

## Do not touch

- `docs/content-studio-master-status.md` — the coordinator edits it at closeout.
- `docs/content-agents-backlog.md` — board writes go through `prose_kanban` only.
- `scripts/slice-6w-retry-bluesky-2.ts` — 6W's retained provider evidence.
- Real operational data under `data/` — no edits to `data/approval-dispatch-safety.jsonl`,
  `data/publishing-status.jsonl` or `data/cost-log.csv`. Tests write a scratch root only.
- Any live provider call. This slice needs no Postiz, Typefully or network dispatch at all.
- `config/*.yaml`.

## Cited headings

`docs/content-studio-master-status.md` → `## Standing constraints`

## Acceptance

- [ ] A row appended through `appendRows` and then approved through `commitReviewStatus` yields
      `approvalSchedulingBlock(...) === null`, asserted in a committed unit test, with no seeding
      script involved.
- [ ] Every production code path in `src/` that appends a row to a content folder's
      `review-queue.md` records a `created` event for that row. The RESULT BLOCK names each such
      path by `file:line` and names the test that proves it for each.
- [ ] A row with zero journal events is still refused: `approvalDispatchDisposition` returns
      `{ kind: "legacy" }` and `approvalSchedulingBlock` returns a non-null string. A committed
      test asserts this, so adoption is never automatic.
- [ ] An explicit adoption path exists that a coordinator can run for a pre-existing row. It
      records the row's current asset fingerprint, and it refuses (non-zero exit or thrown error,
      with no journal append) in each of these cases, each asserted by a committed test:
      the fingerprint cannot be computed; the row already has journal events; the row's status is
      not `approve`.
- [ ] `scripts/slice-6w-seed-provenance.ts` either no longer exists in the tree, or its first ten
      lines state it is superseded and name the general adoption path.
- [ ] The refusal string a blocked row shows in Studio's Publishing room names the recovery action
      in plain language. The RESULT BLOCK quotes the exact string.
- [ ] The refusal/recovery copy contains no em dash and no AI tell per `config/voice.yaml`.
- [ ] Design sanity check, confirmed by the auditor from rendered HTML, not from intent: body type
      at least 1.125rem with line height 1.5 or more; Muxin's content first with ids and slugs
      demoted to muted lines; one clear divider between one thought and the next; the refusal stays
      on screen until read; the page is scannable at arm's length without zoom. Record each of the
      five as pass or fail.
- [ ] `npm run check` exits 0. The RESULT BLOCK records the pass/fail/skip counts.
- [ ] `npm run test:e2e` exits 0 and its run includes the new or extended journey below. The
      RESULT BLOCK names the journey and its result.
- [ ] `git status --porcelain` shows no modification to any path under `data/`.

## Verify

Classification and applicable gate: **meaningful behavior / high risk**. This module is the gate
that stops a second dispatch to a real social account; a wrong disposition posts twice or blocks
everything. Required: the focused unit checks below, the e2e journey, the repository-wide gate,
and a bounded cross-family audit before integration.

For UI changes: journey is Studio's Publishing room — approve a row, press Schedule, see it
scheduled; error/recovery path is a row with no provenance, which must show the refusal and its
named recovery and must dispatch nothing. Viewports: desktop 1280 wide and narrow 768. No feature
flag. Fixture backend only — no live provider, so live integration is not applicable and must be
recorded as such. Observable assertions: the scheduled row's new state is readable from the page,
and the refusal text is present in the rendered HTML. Retain candidate identity, commands, exit
codes and counts, plus the rendered-HTML evidence the design items are judged from.

Run unsandboxed. In a fresh worktree run `npm run worktree:setup` once first.

```
node --import tsx --test src/review/approval-provenance.test.ts src/review/publishing-status.test.ts src/publish/queue.test.ts src/review/serve.test.ts
npm run test:e2e
npm run check
git status --porcelain
```

## Observable result

Muxin approves a row in the Publishing room and the Schedule button works on the first try. A row
that genuinely lacks provenance still refuses, and the refusal tells her what to do about it in a
sentence she can act on.

## Risk

**high** — audit required: **yes**. The change edits the disposition function guarding duplicate
dispatch to live accounts; a permissive `legacy` branch would be invisible in green tests and
expensive in production.
Review boundary: this candidate.
Review scope/budget: one bounded review at ordinary-to-high effort. Unanswered questions for the
auditor: does any new or changed branch let a row reach `fresh` without both a recorded creation
and a completed approval transition; does the adoption path admit a row whose asset changed after
approval; is any existing refusal branch now unreachable. Bounded inputs: acceptance criteria
above, the candidate diff, the changed-file list, and the focused check output. The auditor must
request bounded excerpts rather than assume unseen code.
Prior accepted evidence: 6W's accepted `bluesky-2` delivery evidence stays accepted and is not
re-audited. It reopens only if this slice changes the semantics of an event kind already written
to the live journal.
On reviewer outage: mark the candidate review-blocked, record the retry condition in `## Stopped`,
and do not integrate. Independent authorized work while blocked: the e2e journey and the
rendered-HTML design evidence, both of which stand on their own.

## Families

- Builder: Codex / GPT family, mid-tier at medium effort, escalated to high effort on a first
  failed acceptance — backend invariant work, the repository's stated backend default.
- Auditor: Claude family, high effort — different family from the builder, and high effort is
  justified by a live-account double-dispatch invariant rather than chosen by default. If Claude
  audit tooling is unavailable, use the Grok family with the `### Grok CLI on this Mac` launch fix
  in the bindings; never substitute a same-family reviewer.

## Closeout

Closeout gate: this repository's binding is `none`. Record a line beginning `**PASS**` followed by
the date, or an explicit list of what is left, in this packet before the slice closes. Do not put
a command in this slot.

Preflight: every acceptance item above maps to a named committed test, a quoted string, a recorded
exit code or a recorded design pass/fail; the candidate is pinned and its changed paths listed;
Lane A owns every changed path; the cross-family audit has a verdict; no final-gate prerequisite is
open.
Gate cost: `npm run check` on the pinned candidate, run unsandboxed. Record measured local elapsed
time with evidence, or `unknown`. A rerun needs a distinct named reason — a documentation-only edit
to this packet does not justify one.

Hygiene: run `bash scripts/repo-hygiene.sh --rescue`, review its output, and assert all four in the
RESULT BLOCK: the command was run; its output was reviewed; every path this session created was
committed or deleted, each named; every other path it listed was named and left in place. A bare
exit code is not an acceptable entry — a non-zero exit is expected whenever other sessions have
pending work.

Read-set print: use the `### Read-set measurement` commands in
`docs/operations/slice-protocol-environment.md`, substituting `SLICE-6X.md`.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
- Delivery state and next action: <built | verified | accepted | committed; workers cannot accept/commit>
- Usage: <local check elapsed time separately from model calls/provider-reported usage;
  unavailable values `unknown`; prior history behind evidence pointers>

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Extra lanes: none — serial, because a second lane would edit the same disposition module and its
  tests and would re-read the same code to reach the same conclusion.
- Assignment: one worker, Codex mid-tier at medium effort, fresh packet-sized context. Reuse the
  same worker for repairs arising from the audit, since its retained context is the cheapest route
  to a fix. Freeze the handoff before the audit.
- Evidence return: command, exit code, pass/fail/skip counts, candidate identity, one short result
  line, and pointers to rendered-HTML and e2e artifacts on disk — never pasted logs.
- Capability boundary: run closeout once, after the audit closes and the gate passes. Use
  completion notifications; do not poll a running check.
