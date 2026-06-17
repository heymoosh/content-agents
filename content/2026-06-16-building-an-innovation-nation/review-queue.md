# Review queue — Building an Innovation Nation

Set status to approve / revise / discard. Add a note for revise.
Only `approve` rows are acted on by `/publish`. Nothing publishes until you do this.

Pillars: human-ai (primary), civic-tech (secondary). Strategy brief:
briefs/2026-06-16-strategy-brief.md (prioritize human-ai; on X lead with the contrarian/
source-cited claim; LinkedIn was re-cut to the PM/builder angle to match the audience).

CTA: text posts now point to the live essay
(humaninference.substack.com/p/building-an-innovation-nation), not the Substack homepage. The
community post points to the voting tool. All voice-checked against config/voice.yaml (no em
dashes, no AI tells).

Routing note: LinkedIn is now measured (engagement export ingested) and routes include for
human-ai. The data confirms LinkedIn rewards the builder/PM register (claude-code 12.9 vs human-ai
7.3), which is why the LinkedIn post leads with product craft. See the brief.

> Routing: see routing.md.

| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |
|----|----------|--------|-------|-------------|------------|-----|--------|-------|
| x-1 | x | text | derivatives/x-1.md | 5 | 4 | yes | published | lead post: contrarian, most X-native per brief |
| x-2 | x | text | derivatives/x-2.md | 5 | 5 | yes | published | |
| x-3 | x | text | derivatives/x-3.md | 5 | 5 | yes | published | |
| x-4 | x | text | derivatives/x-4.md | 4 | 4 | yes | discard | dropped: education line is off the AI-innovation through-line (brief 2026-06-16) |
| x-5 | x | text | derivatives/x-5.md | 4 | 5 | yes | published | |
| linkedin-1 | linkedin | text | derivatives/linkedin-1.md | 5 | 5 | yes | published | re-cut to PM/builder angle; confirmed by data (LinkedIn claude-code 12.9 > human-ai 7.3) |
| bluesky-1 | bluesky | text | derivatives/bluesky-1.md | 5 | 5 | yes | published | |
| community-democratic-resilience | community:democratic-resilience | text | derivatives/community-democratic-resilience.md | 5 | 5 | yes | published | civic CTA → voting tool |
| quote-card-1 | quote-card | image | images/quote-card-1.png | 5 | 5 | no | approve | New Yorker typographic style (no illustration), rendered |
| video-script | video-script | storyboard | — | — | — | — | blocked | needs OPENROUTER_API_KEY (Grok); set it + re-run to draft script + storyboard |
