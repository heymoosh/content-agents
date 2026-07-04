# Unified publish queue — plan (most of it already exists; close the gaps)

**Status:** the cross-platform scheduler + persistent ledger ALREADY shipped in PR #29
("Quote-card auto-publishing + one scheduler for all channels"). This plan documents what's there
and specs the remaining gaps to get a single queue you can **view** across every platform and media
type, from any session. Build in a fresh session off `main`.

## What already exists (do NOT rebuild)

`src/publish/slots.ts` is the shared scheduler:
- `claimSlots()` + an append-only ledger at `data/publish-schedule.jsonl` — one source of truth for
  WHEN posts go out.
- Used by `typefully.ts` (text → x / linkedin / bluesky), `tiktok.ts` (windowKey `tiktok`), and
  `cards.ts` (windowKey `quote-card`, fans out to image accounts).
- Enforces daily-uniqueness per platform + weekly caps (`posts_per_week` from
  `config/platforms.yaml`), **across separate `/publish` runs AND across streams** — text, cards,
  and TikTok never double-book a platform on the same LA day. DST-aware PT.
- `config/platforms.yaml` has cadence windowKeys for x, linkedin, bluesky, quote-card, tiktok.

So the hard part (a persistent cross-platform claim ledger that avoids collisions) is done. There is
a `npm run publish:typefully -- --list` that reads Typefully's live text queue, but nothing unifies
the view across channels.

## The gaps to build

The ledger is write-side only: nothing reads it back as a dashboard, YouTube isn't on it, and it
never reconciles with what actually happened downstream.

### A. A unified queue VIEW (the "so I can check it from any session" part — primary)

The most robust "check the queue from a fresh session/worktree" is to read the **live services**,
because they are the true state regardless of local files. (This is exactly why an older worktree
showed an empty queue while Typefully actually had 3 posts: local state was stale, the service was
not.) So build `src/publish/queue-view.ts` (+ `npm run queue`) that:
- Queries each live service and merges into ONE chronological table: Typefully (`--list` logic, text),
  PostPeer (TikTok scheduled), YouTube (scheduled uploads via the Data API). Columns: time PT,
  platform, media type (text / card / video), title/asset.
- Cross-checks against `data/publish-schedule.jsonl` and flags drift (a ledger claim with no live
  draft, or a live draft not in the ledger).
- Also surfaces approved-but-unpasted manual items in `content/*/ready-to-paste/` (Substack /
  community), so "everything pending" lives in one view even though those aren't auto-scheduled.

### B. Put YouTube on the unified clock

`youtube.ts` currently uploads as `privacyStatus=private` with no scheduled time (manual flip to
public). Make it:
- Add a `youtube` cadence entry to `config/platforms.yaml`.
- `claimSlots({ windowKey: "youtube", conflictPlatforms: ["youtube"], ... })` at upload time, and
  use the YouTube Data API scheduled-publish (`status.publishAt` = claimed time, `privacyStatus`
  private until then) so YouTube auto-publishes on the same clock as everything else.

### C. Reconciliation / truthfulness

The ledger is append-only claims and can drift if a draft is deleted or rescheduled downstream. Add
a reconcile pass (either inside the view or a `--sync` flag):
- Mark claims published once their time passes or the service confirms it.
- Flag claims whose downstream draft no longer exists; prune/compact old rows.
- Minimum viable: the view drops past-dated claims and flags drift; full two-way sync is a follow-on.

### D. (Optional) one publish entry point

Each channel still has its own `publish:*` script. Consider `npm run publish:all <folder>` (or have
`/publish` orchestrate) that runs every channel's publisher in one pass, all drawing from the same
ledger, so one command schedules text + cards + TikTok + YouTube for a piece. Per-channel scripts
stay callable.

## Files

- New: `src/publish/queue-view.ts` (+ `queue` script in `package.json`).
- Edit: `src/publish/youtube.ts` (claim a slot + scheduled publish), `config/platforms.yaml`
  (add `youtube` cadence).
- Edit: `src/publish/slots.ts` — export `readLedger()` (or a `getClaims()` helper) for the view.
- Reuse: the Typefully `--list` query, a PostPeer list call, the YouTube Data API.
- Check: is `data/publish-schedule.jsonl` gitignored? For a fresh session to see the local ledger it
  must be committed; but since the VIEW reads live services, the ledger staying local is fine.

## Model notes / guardrails

- The ledger keys on (platform, LA day). The view READS it, never re-implements the claim logic.
- Keep the house rules intact: scheduled-never-instant, and nothing publishes without `approve` in
  `review-queue.md`.
- Manual channels (paste) are intentionally unscheduled; the view surfaces them as "pending paste,"
  it does not time them.

## Open questions

- Reconcile live on every `queue` run (slower, always truthful) or only on `--sync`?
- YouTube scheduled-publish needs the video uploaded first, so the slot is claimed at upload time
  (same shape as TikTok). Confirm the Data API `publishAt` flow.
- One `publish:all` vs. keeping per-channel scripts (the ledger already unifies timing either way).

## Related
- Built by PR #29. Scheduler: `src/publish/slots.ts`. Ledger: `data/publish-schedule.jsonl`.
- Cadence config: `config/platforms.yaml`. Existing live-queue read: `publish:typefully -- --list`.
