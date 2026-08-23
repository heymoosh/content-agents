# Platform collection guide (free routes, honest limits)

Read this before running `/patterns collect`. One section per platform covering four things:

1. How to sort a stranger's posts by performance without paying for anything.
2. Which numbers a non-owner can actually see.
3. Whether view counts exist on that platform at all.
4. The honest fallback when they do not.

**Three platforms are automated as of 2026-08-22: x, linkedin, substack.** `npm run patterns:auto`
collects those through the logged-in Chrome session, so the by-hand route in their sections below
is now the fallback for what an adapter missed rather than the normal path. **The other six are
still fully by hand**: bluesky, mastodon, threads, tiktok, youtube, instagram. Video collection is
not automated at all, so a tiktok, youtube, or instagram entry still needs a pasted or
captions-copied transcript.

Automating a platform changed how the post arrives. It changed nothing about what is visible: an
adapter sees exactly what the section below says a non-owner sees, and records null for everything
else.

**Two ground rules.**

- **Record only what you can actually see.** Every `metrics` field is nullable. A null is a real,
  useful answer. A guessed number quietly poisons the outlier math in `src/patterns/outliers.ts`,
  which does arithmetic on whatever it is handed and cannot tell an estimate from a reading.
- **Say "unverified" out loud.** Several claims below are marked unverified because platform UIs
  change often and nobody has re-checked them since this file was written (2026-08-22). Treat an
  unverified line as a thing to go look at, not a thing to rely on.
- **For the three automated platforms, the adapter is the authority, not this page.** Each one in
  `src/patterns/collectors/` documents what it reads off a real page and how confident that is.
  This page describes the free BY-HAND route; the two can drift apart, and when they disagree the
  adapter is what actually ran.

## What the paid tools do, and why we are not buying them

Muxin's constraint is free or low cost. The paid tools in her research screenshot all do a version
of the same job: pull a creator's post history, attach the numbers, and sort by an outlier score.
That is exactly what this skill does by hand plus `npm run patterns:outliers`.

| Platform | Paid equivalent | Note |
|---|---|---|
| X | Typefully, Twemex, TweetHunter | **Typefully is already integrated in this repo** (`src/publish/typefully.ts`, `.env` key). It is therefore the cheapest starting point for X: no new subscription, no new account. |
| LinkedIn | Taplio, Shield, AuthoredUp | Shield and AuthoredUp are mostly *your own* analytics, not a stranger's. Taplio is the one that indexes other creators. |
| YouTube | vidIQ, TubeBuddy, Viewstats, 1of10, OutlierKit | These are the closest thing to what `outliers.ts` computes: views against a channel baseline. |
| TikTok / Reels / short-form | ReverseClip, Octupie | Specifics unverified. Named here because they appeared in her screenshot as the short-form entries; do not describe their features to Muxin as fact. |

None of them is required. Every platform below has a free route or an honest fallback, and the
three automated ones reuse the logged-in Chrome session this repo already had.

## x

- **Automated.** `npm run patterns:auto -- --platform x`. The by-hand route below still works for
  a one-off, and for anything the adapter missed.
- **Free sort.** X advanced search is the real answer and it is genuinely good. Search
  `from:handle min_faves:500` and raise the threshold until only a handful of posts come back.
  `min_retweets:` and `min_replies:` work the same way, and `since:`/`until:` bound the window.
  This is the free version of what Twemex sells.
- **Visible to a non-owner.** Views, likes, reposts, replies, quotes, bookmarks. X is the most
  generous public platform on this front.
- **View counts?** Yes, public. **Confirmed live on 2026-08-22** in a logged-in session:
  `x.com/search?q=<term>&f=top` returned HTTP 200 and rendered post cards labelled with real
  numbers, including view counts of 347,735 and 872,681 on individual posts. Two caveats: this is
  X's public "Views" figure, which is what X chooses to publish rather than the owner-only
  analytics number, and the two do not always agree; and it is absent on some posts and post types,
  where the value is null rather than guessed. The public follower count is rounded for display, so
  treat it as approximate.
- **The HTTP 402 you may see quoted is about UNAUTHENTICATED direct fetches, not this route.** A
  logged-in session reaches search and reads the numbers off the rendered cards. Do not repeat the
  402 as a current limitation of the collector.
- **Fallback.** Not needed. If search is rate limited while logged out, log in and retry.
- **Cheapest starting point overall**, because views plus a public follower count means the
  view-to-follower ratio has its inputs here with no guessing. This is the only platform where both
  bars CAN fire. That is not the same as both having fired: x's ratio threshold is the one measured
  number in the config, and at its current value it cleared on 0 of the 24 posts observed so far.

## linkedin

- **Automated.** `npm run patterns:auto -- --platform linkedin`. The by-hand route below is the
  fallback.
- **Free sort.** Open the creator's profile, click "Show all posts" to reach their activity feed,
  then scroll. The activity feed offers a sort control; whether it still includes a "Top" option
  (as opposed to only "Recent") is **unverified**. Check before relying on it.
- **Visible to a non-owner.** Reactions, comments and reposts, all readable. Two quirks the
  adapter observed live on 2026-08-22 and that a hand-collector hits too: there is **no real date**,
  only a relative age ("2w"), so `posted_at` is null rather than guessed from it; and the follower
  count is not always on the activity feed, in which case the adapter falls back to the seed number
  in `config/pattern-mining.yaml` and records that it did so in `notes`.
- **View counts?** No. LinkedIn impressions are owner-only. Do not record a views number here.
- **Fallback.** Scroll the activity feed by hand, record reactions and comments for each post, and
  leave `views` null. Outlier detection then runs off the baseline bar against that account's other
  entries, scored on engagement rather than views, and never off the view-to-follower ratio. That
  is fine, and it is why the ratio path is allowed to return null.
- Follower count is public on the profile, so record it even though views are missing. It is still
  useful context when reading the analyses later.

## substack

- **Automated.** `npm run patterns:auto -- --platform substack`. The by-hand route below is the
  fallback.
- **Free sort.** A publication's archive supports a top sort: append `?sort=top` to the archive URL
  (`https://<pub>.substack.com/archive?sort=top`). This orders by the publication's own popularity
  signal.
- **Visible to a non-owner.** Likes and comments, plus an exact publication date. **No public
  restack or share count on the archive record**, so `shares` is null rather than zero. A
  subscriber count shows only when the writer chose to publish it, so followers usually falls back
  to the config seed. A paid-subscriber post yields only its public preview, which is what gets
  recorded, with a note saying so. Nothing reads past a paywall.
- **View counts?** No. Substack keeps opens and views owner-only.
- **Fallback.** Use the archive top sort to pick candidates, then record likes and comments.
  Leave `views` null.
- Notes are a separate surface from posts. This repo already pulls Notes for Muxin's own account
  (`/atomize notes`, `src/pull/`); for a *stranger's* Notes, read them on the web and paste.

## bluesky

- **By hand.** No collector adapter. Stage entries through `data/patterns/inbox/`.
- **Free sort.** No native sort-by-top. The free route is the public AT Protocol API, which needs
  no key for public data: `app.bsky.feed.getAuthorFeed` returns a creator's posts with
  `likeCount`, `repostCount`, `replyCount`, and `quoteCount` attached. Pull the feed and sort
  locally by likes. `bsky.app` search also supports `from:handle`.
- **Visible to a non-owner.** Likes, reposts, replies, quotes.
- **View counts?** No. Bluesky does not expose impressions publicly.
- **Fallback.** Sort by likes and leave `views` null, same shape as LinkedIn.
- This repo already talks to Bluesky (`npm run bluesky`), but that path is scoped to Muxin's own
  analytics ingest, and Bluesky has no pattern-mining collector. Do not extend the analytics path
  inside `/patterns`; collect Bluesky by hand.

## threads

- **By hand.** No collector adapter. Stage entries through `data/patterns/inbox/`.
- **Free sort.** None. There is no public way to sort another account's Threads posts by
  performance. Scroll the profile.
- **Visible to a non-owner.** Likes, replies, reposts, quotes.
- **View counts?** Threads shows a view count to the post's own author. Whether any view number is
  currently public to other readers is **unverified**; assume not, and leave `views` null unless
  you can literally see one on the post.
- **Fallback.** Scroll and record likes plus replies. Expect a small, rough corpus here. Threads is
  the weakest collection surface of the nine and it is fine to skip it in a first pass.

## mastodon

- **By hand.** No collector adapter. Stage entries through `data/patterns/inbox/`.
- **Free sort.** No native sort. The public REST API is open and unauthenticated for public posts:
  `/api/v1/accounts/:id/statuses` returns `favourites_count`, `reblogs_count`, and
  `replies_count`. Pull and sort locally.
- **Visible to a non-owner.** Favourites, boosts, replies.
- **View counts?** No, deliberately. Mastodon does not track impressions as a design choice, so
  there is no number being withheld; it does not exist. Never record a views figure here.
- **Fallback.** Favourites plus boosts, `views` null.
- Instance-dependent caveat: counts on a given server reflect what that server has seen federated
  to it, so the same post can read differently from two instances. Note the instance in `notes`.

## tiktok

- **By hand, and the body is a transcript.** No collector adapter, and video collection is not
  built. Stage entries through `data/patterns/inbox/`.
- **Free sort.** The profile grid prints a view count on every video thumbnail, so you can scan a
  creator's grid and spot the outliers with your eyes. That is the whole job the paid short-form
  tools automate. Whether the web profile currently offers a "Popular" sort tab alongside
  Videos / Reposts / Liked is **unverified**.
- **Visible to a non-owner.** Views, likes, comments, shares, saves.
- **View counts?** Yes, public on every video.
- **Fallback.** Not needed for the numbers. The hard part on TikTok is the *body*, not the metrics:
  see the transcript note below.
- **Transcript.** There is no puller, and video collection is not built. Either type or paste the spoken content yourself, or use
  TikTok's own auto-captions if the creator left them on and copy that text. Record which one you
  did in `transcript_source` (`manual` or `captions`). Never summarize the video into the `body`
  field; a summary is not a transcript and it destroys the structural analysis in `/patterns analyze`.

## youtube

- **By hand, and the body is a transcript.** No collector adapter, and video collection is not
  built. Stage entries through `data/patterns/inbox/`.
- **Free sort.** The best free sort of any platform here. Channel page, Videos tab (or Shorts tab),
  then the sort control set to "Popular". This is exactly what vidIQ and Viewstats charge for.
- **Visible to a non-owner.** Views, likes, comments. Dislikes are hidden. Subscriber counts are
  public but rounded, so record the rounded number and do not pretend to precision.
- **View counts?** Yes, public.
- **Fallback.** Not needed.
- **Transcript.** Free and reliable: open the video, expand the description, click "Show
  transcript", copy the text. Record `transcript_source: captions`. If the creator disabled
  captions, type the first thirty seconds by hand at minimum, because the hook is what the analysis
  step needs most, and set `transcript_source: manual`.

## instagram

- **By hand, and the body is a transcript.** No collector adapter, and video collection is not
  built. Stage entries through `data/patterns/inbox/`.
- **Free sort.** No native sort. The Reels tab on a profile prints a play count on each thumbnail,
  so scan that grid the same way as TikTok's.
- **Visible to a non-owner.** Reels: plays, likes, comments. Feed posts: likes and comments only,
  and **like counts can be hidden by the account owner**, in which case you see nothing numeric at
  all. Carousels and stills are therefore often uncollectable.
- **View counts?** On Reels, yes (as plays). On feed posts, no.
- **Fallback.** Collect Reels only and skip feed posts. If likes are hidden on an account, either
  skip the account or record the entry with every metric null and rely on the analysis step alone;
  an entry with no numbers can never be an outlier, so say so to Muxin rather than filing it
  silently.
- **Transcript.** Same as TikTok: paste or type it. No puller, and video collection is not built.

## Quick reference

| Platform | Automated? | Public views? | Free sort route | Which outlier bars can fire |
|---|---|---|---|---|
| x | yes | yes | advanced search `from: min_faves:` | both: views / followers, and views vs the account's own median |
| linkedin | yes | no | activity feed scroll (top sort unverified) | baseline only, on engagement |
| substack | yes | no | archive `?sort=top` | baseline only, on engagement |
| bluesky | no | no | public API author feed, sort locally | baseline only, on engagement |
| threads | no | no (unverified) | none, scroll | baseline only, on engagement |
| mastodon | no | no, by design | public API statuses, sort locally | baseline only, on engagement |
| tiktok | no | yes | view counts printed on profile grid | both |
| youtube | no | yes | Videos or Shorts tab, sort "Popular" | both, subscribers as the follower count |
| instagram | no | Reels only | Reels grid play counts | both on Reels, baseline only on feed posts |

**The view-to-follower ratio is views-only and stays that way.** A like-to-follower ratio is a
different quantity with a different meaning, so no platform without public views gets that bar. The
baseline bar is the one that generalizes: it compares a post to its own account's typical post,
using views where views exist and the recorded public engagement where they do not.

Three rules that come with that, and all three matter when you relay a number:

- **A baseline never mixes metric kinds.** An account's baseline is built only from entries scored
  the same way, or it returns null. A views number is never compared against an engagement number.
- **Entries scored on the other metric drop out of the sample.** They are not converted. So a
  mixed account can fall under the three-comparable-entries floor (`MIN_BASELINE_SAMPLE`, which is
  3) and return no baseline at all despite having plenty of entries. Deliberate, not a bug, and
  worth saying out loud when it bites.
- **An engagement score sums whichever of likes, comments and shares were recorded**, so two
  engagement scores can rest on different field sets and are only roughly comparable. This is a
  known, deliberate softness. It matters most where a field is intermittently absent: LinkedIn
  omits the repost count on low-engagement posts, and Substack has no public share count at all, so
  a Substack score is always likes plus comments. Treat an engagement multiple as directional.
- **The verdict records which metric the baseline used**, as `baselineMetric`: `"views"`,
  `"engagement"`, or null when there is no multiple. "4x baseline" means nothing on its own. Say 4x
  views or 4x engagement. An unqualified multiple is a misleading number, not a shorter one.

A baseline built on engagement is a coarser signal than one built on views, so treat a no-views
platform's verdicts as weaker evidence and lean harder on `/patterns analyze` judgment there. And
read `src/patterns/outliers.ts` before describing the scoring to Muxin: that file is the authority
on what it currently computes, not this page.

An earlier version of this table claimed a "baseline multiple on likes" at a time when the code
computed both bars from views alone, which meant the five no-views platforms silently produced no
outliers at all. Finding that gap is what got the baseline generalized.
