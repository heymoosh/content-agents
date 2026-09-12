# SLICE-7A log: a guard refusal clears its own dispatch fence

Companion to `SLICE-7A.md`. The packet holds the contract; this file holds the record.

## What was broken

`bluesky-1` could not be scheduled and had no supported recovery path. The journal held a
`dispatch_started` fence with no `dispatch_resolved`; the ledger held `blocked` with
`error: "blocked by reuse guard, last placed to bluesky 2026-09-11T20:06:54.362Z (min_reuse_days: 21)"`.
That timestamp belongs to `bluesky-2`, not `bluesky-1`, so a strict same-row refusal had fired
against a different row: the attempt ran on pre-6Z code. Nothing was posted.

The fence was correct to exist and wrong to persist. `scheduleApprovedOnce` cleared it only for a
Postiz rate limit, and it chose the ledger state by sniffing the error message
(`result.scheduleError.startsWith("blocked by reuse guard")`). A guard refusal therefore kept its
fence forever. `resolvePublishingAttempt` accepts only `uncertain` or `scheduling`, and the GUI
offers "Needs reconciliation" only for `uncertain`, so a fenced-but-`blocked` row had no API path
and no button. It was repaired by hand with
`resolveDispatchFence(slug, "bluesky-1", "not-created", PUBLISHING_STATUS_PATH)`, which returned
`true`. The row then scheduled for Sat 2026-09-19 18:30 PT, exactly `min_variant_days: 7` past
`bluesky-2`, postiz object `cmtxv04og000nmn813w2ib6p6`. That is 6Z behaving correctly on a live
row.

## What shipped

`ScheduleOutcome` carries a typed discriminant instead of message text:

```ts
refusal?: "no-provider-request" | "publisher-declined";
```

| value | set where | provider state | ledger | fence |
|---|---|---|---|---|
| `"no-provider-request"` | Postiz pre-flight refusal, `studio-scheduling.ts:707` | proven: nothing sent | `blocked` | resolved `not-created` |
| `"publisher-declined"` | `runPublisher` `done.length === 0` (`:593`) and the `unscheduled-draft` route's `done.length === 0` (`:753`) | NOT proven: the publisher already ran | `blocked` | RETAINED |
| absent | every other failure | unknown | `uncertain` | RETAINED |

`scheduleApprovedOnce` reads the discriminant only on an outcome that actually failed, derives
`guardRefused` (either value, selects `blocked`) separately from `noProviderRequest` (only the
pre-flight value, the only thing besides a Postiz 429 that may reach `resolveDispatchFence`), and
strips the field from its own return so no caller can re-derive dispatch safety from it.

## Audit

Grok `grok-4.5`, cross-family. Codex capped until 2026-09-15. Two rounds.

**Round 1: FAIL, one P0, correct and confirmed in source.**

`reuseGuardBlock` calls the same `reuseGuardVerdict` the pre-flight calls, so it rebuilds the
byte-identical same-row string `blocked by reuse guard, last placed to …`. That string can
therefore be emitted from `runPublisher`'s recovery branch, which runs AFTER the publisher was
invoked. HEAD's prefix sniff caught it and recorded `blocked`, which is resolve-ineligible: the row
was stuck but safe. The round-1 candidate had no signal on that path, so it fell through to
`uncertain`, which IS resolve-eligible and DOES show "Needs reconciliation". A human could have
cleared the fence and re-sent a post whose publisher may already have held an object. Strictly more
permissive than HEAD on a post-publisher path, and exactly what scope decision 4 forbids.

Also accepted from round 1: P4a, a test asserting source text
(`assert.doesNotMatch(source, /startsWith\("blocked by reuse guard"\)/)`) plus an ordering test
titled for the ledger that only checked the journal; P4b, a refusal matrix pairing the
`min_variant_days` string with the pre-flight, which never emits it. Round 1 found nothing at
P0-producer, P2 or P3.

**Repair.** The boolean became the two-value discriminant above. The builder found a second
post-publisher recovery site the coordinator's brief had not named, the `unscheduled-draft` route's
own `done.length === 0`, where omitting the mark would have reproduced the P0 verbatim. Accepted.
P4a: source assertion deleted; the ordering test widened to read the publishing ledger via
`readPublishingHistory` and the approval journal, and to assert `dispatch_resolved.at >=` the
terminal ledger event. P4b: matrix re-keyed to real producers, three pre-flight rows and three
recovery rows.

**Round 2, bounded delta: `DELTA VERDICT: CLOSED`.** Every post-publisher `scheduleError` site
enumerated (two guard recoveries, both marked; three generic catches, correctly unmarked). No
production path more permissive than HEAD. No third recovery site. No new P0-P3 defect, signal-leak
re-checked against the string union. P4a and P4b adequate, widened ordering test sound.

## Amendments to the packet, coordinator decisions

1. **Acceptance item 3 is amended, not met as written.** It asked that all four guard refusal
   strings behave identically, fence cleared and `blocked` for each. The P0 proves they must NOT.
   Wording does not determine provider state; the emitting site does. The same string means
   "nothing was sent" from the pre-flight and "unknown" from a recovery branch. The amended item:
   every guard refusal records `blocked` regardless of site, and only a provably pre-dispatch site
   clears the fence. Six matrix rows assert exactly that.
2. **Two strings become stricter than HEAD**, which is the correct direction. On the recovery
   branches, `REUSE_GUARD_UNSPECIFIED` and the `min_variant_days` string now record `blocked`
   (resolve-ineligible) where HEAD recorded `uncertain` (resolve-eligible). Both keep their fence
   either way. No existing test encoded the old value; the only other test touching that string is
   `reconcile.test.ts:251`, which asserts nothing about ledger state and still passes.
3. **The `injected` outcome branch does not carry the discriminant** and is left that way. It
   constructs `{ scheduled, scheduleError }` only, so an injected failure takes the absent path:
   `uncertain`, fence retained. That is the fail-closed default, so it needs no change.
4. **The Goal is closed for the Postiz pre-flight path only.** A non-Postiz route refused by its
   own publisher still keeps its fence permanently and is not resolve-eligible, as it is today.
   Clearing it safely needs proof from each publisher's own pre-create guard, which scope decision
   4 puts out of this slice. This is now deliberate design, recorded, not an oversight.

## Note contract, unchanged

Producer `studio-scheduling.ts:501`:
`` `blocked by reuse guard, last placed to ${platform} ${reuse.lastPlacedAt} (min_reuse_days: ${reuse.minDays})` ``
Reader `reconcile.ts:120`:
`/blocked by reuse guard, last placed to (\S+) (\S+) \(min_reuse_days: (\d+)\)/`
Round-trip: `"blocked by reuse guard, last placed to bluesky 2026-09-11T00:00:00.000Z (min_reuse_days: 21)"`
parses to `['bluesky', '2026-09-11T00:00:00.000Z', '21']`. No refusal wording changed anywhere in
this slice, so no new user-facing string exists for `config/voice.yaml` to police.

## Checks

All unsandboxed, from the repository root. Under the sandbox the suite reports roughly 196 phantom
venture failures.

| command | exit | counts |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | 0 | — |
| focused: `publishing-status.test.ts`, `studio-scheduling.test.ts`, `studio-scheduling-postiz-reuse.test.ts` | 0 | 70 pass / 0 fail / 0 skip |
| `npm run check`, builder, repaired candidate | 0 | 4482 pass / 0 fail / 0 skip |
| `npm run check`, coordinator, frozen candidate | 0 | 4482 pass / 0 fail / 0 skip |
| `npm run test:e2e`, round 1 | 1 | journeys 55 pass / 0 fail / 16 blocked, `failures: []` |

The e2e harness exit is its own shared-worktree isolation check, not a journey failure: 19
concurrent `claude` processes write this checkout, and two runs flagged another session's writes
under `content/2026-06-16-building-an-innovation-nation/` and a `/develop` row appended to
`data/cost-log.csv`. Not re-run after the repair, which is test- and classification-only on paths
no journey covers. Nothing under `e2e/` mentions the reuse guard or the dispatch fence, so no
existing e2e pass covers the packet's named journey. Stated rather than added, per Verify.

Coordinator grep for acceptance item 4: `startsWith("blocked by reuse guard")` occurs 0 times in
`src/review/publishing-status.ts` and 0 times anywhere under `src/`.

## Load-bearing

Each production change reverted alone, suite re-run, then restored. 70/70 green again afterwards.

| reverted | named failures |
|---|---|
| consumer, back to the prefix sniff and rate-limit-only fence | 8: three pre-flight matrix rows, the two stricter-than-HEAD recovery rows, `a pre-dispatch refusal is schedulable again with no hand repair`, `the discriminant is typed: wording is never what decides`, the ordering test |
| pre-flight `refusal` removed | 2: `the pre-flight same-row refusal is no-provider-request…`, `the pre-flight no-brand refusal is no-provider-request too` |
| the P0 repair, both recovery sites unmarked | 4: `the recovery branch emits the SAME same-row wording but is publisher-declined`, `…unspecified fallback is publisher-declined as well`, `…variant-spacing wording is publisher-declined`, `the unscheduled-draft route's recovery branch is publisher-declined too` |

`a publisher-declined row cannot be reconciled clear and cannot be rescheduled` nails the P0 shut
from the human-action side: `blocked`, `resolvePublishingAttempt` throwing `/no uncertain/`, a
second `scheduleApprovedOnce` rejecting on `/durable dispatch fence/`, scheduler invoked exactly
once.

## Protected paths and hygiene

`.env` never read, written, printed or referenced. No secret in any test, fixture, string or log
line. No live provider or network call: every test stubs discovery and every publisher.

`shasum` of `briefs/human-inference/bets.md`, `data/outreach/tracker.jsonl` and both
`content/2026-09-07-…` files taken before each round and re-verified after: all `OK`,
byte-identical. `git status --porcelain -- data briefs` is not empty, but every entry is another
session's live work, carrying real Postiz object ids stamped 2026-09-12T01:19Z / 04:02Z / 01:24Z,
which this slice's stubs cannot produce.

`bash scripts/repo-hygiene.sh --rescue`: run, exit 1, output reviewed, nothing changed by it. This
slice created no stray path. Left in place because it created none of them: the four protected
files above, `content/2026-06-16-building-an-innovation-nation/{develop/advice.json,develop/log.md,cuts/}`,
the modified files in `/private/tmp/claude/content-agents-worktrees/wt-slice-6m` and `wt-slice-6s`,
and merged branches `slice-6m-worker` and `slice-6s-worker`.

## Read set

`## Slice protocol` 24560 B, this packet 12130 B as read. The master document's `## START HERE`
block was not read by the worker.
