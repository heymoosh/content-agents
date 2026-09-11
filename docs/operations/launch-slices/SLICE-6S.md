# SLICE-6S: fix the two pre-existing Pass D timeouts blocking SLICE-6M

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`npm run test:e2e` fails two Pass D journeys on `main` today, for two distinct, already-diagnosed
reasons — neither is a product defect:

1. `e2e/pass-d-editorial.ts:97` times out clicking `#charlesEditBtn`. That id does not exist
   anywhere in `src/` (confirmed by grep). Commit `92190d8` ("Charles combined-review layout —
   grouped outputs...") moved from one fixed-id edit button to a per-output button scoped inside
   each `article[data-charles-output="<id>"]`, using class `.charles-edit-btn` (no id) and a body
   container `.charles-body` (no id, and no id on the textarea it grows). The test never followed.
2. `e2e/pass-d-content-generation.ts:119` (and its two later `#captureVerdict` waits at ~140,
   ~150) intermittently time out on `#captureVerdict:not([hidden]) .cap-go`. That selector is
   fine — `#captureVerdict` and `.cap-go` both still render (`src/review/page.ts:1108`, `:6961`).
   The real cause: `POST /api/captures/classify` (`src/review/serve.ts:1500`) calls
   `routeCaptureWithModel` (`src/review/capture-router.ts`), which spawns a real subscription
   model call with a 60s internal timeout (`CAPTURE_ROUTER_TIMEOUT_MS`). `e2e/harness.ts`'s
   `EXPENSIVE_ROUTES` list exists precisely to abort routes that spawn a model job during e2e runs
   (its own comment: "Nothing here may spawn a model job... aborted at the browser"), but
   `/api/captures/classify` was never added to that list. So every Pass D run makes a live,
   non-deterministic model call that can legitimately exceed the test's 10s wait.

When this slice is done, both journeys pass deterministically without spawning a model job, and
`npm run test:e2e` no longer fails for either reason. This closes the blocker recorded in
`SLICE-6M.md` → `## Stopped` and `SLICE-6M-LOG.md`, so SLICE-6M's already-verified-correct diff
(sitting uncommitted at `refs/wip/wt-slice-6m`, commit `d881432`) can be re-verified end-to-end and
merged next.

## Difficulty

easy — both fixes are narrow and already root-caused. Fix 1 is a selector update to match markup
that already exists. Fix 2 is a one-line addition to an existing allowlist-style array, matching a
pattern the file already uses for 24 other routes.

## Depends on

none to build. SLICE-6M depends on this closing, but SLICE-6M's own diff is untouched and out of
scope here — see `## Do not touch`.

Delivery batch: 6S only. Stop condition: accepted, or stopped under `### Stopping without
acceptance`. A free slot does not authorize a second slice, including re-attempting 6M here.
Owner checkpoint: none.

## Owned files

Parallel-safe: no — one shared `npm run test:e2e` run verifies both fixes together; the whole
change is a handful of lines.

### Lane A — both Pass D fixes

- `e2e/pass-d-editorial.ts` — only the Charles direct-edit block (currently lines ~93-101: the two
  `#charlesEditBtn` clicks and the `#charlesBody textarea` locator/wait). Rescope every selector in
  that block to the `article[data-charles-output="${CHARLES_ID}"]` container already used earlier
  in the same file, targeting `.charles-edit-btn` and `.charles-body textarea` inside it.
- `e2e/harness.ts` — only `EXPENSIVE_ROUTES`: add `/api/captures/classify` to the array.

## Do not touch

- Every path under `src/`. Both selectors and the missing allowlist entry are test-side; nothing
  in the product's classify or Charles-edit behavior is wrong.
- `e2e/pass-a-reads.ts`, `e2e/pass-b-writes.ts`, `e2e/run-all.ts`, `e2e/isolation.test.ts`,
  `e2e/pass-c-*.ts` — SLICE-6M's own diff and unrelated files. Never stage or revert SLICE-6M's
  uncommitted worktree/branch (`wt-slice-6m`, `refs/wip/wt-slice-6m`); this slice does not touch it.
- `e2e/pass-d-content-generation.ts` itself — its three `#captureVerdict` waits and assertions stay
  exactly as written; none of them assert on `method:"model"` or a model-authored `reason` string
  (verified by grep), so the keyword-fallback verdict (Charles/Content by `classifyCapture`'s
  regex) satisfies every existing assertion once the model call stops firing. If any assertion
  there does turn out to require the model path, that is a finding to report, not a change to make.
- `package.json`, `docs/content-studio-master-status.md`, `docs/content-agents-backlog.md`,
  `docs/operations/launch-slices/SLICE-6M*.md`, `data/**`, `.env`.
- Any journey's presence, order, viewport, flag state, or fixture-versus-live posture.

## Cited headings

none

## Acceptance

- [ ] `#charlesEditBtn` and a bare `#charlesBody` no longer appear in `pass-d-editorial.ts`.
      Every replacement selector is scoped under `article[data-charles-output="${CHARLES_ID}"]`
      and matches markup present in `src/review/page.ts` at this candidate's sha (verifiable by
      grep, string by string).
- [ ] The direct-edit record still asserts save behavior, not just that a click succeeded: after
      the second edit-button click, the file on disk contains the appended text and the DOM no
      longer shows an edit textarea in that scoped container.
- [ ] `/api/captures/classify` appears in `EXPENSIVE_ROUTES` in `e2e/harness.ts`, in the same array
      form as its 24 existing entries (no separate allowlist mechanism invented).
- [ ] `e2e/pass-d-content-generation.ts` was not edited. Its `Studio capture persists in Content...`
      record and the two Charles-routing records after it still record `pass` with the abort now in
      effect (confirms the keyword fallback satisfies the existing assertions).
- [ ] Neither record was deleted, commented out, downgraded to `blocked`, or made to record a
      status other than `pass`/`fail`. Demonstrate this for the Charles direct-edit record by
      temporarily breaking its expected condition (e.g. point the selector back at a nonexistent
      id, or skip the second click), observing `fail`, and restoring — record what was broken and
      what was observed.
- [ ] `node --import tsx --test e2e/isolation.test.ts` exits 0.
- [ ] `npm run test:e2e` exits 0, run unsandboxed from a dedicated worktree, twice solo (no
      concurrent process — confirm via `pgrep`/`lsof` before each run), to rule out the flake this
      slice targets rather than banking one lucky pass. If any journey still fails, the RESULT
      BLOCK names it and its reason and the slice takes `### Stopping without acceptance`.
- [ ] `npm run check` was run unsandboxed and its result recorded. It is currently red on `main`
      for a pre-existing reason outside this slice (`src/review/jobs.test.ts`, SLICE-5Z). Do not
      assert exit 0. Assert instead that every failure it reports is reproduced with this slice's
      changes stashed out, and name each one.
- [ ] `bash scripts/repo-hygiene.sh --rescue` was run and settled per the `### Hygiene disposition`
      form (not a bare exit code).

## Verify

Classification and applicable gate: meaningful behavior / high risk. `e2e/*.ts` are executable
inputs and this slice changes what a gate reports (and, for harness.ts, what it is even allowed to
call). The repository-wide gate applies; the documentation-only exception does not.

For UI changes: this slice changes no page, no component and no user-visible copy — record that in
the RESULT BLOCK, and the standing design sanity check does not apply. Live integration: this
slice's whole point is to stop Pass D from making a live subscription-model call; after the fix,
`/api/captures/classify` is aborted at the browser like every other `EXPENSIVE_ROUTES` entry, same
as the rest of the suite's hermetic posture.

Run everything from a worktree dedicated to this session that no other session is writing to.

```
npm run worktree:setup                       # once, in the fresh worktree
node --import tsx --test e2e/isolation.test.ts
npm run test:e2e                             # unsandboxed; run twice solo; record exit code, do not pipe through tail
npm run check                                # unsandboxed; under the sandbox it reports ~196 phantom venture failures
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

`npm run test:e2e` exits 0 twice in a row with neither Pass D journey failing, and the Charles
direct-edit record still turns red if editing or saving breaks.

## Risk

medium: audit required yes. Fix 2 removes a live model call from a test path; the audit must
confirm nothing downstream actually depended on receiving a real model verdict rather than the
keyword fallback, and that no other still-passing assertion was quietly weakened to get there.
Review boundary: this candidate.
Review scope/budget: ordinary effort, one bounded review. Three fixed questions for the auditor:
(1) does the rescoped selector still fail if editing/saving breaks; (2) do untouched
`pass-d-content-generation.ts` assertions still hold once classify is aborted; (3) does the diff
touch `src/` or change product behavior.
Prior accepted evidence: none; root-cause diagnosis (grep evidence) is in `## Goal` above.
On reviewer outage: mark the candidate review-blocked, record the retry condition in `## Stopped`,
and do not integrate.

## Families

- Builder: Claude, mid-tier model, medium effort, one lane, fresh packet-sized context.
- Auditor: Codex (GPT), different family from the builder, ordinary effort. Launch
  `codex exec --sandbox read-only` unsandboxed locally — the sandboxed launch fails with
  `Operation not permitted` here, and the default model is required because `gpt-5.1-codex` is
  rejected on this account. Supply the acceptance list and the candidate diff, not only prose.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md`
for the closeout gate item — a `**PASS**` line with a date or an explicit leftover list, never a
fenced command.

Preflight: candidate sha pinned and changed paths listed; every acceptance item mapped to a named
command output or quoted diff hunk; both gate exit codes captured by status, not piped output; the
deliberate-break demonstration recorded with what was broken and observed; audit findings
separated into defects, verification gaps and optional improvements, each closed with evidence.
Gate cost: `npm run check` on the frozen candidate, run once, last, after the journey run. Record
elapsed time per command separately from model usage; mark usage `unknown` if unavailable. Do not
rerun either for paperwork.

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for the
hygiene item — not a bare exit code. Expect a non-zero exit: other sessions have pending work,
including SLICE-6M's own retained `refs/wip/wt-slice-6m` snapshot — name it as prior work, not
this session's, and never remove it. Name every path this session created and settled, and every
other path left in place.

Use the `### Read-set measurement` form in `docs/operations/slice-protocol-environment.md` for the
closeout read-set print, not an ad hoc re-derivation.

## Stopped

Full RESULT BLOCK/evidence: `SLICE-6S-LOG.md` → `## Stopped — 2026-09-10` (not read at start).
Both assigned fixes verified correct against baseline (crash reproduced, both diagnosed bugs
confirmed). Blocker: `test:e2e` exit 1 from two further, pre-existing bugs in
`pass-d-content-generation.ts` (do-not-touch), reachable only once this slice's fixes stop the
earlier crash from masking them: (1) `session.blockedCalls` accumulates whole-session, so this
fix's own correct classify-aborts trip a later `blockedCalls.length===0` check at line 236; (2) a
fiction-refusal string the test expects (line 288) exists only in the test, nowhere in `src/`.
Retained: `pass-d-editorial.ts`/`e2e/harness.ts` uncommitted in `wt-slice-6s` (branch
`slice-6s-worker`), snapshotted to `refs/wip/wt-slice-6s` (`c140a6e`). Next: owner accepts 6S's own
fixes on the narrower bar, or a new slice fixes both `pass-d-content-generation.ts` items first.
