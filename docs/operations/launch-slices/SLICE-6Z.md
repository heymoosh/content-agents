# SLICE-6Z — the reuse guard spaces variants instead of refusing them

Status: built, uncommitted, awaiting coordinator audit and gate.

## Goal

Two different derivatives of the same essay are two different posts. The guard cannot tell them
apart: `findLastPlacement` matches `[<slug>/<any row>]`, so placing `bluesky-2` locks out
`bluesky-1` for the full `min_reuse_days` window (21 days on bluesky). Muxin hit this tonight on
`2026-09-07-the-world-s-broken.../bluesky-1` an hour after `bluesky-2` was placed.

Two defects, decided together:

1. **Merged cases.** The guard's own comment says it "prevents re-publishing the same content slug",
   and it was built for re-posting the identical row. Normal fan-out of different derivatives is
   caught by the same long window.
2. **Refusal as the remedy.** The guard knows exactly when the window opens. Throwing a red banner
   when it could schedule past the window is the wrong answer. Refusal belongs to cases with no
   safe date, not to cases whose only problem is "not yet".

After this slice: re-placing the same row inside its window still refuses. A different derivative
inside the shorter variant window is scheduled at the first slot past it, and Studio says so
calmly instead of erroring.

## Difficulty

Medium. One core function, one new config key, four call sites and one note parser. No new
subsystem: the deferral date is handed to the existing unified scheduler, never computed twice.

## Depends on

Nothing. 6Y is committed and unrelated (account selection, not timing).

## Owned files

- `src/publish/reuse-guard.ts` — the two-window split and the earliest-allowed instant.
- `src/review/studio-scheduling.ts` — refusal becomes deferral on the Studio path (line 454 area).
- `src/review/reconcile.ts` — the `REUSE_GUARD_NOTE` parser (113) and its human note (125).
- `src/publish/tiktok.ts` (181), `src/publish/typefully.ts` (344-347), `src/publish/substack.ts`
  (186) — the three publisher call sites.
- `config/platforms.yaml` — ONE new key only, see Acceptance. No existing value may change.
- Tests beside each of the above.

## Do not touch

- Any existing `min_reuse_days` value. Retuning windows is Muxin's call, not this slice's.
- `src/publish/slots.ts` and the slot ledger. The scheduler owns timing; this slice only tells it
  the earliest acceptable instant. Do not write a second scheduler.
- `src/review/approval-provenance.ts`, `src/review/publishing-status.ts`, `src/publish/postiz.ts` —
  6X and 6Y are accepted and out of scope. A reuse deferral is not a provenance or account matter.
- `briefs/**` — the Placed log is append-only and is Muxin's shipping record. Read it, never write
  or rewrite it. Tests use the `CONTENT_AGENTS_TEST_BETS_PATH` / `CONTENT_AGENTS_TEST_BRIEFS_ROOT`
  overrides that already exist.
- `.env`, `data/**`, `docs/content-agents-backlog.md`.

## Coordinator scope decisions (resolved, do not relitigate)

1. **Two windows, keyed on row identity.** Same `slug` + same `platform` + **same row id** keeps
   the existing per-platform `min_reuse_days`. Same slug + same platform + **different row id**
   uses a new `min_variant_days`.
2. **`min_variant_days` defaults to 7**, as a new top-level key in `config/platforms.yaml`,
   overridable per platform exactly the way `min_reuse_days` already is. 7 is a starting value
   Muxin tunes in config, not a number to defend in code.
3. **Same row inside its window still refuses**, message unchanged. Re-placing an identical post is
   almost always a mistake and there is no date that makes it right.
4. **Different row inside the variant window defers, never refuses.** The guard returns the
   earliest allowed instant; the caller asks the existing scheduler for the first free slot at or
   after it.
5. **A deferral that cannot find a slot refuses**, naming that it could not place the post rather
   than pretending it scheduled. Fail closed: a wrong date is recoverable, a silent no-op is not.
6. **No existing window value changes in this slice.**

## Cited headings

none

## Acceptance

- [ ] Placing row A of a slug, then scheduling row B of the same slug and platform inside the
      variant window, produces a scheduled post dated at or after `lastPlacement + min_variant_days`,
      not a refusal.
- [ ] Placing row A, then re-placing row A inside `min_reuse_days`, still refuses with today's
      message and today's window value.
- [ ] `min_variant_days` is read from `config/platforms.yaml`: top-level default, per-platform
      override, falling back to a named constant when absent. No existing key's value changes.
- [ ] The deferred date comes from the existing scheduler, honoring per-platform cadence and the
      shared slot ledger. No second slot-picking implementation appears in this slice.
- [ ] A deferral with no available slot refuses and says it could not place the post. It never
      returns a scheduled state it did not achieve.
- [ ] Different platforms remain independent: placing to bluesky never defers or blocks x.
- [ ] A slug with no prior placement schedules immediately, unchanged.
- [ ] The Studio Publishing room shows a deferral as a scheduled row with a plain spacing note, not
      a red error banner.
- [ ] `src/review/reconcile.ts` still parses the refusal note it is given, and its human-facing
      "eligible again in N days" line stays correct for the refusal case.
- [ ] Every new or changed user-facing string passes `config/voice.yaml`: no em dashes, no AI tells.
- [ ] The three publisher call sites (`tiktok.ts`, `typefully.ts`, `substack.ts`) get the same two-
      window treatment as the Studio path. No call site is left on the old merged behavior.
- [ ] Every new test is load-bearing: reverting the production change alone makes named tests fail.
- [ ] The concrete case that prompted this slice is covered by a test: two bluesky derivatives of
      one essay placed an hour apart defer rather than refuse.

## Verify

Meaningful behavior on the live-posting path. Full gate plus focused tests plus e2e. Run every
command unsandboxed; the sandbox reports roughly 196 phantom venture failures.

- `npx tsc --noEmit -p tsconfig.json`
- focused: `node --import tsx --test` over every changed test file
- `npm run check`
- `npm run test:e2e`
- load-bearing proof: revert the production change only, tests untouched, and record which tests fail

**Existing tests that encode the old merged rule** (`studio-scheduling.test.ts` around 168/182/213,
`studio-scheduling-postiz-reuse.test.ts` around 176/199/234/265) assert the exact refusal string.
Where such a test refuses a case this slice defers, it encodes the defect, and updating it is
correct. Where it refuses a same-row case, it must keep passing untouched. Never weaken a test to
make the build green: quote any test you cannot place in one of those two buckets and stop for
coordinator adjudication.

## Observable result

Muxin schedules `bluesky-1` from the 2026-09-07 essay, an hour after `bluesky-2` was placed to
bluesky, and gets a post scheduled roughly a week out with a note saying it was spaced from the
earlier variant. No red banner, no manual step.

## Risk

Medium. The failure that matters is a deferral that posts something twice or posts nothing while
reporting success. Both are covered by acceptance items 5 and 12. The window values themselves are
config and reversible in one line.

## Families

Builder: Claude opus, fresh context. Auditor: cross-family, Grok effort high. Never a Claude
auditor. Codex is capped until 2026-09-15.

## Closeout

Use the `### Closeout gate disposition`, `### Hygiene disposition` and `### Read-set measurement`
forms in `docs/operations/slice-protocol-environment.md`.

Preflight: acceptance mapped to named tests or quoted strings; `.env` untouched and unread;
`briefs/**` unmodified; `git status --porcelain -- data` empty; exit codes recorded; audit findings
and their disposition written down before integration.

**PASS** 2026-09-11

- Acceptance: each item mapped to a named test or quoted string in the log.
- Gate, coordinator's own runs, unsandboxed: `npm run check` 0, 4459 / 0, no `not ok`; `tsc` 0;
  `npm run test:e2e` 0, 55 / 0 / 16, worktree byte-identical. An earlier e2e exit 1 is in the log.
- Audit: Grok grok-4.5. First pass `VERDICT: FAIL` on two fail-open defects: ambiguous row identity
  took the variant window, and a non-positive `min_variant_days` collapsed spacing. Both repaired,
  then a bounded delta audit returned `DELTA VERDICT: CLOSED`: nothing newly permissive, no test
  weakened. Accepted as-is: gap 4, improvements 3 and 4. Its D8 flake suspect is dismissed, with
  reasons, in the log.
- Accepted limitation, pre-existing, in the log: two variants approved in one run carry no Placed
  rows yet, so only cadence spaces them.
- Hygiene: `--rescue` exit 1, 4 items, none this slice's (two old 6M/6S worktrees, two merged
  branches). Nothing removed; files this session made are in this commit.
- Read set: `## Slice protocol` 24560 B, `## START HERE` 1389 B, packet 12274 B.

## RESULT BLOCK (worker fills this in and returns it)

Detail, repair round included: the log.

- **Changed:** `reuse-guard.ts` (two windows, `checkReuseForRow`, `resolveVariantDays`,
  `normalizeRowId`, `positiveDays`), `studio-scheduling.ts` (`reuseGuardVerdict`, deferral into
  `defaultPublishPostiz`), `typefully.ts` / `tiktok.ts` / `substack.ts` (per-row check plus a
  spacing floor for the existing scheduler), `reconcile.ts` (comment only), `platforms.yaml` (one
  new key `min_variant_days: 7`), `src/config/platforms.ts` (schema + loader). Four test files,
  one new. No do-not-touch path touched.
- **Outcome:** the SAME row inside `min_reuse_days` still refuses, same message and window. A
  DIFFERENT derivative inside `min_variant_days` (7, from config) is spaced instead: the guard
  returns the instant the window opens, the caller hands that to the existing scheduler as its
  `now`, and the post takes the first free slot past it with a plain spacing note. No second slot
  picker. No slot past the floor refuses and claims nothing. `cards.ts` and `youtube.ts` pass no
  row id and keep the merged refusal.
- **Repair round (Grok FAIL):** both fail-open defects closed. Unknown row identity (omitted, empty
  or whitespace, what `readQueue` yields for a blank cell) now takes the STRICT merged window via
  `normalizeRowId`; same-row matching folds case, only ever toward the longer window, never
  rewriting the Placed log. `min_variant_days` is `.positive()` in both schema slots, and a value
  not finite and positive reads as absent to resolver and override.
- **Checks:** counts in `## Closeout`. Focused: reuse-guard 29/29, deferral 10/10,
  postiz-reuse 17/17, plus eleven neighbours 239/239.
- **Load-bearing:** seven production-only reverts, tests untouched, each restored; failures per
  revert 7/1/3/1/4/1/6, named in the log.
- **Test adjudications:** ONE existing test changed, bucket one: the postiz-reuse guard-blocked
  fixture moved from row `x-9` to `x-1`, keeping every assertion and staying a same-row refusal.
  Every other named refusal assertion is same-row, untouched.
- **Unresolved:** (1) one gate run after the repairs reported 4458 / 1, name uncaptured; the seven
  since, the coordinator's own included, are all 4459 / 0. Unidentified, unreproduced.
  (2) Item 8's note rides on `scheduled.spacingNote` and `publish-log.md`; a deferral sets no
  `scheduleError`, so the banner and pill are gone, and rendering it needs the unowned `page.ts`.
  Two smaller items are in the log: a voice-rule label prefix, and one file outside Owned files.
- **Delivery state:** accepted; see `## Closeout`. The worker committed, staged, pushed, checked
  out and stashed nothing, read or wrote no `.env`, and made no live provider or network call.
  `data/` and `briefs/` carry only Muxin's own scheduling edits, excluded from the commit.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Serial. One Claude opus worker, fresh context.
- Worker returns the RESULT BLOCK and stops. The coordinator runs the audit, the gate and the
  single integration commit. The worker never commits, stages, pushes, checks out or stashes.
