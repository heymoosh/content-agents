# SLICE-6Y log

Dated records for `SLICE-6Y.md`. No session reads this file; the packet is the specification.
Newest first.

## Worker RESULT BLOCK, full record — 2026-09-11

Lane A, Claude opus worker, one pass plus one audit repair. Delivery state: verified, never
committed by the worker.

### What changed

- `src/publish/postiz.ts` — `resolveConfiguredPostizCapability` selects from an approved-account
  allowlist instead of one pinned id, via a new private `approvedPostizAccountIds`.
- `src/publish/postiz.test.ts` — new suite `SLICE-6Y approved Postiz accounts`, 10 tests.
- `src/review/studio-scheduling.test.ts` — new suite `SLICE-6Y the Publishing room schedules any
  approved Postiz channel`, 3 tests, driving the exported `selectConfiguredProvider` with stubbed
  discovery. No filesystem, no provider, no network.

Deliberately untouched: `src/review/studio-scheduling.ts` (line 168 propagates the refusal with no
edit needed), `selectDeliveryRoute`, `approval-provenance.ts`, `publishing-status.ts`, `config/**`,
`data/**`, `.env` (never read, written or printed). `.env.example` does not exist in this
repository, so both variables are documented in the doc comment above `approvedPostizAccountIds`
instead.

### Behavior

`POSTIZ_ACCOUNT_IDS` is a comma-separated allowlist. `POSTIZ_ACCOUNT_ID` is one opaque id, never
split, and the two are unioned with blanks dropped and duplicates removed. Exactly one approved
match resolves. Two approved matches refuse naming both ids. A connected but unapproved channel
refuses naming the id to add. An approved id the registry never returned is ignored. An empty or
whitespace-only value is unset, never approve-everything.

### Refusal strings, exact

2 to 4 are new; 5 is unchanged and now fires only when Postiz genuinely lacks the capability. None
carries an em dash, a banned phrase, a colon or an id read from `.env`, asserted by the test "every
refusal this guard can produce passes the voice rules".

1. `POSTIZ_ACCOUNT_IDS or POSTIZ_ACCOUNT_ID is required to select a discovered instance account`
   (changed: it names the new variable, with the original tail kept verbatim)
2. `${n} approved Postiz accounts advertise ${destination}/${media} (${ids}). Leave one of them in POSTIZ_ACCOUNT_IDS and remove the rest.`
3. `Postiz has ${destination}/${media} connected on account ${id}, which is not approved for posting. Add ${id} to POSTIZ_ACCOUNT_IDS to schedule this channel.`
4. `Postiz has ${destination}/${media} connected on accounts ${ids}, none of them approved for posting. Add the one you want to POSTIZ_ACCOUNT_IDS to schedule this channel.`
5. `configured Postiz account does not advertise ${destination}/${media}`

### Cross-family audit — Grok, grok-4.5, 2026-09-11

Verdict PASS WITH FINDINGS. Coordinator disposition:

- **P2, CONFIRMED, repaired.** `approvedPostizAccountIds` comma-split both variables, contradicting
  its own doc comment and widening the guard: a legacy value containing a comma used to be one
  opaque id that matched nothing, and its split tokens could then resolve. Repaired so only
  `POSTIZ_ACCOUNT_IDS` splits; the doc comment now states the rule and why. Pinned by the test
  "the legacy variable is one opaque id and is never split into a list".
- **Accepted without change.** Duplicate registry rows for one approved id and destination/media
  now refuse where the old `find` picked the first. Stricter and fail-closed.
- **Accepted without change.** Refusal strings embed account ids. Those are channel identifiers,
  not credentials, and naming the id is the point of the message.

### Checks, all unsandboxed, from the repository root

Post-repair: `npx tsc --noEmit -p tsconfig.json` exit 0 · `node --import tsx --test
src/publish/postiz.test.ts src/review/studio-scheduling.test.ts` exit 0, 50 pass / 0 fail / 0
skipped, 8 suites · `npm run check` exit 0, 4419 pass / 0 fail / 0 skipped, 497 suites, 356.8s.

Pre-repair run of the same commands: tsc 0; focused 0, 49 pass / 0 fail / 0 skipped; `npm run check`
0, 4418 pass / 0 fail / 0 skipped, 233.5s; `npm run test:e2e` 0, 55 pass / 0 fail / 16 blocked,
431.5s. E2E was not rerun after the repair, which touched only `src/publish/postiz.ts` and
`src/publish/postiz.test.ts`.

### Load-bearing proof

- Whole production change reverted to HEAD, tests untouched: exit 1, 38 pass / 12 fail. Every
  behavior test of both new suites fails (10 of 10 in `postiz.test.ts`, 3 of 3 in
  `studio-scheduling.test.ts`, counted as 12 leaf failures plus 2 suite rows). Only the voice-rules
  test passes both ways, by design: it guards wording, not behavior.
- P2 repair alone reverted (legacy variable comma-split again), everything else in place: exit 1,
  49 pass / 1 fail, the single failure being "the legacy variable is one opaque id and is never
  split into a list". The repair test is load-bearing on its own finding.

No existing test was weakened, rewritten or deleted. `src/publish/postiz.test.ts:25` asserts
`/does not advertise/` for `x/video` with `POSTIZ_ACCOUNT_ID: "acct-1"` and still passes unedited,
because that account really does not advertise video.

### Evidence

Session scratchpad: `check.txt`, `check2.txt`, `focused2.txt`, `e2e.txt`, `loadbearing.txt`,
`lb-head.txt`, `lb-p2.txt`. Plus `e2e/e2e-summary.json`, which recorded the shared worktree
byte-identical after its disposable passes.

### Notes

- No e2e pass covers Postiz account selection: no file under `e2e/` names `POSTIZ_ACCOUNT_ID`. Per
  the packet's Verify section this is stated rather than added. The journey is covered at the
  `selectConfiguredProvider` seam with stubbed discovery.
- Legacy-only behavior is identical to before the slice except the connected-but-unapproved
  refusal, which acceptance item 8 requires to change.
- `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` is modified
  in the working tree by another session (bluesky-1 and threads-1 set to `approve`). Named and left
  in place, per the closeout rule.
- Test fixtures use invented ids (`acct-threads`, `acct-bluesky`, and so on). No real account id or
  secret appears in any test, fixture, refusal string or log line.
- Usage: local checks 233.5s + 431.5s + 356.8s + focused runs, by `/usr/bin/time -p`. Model and
  provider usage is not reported by this harness, so it is unknown and not inferred.
