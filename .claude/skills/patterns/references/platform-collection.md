# Platform collection guide (free routes, honest limits)

Read this before running `/patterns collect`. One section per platform covering four things:

1. How to sort a stranger's posts by performance without paying for anything.
2. Which numbers a non-owner can actually see.
3. Whether view counts exist on that platform at all.
4. The honest fallback when they do not.

Follower and audience counts have their own section above the platform sections, on purpose. A
correct route filed under the wrong question is a route nobody finds; the section explains what
that already cost.

**Three ground rules.**

- **Record only what you can actually see.** Every `metrics` field is nullable. A null is a real,
  useful answer. A guessed number quietly poisons the outlier math in `src/patterns/outliers.ts`,
  which does arithmetic on whatever it is handed and cannot tell an estimate from a reading.
- **Say "unverified" out loud, and re-check before trusting a "no".** Several claims below are
  marked unverified because platform UIs change often and nobody has re-checked them. Treat an
  unverified line as a thing to go look at, not a thing to rely on. This is not a formality: on
  2026-08-23 four verdicts in this file turned out to be stale, and three of them said a route did
  not work when it did. **A stale "not retrievable" is worse than a gap**, because the next reader
  trusts it and does not retry. Where a claim is half right, the correction below says which half.
- **Never let a model produce a `body`.** Do not use WebFetch, or any other tool that answers a
  prompt against a page with a model, to retrieve post text. It hands back the model's version of
  the page, not the page. On 2026-08-22 that route staged another person's comment as a creator's
  own 22-character post, and all 15 LinkedIn entries had to be purged and re-collected from raw
  markup. Bodies come from Muxin's clipboard or from raw retrieval (`curl` plus the platform's own
  JSON or markup). When raw retrieval fails for a post, stage nothing for it and say so. The full
  rule, including the four tells that a body was summarized, is the hard rule at the top of mode 1
  in `SKILL.md`.

## Standing ruling: passthroughs are allowed, computed mirrors are not

Decided 2026-08-23, and also written into the header of `config/pattern-mining.yaml`.

A **passthrough** that relays the platform's own number is a different category from a **mirror**
that computes or estimates one. Only the second kind is banned. The ban on third-party analytics
mirrors below is correct and stays, because their number is somebody else's arithmetic.
`api.fxtwitter.com` relays X's own API response rather than computing anything, and its returned
`name` and `screen_name` matched x.com on every account checked, so the failure mode the ban exists
to prevent does not apply there.

The alternative was weighed rather than assumed. Refusing the passthrough means `null` on all 26 X
rows, which leaves the largest text platform in the corpus unrankable without making anything more
accurate, only emptier.

**Two conditions, and they are the substance of the ruling rather than trimming on it.**

1. **Every passthrough-sourced value keeps its inline provenance note.** A number whose origin is
   not written next to it has quietly become a platform reading, which is the exact drift this
   ruling exists to prevent. Do not tidy those notes away.
2. **If such a number ever drives a real decision, re-read it off the app first.** The recorded
   provenance is what makes that possible, so the note is the whole point rather than a formality.

**What it does not cover.** It is about the route, not the platform, and it licenses nothing else.
It does not permit recording a TikTok analytics mirror, a creator's own website figure, or a
Wikipedia number as a platform reading. All three have already produced wrong values here: seven
were corrected on 2026-08-23, and one of them moved **downward**, which growth cannot explain. A
number that moves backwards is proof rather than suspicion that a site figure and a platform figure
are different quantities.

## Follower and audience counts, in one place

This section exists because of a specific failure, and the failure is more useful than the routes.

LinkedIn's follower-count route has been documented in this file the whole time. It sits inside the
LinkedIn **body-retrieval** bullet, so it reads as being about post text. An agent looking for
follower counts did not find it there, reported LinkedIn counts unreachable, recorded about 20 rows
as null on that basis, and the conclusion went upstream to Muxin as fact alongside the same claim
for YouTube and X. She pushed back and said the counts are visible and we were not looking hard
enough. She was right on all three. The cause was filing, not effort.

So: **file retrieval notes by what you are trying to GET, not by which fetch happens to return it.**
One page often yields several different things, and filing all of them under the first thing anyone
wanted is how a documented capability becomes an undocumented one. A correct sentence nobody can
find is indistinguishable from a missing one, except that it also leaves the reader confident the
capability does not exist.

| Platform | Where the follower count actually is |
|---|---|
| linkedin | Two fetches, not one. See the chain below. Usually walled. |
| youtube | `youtube.com/@<handle>/about`, the `subscriberCountText` string. NOT the channel page. |
| tiktok | The profile page's embedded JSON, `followerCount` read adjacent to the matching `uniqueId`. |
| x | Nowhere on x.com. Recorded from the `api.fxtwitter.com` passthrough, under the ruling above. |
| threads | Logged in, `user.follower_count` in the profile payload. Logged out, the fediverse lookup, which resolves rarely. |
| substack | Not exposed. Subscriber counts are the publication's own business. |
| mastodon | `followers_count` on the public accounts API. |
| bluesky | `followersCount` on the public AT Protocol profile. |
| instagram | Retrievable by curl on the profile. |
| reddit | No subscriber count on the RSS route. The OAuth API does return one; see the reddit section. |

**The LinkedIn chain, written out because a profile fetch alone will not do it:**

> profile page → extract a public `linkedin.com/posts/...` URL → fetch that post → read
> `author.interactionStatistic` where `interactionType` is `FollowAction`.

**A blank from LinkedIn is a wall, not a negative.** LinkedIn walls the *profile* fetch, so no post
URL can be obtained at all and the chain never starts. In this project it succeeded on **3 of 23
attempts** across three separate sessions. Record the null as "not retrieved", never as "LinkedIn
has no count", and never fill it from the creator's website.

**A safety rule that applies wherever a page can carry someone else's number.** If a fetch returns
more than one candidate value, treat it as ambiguous and record null rather than taking the first.
This is not hypothetical on either platform where it bites: YouTube's main channel page carries a
`subscriberCountText` for every **sidebar recommendation**, and TikTok's markup often puts a
different account's `followerCount` first. A naive first-match read on either one records a
stranger's number under this creator's name.

**Why this is worth the trouble.** Adding YouTube counts immediately exposed two seeded channels as
copycats that every other check had passed. `youtube.com/@indiehackers` has a metadata title of
exactly "Indie Hackers" and **13 subscribers with 2 videos**. `youtube.com/@TheAIAdvantage` is
titled "The AI Advantage" and has **448 subscribers**. Both titles matched the real creator exactly.
A title match is not verification. The follower count was the only check that caught them.

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
- **Raw-retrieval verdict, split three ways, because the old one-line verdict was wrong on one of
  them.** Take these separately and do not let the first fix the third.
  - **Handles and profiles: WORKS (corrected 2026-08-23).** The old claim that a direct fetch
    returns HTTP 402 is FALSE for profile pages. A plain `curl` of an x.com profile returns the
    page, its `twitter:title` meta reads `Display Name (@handle) on X`, and a wrong handle returns
    `User Profile Not Found - X | 404 Error`. So the route genuinely discriminates rather than
    answering yes to everything. It verified 26 X handles here and caught two 404s
    (`x.com/aakashg0`, `x.com/marc_louvion`) that a search snippet would have passed. The same
    false 402 claim was sitting in `config/pattern-mining.yaml` on the `@AnandWrites` row and has
    been corrected there.
  - **Bodies: UNCHANGED, still no honest automated route.** `cdn.syndication.twimg.com/tweet-result`
    is the one endpoint that answers, and it truncates post text at 279 characters with no
    full-text field anywhere in the response, which fails the verbatim-body rule for anything
    longer. Do not stitch a truncated body into a whole one, and do not record a truncated body as
    if it were the post. **Fixing the handle item above does not make X collectable.**
  - **Follower counts: not on x.com at all**, by any route. They come from the
    `api.fxtwitter.com` passthrough, which relays X's own API response. See the standing ruling
    above, including the provenance note every such value has to keep.
- **Fallback.** Muxin pastes the body herself; X search still does the sorting. There is no
  automated body route here until Phase 2.
- Once an entry exists, views plus a follower count mean `viewFollowerRatio` works here with no
  guessing. The bottleneck on X is the body, not the numbers.

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
- **Follower count: see "Follower and audience counts, in one place" above, not this bullet.** The
  number is in the same ld+json block, which is exactly why it used to be documented only here, and
  why an agent looking for follower counts never found it. The chain is two fetches: profile page →
  extract a public `linkedin.com/posts/...` URL → fetch that post → read `author.interactionStatistic`
  where `interactionType` is `FollowAction`. It succeeded on 3 of 23 attempts across three sessions,
  because LinkedIn walls the profile fetch and then no post URL can be obtained at all. **A blank is
  a wall, not a negative.**

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
- **Notes ACTIVITY has a free route, and the file used to omit it entirely.** Two calls:
  `substack.com/api/v1/user/<handle>/public_profile` returns a numeric `id`, then
  `substack.com/api/v1/reader/feed/profile/<id>?types[]=note` returns each note with its date,
  reaction count and restack count. This is the only way to tell whether a big newsletter actually
  posts Notes, and newsletter size predicts that badly: Heather Cox Richardson has 3M+ subscribers
  and zero notes, Ethan Mollick has two, ever. Use it to decide whether an account is worth
  collecting from before spending time on it.

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
>
> Say this plainly rather than softening it: the Threads collector is **ready to run, which is not
> the same as verified working.** The login half follows the pattern three other platforms proved.
> The collection half has never seen a live logged-in Threads response, because no session existed
> when it was built.

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
- **How the saved session actually works, since nobody should have to read the code for this.**
  `npm run pull:login -- threads` opens a REAL headed Google Chrome window at threads.com and waits
  on the terminal while Muxin signs in by hand, 2FA and captcha included. The session is a
  persistent Chrome profile at `~/.content-agents/browser-profiles/threads`, chmod 700, outside the
  repo and never in git. No password is stored anywhere. Every later run is headless and reuses
  those cookies. When the session lapses the puller says `SESSION_EXPIRED` and names the re-login
  command rather than failing as a UI change. Add `--headed` to any run to watch it.
- **Without a login, the fediverse is the only route, and it resolves rarely.**
  `mastodon.social/api/v1/accounts/lookup?acct=<user>@threads.net` returns a federated Threads
  account's real display name, exact follower count, status count and last-post date. Fediverse
  sharing on Threads is **opt-in and rare**: 26 candidates checked here, 6 resolved. A miss is
  therefore **ambiguous, never an absence**. Do not record "not on Threads" from a fediverse miss.
- **`threads.com` verifies nothing on its own, and this is the loudest warning in the section.** It
  returns **HTTP 200 for any string, including nonsense**. A status code is never an existence
  check here, which matters because it looks exactly like a working one. The positive evidence that
  the login route is necessary rather than merely preferred: a logged-out `curl` of a real, active
  profile returns a ~262KB JavaScript shell with zero captions, zero `like_count` and zero
  `thread_items` in it.
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

- **Raw-retrieval verdict, corrected 2026-08-23. The old "needs the Phase 2 scraper" line was
  FALSE for profiles and TRUE for everything else.** Read the two halves separately.
  - **Profiles: WORKS.** A plain `curl` of `https://www.tiktok.com/@<handle>` returns the profile
    page with its own embedded JSON, carrying `uniqueId`, `nickname`, `followerCount`, `heartCount`
    and `videoCount`. This produced real numbers for 24 accounts here, including corrections to
    four figures that had been recorded from Wikipedia and creator websites. This is TikTok's own
    page, not a mirror, so the warning below does not touch it.
    **Anchor the read.** Take `followerCount` ONLY where it sits adjacent to the matching
    `"uniqueId"`. The first `followerCount` in the markup is often a different account's, and an
    unanchored read is how you record the wrong person's number.
  - **Per-video numbers and transcripts: UNCHANGED, still nothing.** Video permalinks time out and
    no transcript of any kind, spoken or written, comes back. Neither was re-checked on 2026-08-23,
    so this half stands as originally written. Individual TikTok videos still cannot be staged
    honestly from a fetch.
- **Third-party analytics mirrors are discovery leads only, and the standing ruling above does not
  license them.** Some of them do print a per-video view number, but that number is the
  aggregator's own computation, not what TikTok shows. Use such a mirror at most to notice which
  video is worth a look. **Never record its numbers into `metrics`.** A computed figure staged as a
  reading is the same class of error as a summarized body. The passthrough ruling covers routes
  that relay a platform's own response, which is not what these do.
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
- **Raw-retrieval verdict: genuinely minable, and the hole is closed (corrected 2026-08-23).** The
  watch page yields a real caption transcript, a real view count, and a real like count.
  **Subscriber counts ARE retrievable, on the `/about` page and only there.**
  `https://www.youtube.com/@<handle>/about` contains exactly one `"subscriberCountText"` string and
  it is the channel's own. This produced counts for 30 YouTube rows here. So `followers` is no
  longer null by default on a fetched YouTube entry, and the view-to-follower bar can run.
- **Keep the old trap warning, pointed at the right page.** The main channel page really is a trap
  and it is worse than a blank: *every* `subscriberCountText` in that markup belongs to a **sidebar
  recommendation**, so a naive first-match read records a different channel's number as this
  channel's. That is how the original "not retrievable" verdict was reached.
  **Safety rule:** if `/about` ever returns more than one `subscriberCountText`, treat it as
  ambiguous and record null rather than taking the first.
- **Never substitute a creator's website figure for a subscriber count.** Creator sites publish a
  cross-platform total audience number. That is not a per-platform follower count, and recording it
  as one quietly corrupts every ratio computed from it.
- **Fallback.** For the numbers, none needed. If `/about` is ambiguous or walled, either Muxin
  reads the rounded number off the channel page herself or `followers` stays null.
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

## reddit

Added 2026-08-23. Reddit scores in upvotes and exposes no follower concept on a post, so the
view-to-follower bar can never run here. Reddit entries are **baseline-multiple only**, which is
also why it is the platform where the denominator question got settled.

- **The real route is Reddit's own OAuth API, and it is already built.** `npm run patterns:reddit -- --sub r/ADHD`
  (see `src/patterns/reddit.ts`). It needs three keys in `.env`: `REDDIT_CLIENT_ID`,
  `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, minted as a "personal use script" app. Tokens come
  from `www.reddit.com/api/v1/access_token` and every read goes to `oauth.reddit.com`, which is the
  documented split. It returns bodies, scores, comment counts and dates, and it does return a
  subscriber count, which the credential-free routes do not.
- **It pulls TWO samples on purpose, and this is the important part.** The top-of-year winners
  become corpus entries. A separate **unbiased window of ordinary posts** never enters the corpus
  and instead produces one `AccountBaseline`. Each entry records which sample it came from in
  `sample.role`, so nothing downstream has to infer it.
  Why: the first reddit pass measured each collected post against its siblings, and every sibling
  was also a top-of-year post, so r/ADHD's biggest post of the year scored **2.2x**. Against the
  community's true median of 3 the same post is about **4095x**. That was not a small error, it was
  the wrong question. Any platform where you can measure an unselected window should get one.
- **Free fallback with no credentials: the RSS feed.** `www.reddit.com/r/<sub>/.rss`, and
  `www.reddit.com/r/<sub>/top/.rss?t=year` for top posts. The feed's own
  `<category label="r/Name">` confirms the community and its exact casing (r/yimby is lowercase).
  It carries **no subscriber count**, so a Reddit row collected this way is legitimately null there.
- **What is walled now (2026-08-23).** `about.json`, `api.reddit.com` and `old.reddit.com` all
  refuse a plain fetch. Do not spend time on them.
- **A wall is indistinguishable from a miss on the RSS route, and it rate-limits hard.** 14 of 39
  candidate subreddits could not be confirmed inside one run here, and three of those (r/LLMDevs,
  r/SideProject, r/ProductManagement) had confirmed cleanly an hour earlier. **An unconfirmed
  subreddit means nothing about the subreddit.** Never record it as not existing.
- **View counts?** No. Reddit shows no public per-post view number, so `views` is always null and
  the score lands in `metrics.likes`.

## Quick reference

This table is what a human can see in a browser. What a free `curl` actually returns is a narrower
question, and the scoreboard under the table answers that one.

| Platform | Public views? | Free sort route | Realistic denominator |
|---|---|---|---|
| x | yes | advanced search `from: min_faves:` | views / followers |
| linkedin | no | activity feed scroll (top sort unverified) | baseline multiple on likes |
| substack | no | archive `?sort=top` | baseline multiple on likes |
| bluesky | no | public API author feed, sort locally | baseline multiple on likes |
| threads | no (unverified) | none, scroll (puller takes an unselected recent window) | baseline multiple on likes |
| mastodon | no, by design | public API statuses, sort locally | baseline multiple on favourites |
| tiktok | yes, in a browser only | view counts printed on profile grid | views / followers |
| youtube | yes | Videos or Shorts tab, sort "Popular" | views / subscribers in a browser, baseline multiple when fetched |
| instagram | Reels only, in a browser only | Reels grid play counts | baseline multiple when fetched |
| reddit | no | OAuth API `top?t=year`, RSS `top/.rss?t=year` | baseline multiple on upvotes |

**Raw-retrieval scoreboard (updated 2026-08-23).** What a free fetch actually returned when each
line was last checked. Four lines changed on 2026-08-23 and the old versions of three of them had
already cost real time, because an agent trusted a stale "not retrievable" and did not retry a
route that works:

- **linkedin**: body, likes, comments, follower count, date. The ld+json route, the best surface
  here.
- **youtube**: body (a real caption transcript), views, likes. **Subscriber count too, from
  `/about` only** (corrected 2026-08-23; the channel page is a trap, see the youtube section).
- **substack**: body, likes, comments. No views ever. One publication's archive came back empty
  logged out.
- **bluesky**: body plus all four engagement counts, via the public API.
- **instagram**: written caption and follower count. No plays, no likes, no spoken transcript.
- **mastodon**: body, favourites, boosts, replies, via the public API. No views, by design.
- **threads**: logged out, nothing at all, just a ~262KB JavaScript shell. Logged in, via the
  saved-session puller (2026-08-23): body (the caption), likes, replies, reposts, follower count,
  date, media form and slide count. No views. **No carousel on-screen text, ever**, so every media
  post lands `body_is_complete: false` and its slides are downloaded for a human to read. Without a
  login, only the fediverse lookup, which resolved 6 of 26.
- **tiktok**: **profile page works** (corrected 2026-08-23): `uniqueId`, `nickname`,
  `followerCount`, `heartCount`, `videoCount` from its own embedded JSON, read anchored to the
  matching `uniqueId`. Per-video numbers and transcripts, still nothing.
- **x**: **profiles work** (corrected 2026-08-23): the page returns, `twitter:title` gives
  `Display Name (@handle) on X`, and a bad handle 404s, so handles are checkable. Follower counts
  come from the `api.fxtwitter.com` passthrough, never from x.com. **Bodies still nothing**: a
  279-character truncation on the syndication endpoint and no full-text field.
- **reddit**: OAuth API returns bodies, scores, comments, dates and a subscriber count. Credential-free,
  only the RSS feed, which carries no subscriber count and rate-limits hard enough that a wall reads
  as a miss. `about.json`, `api.reddit.com` and `old.reddit.com` are all walled.

`baselineMultiple` needs at least three other entries with a numeric `views` value for that
account before it will return anything. On the five platforms with no public views, that condition
can never be met from views alone, so those platforms lean on human judgment in `/patterns analyze`
plus whatever engagement numbers you did record. Say that to Muxin plainly when you collect there
instead of implying the scoring works the same everywhere.

Two platforms, x and tiktok, still have no honest free **body** route at all, and that is unchanged
by the 2026-08-23 profile corrections above. An empty entry count for either one is the correct
outcome, not a collection failure to work around. What changed is that their handles and follower
counts are now checkable, which is a different job from collecting their posts.
