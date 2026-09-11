# SLICE-6W log

Dated records, superseded `## Stopped` sections, and completed `RESULT BLOCK`s move here, newest
first. No session reads this file at start; the packet's compact pointers are enough.

## Stopped — 2026-09-11

Blocker: Studio's live Schedule action refuses every genuinely first-time approved row — not just
`bluesky-2` — because `scheduleApprovedOnce` (`src/review/publishing-status.ts:290-298`) requires
`approvalDispatchDisposition` (`src/review/approval-provenance.ts:234-246`) to find a matching
`approval-dispatch-safety.jsonl` entry or it returns `{kind:"legacy"}`, which is rejected unless the
row already has unrelated pre-existing `publishing-status.jsonl` history. `recordNewQueueRows`, the
function that's supposed to populate that journal, is called only from
`src/review/publishing-status.test.ts` — never from `src/review/serve.ts`. The real data root
(`~/.content-agents/content-agents-154a8dd69ae2/`) has no `approval-dispatch-safety.jsonl` at all.
`x-1`/`x-2` only pass this gate because they carry older `publishing-status.jsonl` entries that
predate the gate and take the `prior && retryBlocked` shortcut around it — not proof the gate works
for new content. This is a systemic gap, not specific to this row.

What was verified: Stage 1 fully PASSED — `npm run test:e2e` unsandboxed 50/0/16; the live Postiz
Bluesky create-and-cancel canary (`CANARY_I_MEAN_IT=1`, real approval from Muxin given in-chat
2026-09-11, run unsandboxed by the coordinator directly since a subagent cannot receive a live
permission prompt) exited 0 with `ok:true`, `postId cmtx8iq1j0002mn818b1w4ioa`,
`scheduledAt 2026-09-19T17:33:12.080Z`, `rescheduledTo 2026-09-19T18:33:12.080Z` (+1h move proven),
`leftovers: []` (nothing left standing). Report: `$TMPDIR/slice-6w/canary.json`. A first canary
attempt also created-and-reconciled cleanly (`cmtx8hw1z0000mn810uywt0ax`) but its report write hit a
sandboxed-vs-unsandboxed `$TMPDIR` mismatch (fixed for the rerun); both provider objects were
canceled, nothing left live.

Stage 2: `bluesky-2` (`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/`)
confirmed `approve` by Muxin in-chat 2026-09-11. Text-post routing is single-provider
(`providerForKind` always resolves bluesky text to `typefully`, never fans out to both configured
providers), so acceptance item 8's dual-provider risk does not apply here. The Studio Publishing
room correctly showed the row "Approved and waiting for Schedule." One click on **Schedule**
produced: "bluesky-2: this row is already approved; reconcile its provider state before retrying" —
traced to the blocker above. No provider call was made; nothing was created or scheduled for real.

Retained work: `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`
(`bluesky-2` → `approve`, Muxin's real approval, left uncommitted per "never commit the candidate");
`$TMPDIR/slice-6w/canary.json` (Stage 1 evidence). No `src/**` file was edited.

Secondary, non-blocking finding: this packet's Stage 1 command block mixes env vars from
`postiz-canary.ts`'s two mutually exclusive modes (`--all` vs. bare). The coordinator used
`--all` with `POSTIZ_CANARY_ONLY=bluesky` (no `POSTIZ_CANARY_IMAGE`, to skip the carousel path) and
dropped `POSTIZ_CANARY_INPUT_JSON`/`POSTIZ_CANARY_RESCHEDULE_TO`, which is what actually satisfies
items 2-4. Worth correcting the block text when this packet is next revised.

Single next action: this needs an owner decision, not an engineering guess — either (a) a small
in-scope fix wiring `recordNewQueueRows` (or an equivalent backfill) into `src/review/serve.ts`'s
queue-load path so newly-approved rows get real provenance, cross-family audited before use, or (b)
a narrowly scoped, audited one-off exception to unblock just this row. Both touch `src/review/**`,
outside this packet's named paths, so neither should proceed without Muxin naming the path here
first per `AGENTS.md` → Slice protocol.

## RESULT BLOCK — 2026-09-11

- Changed paths: none under `src/**`, `e2e/**`, `config/**`, `AGENTS.md`, `.env`. Retained but
  uncommitted: `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`.
- Outcome: Stage 1 PASS. Stage 2 blocked on first live attempt — see `## Stopped` above.
- Checks run and results: `npm run test:e2e` unsandboxed, 50 pass / 0 fail / 16 blocked.
  `node --env-file=.env --import tsx scripts/postiz-canary.ts --all` (Bluesky-only), exit 0, report
  `ok:true` — see `## Stopped` above for the full shape.
- Evidence locations: `$TMPDIR/slice-6w/canary.json`; this log's `## Stopped` entry above.
- Unresolved: the scheduling-provenance gap above; the packet's own Stage 1 command-block defect.
- Delivery state and next action: stopped, not accepted, not committed. Next action is an owner
  decision on the provenance-gap fix.
- Usage: Stage 1 `npm run test:e2e` local elapsed not separately measured; two canary invocations,
  each a single Postiz create + reconcile call (well under the ~90/hour ceiling). No
  repository-wide `npm run check` run yet — held per Completion sequence step 7, since Stage 2 did
  not close.
