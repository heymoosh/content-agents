---
name: cycle
description: Run the brand-scoped weekly ingest and strategy loop. Drafting, review and publish live in the Content room, not here; the two exceptions are a voice memo, which the room cannot transcribe, and the /video offer, whose room control is unreachable. Usage - /cycle --brand <human-inference|charles|fiction> [--account <provider/account>].
---

# /cycle — the weekly ingest and strategy loop

Require the canonical `--brand` argument at entry: `human-inference`, `charles`, or `fiction`.
Reject missing or unknown brands. There is no Human Inference fallback. Pass the same explicit
`--brand` and optional `--account` to `/strategy` and every strategy report it invokes. Strategy
state is always under `briefs/<brand>/`; legacy top-level `briefs/` and `briefs/bets.md` are
unassigned and unread.

Pure orchestration — each step delegates to its own skill or script. Stop at every human
checkpoint; never barrel through.

## Steps

1. **Ingest.** If `data/inbox/` has files, run the brand-bound pull/ingest command
   `npm run pull -- --brand <brand> --ingest` (which supplies the configured measurement account;
   never run bare `npm run ingest`). If `.env` has Bluesky creds,
   run `npm run bluesky`. Report what was imported. If the inbox was empty AND the latest
   brief is >2 weeks old, remind Muxin to export analytics (`docs/analytics-export-howto.md`).

2. **Strategy.** If the newest file in `briefs/<brand>/` is older than 7 days (or new data was just
   imported), run `/strategy --brand <brand>` (plus `--account <provider/account>` when supplied).
   Note that `/strategy` now **grades last cycle's bets first** (`briefs/<brand>/bets.md` +
   `npm run grade-bets -- --brand <brand>`) before writing new recommendations — this is
   the feedback loop that makes the cycle compound. Otherwise note the brief is current.

3. **Voice memos, and the video offer.** Ask Muxin if there's a voice memo to atomize, or check
   any audio file they provided with the command. For each, run the `/atomize` skill flow
   (text + quote cards). (Atomization ends at the review queue — do not publish.)
   **Video is separate:** for any piece worth a short, offer to run `/video <folder>` — it's the
   heavier, costlier path, so it's opt-in per piece, not automatic.

   Nothing else belongs here. A Substack URL, a text/markdown file and pasted text all go through
   the Content room in Studio (`npm run review`), so do not offer to atomize them.

   Both survivors stay for a demonstrated reason, not by default:
   - **Voice memos:** the room's only file door reads the audio as UTF-8 text and never calls the
     transcription provider, so a memo dropped there becomes mojibake instead of a transcript.
   - **The video offer:** the room's "Generate storyboard" control sits in `rowEl`
     (`src/review/page.ts:1466`), which nothing calls. The live row renderer is `reviewScanRowEl`
     (called at `src/review/page.ts:1807`), and it renders no such button.

   See `docs/operations/launch-slices/SLICE-5L-coverage.md`.

4. **Wrap up.** Summarize the cycle (imported / brief / any memo atomized). Offer to commit
   and push the cycle's artifacts (brand-scoped briefs **including `briefs/<brand>/bets.md`**, derivatives, logs, queue
   updates) — the bets ledger is the loop's memory, so it must be committed every cycle.
   Then point Muxin at the Content room in Studio (`npm run review`) for drafting, review and
   publish.

## Retired steps — review, publish, and most of drafting

`/cycle` used to scan for `pending`/`revise` rows and offer to run `/publish`. Both were removed:
the Content room in Studio already owns review and approval, and `/publish` is invoked directly on
a folder. Two front doors for the same step is how a piece ends up reviewed in one place and
published from another. Do not re-add them here.

Drafting was retired for the three inputs the Content room was **demonstrated** to handle: a
Substack essay URL, a local text or markdown file, and pasted text. Each was traced from its live
entry point through to a `review-queue.md` row in
`docs/operations/launch-slices/SLICE-5L-coverage.md`, which is the argument for this removal. None
was retired because a dependency was marked closed. Do not re-add drafting for those three.

Voice memos and the `/video` offer were **not** retired — see step 3 for each one's reason. Widen
step 3 again only with a traced code path saying the room stopped covering something, and narrow it
only with one saying the room started.

Substack Notes are not mentioned in step 3 and never were: `/atomize notes` is invoked directly,
not through `/cycle`. Do not add a Notes step here, and do not assert where Notes are handled — the
room's Notes path has open defects recorded in the coverage document.

`/atomize` itself is untouched. It is still a working skill, invoked directly on a folder or a
source and invoked by the Content room's own jobs. What was retired is `/cycle` asking for work
and calling it.
