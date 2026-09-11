# SLICE-6T: fix the two pre-existing Pass D bugs 6S uncovered in pass-d-content-generation.ts

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Two pre-existing bugs in `e2e/pass-d-content-generation.ts` that SLICE-6S's fixes stopped masking.
Full diagnosis, and how fix 2's premise turned out to be wrong, is in `SLICE-6T-LOG.md`.

1. The record `"Configured-generation browser pass cannot invoke a real model or provider"`
   asserted `session.blockedCalls.length === 0`. That array accumulates across the whole browser
   session and is never reset, so the file's three earlier capture-classify flows make the raw
   check unpassable. Test-only defect; `harness.ts` needs no change.
2. The record `"Configured Fiction treatment fails closed before a model job or derivative write"`
   expected a blanket refusal of fiction treatments that no `src/` code ever implemented. Superseded
   by decision 10b2 (PR #457): fiction promos DO get a blind fiction-social editor pass. Muxin
   decided in session to keep the editor and fix the record. Rewriting it exposed the real defect:
   the untreated **control** shipped `request.originalInput` rather than the server-owned approved
   body, so a fiction or Charles control could carry arbitrary prompt wording.

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

Items 3-5 were rewritten mid-slice after Muxin decided to keep the fiction social editor and fix
the stale record instead of refusing fiction treatments (`SLICE-6T-LOG.md` → `## Accepted`).

- [x] `session.blockedCalls.length === 0` no longer appears in
      `pass-d-content-generation.ts`; the replacement baseline-diff assertion is scoped to calls
      made during this record's own `POST /api/content/generate`, not calls made earlier in the
      file by other records.
- [x] That record still fails if a real model/provider call happens during this action:
      demonstrated by pushing one fake entry onto `session.blockedCalls` after the baseline
      snapshot, confirming `fail`, then restoring.
- [x] The untreated control ships the server-owned approved body for the two origins that have one
      (`fiction`, `charles`), proven by exact post-frontmatter byte comparison.
- [x] That substitution fires only where `authoritative.contextKind` is set, so `studio`,
      `human-inference` and `venture` keep their exact request bytes — proven by padded-whitespace
      cases for all three and by negative mutation.
- [x] The gate input and the written bytes are one value (`controlBody`), computed once.
- [x] No record in `pass-d-content-generation.ts` was deleted, commented out, downgraded to
      `blocked`, or made to record a status other than `pass`/`fail`.
- [x] `node --import tsx --test e2e/isolation.test.ts` exits 0 (12/12).
- [x] `npm run test:e2e` run twice solo, unsandboxed, from a dedicated worktree with SLICE-6S's
      retained diff applied. Pass D configured-content-generation 8/8 both runs. The suite still
      exits 1 on one Pass A and one Pass B failure, both reproduced on clean `main` with every
      change stashed; named in the log and left alone.
- [x] `npm run check` run unsandboxed: 4377 pass / 2 fail, exit 1. Both failures
      (`src/util/env.test.ts`, SLICE-6R's real-child env tests) reproduce with this slice's and
      6S's changes stashed; the worktree has no `.env`.
- [x] `bash scripts/repo-hygiene.sh --rescue` run and settled per `### Hygiene disposition`.

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

**PASS** — 2026-09-10. Both target records pass, the cross-family audit's one P1 is closed with a
negative-mutation proof, and every acceptance item above is checked. Full record, evidence and the
owner decision that reshaped fix 2: `SLICE-6T-LOG.md` → `## Accepted — 2026-09-10`.

Leftover, deliberately not pulled into scope: one Pass A and one Pass B "Content grouped approval"
failure, both pre-existing on `main`. They are the next slice.
