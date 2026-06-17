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
status: open
underperform_streak: 0

## bet:2026-06-16-002
brief: briefs/2026-06-16-strategy-brief.md
type: TEST
claim: "civic-tech is a real X performer, not noise (currently 1.7 avg but only n=6)."
hypothesis_metric: civic-tech X posts reach n ≥ 10 with avg engagement ≥ 1.3
status: open
underperform_streak: 0

## bet:2026-06-16-003
brief: briefs/2026-06-16-strategy-brief.md
type: DO_LESS
claim: "Cutting default personal/off-pillar 'other' posting on X raises overall X engagement."
hypothesis_metric: share of X posts tagged 'other' drops below 25% (now ~31%) AND overall X avg engagement rises above 1.3
status: open
underperform_streak: 0

## bet:2026-06-16-004
brief: briefs/2026-06-16-strategy-brief.md
type: DO_MORE
claim: "On LinkedIn, builder/PM-framed posts out-engage values/human-ai framing."
hypothesis_metric: avg engagement of claude-code + builder-framed LinkedIn posts stays above human-ai LinkedIn posts (baseline this cycle: 12.9 vs 7.3)
status: open
underperform_streak: 0
- placed 2026-06-17T00:00:33.397Z [2026-06-16-building-an-innovation-nation/x-1] x → typefully draft 9540317 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, x:contrarian-lead, voice:no-ai-tells | "Extreme inequality is the natural outcome of a perfectly fair economy. Wealth be"
- placed 2026-06-17T00:00:33.635Z [2026-06-16-building-an-innovation-nation/x-2] x → typefully draft 9540318 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "If the scarce resource is no longer information or technical skill, but human ju"
- placed 2026-06-17T00:00:33.843Z [2026-06-16-building-an-innovation-nation/x-3] x → typefully draft 9540319 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "Determination, resilience, taste, judgment: the things that matter the most. Non"
- placed 2026-06-17T00:00:34.190Z [2026-06-16-building-an-innovation-nation/x-5] x → typefully draft 9540320 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "The machine is incredibly adept at executing things that are already well scoped"
- placed 2026-06-17T00:00:36.143Z [2026-06-16-building-an-innovation-nation/linkedin-1] linkedin → typefully draft 9540321 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, linkedin:lead-with-PM-builder-angle, voice:no-ai-tells | "I mostly focus on product innovation. That is my expertise as a product manager,"
- placed 2026-06-17T00:00:36.524Z [2026-06-16-building-an-innovation-nation/bluesky-1] bluesky → typefully draft 9540322 | from_brief: briefs/2026-06-16-strategy-brief.md | directives: prioritize_pillar:human-ai, voice:no-ai-tells | "The most economically valuable thing a society can do may be the thing we've spe"
- placed 2026-06-17T00:01:47.151Z [2026-06-16-building-an-innovation-nation/community-democratic-resilience] community:democratic-resilience → ready-to-paste/community-democratic-resilience.txt (community:democratic-resilience) | "I made a pledge to never write about society and leave you with a sense of despa"
