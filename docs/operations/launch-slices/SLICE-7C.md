# SLICE-7C: a reuse-guard refusal clears its fence on every route, not just Postiz

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

A row refused by the reuse guard on a NON-Postiz route resolves its durable dispatch fence
`not-created`, the same way a Postiz row already does, because the refusal is decided before any
publisher is invoked.

Today `scheduleApproved` (`src/review/studio-scheduling.ts`) runs a pre-flight
`reuseGuardVerdict` only inside the `provider === "postiz"` branch, and only that site can return
`refusal: "no-provider-request"` — the one discriminant `publishing-status.ts` accepts as proof
nothing reached the provider. Every other route (Typefully text, Typefully quote cards, PostPeer
TikTok, YouTube, Substack) invokes its publisher first and recovers the reason afterwards from
`runPublisher`'s empty-result branch, which can only claim the weaker `publisher-declined`. That is
correct given what it knows, and the consequence is that those rows keep their fence forever: they
are not resolve-eligible, cannot retry, and need hand repair. This is every quote card and every
video in the system.

The fix is symmetry, not a new claim. Ask the guard BEFORE calling the publisher on those routes
too. A refusal then returns without `fn` ever running, so `no-provider-request` is provable at that
site by exactly the same argument the Postiz pre-flight already makes.

What must NOT change: the fail-closed residue. If the pre-flight says allowed or deferred and the
publisher still returns `[]`, that stays `publisher-declined` with the fence RETAINED. An empty
publisher result is still not proof that nothing was created, and no widening of that rule is in
scope.

## Difficulty

easy — one guard call hoisted ahead of two dispatch sites. The care is in placement and in leaving
the retained-fence residue alone, not in volume of code.

## Depends on

SLICE-7A (the typed `refusal` discriminant and the fence-resolution rule in
`src/review/publishing-status.ts`) — accepted. SLICE-7B — accepted.

Delivery batch: SLICE-7C alone. Acceptance order: tests red, implementation, tests green, Grok
audit, coordinator gate. Stop condition: a P0/P1 audit finding, or any check that cannot be made
green without weakening an existing test.
Owner checkpoint: none. Muxin has authorized this slice; no human acceptance action is needed
before the coordinator's gate.

## Owned files

Parallel-safe: no. One behavior in one function, and its tests assert on that exact behavior. A
second lane would own no independent deliverable and would contend for the same two files.

### Lane A — the pre-flight, and its proof

- `src/review/studio-scheduling.ts`
- `src/review/publishing-status.test.ts`
- `src/review/studio-scheduling-postiz-reuse.test.ts`

## Do not touch

- `.env` — do not read it, write it, print its values, or pass it to any tool or flag. Not with
  cat, grep, sed, head, dotenv or `--env-file`. Read it, write it, or print its values and the
  slice is void. `.env.example` is likewise not yours to edit.
- Any live provider or network call. No Postiz, Typefully, PostPeer, YouTube, Substack, or
  `npm run publish:*`. Stub discovery and every publisher in every test.
- `data/**`, `~/.content-agents/**`, `briefs/**` (the Placed log is an append-only shipping record:
  read it, never modify it). Tests use `CONTENT_AGENTS_TEST_BETS_PATH` and
  `CONTENT_AGENTS_TEST_BRIEFS_ROOT`.
- `docs/content-agents-backlog.md` and `docs/operations/launch-slices/evidence/**`.
- `src/review/publishing-status.ts` — the fence-resolution rule is SLICE-7A's and is already
  correct. This slice changes only WHICH failures can truthfully carry `no-provider-request`; it
  does not change what `publishing-status.ts` does with it. If you believe the fix requires editing
  that file, stop and say so instead.
- `src/publish/*.ts` — the publishers' own internal guard calls stay exactly as they are. This
  slice adds a check ahead of them, it does not move or remove theirs.
- Never weaken, rewrite, disable or delete an existing test to make anything pass.

## Cited headings

none

## Acceptance

- [ ] `runPublisher` asks `reuseGuardVerdict(folder, kind, row, brand)` BEFORE invoking `fn`. On
      `refused` it returns `{ scheduled: null, scheduleError: verdict.message, refusal:
      "no-provider-request" }` without calling `fn` at all.
- [ ] The same pre-flight covers the `dispatchMode === "unscheduled-draft"` branch, which calls
      `deps.publishText` directly rather than through `runPublisher`.
- [ ] The media→Typefully backup route (`scheduleMediaViaTypefully`) is covered, via `runPublisher`
      rather than by a second bespoke call site.
- [ ] A `deferred` verdict is NOT a refusal: control falls through to the publisher unchanged, and
      no `earliestAt` is passed to a non-Postiz publisher. Those publishers compute their own
      spacing and must keep doing so.
- [ ] The residue is unchanged: pre-flight allowed-or-deferred plus an empty publisher result still
      yields `refusal: "publisher-declined"`, ledger `blocked`, fence RETAINED.
- [ ] The Postiz branch's existing pre-flight is untouched and still returns before
      `defaultPublishPostiz` claims a slot.
- [ ] A new test proves that a reuse-guard-refused row on a non-Postiz route ends with its dispatch
      fence resolved `not-created` and is therefore re-dispatchable, asserted through
      `scheduleApprovedOnce` end to end, not by unit-testing the discriminant alone.
- [ ] A new test proves the negative: a non-Postiz publisher that returns `[]` DESPITE an allowed
      pre-flight verdict leaves the fence in place and the row not resolve-eligible.
- [ ] A new test proves the publisher was never invoked on a pre-flight refusal (assert a call
      counter on the stubbed publisher is 0). The fence claim rests on this and nothing else.
- [ ] At least two distinct non-Postiz kinds are covered by the above (e.g. `card` and one of
      `tiktok`/`shorts`/`substack`), so the fix is proven route-general and not Typefully-shaped.
- [ ] The comment block at the Postiz pre-flight that currently reads "Non-Postiz routes are
      deliberately not gated here" is corrected. It documents the old design and would otherwise
      read as a rule forbidding this change.
- [ ] No user-facing string gains an em dash or an AI tell (`config/voice.yaml`).

## Verify

Classification and applicable gate: meaningful behavior / high risk. This decides whether a human
may clear a dispatch fence and re-run a publisher. Getting it backwards ships one approved post
twice under Muxin's byline with no undo. Required: focused red/green tests on the changed behavior,
then the full suite, then a cross-family audit.

No UI change. No live integration: every publisher and discovery call is stubbed, so live
integration proof is not applicable and must not be claimed.

Run every command unsandboxed. Under the sandbox this suite produces roughly 196 phantom venture
failures that are not real.

```
node --import tsx --test src/review/publishing-status.test.ts src/review/studio-scheduling-postiz-reuse.test.ts
npm run check
```

Record exact pass/fail/skip counts for both, and the candidate commit-free diff identity.

## Observable result

A quote card or a video refused by the reuse guard reports `blocked` with the real reason and is
retryable afterwards, instead of being permanently stuck needing Muxin to repair state by hand.

## Risk

medium — audit required: yes. The change is small but it sits on the exact boundary that decides
whether a fence may be cleared, which is the one decision in this repo whose wrong direction is
irreversible and public. Evidence for "medium" rather than "high": the change only ever moves a
check EARLIER, never relaxes what a given discriminant means, and the ambiguous case keeps its
existing fail-closed behavior.
Review boundary: this candidate.
Review scope/budget: one audit pass. The question for the auditor is narrow and stated: is the
pre-flight genuinely ahead of every call that could create, schedule or modify a provider object,
and of every slot claim, on each route it now covers? Name any route where it is not.
Prior accepted evidence: SLICE-7A's fence-resolution rule and SLICE-7B's route selection are
accepted and are not reopened by this slice.
On reviewer outage: mark the candidate review-blocked and stop. Do not integrate a candidate whose
required cross-family review is pending, and never substitute a same-family audit.

## Families

- Builder: Claude, Opus 5
- Auditor: Grok, `grok-4.5` — cross-family is mandatory and Codex is capped until 2026-09-15. Never
  a Claude auditor.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md`.

Preflight: changed paths limited to the three owned files; every acceptance item above mapped to a
named test or a cited diff hunk; both check exit codes recorded with counts; the audit returned and
every P0/P1 finding fixed or the candidate stopped.
Gate cost: `npm run check`, unsandboxed, once at the end. Measured runtime: unknown until run. No
paperwork-only rerun.

Use the `### Hygiene disposition` and `### Read-set measurement` forms in
`docs/operations/slice-protocol-environment.md`.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
- Delivery state and next action: <built | verified | accepted | committed; workers cannot accept/commit>
- Usage:

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: serial. Delegation would add only overhead for one behavior in one function.
- Assignment: one Claude Opus 5 worker, fresh context, frozen handoff at the filled RESULT BLOCK.
- Evidence return: both commands, their exits, pass/fail/skip counts, the diff, and pointers to the
  new tests by name.
- Capability boundary: worker returns the RESULT BLOCK and stops. The coordinator runs the audit
  and the gate, and is the only role that commits.
