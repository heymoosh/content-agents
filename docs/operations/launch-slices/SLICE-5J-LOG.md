# SLICE-5J — archived history

Moved out of `SLICE-5J.md` by SLICE-6E to bring the packet under the 12,288-byte cap. Newest
first. Every line here was removed verbatim from the packet.

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
