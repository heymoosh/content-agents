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
   - Creates SCHEDULED drafts — Typefully's queue is the second safety net.
   - LinkedIn's CTA link goes INLINE in the body (`config/cta.yaml` placement). The cleaner
     first-comment needs gated LinkedIn API access; inline keeps LinkedIn fully automated on
     Typefully like the rest. X's link goes in the first reply; Bluesky/community inline.
   - **Timing is automatic and PT-anchored** (the tech/AI audience skews West Coast). The script
     computes an explicit publish time per post from each platform's cadence in
     `config/platforms.yaml` (`posts_per_week` + `slot_days` + `slot_time_pst`, DST-aware) and
     sends it to Typefully — ~1/day, never same-day, capped at `posts_per_week`. No manual
     dragging. It prints the full per-post schedule; relay that when you report. A platform with
     no cadence config falls back to "next-free-slot".
   - Known limit (Phase 2): spacing is computed per `/publish` run; publishing two folders close
     together can double-book a slot. Cross-run/cross-piece spacing from the rolling approved pool
     is not built yet — note it if Muxin ships multiple pieces at once.
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
