# Strategy Brief: 2026-08-18
data_window: earliest post per channel (LinkedIn ~111 weeks, X ~21 weeks, Bluesky ~35 weeks,
Substack ~61 weeks, Substack Notes ~11 weeks — see Data confidence) → 2026-08-18

Eighth cycle, and the biggest gap since the last one: the prior brief is from 2026-06-24, almost
eight weeks ago. Two things changed in that gap that matter more than any single metric below.
First, the publishing freeze (measurement scaffolding) ran 2026-07-04 to 2026-07-08, then lifted.
Second, and this is the real finding of this brief: **the `/atomize` → `/publish` pipeline has
barely been used since it lifted.** The last pipeline-placed post was 2026-07-10 — one post, one
day after the freeze ended. Everything since (six-plus weeks, over 300 posts across X, Bluesky,
and LinkedIn) has been posted natively, not through this system. `tag-source` confirms it: 36
atomized posts total in the whole account history, 440 organic. That's not a content problem, it's
a usage problem, and it caps how much this brief's per-lever signal can even tell you, since most
of the levers this system built are measuring recommendations for a pipeline that isn't currently
running.

## Last cycle scorecard

Note on method: `npm run grade-bets` measures bets via `posts.bet_id` — a link that only exists
for posts placed through `/publish`. All five open/carried bets below are aggregate cross-post
comparisons (not tied to one atomize batch), so `grade-bets` correctly showed n=0 for every one of
them; that isn't a real signal, it's the wrong measurement path for this bet shape. Graded these
by hand against this cycle's resonance/origin-compare/platform-fit tables instead, the same way the
2026-06-24 brief graded the first four.

| Bet | Type | Claim | Numbers now | Verdict | New status |
|---|---|---|---|---|---|
| 2026-06-16-002 | TEST | civic-tech is a real X performer (n≥10, avg≥1.3) | civic-tech/X: avg 1.8, n=8 — same n=8 as eight weeks ago | stalled, not failed | carried, flagged |
| 2026-06-16-003 | DO_LESS | Cutting 'other' on X lifts overall X engagement | 'other' share crept back up to 28% (was 23% last cycle); overall X avg 1.24, still under the 1.3 floor | failed twice now | **retired** |
| 2026-06-24-001 | DO_MORE | Notes out-engage essays by multiples (≥5 avg, ≥3x essays) | notes avg 10.6 (rc 10.6), n=32; essays avg 10.9 (rc 14.3), n=10 — notes and essays are statistically even, essays' recent trend is if anything stronger | **failed** | retired |
| 2026-06-24-002 | TEST | Atomized posts out-engage organic on X (atomized n≥10) | atomized X avg 3.1, n=15; organic X avg 1.1, n=236 | **passed** | confirmed |
| 2026-06-24-003 | DO_LESS | human-ai essays underperform on LinkedIn (confirm at atomized n≥5) | atomized human-ai LinkedIn avg 0.0, n=4 — one post short of the n≥5 bar to confirm, but the gap (0.0 vs organic 4.4) is stark | trending hard, not yet confirmable | carried |

What we learned: the one clean win is that atomizing still works when you actually do it — X
atomized posts pull nearly 3x organic (3.1 vs 1.1). The uncomfortable finding is Notes: the
standing assumption baked into this whole pipeline (Notes are the highest-engagement surface) does
not hold up against a fuller sample — essays and Notes are now roughly tied, and essays are
trending better, not worse. That's worth internalizing before writing off long-form. X's structural
ceiling is now a two-strikes finding, not a one-off: mix-tidying does not move the needle, so retire
that thread instead of carrying it a third time. Civic-tech on X isn't failing, it's stuck: zero new
civic-tech X posts landed in eight weeks, so the sample can't grow on its own.

## Data confidence

| Channel | Posts | Weeks of data | Status |
|---|---|---|---|
| bluesky | 95 | 35 | OK |
| linkedin | 87 | 111 | OK |
| substack | 10 | 61 | OK |
| substack-note | 32 | 11 | OK |
| x | 252 | 21 | OK |

All five channels clear OK confidence now — genuinely new since last cycle, when nothing was
flagged INSUFFICIENT either, but the underlying volume has grown meaningfully (X alone: 184→252
posts). Read LinkedIn on its own scale (one lumped "Engagements" count) vs X/Bluesky's weighted
reply/repost/like score — never compare the raw numbers across platforms directly.

## Channel performance snapshot

- **X (252 posts):** avg engagement 1.24 — still the account's lowest-engagement channel by a wide
  margin, and it hasn't moved in eight weeks despite the mix-cleanup bet. Top posts skew human-ai
  and civic-tech commentary replying into other people's threads, not original posts.
- **LinkedIn (87 posts):** 16,292 impressions, 362 likes, avg engagement ~4.2. Top post ("its 2026
  why would you read linkedin profiles," 43 eng) and #2 ("a year in review...", 26 eng) are both
  tagged `other` but both aging out (rc near 0) — the durable, current winner is claude-code
  content (see Topic resonance map).
- **Substack (10 posts):** avg engagement 10.9, the account's strongest per-post surface. "Building
  an Innovation Nation" (40 eng) and "Why do Americans Hate AI?" (38 eng, rc 29.0 — still climbing)
  are the standouts.
- **Substack Notes (32 posts):** avg engagement 10.6. Top note ("Hey Substack — I'm looking for
  others who feel intellectually lonely in tech," 118 eng) is the single highest-engagement post
  in the entire account, by a wide margin over #2 (67 eng).
- **Bluesky (95 posts):** avg engagement ~1.4, similar ceiling to X. Top post is a capitalism/
  inequality thread starter (14 eng) tagged `other`.

## Topic resonance map

Cell = avg engagement · rc = recency-weighted (4-wk half-life) · n posts

| Pillar | bluesky | linkedin | substack | substack-note | x |
|---|---|---|---|---|---|
| human-ai | 1.5 (rc 1.3) n=30 | 2.4 (rc 0.6) n=17 | 26.7 (rc 38.4) n=3 | 9.4 (rc 6.4) n=15 | 1.5 (rc 1.7) n=81 |
| claude-code | 0.3 (rc 0.0) n=3 | **6.8 (rc 3.0) n=17** | 2.7 n=3 | 1.0 n=1 | 1.4 (rc 1.2) n=62 |
| civic-tech | 1.9 (rc 1.9) n=28 | 4.3 n=3 | — | 1.0 n=1 | 1.8 (rc 2.4) n=8 |
| career-work | — | 4.1 (rc 0.3) n=15 | — | — | 1.5 (rc 1.2) n=16 |
| builder | 0.0 n=2 | 1.9 (rc 3.3) n=17 | 5.0 n=1 | 3.0 n=2 | 1.3 (rc 0.7) n=14 |
| other | 1.5 n=32 | 5.6 (rc 1.0) n=18 | 5.3 n=3 | 14.5 (rc 18.0) n=13 | 0.7 n=71 |

LinkedIn is the clearest read this cycle: claude-code (6.8, rc 3.0) is both the top raw performer
AND the only one whose wins are current rather than aging out — human-ai's 2.4 and 'other's 5.6 are
both cooling (rc well below raw). human-ai on Substack (26.7, n=3) is an eye-catching number but
too thin to lean on. On X, nothing clears 2.0 — this account's X ceiling shows up in every pillar,
not just one.

## Atomized vs organic

| platform | atomized | atomized-spin | organic |
|---|---|---|---|
| bluesky | 1.4 n=16 ⚠ | — | 1.5 n=79 |
| linkedin | 0.0 n=4 ⚠ | — | 4.4 n=83 |
| substack | — | — | 10.9 n=10 |
| substack-note | — | — | 10.6 n=32 |
| x | **3.1 n=15 ⚠** | 3.0 n=1 ⚠ | 1.1 n=236 |

Observational, and every atomized cell is flagged insufficient (all 15-16 atomized X/Bluesky posts
landed inside one tight window, not spread across 4 weeks — that's a real limitation, not just a
technicality, since it means "atomized beats organic" is currently a single-batch result, not yet a
repeated one). Even with that caveat, X's gap (3.1 vs 1.1, nearly 3x) is the strongest single signal
in this whole brief. LinkedIn's atomized read (0.0, n=4) is the opposite direction and stark, but
one post short of a real sample.

**Spin control readiness:** no spin-vs-verbatim control data exists yet on any platform — spin is
the always-on default and the verbatim control run only fires once a month
(`npm run spin-control`, this cycle picked human-ai/x — see Recommendations).

## Audience (who you're reaching)

| Platform | Followers/subs | Recent net growth | Demographics |
|---|---|---|---|
| bluesky | 40 | — | none (too small to read) |
| linkedin | 2,331 | +20 | yes |
| substack | 158 | **+153** | none |

Substack's growth is almost entirely new — 153 of 158 total subscribers arrived this window. That's
a real, current audience-building signal worth naming plainly. LinkedIn's audience skews senior
tech (Senior 38%, Director 15%), Technology/Software/IT-Consulting industries, Product
Manager/Founder/Co-Founder titles, largely at 10,001+-employee companies. That's a strong match for
claude-code and builder content (which is exactly what's winning on LinkedIn right now) and a much
weaker obvious match for civic-tech — worth watching whether voting-tool content is reaching new
people or just cycling through the same tech network that's already there for other reasons.

## Routing map (what to post where)

| Pillar | bluesky | community:democratic-resilience | linkedin | x |
|---|---|---|---|---|
| human-ai | include | — | include | include |
| claude-code | include | — | include | include |
| civic-tech | include | include | skip | include |
| career-work | skip | — | include | include |
| builder | skip | — | include | include |
| other | skip | — | skip | include |

No changes from defaults this cycle.

## Routing drift flags

No persistent divergences — fit scores track `config/routing.yaml`'s defaults across both
independent ~4-week windows checked.

## Topic-platform fit (lever A)

| Platform | Pillar | Read | Fit | n |
|---|---|---|---|---|
| linkedin | claude-code | **lean in** | 1.64 | 17 |
| x | civic-tech | **lean in** | 1.41 | 8 |
| linkedin | other | lean in | 1.34 | 18 |
| bluesky | civic-tech | steady | 1.23 | 28 |
| x | career-work | steady | 1.21 | 16 |
| x | human-ai | steady | 1.19 | 81 |
| x | claude-code | steady | 1.13 | 62 |
| bluesky / builder, bluesky / career-work | — | insufficient data | — | — |

linkedin/claude-code is the strongest, cleanest lean-in signal in the entire brief — it agrees with
the resonance map above and the sample (n=17) is real. x/civic-tech also reads lean-in, but per the
scorecard above that sample hasn't grown in eight weeks; the read is real but stale. Recommendation
only — this doesn't change what `/atomize` drafts; it's a cue to consider updating
`config/routing.yaml`'s defaults by hand, and today's defaults already match what this table
recommends, so no action needed there.

## Media-mix signal (lever B)

No tagged posts with metrics carry a non-text media type yet, so there's nothing to compare.
No `/video` or quote-card-vs-text engagement signal exists in this account's data at all —
that's a real gap, not a thin-sample one, since it means the account hasn't shipped enough
quote-cards/video with tracked metrics to ever populate this lever, independent of how much text
volume accumulates.

## Cadence + timing signal (lever C)

**Engagement trend (recent 4wk vs prior 4wk):**

| Platform | Read | Ratio | n (recent/prior) |
|---|---|---|---|
| linkedin | climbing | 14.45x | 3/16 |
| bluesky | climbing | 1.67x | 6/17 |
| x | climbing | 1.26x | 6/62 |

LinkedIn's 14.45x is dramatic but thin (n=3 recent) — direction is real, magnitude isn't trustworthy
yet.

**Peak posting hour (PT):**

| Platform | Peak hour | n | distinct hours seen |
|---|---|---|---|
| x | 6:00am PT | 252 | 17 |
| linkedin | 8:00pm PT | 87 | 15 |
| bluesky | 4:00am PT | 95 | 17 |

All three now have a real peak-hour read (the X/LinkedIn synthetic-timestamp gap flagged in past
cycles is resolved — both now show real distinct-hour spread). To activate: review the proposed
values in `config/schedule-overrides.yaml` (run `npm run cadence-fit -- --write` to refresh them
first), set `approved: true`, commit. Nothing changes your posting cadence or times until you do.

## Frame-fit signal (lever D)

All three platforms read insufficient-data — no platform has both spin-on and spin-off (control)
posts yet, since `spin-control` only just started picking a monthly control run and none have
landed. Expect this to stay empty for a few more cycles.

## CTA-fit signal (lever E)

No platform has any CTA-tagged posts yet — `posts.cta_destination` only started being stamped once
the underlying card shipped, and nothing has published since with a CTA to tag. Same honest empty
state as last several cycles.

## Community signals

The community log has only its original placeholder entry (2026-06-09, marked "example — replace
with real ones") — no real observations have been logged since this pipeline started. This is a
real gap in this brief's inputs, not a "nothing happened" signal: worth a 30-second note after
community posts if you want this section to ever say something real.

## Recommendations

1. **[DO MORE] Run `/atomize` + `/publish` on new material again.** The single clearest number in
   this brief: atomized X posts pull 3x organic (3.1 vs 1.1 avg engagement), confirmed this cycle.
   But the pipeline has placed exactly one post in the last six weeks. Every lever this system
   built (A through E) is starved for data because almost nothing is running through it — that's
   not a measurement problem, it's a "the tool isn't being used" problem.
2. **[TEST] Deliberately post civic-tech content to X.** It's the second-strongest lean-in signal
   (fit 1.41) but stuck at n=8 for eight straight weeks — it can't clear the n≥10 bar on its own
   without you actually posting more of it. Carried from last cycle, same bar (n≥10, avg≥1.3).
3. **[TEST] Run the picked spin-control control run.** `npm run spin-control` picked human-ai/x
   this month. Every frame-fit/spin-lift read in this brief is empty until control runs actually
   accumulate — next `/atomize` on a human-ai piece, draft the X derivative verbatim per
   `.claude/skills/atomize/SKILL.md` step 3.5 and stamp `control_run: true`.

Retired this cycle (see scorecard): the X 'other'-mix DO_LESS (failed twice, X is structurally low
regardless of mix) and the Notes-out-engage-essays DO_MORE (essays and Notes are statistically
even, essays trending stronger).

## Directives for atomization

- prioritize_pillar: claude-code
- channel_emphasis: linkedin (claude-code is the one clean, current lean-in win), x (atomized
  beats organic here by nearly 3x — worth the atomize effort)
- format_notes: X's low ceiling is structural, not a mix problem — stop trying to fix it with topic
  cuts; atomized posts already outperform organic there, so route more through the pipeline instead
- hooks_that_worked: ["its 2026 why would you read linkedin profiles", "how i failed to build a
  simple hackathon", "Why do Americans Hate AI?", "Hey Substack - I'm looking for others who feel
  intellectually lonely in tech."]

(`media_mix` omitted — lever B read no data to compare, not a lean-toward result.)

## Angle drift check

Skipped this cycle — no Obsidian content-ideas notes were available in this conversation to check
against `config/platforms.yaml`'s encoded angles.
