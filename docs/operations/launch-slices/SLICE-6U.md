# SLICE-6U: the last two e2e failures, and the two real defects hiding behind them

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`.

Run by the coordinator directly (Opus, high effort), diagnosis first, packet written after the
work rather than before it. SLICE-6T's closeout named these two failures as "the next slice";
6T's own packet had been written without diagnosis and was wrong about its premise, so this one
was diagnosed before anything was changed.

## Goal

The one Pass A and one Pass B failure SLICE-6T left behind, both pre-existing on `main`.

## What they actually were

Both were stale tests asserting behavior SLICE-5S (`7c6815f`, 2026-09-07, "separate approval from
durable explicit scheduling") deliberately removed. Dated on both sides with `git log -S`: the
expectations were written 2026-09-01 (`a3ec457`), the UI they described was replaced six days
later. Neither could ever pass again.

1. `pass-a-reads.ts` greps the approval sheet for "Approve selected and attempt scheduling" and
   "provider accepted or published" — pre-5S copy for the combined approve-and-publish action.
2. `pass-b-writes.ts` approved two rows and then read `publishingStatus` off them, which is
   `undefined` after 5S because approval no longer starts a publishing attempt.

Fixing (2) honestly meant driving the Publishing room's Schedule action, and that is where two
genuine defects surfaced that the stale red had been hiding for eleven days:

- **The hermetic seam sat in the wrong place.** `disposableProviderOutcome` was consulted at
  `publishing-status.ts:349`, *after* provider selection at ~302. A disposable browser run
  therefore attempted real provider discovery and failed before it could ever reach the injected
  fake. Pre-5S the seam was hit first, which is why this had never shown.
- **The disposable run loaded real credentials.** `run-all.ts`'s copy filter excluded only `.git`
  and `node_modules`, so the repository-root `.env` was copied into every disposable root. Nothing
  published — discovery failed on transport — but a suite whose whole claim is hermeticity was
  reaching for a live provider with Muxin's real keys.

## Changes

- `e2e/pass-a-reads.ts` — assert the 5S separation positively *and* negatively, so a future
  publish-on-approve regression fails the record rather than silently passing.
- `e2e/pass-b-writes.ts` — build fixture rows through `appendRows` rather than a hand-written
  table (5S requires verifiable creation provenance; hand-written rows are `legacy` to
  `approvalDispatchDisposition` and refused at dispatch by design, so the old fixture could not
  have exercised publishing at all). Split the stale record in two: approval starts no publishing
  attempt, and Publishing's own Schedule action reports the two injected outcomes apart. Schedule
  is driven per row; the "Move" control is never clicked because it opens a `prompt()` dialog.
- `e2e/run-all.ts` — exclude `.env` from the disposable copy, and state
  `CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID` for the B pass. That identity is a non-secret string
  already committed in `config/brand-accounts.yaml`; it used to arrive by accident from `.env`,
  and naming it keeps the delivery-policy identity check genuinely exercised without the suite
  depending on a real key file.
- `src/review/publishing-status.ts` — resolve `disposableProviderOutcome` before provider
  selection and use its `provider` when it fires. The seam stands in for the whole external round
  trip, and discovery is part of that round trip.

## Acceptance

- [x] Both stale records replaced by records that assert the behavior 5S actually shipped, neither
      deleted nor downgraded.
- [x] The seam's own gate is unchanged and still the only thing admitting the injected branch: a
      one-run token, a marker file inside the disposable repo, and `E2E_REPO_ROOT` resolving to the
      executing checkout.
- [x] `npm run test:e2e` exits 0 twice solo, unsandboxed: **50 pass, 0 fail, 16 blocked** both
      runs. Shared worktree byte-identical after both.
- [x] `npm run check` exits 0 unsandboxed: **4379 pass / 0 fail**, 173 s. (6T logged two
      `src/util/env.test.ts` failures; those were an artifact of a worktree with no `.env` and pass
      here on `main`.)
- [x] `npx tsc --noEmit` exits 0.
- [x] Cross-family audit passed — see `## Verify`.

## Verify

Classification: meaningful behavior / high risk. `src/review/publishing-status.ts` is the
double-post guard.

Cross-family audit (Codex, `codex exec --sandbox read-only`), three fixed questions: (1) can a
non-e2e caller reach the injected branch; (2) does skipping `selectConfiguredProvider` on that
branch weaken any safety property surviving past it; (3) does the reordering change the
non-injected path. Verdicts: gate sufficient, no established bypass; no surviving safety property
weakened — `resolveDeliveryPolicy`, `markDispatchStarted` and `appendPublishingStatus` each
re-derive their own evidence and `selectConfiguredProvider` leaves no durable authorization state;
no non-injected behavior change — the helper does guarded env and filesystem reads only, returns
early without both env values, and returns non-null for exactly two row ids. **No established
defects.**

For UI changes: none — no page, component or copy change, so the standing design sanity check does
not apply.

## Closeout

**PASS** — 2026-09-11. Suite green end to end for the first time in this sequence. No leftovers.

Still outstanding from 6T, unrelated: `AGENTS.md` → `## Slice protocol` is 26179 B against a
24576 B cap and is due for a trim.
