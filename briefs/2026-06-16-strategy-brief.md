# Strategy Brief: 2026-06-16
data_window: 2025-06-17 → 2026-06-16

First real brief. No prior cycle to grade, so there is no scorecard yet. This one sets the
baseline and places the first bets. All four channels are now in: LinkedIn was re-ingested with
per-post engagement (a first-pass blind spot), and Bluesky was pulled via the API.

## Data confidence

| Channel | Posts | Weeks of data | Status |
|---|---|---|---|
| bluesky | 59 | 25 | OK |
| linkedin | 50 | 52 | OK |
| substack | 6 | 52 | OK |
| x | 169 | 12 | OK |

All four channels clear the 4-week bar. One scale caveat runs through everything below: LinkedIn
reports ONE lumped "Engagements" count per post (reactions, comments, reposts, clicks together),
while X and Bluesky give a weighted reply/repost/like score (and Bluesky exposes no impressions at
all, only engagement). The scales are not comparable in absolute terms, so read each platform on
its own, never across.

## Channel performance snapshot

| Channel | Posts | Reach | Engagement | Audience / growth |
|---|---|---|---|---|
| linkedin | 50 | ~671 impressions/post | 744 lumped (top post 122) | 2,300 followers, +612/yr |
| substack | 6 | 424 views/yr (dashboard) | opens climbing, +1,530%/yr | 34 subs, +1,033%/yr |
| bluesky | 59 | not exposed by API | 27 likes, 26 replies, 2 reposts | 33 followers |
| x | 169 | ~196 impressions/post | 98 likes, 38 replies, 1 repost | +13 followers |

- **LinkedIn is the strongest channel on every axis we can measure, per post.** ~671 impressions
  and ~15 engagements per post, a 2.2% engagement rate, and +612 followers over the year. LinkedIn
  lumps engagement (reactions, comments, reposts, clicks), so read the per-post number as "total
  interactions," not likes.
- **Substack is small in absolute terms but accelerating hardest, and the export badly undercounts
  it.** Live dashboard: 34 subscribers, up from 3 a year ago (+1,033%), and 424 views over the
  year, up from 26 (+1,530%), steepening in the last six weeks. Innovation Nation is the biggest
  post yet. Caveat: the export carries email deliver/open events only, so the DB shows ~37
  "impressions" (delivered emails) against the dashboard's 424 actual views. Trust the dashboard
  for Substack, not the DB. Notes have no export at all (Muxin reports strong Notes engagement on
  AI-and-society, the human-ai pillar), so log those by hand in community-log.md.
- **Bluesky is small but the most conversational channel per post.** 33 followers, but 26 replies
  across 59 posts (0.44 per post, double X's 0.22) and ~1.85 weighted engagement per post, above
  X. Bluesky exposes no impression counts, so engagement is the only signal, and it is real
  back-and-forth. It is where on-topic posts actually get replies.
- **X is high reach-volume but low engagement per post.** 169 posts, ~196 impressions and ~1.3
  weighted engagements per post, roughly a 0.5% engagement rate, +13 followers. It is reach without
  much engagement. Muxin posts 3x more here than on LinkedIn for a fraction of the return per post.

## Topic resonance map

Six pillars now (career-work and builder were split out of "other" on 2026-06-16, see the pillar
note below the table).

| Pillar | bluesky (weighted) | linkedin (lumped) | substack | x (weighted) |
|---|---|---|---|---|
| human-ai | **2.4 · n=10 · 7r** | 7.3 · n=9 | 0.0 · n=2 | 1.4 · n=65 · 14r |
| claude-code | 0.5 · n=2 (anecdote) | 12.9 · n=15 | 0.0 · n=3 | **1.5 · n=46 · 14r** |
| civic-tech | **1.9 · n=22 · 9r** | 11.5 · n=2 (anecdote) | - | 1.7 · n=6 · 2r |
| career-work | - | **15.6 · n=8** | - | 1.3 · n=7 · 2r |
| builder | 0.0 · n=2 | 8.5 · n=6 | 0.0 · n=1 | **1.7 · n=10 · 4r** |
| other | 1.8 · n=23 · 10r | 28.6 · n=10 | - | 0.6 · n=35 · 2r |

Read each column on its own scale. LinkedIn numbers are an order of magnitude larger because they
are lumped totals, not because LinkedIn "wins." Substack shows 0 because that export has no
engagement events (see the channel note).

**Pillar note:** "other" used to be a catch-all and the top LinkedIn engager (19.3). Clustering it
showed a real pillar hiding inside: **career-work** (job hunting, recruiting, future of work),
which on its own tops LinkedIn at 15.6, ahead of claude-code (12.9) and human-ai (7.3). A second
split, **builder** (build-in-public + PM craft), came out too. What is LEFT in "other" is now
purely personal and episodic (the LinkedIn 28.6 is the one "I've been selected" brag and friends,
not a content stream you can produce on purpose).

- **Each platform rewards a different facet of your work.** This is the headline finding.
  - **Bluesky: human-ai leads (2.4), then civic (1.9), both beating personal.** A small but
    genuinely AI-and-society and civic room. It rewards exactly the human-ai content LinkedIn is
    lukewarm on.
  - **LinkedIn: career and builder content win (career-work 15.6, claude-code 12.9, builder 8.5);
    human-ai is weakest (7.3).** A PM and founder audience wants careers and product craft, not
    values. This is why the Innovation Nation LinkedIn post was re-cut to lead with the PM angle.
  - **X: builder edges ahead (1.7 with 4 replies), on-topic beats personal, but all of it is
    faint** because total X engagement is so low. Personal "other" is now the clear bottom (0.6).
  - **Substack and its Notes: human-ai / AI-and-society lands** (qualitative, since Notes have no
    export).

## Audience (who you're reaching)

| Platform | Followers/subs | Recent net growth | Demographics |
|---|---|---|---|
| linkedin | 2,300 | +612 | yes |
| bluesky | 33 | - | none |
| substack | 34 | +31 / yr | tier only |

LinkedIn demographics: **Senior 38%, Director 15%**, by title **Product Manager 6%, Founder 6%,
Co-Founder 4%, Director of PM 2%**, in Technology / Software / IT, concentrated in Houston (18%),
SF Bay (14%), and NYC (6%).

The LinkedIn audience and its engagement data agree: a room of PMs and founders rewards builder
content (claude-code 12.9) and is lukewarm on values (human-ai 7.3). Bluesky (33) and Substack
(34) are small audiences, anecdotal on demographics, but both are on-pillar rooms where human-ai
and AI-and-society land. So human-ai has a clear home (Bluesky and Substack), and the builder
angle has a clear home (LinkedIn).

## Routing map (what to post where)

| Pillar | bluesky | community:democratic-resilience | linkedin | x |
|---|---|---|---|---|
| human-ai | include | - | include | include |
| claude-code | include | - | include | include |
| civic-tech | include | include | skip | include |
| career-work | skip | - | include | include |
| builder | skip | - | include | include |
| other | include | - | include | include |

Routing scores each pillar against its OWN platform's average post (fit = pillar avg / platform
norm), not against the best platform across the board. That fix was necessary: with LinkedIn's
lumped counts in the data, the old cross-platform comparison wrongly skipped X for every pillar.
Fixed in route.ts. Current reads: Bluesky and X `include` for everything (Bluesky for real
conversation, X for reach), LinkedIn `include` for human-ai (0.49× norm) and claude-code (0.87×
norm), civic-tech on LinkedIn `skip` (only n=2, cold-start). The map is sound.

## Community signals

`community-log.md` has only the seed example entry (democratic-resilience, "action-oriented posts
beat general civic commentary"). That is a real prior worth keeping, but it is one note, not data.
The single highest-leverage habit this cycle is logging a 30-second observation after each
community post, because these rooms have no API and the log is the only signal they will give. Add
Substack Notes wins to that log too, since they are equally invisible to the pipeline.

## How much to trust this (read before hardening anything)

This is the first brief, built on observational data from organic posting, not a designed test.
Hold it loosely. The pillar-by-platform sample sizes are lopsided because they reflect what Muxin
happened to post, not balanced coverage:

| Pillar | bluesky | linkedin | substack | x |
|---|---|---|---|---|
| human-ai | 10 | 9 | 2 | 65 |
| claude-code | 2 | 15 | 3 | 46 |
| civic-tech | 22 | 2 | 0 | 6 |
| career-work | 0 | 8 | 0 | 7 |
| builder | 2 | 6 | 1 | 10 |
| other | 23 | 10 | 0 | 35 |

Cells under ~10 are directional at best; under 3 are noise. The two newest pillars (career-work,
builder) are deliberately small splits to START measuring them; they are tests, not findings. Absence of data is NOT evidence of
poor fit (we have not tested civic on LinkedIn, there are just 2 posts there). Metrics are also
noisy and one-time: a single viral post swings an average (a quarter of LinkedIn's "other" 19.3 is
one brag), X has only 12 weeks, and Substack is confounded by list growth.

The ONE thing solid enough to lean on now: **LinkedIn rewards builder/product content over values**
(claude-code 12.9 vs human-ai 7.3, and the PM/founder demographics agree, two independent signals).
Everything else here, including human-ai's home on Bluesky/Substack and whether civic travels past
Bluesky, is a hypothesis, not a finding. The strategy is built to NOT harden: routing cold-starts
broad and tightens only as data lands, and every recommendation below is a bet graded next cycle.
To firm this up, deliberately fill the empty cells (post each pillar across platforms) and re-grade;
trust a cell at roughly n>=15 holding across 2+ cycles. Until then, keep posting broadly.

## Recommendations

1. **[DO MORE] LinkedIn, in the builder and PM register.** Strongest channel on reach, engagement,
   and follower growth, and builder content (claude-code 12.9/post) beats values framing (human-ai
   7.3/post) with a PM-and-founder audience. Frame human-ai essays through product work, as the
   re-cut LinkedIn post does.
2. **[DO MORE] Human-ai on Bluesky and Substack, the rooms that actually want it.** human-ai leads
   on Bluesky (2.4, the top pillar there) and lands on Substack and its Notes. These audiences are
   small but on-pillar and growing, and Bluesky gets double X's reply rate. This is where the
   values and AI-and-society writing belongs.
3. **[RETHINK] X: reach only, on-pillar, not personal.** Muxin posts 3x more on X than LinkedIn
   for ~1 interaction per post, and Bluesky out-converses it at a fraction of the follower count.
   Treat X as a distribution net, keep it on-topic (no personal posts, per Muxin), and move the
   on-topic conversational energy to Bluesky and LinkedIn.

Feed all of it into Substack subscribers (34 and climbing fast). That owned list is the funnel
goal, which is why every post's CTA points to the live essay.

The first-pass actions are done: the LinkedIn export was re-pulled and the parser fixed to score
its lumped engagement; routing was fixed to compare platforms on their own scales; and Bluesky was
pulled via the API and tagged.

## Directives for atomization
- prioritize_pillar: human-ai
- channel_emphasis: linkedin in the builder/PM register (strongest engagement); bluesky + substack for human-ai and AI-and-society (the rooms that want it); community for civic; x for reach only, on-pillar, never personal
- format_notes: "On X, lead with the contrarian or source-cited take; short single posts beat broadcast aphorisms. On LinkedIn, open on product/builder craft, not philosophy. On Bluesky, human-ai and civic threads earn replies."
- hooks_that_worked: ["CMV: Product management is actually an", "This is supported by the work of Nobel laureates Acemoglu and Johnson", "how i failed to build a simple hackathon", "Someone explain to me why we believe capitalism in America only works when"]
