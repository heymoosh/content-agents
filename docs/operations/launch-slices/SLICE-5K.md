# SLICE-5K: the Postiz path consults the reuse guard before it creates

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

An approved row whose reuse guard says "not allowed" is **not placed by Postiz**. It returns a
`scheduleError` naming the guard, and no post is created on any provider.

## Why this exists

Five publishers call `checkReuse` before they create anything: `src/publish/typefully.ts`,
`src/publish/cards.ts`, `src/publish/tiktok.ts`, `src/publish/youtube.ts`,
`src/publish/substack.ts`. Postiz does not. The only `checkReuse` call in
`src/review/studio-scheduling.ts` sits inside `runPublisher`'s `done.length === 0` branch — it is
reason-recovery, run *after* a publisher already returned nothing, to explain why. It is not a
pre-flight gate, and the Postiz path returns from its own catch without ever reaching it.

This was proved empirically during SLICE-5J: with the guard answering "not allowed," Postiz
creates the post anyway and both transport calls are made.

What prevents a duplicate today is not the guard. It is `setStatus(folder, row, "published")`
taking a placed row out of `approve`, so a second placement needs Muxin to deliberately re-approve
a row that already shipped. Real hole, small blast radius, and it is a hole in a guard she will
assume is protecting her.

Pre-existing, and it affects every row kind routed to Postiz — not only the media rows SLICE-5J
newly made a two-route case.

## Difficulty

hard — the change is a few lines, but it decides when an approved row is refused, and the wrong
interaction with SLICE-5J's Typefully fallback would turn a guard block into a second delivery
route.

## Depends on

SLICE-5J (accepted 2026-09-05). Its fallback path is live in the files this slice owns.

## Owned files

Parallel-safe: no — single lane. The whole change is one pre-flight decision on one dispatch path
in one file plus its tests; there is nothing to divide.

### Lane A — Postiz pre-flight reuse check

- `src/review/studio-scheduling.ts`
- the existing test files covering it (`src/review/studio-scheduling.test.ts`,
  `src/review/studio-scheduling-media-fallback.test.ts`, and any other
  `studio-scheduling*.test.ts`)
- new test files alongside them

## Do not touch

- `src/publish/reuse-guard.ts` — the guard itself is correct and shared by five callers. This
  slice adds a sixth caller; it does not change what the guard decides. If you believe the guard
  itself is wrong, say so in the RESULT BLOCK and stop rather than editing it.
- `src/publish/typefully.ts`, `src/publish/cards.ts`, `src/publish/tiktok.ts`,
  `src/publish/youtube.ts`, `src/publish/substack.ts` — they already check. Do not add a second
  check, do not remove theirs.
- `src/review/configured-media.ts`, `src/review/configured-media-runtime.ts`, `src/review/jobs.ts`
  — SLICE-5I's files, out of scope.
- `config/platforms.yaml`, `remotion/` — no cadence, dimension or composition change.
- `docs/content-studio-master-status.md` — the coordinator updates it.

## Cited headings

none

## Acceptance

Write the trigger conditions as tests. The exact list:

- [ ] **A guard-blocked row is not created on Postiz.** For a row the reuse guard refuses, the
      Postiz transport is never called, and the outcome carries a `scheduleError` naming the reuse
      guard, the platform, the last placement date and the configured minimum reuse days — the same
      shape `runPublisher`'s existing recovery message produces, so the Content page reads one
      wording, not two.
- [ ] **The check runs before any resource is claimed.** A blocked row consumes no publish slot and
      leaves `data/publish-schedule.jsonl` byte-identical to its pre-call state. Assert the ledger
      unfiltered, not just the absence of one entry.
- [ ] **A blocked row is not marked published** and keeps its `approve` status, so Muxin sees it
      still pending with the reason attached.
- [ ] **A guard block does NOT fall back to Typefully.** This is the point of the slice. SLICE-5J
      made a Content-page image row fall back when Postiz "provably created nothing" — a reuse-guard
      refusal also creates nothing, but it means *do not place this row anywhere*, not *try the
      other provider*. A row refused by the guard must return the guard's `scheduleError` and stop.
      Falling back here would defeat the guard entirely and is exactly the double-post shape 5J was
      built to avoid.
- [ ] **The guard key matches the row kind.** Reuse is keyed per destination platform. A card row
      keys on its card target, a configured-media row on its own platform, tiktok on `tiktok`,
      video on `youtube`, substack on `substack`, text on the row's platform. Prove the key by
      drifting it in a test and watching that test fail.
- [ ] **An allowed row still goes through Postiz unchanged.** Adding the gate must not change which
      rows Postiz places, the order it tries providers in, or what it writes on success. Postiz
      stays the first choice.
- [ ] **The five direct publishers are unaffected.** Their own pre-flight checks still run and
      still decide; nothing in the diff double-checks or short-circuits them.
- [ ] **`runPublisher`'s existing recovery path still works.** The `done.length === 0` branch is
      still reached and still explains a publisher that silently skipped. If the new pre-flight
      makes that branch dead for one kind, say which and why in the RESULT BLOCK rather than
      deleting it.
- [ ] Rows still only reach any route after Muxin's `approve` in `review-queue.md`. Nothing in the
      diff loosens that.
- [ ] New tests assert the observable outcome — whether a post was created, what the ledger holds,
      what `scheduleError` the row carries — not that a function was called with a particular
      argument.

## Intended approach

`reuseGuardPlatform(kind, row)` already exists in `src/review/studio-scheduling.ts` and already
maps every row kind to its guard key; `runPublisher` uses it for recovery. Reuse that function for
the pre-flight so one mapping serves both and they cannot drift apart.

Trace where the Postiz path actually begins before you place the check. Do not assume the branch
you find first is the one every Postiz row goes through — this slice exists because a
`checkReuse` call site was mistaken for a guard twice in a row by reading a call site and not its
caller. Find the point that every Postiz row passes and that runs before any slot claim or
transport call, and put the check there.

Deviate if the existing runtime makes this wrong, but say why in the RESULT BLOCK.

## Verify

Run the focused tests for the changed path, then report the exact command and its exit code:

```
node --import tsx --test src/review/studio-scheduling.test.ts src/review/studio-scheduling-media-fallback.test.ts
```

Call `node --import tsx --test` directly. `npm test -- <files>` does NOT narrow the run: the
script is `node --import tsx --test "src/**/*.test.ts"`, so named files are appended to the glob
rather than replacing it, and you get the whole suite while believing you ran two files.

Adjust the paths to the test files that actually exist or that you add. Do not run the
repository-wide gate — the coordinator runs it once, last, unsandboxed.

## Observable result

A folder that was already placed to LinkedIn inside the reuse window, re-approved for LinkedIn
again, produces no Postiz post and no Typefully draft. The row stays pending in the Content page
with a reason naming the guard and the date of the earlier placement.

## Risk

medium — audit required: yes. It adds a refusal to a delivery path. Two failure modes matter: a
guard block leaking into SLICE-5J's fallback and shipping the row twice, and an over-broad key
refusing rows that were never placed.

## Families

- Builder: Claude, strong tier — the correctness is in where the check sits and how it interacts
  with the 5J fallback, not in the wiring.
- Auditor: Codex / GPT, strong tier — different family, receives the acceptance criteria, the
  diff, the changed-file list and the focused check output only. Ask it specifically: (1) can any
  path still create a Postiz post for a row the guard refuses, and (2) can a guard refusal reach
  the Typefully fallback.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in this
packet before the slice closes.

## RESULT BLOCK

See `SLICE-5K-LOG.md` for the completed RESULT BLOCK.
