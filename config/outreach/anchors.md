# Anchors

People and orgs Muxin already trusts (docs/outreach-engine-plan.md §3, §9c). Qualify can add
evidenced people here, and Phase 5 Scout rotates small subsets through one-to-two-hop public graph
expansion across co-appearance, collaboration, engagement, and alumni networks.

Every entry carries a one-line "why this anchor" note. This file grows three ways: Muxin adding a
name herself, the two-key jobsearch gate (`qualify.ts`) recording a named, evidenced like-minded
person at a company whose person-level signal is real but whose company-level worldview signal
didn't clear the bar for `pursue` (that signal still has standalone value; it is not discarded),
and a one-time bulk ingest of Muxin's pre-existing research corpus (Obsidian vault + JSA DB,
backlog card d4524bd0, 2026-07-10): see the dated section below.

## Seeded anchors (Muxin, 2026-07-08)

- **Audrey Tang**, Taiwan's former Digital Minister: public-interest technologist whose whole
  public record is "build the process that lets people actually change the system," the client
  fit rubric's core belief (worldview-map.md #2, #4) at nation-state scale.
- **Collective Intelligence Project**, research org on collective/participatory approaches to
  steering AI: direct institutional match to worldview-map.md #3 (AI tooling built inside a
  bubble) and #5 (who benefits or is harmed by a system).

## Named anchors from leads (two-key jobsearch gate overflow)

Appended by `qualify.ts` when a jobsearch-bucket lead has a named, evidenced like-minded person
(quote + source, scored against `config/outreach/person-fit.md`), but the company itself didn't
clear the worldview qualify bar. The lead can't reach `pursue`, but the person is still a real,
worldview-aligned anchor worth keeping on file.

<!-- qualify.ts appends entries below this line, one per anchor, in the same
     "- **Name**, role @ company. Why this anchor: <one line, cites the lead file>." shape
     as the seeded anchors above. Do not hand-edit the machine-appended section format. -->
- **Ankur Gupta (Founder/CEO)** @ Axelerant. Why this anchor: Reflective, uncertainty-holding statement about the company's own direction (paired with "I wish I could say that we always knew what we wanted Axelerant's culture to be like. But that wasn't the case."); rates Developing on the Philosophical Depth Probe, real instinct toward openness-to-change (worldview statement 4) but scoped to internal culture, not a broader articulated worldview.

## Anchors ingested from Muxin's research corpus (backlog card d4524bd0, 2026-07-10)

Bulk-ingested from Muxin's pre-existing Obsidian vault research (`Job Hunt/Research/Company
Research/` and `Job Hunt/Research/Chats with People/`, originally gathered for her own job
search) plus a JSA `manual_research.db` cross-check. Every entry below cleared the same bar as the
seeded anchors above: real, specific, quotable or directly-paraphrasable evidence against one of
the five `worldview-map.md` statements, not "works somewhere interesting." Candidates considered
and explicitly rejected for thin or negative evidence (e.g. Shishir Mehrotra, Dennis Xu, Sam
Udotong, Ami Vora) are not listed here; see the five ingested lead files under `outreach/leads/`
for the reasoning on the company-level people among them.

- **Mike Krieger**, Head of Anthropic Labs (former Chief Product Officer), Anthropic. Why this anchor: names his own product org's habit of building the full thing, discovering an untested core assumption, then tearing it down for a rebuild ("we've over complicated or made some kind of core assumption, and then tore it down, a V2"), worldview statement 2; separately names the internal-dogfooding-vs-real-user gap as his own top unprompted product fear, worldview statement 3. (vault:Research/Company Research/Anthropic/How to build an agent-native product with mike krieger.md)
- **Boris Cherny**, Head of Claude Code, Anthropic. Why this anchor: repeatedly and consistently states he's wrong "probably half the time" and credits Anthropic's stated epistemic stance, that intuition is often wrong, as part of why he works there, worldview statement 4; separately, in a warm 1:1 conversation with Muxin, describes screening hires for whether they can recognize and own their own mistakes. (vault:Research/Company Research/Anthropic/Boris Cherny — Pragmatic Engineer.md; vault:Research/Chats with People/Boris (Claude Code).md)
- **Cat Wu**, Claude Code PM, Anthropic. Why this anchor: on the record describing reversing a stated "no onboarding flow" product principle once user evidence contradicted it, a concrete, current, product-level match to worldview statements 2 and 4, not a historical or founding-era anecdote. (vault:Research/Company Research/Anthropic/Cat Wu — Lenny's Podcast.md)
- **Dario Amodei**, CEO/co-founder, Anthropic. Why this anchor: his own essay explicitly separates "does it work" (economic growth) from "who ends up holding the gains" as the real thing worth worrying about, worldview statement 5; in a separate live interview names the exact bubble-decoupling risk worldview statement 3 warns about, unprompted, in his own words. (vault:Research/Company Research/Anthropic/The Adolescence of Technology.md; vault:Research/Company Research/Anthropic/Anthropic CEO Dario Amodei From World Economic Forum  WSJ.md)
- **Thariq Shihipar**, Claude Code product engineering, Anthropic. Why this anchor: publicly names a specific untested industry-wide assumption that Claude Code disproved in practice ("people thought context windows would get long enough that you could just fit a codebase into context. But that is not how programming works"), worldview statement 2. (vault:Research/Company Research/Anthropic/Thariq Shihipar — Outreach Terrain Map.md)
- **Ivan Zhao**, CEO/co-founder, Notion. Why this anchor: names the "unexamined workflow" trap directly in his own words ("we are still in the waterwheel phase of AI, bolting chatbots onto workflows designed for humans"), worldview statement 1; has a separate, dated, on-record instance of reversing a real shipped product decision once he recognized the untested assumption behind it, worldview statements 2 and 4. (vault:Research/Company Research/Notion/Ivan on Lenny's Podcast.md; https://x.com/ivanhzhao/status/2003192654545539400)
- **Akshay Kothari**, COO, Notion. Why this anchor: public words on Notion's new agentic product line echo worldview statement 4 (openness to changing direction), describing the only path forward as being willing to disrupt yourself, applied to companies (implicitly including his own) facing the same AI-native shift Notion is mid-navigating. (vault:Research/Company Research/Notion/Akshay Kothari LinkedIn.md)
- **Rahul Vohra**, founder, Superhuman Mail (now a product division inside the merged Grammarly/Superhuman; he no longer controls company-level decisions there, see `outreach/leads/client-superhuman`, disqualified at the company level, tracked here as a person-level signal only). Why this anchor: describes a team habit of naming a mistake and fixing it rather than defending it ("that was a mistake, we're going to fix it and do it better next time"), worldview statement 4; separately, his PMF-testing practice exists specifically to test readiness assumptions before scaling, worldview statement 2. (vault:Research/Company Research/Superhuman/Transcript of Inside the New Superhuman.md)
- **Kevin Moody**, Co-founder/CEO, Mem. Why this anchor: quoted PMF conviction ("if you stopped pushing your product today, would users even notice... you might have YC market fit, not product market fit") rates Developing on the Philosophical Depth Probe, real instinct toward worldview statement 2, but scoped to product/business execution, not a broader articulated worldview. (vault:Research/Company Research/Mem/Kevin Moody - Deep Profile & Cultural Fit Analysis.md)
- **Krish Ramineni**, Co-founder/CEO, Fireflies.ai. Why this anchor: names the exact failure mode worldview statement 2 describes ("the biggest challenge with product managers, they sometimes develop in a vacuum without listening to what customers want... the best product insights come from customers"); separately treats product bets as testable and reversible ("if it doesn't work, you're dumping it quickly and moving on to the next"), worldview statement 4. (vault:Research/Company Research/Fireflies/Can We Use AI for Happiness, Health and Humanity? - Krish Ramineni.md)
- **Stacey Dean**, Director of Product Management, restaurant-tech (20+ years in product). Why this anchor: pulled her team back from unstructured "everyone's building in Claude" adoption to prevent a "Frankenstein product," insisting on product strategy before automating, a lived instance of worldview statement 1. (vault:Research/Chats with People/Stacey Dean.md)
- **Subha Shetty**, AI consultant / fractional Chief Product & AI Officer. Why this anchor: stated operating philosophy is to simplify workflows first, then add AI, rather than automating a complex existing process unexamined, a near-verbatim echo of worldview statement 1. (vault:Research/Chats with People/Subha Shetty - AI Fractional Product.md)
- **Lucy Yeung**, Bay Area product leader (product plus finance/corporate-strategy background). Why this anchor: named the core diagnostic of worldview statement 1 directly ("when we're in a pattern, we don't even see the pattern, therefore we don't know how to break it") and independently stopped writing PRDs once she noticed the AI-writes/AI-reads loop had become circular and unexamined. (vault:Research/Chats with People/Lucy Yeung.md)
- **Grace Esteban**, non-dev builder, founder of AppBoardBreeze. Why this anchor: named her own unresolved tension about wanting to build for people who've never heard of Claude rather than the tech-fluent audience she has easiest reach to, a live instance of worldview statement 3 (AI tooling designed inside a bubble the other 96% don't live in). (vault:Research/Chats with People/Grace Esteban.md)
- **Jeremy Wasser**, product leader / consultant. Why this anchor: stopped using ATS job applications entirely, describing the practice plainly as "AI talking to AI," a specific, lived critique of automating an unexamined broken process, worldview statement 1; rates Developing, a sharp instinct surfaced once in one conversation rather than a sustained public worldview. (vault:Research/Chats with People/Jeremy Wasser.md)
