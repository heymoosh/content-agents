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
- placed 2026-09-12T18:23:57.485Z [2026-09-02-the-world-s-broken-what-do-we-do/linkedin-1] linkedin → postiz post cmtypruho0000mn18a1kjrd9o @ Sun, Sep 13, 4:15 PM PT | spin | cta:source | "One of the most useful product ideas in this essay is also the least glamorous: "
- placed 2026-09-12T18:23:59.257Z [2026-09-02-the-world-s-broken-what-do-we-do/mastodon-1] mastodon → postiz post cmtyprvuz0001mn18b8dc6dfj @ Sun, Sep 13, 9:30 PM PT | spin | cta:source | "AI will not save us if we keep the systems around it unchanged. If AI automates "
- placed 2026-09-13T00:41:20.416Z [2026-09-02-the-world-s-broken-what-do-we-do/quote-card-1-linkedin] linkedin → postiz post cmtz395vg0000mu8e0v29dgxm @ Sun, Sep 20, 8:30 AM PT | spin | cta:source | "Movements that organize only around fear, guilt, anger, and opposition eventuall"
- placed 2026-09-13T00:41:20.553Z [2026-09-02-the-world-s-broken-what-do-we-do/quote-card-1-bluesky] bluesky → postiz post cmtz395zs0001mu8e0p5tbik3 @ Sun, Sep 13, 6:30 PM PT | spin | cta:source | "The work does not have to wait for a final victory to become meaningful. I'm ear"
- placed 2026-09-13T00:41:20.666Z [2026-09-02-the-world-s-broken-what-do-we-do/quote-card-1-instagram] instagram → postiz post cmtz3962y0003mu8ex9oq82ic @ Tue, Sep 15, 12:00 PM PT | cta:source | "Movements that organize only around fear, guilt, anger, and opposition eventuall"
- placed 2026-09-13T00:41:20.761Z [2026-09-02-the-world-s-broken-what-do-we-do/quote-card-1-facebook] facebook → postiz post cmtz3965t0004mu8e5641baj5 @ Tue, Sep 15, 12:00 PM PT | cta:source | "Movements that organize only around fear, guilt, anger, and opposition eventuall"
- retracted 2026-09-13T22:15:14.852Z [2026-09-02-the-world-s-broken-what-do-we-do/quote-card-1-instagram] instagram → provider object cmtz3962y0003mu8ex9oq82ic removed after terminal failure
- placed 2026-09-13T22:15:55.091Z [2026-09-02-the-world-s-broken-what-do-we-do/quote-card-1-instagram] instagram → postiz post cmu0di01r0006qx8eibpcwvgw @ Tue, Sep 15, 12:00 PM PT | cta:source | "Movements that organize only around fear, guilt, anger, and opposition eventuall"
- placed 2026-09-13T22:19:59.107Z [2026-09-02-the-world-s-broken-what-do-we-do/joy-short-tiktok] tiktok → postiz post cmu0dn8c80008qx8epypyyh2v @ Tue, Sep 15, 5:00 PM PT | cta:source | "I am also starting to believe that joy is not something we wait for after the wo"
- placed 2026-09-13T22:20:13.822Z [2026-09-02-the-world-s-broken-what-do-we-do/joy-short-youtube] youtube → postiz post cmu0dnjp20009qx8emqin1de0 @ Tue, Sep 15, 4:00 PM PT | cta:source | "I am also starting to believe that joy is not something we wait for after the wo"
- placed 2026-09-13T22:31:02.277Z [2026-09-02-the-world-s-broken-what-do-we-do/joy-substack-note] substack → substack note (posted 2026-09-13T22:31:02.151Z) @ 2026-09-13T22:28:00.000Z | "I am also starting to believe that joy is not something we wait for after the wo"
- retracted 2026-09-13T22:53:46.421Z [2026-09-02-the-world-s-broken-what-do-we-do/joy-substack-note] substack → reference substack note (posted 2026-09-13T22:31:02.151Z) @ 2026-09-13T22:28:00.000Z invalidated after terminal failure
- retracted 2026-09-13T23:09:27.451Z [2026-09-02-the-world-s-broken-what-do-we-do/joy-short-tiktok] tiktok → reference cmu0dn8c80008qx8epypyyh2v invalidated after terminal failure
- retracted 2026-09-13T23:09:27.453Z [2026-09-02-the-world-s-broken-what-do-we-do/joy-short-youtube] youtube → reference cmu0dnjp20009qx8emqin1de0 invalidated after terminal failure
- retracted 2026-09-13T23:40:53.578Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/x-1] x → reference cmty8qqzo000pmn81b4rpg4d4 invalidated after terminal failure
- placed 2026-09-13T23:41:39.396Z [2026-09-07-the-world-s-broken-what-do-we-do-human-inference/x-1] x → postiz post cmu0gk9f3000cqx8enm6lmx3y @ Mon, Sep 14, 9:30 AM PT | spin | cta:source | "AI won't save us if we don't change the systems around it first. Wealth inequali"
