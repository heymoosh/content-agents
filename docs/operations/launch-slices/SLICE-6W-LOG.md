# SLICE-6W log

Dated records, superseded `## Stopped` sections, and completed `RESULT BLOCK`s move here, newest
first. No session reads this file at start; the packet's compact pointers are enough.

## Deferred — general provenance-journal fix, 2026-09-11

Owner decision after two cross-family audit rounds: defer the general fix (wiring
`recordNewQueueRows`/`backfillQueueRowProvenance` into `serve.ts`'s `GET /api/queue` so every
newly-approved row gets real `approval-dispatch-safety.jsonl` provenance automatically), in favor
of a narrow one-off exception to unblock `bluesky-2` only (see packet `## Do not touch`). The
general fix is real, needed work — tracked here for a future slice, not abandoned.

Two rounds of Codex audit against `src/review/approval-provenance.ts` +
`src/review/serve.ts` (+ `approval-provenance.test.ts`) got 4 of 6 original defects cleanly fixed
(undecided-status filter, stale-snapshot approval race, per-folder failure isolation, test
coverage: 22/22 passing). Second-round **BLOCK** verdict, four items still open for whoever
resumes this:

1. **Folder/slug key collision not actually fixed in production.** `safeFolder()`
   (`src/review/rows.ts:82`) resolves Content folders before Outreach folders when both share a
   bare slug; the backfill's key scheme doesn't account for this. The fix's own test
   (`approval-provenance.test.ts:283`) uses two *different* slugs for its "two folders" case, so it
   never reproduces the real same-basename collision — needs a same-basename fixture across
   Content vs. Outreach before this can be called fixed.
2. **Malformed-journal failures don't reach the Studio client.** The backfill helper now throws
   correctly, but `GET /api/queue`'s catch (`src/review/serve.ts:1110`) logs to `console.error` and
   still returns success to the browser. Needs to surface as a real error response.
3. **Claim-leak risk.** `claimPublishingAttempt` can throw after creating its lock file, without
   unlinking it, if a write/fsync fails after the lock is created (`approval-provenance.ts:172`);
   the backfill also catches every claim-acquisition error as ordinary contention
   (`approval-provenance.ts:148`), which would mask this. Needs cleanup-on-failure plus narrower
   error handling.
4. **New cross-process race.** `appendRows` (`src/publish/queue.ts:170`) writes the queue file
   before the journal mutation lock is acquired, so the backfill could record a row's provenance
   first and cause a later `recordNewQueueRows` call to falsely report a duplicate. Needs the write
   and the lock acquisition reordered or unified.

Codex explicitly ruled out a lock-order deadlock across these paths — not a concern, just the four
items above. Diffs from both audit rounds (not committed, not to be reused as-is given the open
defects) were saved only as ephemeral scratch files during this session and were not retained
long-term; a future slice should re-derive the fix rather than hunt for that scratch output.

Separately: Codex flagged that `bluesky-2` specifically, being already `approve`, would not be
touched by the narrowed (undecided-only) filter even once the general fix lands, and explicitly
said not to cycle it through `pending` as a workaround to mint fresh provenance. Whatever one-off
mechanism unblocks `bluesky-2` now should not be treated as this open item's resolution.

## One-off provenance seed, 2026-09-11

`scripts/slice-6w-seed-provenance.ts` — new file, calls only existing tested functions in
`src/review/approval-provenance.ts`, edits no `src/**` file, pinned to `bluesky-2` alone (full
identity check: platform/format/asset/status, not just row id). Two Codex audit rounds:

- Round 1: **BLOCK**. A lone `created` event (no approval transition) makes
  `approvalDispatchDisposition` return `blocked`, which is *worse* than `legacy` —
  `scheduleApprovedOnce` throws on `blocked` before its `retryBlocked` shortcut. Also: the
  documented two-invocation flow (`--write` then separately `--write --complete-approval`) didn't
  actually resume — the second run just reported "already seeded" and stayed blocked. Also: the
  write callback into `commitReviewStatus` was unconditional `() => true`, which Codex proved could
  certify a *different* derivative than the one originally fingerprinted if the file changed
  between the creation and approval events.
- Fixes: resumable two-invocation flow (fingerprint-checked before resuming); `unchangedRow()`
  callback that re-reads and re-verifies platform/format/asset/status/fingerprint before allowing
  the approval commit, failing closed on any mismatch; absolute repo-root path instead of
  cwd-relative; full identity assertion, not just row id; abort before any write on an unreadable
  derivative; nonzero exit unless final disposition is `fresh`; scratch temp dirs cleaned up.
- Round 2: **PASS**. Codex independently reproduced both original bugs against the fix (two-process
  resume works; tampered-derivative and mid-commit fault injection both fail closed with no false
  `fresh`), ran `npm run check` (4379/0), and flagged one non-blocking item: this packet
  (`SLICE-6W.md`, 13,271 B) is over the 12,288 B packet-size cap — trim at closeout, not a safety
  issue.
- Run for real, unsandboxed (the real data root is outside the sandbox write allowlist; a first
  sandboxed attempt got `EPERM` on the lock file before anything was written, confirmed via `ls`):
  `node --import tsx scripts/slice-6w-seed-provenance.ts --write --complete-approval` → exit 0,
  `result {"kind":"fresh"}`, `Schedule is unblocked for this row`. `bluesky-2` alone now has real
  `approval-dispatch-safety.jsonl` provenance; no other row or slug touched; no provider call made.

## Stage 2 live run, 2026-09-11

With provenance seeded (see `## One-off provenance seed` below), re-attempted Stage 2 for real,
driving Studio's own Publishing room in-browser (claude-in-chrome), not a CLI shortcut:

- Dismissed the stale error toast left over from the earlier blocked attempt.
- Clicked **Schedule** on `bluesky-2`. Network log showed exactly two calls:
  `POST /api/publishing/schedule` (200) and `GET /api/queue` (200) — one provider object created.
  Studio showed `bluesky-2 / Scheduled / Sat, Sep 12, 6:30 PM PT / postiz · cmtxe0dww0004mn81r740iylk`.
  Cross-checked against `~/.content-agents/content-agents-154a8dd69ae2/scheduler/publish-schedule.jsonl`:
  `{"platform":"bluesky","day":"2026-09-12","time":"2026-09-13T01:30:00.000Z","asset":"derivatives/bluesky-2.md","by":"postiz"}`
  — matches exactly, confirming the displayed time came from the unified scheduler's own slot
  ledger, not typed by hand. (The repo-root `data/publish-schedule.jsonl` is a stale, unrelated copy
  — last touched Sep 6 — the live server writes only to the real data root's copy above.)
- Reschedule dry-run: `npm run publish:reschedule -- --slug 2026-09-07-the-world-s-broken-what-do-we-do-human-inference --id bluesky-2 --to 2026-09-14T01:30:00.000Z --dry-run`
  listed exactly `{slug, id: "bluesky-2", platform: "bluesky"}` — no other row. First attempt hit a
  sandboxed `tsx` IPC-pipe `EPERM` (`listen EPERM ... tsx-501/*.pipe`); retried unsandboxed and it ran
  clean.
- Real move, same command without `--dry-run`: `ok:true`, `from: "2026-09-13T01:30:00.000Z"`,
  `to: "2026-09-14T01:30:00.000Z"`, same `providerObjectId: "cmtxe0dww0004mn81r740iylk"` (Postiz
  moved the existing post rather than creating a new one), `publishing.state: "planned"`.
- Reloaded Studio: `bluesky-2` now shows `Scheduled / Sun, Sep 13, 6:30 PM PT`, same provider id.
  Screenshot saved: `screenshot-1789157605242-2.jpg` (local temp path, not repo-committed).
- `npm run publish:reconcile` (unsandboxed): `{"state":"ok", "observations":0, ...}`, exit 0 — no
  reconciliation work yet because the moved slot (Sun Sep 13, 6:30 PM PT) hasn't passed.

No other `review-queue.md` row changed status as a side effect (checked via the Publishing room's
own table, only `bluesky-2` shows a planned/scheduled time; `x-1`/`x-2` unchanged, still
`Needs reconciliation`/`Pending`).

Remaining before this slice can close: wait for 2026-09-14T01:30:00.000Z UTC to pass, get Muxin's
live on-Bluesky confirmation, `npm run publish:record-evidence`, final item-12 check, unsandboxed
`npm run check`.

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
