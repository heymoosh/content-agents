# Bets

The feedback loop's memory. `/strategy` writes a bet per recommendation and grades the prior
cycle's bets against fresh data. `/publish` appends `Placed log` rows when assets ship. Committed
every cycle.

Resolved 2026-06-16: the LinkedIn export now carries per-post engagement. The parser was fixed to
map LinkedIn's lumped "Engagements" count into the engagement score, and route.ts was fixed to
score each platform on its own scale. LinkedIn is now measurable and routes `include` for human-ai
and claude-code.

## bet:2026-06-16-001
brief: briefs/2026-06-16-strategy-brief.md
type: DO_MORE
claim: "Substantive on-pillar posts (human-ai, claude-code) on X out-pull personal/off-pillar 'other'."
hypothesis_metric: avg engagement of human-ai + claude-code X posts stays > 1.3 AND beats 'other' by ≥ 0.4 next cycle
status: confirmed
underperform_streak: 0
grade: 2026-06-24 — on-pillar X 1.47 (human-ai 1.45/n=71, claude-code 1.5/n=46) vs 'other' 0.60; beats by 0.87, both clear 1.3. Passed.

## bet:2026-06-16-002
brief: briefs/2026-06-16-strategy-brief.md
type: TEST
claim: "civic-tech is a real X performer, not noise (currently 1.7 avg but only n=6)."
hypothesis_metric: civic-tech X posts reach n ≥ 10 with avg engagement ≥ 1.3
status: carried
underperform_streak: 0
grade: 2026-06-24 — civic-tech X avg 1.63 (clears 1.3) but n=8, still short of 10. Trending right; carry one more cycle.

## bet:2026-06-16-003
brief: briefs/2026-06-16-strategy-brief.md
type: DO_LESS
claim: "Cutting default personal/off-pillar 'other' posting on X raises overall X engagement."
hypothesis_metric: share of X posts tagged 'other' drops below 25% (now ~31%) AND overall X avg engagement rises above 1.3
status: carried
underperform_streak: 1
grade: 2026-06-24 — 'other' share fell 31%→23% (condition met) but overall X avg stuck at 1.28 (<1.3). The cut tidied the mix without lifting engagement; X is structurally low. Carry, but the real lesson is the X ceiling, not the mix.

## bet:2026-06-16-004
brief: briefs/2026-06-16-strategy-brief.md
type: DO_MORE
claim: "On LinkedIn, builder/PM-framed posts out-engage values/human-ai framing."
hypothesis_metric: avg engagement of claude-code + builder-framed LinkedIn posts stays above human-ai LinkedIn posts (baseline this cycle: 12.9 vs 7.3)
status: confirmed
underperform_streak: 0
grade: 2026-06-24 — claude-code+builder LinkedIn 8.65 vs human-ai 5.5. Holds, but claude-code (10.93) carries it; builder fell to 4.38 (below human-ai). Confirmed via claude-code.

## bet:2026-06-24-001
brief: briefs/2026-06-24-strategy-brief.md
type: DO_MORE
claim: "Substack Notes are the highest-ROI surface; notes out-engage essays by multiples."
hypothesis_metric: substack-note avg engagement stays ≥ 5 and ≥ 3× essay reactions, n ≥ 15
status: open
underperform_streak: 0

## bet:2026-06-24-002
brief: briefs/2026-06-24-strategy-brief.md
type: TEST
claim: "Atomized/pipeline posts out-engage organic hand-posts on X."
hypothesis_metric: atomized X avg engagement > organic X avg with atomized n ≥ 10
status: open
underperform_streak: 0

## bet:2026-06-24-003
brief: briefs/2026-06-24-strategy-brief.md
type: DO_LESS
claim: "Routing society/human-ai essays to LinkedIn underperforms; keep LinkedIn for claude-code/career/personal."
hypothesis_metric: atomized human-ai LinkedIn avg < organic LinkedIn avg, confirmed at atomized n ≥ 5
status: open
underperform_streak: 0
- placed 2026-06-17T00:00:33.397Z [2026-06-16-building-an-innovation-nation/x-1] x → typefully draft 9540317 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, x:contrarian-lead, voice:no-ai-tells | "Extreme inequality is the natural outcome of a perfectly fair economy. Wealth be"
- placed 2026-06-17T00:00:33.635Z [2026-06-16-building-an-innovation-nation/x-2] x → typefully draft 9540318 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "If the scarce resource is no longer information or technical skill, but human ju"
- placed 2026-06-17T00:00:33.843Z [2026-06-16-building-an-innovation-nation/x-3] x → typefully draft 9540319 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "Determination, resilience, taste, judgment: the things that matter the most. Non"
- placed 2026-06-17T00:00:34.190Z [2026-06-16-building-an-innovation-nation/x-5] x → typefully draft 9540320 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "The machine is incredibly adept at executing things that are already well scoped"
- placed 2026-06-17T00:00:36.143Z [2026-06-16-building-an-innovation-nation/linkedin-1] linkedin → typefully draft 9540321 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, linkedin:lead-with-PM-builder-angle, voice:no-ai-tells | "I mostly focus on product innovation. That is my expertise as a product manager,"
- placed 2026-06-17T00:00:36.524Z [2026-06-16-building-an-innovation-nation/bluesky-1] bluesky → typefully draft 9540322 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "The most economically valuable thing a society can do may be the thing we've spe"
- placed 2026-06-17T00:01:47.151Z [2026-06-16-building-an-innovation-nation/community-democratic-resilience] community:democratic-resilience → ready-to-paste/community-democratic-resilience.txt (community:democratic-resilience) | "I made a pledge to never write about society and leave you with a sense of despa"
- placed 2026-06-17T03:51:13.589Z [2026-06-16-building-an-innovation-nation/x-6] x → typefully draft 9541990 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "After a baseline amount of intelligence, what mattered most was determination: t"
- placed 2026-06-17T03:51:13.948Z [2026-06-16-building-an-innovation-nation/x-7] x → typefully draft 9541991 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "The net effect is that we've made ourselves mechanical, exactly the kind of work"
- placed 2026-06-17T03:51:14.575Z [2026-06-16-building-an-innovation-nation/linkedin-2] linkedin → typefully draft 9541992 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, linkedin:governance-shorttermism-angle, voice:no-ai-tells | "In a lot of companies, the appearance of being right and decisive oftentimes ecl"
- placed 2026-06-17T03:51:14.791Z [2026-06-16-building-an-innovation-nation/bluesky-2] bluesky → typefully draft 9541993 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "Talent is not something that only certain types of people have. It is a capabili"
- placed 2026-06-17T03:51:14.996Z [2026-06-16-building-an-innovation-nation/bluesky-3] bluesky → typefully draft 9541994 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "The economic payoff from AI will not happen if we simply develop frontier models"
- placed 2026-06-17T03:51:15.192Z [2026-06-16-building-an-innovation-nation/bluesky-4] bluesky → typefully draft 9541995 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "We've been taught to absorb rules and apply them. The net effect is that we've m"
- placed 2026-06-17T03:51:15.374Z [2026-06-16-building-an-innovation-nation/bluesky-5] bluesky → typefully draft 9541996 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "Wealth begets more wealth, because the wealthy have more buffer to survive many "
- placed 2026-06-17T03:51:15.566Z [2026-06-16-building-an-innovation-nation/bluesky-6] bluesky → typefully draft 9541997 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "If the scarce resource is no longer information or even technical skill, but hum"
- placed 2026-06-24T22:37:38.501Z [2026-06-16-building-an-innovation-nation/qvid-x] x → typefully draft 9638763 @ Fri, Jun 26, 9:30 AM PT | "Extreme inequality is the natural outcome of a perfectly fair economy."
- placed 2026-06-24T22:37:45.740Z [2026-06-16-building-an-innovation-nation/qvid-linkedin] linkedin → typefully draft 9638768 @ Tue, Jun 30, 8:30 AM PT | "Extreme inequality is the natural outcome of a perfectly fair economy."
- placed 2026-06-24T22:37:52.592Z [2026-06-16-building-an-innovation-nation/qvid-bluesky] bluesky → typefully draft 9638769 @ Fri, Jun 26, 6:30 PM PT | "Extreme inequality is the natural outcome of a perfectly fair economy."
- placed 2026-06-25T17:05:28.351Z [2026-06-25-for-the-first-time-in-human-history-our-desire-t/1] x → typefully draft 9649349 @ Sat, Jun 27, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "For the first time in human history, our desire to create wealth and to create a"
- placed 2026-06-25T17:05:28.680Z [2026-06-25-for-the-first-time-in-human-history-our-desire-t/2] bluesky → typefully draft 9649350 @ Sat, Jun 27, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "For the first time in human history, our desire to create wealth and to create a"
- placed 2026-06-25T17:05:29.607Z [2026-06-25-i-am-holding-out-a-tiny-sliver-of-hope-that-huma/x-1] x → typefully draft 9649351 @ Sun, Jun 28, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "We're more likely to end up as a transhumanist uploaded digital consciousness th"
- placed 2026-06-25T17:05:29.872Z [2026-06-25-i-am-holding-out-a-tiny-sliver-of-hope-that-huma/bluesky-1] bluesky → typefully draft 9649352 @ Sun, Jun 28, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "I am holding out a tiny sliver of hope that human judgment and creativity contin"
- placed 2026-06-25T17:05:30.933Z [2026-06-25-i-m-starting-to-wonder-if-claude-code-works-best/2] bluesky → typefully draft 9649353 @ Mon, Jun 29, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:claude-code, format:near-verbatim-note | "I'm starting to wonder if Claude Code works best if you already think like a SWE"
- placed 2026-06-25T17:05:31.859Z [2026-06-25-i-want-to-live-in-a-world-that-feels-free-and-fa/1] x → typefully draft 9649354 @ Mon, Jun 29, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "I want to live in a world that feels free and fair, and I won't accept the idea "
- placed 2026-06-25T17:05:32.099Z [2026-06-25-i-want-to-live-in-a-world-that-feels-free-and-fa/2] bluesky → typefully draft 9649355 @ Tue, Jun 30, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "I want to live in a world that feels free and fair, and I won't accept the idea "
- placed 2026-06-25T17:05:32.894Z [2026-06-25-i-want-to-pledge-something-i-will-never-write-an/x-1] x → typefully draft 9649356 @ Tue, Jun 30, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "Constantly seeing problems without an offered solution just teaches us to be hel"
- placed 2026-06-25T17:05:33.130Z [2026-06-25-i-want-to-pledge-something-i-will-never-write-an/bluesky-1] bluesky → typefully draft 9649357 @ Wed, Jul 1, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "I will never write an article that points out problems in society and leave peop"
- placed 2026-06-25T17:05:34.007Z [2026-06-25-i-worry-less-about-ai-and-more-about-the-humans/1] x → typefully draft 9649358 @ Wed, Jul 1, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "I worry less about AI and more about the humans trying to make decisions on what"
- placed 2026-06-25T17:05:34.240Z [2026-06-25-i-worry-less-about-ai-and-more-about-the-humans/2] bluesky → typefully draft 9649359 @ Thu, Jul 2, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "I worry less about AI and more about the humans trying to make decisions on what"
- placed 2026-06-25T17:05:35.122Z [2026-06-25-if-ai-simply-automates-what-we-tell-it-to-we-acc/1] x → typefully draft 9649360 @ Thu, Jul 2, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "If AI simply automates what we tell it to, we accelerate all the gaps that were "
- placed 2026-06-25T17:05:35.371Z [2026-06-25-if-ai-simply-automates-what-we-tell-it-to-we-acc/2] bluesky → typefully draft 9649361 @ Fri, Jul 3, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "If AI simply automates what we tell it to, we accelerate all the gaps that were "
- placed 2026-06-25T17:05:36.191Z [2026-06-25-in-a-financialized-economy-gaining-wealth-does-n/1] x → typefully draft 9649362 @ Fri, Jul 3, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "In a financialized economy, gaining wealth does not have to have anything to do "
- placed 2026-06-25T17:05:36.459Z [2026-06-25-in-a-financialized-economy-gaining-wealth-does-n/2] bluesky → typefully draft 9649363 @ Sat, Jul 4, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "In a financialized economy, gaining wealth does not have to have anything to do "
- placed 2026-06-25T17:05:37.334Z [2026-06-25-it-finally-happened-we-have-a-trillionaire-what/1] x → typefully draft 9649364 @ Mon, Jul 6, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "It finally happened - we have a trillionaire. What a win for the human race ✌️ N"
- placed 2026-06-25T17:05:37.563Z [2026-06-25-it-finally-happened-we-have-a-trillionaire-what/2] bluesky → typefully draft 9649365 @ Sun, Jul 5, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "It finally happened - we have a trillionaire. What a win for the human race ✌️ N"
- placed 2026-06-25T17:05:38.360Z [2026-06-25-it-s-honestly-difficult-to-pay-attention-to-how/1] x → typefully draft 9649366 @ Tue, Jul 7, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "It's honestly difficult to pay attention to "How to boost your productivity with"
- placed 2026-06-25T17:05:38.584Z [2026-06-25-it-s-honestly-difficult-to-pay-attention-to-how/2] bluesky → typefully draft 9649367 @ Mon, Jul 6, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "It's honestly difficult to pay attention to "How to boost your productivity with"
- placed 2026-06-25T17:05:39.407Z [2026-06-25-it-s-not-the-tech-it-s-the-failure-of-our-instit/1] x → typefully draft 9649368 @ Wed, Jul 8, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "It's not the tech. It's the failure of our institutions and leaders to create po"
- placed 2026-06-25T17:05:39.618Z [2026-06-25-it-s-not-the-tech-it-s-the-failure-of-our-instit/2] bluesky → typefully draft 9649369 @ Tue, Jul 7, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "It's not the tech. It's the failure of our institutions and leaders to create po"
- placed 2026-06-25T17:05:40.564Z [2026-06-25-juneteenth-at-joy-street-in-front-of-the-museum/1] x → typefully draft 9649370 @ Thu, Jul 9, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "Juneteenth at Joy Street in front of the Museum of African American history remi"
- placed 2026-06-25T17:05:40.813Z [2026-06-25-juneteenth-at-joy-street-in-front-of-the-museum/2] bluesky → typefully draft 9649371 @ Wed, Jul 8, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "Juneteenth at Joy Street in front of the Museum of African American history remi"
- placed 2026-06-25T17:05:41.082Z [2026-06-25-juneteenth-at-joy-street-in-front-of-the-museum/3] community → ready-to-paste/3.txt (community) | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "Juneteenth at Joy Street in front of the Museum of African American history remi"
- placed 2026-06-25T17:05:41.862Z [2026-06-25-maybe-there-s-a-future-with-ai-where-workers-are/1] x → typefully draft 9649372 @ Fri, Jul 10, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "Maybe there's a future with AI where workers aren't displaced into a permanent u"
- placed 2026-06-25T17:05:42.093Z [2026-06-25-maybe-there-s-a-future-with-ai-where-workers-are/2] bluesky → typefully draft 9649373 @ Thu, Jul 9, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "Maybe there's a future with AI where workers aren't displaced into a permanent u"
- placed 2026-06-25T17:05:42.915Z [2026-06-25-probably-the-hardest-part-about-managing-ai-work/1] x → typefully draft 9649374 @ Mon, Jul 13, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "Probably the hardest part about managing AI workflows is choosing what to focus "
- placed 2026-06-25T17:05:43.150Z [2026-06-25-probably-the-hardest-part-about-managing-ai-work/2] x → typefully draft 9649375 @ Tue, Jul 14, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "Congress spends up to 70% of their time just fundraising for their next election"
- placed 2026-06-25T17:05:43.370Z [2026-06-25-probably-the-hardest-part-about-managing-ai-work/3] bluesky → typefully draft 9649376 @ Fri, Jul 10, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "The challenge now is distribution, now that the building part is easier. I'd tak"
- placed 2026-06-25T17:05:43.615Z [2026-06-25-probably-the-hardest-part-about-managing-ai-work/4] bluesky → typefully draft 9649377 @ Sat, Jul 11, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "I've been building a tool to help people evaluate their Congressmen based on don"
- placed 2026-06-25T17:05:43.879Z [2026-06-25-probably-the-hardest-part-about-managing-ai-work/5] community → ready-to-paste/5.txt (community) | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "I've been building a tool to help people evaluate their Congressmen based on don"
- placed 2026-06-25T17:05:44.762Z [2026-06-25-we-can-build-a-future-we-want-it-starts-with-bel/1] x → typefully draft 9649378 @ Wed, Jul 15, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "Future models may prove me wrong but as of now, AI practitioners like me see an "
- placed 2026-06-25T17:05:45.062Z [2026-06-25-we-can-build-a-future-we-want-it-starts-with-bel/2] bluesky → typefully draft 9649379 @ Sun, Jul 12, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "We can build a future we want - it starts with believing it's even possible. AI "
- placed 2026-06-25T17:05:46.089Z [2026-06-25-we-need-to-stop-treating-these-two-groups-as-if/1] x → typefully draft 9649380 @ Thu, Jul 16, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "We need to stop treating these two groups as if they are the same: Group A would"
- placed 2026-06-25T17:05:46.599Z [2026-06-25-we-need-to-stop-treating-these-two-groups-as-if/2] bluesky → typefully draft 9649381 @ Mon, Jul 13, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "We need to stop treating these two groups as if they are the same: A: Wealthy pe"
- placed 2026-06-25T17:05:46.873Z [2026-06-25-we-need-to-stop-treating-these-two-groups-as-if/3] community → ready-to-paste/3.txt (community) | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:civic-tech, format:near-verbatim-note | "We need to stop treating these two groups as if they are the same: A: Wealthy pe"
- placed 2026-06-25T17:05:47.633Z [2026-06-25-what-i-ve-described-in-my-essay-building-an-inno/1] x → typefully draft 9649382 @ Fri, Jul 17, 9:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "What I described in Building an Innovation Nation is already being noticed in fr"
- placed 2026-06-25T17:05:47.972Z [2026-06-25-what-i-ve-described-in-my-essay-building-an-inno/2] bluesky → typefully draft 9649383 @ Tue, Jul 14, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note | "What I described in Building an Innovation Nation is already being noticed in fr"
- placed 2026-06-25T17:05:49.979Z [2026-06-25-what-i-ve-described-in-my-essay-building-an-inno/3] linkedin → typefully draft 9649384 @ Thu, Jul 2, 8:30 AM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, format:near-verbatim-note, linkedin:career-angle-present | "What I described in Building an Innovation Nation is already being noticed in fr"
- placed 2026-07-05T16:50:41.399Z [2026-07-04-250th-anniversary-question/bluesky-2] bluesky → typefully draft 9778798 @ Wed, Jul 15, 6:30 PM PT | from_brief: briefs/2026-06-24-strategy-brief.md | directives: prioritize_pillar:human-ai, channel_emphasis:bluesky-for-human-ai-civic | spin | "Part of why nothing changes is we can't even agree on the facts anymore, so we c"
- placed 2026-07-05T16:50:53.073Z [2026-06-16-building-an-innovation-nation/quote-card-6-x] x → upload-post job 090360eb3d464e06966cb7011183ad79 → x @ 2026-07-21T19:00:00.000Z | "Silicon Valley loves to argue about who's smart enough. Y Combinator studied tho"
