---
name: publish
description: Push approved, brand-scoped assets from a content folder's review queue out. Usage - /publish --brand <human-inference|charles|fiction> <content-folder>.
---

# /publish — act on the review queue

Require one canonical brand at entry: `human-inference`, `charles`, or `fiction`. Reject a
missing or unknown brand. There is no Human Inference fallback. The content folder and every
delivery/account choice must belong to that brand. Legacy top-level `briefs/` files, including
`briefs/bets.md`, are unassigned and unread.

Publish ONLY rows Muxin set to `approve` in `<folder>/review-queue.md`. Never publish
`pending`, `revise`, or `discard` rows. Never bypass the queue.

## Steps

1. Read `<folder>/review-queue.md`. Report counts: approved / pending / revise / discard.
   If there are `revise` rows, remind Muxin to run `/atomize --revise <folder>` after this.
   If nothing is approved, stop.

2. **Text posts** (x / linkedin / bluesky): `npm run publish:typefully -- <folder>`
   - Creates SCHEDULED drafts — Typefully's queue is the second safety net.
   - **Native video/image**: if a text-platform derivative declares `media: <path>` in its
     frontmatter (e.g. an animated quote card → `media: video/quote-animated.mp4`), the file is
     uploaded to Typefully and attached to the post — a native video post on X/LinkedIn/Bluesky.
     The body stays the caption. `.mp4`/`.mov` for video.
   - LinkedIn's CTA link goes INLINE in the body (`config/cta.yaml` placement). The cleaner
     first-comment needs gated LinkedIn API access; inline keeps LinkedIn fully automated on
     Typefully like the rest. X's link goes in the first reply; Bluesky/community inline.
   - **Timing is automatic and PT-anchored** (the tech/AI audience skews West Coast). The script
     computes an explicit publish time per post from each platform's cadence in
     `config/platforms.yaml` (`posts_per_week` + `slot_days` + `slot_time_pst`, DST-aware) and
     sends it to Typefully — ~1/day, never same-day, capped at `posts_per_week`. No manual
     dragging. It prints the full per-post schedule; relay that when you report. A platform with
     no cadence config falls back to "next-free-slot".
   - Spacing is unified: the scheduler claims slots through a shared ledger
     (`data/publish-schedule.jsonl`), so text AND cards de-conflict ACROSS runs and streams — a
     platform never gets two posts on the same PT day. Remaining gap: no steady `posts_per_week`
     pull from a cross-piece backlog (you still hand it one folder at a time).
   - On a 402 error: Typefully needs a paid plan — surface this to Muxin with the
     Postiz fallback noted in `docs/setup-typefully.md`. Do not work around it.

3. **Video** (youtube/short rows): `npm run publish:youtube -- <folder>`
   - SCHEDULED publish by default: claims a slot from the unified scheduler and sets
     `status.publishAt`, so the video uploads private and YouTube auto-flips it to public at the
     slot (no manual Studio step).
   - With no `youtube` cadence configured, it falls back to a plain PRIVATE upload: Muxin flips it
     public in YouTube Studio after a spot-check, or sets `YOUTUBE_PRIVACY=public` for instant public.
   - Requires `video/title.txt` and `video/description.txt` (written during /atomize).

4. **TikTok** (`tiktok` rows): `npm run publish:tiktok -- <folder>`
   - Schedules the same `video/short.mp4` to TikTok via PostPeer; caption = `video/title.txt`.
   - SCHEDULED, never instant (defaults to 60 min out; set `TIKTOK_SCHEDULE_AT` for a specific
     time) — the PostPeer dashboard is the second safety net (cancel there before it fires to test).
   - Needs `POSTPEER_API_KEY` + `POSTPEER_TIKTOK_ACCOUNT_ID` (docs/setup-tiktok.md); verify with
     `npm run publish:tiktok -- --check`. The API can't set TikTok's "made with AI" label (it's an
     in-app per-post toggle) — disclose in the caption for AI-heavy shorts.

5. **Quote cards** (`quote-card:<target>` rows): `npm run publish:cards -- <folder>`
   - Ships as a NATIVE Typefully image post (2026-07-08 rewire) — same scheduled-draft path text
     posts use, with the card PNG uploaded and attached via `uploadMedia` + `media_ids`
     (`src/publish/typefully.ts`, reused by `src/publish/cards.ts`). Retires PostPeer/Upload-Post
     and the `image_post` provider toggle for cards entirely — PostPeer stays wired for TikTok
     only (step 4, a genuinely different video-only relay).
   - Each row targets ONE platform (`quote-card:x` / `quote-card:linkedin` / `quote-card:bluesky`)
     with that platform's own context caption as the draft body — there is no more fan-out to
     every connected account. A legacy bare `quote-card` row (no `:<target>`) errors out; split it
     into per-platform rows first (see `.claude/skills/atomize/SKILL.md` step 7).
   - **CTA follows `config/cta.yaml` (shared with text):** inline on inline platforms
     (Bluesky/LinkedIn), placed like a text post (reply/first-comment) elsewhere (X).
   - **Timing is unified with text** (same scheduler + ledger): a card claims the next `quote-card`
     slot (`config/platforms.yaml`) and de-conflicts against its target platform's cap — so a card
     series respects e.g. LinkedIn's 2/wk and never shares a platform's day with a text post.
     `--at <ISO>` overrides for a one-off/test. SCHEDULED, never instant; cancel in Typefully's
     queue before it fires.
   - Prereqs: render the PNGs first (`npm run render -- --still <folder>` — gitignored). Needs
     `TYPEFULLY_API_KEY` same as `publish:typefully`, nothing card-specific to configure. Verify
     with `npm run publish:cards -- <folder> --check` (read-only: rows + next slot + CTA plan).
   - On a 402 error: Typefully needs a paid plan — same Postiz fallback as step 2. Do not work
     around it.

6. **No-API platforms** (community / substack rows): `npm run publish:paste -- <folder>`
   - Emits `ready-to-paste/<id>.txt` files; Muxin copy-pastes when convenient.

7. Each script flips published rows to `published` and appends to `publish-log.md` —
   re-running /publish is a no-op for already-published rows. Each script also appends a `Placed
   log` row to `briefs/<brand>/bets.md` (carrying the derivative's scoped `from_brief` + `directives_applied`), so
   next cycle `/strategy` can match the post back to its analytics outcome and grade the bet. This
   is deterministic and deduped on `(folder, row id)` — do not edit those rows by hand.

8. Report: what was scheduled/uploaded/emitted, with links from `publish-log.md`, and
   anything skipped because keys are missing.
