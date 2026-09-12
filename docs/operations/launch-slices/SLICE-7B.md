# SLICE-7B: a Postiz channel never silently downgrades to Typefully

Protocol: `AGENTS.md` → `## Slice protocol`, plus `docs/operations/slice-protocol-environment.md`.
Read those and this file only. Do not load the repository for context. Do not commit.

## Goal

When Postiz can take a destination, the post goes to Postiz. When it cannot, Muxin is told why.
Today two paths hand an x, linkedin or bluesky row to Typefully with no error, no ledger signal and
no Studio message, so a row silently lands on a different provider with different scheduling
behavior from its siblings in the same piece.

Observed 2026-09-12 on `x-1` of `2026-09-07-the-world-s-broken-what-do-we-do-human-inference`.
Bluesky and threads rows from that piece went to Postiz and carry real planned times. `x-1` went to
Typefully and shows "No planned time recorded". Diagnosis in `SLICE-7B-LOG.md` is the worker's to
write; the two paths are named below.

1. `selectConfiguredProvider` (`src/review/studio-scheduling.ts:144-147`). `configured` is false
   when `POSTIZ_BASE_URL` or `POSTIZ_API_KEY` is blank, and the row goes to `legacyProvider`, which
   returns `typefully` for a text row. No error is raised.
2. `selectDeliveryRoute` (`src/publish/postiz.ts:365-368`). Discovery succeeded and is authoritative,
   but the registry does not list the destination, so x, linkedin and bluesky fall through to the
   `typefully` line. No error is raised.

The transport-failure path (`:155`) is NOT in scope. It already throws and already fails closed.

Done means: a row whose destination Postiz is expected to serve either goes to Postiz or refuses
with a reason Muxin can act on. It never arrives on Typefully without her having chosen that.

## Difficulty

hard — it changes provider selection on the live-posting path. A wrong change either posts through
an unintended account or blocks a channel that legitimately has no Postiz route.

## Depends on

7A (accepted). Delivery batch: 7B alone; acceptance order is 7B then stop. A free agent slot does
not authorize another slice.

Owner checkpoint: Muxin asked for this after finding `x-1` on Typefully while its siblings were on
Postiz (2026-09-12). Her words: Typefully is a fallback, not a permanent solution. Coordinator scope
decisions, already resolved, do not reopen them:

1. Typefully is not removed. It stays a legitimate route where Postiz genuinely has no channel and
   where a media row's backup path already sends it. What ends is the SILENT part.
2. Path 1 (`!configured`) is a deployment choice, not a hiccup. When neither `POSTIZ_BASE_URL` nor
   `POSTIZ_API_KEY` is set, legacy routing is unchanged: this repo must still work with no Postiz.
   When exactly one of the two is set, that is a broken configuration, not a choice, and it refuses.
3. Path 2 is the real defect. When Postiz IS configured and discovery IS authoritative, a
   destination Postiz does not list must refuse for text rows, naming the destination and saying
   Postiz does not have it connected. It must not route to Typefully behind Muxin's back.
4. Media rows are out of scope. `legacyProvider(kind, row)` for `kind === "media"` is 6-series
   accepted behavior and the comments at `:161-165` explain why. Do not change the media path.
5. `resolveConfiguredPostizCapability` and the `POSTIZ_ACCOUNT_IDS` allowlist are 6Y, accepted and
   unchanged. An approved-account refusal already names the id to add; that message stays.
6. No new env var. No new Studio UI.

## Owned files

Parallel-safe: no. One worker. Both paths feed one selection function and one set of tests.

### Lane A — explicit refusal in place of a silent provider downgrade

- `src/publish/postiz.ts`
- `src/review/studio-scheduling.ts`
- `src/publish/postiz.test.ts`
- `src/review/studio-scheduling.test.ts`
- `docs/operations/launch-slices/SLICE-7B.md` (RESULT BLOCK only)
- `docs/operations/launch-slices/SLICE-7B-LOG.md` (new; the full record goes here)

## Do not touch

- `.env` — read it, write it, or print its values and the slice is void. The coordinator owns it.
- Anything under `data/`, the real data root `~/.content-agents/**`, and `briefs/**`. The Placed
  log is Muxin's append-only shipping record: read it, never modify it. Tests use
  `CONTENT_AGENTS_TEST_BETS_PATH` / `CONTENT_AGENTS_TEST_BRIEFS_ROOT`.
- `src/publish/typefully.ts`. The Typefully adapter is correct; only who reaches it changes.
- `resolveConfiguredPostizCapability` and `approvedPostizAccountIds` in `src/publish/postiz.ts`.
  6Y is accepted. Read them, call them, do not change them.
- `src/review/publishing-status.ts`, `src/review/approval-provenance.ts`. 7A is accepted.
- `src/publish/reuse-guard.ts`, `config/platforms.yaml`, `src/publish/slots.ts` and the slot ledger.
- `docs/content-agents-backlog.md` (board writes via `prose_kanban` only),
  `docs/operations/launch-slices/evidence/**`.
- No live provider or network call of any kind. Discovery is stubbed in every test.

## Cited headings

none

## Acceptance

- [ ] With Postiz configured and a registry that does NOT list `x`/`text`, scheduling an x text row
      refuses. The refusal names `x` and says Postiz does not have that channel connected. It does
      not return `typefully`.
- [ ] Same for `linkedin`/`text` and `bluesky`/`text`. One test names each of the three.
- [ ] With a registry that DOES list the destination, the route is still `postiz` and
      `resolveConfiguredPostizCapability` is still what decides the account. 6Y behavior unchanged,
      including its two refusal messages.
- [ ] With neither `POSTIZ_BASE_URL` nor `POSTIZ_API_KEY` set, a text row still routes to
      `typefully` exactly as today. A test pins this; the repo must work with no Postiz at all.
- [ ] With exactly one of the two set, scheduling refuses and names the missing variable. This is
      the broken-configuration case, distinct from the deliberate no-Postiz case above.
- [ ] Media rows are unchanged. A media row that reaches `legacyProvider` still takes the Typefully
      backup route, and the `unsupported` branch for media still returns `legacyProvider`. Pin both.
- [ ] The transport-failure throw at `studio-scheduling.ts:155` is byte-identical to HEAD and still
      throws. Quote it in the RESULT BLOCK.
- [ ] `selectDeliveryRoute`'s non-text routes are unchanged: `facebook` unsupported, `tiktok`/video
      postpeer, `youtube`/video youtube, `substack`/text substack. Pin each.
- [ ] Every refusal string a human reads passes `config/voice.yaml`: no em dashes, no AI tells, and
      each one says what to do next.
- [ ] No production path reads `.env` differently and no secret value appears in any test, fixture,
      error string or log line. An account id is a non-secret audit identity and may appear.
- [ ] Every new test is load-bearing: reverting the production change alone makes named tests fail.

## Verify

Meaningful behavior on the live-posting path, high risk: full repository gate, focused tests, e2e.
Run every command unsandboxed; under the sandbox the suite reports roughly 196 phantom venture
failures. Nothing may touch the working tree while `test:e2e` runs, or it fails its own isolation
check. No UI change is in scope. The affected journey is Publishing room → Schedule an x row.
Fixture backend only, never live. If no existing e2e pass covers it, state that plainly rather than
adding one.

```
npx tsc --noEmit -p tsconfig.json
node --import tsx --test src/publish/postiz.test.ts src/review/studio-scheduling.test.ts
npm run check
npm run test:e2e
```

Record the exact commands, exit codes and pass/fail/skip counts. Do not weaken, rewrite or delete
an existing test to make anything pass. `src/publish/postiz.test.ts:20` asserts
`selectDeliveryRoute(registry, "linkedin", "text") === "typefully"` and genuinely encodes the rule
this slice changes: quote it in the RESULT BLOCK and say what it becomes and why, rather than
deleting it. If any OTHER existing test encodes the old rule, quote it and stop for the coordinator
to adjudicate.

## Observable result

Muxin schedules an x row. It goes to Postiz on the same rail as her bluesky and threads rows, with a
real planned time. If Postiz does not have X connected, Studio tells her that in those words instead
of quietly saving a Typefully draft that never fires.

## Risk

high — audit required: yes. Provider selection decides which account real content posts from. A
wrongly permissive change posts through an unintended account under Muxin's byline with no undo. A
wrongly strict one blocks a channel, which is recoverable, so every ambiguous case must refuse.
Review boundary: this candidate. Ordinary effort: one cross-family audit of the candidate diff,
changed-file list and focused check output, with bounded questions on whether any legitimate
Typefully route was removed and whether any new refusal can strand a working channel.
Prior accepted evidence: 6Y's allowlist and 7A's fence are unchanged here; reopened only if this
candidate edits their files, which it must not.
On reviewer outage: mark the candidate review-blocked and do not integrate. Codex is capped until
2026-09-15, so Grok is the auditor. If Grok is also unavailable, stop; never a Claude auditor.

## Families

- Builder: Claude, opus tier — Lane A. Standing routing decision (2026-09-11).
- Auditor: Grok, reasoning effort high. Codex capped until 2026-09-15. Never a Claude auditor.

## Closeout

Use the `### Closeout gate disposition`, `### Hygiene disposition` and `### Read-set measurement`
forms in `docs/operations/slice-protocol-environment.md`.

Preflight: every acceptance item mapped to a named test or a quoted string; changed paths within
Lane A ownership; `.env` untouched and unread; `git status --porcelain -- data briefs` empty; check
exit codes recorded; audit findings and their disposition written down before integration.
Gate cost: one `npm run check` on the pinned candidate. No paperwork-only rerun.

## RESULT BLOCK (worker fills this in and returns it)

- **Changed:** the four Lane A files; under the 2026-09-12 adjudication the three test files
  `studio-scheduling-postiz`, `studio-scheduling-postiz-reuse`, `publishing-status`; this block;
  `SLICE-7B-LOG.md` (new).
- **Outcome:** Built, verified, audited. `selectDeliveryRoute` drops `text` from the
  x/linkedin/bluesky Typefully fallback, keeps `image`. `selectConfiguredProvider` refuses an
  unsupported text route by name, and refuses when exactly one of `POSTIZ_BASE_URL` /
  `POSTIZ_API_KEY` is set; neither set is unchanged. Media, `legacyProvider`, 6Y and the `:155`
  throw (byte-identical to HEAD) untouched.
- **Checks and load-bearing:** `npx tsc --noEmit` 0. Focused run over the six owned and adjudicated
  test files: 0, **154 pass / 0 fail / 0 skip**, before and after the P2. `npm run check` /
  `test:e2e` not rerun, per the coordinator; pre-adjudication 4490/8, e2e 55/0/16 clean.
  Revert-production over the three adjudicated files: 72 of 73 pass, the failure being the
  rewritten contract test, so it is load-bearing; over the owned files revert fails 9 of 66.
  Refusal strings: `[]` from `muxinVoiceFindings`. No e2e pass covers that journey.
- **Audit:** Grok, PASS WITH FINDINGS. Zero P0, zero P1, one P2, applied: the retry leg of
  `publishing-status.test.ts` now also asserts `retried.publishing.provider === "postiz"`. Added
  only; flipping the expected value fails it, so it is not vacuous.
- **Unresolved:** None. The eight tests encoding the old rule are resolved: one contract rewrite
  (renamed, re-asserted, load-bearing) and seven fixture-only repairs, names and assertions
  byte-identical, still green against reverted production. Detail: `SLICE-7B-LOG.md` →
  `### Adjudication`, `## Independent audit`.
- **Delivery state:** Uncommitted, audit closed, ready for the coordinator's gate.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- One Claude opus worker, fresh context, frozen handoff at the completed RESULT BLOCK.
- Evidence return: commands, exits, counts, candidate identity, short result, artifact pointers.
- Capability boundary: the worker returns the RESULT BLOCK and stops. The coordinator runs the
  audit, the gate and the single integration commit.
