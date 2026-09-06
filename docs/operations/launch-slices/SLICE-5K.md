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

- Changed paths: `src/review/studio-scheduling.ts` (+47/-16),
  `src/review/studio-scheduling-postiz-reuse.test.ts` (new, 12 tests).
- Outcome: **PASS.** The Postiz path is the sixth `checkReuse` caller. A row the guard refuses is
  not created on Postiz, claims no slot, is not marked published, and does not reach SLICE-5J's
  Typefully backup route.
- Checks run and results: `npx tsc --noEmit` exit 0; focused suites exit 0 (42/42 and 185/185); the
  repository-wide gate `npm run check` run once, last, unsandboxed — **4248 tests, 488 suites,
  4248 pass, 0 fail, exit 0** (up from 4236/487 by exactly this slice's 12 tests in one suite).
- Audit: Codex/GPT, one round, **zero established defects** and both headline questions answered
  clean. Five verification gaps returned; one was sent as repair cycle 1, three the coordinator
  dismissed with reasons (below), and one the coordinator closed by reading the code himself.
  Repair cycle 1 was test-only — the production diff after it is byte-identical to the audited
  text, so no second round: the audit had reviewed code that did not move.

### Where the gate sits, and why there

Every approved row reaching Postiz passes `scheduleApproved`'s `provider === "postiz"` branch
(line 561), and `deps.publishPostiz ?? defaultPublishPostiz` has exactly **one** call site
(line 580). The gate is at 575, above it. `claimSlots` is at line 364, inside
`defaultPublishPostiz`, therefore downstream. The coordinator verified this by grep rather than
accepting the builder's trace, because this claim is the whole slice.

Two other Postiz entry points exist and are deliberately not gated: `postiz-canary.ts` (operator
canary with its own cleanup ledger) and `review/reschedule.ts` (moves an existing post's date).
Neither is an approved-row create path.

The gate precedes the `try/catch` whose media arm holds SLICE-5J's Typefully fallback, so a
refusal can never be misread as "Postiz provably created nothing" and re-sent down the backup
route. That was the slice's central risk.

`reuseGuardBlock(folder, kind, row)` was extracted so the pre-flight and `runPublisher`'s
`done.length === 0` recovery share one key function and one message string. `runPublisher`'s
behavior is unchanged for every input, and its recovery branch is **not** dead for any kind — a
publisher can return `[]` for reasons the guard knows nothing about, pinned by two tests.

### Load-bearing evidence

Every invariant proved by breaking it, observing the failure, and restoring:

- **Gate removed** → the blocked test fails on a direct call record, `+ ['publishPostiz',
  '/api/public/v1/posts'] / - []`. With that assertion temporarily lifted, the seeded-ledger
  assertion fails next: `Buffer(234)` vs `Buffer(121)`, the leaked claim appended beside the
  surviving standing one. In the media test the failure is literally `+ ['typefully-card'] / - []`
  — a guard-blocked LinkedIn image row landing on Typefully, the double-delivery shape.
- **Card key drifted** to the `quote-card` bucket → the card-key test fails.
- **Video key drifted** to `row.platform` → initially *undetected*. The fixture was strengthened to
  a `{platform: "x", format: "short"}` short, where the correct key is the fixed `youtube` and the
  decoy is `x`, after which the drift fails. Worth keeping: a `platform: "youtube"` fixture could
  never have caught it.
- **Timestamp drift** (emitting `new Date().toISOString()` instead of `reuse.lastPlacedAt`) → 8/12
  fail. This is exactly the defect the pre-repair prefix + suffix regex pair would have passed.

Assertions are on observable state, never call arguments: real `defaultPublishPostiz`, real slot
ledger, real `review-queue.md`. A blocked row leaves `publish-schedule.jsonl` byte-identical with
its pre-existing unrelated claim intact, the queue row still `| approve |` with no `| published |`,
no `publish-log.md`, and `scheduleError` asserted as a complete string including the timestamp.

### Audit adjudication

Sent as repair cycle 1 (all test-only, all confirmed non-vacuous by breaking them):

1. The zero-invocation assertion was indirect — the stub threw before recording, so `routes === []`
   proved the *backup* did not run and merely inferred that Postiz did not. Now recorded directly.
   This also closed a case the transport-only view could not see: a leak that entered
   `defaultPublishPostiz` and died before the create used to look identical to never dispatching.
2. The byte-identical ledger assertion compared an empty file to an empty file. Now seeded with a
   standing unrelated reservation first.
3. The refusal string was asserted as a prefix regex plus a suffix regex, leaving the timestamp
   between them unchecked.

Dismissed by the coordinator, with reasons, rather than spending the builder's second cycle:

- *"Prove all five direct publishers still guard."* Only `studio-scheduling.ts` changed. Unchanged
  files cannot have changed behavior.
- *"Prove the refusal reason is persisted to the row."* The persistence path is untouched and the
  message template is byte-identical to the one `runPublisher` already emitted, so
  `reconcile.ts`'s `reuseGuardEligibility` parses it exactly as before.
- *"No key-drift proof supplied."* An artifact of audit isolation — the auditor does not receive
  worker transcripts by design. The drifts were run and are recorded above.

Closed by the coordinator reading the code: *"the comment claims every Postiz row passes through
this branch, but that cannot be verified from the diff."* Verified by grep; see the section above.

### Unresolved / leftovers

1. **The pre-flight omits the `brandId` the five publishers pass** (`deliveryDecision.brand!`),
   deliberately matching `runPublisher`'s existing recovery call so the two cannot drift apart.
   Provably equivalent **today**: reaching this branch requires `policy.mode === "provider"`, and
   `src/publish/delivery-policy.ts` makes that mode reachable only for `human-inference` (line 43)
   — charles is hard-coded to `manual` (line 34) and fiction to `blocked` (line 37) — which is
   `checkReuse`'s default brand. **This stops being true the moment Charles gets provider
   delivery.** START HERE item (c) is the slice that would do that; whoever takes it must pass the
   brand at both call sites in the same change, or the guard will silently check Charles's rows
   under the Human Inference brand. Recorded rather than fixed here because fixing one call site
   and not the other reintroduces exactly the drift this slice removed.
2. `src/publish/reuse-guard.ts` untouched. Nothing found wrong with it.
