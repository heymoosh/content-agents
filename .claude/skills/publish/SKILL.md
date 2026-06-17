---
name: publish
description: Push approved assets from a content folder's review queue out - Typefully scheduled drafts (X/LinkedIn/Bluesky), YouTube Short upload, TikTok scheduled post (PostPeer), ready-to-paste files. Usage - /publish <content-folder>.
---

# /publish — act on the review queue

Publish ONLY rows Muxin set to `approve` in `<folder>/review-queue.md`. Never publish
`pending`, `revise`, or `discard` rows. Never bypass the queue.

## Steps

1. Read `<folder>/review-queue.md`. Report counts: approved / pending / revise / discard.
   If there are `revise` rows, remind Muxin to run `/atomize --revise <folder>` after this.
   If nothing is approved, stop.

2. **Text posts** (x / linkedin / bluesky): `npm run publish:typefully -- <folder>`
   - Creates SCHEDULED drafts (next free slot) — Typefully's queue is the second safety net.
   - LinkedIn's CTA link goes INLINE in the body (`config/cta.yaml` placement). The cleaner
     first-comment needs gated LinkedIn API access; inline keeps LinkedIn fully automated on
     Typefully like the rest. X's link goes in the first reply; Bluesky/community inline.
   - **Timing: anchor to PST, not Muxin's local CST** (the tech/AI audience skews West Coast).
     Target each platform's `best_times_pst` window in `config/platforms.yaml`, and spread a
     piece's derivatives ~1/day across the week, never same-day. Because the script schedules to
     "next-free-slot", these windows are realized via the Typefully schedule (set the slots to
     match) or by dragging drafts to the right times in Typefully after. Tell Muxin the suggested
     per-post schedule when you report.
   - On a 402 error: Typefully needs a paid plan — surface this to Muxin with the
     Postiz fallback noted in `docs/setup-typefully.md`. Do not work around it.

3. **Video** (youtube/short rows): `npm run publish:youtube -- <folder>`
   - Uploads as PRIVATE by default; Muxin flips to public in YouTube Studio after a
     spot-check (or sets YOUTUBE_PRIVACY=public once trust is established).
   - Requires `video/title.txt` and `video/description.txt` (written during /atomize).

4. **TikTok** (`tiktok` rows): `npm run publish:tiktok -- <folder>`
   - Schedules the same `video/short.mp4` to TikTok via PostPeer; caption = `video/title.txt`.
   - SCHEDULED, never instant (defaults to 60 min out; set `TIKTOK_SCHEDULE_AT` for a specific
     time) — the PostPeer dashboard is the second safety net (cancel there before it fires to test).
   - Needs `POSTPEER_API_KEY` + `POSTPEER_TIKTOK_ACCOUNT_ID` (docs/setup-tiktok.md); verify with
     `npm run publish:tiktok -- --check`. The API can't set TikTok's "made with AI" label (it's an
     in-app per-post toggle) — disclose in the caption for AI-heavy shorts.

5. **No-API platforms** (community / substack rows): `npm run publish:paste -- <folder>`
   - Emits `ready-to-paste/<id>.txt` files; Muxin copy-pastes when convenient.

6. Each script flips published rows to `published` and appends to `publish-log.md` —
   re-running /publish is a no-op for already-published rows. Each script also appends a `Placed
   log` row to `briefs/bets.md` (carrying the derivative's `from_brief` + `directives_applied`), so
   next cycle `/strategy` can match the post back to its analytics outcome and grade the bet. This
   is deterministic and deduped on `(folder, row id)` — do not edit those rows by hand.

7. Report: what was scheduled/uploaded/emitted, with links from `publish-log.md`, and
   anything skipped because keys are missing.
