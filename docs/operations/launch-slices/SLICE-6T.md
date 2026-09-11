# SLICE-6T: fix the two pre-existing Pass D bugs 6S uncovered in pass-d-content-generation.ts

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

SLICE-6S's fixes (uncommitted, `refs/wip/wt-slice-6s` `c140a6e`) stop two Pass D crashes from
masking two further, distinct pre-existing bugs in `e2e/pass-d-content-generation.ts`, both
confirmed by grep against `main` at `116f7a2`:

1. Line 236, record `"Configured-generation browser pass cannot invoke a real model or
   provider"`, asserts `session.blockedCalls.length === 0`. `blockedCalls`
   (`e2e/harness.ts:317,330,351,364`) is one array, pushed once per whole browser session, never
   reset. This file's three earlier `#routeBtn`/`#captureVerdict` capture-classify flows (~lines
   119, 140, 150) already populate it with correctly-aborted `/api/captures/classify` calls
   before line 236 runs — 6S's own intended fix, not a defect — so the raw `.length === 0` check
   now always fails even though no real model call happened for *this* action. Test-only defect:
   `harness.ts` needs no change; every other `blockedCalls.length === 0` assertion in the suite
   (`pass-d-outreach-generation.ts:106`, `pass-d-fiction-idea.ts:62`) is the first
   classify-adjacent check in its own file/session and is unaffected.
2. Line 288 (`"Configured Fiction treatment fails closed before a model job or derivative
   write"`) expects `POST /api/content/generate` to return HTTP 400 matching
   `/treatments are unavailable.*untreated control/i` when a fiction-origin request carries a
   `treated` variant. Confirmed by grep: that string exists only in the test, nowhere in `src/`.
   `assertConfiguredTreatmentPolicy` (`src/review/jobs.ts:882-889`) refuses only an
   unauthorized `belief-shift` treatment and an unauthorized Venture treatment — no fiction-origin
   case — so a fiction request with a treatment (`summary`, per `seedFictionRefusal()`,
   `e2e/pass-d-content-generation.ts:56-67`) generates successfully today. Real product gap:
   Build 2 (Fiction) is deliberately walled off from treatments (`CLAUDE.md` rule 1's scoped
   exceptions list Content Studio treatments, hook templates, video scripts, Venture and Charles,
   never Fiction) — a treated variant must never reach a fiction-origin request; only its
   untreated control may ship.

When this slice is done, both records pass deterministically, `npm run test:e2e` exits 0 with no
journey failing (once 6S's retained fixes are also present, see `## Depends on`), and a
fiction-origin request carrying a treated variant is refused before any write.

## Difficulty

easy — fix 1 is a one-line baseline-snapshot change local to one test file. Fix 2 is a small
addition to an existing, already-shaped policy-gate function, mirroring its own venture-origin
case immediately above.

## Depends on

SLICE-6S's retained diff (`e2e/pass-d-editorial.ts`, `e2e/harness.ts`'s `EXPENSIVE_ROUTES`,
uncommitted in `wt-slice-6s` / `refs/wip/wt-slice-6s` `c140a6e`). This slice's fixes are correct
without it, but `test:e2e` cannot go fully green until 6S's fixes are also present (they stop the
crashes that occur before this slice's two target records are ever reached). Apply 6S's diff from
`refs/wip/wt-slice-6s` unmodified in your worktree, alongside this slice's own changes, and say so
in the RESULT BLOCK — do not re-diagnose or second-guess it.

Delivery batch: 6T only. Stop condition: accepted, or stopped under `### Stopping without
acceptance`. A free slot does not authorize a second slice, including re-attempting 6M/6S here.
Owner checkpoint: none.

## Owned files

Parallel-safe: no — one shared `npm run test:e2e` run verifies both fixes together.

### Lane A — both fixes

- `e2e/pass-d-content-generation.ts` — only the "Configured-generation browser pass cannot invoke
  a real model or provider" record (~line 234-238): capture `session.blockedCalls.length` as a
  baseline immediately before the `POST /api/content/generate` call this record checks, and
  assert the count is unchanged (`session.blockedCalls.length === blockedBefore`) rather than
  `=== 0`. Keep the detail string's substance (still names `payload.engineExecution` and any
  blocked calls); do not touch any other record in this file.
- `src/review/jobs.ts` — only `assertConfiguredTreatmentPolicy` (currently lines 882-889): add a
  fiction-origin case refusing when `treated.length && request.origin === "fiction"`, before or
  alongside the existing two checks, with a message matching
  `/treatments are unavailable.*untreated control/i` (e.g. "treatments are unavailable for
  fiction origin; only the untreated control ships").

## Do not touch

- `e2e/harness.ts` — no change needed; do not add a reset/clear mechanism or otherwise touch
  `blockedCalls`.
- Every other record in `e2e/pass-d-content-generation.ts`, including the three
  `#captureVerdict` waits 6S already confirmed pass and the venture-generation record (~line
  277, which only logs `blockedCalls`, never asserts on it — leave its detail string as is).
- Every other `e2e/pass-*.ts` file, `e2e/run-all.ts`, `e2e/isolation.test.ts`.
- Every other function in `src/review/jobs.ts`, and every other path under `src/`. The only
  product gap is the missing fiction-origin refusal case.
- `package.json`, `docs/content-studio-master-status.md`, `docs/content-agents-backlog.md`,
  `docs/operations/launch-slices/SLICE-6M*.md`, `docs/operations/launch-slices/SLICE-6S*.md`,
  `data/**`, `.env`. Never stage, revert, or re-verify SLICE-6M's or SLICE-6S's own retained
  worktrees/refs beyond applying 6S's diff unmodified per `## Depends on`.
- Any journey's presence, order, viewport, flag state, or fixture-versus-live posture.

## Cited headings

none

## Acceptance

- [ ] `session.blockedCalls.length === 0` no longer appears in
      `pass-d-content-generation.ts`; the replacement baseline-diff assertion is scoped to calls
      made during this record's own `POST /api/content/generate`, not calls made earlier in the
      file by other records.
- [ ] That record still fails if a real model/provider call happens during this action:
      demonstrate by temporarily pushing one fake entry onto `session.blockedCalls` after the
      baseline snapshot, confirming the record now reads `fail`, then restoring — record what was
      changed and observed.
- [ ] `assertConfiguredTreatmentPolicy` refuses a fiction-origin request with any non-empty
      `treated` list, with an error string matching `/treatments are unavailable.*untreated
      control/i`, verifiable by grep and by the record's own regex.
- [ ] The refusal fires before any job, write, or derivative is created (mirrors the existing
      venture-origin refusal's placement, already proven to run before `runQueued`).
- [ ] A fiction-origin request with an empty `treated` list (untreated-control-only) still
      generates normally. Demonstrate with the existing fixture or a minimal unit check; do not
      weaken or remove the untreated-control path.
- [ ] Neither record in `pass-d-content-generation.ts` was deleted, commented out, downgraded to
      `blocked`, or made to record a status other than `pass`/`fail`.
- [ ] `node --import tsx --test e2e/isolation.test.ts` exits 0.
- [ ] `npm run test:e2e` exits 0, run unsandboxed from a dedicated worktree with SLICE-6S's
      retained diff applied (per `## Depends on`), twice solo (no concurrent process — confirm
      via `pgrep`/`lsof` before each run). If any journey still fails, the RESULT BLOCK names it
      and its reason and the slice takes `### Stopping without acceptance`.
- [ ] `npm run check` was run unsandboxed and its result recorded. It is currently red on `main`
      for a pre-existing reason outside this slice (`src/review/jobs.test.ts`, SLICE-5Z). Do not
      assert exit 0. Assert instead that every failure it reports is reproduced with this slice's
      changes (and 6S's) stashed out, and name each one.
- [ ] `bash scripts/repo-hygiene.sh --rescue` was run and settled per the `### Hygiene
      disposition` form (not a bare exit code).

## Verify

Classification and applicable gate: meaningful behavior / high risk. `src/review/jobs.ts` is
product code and this slice adds a refusal path; `e2e/*.ts` is an executable input. The
repository-wide gate applies; the documentation-only exception does not.

For UI changes: none — no page, component or copy changes; record that in the RESULT BLOCK, the
standing design sanity check does not apply. Live integration: unchanged; stays inside the
suite's existing hermetic injected seam and 6S's `EXPENSIVE_ROUTES` abort posture.

Run everything from a worktree dedicated to this session that no other session is writing to.
Apply SLICE-6S's retained diff from `refs/wip/wt-slice-6s` into that worktree first (e.g.
`git cherry-pick c140a6e`), then make this slice's own changes on top.

```
npm run worktree:setup                       # once, in the fresh worktree
node --import tsx --test e2e/isolation.test.ts
npm run test:e2e                             # unsandboxed; run twice solo; record exit code, do not pipe through tail
npm run check                                # unsandboxed; under the sandbox it reports ~196 phantom venture failures
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

`npm run test:e2e` exits 0 twice in a row with no Pass D journey failing, and a fiction-origin
generation request carrying a treatment is refused with the untreated-control-only message before
any write happens.

## Risk

medium: audit required yes. Fix 2 adds a refusal path to a shared function
(`assertConfiguredTreatmentPolicy`); confirm it does not also refuse the untreated-control-only
fiction path and does not change behavior for any other origin (`studio`, `human-inference`,
`charles`, `venture`).
Review boundary: this candidate (this slice's own diff only, not 6S's).
Review scope/budget: ordinary effort, one bounded review. Three fixed questions: (1) does the
fiction-origin refusal fire only when `treated.length > 0`; (2) does it change behavior for any
other origin; (3) is the `blockedCalls` baseline-diff assertion still capable of failing if a
real model call happens during that action.
Prior accepted evidence: `SLICE-6S-LOG.md` → `## Stopped — 2026-09-10` names both findings.
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

Preflight: candidate sha pinned and changed paths listed (this slice's own diff, separate from
6S's applied-unmodified diff); every acceptance item mapped to a named command output or quoted
diff hunk; both gate exit codes captured by status, not piped output; the deliberate-break
demonstration recorded; audit findings separated into defects, verification gaps and optional
improvements, each closed with evidence.
Gate cost: `npm run check` on the frozen candidate, run once, last. Record elapsed time per
command separately from model usage; mark usage `unknown` if unavailable. Do not rerun for
paperwork.

Use `### Hygiene disposition` (env doc) for the hygiene item — not a bare exit code. Expect
non-zero: `wt-slice-6m`/`refs/wip/wt-slice-6m` and `wt-slice-6s`/`refs/wip/wt-slice-6s` are prior
work, not this session's — name both, never remove them. Name every path this session created
and settled, and every other path left in place.

Use `### Read-set measurement` (env doc) for the closeout read-set print, not an ad hoc
re-derivation.
