# SLICE-6L: make the UI journey gate produce citable evidence

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

The protocol requires UI journeys run on the frozen candidate and that a slice retain "the
candidate/build identity, command, exit code, passed/failed/skipped counts and reasons, and
screenshots/traces". This repository has the runner — `npm run test:e2e` drives real Playwright
journeys through `e2e/run-all.ts` — but it emits nothing a packet can cite in that shape, so no
slice has ever satisfied that requirement. This slice makes the runner emit one summary artifact
carrying exactly those fields, backed by a tested summariser, and records one real run of it.

## Difficulty

hard — the value is in the counts being true. A summariser that reports zero failures because
every journey was skipped, or that reports a stale run's counts, is worse than no artifact at all,
so skip accounting and run identity are the parts that carry the risk.

## Depends on

none

Delivery batch: 6K and 6L only. Both are implementation deliverables, both are dependency-ready
now, and they own disjoint paths, so they may run concurrently in separate sessions. Acceptance
order is independent. Stop condition: both accepted, or either one stopped under
`### Stopping without acceptance`. A free slot does not authorize a third slice.
Owner checkpoint: none. The artifact's format, field names and location are engineering choices.
A red suite is not an owner question either — see the branch under `## Acceptance`.

## Owned files

Parallel-safe: no — within this slice the summariser and the runner's emit call are one change;
a second worker would have to read the first's unfinished output to know what to summarise, which
the protocol forbids. Across slices, 6K and 6L are genuinely parallel: disjoint owned paths,
neither runs a repo-wide rewriting command, and each one's focused checks write only inside its
own owned paths.

### Lane A — the journey summary

- `src/operations/e2e-summary.ts` (create `src/operations/` if absent)
- `src/operations/e2e-summary.test.ts`
- `e2e/run-all.ts` — the emit call only
- `e2e/RESULTS.md`, `e2e/results.jsonl` — regenerated output, not hand-edited

## Do not touch

- `docs/operations/slice-protocol-environment.md` — the bindings row naming this gate is the
  coordinator's integration commit, not the worker's. 6K is blocked from this file for the same
  reason; two lanes must never own one path.
- `docs/content-studio-master-status.md`
- `src/operations/freeze-candidate.ts` and its test — owned by 6K
- Any path under `src/` other than `src/operations/e2e-summary*.ts`
- `package.json` — owned by 6K this batch; `npm run test:e2e` already exists and needs no entry
- Any existing `data/` file, `.env`, or `docs/content-agents-backlog.md`
- Production feature flags and any preview the owner is using

## Cited headings

none

## Acceptance

- [ ] `src/operations/e2e-summary.ts` exists and exports a pure function that takes the runner's
      per-journey result records plus a run identity (candidate sha, command string, exit code)
      and returns a summary object. It performs no filesystem read and no filesystem write.
- [ ] The returned summary carries all six of: candidate sha, the exact command string, the exit
      code, a passed count, a failed count, and a skipped count. Every failed or skipped journey
      appears in the summary by name with a reason string; a skip with no reason is a refusal, not
      an empty string.
- [ ] The counts are derived from the per-journey records, not passed in. A test asserts that
      passed + failed + skipped equals the number of records supplied.
- [ ] A test asserts that a run in which every journey skipped produces a summary whose passed
      count is 0 — it must not be representable as a clean pass.
- [ ] `e2e/run-all.ts` calls the summariser and writes its output to a fixed artifact path under
      `e2e/`, and that write happens on both the all-passed and the any-failed path.
- [ ] `src/operations/e2e-summary.test.ts` exists, is discovered by `npm test`
      (`src/**/*.test.ts`), and every test in it asserts the returned summary value. No test
      asserts only that the summariser was called or an argument was passed.
- [ ] `npm run check` exits 0, run unsandboxed.
- [ ] The RESULT BLOCK records one real `npm run test:e2e` run against this candidate: the exact
      command, its exit code, the candidate sha, the six summary fields, and the artifact path.
      **If that exit code is non-zero**, the RESULT BLOCK names every failed journey and its
      reason, and the slice takes `### Stopping without acceptance` rather than being accepted.
      A green suite is not this slice's deliverable; a truthful, citable one is.
- [ ] `bash scripts/repo-hygiene.sh --rescue` was run and every path this session created was
      committed or deleted by name.

## Verify

Classification and applicable gate: meaningful behavior / high risk. This changes what a gate
reports, and `e2e/run-all.ts` is an executable input. The repository-wide gate applies; the
documentation-only exception does not.

For UI changes: this slice changes no page, no component and no user-visible copy, so the standing
design sanity check does not apply — record that in the RESULT BLOCK rather than leaving it
unstated. The affected journeys are whichever ones `e2e/run-all.ts` already drives; do not add,
remove or reorder journeys in this slice. Viewports, feature-flag state and fixture-versus-live
posture stay exactly as the existing suite sets them. Run the suite unsandboxed. Retain the
Playwright output on disk and point at it; do not paste it. Live integration: whatever the
existing suite already does — this slice does not change it.

```
npm run worktree:setup   # only in a fresh worktree, once
npm run test:e2e         # unsandboxed; record exit code, do not pipe through tail
npm run check            # unsandboxed; under the sandbox it reports ~196 phantom venture failures
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

After one `npm run test:e2e`, the coordinator opens one artifact and reads the candidate sha, the
command, the exit code and the three counts with every failure and skip named. A packet can copy
those six fields into a RESULT BLOCK and an auditor can check them without the repository tree.

## Risk

medium — audit required: yes. Every future non-documentation slice will cite this artifact as its
UI journey evidence, so a summariser that undercounts skips or reports a stale sha would make
those citations false while looking rigorous.
Review boundary: this candidate.
Review scope/budget: ordinary effort, one bounded review. Two fixed questions for the auditor:
(1) can any input produce a summary whose counts do not sum to the records supplied, or whose sha
is not the sha of the run that produced those records; (2) can an all-skipped run be read as a
pass by anyone reading only the artifact.
Prior accepted evidence: none retained; this is new emission.
On reviewer outage: mark the candidate review-blocked, record the retry condition in `## Stopped`,
and do not integrate. 6K is independent authorized work and may continue.

## Families

- Builder: Claude, mid-tier model, medium effort — one lane, no escalation unless a first pass
  fails acceptance.
- Auditor: Grok, `grok-4.5`, ordinary effort — different family from the builder, and a different
  family from 6K's auditor so the two parallel slices do not queue on one provider. Launch per the
  bindings' `### Grok CLI on this Mac`: `--sandbox workspace` (read-only refuses to start here),
  `--no-subagents --disable-web-search --max-turns 3`, prompt supplied by `--prompt-file`. Give it
  the acceptance list above, not only the protocol prose. Workspace sandbox is not read-only
  enforcement: inspect the diff afterwards.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md`
for the closeout gate item — a `**PASS**` line with a date or an explicit leftover list, never a
fenced command.

Preflight: candidate sha pinned and changed paths listed; every acceptance item above mapped to a
named test or a recorded command output; both `npm run test:e2e` and `npm run check` exit codes
captured by exit status, not by reading piped output; audit findings separated into established
defects, verification gaps and optional improvements, with every material finding closed by a fix
plus evidence or an explicit disposition.
Gate cost: `npm run check` on the frozen candidate, run once, last, after the journey run. Record
measured local elapsed time for each of the two commands separately from model usage; mark
provider-reported usage `unknown` if unavailable. Do not rerun either for paperwork.

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for the
hygiene item — not a bare exit code. Expect a non-zero exit: other sessions have pending work,
several `/private/tmp/content-agents-6d-*` checkouts and unmerged `agent/cs*` branches. Name each
path this session created and settled, and name each path left in place. Regenerated
`e2e/results.jsonl` and `e2e/RESULTS.md` are this session's paths and must be settled by name.

Use the `### Read-set measurement` form in `docs/operations/slice-protocol-environment.md` for the
closeout read-set print — not an ad hoc re-derivation.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths: `src/operations/e2e-summary.ts` (new), `src/operations/e2e-summary.test.ts` (new,
  9 tests), `e2e/run-all.ts` (emit call: candidate sha via `git rev-parse HEAD`, command string,
  calls `summarizeE2ERun`, writes `e2e/e2e-summary.json` on both the all-passed and any-failed
  path), `.gitignore` (added `e2e/e2e-summary.json`).
- Outcome: implementation complete per Acceptance. `npm run test:e2e` on this candidate exited
  non-zero — per Acceptance's branch, this candidate takes `### Stopping without acceptance`.
- Checks run and results:
  - `node --import tsx --test src/operations/e2e-summary.test.ts`: 9/9 pass (0.28s).
  - `npm run test:e2e` (unsandboxed, candidate sha `83f9aa4337cd1ac1243a1cb01bf1d45951c513ff`):
    exit 1. 35 passed, 2 failed, 16 skipped. Failed: "A-reads: Content opens request-grouped
    approval before the separate Publish step"; "B-writes: Content grouped approval reports
    injected provider success and retained failure separately" (reason: `success=undefined/
    undefined; failure=undefined/undefined`). Separately, the runner's own isolation check
    reported `E2E isolation failure: shared worktree changed (data/analytics.db-shm,
    data/analytics.db-wal)` — not a journey record, but forces the runner's exit code to 1.
    Neither failure touches this slice's owned paths; both pre-exist this change.
  - `npm run check` (unsandboxed): exit 1. Isolated via standalone `npm test`: 4373 tests, 4372
    pass, 1 fail — `not ok 1622 - SLICE-5Z: real isolated Claude/Codex children determine GUI job
    outcomes and leave only fixture evidence` (`src/review/jobs.test.ts:72`). Unrelated file,
    outside this slice's owned/touched paths — pre-existing, not introduced by this change.
  - `bash scripts/repo-hygiene.sh --rescue` (unsandboxed): exit 1 (expected, non-zero per packet).
    This session's uncommitted paths (`.gitignore`, `e2e/run-all.ts`,
    `src/operations/e2e-summary.ts`, `src/operations/e2e-summary.test.ts`, plus this repo's
    pre-existing dirty `content/.../review-queue.md` and `data/notes-spread-ledger.jsonl` that
    predate this session) were snapshotted to `refs/wip/content-agents` (fc91b82) and left in
    place, uncommitted, for the coordinator. All other listed items (worktrees
    `content-agents-6d-fiction`/`-recommendations`/`-verify`, merged branches
    `slice-5q-queue`/`slice-5r-routing`, unpushed branches `agent/cs2-*`, `agent/cs3-*`,
    `agent/cs6-*`, `closeout/6k-status`) belong to other sessions; this worker created none of
    them and took no action on them.
- Evidence locations: `e2e/e2e-summary.json` (this run's summary artifact, all six fields
  present); full `npm test` log at `/tmp/claude/e6l-test-full.log`; Playwright/e2e console output
  retained in the background task transcript (task id `bosqyiafh`).
- Unresolved:
  - `npm run test:e2e` red per above — not this slice's problem to turn green, per packet.
  - `npm run check` red due to a pre-existing, unrelated failure in `src/review/jobs.test.ts`
    (SLICE-5Z) — outside this slice's owned files.
  - The isolation-check failure (`data/analytics.db-shm`/`-wal` changed) is a pre-existing runner
    behavior this slice did not introduce; not represented as a journey in the summary artifact
    since it isn't a per-journey record, only a whole-run isolation guard.
  - UI-change design-sanity check: not applicable — this slice changes no page, component, or
    user-visible copy, per the packet's Verify section.
- Delivery state and next action: built, not verified-clean, not accepted, not committed. Next
  action: someone re-runs `npm run test:e2e` on a clean, isolated checkout (no shared-worktree
  writers touching `data/analytics.db*`) to get a true read on the two failed journeys, since one
  of the two carries `success=undefined/undefined`, suggestive of a fixture/isolation issue rather
  than a real regression — but that determination is out of this slice's scope to make.
- Usage: `npm run test:e2e` real 5m4.8s; `npm run check` background run real 2m30.4s before
  truncated output required a standalone `npm test` isolation rerun (~2-3 min, not separately
  timed); `bash scripts/repo-hygiene.sh --rescue` well under a minute. Provider-reported model
  usage: unknown.

## Stopped

- Blocker: `npm run test:e2e` exited non-zero on this candidate (2 failed journeys + a
  shared-worktree isolation-check trip); per this packet's Acceptance branch, a non-zero e2e exit
  sends the slice here rather than to acceptance, regardless of cause.
- What was verified: implementation matches every other Acceptance item — pure summariser with no
  fs I/O, all six required fields present and correctly derived from records (9/9 unit tests
  including the all-skipped-is-not-a-pass case), `e2e/run-all.ts` writes the artifact on both the
  pass and fail path, `npm run check` isolated to one pre-existing unrelated failure
  (`src/review/jobs.test.ts`, SLICE-5Z). Neither red run touches this slice's owned paths.
- Retained work: `src/operations/e2e-summary.ts`, `src/operations/e2e-summary.test.ts`,
  `e2e/run-all.ts` (emit call), `.gitignore` — uncommitted in the main checkout, snapshotted to
  `refs/wip/content-agents` (fc91b82) by the hygiene rescue. `e2e/e2e-summary.json` from the run
  is on disk at that path.
- Next action: re-run `npm run test:e2e` on a checkout no other session is writing to (the
  isolation guard tripped on `data/analytics.db-shm`/`-wal`), to get a clean read on the two
  failed journeys before deciding whether they're a real regression or shared-worktree noise; then
  resume this packet from the retained diff above.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: serial within the slice — the summariser and the runner's emit call cannot be
  split without one worker reading the other's unfinished output. 6K is the parallel lane, and it
  is a separate packet with its own worker.
- Assignment: one Claude mid-tier worker at medium effort, fresh packet-sized context. Reuse it
  for audit repairs on this candidate; its retained context is what makes the repairs cheap.
- Evidence return: command, exit code, counts, candidate sha, one-line result, and pointers to the
  artifact and the Playwright output on disk. Do not paste transcripts or traces.
- Capability boundary: closeout runs once, after acceptance of this whole capability, not after
  each repair. Use completion notifications; do not poll an unchanged worker.
