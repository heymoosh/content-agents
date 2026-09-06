# SLICE-5J: Typefully is the backup route for Content-page image rows when Postiz cannot take them

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

A Content-page configured-media row that holds a rendered **image** and targets a Typefully
platform (`x`, `linkedin`, `bluesky`) must schedule a native Typefully image draft when Postiz
cannot take it — instead of dead-ending at manual ready-to-paste.

Typefully was never removed. It is still the live route for text rows (`publishText`) and for
`/atomize` quote-card rows (`publishCards`, native image drafts since 2026-07-08). What is missing
is a wire: configured-media rows are a newer row kind, and the dispatch table at the bottom of
`scheduleApproved` has no `media` case, so `legacyProvider` returns `{ provider: "manual" }` for
them (`src/review/studio-scheduling.ts`, the `kind === "media"` branches) and
`scheduleApproved` refuses any non-Postiz provider for a media row. The Content page is the only
surface Muxin publishes from, and Postiz rate-limits at 90 creates/hour instance-wide, so today a
throttled or unconfigured Postiz means no scheduled draft at all.

**Owner decision (Muxin, 2026-09-05): "Content page should be able to also use Typefully if
Postiz doesn't work."** Postiz stays the first choice. Typefully is the backup, not a second
default.

## Difficulty

hard — the change is small but it decides when an approved row is allowed to take a second
delivery route, and a wrong trigger can double-post.

## Depends on

none. SLICE-5I is running in parallel and owns a disjoint file set
(`src/review/configured-media.ts`, `src/review/configured-media-runtime.ts`, `src/review/jobs.ts`);
5I's own "Do not touch" list names the two files this slice owns.

## Owned files

Parallel-safe: yes, against SLICE-5I only — the two lanes share no file.

### Lane A — media-row fallback route

- `src/review/studio-scheduling.ts`
- `src/publish/cards.ts` (row-selection and per-row publish only)
- the existing test files covering the above
- new test files alongside them

## Do not touch

- `src/review/configured-media.ts`, `src/review/configured-media-runtime.ts`, `src/review/jobs.ts`
  — SLICE-5I owns these and is running now.
- `src/publish/typefully.ts` — the Typefully transport itself is working and stays as it is.
- `config/platforms.yaml`, `remotion/` — no cadence, dimension or composition change.
- `docs/content-studio-master-status.md` — the coordinator updates it.

## Cited headings

none

## Acceptance

Write the trigger conditions as tests. The exact list:

- [ ] **Falls back** when Postiz is not configured at all (no base URL / API key), for an image
      media row whose platform is `x`, `linkedin` or `bluesky`: the row schedules a native
      Typefully image draft carrying the row's rendered asset and its `derivatives/<id>.md`
      caption, and the result names Typefully.
- [ ] **Falls back** when Postiz capability discovery returns an authoritative *unsupported* result
      for that destination and media shape.
- [ ] **Falls back** when Postiz refuses the create with an unambiguous "nothing was created"
      outcome — specifically a rate-limit rejection (Postiz's 90 creates/hour instance-wide cap).
- [ ] **Does NOT fall back** on an ambiguous create failure, where Postiz may or may not have
      created the draft. That row still returns its `scheduleError`. Auto-retrying elsewhere after
      a possibly-successful create is how a post ships twice; this line is the point of the slice.
- [ ] **Does NOT fall back** for a media row whose format is video (the animated card `.mp4`).
      Typefully's card route is image-only. Those rows keep today's manual ready-to-paste path.
- [ ] **Does NOT fall back** for a destination Typefully cannot post to (instagram, threads,
      tiktok, facebook, mastodon, youtube, and anything else outside `x | linkedin | bluesky`).
      Those rows keep today's manual ready-to-paste path.
- [ ] Postiz still wins whenever it can take the row. No test passes because the code stopped
      trying Postiz first.
- [ ] A row that fell back is scheduled exactly **once**. No path can produce both a Postiz post
      and a Typefully draft for one row.
- [ ] The fallback draft goes through the same shared slot scheduler and reuse guard the card path
      already uses, so it cannot exceed a platform's per-day slot cap or bypass reuse rules.
- [ ] `/atomize` quote-card rows (`quote-card:<target>` platform) keep behaving exactly as they do
      today. Widening `publishCards`' row selection must not change which rows it already picks up,
      nor how it publishes them.
- [ ] Rows still only reach any route after Muxin's `approve` in `review-queue.md`. Nothing in the
      diff loosens that. A scheduled Typefully draft is a draft, never an instant post.
- [ ] New tests assert the observable outcome — which provider the row was scheduled through, and
      the `scheduleError` on the rows that correctly refuse to fall back — not that a function was
      called with a particular argument.

## Intended approach

`publishCards` already does the per-row work this needs: it takes a row with a rendered image asset
and a `derivatives/<id>.md` caption, claims a slot, checks the reuse guard, and creates a native
Typefully image draft for one target platform. The only thing standing between it and a
configured-media row is its selection rule (`isQuoteCardRow(r.platform)`) and the fact that a
configured-media row carries its target platform directly rather than as `quote-card:<target>`.

So: widen the row selection to also admit an approved image media row, resolve its target from the
row's own platform, and give `scheduleApproved`'s `media` branch a Typefully fallback that fires
only under the three conditions above. Keep the Postiz-first order intact.

Deviate if the existing runtime makes this wrong, but say why in the RESULT BLOCK.

## Verify

Run the focused tests for the changed path, then report the exact command and its exit code:

```
node --import tsx --test src/review/studio-scheduling.test.ts src/publish/cards.test.ts
```

Call `node --import tsx --test` directly. `npm test -- <files>` does NOT narrow the run: the
script is `node --import tsx --test "src/**/*.test.ts"`, so named files are appended to the glob
rather than replacing it, and you get the whole suite while believing you ran two files.

Adjust the paths to the test files that actually exist or that you add. Do not run the
repository-wide gate — the coordinator runs it once, last, unsandboxed.

## Observable result

With Postiz unreachable, an approved Content-page LinkedIn row holding a rendered quote card
schedules a Typefully image draft rather than falling through to ready-to-paste.

## Risk

medium — audit required: yes. It adds a second delivery route for an approved row. The failure
mode that matters is a double-post, so the ambiguous-create-failure case must stay non-falling-back.

## Families

- Builder: Claude, strong tier — the correctness lives in the trigger conditions, not the wiring.
- Auditor: Codex / GPT, strong tier — different family, receives the diff, the changed-file list
  and the focused check output only. Ask it specifically whether any path can schedule one row
  twice.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in this
packet before the slice closes.

## RESULT BLOCK

- Changed paths: `src/review/studio-scheduling.ts`, `src/publish/cards.ts`,
  `src/publish/cards.test.ts`, `src/review/studio-scheduling-media-fallback.test.ts`.
- Outcome: **PASS.** An approved Content-page image row for x/linkedin/bluesky now reaches Postiz
  first and falls back to a native Typefully image draft when — and only when — Postiz provably
  created nothing.
- Checks run and results: `npx tsc --noEmit -p tsconfig.json` exit 0; the repository-wide gate
  `npm run check` run once, last, unsandboxed — **4236 tests, 4236 pass, 0 fail, exit 0**.
- Audit: Codex/GPT, two rounds. Round 1 confirmed two High defects, both repaired; round 2 cleared
  the repairs and left one suspected High, which the coordinator investigated and resolved into the
  real finding recorded as leftover 1 below. Both repair cycles used.

### What Muxin actually asked, and what was actually wrong

Her report was "we used Typefully before, I have no idea why it's stripped out." Typefully was
never stripped out — it is live for text rows and for `/atomize` quote-card rows, including native
image drafts. The truth is different and worse: a Content-page media row's provisional provider is
`manual`, so `scheduleApproved` wrote ready-to-paste and returned **before** Postiz discovery ever
ran. Those rows had no working scheduled route at all, by either provider. This slice restores
both.

### Two defects repaired

1. **A bare CLI sweep could schedule rows nobody named.** `npm run publish:cards <folder>` calls
   `publishCards(folder)` with no ids. Cycle 0 admitted media rows unconditionally, so a sweep
   would put rows on the backup route with Postiz available and willing. A media row is now
   admitted only when the caller named it in `onlyIds`, which only the fallback path does.
2. **An untyped error could authorize the backup route.** The classifier accepted any error whose
   *message text* matched rate-limit wording. Message text is not evidence of provenance, and a
   wrong match ships one approved row twice. It is now `error instanceof PostizRateLimitError`
   only — the one create failure that is unambiguously "nothing was created," because Postiz's
   throttler guard runs before its create controller.

### Load-bearing evidence

Both invariants were proved by breaking them and watching the tests fail, then restoring:

- **Net one slot, never zero, never two.** The ledger is snapshotted inside the transport at the
  create call (proving Postiz really claimed a slot before failing, so the assertion cannot pass
  vacuously on a row that never got that far), and the whole ledger is asserted unfiltered
  afterward. Disabling the release path produced two claims and a failing test.
- **The cross-provider guard key.** Drifting `reuseGuardPlatform`'s media case to `"quote-card"`
  produced a failing test.

### Unresolved / leftovers

1. **The Postiz path never consults the reuse guard.** The only `checkReuse` in
   `studio-scheduling.ts` sits inside `runPublisher`'s `done.length === 0` branch — reason-recovery
   for a publisher that already skipped, not a pre-flight gate. The Postiz path returns from its
   own catch and never reaches it. Proved empirically: with the guard answering "not allowed,"
   Postiz posts anyway. What actually prevents a second placement today is `setStatus(…,
   "published")` taking the row out of `approve`, so a duplicate needs a deliberate re-approval
   after a completed placement. Pre-existing and affecting all six row kinds routed to Postiz; this
   slice did not introduce it, but it does newly make media rows a two-route case. **Next slice:**
   Postiz is the only publisher of six that skips the guard — make it consult it like the other
   five do. Not folded in here because it changes behavior for every Postiz row and needs its own
   audit.
2. **Crash after Typefully accepts the draft, before durable local evidence.** Genuine and
   uncovered, but identical for text rows, `/atomize` cards and Postiz. Closing it needs
   provider-side idempotency keys. Out of scope by decision.
3. **Carousel rows excluded from the backup route.** Deliberate: Typefully's card route uploads one
   image. Admitting them needs a live canary to confirm multi-`media_ids` behavior.
4. **Box 3 (scheduled draft, not instant post) is accepted UNPROVEN by construction** — the Postiz
   transport is outside this slice's file ownership.

### Corrections to the coordinator's own reads, recorded so they are not repeated

- I claimed `checkReuse` at `studio-scheduling.ts:459` was a pre-flight gate protecting against a
  Postiz retry after a Typefully fallback. It is not; see leftover 1. I found a call site and
  assumed it was a guard — the same error shape as reading one candidate handler instead of tracing
  the dispatcher, mirrored. **Before calling something a guard, find its caller and confirm the
  guarded path reaches it.**
- I called the `onlyIds` filter at `cards.ts:212` redundant with `approvedCards`. It is not:
  `approvedCards` consults `onlyIds` only to authorize a *media* row, and returns quote-card rows
  named or not. Removing it would make a single-media-row call also schedule every approved card in
  the folder. It now carries a comment saying so.
