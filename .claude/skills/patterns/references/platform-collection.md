# Platform collection guide (free routes, honest limits)

Read this before running `/patterns collect`. One section per platform covering four things:

1. How to sort a stranger's posts by performance without paying for anything.
2. Which numbers a non-owner can actually see.
3. Whether view counts exist on that platform at all.
4. The honest fallback when they do not.

**Three ground rules.**

- **Record only what you can actually see.** Every `metrics` field is nullable. A null is a real,
  useful answer. A guessed number quietly poisons the outlier math in `src/patterns/outliers.ts`,
  which does arithmetic on whatever it is handed and cannot tell an estimate from a reading.
- **Say "unverified" out loud.** Several claims below are marked unverified because platform UIs
  change often and nobody has re-checked them since this file was written (2026-08-22). Treat an
  unverified line as a thing to go look at, not a thing to rely on.
- **Never let a model produce a `body`.** Do not use WebFetch, or any other tool that answers a
  prompt against a page with a model, to retrieve post text. It hands back the model's version of
  the page, not the page. On 2026-08-22 that route staged another person's comment as a creator's
  own 22-character post, and all 15 LinkedIn entries had to be purged and re-collected from raw
  markup. Bodies come from Muxin's clipboard or from raw retrieval (`curl` plus the platform's own
  JSON or markup). When raw retrieval fails for a post, stage nothing for it and say so. The full
  rule, including the four tells that a body was summarized, is the hard rule at the top of mode 1
  in `SKILL.md`.

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
- **Visible to a non-owner.** Views, likes, reposts, replies, quotes, bookmarks. To a human in a
  browser, X is the most generous public platform on this front.
- **View counts?** Yes, public on every post.
- **Raw-retrieval verdict (2026-08-22): not collectable honestly today.** A direct fetch of a post
  URL returns HTTP 402. The public mirrors serve anti-bot walls instead of content. And
  `cdn.syndication.twimg.com/tweet-result`, the one endpoint that does answer, truncates body text
  at 279 characters with no full-text field anywhere in the response, which fails the verbatim-body
  rule for anything longer. Do not stitch a truncated body into a whole one, and do not record a
  truncated body as if it were the post.
- **Fallback.** Muxin pastes the body herself; X search still does the sorting. There is no
  automated body route here until Phase 2.
- Once an entry exists, views plus a public follower count mean `viewFollowerRatio` works here with
  no guessing. The bottleneck on X is the body, not the numbers.

## linkedin

- **Free sort.** Open the creator's profile, click "Show all posts" to reach their activity feed,
  then scroll. The activity feed offers a sort control; whether it still includes a "Top" option
  (as opposed to only "Recent") is **unverified**. Check before relying on it.
- **Visible to a non-owner.** Reactions and comments. Repost counts are not visible logged out.
- **View counts?** No. LinkedIn impressions are owner-only, so `views` is always null here.
- **Raw-retrieval verdict (2026-08-22): a good free surface, and the strongest one in this file.**
  curl the public post URL and parse the `<script type="application/ld+json">`
  `SocialMediaPosting` block. It carries:
  - `articleBody`: the true post body, with its real line breaks. This is the only acceptable
    source for `body` on LinkedIn.
  - `interactionStatistic`: the like and comment counts.
  - `author.interactionStatistic.userInteractionCount`: the account's follower count.
  - `datePublished`: a real ISO timestamp for `posted_at`.
- **Fallback.** Scroll the activity feed by hand, record reactions and comments for each post, and
  leave `views` null. Outlier detection then runs off `baselineMultiple` against that account's
  other entries, not `viewFollowerRatio`. That is fine and it is why the ratio path is allowed to
  return null.
- Follower count is public on the profile and in the ld+json block, so record it even though views
  are missing. It is still useful context when reading the analyses later.

## substack

- **Free sort.** A publication's archive supports a top sort: append `?sort=top` to the archive URL
  (`https://<pub>.substack.com/archive?sort=top`). This orders by the publication's own popularity
  signal.
- **Visible to a non-owner.** Likes, comments, restacks, on both posts and Notes.
- **View counts?** No. Substack keeps opens and views owner-only.
- **Raw-retrieval verdict (2026-08-22): retrievable.** Posts come back as raw HTML or through
  Substack's own JSON, both via curl, so `body` has a verbatim route here. Per-post view counts are
  never public by any route. One caveat found in practice: at least one publication's archive
  returned zero posts logged out, so a real, active publication can still yield nothing. Report
  that as the finding it is rather than filling the gap from somewhere else.
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
- **Raw-retrieval verdict (2026-08-22): retrievable.** The public API returns the post record
  itself, so `text` off `getAuthorFeed` is a verbatim `body` route with no model in the path.
- **Fallback.** Sort by likes and leave `views` null, same shape as LinkedIn.
- This repo already talks to Bluesky (`npm run bluesky`), but that path is scoped to Muxin's own
  analytics ingest. Do not extend it inside `/patterns`; v1 has no scraper.

## threads

> **Before the first run, expect this.** The collector reads Threads payload field names that were
> reconstructed from Instagram's schema and never checked against a live logged-in response. If
> they are wrong, the first `npm run pull -- threads` **fails with `UI_CHANGED`**, and that is a
> normal step, not a crash. It writes every JSON payload the session captured to
> `~/.content-agents/pull-diagnostics/threads-<timestamp>-no-posts-extracted/captured-payloads.json`
> and prints that path. Open it, read the real field names, correct them in
> `src/pull/threads-extract.ts`, run again. A first run that fails and hands over the data needed
> to fix it is the design. It is the same loop `x.ts` and `substack.ts` went through.

- **Free sort.** None. There is no public way to sort another account's Threads posts by
  performance. Scroll the profile. The puller below therefore takes an **unselected window**: the
  account's most recent 24 posts, none of them chosen for how they did, and the outlier math finds
  the winners inside that sample.
- **The unselected window is a feature, and this file has the scar to prove it.** A sample
  discovered by searching for winners makes a denominator of winners, and dividing a winner by that
  understates how far it travelled. That is not hypothetical: on this branch the outlier script
  rated r/ADHD's biggest post of the year at 2.2x against its collected siblings, because every
  sibling was also a top-of-year post. Against a real community median the true figure is 4095x,
  three orders of magnitude out. Threads has no top-sort to tempt anyone into that mistake, so its
  window is honest by default and can serve as a baseline denominator rather than only as a corpus.
- **Visible to a non-owner.** Likes, replies, reposts, quotes.
- **View counts?** Threads shows a view count to the post's own author. Whether any view number is
  currently public to other readers is **unverified**; assume not, and leave `views` null unless
  you can literally see one on the post.
- **Raw-retrieval verdict (2026-08-23): logged out, nothing. Logged in, a real route.** A
  logged-out fetch of `threads.com/@handle` returns a 262KB JavaScript shell with no post data in
  it at all: no `like_count`, no `thread_items`, no captions. And threads.com answers HTTP 200 for
  any string including nonsense, so a status code is never an existence check. The route that does
  work is a saved Chrome session, the same machinery LinkedIn, X and Substack use:

      npm run pull:login -- threads     # once, by hand, in a real browser window
      npm run pull -- threads           # later, headless, stages into data/patterns/inbox/
      npm run patterns:collect          # validates and appends to the corpus

  Threads signs in with an Instagram account, not a separate Threads password. The collector reads
  the app's own JSON, both the `<script type="application/json">` blobs on the page and the
  GraphQL responses the app fetches, and walks them structurally for post objects. No model reads
  the page, so no body is ever a model's version of one.
- **The carousel problem, stated plainly.** Threads' top posts in this corpus are carousels whose
  substance is typeset onto the slide images. **That on-screen text is not extractable.** Nothing
  in this repo reads words off a picture, and the one field that looks like it might, Meta's
  `accessibility_caption`, is a machine description of the image ("May be an image of text"), not
  the typeset headline. So on every image, carousel, video, link-preview and quote post:
  `media.onscreen_text` stays **null**, `media.body_is_complete` is **false**, and the alt text
  goes in `media.description` labelled as Meta's own. The caption is recorded as the caption and is
  never allowed to stand in for the slides.
  What the collector does instead is **download the slide images** to
  `<repo>/data/patterns/media/threads/<handle>-<code>/` (gitignored) and name that directory in the
  entry's `description` as a full absolute path, ready to paste into Finder, so a human can open
  the folder, read the words off the slides, and fill `onscreen_text` in by hand. That is the
  honest half-measure: the pictures are collected, the words on them are not.
- **A post with no caption at all is skipped, not padded.** `validateEntry` requires a non-empty
  `body`, and a wordless carousel has none. The collector skips it and prints why. Writing a
  description into `body` to get it past the gate would put text in the corpus the creator never
  wrote.
- **Only the account's own standalone posts are staged.** Every extracted post is checked against
  the target handle, and replies and reposts are dropped. This is the rule that exists because a
  stranger's comment was once staged as a creator's own post on LinkedIn and all 15 entries had to
  be purged.
- **Do not ship a crawler user-agent.** An earlier pass reached Threads content by presenting as
  Googlebot. It worked, and Muxin chose the login route instead. There is no user-agent trick in
  `src/pull/platforms/threads.ts` and there should not be one.
- **Fallback.** If the puller comes back empty, it writes every captured JSON payload to
  `~/.content-agents/pull-diagnostics/` and fails `UI_CHANGED`, because the field names it reads
  are reconstructed from Instagram's schema rather than verified against a live Threads response.
  Read that dump, correct the names in `src/pull/threads-extract.ts`, and run again. Failing that,
  scroll by hand and record likes plus replies with `views` null.

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

- **Raw-retrieval verdict (2026-08-22): not minable for free today. TikTok needs the Phase 2
  scraper.** Profile pages return only the follower header and nothing about individual videos.
  Video permalinks time out. No transcript of any kind, spoken or written, comes back. Nothing from
  TikTok can be staged honestly right now, so report it as an uncollected platform instead of
  making up the difference elsewhere.
- **Third-party analytics mirrors are discovery leads only.** Some of them do print a per-video
  view number, but that number is the aggregator's own computation, not what TikTok shows. Use such
  a mirror at most to notice which video is worth a look. **Never record its numbers into
  `metrics`.** A computed figure staged as a reading is the same class of error as a summarized
  body.
- **Free sort, in a browser, by eye.** The profile grid prints a view count on every video
  thumbnail, so Muxin can scan a creator's grid and spot the outliers herself. That is the whole
  job the paid short-form tools automate. Whether the web profile currently offers a "Popular" sort
  tab alongside Videos / Reposts / Liked is **unverified**.
- **Visible to a non-owner, in a browser.** Views, likes, comments, shares, saves.
- **View counts?** Yes on the page, no through any free fetch.
- **Transcript.** v1 has no puller and no fetch route. Either type or paste the spoken content
  yourself (`transcript_source: "manual"`), or copy TikTok's own auto-captions if the creator left
  them on (`transcript_source: "captions"`, plural, because those are the spoken words). If neither
  is available and all you have is the creator's written caption, record that and set
  `transcript_source: "caption"`, singular, which says the body is not speech. Never summarize the
  video into the `body` field; a summary is not a transcript and it destroys the structural
  analysis in `/patterns analyze`.

## youtube

- **Free sort.** The best free sort of any platform here. Channel page, Videos tab (or Shorts tab),
  then the sort control set to "Popular". This is exactly what vidIQ and Viewstats charge for.
- **Visible to a non-owner.** Views, likes, comments. Dislikes are hidden. In a browser,
  subscriber counts are public but rounded, so record the rounded number and do not pretend to
  precision. See the fetch caveat below before assuming you can get that number without a browser.
- **View counts?** Yes, public.
- **Raw-retrieval verdict (2026-08-22): genuinely minable, with one hole.** The watch page yields a
  real caption transcript, a real view count, and a real like count. **Subscriber counts are NOT
  retrievable**: channel pages render as a JavaScript shell and the number is not in the fetched
  markup. So `followers` stays null on a fetched YouTube entry, the view-to-follower bar cannot run
  there, and those entries score on `baselineMultiple` instead, the way LinkedIn's do.
- **Never substitute a creator's website figure for a subscriber count.** Creator sites publish a
  cross-platform total audience number. That is not a per-platform follower count, and recording it
  as one quietly corrupts every ratio computed from it.
- **Fallback.** For the numbers, none needed. For the subscriber count, either Muxin reads the
  rounded number off the channel page herself or `followers` stays null.
- **Transcript.** Free and reliable: the real caption track off the watch page, or in a browser,
  open the video, expand the description, click "Show transcript", copy the text. Either way record
  `transcript_source: "captions"`, plural, because those are the spoken words. If the creator
  disabled captions, type the first thirty seconds by hand at minimum, because the hook is what the
  analysis step needs most, and set `transcript_source: "manual"`.

## instagram

- **Free sort.** No native sort. The Reels tab on a profile prints a play count on each thumbnail,
  so scan that grid the same way as TikTok's.
- **Visible to a non-owner.** Reels: plays, likes, comments. Feed posts: likes and comments only,
  and **like counts can be hidden by the account owner**, in which case you see nothing numeric at
  all. Carousels and stills are therefore often uncollectable.
- **View counts?** On Reels, yes (as plays). On feed posts, no.
- **Raw-retrieval verdict (2026-08-22): partly minable.** Captions and profile follower counts are
  retrievable via curl. Play counts and like counts on Reels are NOT retrievable logged out, so
  those metrics stay null on a fetched entry. Spoken transcripts are never retrievable here, by any
  free route.
- **Fallback.** Collect Reels only and skip feed posts. If likes are hidden on an account, either
  skip the account or record the entry with every metric null and rely on the analysis step alone;
  an entry with no numbers can never be an outlier, so say so to Muxin rather than filing it
  silently.
- **Transcript.** There is no spoken-transcript route on Instagram at all. If Muxin types the
  spoken words herself, that is `transcript_source: "manual"`. Otherwise record the creator's
  written caption or the on-screen text as `body` and set `transcript_source: "caption"`,
  singular. **Instagram is the platform where `"caption"` is normally the right answer.** It states
  that the body is written text rather than speech, which is what stops `/patterns analyze` from
  reporting a spoken hook nobody spoke. Do not use `"captions"`, plural, here unless you genuinely
  copied a spoken caption track.

## Quick reference

This table is what a human can see in a browser. What a free `curl` actually returns is a narrower
question, and the scoreboard under the table answers that one.

| Platform | Public views? | Free sort route | Realistic denominator |
|---|---|---|---|
| x | yes | advanced search `from: min_faves:` | views / followers |
| linkedin | no | activity feed scroll (top sort unverified) | baseline multiple on likes |
| substack | no | archive `?sort=top` | baseline multiple on likes |
| bluesky | no | public API author feed, sort locally | baseline multiple on likes |
| threads | no (unverified) | none, scroll (puller takes most recent) | baseline multiple on likes |
| mastodon | no, by design | public API statuses, sort locally | baseline multiple on favourites |
| tiktok | yes, in a browser only | view counts printed on profile grid | views / followers |
| youtube | yes | Videos or Shorts tab, sort "Popular" | views / subscribers in a browser, baseline multiple when fetched |
| instagram | Reels only, in a browser only | Reels grid play counts | baseline multiple when fetched |

**Raw-retrieval scoreboard (2026-08-22).** What a free fetch actually returned when this was last
checked:

- **linkedin**: body, likes, comments, follower count, date. The ld+json route, the best surface
  here.
- **youtube**: body (a real caption transcript), views, likes. No subscriber count.
- **substack**: body, likes, comments. No views ever. One publication's archive came back empty
  logged out.
- **bluesky**: body plus all four engagement counts, via the public API.
- **instagram**: written caption and follower count. No plays, no likes, no spoken transcript.
- **mastodon**: body, favourites, boosts, replies, via the public API. No views, by design.
- **threads**: logged out, nothing at all. Logged in, via the saved-session puller (2026-08-23):
  body (the caption), likes, replies, reposts, follower count, date, media form and slide count.
  No views. **No carousel on-screen text, ever**, so every media post lands
  `body_is_complete: false` and its slides are downloaded for a human to read.
- **tiktok**: nothing. Needs the Phase 2 scraper.
- **x**: nothing usable. 402 on a direct fetch, walls on the mirrors, and a 279-character
  truncation on the syndication endpoint.

`baselineMultiple` needs at least three other entries with a numeric `views` value for that
account before it will return anything. On the five platforms with no public views, that condition
can never be met from views alone, so those platforms lean on human judgment in `/patterns analyze`
plus whatever engagement numbers you did record. Say that to Muxin plainly when you collect there
instead of implying the scoring works the same everywhere.

Two platforms, x and tiktok, currently have no honest free body route at all. An empty entry count
for either one is the correct outcome, not a collection failure to work around.
