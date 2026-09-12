# SLICE-6Y: every connected Postiz channel is schedulable, not just the one pinned id

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin can approve a Threads row in Studio's Publishing room and schedule it, and the same holds for
every other channel her Postiz instance actually advertises, while an account she has not approved
is still refused and never silently posted to.

Today `resolveConfiguredPostizCapability` (`src/publish/postiz.ts:298-309`) reads a single
`POSTIZ_ACCOUNT_ID` and requires the matched registry entry to carry that exact id. Postiz issues
one account id per channel, so one env value can only ever name one channel. Live discovery on
2026-09-11 returned six text-capable channels (mastodon, facebook, linkedin, threads, x, bluesky)
and `POSTIZ_ACCOUNT_ID` is pinned to the bluesky id `cmtgn0kdg0001oz8bki0xjw05`. Every non-bluesky
row therefore fails with `configured Postiz account does not advertise <destination>/text`, which
blames the channel for a configuration shape defect. This is the confirmed root cause of the open
6W deferral.

Done means: the approved-account guard survives, becomes expressible for more than one channel, and
its refusal names the real reason.

## Difficulty

hard — it is a small diff on the live-posting path, where a wrongly permissive selection posts to a
real social account under Muxin's byline and is unrecoverable.

## Depends on

6X (accepted). Delivery batch: 6Y alone; acceptance order is 6Y then stop. A free agent slot does
not authorize another slice.

Owner checkpoint: Muxin asked for this fixed properly rather than by swapping the pinned id
(2026-09-11). Coordinator scope decisions, already resolved, do not reopen them:
1. The guard stays an explicit allowlist. "Pick whichever account matches the destination" is
   refused: a channel newly connected in Postiz would then become postable with no human step.
2. New env var `POSTIZ_ACCOUNT_IDS`, a comma-separated list of approved account ids. The registry
   already maps id → destination, so no `destination:id` syntax is needed.
3. `POSTIZ_ACCOUNT_ID` keeps working as a one-entry allowlist. Muxin's `.env` must not need an edit
   for bluesky to keep working exactly as it does today.
4. Two approved accounts for one destination is a refusal, not a pick. Ambiguity fails closed.
5. No `.env` edit by any agent. The worker never reads or writes `.env`; the coordinator hands
   Muxin the line to paste.

## Owned files

Parallel-safe: no. One worker. The behavior change, its unit tests and the e2e journey all turn on
the same selection function and the same fixture registry shape; a second lane would own no path
this lane does not need to change in the same edit, so a separate assignment adds coordination cost
without an independent deliverable.

### Lane A — per-destination approved-account selection and its proof

- `src/publish/postiz.ts`
- `src/publish/postiz.test.ts`
- `src/review/studio-scheduling.ts` (only if the refusal text must be surfaced; prefer not to touch)
- `src/review/studio-scheduling.test.ts`
- `.env.example`
- `docs/operations/launch-slices/SLICE-6Y.md` (RESULT BLOCK only)

## Do not touch

- `.env` — read it, write it, or print its values and the slice is void. The coordinator owns it.
- Anything under `data/`, and the real data root `~/.content-agents/**`.
- `docs/content-agents-backlog.md` (board writes via `prose_kanban` only).
- `config/*.yaml`, `docs/operations/launch-slices/evidence/**`.
- `src/review/approval-provenance.ts`, `src/review/publishing-status.ts` — 6X's provenance gate is
  accepted and out of scope. It already passes for this row.
- No live provider or network call of any kind. No Postiz, Typefully, or dispatch. Discovery is
  stubbed in every test.

## Cited headings

none

## Acceptance

- [x] With `POSTIZ_ACCOUNT_IDS` naming the threads account id, a threads/text row resolves to that
      account and to no other.
- [x] With `POSTIZ_ACCOUNT_IDS` naming several ids, each destination resolves to its own approved
      account; a destination whose account is absent from the list is refused.
- [x] With only the legacy `POSTIZ_ACCOUNT_ID` set, selection is unchanged: that one account
      resolves, every other destination is refused. The refusal wording may change per item 8; what
      may never change is which account resolves. The value is one opaque id, never comma-split.
- [x] With both set, the union is approved and the legacy value is not silently dropped.
- [x] Two approved accounts advertising the same destination/media is a refusal naming both ids,
      never a pick.
- [x] Neither variable set is still the existing refusal; an empty or whitespace-only
      `POSTIZ_ACCOUNT_IDS` is treated as unset, not as "approve everything".
- [x] An account id in the list that the registry does not return is ignored for selection and
      never fabricates a capability.
- [x] The refusal for a connected-but-unapproved channel names the real cause and the fix: the
      channel is connected, its account id is not approved, add it to `POSTIZ_ACCOUNT_IDS`. It no
      longer says the account "does not advertise" a channel Postiz does advertise.
- [x] Every refusal string passes `config/voice.yaml`: no em dashes, no AI tells.
- [x] `selectDeliveryRoute` is unchanged. Route choice (postiz vs typefully vs unsupported) is not
      in scope; only which account a postiz route resolves to.
- [x] No production path reads `.env` differently and no secret value appears in any test,
      fixture, error string or log line.
- [x] A test proves the guard still fails closed: a registry entry for an unapproved account is
      never returned by `resolveConfiguredPostizCapability`.
- [x] Every new test is load-bearing: reverting the production change alone makes named tests fail.

## Verify

Classification and applicable gate: meaningful behavior on the live-posting path, high risk. Full
repository gate required, plus focused tests, plus the e2e journey. Run every command unsandboxed;
under the sandbox the suite reports roughly 196 phantom venture failures.

For UI changes: the affected journey is Publishing room → approve a threads row → Schedule. Fixture
backend only, never live. Assert the observable refusal text for an unapproved channel and the
resolved account for an approved one. No viewport or flag change is in scope; if no existing e2e
pass covers this selection, state that plainly rather than adding one.

```
npx tsc --noEmit -p tsconfig.json
node --import tsx --test src/publish/postiz.test.ts src/review/studio-scheduling.test.ts
npm run check
npm run test:e2e
```

Record the exact commands, exit codes and pass/fail/skip counts. Do not weaken, rewrite or delete an
existing test to make anything pass; if an existing test genuinely encodes the old one-account rule,
quote it in the RESULT BLOCK and stop for the coordinator to adjudicate rather than editing it.

## Observable result

Muxin sets `POSTIZ_ACCOUNT_IDS` in her own `.env` to the ids of the channels she wants live, opens
the Publishing room, approves the threads row, clicks Schedule, and it schedules. A channel she did
not list refuses with a message that tells her exactly which id to add.

## Risk

high — audit required: yes. A wrongly permissive selection posts real content to a real social
account under Muxin's byline with no undo. A wrongly strict one only blocks scheduling, which is
recoverable, so every ambiguous case must resolve to a refusal.
Review boundary: this candidate.
Review scope/budget: one cross-family audit of the candidate diff, changed-file list and focused
check output, with bounded questions on the fail-closed direction of each new branch. Ordinary
effort.
Prior accepted evidence: 6X's provenance gate is accepted and unchanged here; it is reopened only
if this candidate edits `approval-provenance.ts` or `publishing-status.ts`, which it must not.
On reviewer outage: mark the candidate review-blocked and do not integrate. Codex is capped until
2026-09-15, so Grok is the auditor. If Grok is also unavailable, stop; do not substitute a Claude
auditor of any tier.

## Families

- Builder: Claude, opus tier — Lane A. Muxin's standing routing decision (2026-09-11) is Claude as
  builder, cross-family models reserved for audits.
- Auditor: Grok, reasoning effort high. Codex is capped until 2026-09-15. Never a Claude auditor.

## Closeout

Use the `### Closeout gate disposition`, `### Hygiene disposition` and `### Read-set measurement`
forms in `docs/operations/slice-protocol-environment.md`.

Preflight: every acceptance item mapped to a named test or a quoted refusal string; changed paths
within Lane A ownership; `.env` untouched and unread; `git status --porcelain -- data` empty; check
exit codes recorded; audit findings and their disposition written down before integration.
Gate cost: one `npm run check` on the pinned candidate. No paperwork-only rerun.

**PASS** 2026-09-11

- Acceptance: 13 of 13, each mapped to a named test or a quoted refusal string in `SLICE-6Y-LOG.md`.
- Gate, unsandboxed: `npm run check` 0, 4419/0/0, 497 suites. Focused 0, 50/0/0. `tsc` 0.
  `npm run test:e2e` 0, 55/0/16, run pre-repair; both repairs since were test- and comment-only.
- Audit: Grok grok-4.5, PASS WITH FINDINGS, then a bounded delta audit returning
  `DELTA VERDICT: CLOSED` on finding P2. Two findings accepted as-is by the coordinator: the
  stricter duplicate-row refusal, and account ids appearing in refusal text.
- Hygiene: `--rescue` lists 4 items, none created by this slice (two pre-existing 6M/6S
  worktrees, two merged branches, another session's `review-queue.md`). Nothing removed.
- Read set: `## Slice protocol` 24560 B, `## START HERE` 1192 B, this packet 12236 B.
- Left for Muxin, not a slice leftover: pasting a `POSTIZ_ACCOUNT_IDS` line into `.env`, which no
  agent may edit.

## RESULT BLOCK (worker fills this in and returns it)

Full record, all five exact refusal strings, audit disposition and evidence pointers live in
`SLICE-6Y-LOG.md` beside this packet.

- **Changed:** `src/publish/postiz.ts`, `src/publish/postiz.test.ts`,
  `src/review/studio-scheduling.test.ts`, plus `SLICE-6Y-LOG.md`. `studio-scheduling.ts`,
  `selectDeliveryRoute` and both 6X files untouched; `.env` never read; `data/**` clean.
- **Outcome:** selection is an allowlist. `POSTIZ_ACCOUNT_IDS` (comma separated) unions with legacy
  `POSTIZ_ACCOUNT_ID`, which stays ONE opaque id and is never split (Grok finding P2). Blanks are
  dropped, so empty is unset, never approve-everything. One match resolves, two refuse, an unknown
  id is ignored, and an unapproved channel refuses with the message Muxin acts on:
  `Postiz has ${destination}/${media} connected on account ${id}, which is not approved for posting. Add ${id} to POSTIZ_ACCOUNT_IDS to schedule this channel.`
  13 new tests, every acceptance box covered, every refusal voice-clean per the voice-rules test.
- **Checks and load-bearing:** counts in `## Closeout`. Reverting the whole production change
  fails 12 of the 13 new tests; reverting only the P2 repair fails exactly the one test that pins
  it. No existing test weakened or deleted. Both runs recorded in `SLICE-6Y-LOG.md`.
- **Unresolved:** no e2e pass covers account selection, stated rather than added per Verify. The
  modified `content/2026-09-07-.../review-queue.md` is another session's edit, left in place.
- **Delivery state:** accepted. See `## Closeout`.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: serial; a second lane would own no independently verifiable path.
- Assignment: one Claude opus worker, fresh context, frozen handoff at the completed RESULT BLOCK.
- Evidence return: commands, exits, counts, candidate identity, short result and artifact pointers.
- Capability boundary: worker returns the RESULT BLOCK and stops. The coordinator runs the audit,
  the gate and the single integration commit.
