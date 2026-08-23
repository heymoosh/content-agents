# Pattern mining: handoff

**Written 2026-08-23.** Everything a fresh session (Grok, Codex, or Claude) needs to continue
without re-deriving anything. Read this top to bottom before touching the branch.

## Where the work lives

- **Worktree:** `/private/tmp/claude/wt-mine`, branch `feat/pattern-corpus-v1`, 46 commits off
  `origin/main` at `cf5f559`. **Not pushed. No PR opened.**
- **Tests:** 2102 passing, 0 failing. Run them **unsandboxed** (`npm test`). Under the sandbox
  ~196 `src/venture/*` tests fail spuriously and are not real failures.
- **A fresh worktree has no `node_modules`.** Run `npm run worktree:setup` once before testing.
- `data/` is gitignored by design. Other creators' post text never enters git. Only distilled
  patterns are committed.

## What this branch does

Finds what already works in Muxin's niches on each platform and turns it into reusable structures.
Two halves: **collect** other creators' winners into a local corpus, then **distill** them into
`.claude/skills/atomize/references/{hook-patterns,post-patterns}.md`, which `/atomize` reads when
drafting.

Her niches, her words: *"using AI, product thinking, and an ADHD brain to build a business solving
for real social problems. I care about civic work. I'm a solopreneur building with AI. I have
ADHD."* Plus generally-viral content whose STRUCTURE transfers.

## Current state

- **269 accounts** across 14 platforms. 211 with a follower count read off the platform itself.
- **292 posts** in `data/patterns/corpus.jsonl`, 132 admitted as pattern evidence.
- **Only 61 of 269 accounts have any mined content.** The rest are verified and seeded but
  uncollected. That is the single biggest gap.
- 31 hook patterns, 47 post-pattern records, every one carrying a `Reach behind it` line.

Collectors built and committed: `src/patterns/{reddit,reddit-rss,instagram,pinterest,youtube,
youtube-transcript}.ts`, `src/pull/platforms/threads.ts`, plus `baselines.ts` and `era.ts`.

## Commands

```
npm run patterns:collect                      # validate an inbox file into the corpus
npm run patterns:outliers                     # score the corpus
npm run patterns:reddit -- --sub r/ADHD       # needs REDDIT_ keys (Muxin declined these)
npm run patterns:reddit-rss -- --feeds <dir>  # no credentials, works today (bodies, no numbers)
npm run patterns:reddit-backfill -- --staged <inbox.json> --measurements data/patterns/browser
bash scripts/reddit-rss-fetch.sh <dir> ADHD civictech ...   # paced RSS fetch, 45s apart
npm run patterns:youtube -- --backfill        # transcripts, works today
npm run patterns:pinterest -- --all           # no credentials, works today
npm run patterns:instagram -- --smoke         # needs IG_GRAPH_ keys
npm run pull:login -- threads                 # one-time human login
```

## Blocked on Muxin, not on code

| Item | State |
|---|---|
| Reddit API key | **Declined.** Use the browser or RSS route instead. |
| Instagram `IG_GRAPH_ACCESS_TOKEN`, `IG_GRAPH_USER_ID` | Not set. `.env.example` has the full walkthrough. |
| Threads login | Not run. Field names are UNVERIFIED; expect `UI_CHANGED` on the first run and read the payload dump it names. |
| PR #358 `feat/patterns-auto-collect` | **Merge it FIRST, then rebase this branch.** It is the recurring half (weekly cron, `discover.ts`, a `collectors/` registry) that this branch never built. It renames `targets` to `analysis_sample` and our `collect.ts` reads the old field, so whoever merges second eats that compile error. Only 7 files overlap. |

## In flight when this was written

- `reddit-browser`: FINISHED its pass and stopped cleanly. See "Reddit collection state" below for
  exactly what is collected and what is not. Nothing is mid-flight and no browser tab is left open.
- `top-creators`: finding top creators all-time per niche, and flagging music/entertainment
  accounts already seeded under `general-viral` for removal.

Both write to `data/patterns/` and report rather than merging. Check `git log` for what landed.

## Non-negotiable rules, every one learned by breaking it

1. **NEVER use WebFetch or Exa or any model-backed fetch for post content.** WebFetch once
   returned a different person's comment as the author's post with attribution stripped and
   silently rewrote 14 of 15 bodies. Exa returned YouTube transcripts truncated mid-sentence and
   corrupted 3 entries. Raw curl, yt-dlp, or a real browser reading DOM text verbatim. Reading a
   DOM node's text is fine; asking a model what a page said is not.
2. **Never compute a multiple against a search-discovered sample.** Comparing winners to winners
   rated r/ADHD's best post of the year at 2.2x when the truth against a real community median is
   4094x. Three orders of magnitude. Always collect an unselected window for the denominator.
3. **`body_is_complete` is the most important field.** False means the substance was NOT collected.
   Never let a caption, a title, or an SEO description stand in for it. Three platforms hide their
   substance in images: Threads carousels, Instagram, and Pinterest, whose `headline` is an
   SEO title that often does not match the words on the graphic at all.
4. **Rule 1 (CLAUDE.md): never reuse a creator's wording.** Templates describe a MECHANISM; they
   never supply the creator's sentence with their nouns bracketed out. Single-sighting patterns are
   presumptively contaminated: 15 of 17 violations came from n=1 records. Verify by n-gram over the
   WHOLE file including beats and Structure prose, not by scanning quoted strings. Bar is zero at
   7-grams.
5. **No em dashes anywhere** (CLAUDE.md rule 5), code comments included.
6. **Follower counts:** never from a creator's own website. Seven were wrong that way; one moved
   DOWN when re-read, which proves those sites publish cross-platform totals. `api.fxtwitter.com`
   is allowed for X as a passthrough with an inline provenance note. A blank is not one thing: no
   follower concept, a walled fetch, and a refused implausible figure are three different states.
7. **A follower count is the only reliable impostor check.** Six accounts were caught fake or
   unusable; two had metadata titles matching the real creator EXACTLY.
8. **Shared worktree:** stage by EXPLICIT PATH only, never `git add -A`. An index race already
   tangled two agents' commits.

## Platform routes that work, and the traps

- **Reddit:** `.json` endpoints are blocked even in a logged-in browser. The HTML page works:
  `shreddit-post` elements carry `score`, `comment-count`, `post-type`, `upvote-ratio`,
  `flair-text` as attributes. Reddit serves a JS challenge only a real browser solves, which is why
  scripted Chrome gets 403. **The listing does NOT lazy-load on scroll**: the loader is
  `loading="programmatic"` and only fires when `loadContent()` is called. RSS
  (`/top/.rss?t=year`) works with no credentials but publishes no scores; pace at 45s.
- **YouTube:** transcripts are SOLVED. Subscriber count comes from the page header
  (`"content":"<n> subscribers"`), **never** `/about`'s `subscriberCountText`, which on
  `@aliabdaal/about` carried four values, all sidebar recommendations, none his.
- **TikTok:** profile pages work. The profile blob's `"id"` is the USER id, not a video id; using
  it returns `10204 item doesn't exist`. **TikTok collection code was never committed** and must
  be rewritten.
- **Pinterest:** `data-test-id="leaf-snippet"`, not `id=`. Follower fallback is
  `__PWS_INITIAL_PROPS__`, not `__PWS_DATA__` (which is an 82KB config blob with no user data).
  Saves are a global cross-copy aggregate; `repinCount` is this copy's own.
- **HTTP 200 means nothing** on Pinterest, Threads, and Reddit alike. Nonexistent boards and
  handles all return 200 with empty payloads.

## Corrections landed after this doc was first written

**The Exa contamination scare was WRONG, and this reversal must not get re-litigated.** Three
YouTube entries were flagged as corrupted by the Exa page-fetch API, one supposedly "truncated
mid-sentence at 'separate work and'". They were re-collected with yt-dlp and **11 model-fetched
bodies matched YouTube's own caption files word for word.** Zero were replaced because zero were
wrong. The "truncation" is YouTube's own ASR track ending there on a 49-second video with 100%
coverage. A second flagged entry is a genuine 24-second teaser. This exonerates those specific
fetches, NOT the tool class: the ban stands on the real incident where 14 of 15 bodies were
rewritten and a stranger's comment was attributed to the author.

**YouTube transcripts are solved by yt-dlp, and it is a passthrough by construction.** It runs no
speech recognition of its own; it performs YouTube's player handshake, mints the proof-of-origin
token, and downloads the caption file YouTube itself serves. Same category as the fxtwitter
passthrough. Install with `brew install yt-dlp`; the collector stops with an install message rather
than recording empty transcripts if the binary is missing. Collection IS scriptable and cron-safe,
roughly 2 to 3 minutes for 24 videos, no browser required.

**A bug that only long videos could surface, found by asking for a long-video test.** Nothing in
the corpus is longer than 159 seconds, so any length-dependent failure was structurally invisible.
Testing a 2h49m video proved no truncation (11,101 caption events, 100% coverage). Testing a 15m33s
one exposed the real bug: it carries a HUMAN-authored en-GB track that YouTube publishes as **VTT
with no json3 at all**, and the collector asked only for json3 then refused the file it had just
downloaded. It was pointed at precisely the wrong tracks: ASR gets json3 and sails through, while a
human track, the only kind whose wording may ever be quoted as the creator's own, was dropped.
Fixed in `1ebadab`. **All 24 collected entries are ASR with json3 and were unaffected.**

**Two YouTube route traps, both nasty.** On a search result's `channelRenderer` the field names are
swapped against their contents: `subscriberCountText` holds the HANDLE and `videoCountText` holds
the subscriber count. And `?sort=p` on `/videos` is silently IGNORED; Popular is only reachable by
posting the sort chip's continuation token to `/youtubei/v1/browse`. Some channels are never
offered the sort at all.

**Instagram's plain profile curl is now WALLED** (login shell, zero follower fields). The working
first-party route is `https://www.instagram.com/api/v1/users/web_profile_info/?username=<h>` with
header `X-IG-App-ID: 936619743392459`, reading `data.user.edge_followed_by.count`. Confirmed on
`@adhd_love_` at 1,381,663. Any reference saying the profile page is curl-retrievable is stale.

**The YouTube /about four-value trap is intermittent.** It did not reproduce on a later day; header
and /about both returned exactly one value on `@aliabdaal` and `@veritasium`. Keep the
more-than-one-candidate-means-null rule as a guard, since the failure was real once and the guard
is cheap.

## Open decisions

1. **3 Exa-contaminated YouTube entries** were re-collected properly, so this may be resolved.
   Verify `transcript_source` and the notes on the `@aliabdaal` and `DanKoeTalks` entries.
2. **Pinterest OCR.** `media.asset_url` is populated and verified live. `onscreen_text` is a claim
   of EXACT WORDS that remix mode copies verbatim under Muxin's byline, so a low-confidence read
   must stay null. ~310-370 pre-2020 images. Claude vision on the subscription is the $0 route.
3. **Music/entertainment accounts** seeded under `general-viral` (cristiano, selenagomez, therock,
   kyliejenner, mrbeast, zachking) are the wrong kind of big. Muxin has said to ignore them.
4. **Instagram admitted 0 of 13** posts, all body-incomplete, despite the highest median engagement
   in the corpus (32,596). Credentials fix this.

## This branch is a HELD draft PR

It changes `/atomize` drafting inputs, which is content-generation logic under CLAUDE.md rule 7, so
it must open as a **draft PR with old-vs-new content samples**, never auto-merge. A drafted PR body
with real before/after samples is at the session scratchpad's `pr-body.md`.

## Reddit collection state, exactly

### Is the staged file ready to collect? Yes. It has NOT been run.

`data/patterns/inbox/reddit-rss-top-year-2026-08-23.json` holds **225 entries, 25 from each of 9
subreddits, and every one carries a real upvote count, comment count and upvote ratio.** No entry
is left with null metrics. All 225 pass `validateEntry` with zero errors, and 18 of them dedupe
against posts already in the corpus, so a collect run appends about 207.

Nobody has run `npm run patterns:collect` on it. That was deliberate, not an oversight: the file
was left for a human to admit, and admitting it is now safe because the scores are in. **A fresh
session may run `npm run patterns:collect` on it.**

Do NOT re-run `npm run patterns:reddit-rss` before collecting unless you also re-run the backfill.
Re-staging regenerates the entries with null metrics, and the numbers only come back by running:

```
npm run patterns:reddit-backfill -- --staged <inbox.json> --measurements data/patterns/browser
```

That command is idempotent. Running it twice corrects numbers in place rather than stacking a
second provenance paragraph, which it did do before it was fixed.

### Collected, per subreddit

Top-of-year, 25 posts each, bodies plus real numbers, all staged: **r/ADHD, r/civictech,
r/Entrepreneur, r/SideProject, r/ClaudeAI, r/LocalLLaMA, r/microsaas, r/YouShouldKnow,
r/LifeProTips.** That is all 9 of the priority list.

| community | top post | median of its top 25 | measured baseline | multiple |
|---|---|---|---|---|
| r/LifeProTips | 42,483 | 12,306 | not measured | 61x, hand-lifted median 691 |
| r/YouShouldKnow | 33,892 | 10,247 | not measured | none, no baseline exists |
| r/ClaudeAI | 20,419 | 6,892 | not measured | 10,210x, hand-lifted median 2 |
| r/ADHD | 12,283 | 4,583 | **3, n=192** | **4,094x, measured** |
| r/SideProject | 5,778 | 2,326 | not measured | 5,778x, hand-lifted median 1 |
| r/LocalLLaMA | 5,150 | 3,279 | not measured | none, no baseline exists |
| r/Entrepreneur | 3,968 | 932 | not measured | none, no baseline exists |
| r/microsaas | 806 | 331 | not measured | none, no baseline exists |
| r/civictech | 27 | 12 | not measured | 7x, hand-lifted median 4 |

**Only r/ADHD's baseline was measured in this pass.** 453 posts loaded off `/new`, filtered to the
192 at least 3 days old, stickied and pinned excluded, no filter on score or topic. True median 3
upvotes, which is what the hand pass got on 163 posts five months earlier. Every other multiple in
that table divides by a hand-lifted median and is provisional until re-measured the same way. Four
communities have no baseline at all and were given no multiple.

Raw scores for that window are in `data/patterns/browser/adhd-new-baseline.txt`, all 192
`score,comment` pairs, so the median can be rechecked without recollecting.

### Not collected, in priority order for whoever picks this up

1. **`/new` baselines for the other 8.** This is the gating item for honest multiples and the only
   reason four communities above have no number at all. Expensive: r/ADHD needed 453 posts loaded
   to yield 192 settled because it publishes about 100 a day. Quieter subs settle far cheaper.
   100+ settled posts is plenty for a median; cap the window and record the size on the baseline
   rather than grinding for more.
2. **`/top/?t=all` for the other 8.** Collected for r/ADHD only, where it produced one of the two
   headline findings. Worth checking whether the disjointness generalises: if some communities are
   era-stable and others are not, that split is itself the finding.
3. `top/.rss?t=all` returns HTTP 200 and 101KB for r/ADHD, so all-time bodies are available the
   same way top-year bodies were. **The join was never actually run on that side.** Verify it
   before trusting it.

### The body-join design, so nobody pulls bodies through the browser

Two routes, each supplying only what it is good at, joined on the post id:

- **RSS supplies the full text.** `www.reddit.com/r/<sub>/top/.rss?t=year`, fetched with curl
  straight to disk. Carries titles, bodies, authors, dates and Reddit's own ordering. No numbers.
- **The browser supplies compact numbers only.** `score`, `comment-count`, `upvote-ratio`,
  `post-type`, `flair-text`, read off `shreddit-post` attributes.

**Do not try to pull post bodies through `javascript_tool`.** The tool result truncates at roughly
1,100 characters. One subreddit's top 103 posts is about 107KB of body text, so that route would
take hundreds of calls and was abandoned after measuring it. Numbers are small enough to come back
in two slices of 13 rows per listing.

The join key is the base36 post id, which RSS publishes in `<id>t3_xxxxxxx</id>`, the browser
reports as the element id, and the corpus url contains after `/comments/`. **Never join on the url
string**, since RSS gives `www.reddit.com` and the corpus stores `old.reddit.com`. Measured result:
225 of 225 matched, zero misses, across all 9 communities.

Neither side passes post text through a model-read channel, and the join is exact rather than
fuzzy. That is the property worth preserving if this gets rebuilt.

### Pacing and cost, so the remaining work can be sized

- **RSS:** 45s between feeds, exponential backoff from 60s on each HTTP 429, doubling, capped at
  480s, 6 attempts per feed. All 9 retrieved. At least one needed a backoff retry. Reddit
  rate-limits this surface hard; do not lower the 45s without re-measuring.
  `scripts/reddit-rss-fetch.sh` does this.
- **Browser:** about 4 calls per subreddit for a top window (navigate, unlock plus rows 1 to 13,
  rows 14 to 25). r/ADHD's full pass including both windows and the `/new` baseline took about 18
  calls. The `/new` baseline dominates the cost everywhere.
- Pagination advances about 25 posts per `loadContent()` call, roughly 2.2s each: 3, 28, 53, 78,
  103. Keep any in-page loop under about 6 rounds; the CDP call times out at 45s.

### Subscriber count is NOT available on this route. Do not re-attempt it.

It is not an attribute on any element, no "N members" string appears in the listing page text, and
`about.json` is walled like every other `.json` route. `followers` is null on all 225 reddit
entries, which matches every reddit row in `config/pattern-mining.yaml`. It was not parsed out of
the feed subtitle's marketing prose, which really does say "nearly two million users" for r/ADHD.
Reddit is post-ranked rather than follower-ranked, so the community median is the denominator that
matters and it does not need a subscriber count.

### One open judgment call, deliberately not decided

**18 of the 225 entries have a form disagreement** between the RSS feed and the rendered page. The
page reports a vocabulary the feed cannot express (`multi_media`, `crosspost`), so 16 posts the
feed called `text-only` the page calls `multi_media`. Neither side was overwritten: the recorded
form keeps the method that produced it, and `npm run patterns:reddit-backfill` prints every
disagreement by id for a human to settle. The rendered page is probably the more accurate source,
because the feed infers form from its `[link]` anchor and that misses posts with inline media, but
that is a judgment nobody has made yet.

## Findings worth keeping

**r/civictech is the best topical fit and has essentially no reach, and these two facts do not
  cancel.** Its top-of-year list is almost wall-to-wall "I built a free tool to track your
  representatives", the closest topical match to Muxin's work anywhere in this corpus. **Its top
  post of the entire year is 27 upvotes. Its median top-25 post is 12.** By contrast r/LifeProTips
  tops out at 42,483 and r/YouShouldKnow at 33,892, roughly 1,500x larger, both pure text, both
  rewarding exactly the shape she already writes: a titled, self-contained useful claim. **The
  civic audience is not on r/civictech at any scale worth posting for; it is inside the general
  advice subs, where a civic tip competes as a tip.** An earlier draft of this doc recommended
  r/civictech on topical fit alone, before anyone had measured its reach. That recommendation is
  withdrawn.
- **The asymmetry is what makes Reddit worth posting to at zero followers.** r/ADHD's top-of-year
  is 4,094x its own community median of 3, reproduced from a fresh 192-post sample five months
  after the hand pass got the same median. r/civictech's is 7x. A 4,094x number is not "this post
  is great", it is a community where almost everything gets 1 to 3 upvotes and a handful escape.
  That is invisible without an unselected /new sample, which is the whole argument for collecting
  one.
- **Reddit top-25 by community** (top post / median of its top 25): LifeProTips 42,483 / 12,306.
  YouShouldKnow 33,892 / 10,247. ClaudeAI 20,419 / 6,892. ADHD 12,283 / 4,583. SideProject
  5,778 / 2,326. LocalLLaMA 5,150 / 3,279. Entrepreneur 3,968 / 932. microsaas 806 / 331.
  civictech 27 / 12.
- **Reddit pagination does NOT respond to scrolling.** The loader is
  `<faceplate-partial loading="programmatic">`, so it never fires on scroll or intersection. Call
  `loadContent()` on the last partial; it advances 3 to 28 to 53 to 78 to 103 at about 2.2s a
  round. Scrolling 40 times leaves you at 3 posts.
- **Civic artifacts beat civic arguments** everywhere an honest baseline exists. A petition at 205x
  and an open-source deliberation tool at 114x on HN. Nobody appended an ask to an opinion; they
  shipped the thing and the shipping was the post.
- **Format is decided by the subreddit, not the topic.** r/Entrepreneur is 25 of 25 text; its niche
  twin r/SideProject is 25 of 25 video or image with NOT ONE body.
- **All-time and top-of-year are nearly disjoint on Reddit.** Only 1 of 25 r/ADHD posts appears in
  both; 17 of the all-time top 25 are from 2020-2021. Writing to the all-time list is writing for
  2021.
- **Completable CTAs do not correlate with reach** (2.31x vs 2.38x). The civic rubric stays anyway:
  it exists so a persuaded reader has somewhere to go. Reach and consequence are different
  outcomes.
- **Withdrawn claims, do not resurrect:** "winners are shorter" (coin flip at n=292) and "images
  beat text-only" (the comparison groups crossed once the sample grew).

## Related docs

- `docs/pattern-mining-plan.md`: the original captured request.
- `.claude/skills/patterns/SKILL.md`: the 8 modes.
- `.claude/skills/patterns/references/platform-collection.md`: per-platform routes, corrected
  2026-08-23. Its "Follower and audience counts, in one place" section exists because a correct
  route filed in the wrong section is functionally undocumented.
