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
- placed 2026-09-12T01:19:51.730Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/threads-1] threads → postiz post cmtxp6um8000kmn81a9zgdgw8 @ Sat, Sep 12, 10:00 AM PT | spin | cta:source | "I used to think that if I attempted to make a difference, I would only make that"
- placed 2026-09-12T04:02:35.840Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/bluesky-1] bluesky → postiz post cmtxv04og000nmn813w2ib6p6 @ Sat, Sep 19, 6:30 PM PT | spin | cta:source | "Policy adoption barely moves as average-citizen support rises. It moves as econo"
- placed 2026-09-12T10:27:12.838Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/x-1] x → postiz post cmty8qqzo000pmn81b4rpg4d4 @ Sun, Sep 13, 9:30 AM PT | spin | cta:source | "AI won't save us if we don't change the systems around it first. Wealth inequali"
- placed 2026-09-12T17:12:11.764Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/linkedin-1] linkedin → postiz post cmtyn7k650000mn79v0uezmwt @ Sun, Sep 13, 8:30 AM PT | spin | cta:source | "Every strike against Hawai'i's Big Five plantation companies failed for the same"
- placed 2026-09-12T17:12:13.794Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/mastodon-1] mastodon → postiz post cmtyn7lqr0001mn7939303ao7 @ Sun, Sep 13, 7:00 PM PT | spin | cta:source | "You already made one system-level call. You left feeds built on algorithmic cont"
- placed 2026-09-12T17:12:14.994Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/mastodon-2] mastodon → postiz post cmtyn7mo60003mn79x8motd8q @ Sun, Sep 20, 7:00 PM PT | spin | cta:source | "The 1946 Hawai'i sugar strike held 76,000 people together for 79 days on infrast"
