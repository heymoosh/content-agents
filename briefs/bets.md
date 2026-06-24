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
