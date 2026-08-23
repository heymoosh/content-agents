# Platform collection guide (free routes, honest limits)

Read this before running `/patterns collect`. One section per platform covering four things:

1. How to sort a stranger's posts by performance without paying for anything.
2. Which numbers a non-owner can actually see.
3. Whether view counts exist on that platform at all.
4. The honest fallback when they do not.

**Two ground rules.**

- **Record only what you can actually see.** Every `metrics` field is nullable. A null is a real,
  useful answer. A guessed number quietly poisons the outlier math in `src/patterns/outliers.ts`,
  which does arithmetic on whatever it is handed and cannot tell an estimate from a reading.
- **Say "unverified" out loud.** Several claims below are marked unverified because platform UIs
  change often and nobody has re-checked them since this file was written (2026-08-22). Treat an
  unverified line as a thing to go look at, not a thing to rely on.

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

None of them is required for v1. Every platform below has a free route or an honest fallback.

## x

- **Free sort.** X advanced search is the real answer and it is genuinely good. Search
  `from:handle min_faves:500` and raise the threshold until only a handful of posts come back.
  `min_retweets:` and `min_replies:` work the same way, and `since:`/`until:` bound the window.
  This is the free version of what Twemex sells.
- **Visible to a non-owner.** Views, likes, reposts, replies, quotes, bookmarks. X is the most
  generous public platform on this front.
- **View counts?** Yes, public on every post.
- **Fallback.** Not needed. If search is rate limited while logged out, log in and retry.
- **Cheapest starting point overall**, because views plus a public follower count means
  `viewFollowerRatio` works here with no guessing.

## linkedin

- **Free sort.** Open the creator's profile, click "Show all posts" to reach their activity feed,
  then scroll. The activity feed offers a sort control; whether it still includes a "Top" option
  (as opposed to only "Recent") is **unverified**. Check before relying on it.
- **Visible to a non-owner.** Reactions, comments, reposts. That is all.
- **View counts?** No. LinkedIn impressions are owner-only. Do not record a views number here.
- **Fallback (this is the normal path on LinkedIn).** Scroll the activity feed by hand, record
  reactions and comments for each post, and leave `views` null. Outlier detection then runs off
  `baselineMultiple` against that account's other entries, not `viewFollowerRatio`. That is fine
  and it is why the ratio path is allowed to return null.
- Follower count is public on the profile, so record it even though views are missing. It is still
  useful context when reading the analyses later.

## substack

- **Free sort.** A publication's archive supports a top sort: append `?sort=top` to the archive URL
  (`https://<pub>.substack.com/archive?sort=top`). This orders by the publication's own popularity
  signal.
- **Visible to a non-owner.** Likes, comments, restacks, on both posts and Notes.
- **View counts?** No. Substack keeps opens and views owner-only.
- **Fallback.** Use the archive top sort to pick candidates, then record likes and comments.
  Leave `views` null.
- Notes are a separate surface from posts. This repo already pulls Notes for Muxin's own account
  (`/atomize notes`, `src/pull/`); for a *stranger's* Notes, read them on the web and paste.

## bluesky

- **Free sort.** No native sort-by-top. The free route is the public AT Protocol API, which needs
  no key for public data: `app.bsky.feed.getAuthorFeed` returns a creator's posts with
  `likeCount`, `repostCount`, `replyCount`, and `quoteCount` attached. Pull the feed and sort
  locally by likes. `bsky.app` search also supports `from:handle`.
- **Visible to a non-owner.** Likes, reposts, replies, quotes.
- **View counts?** No. Bluesky does not expose impressions publicly.
- **Fallback.** Sort by likes and leave `views` null, same shape as LinkedIn.
- This repo already talks to Bluesky (`npm run bluesky`), but that path is scoped to Muxin's own
  analytics ingest. Do not extend it inside `/patterns`; v1 has no scraper.

## threads

- **Free sort.** None. There is no public way to sort another account's Threads posts by
  performance. Scroll the profile.
- **Visible to a non-owner.** Likes, replies, reposts, quotes.
- **View counts?** Threads shows a view count to the post's own author. Whether any view number is
  currently public to other readers is **unverified**; assume not, and leave `views` null unless
  you can literally see one on the post.
- **Fallback.** Scroll and record likes plus replies. Expect a small, rough corpus here. Threads is
  the weakest collection surface of the nine and it is fine to skip it in a first pass.

## mastodon

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

- **Free sort.** The profile grid prints a view count on every video thumbnail, so you can scan a
  creator's grid and spot the outliers with your eyes. That is the whole job the paid short-form
  tools automate. Whether the web profile currently offers a "Popular" sort tab alongside
  Videos / Reposts / Liked is **unverified**.
- **Visible to a non-owner.** Views, likes, comments, shares, saves.
- **View counts?** Yes, public on every video.
- **Fallback.** Not needed for the numbers. The hard part on TikTok is the *body*, not the metrics:
  see the transcript note below.
- **Transcript.** v1 has no puller. Either type or paste the spoken content yourself, or use
  TikTok's own auto-captions if the creator left them on and copy that text. Record which one you
  did in `transcript_source` (`manual` or `captions`). Never summarize the video into the `body`
  field; a summary is not a transcript and it destroys the structural analysis in `/patterns analyze`.

## youtube

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
- **Transcript.** Same as TikTok: paste or type it, no puller in v1.

## Quick reference

| Platform | Public views? | Free sort route | Realistic denominator |
|---|---|---|---|
| x | yes | advanced search `from: min_faves:` | views / followers |
| linkedin | no | activity feed scroll (top sort unverified) | baseline multiple on likes |
| substack | no | archive `?sort=top` | baseline multiple on likes |
| bluesky | no | public API author feed, sort locally | baseline multiple on likes |
| threads | no (unverified) | none, scroll | baseline multiple on likes |
| mastodon | no, by design | public API statuses, sort locally | baseline multiple on favourites |
| tiktok | yes | view counts printed on profile grid | views / followers |
| youtube | yes | Videos or Shorts tab, sort "Popular" | views / subscribers |
| instagram | Reels only | Reels grid play counts | views / followers, Reels only |

`baselineMultiple` needs at least three other entries with a numeric `views` value for that
account before it will return anything. On the five platforms with no public views, that condition
can never be met from views alone, so those platforms lean on human judgment in `/patterns analyze`
plus whatever engagement numbers you did record. Say that to Muxin plainly when you collect there
instead of implying the scoring works the same everywhere.
