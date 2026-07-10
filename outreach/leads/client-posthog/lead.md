---
kind: client
name: "PostHog"
url: 
source: jsa
jsa_verdict: TARGET
status: pursue   # intake | researched | qualified | pursue | passed | drafted | locked
classification: greenfield   # turnaround | greenfield | unclear | disqualified
pitch_angle: "PostHog is publicly mid-exploration on a genuinely new, unshipped direction (AI-generated PRs) the same way its own CEO has publicly admitted getting a foundational product-org assumption wrong before (E6, E7), so the honest pitch opens with Muxin's pattern for surfacing the untested assumption inside that new direction, in the same spirit as Hawkins's own \"I was wrong\" post, rather than a generic PMF pitch."
---

## Profile

Snapshotted from JSA (job-search-agent) manual_research.db at intake.
JSA verdict: TARGET
JSA researched date: 2026-03-30
- PM role quality (JSA): PMs focus on research, data, and context-setting rather than roadmap ownership. Seeking ex-founders/ex-product engineers with coding background. Highly autonomous role with strategic influence across multiple products.
- Job protection (JSA): Strong funding with $70M Series D (2024) and $75M Series E (2025) at $1.4B valuation. No layoffs in company history, runs 'default alive' model. Transparent about financial health.

JSA persona note: Ex-founder or technical product engineer who wants strategic product ownership in an AI-native developer tools company

JSA founder persona note: James Hawkins comes from a sales background (VP at Arachnys selling $1M+ contracts) before pivoting to technical founder. Communicates transparently and directly through podcasts and blog posts. Known for building PostHog without traditional management structure - no meetings or micromanagement.

Note (JSA values-depth finding): a JSA verdict is a logistics-fit signal only (remote, pay, benefits, role quality) -- never a proxy for worldview alignment. This lead still needs its own quote-required worldview qualify from scratch (config/outreach/clients.md, config/outreach/worldview-map.md) before it can reach `pursue`.

---

PostHog is an open source, all-in-one product analytics platform for software teams: product analytics, session replay, feature flags, A/B testing, surveys, and a customer data platform, aimed at product engineers who want to build and measure without stitching together many separate tools. Founded in 2020 (YC W20), it's now a $1.4B-valuation company (Series E, September 2025) that runs on radical transparency (open handbook, open salaries, open roadmap) and small, highly autonomous 2 to 6 person teams with no formal management layer. As of its "Act 2" announcement it's expanding beyond analytics into AI-assisted developer tooling, specifically automatically generating pull requests.

## Evidence

- E1 | signal: greenfield | person:  | source: https://posthog.com/blog/series-e | quote: "We are starting Act 2 of PostHog. We are going deeper into being a devtool, not 'just' analytics." | James Hawkins announcing a new, not-yet-defined product direction right after the Sept 2025 Series E raise.
- E2 | signal: greenfield | person:  | source: https://posthog.com/blog/series-e | quote: "We'll gradually be releasing the very earliest versions of this to keen early adopters for feedback." | Company explicitly framing the new AI-PR-generation feature as still being learned, not a fixed plan being executed.
- E3 | signal: greenfield | person:  | source: https://posthog.com/careers/product-manager-(ex-founder-or-ex-product-engineer) | quote: (none) | Job posting seeks ex-founders / ex-product engineers for a highly autonomous PM role centered on research and context-setting, echoing the rubric's "0-to-1" hiring language.
- E4 | signal: turnaround | person:  | source: https://posthog.com/founders/first-1000-users | quote: "Tim, my co-founder, and I wound up pivoting five times before we landed on PostHog." | Historical, founding-era pivots (2020, pre-launch); dated evidence, not a current-state turnaround signal.
- E5 | signal: disqualifying | person:  | source: https://www.glassdoor.com/Reviews/Employee-Review-PostHog-E4260520-RVW96626860.htm | quote: (none) | Glassdoor commentary (cited as commentary, not verified fact): reviewers describe major team/business changes as decided top-down via Slack with no consultation of affected teams.
- E6 | signal: worldview-match | person: James Hawkins | source: https://posthog.com/founders/product-360 | quote: "I used to think you don't need product people. I was wrong." | Founder publicly reverses a foundational assumption about how product decisions get made, matching worldview-map statement 2 (untested assumption) and statement 4 (openness to changing minds).
- E7 | signal: worldview-match | person: James Hawkins | source: https://posthog.com/founders/product-360 | quote: "we were wrong that once we had product market fit for our open-source product, to continue making detailed decisions about prioritization... we didn't know every user ourselves any more, and there was too much data to hold in our heads." | Explicit admission that an untested internal assumption (engineers alone can prioritize at scale) drove a real strategy failure, corrected once tested against evidence.
- E8 | signal: person-fit | person: James Hawkins | source: https://posthog.com/founders/product-360 | quote: "I used to think you don't need product people. I was wrong." | Person-fit tier: Developing. Real, directly-quoted instinct toward worldview-map statements 2 and 4, but his public writing stays product/business-execution focused rather than reaching outside that professional bubble, so it does not clear "Genuine depth."

## Classification

Per E1, E2, and E3, PostHog is currently, publicly exploring a new, unshipped product direction (AI-generated PRs, "Act 2") post-Series E, and its PM hiring language seeks founder-level autonomous ownership rather than roadmap execution, both greenfield signals per the rubric. The HARD qualifier (open to changing minds) is clearly met per E6 and E7: James Hawkins's own public reversal of a foundational product-org assumption, reinforced by E2's "early adopters for feedback" posture on the new direction. E4 (five pre-launch pivots) is dated founding-era background only, not the basis for a turnaround read, since nothing indicates something currently broken at this now-$1.4B, well-funded company. E5 is Glassdoor commentary only and does not rise to the disqualifying bar (no "just execute" job-description language, no locked-roadmap evidence found); it is noted as a mild friction point, not disqualifying.

Disconfirmation pass: Searched Glassdoor reviews and PostHog's own "small teams" and roadmap handbook pages for evidence against the worldview match. Found: E5's Glassdoor commentary describes major changes as top-down and abrupt with no team consultation, which cuts against "openness" being evenly distributed; and the handbook states James and Tim retain final say over cross-team prioritization ("no gaps in product... all small teams working on something rational"), so team-level autonomy is real but bounded by founder-level control. No evidence found of the company presenting any roadmap or plan as fixed or explicitly resistant to changing course.

## Pitch

PostHog is publicly mid-exploration on a genuinely new, unshipped direction (AI-generated PRs) the same way its own CEO has publicly admitted getting a foundational product-org assumption wrong before (E6, E7), so the honest pitch opens with Muxin's pattern for surfacing the untested assumption inside that new direction, in the same spirit as Hawkins's own "I was wrong" post, rather than a generic PMF pitch.

## Decision log

- 2026-07-10: intake (jsa, verdict=TARGET)
- 2026-07-10: research pass (search_budget_per_signal=2, evidence_found=8, classification=greenfield)
- 2026-07-10: qualify -> classification=greenfield, status=pursue
