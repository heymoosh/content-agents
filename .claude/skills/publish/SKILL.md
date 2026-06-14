---
name: publish
description: Push approved assets from a content folder's review queue out - Typefully scheduled drafts (X/LinkedIn/Bluesky), YouTube Short upload, ready-to-paste files. Usage - /publish <content-folder>.
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
   - On a 402 error: Typefully needs a paid plan — surface this to Muxin with the
     Postiz fallback noted in `docs/setup-typefully.md`. Do not work around it.

3. **Video** (youtube/short rows): `npm run publish:youtube -- <folder>`
   - Uploads as PRIVATE by default; Muxin flips to public in YouTube Studio after a
     spot-check (or sets YOUTUBE_PRIVACY=public once trust is established).
   - Requires `video/title.txt` and `video/description.txt` (written during /atomize).

4. **No-API platforms** (community / substack rows): `npm run publish:paste -- <folder>`
   - Emits `ready-to-paste/<id>.txt` files; Muxin copy-pastes when convenient.

5. Each script flips published rows to `published` and appends to `publish-log.md` —
   re-running /publish is a no-op for already-published rows. Each script also appends a `Placed
   log` row to `briefs/bets.md` (carrying the derivative's `from_brief` + `directives_applied`), so
   next cycle `/strategy` can match the post back to its analytics outcome and grade the bet. This
   is deterministic and deduped on `(folder, row id)` — do not edit those rows by hand.

6. Report: what was scheduled/uploaded/emitted, with links from `publish-log.md`, and
   anything skipped because keys are missing.
