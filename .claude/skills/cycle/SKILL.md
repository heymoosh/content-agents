---
name: cycle
description: Run one full brand-scoped weekly content cycle. Usage - /cycle --brand <human-inference|charles|fiction> [--account <provider/account>].
---

# /cycle — the weekly loop

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

3. **New content.** Ask Muxin if there's new content to atomize (Substack URL, file, or voice
   memo), or check any URLs/files they provided with the command. For each, run the
   `/atomize` skill flow (text + quote cards). (Atomization ends at the review queue — do not
   publish.) **Video is separate:** for any piece worth a short, offer to run `/video <folder>`
   — it's the heavier, costlier path, so it's opt-in per piece, not automatic.

4. **Pending reviews.** Scan `content/*/review-queue.md` for rows still `pending` or `revise`.
   List them with folder paths. For `revise` rows, offer to run `/atomize --revise`.

5. **Publish.** For folders with `approve` rows, offer to run `/publish <folder>`. Only run it
   if Muxin says yes (or already asked for publish in this conversation).

6. **Wrap up.** Summarize the cycle (imported / brief / atomized / published). Offer to commit
   and push the cycle's artifacts (brand-scoped briefs **including `briefs/<brand>/bets.md`**, derivatives, logs, queue
   updates) — the bets ledger is the loop's memory, so it must be committed every cycle.
