# Bets ledger

Append-only record that closes the strategy → publish → outcome loop.

- **Bets** are created by `/strategy` from each brief's recommendations (DO_MORE / TEST / DO_LESS).
- **Placed log** rows are appended deterministically by `/publish` when an asset ships. They are
  the raw material `/strategy` uses next cycle to match a published post back to its analytics row
  (then `npm run link-bet` stamps `posts.bet_id`, and `npm run grade-bets` scores each bet).

Never hand-delete placed rows. `/strategy` grades bets in the Bets section; this log stays.

## Bets

<!-- /strategy writes bet blocks here: ## bet:YYYY-MM-DD-NNN with type/status/underperform_streak -->

## Placed log
- placed 2026-09-11T20:06:54.362Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/bluesky-2] bluesky → postiz post cmtxe0dww0004mn81r740iylk @ Sat, Sep 12, 6:30 PM PT | spin | cta:source | "Citizens still decide how to vote. Ignore the funded messaging and choose on the"
