# SLICE-5K — archived history

Moved out of `SLICE-5K.md` by SLICE-6E to bring the packet under the 12,288-byte cap. Newest
first. Every line here was removed verbatim from the packet.

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
