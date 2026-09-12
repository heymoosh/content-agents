# SLICE-6Z log

Overflow for `SLICE-6Z.md` (packet cap). Newest first. No session reads this file.

## Repair round after the Grok FAIL verdict — 2026-09-11

### `loadYamlConfig` answer

`src/config/load.ts` returns its `fallback` ONLY for a missing file (ENOENT). A zod failure throws,
naming the path and every issue. So a `min_variant_days: 0` written into `config/platforms.yaml`
does not silently fall back: with `.positive()` on the schema it now breaks loudly at load. The
resolver guard is still required, because `resolveVariantDays(platform, cfg)` takes a
caller-supplied `cfg` that no schema ever validates.

### Finding 1, ambiguous row identity

`normalizeRowId` trims and lowercases once. Empty or whitespace-only is UNKNOWN identity and returns
null, which takes the same merged `checkReuse` path an omitted id takes. `findPlacements` normalizes
each logged row id the same way before comparing, so `X-1`, ` x-1 ` and `x-1` are one row while
`x-1` and `x-11` stay two. Nothing in the Placed log is rewritten; only the comparison is normalized.

### Finding 2, non-positive spacing window

Schema: both the top-level and per-platform `min_variant_days` are now `z.number().positive()`,
mirroring `max_slots_per_day`. `min_reuse_days` and every shipped window value are untouched.
Resolver: `positiveDays()` treats anything that is not a finite positive number as absent, so
precedence continues per-platform, then top-level, then `FALLBACK_MIN_VARIANT_DAYS`. The same guard
covers `minVariantDaysOverride`, so a test seam cannot disable the window either.
`platformsConfigSchema` is now exported (alongside the already-exported `platformRuleSchema`) so the
top-level key's own validation is testable without writing a fixture into the live config.

### Repair-round load-bearing

| Revert | Failing tests |
| --- | --- |
| `normalizeRowId` back to `rowId === undefined` plus an exact `===` row compare | 4 fail / 29: "an EMPTY row id refuses on min_reuse_days", "a WHITESPACE-ONLY row id ...", "a differently-cased row id is the SAME row ...", "a padded row id is the SAME row ..." |
| drop `.positive()` from both schema fields | 1 fail / 29: "the schema rejects a non-positive min_variant_days before the resolver ever sees it" |
| drop the `positiveDays` guard from the resolver and the override | 6 fail / 29: the four "per-platform / top-level 0 or negative resolves to the named fallback" cases, "a non-positive per-platform value falls through to a usable top-level value", "a zero override still spaces a different derivative instead of allowing it" |

### Gap 3, no-slot deferral at the publisher call sites

Reachable without any live call. bluesky and substack both cap at `posts_per_week: 7` over seven
slot days, so the ledger fixture seeds one claim per PT day from 10 days back to 400 days ahead,
which puts every Mon-Sun week in the 365-day probe range at its cap. `claimSlots` then returns no
time and the fail-closed branch fires. Both new tests assert the ledger is byte-identical afterwards
and that no provider was called (Typefully's stubbed fetch captured zero `/drafts` payloads;
Substack's injected `postFn` throws if reached). TikTok's own no-slot path is pinned by the existing
`TIKTOK_SCHEDULE_AT` inside-the-window test; all three print `reuse guard: could not place ...`.

### Gate flake, unresolved

The first `npm run check` after the repairs reported `4458 pass / 1 fail`, exit 1. The failing
subtest name was not captured (only the tail was kept). SEVEN consecutive full-gate runs since then
were green at `4459 pass / 0 fail`, exit 0 (three of them a background sweep run specifically to hunt
it), and no `not ok` line appears in any saved log. Reported rather than dismissed: it is not
reproduced and not identified. No suite this slice owns has failed in any run.

## Worker run — 2026-09-11

### Exact new or changed user-facing strings

Studio deferral note, on the scheduled result and appended to the folder's `publish-log.md`:

> `Spaced from an earlier post from this piece on bluesky. First free slot past the spacing window is Sat, Sep 19, 6:30 PM PT.`

Recovery-branch message, only for a publisher that declined a deferrable row (cards.ts / youtube.ts,
which stay row-unaware and therefore still refuse):

> `not scheduled: another post from this piece already went to bluesky on <iso>. This one can go out from <iso> (min_variant_days: 7)`

No-slot refusals (Studio, typefully, tiktok, substack all use one wording):

> `could not place bluesky-1, no free bluesky slot on or after Sat, Sep 19, 6:30 PM PT`

Guard `reason` for a deferral (console log only):

> `"<slug>" already has a post on bluesky from 0.0 days ago (min_variant_days: 7), so this one is spaced to <iso> or later`

Other new console lines: `reuse guard: <reason>, skipping <id>`; `reuse guard: <id> needs spacing from
an earlier post from this piece, and an unscheduled draft has no time to space. Schedule it instead.`;
`no rows to publish: every remaining row needs a scheduled time to space it from an earlier post`;
`no rows to publish: no free slot was available past the reuse guard's spacing window`;
`the reuse guard handed back an unreadable spacing date for <id>: <value>`.

Unchanged on purpose: the refusal string `blocked by reuse guard, last placed to <platform> <iso>
(min_reuse_days: N)` and `not scheduled: blocked by the reuse guard (check the server log for the
reason)`.

### Voice check

`muxinVoiceFindings` run over every new string: zero em-dash, banned-phrase or banned-word findings.
Four strings raise `starts a word lowercase after a colon`, all of them label prefixes that copy
shipped siblings in the same modules (`not scheduled: blocked by the reuse guard ...`,
`no rows to publish: ...`, `reuse guard: ...`). Capitalising only the new half would leave two
messages in the same Studio cell disagreeing. Flagged for coordinator adjudication rather than
silently changed. Em dashes appear in four added lines, all of them code comments or the regex
literal `/—/` inside the assertion that the deferral note contains none.

### Load-bearing proof, detail

Four independent reverts of production code only, tests untouched, each restored byte-for-byte
afterwards (`diff -q` against pre-revert copies, then `tsc` exit 0).

| Revert | Failing tests |
| --- | --- |
| A. `checkReuseForRow` delegates to the merged `checkReuse` | 7 fail / 100: reuse-guard "a DIFFERENT row an hour after a placement defers...", "a DIFFERENT row past the variant window is allowed...", "an unreadable minVariantDaysOverride window is honored..."; postiz-reuse "the case that prompted this slice..."; publisher-deferral typefully/tiktok/substack "a DIFFERENT derivative ... past the variant window" |
| B. Studio treats a deferred verdict as a refusal | 1 fail / 100: postiz-reuse "the case that prompted this slice: bluesky-1 an hour after bluesky-2 is SCHEDULED, past the variant window" |
| C. drop the `now:` spacing floor from the three publishers' `claimSlots` | 3 fail / 41: publisher-deferral typefully, tiktok, substack "a DIFFERENT derivative ... past the variant window" |
| D. drop `min_variant_days` from the platforms loader | 1 fail / 16: reuse-guard "the real config/platforms.yaml supplies the top-level default" |

The YAML key's own value (7) coincides with `FALLBACK_MIN_VARIANT_DAYS`, so removing the key alone is
behaviourally invisible. Revert D covers it instead by asserting `loadPlatforms().min_variant_days`
reads back 7, which is `undefined` if the key or the loader field is gone.

### Hygiene disposition

`bash scripts/repo-hygiene.sh --rescue` was run and its output reviewed. Exit 1, as expected while
other sessions hold work.

Created by this session, left uncommitted because the packet forbids the worker committing:
`src/publish/publisher-reuse-deferral.test.ts`.

Listed and left in place, not created by this session: `briefs/human-inference/bets.md` (a real
placement from the SLICE-6W run, read only, never written),
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/publish-log.md` and
`review-queue.md` (same run), `data/outreach/tracker.jsonl`,
`docs/operations/launch-slices/SLICE-6Z.md` (written by the packet session, edited in place here),
worktrees `/private/tmp/claude/content-agents-worktrees/wt-slice-6m` and `wt-slice-6s` with their
modified `e2e/*.ts`, and merged branches `slice-6m-worker` and `slice-6s-worker`.

### Read-set measurement

- `## Slice protocol` section: 24560 B (cap 24576)
- `## START HERE` block: 1242 B
- `SLICE-6Z.md` as read at session start: 8473 B

### Coordinator note on the delta audit's D8 flake suspect

Grok's delta audit named shared `process.env.CONTENT_AGENTS_TEST_BETS_PATH` across
`reuse-guard.test.ts` and `publisher-reuse-deferral.test.ts` as the likely source of the one
unreproduced `4458 / 1` run. That suspect does not hold: `node:test` isolates each test FILE in its
own child process by default, so an env mutation in one cannot reach the other. Within a file the
subtests run in order. Grok rated every other candidate weak and confirmed the repair diff carries
no time-, order- or shared-state dependency.

The coordinator also checked the one genuinely time-based helper, `saturate()` in
`publisher-reuse-deferral.test.ts`, which seeds one ledger claim per day from -10 to +400 using
`new Date(Date.now() + offset * 86_400_000)` and a UTC date string. UTC observes no daylight-saving
transition, so the 411 dates are contiguous with no skipped calendar day, and +400 covers the
scheduler's 365-day probe range. No gap there either.

No candidate was found in the code. The failure is recorded as unidentified and unreproduced across
the worker's five later runs plus the coordinator's own independent `npm run check` (4459 / 0, exit
0, zero `not ok` lines). It is not dismissed; if it recurs, capture the failing subtest name before
anything else.

### Two smaller unresolved items, moved here from the packet

3. Four new log strings keep the lowercase-after-colon label prefix their shipped siblings in the
   same modules already use, which `config/voice.yaml` flags. Capitalising only the new half would
   make two messages in one Studio cell disagree, so they were left consistent and flagged instead
   of silently changed.
4. `src/config/platforms.ts` is outside the packet's Owned files, but a new top-level
   `min_variant_days` key cannot be read without it. The change is additive: two optional schema
   fields and one loader field, with `min_reuse_days` and every shipped window value untouched.

### Why one e2e run exited 1

The coordinator's first `npm run test:e2e` reported 55 pass, 0 fail, 16 blocked and then exited 1
on `E2E isolation failure: shared worktree changed`, naming `docs/content-studio-master-status.md`,
`SLICE-6Z.md` and `SLICE-6Z-LOG.md`. Those are the three closeout documents the coordinator was
editing while the suite ran. The isolation check did its job; it caught concurrent editing, not a
test failure. Re-run with nothing else touching the tree: exit 0, 55 / 0 / 16, and
`E2E isolation: shared worktree byte-identical after disposable passes.`
