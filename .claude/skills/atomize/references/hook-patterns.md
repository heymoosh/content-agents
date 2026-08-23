# Hook pattern library

**Source:** research pass 2026-08-18 (two agent research runs — general niches, then a joyful-
activism-specific follow-up per Muxin's request) surveying real creators in Muxin's adjacent
niches (building/founder journey, solopreneurship, inner-journey/personal growth, civic
engagement, voting/democracy reform). Full source list and verification notes: see the research
transcripts referenced in the 2026-08-18 session; every attributed example below was independently
verified against a real source at research time.

## How to use this — read before drafting

**These are proven sentence SHAPES, not text to copy.** Muxin confirmed (2026-08-18): the value
here is "this structure is proven to work," never the wording itself. A pattern's "Shape" row is a
template with blanks — fill every blank with a specific fact or phrase that is *already in the
source material being atomized*, the same reframe-never-invent guardrail every other spin pass in
this skill follows (`references/spin-mode.md`). The "Real example" row exists only to prove the
shape actually works in the wild; it is a citation, not a phrase bank. **Never reuse a real
example's exact wording, and never paraphrase it closely enough that it's recognizable as theirs.**
These are named, identifiable creators with audiences who know their own lines — a near-match reads
as plagiarism, not inspiration, and undermines the extraction-first rule this whole pipeline runs
on (CLAUDE.md rule 1).

**When this applies:** the same scope as the storytelling re-hook pass it extends,
`appliesRehook(platform, sourceKind)` in `src/atomize/spin.ts`. Muxin widened that gate on
2026-08-22 from X/LinkedIn only to EVERY platform, so hook patterns are in scope wherever the
re-hook pass runs. A platform can opt back out with `rehook: false` in `config/platforms.yaml`
(only `quote-card` does today, because a card is pulled verbatim), and a Notes repost
(`source_kind: substack-note`) is still excluded everywhere. Use a pattern to decide HOW to
reorder/lead with a specific already pulled from the source, never as a reason to add a claim,
statistic, or detail that isn't already there.

**Companion libraries:** `references/post-patterns.md` covers FULL-POST structure (arc, emotional
trigger, CTA, length) the way this file covers the opening line; both are populated and maintained
by the `/patterns` skill. `references/civic-adaptation.md` is Muxin's own decided rubric for civic
and social-issues material (what a piece must deliver, and the two-form bar every civic CTA has to
clear, a micro-action or neutral record-based value-aligned matching); it stacks with the joyful-activism default below rather than competing with it, and
`/patterns` never rewrites it. The three are one system. If you need a shape this file doesn't
have, check those before starting a fourth library.

**Niche default:** for civic/activism material specifically, Muxin's explicit preference
(2026-08-18) is the joyful-activism register (patterns 16–23) over the outrage/moral-clarity
register (patterns 8–9, 11–12) — people doing the work with love, care, and energy, not grievance.
Reach for the outrage register only when the source material itself is genuinely grief- or
anger-toned; don't impose a heavier register than the source actually carries.

## General patterns (building, solopreneurship, inner journey, civic — mixed register)

| # | Name | Mechanism | Shape | Real example (citation only — do not copy) |
|---|---|---|---|---|
| 1 | Relatable Enemy | Name a frustration the reader already feels, align with them against it before pitching anything | "[Everyday system/obligation] is [struggling/under pressure]. And [reader-aligned reaction]." | Justin Welsh's LinkedIn hook formula (relatable-enemy → aligned hero-statement → curiosity teaser) |
| 2 | Retrospective Numbers | Open with a specific number/timeframe from your own track record; context comes after | "[Time ago], I [did X]. We were at [metric], but everyone said [doubt]. Today [outcome]." | Nathan Barry, X, re: ConvertKit funding/MRR history |
| 3 | Process Specificity | Declare exactly what you did and how fast, promise a walkthrough | "Here's how I [did X] in [surprisingly short timeframe]." | Pieter Levels, X/thread openers |
| 4 | Universal Time/Mortality Truth | A blunt, undeniable truth about time, aging, or relationships everyone already half-believes | "[Do X] more — [it won't last forever / you'll regret not doing it]." | Sahil Bloom, X: "Call your parents more often—they won't be around forever." |
| 5 | Numbered-List Promise | A scannable payoff stated up front | "[N] things I know at [stage] I wish I knew at [earlier stage]." | Sahil Bloom, "35 Things I Know At 35 I Wish I Knew At 25" |
| 6 | Direct Question | Open by asking the reader something that implicates them personally | "[Question that implicates the reader personally]?" | Anne-Laure Le Cunff, Ness Labs: "What do you want to be when you grow up?" |
| 7 | Mid-Scene / In Media Res | Drop into a small sensory or emotional moment, no throat-clearing | "[Time marker], I [small sensory/emotional moment]…" | Anne-Laure Le Cunff, Ness Labs newsletter opener |
| 8 | Flat Moral-Clarity Claim | A short, undefended declarative sentence that reframes the reader's assumption | "[Short undefended claim reframing the reader's assumption]." | Anand Giridharadas, The.Ink: "I am tired of us being on the defensive." |
| 9 | Direct-Address to Named Subgroup | Speak straight to one specific slice of the audience by name | "I want to say to [specific group]: [message]." | Anand Giridharadas, X, address to a named political subgroup |
| 10 | Historical Echo Before Pivot | Open with a quote or scene from history/literature, then pivot to the present-day parallel | "[Quote/scene from history or literature]. [Pivot to present-day parallel]." | Heather Cox Richardson, Letters from an American — opens on a Robert Service poem line, pivots to current news |
| 11 | Named-Threat Framing | Name the specific mechanism or actor responsible, before explaining the situation | "[Specific mechanism/actor], not [the usual suspect], is [responsible for X]." | David Pepper, Pepperspectives — names state legislatures/gerrymandering as the mechanism |
| 12 | Redefinition Claim | Assert what something "really" is, against the common assumption | "The real [thing] isn't [common assumption] — it's [reframe]." | Josh Silver, RepresentUs: "The most dangerous currency in American politics today isn't money — it's deception." |
| 13 | Named-Audience Callout | Open by naming the exact reader so the right person self-selects in | "If you're [specific reader type]…" | Dickie Bush, Ship 30 for 30 hook framework |
| 14 | Curiosity-Gap Teaser | State a claim, then a short unanswered "Why?" that forces the next line | "[Claim]. And [reaction]. Why?" | Justin Welsh's documented LinkedIn formula |
| 15 | Confession / Vulnerability Open | Lead with an unflattering personal admission, delay the lesson | "[Unflattering personal admission]. [Lesson delayed to a later line]." | General pattern across the solopreneur/inner-journey set (Arvid Kahl, Sahil Bloom) — no single verbatim quote verified, treat as a real but unsourced pattern |

## Joyful-activism patterns (preferred default for civic/social-issues material)

| # | Name | Mechanism | Shape | Real example (citation only — do not copy) |
|---|---|---|---|---|
| 16 | Naming Joy as Strategy, Not Reward | State outright that joy/celebration is the tactic itself, not something earned after winning | "[Joy/celebration] isn't the reward for [winning] — it's [the actual strategy]." | Favianna Rodriguez, Latino USA interview, on movement culture being "pain-oriented" |
| 17 | Playful Reframe of a Heavy Topic | Turn a civic duty into a verb, game, or activity tied to personal interest | "[Civic/heavy duty] is actually [a game/verb/activity tied to something you already love]." | Baratunde Thurston, "How To Citizen" — citizen as a verb (NPR interview, paraphrased coverage, no exact quote verified) |
| 18 | Communal We-Language Open | Open with shared labor framed as love/joy, not individual grievance | "The meaning of [work] is to [labor/act] for [cause] with [joy/love]." | Valarie Kaur, Bioneers talk: "The meaning of life is to labor for justice with joy." |
| 19 | Celebration-of-Outcome Open | Lead with elation over a real win before any ask or critique | "[Elated/thrilled] to see [specific real win] — [detail]." | LaTosha Brown, Black Voters Matter, NPR interview |
| 20 | Care/Tending-as-Role Framing | Describe movement work with nurture/tending language, name it as a distinct valued role | "[Role name] is the person who [nurtures/tends] [community/care/joy/connection]." | Deepa Iyer, Social Change Now — the "Caregivers" role |
| 21 | Body/Pleasure-Forward Claim | Open from physical feeling-good as the argument itself, not an abstract principle | "[Feeling good/pleasure] is not [frivolous] — it's [freedom/the point]." | adrienne maree brown, Pleasure Activism: "Feeling good is not frivolous. It is freedom." |
| 22 | Explicit Rejection of Duty/Guilt Register | Name the finger-wagging tone directly and reject it in the same breath | "[This work] shouldn't be a [finger-wagging/eat-your-vegetables] thing. It should be [joyful/something you co-create]." | Eric Liu, Citizen University |
| 23 | Short Trust/Faith Declarative | A brief, calm line affirming trust in a long process, standing in for hope without over-explaining | "[Short calm affirming line], [standing in for hope about a long process]." | adrienne maree brown, blog post title "i trust the trees" |

## Verification caveats (carry forward, don't drop)

- Patterns 15, 17, and 23 are supported by real, verified people and real context, but not by a
  single clean verbatim quote — treat the shape as real, not the specific wording.
- The joyful-activism register (16–23) is genuinely thinner in short-form (X/LinkedIn) than the
  outrage-framed register — most source material sits in Substack essays, books, and long-form
  interviews. That's a property of the niche, not a research gap; don't read it as license to
  invent a punchier quote that doesn't exist.
