# Hook pattern library

**Source:** research pass 2026-08-18 (two agent research runs: general niches, then a joyful-
activism-specific follow-up per Muxin's request) surveying real creators in Muxin's adjacent
niches (building/founder journey, solopreneurship, inner-journey/personal growth, civic
engagement, voting/democracy reform). Full source list and verification notes: see the research
transcripts referenced in the 2026-08-18 session; every attributed example below was independently
verified against a real source at research time.

## How to use this, read before drafting

**These are proven sentence SHAPES, not text to copy.** Muxin confirmed (2026-08-18): the value
here is "this structure is proven to work," never the wording itself. A pattern's "Shape" row is a
template with blanks. Fill every blank with a specific fact or phrase that is *already in the
source material being atomized*, the same reframe-never-invent guardrail every other spin pass in
this skill follows (`references/spin-mode.md`). The "Real example" row exists only to prove the
shape actually works in the wild; it is a citation, not a phrase bank. **Never reuse a real
example's exact wording, and never paraphrase it closely enough that it's recognizable as theirs.**
These are named, identifiable creators with audiences who know their own lines, a near-match reads
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
register (patterns 8–9, 11–12), people doing the work with love, care, and energy, not grievance.
Reach for the outrage register only when the source material itself is genuinely grief- or
anger-toned; don't impose a heavier register than the source actually carries.

## General patterns (building, solopreneurship, inner journey, civic: mixed register)

| # | Name | Mechanism | Shape | Real example (citation only, do not copy) |
|---|---|---|---|---|
| 1 | Relatable Enemy | Name a frustration the reader already feels, align with them against it before pitching anything | "[Everyday system/obligation] is [struggling/under pressure]. And [reader-aligned reaction]." | Justin Welsh's LinkedIn hook formula (relatable-enemy → aligned hero-statement → curiosity teaser) |
| 2 | Retrospective Numbers | Open with a specific number/timeframe from your own track record; context comes after | "[Time ago], I [did X]. We were at [metric], but everyone said [doubt]. Today [outcome]." | Nathan Barry, X, re: ConvertKit funding/MRR history |
| 3 | Process Specificity | Declare exactly what you did and how fast, promise a walkthrough | "Here's how I [did X] in [surprisingly short timeframe]." | Pieter Levels, X/thread openers |
| 4 | Universal Time/Mortality Truth | A blunt, undeniable truth about time, aging, or relationships everyone already half-believes | "[Do X] more, [it won't last forever / you'll regret not doing it]." | Sahil Bloom, X: "Call your parents more often—they won't be around forever." |
| 5 | Numbered-List Promise | A scannable payoff stated up front | "[N] things I know at [stage] I wish I knew at [earlier stage]." | Sahil Bloom, "35 Things I Know At 35 I Wish I Knew At 25" |
| 6 | Direct Question | Open by asking the reader something that implicates them personally | "[Question that implicates the reader personally]?" | Anne-Laure Le Cunff, Ness Labs: "What do you want to be when you grow up?" |
| 7 | Mid-Scene / In Media Res | Drop into a small sensory or emotional moment, no throat-clearing | "[Time marker], I [small sensory/emotional moment]…" | Anne-Laure Le Cunff, Ness Labs newsletter opener |
| 8 | Flat Moral-Clarity Claim | A short, undefended declarative sentence that reframes the reader's assumption | "[Short undefended claim reframing the reader's assumption]." | Anand Giridharadas, The.Ink: "I am tired of us being on the defensive." |
| 9 | Direct-Address to Named Subgroup | Speak straight to one specific slice of the audience by name | "I want to say to [specific group]: [message]." | Anand Giridharadas, X, address to a named political subgroup |
| 10 | Historical Echo Before Pivot | Open with a quote or scene from history/literature, then pivot to the present-day parallel | "[Quote/scene from history or literature]. [Pivot to present-day parallel]." | Heather Cox Richardson, Letters from an American, opens on a Robert Service poem line, pivots to current news |
| 11 | Named-Threat Framing | Name the specific mechanism or actor responsible, before explaining the situation | "[Specific mechanism/actor], not [the usual suspect], is [responsible for X]." | David Pepper, Pepperspectives, names state legislatures/gerrymandering as the mechanism |
| 12 | Redefinition Claim | Assert what something "really" is, against the common assumption | "The real [thing] isn't [common assumption], it's [reframe]." | Josh Silver, RepresentUs: "The most dangerous currency in American politics today isn't money, it's deception." |
| 13 | Named-Audience Callout | Open by naming the exact reader so the right person self-selects in | "If you're [specific reader type]…" | Dickie Bush, Ship 30 for 30 hook framework |
| 14 | Curiosity-Gap Teaser | State a claim, then a short unanswered "Why?" that forces the next line | "[Claim]. And [reaction]. Why?" | Justin Welsh's documented LinkedIn formula |
| 15 | Confession / Vulnerability Open | Lead with an unflattering personal admission, delay the lesson | "[Unflattering personal admission]. [Lesson delayed to a later line]." | General pattern across the solopreneur/inner-journey set (Arvid Kahl, Sahil Bloom), no single verbatim quote verified, treat as a real but unsourced pattern |

## Joyful-activism patterns (preferred default for civic/social-issues material)

| # | Name | Mechanism | Shape | Real example (citation only, do not copy) |
|---|---|---|---|---|
| 16 | Naming Joy as Strategy, Not Reward | State outright that joy/celebration is the tactic itself, not something earned after winning | "[Joy/celebration] isn't the reward for [winning], it's [the actual strategy]." | Favianna Rodriguez, Latino USA interview, on movement culture being "pain-oriented" |
| 17 | Playful Reframe of a Heavy Topic | Turn a civic duty into a verb, game, or activity tied to personal interest | "[Civic/heavy duty] is actually [a game/verb/activity tied to something you already love]." | Baratunde Thurston, "How To Citizen", citizen as a verb (NPR interview, paraphrased coverage, no exact quote verified) |
| 18 | Communal We-Language Open | Open with shared labor framed as love/joy, not individual grievance | "The meaning of [work] is to [labor/act] for [cause] with [joy/love]." | Valarie Kaur, Bioneers talk: "The meaning of life is to labor for justice with joy." |
| 19 | Celebration-of-Outcome Open | Lead with elation over a real win before any ask or critique | "[Elated/thrilled] to see [specific real win], [detail]." | LaTosha Brown, Black Voters Matter, NPR interview |
| 20 | Care/Tending-as-Role Framing | Describe movement work with nurture/tending language, name it as a distinct valued role | "[Role name] is the person who [nurtures/tends] [community/care/joy/connection]." | Deepa Iyer, Social Change Now, the "Caregivers" role |
| 21 | Body/Pleasure-Forward Claim | Open from physical feeling-good as the argument itself, not an abstract principle | "[Feeling good/pleasure] is not [frivolous], it's [freedom/the point]." | adrienne maree brown, Pleasure Activism: "Feeling good is not frivolous. It is freedom." |
| 22 | Explicit Rejection of Duty/Guilt Register | Name the finger-wagging tone directly and reject it in the same breath | "[This work] shouldn't be a [finger-wagging/eat-your-vegetables] thing. It should be [joyful/something you co-create]." | Eric Liu, Citizen University |
| 23 | Short Trust/Faith Declarative | A brief, calm line affirming trust in a long process, standing in for hope without over-explaining | "[Short calm affirming line], [standing in for hope about a long process]." | adrienne maree brown, blog post title "i trust the trees" |

## Mined patterns (added by `/patterns synthesize`, 2026-08-22 and 2026-08-23)

**Source, and how it differs from 1 to 23:** rows 1 to 23 came from a research pass over creators
in Muxin's niches. The rows below were mined from a corpus of real collected posts with recorded
numbers (`data/patterns/corpus.jsonl`, gitignored), analysed in `data/patterns/analyses.jsonl`, and
each one is a shape seen repeating across real posts rather than a shape observed once. **Rows 24 to
28 were mined at 53 and then 100 entries. Rows 29 to 31 were added on 2026-08-23 from a 292-entry
corpus in which every entry carries an analysis.**

**The bar rows 29 to 31 had to clear.** Only three were added from 192 newly analysed posts, and
that is deliberate. A shape was admitted only if it is distinct from all 28 above AND its supporting
posts were **genuinely, obviously popular in raw terms**: big point, view or upvote counts for the
place they ran in. That is the same gate `references/post-patterns.md` uses, and the floors are
stated there. Several good-looking single sightings were refused for having interesting ratios and
small raw numbers, including one bluesky construction, and they are recorded in
`data/patterns/analyses.jsonl` rather than here. Full-post structure for these lives in `references/post-patterns.md`
under the platform it was mined on; these rows cover only the opening.

**On the LinkedIn rows.** Rows 24 to 26 were written while the corpus's LinkedIn entries were
withheld pending a data-provenance check, and none of the three draws on a LinkedIn body. Row 27 was
added afterwards, once those entries had been rebuilt from raw `ld+json` page markup and verified
independently by the team lead on 2026-08-22. The earlier, paraphrased LinkedIn bodies informed
nothing in this file.

| # | Name | Mechanism | Shape | Real example (citation only, do not copy) |
|---|---|---|---|---|
| 24 | Named-Tool Handover | Name the technique and give away the entire mechanic in the same breath, so the value arrives before the viewer has decided whether to stay | "[Two or three word tool name] is [what kind of thing it is]. Here it is: [the whole mechanic, one sentence, nothing withheld]." | Ali Abdaal, YouTube shorts, his timer-based rule for starting when procrastinating; Mel Robbins, YouTube shorts, her two-word relationship technique. Seen at the opening in 5 posts across 3 creators; the full-post version is in `post-patterns.md` under youtube |
| 25 | State-and-Excuses Open | Recite the reader's current state and their own excuses back to them, in the order they would give them, closing the escape route before they can reach it | "There's something you know you should [do] today, and you're not doing it, because [their excuse], [their second excuse], [their third]." | Mel Robbins, YouTube shorts, her short on doing the hard thing, which is the full form; Nicole LePera, YouTube, who names the state without the excuses. Seen in 2 posts across 2 creators, both YouTube, and only one of the two is the complete shape |
| 26 | Found-Artifact Open | Lead with the labour you personally did and the one thing it turned up, so the reader is buying a discovery instead of an opinion | "[Real amount of time] into [the research you actually did], I found [one specific artifact] that [what it did to you]." | Anand Giridharadas, Substack (The Ink), the numbered chapters of his Epstein files series. Seen in 2 posts, one creator, both of them that account's outliers |
| 27 | Refused Premise | Reject, in the first line, a forced choice or a piece of received advice the reader has already accepted, so the post begins by taking a weight off them rather than adding one | "[The forced choice or the received advice, in the reader's own terms]. [Flat rejection, same breath, no hedging]." | Justin Welsh, LinkedIn, his post rejecting the standard quit-your-job advice, and his post refusing the money-or-freedom either-or. Seen at the opening in 2 posts across 2 creators, one refusing an either-or and one rejecting named advice; a third post uses the move after its opening line |
| 28 | Counterfactual Snap | Build an invented but recognisable world, voice the rationalisation someone would offer inside it, then snap to the real subject in one short sentence and stop | "If you lived in a world where [recognisable harm returning at a pinned scale], would you [work inside it] to make it less bad? \"[the rationalisation, in the voice of someone who means it]\" [Snap: this is what [the real subject] now sounds like.]" | Baldur Bjarnason, Mastodon, his post transposing a technology-industry argument onto a different regulated industry. Single sighting, and the largest clean multiple in the corpus at 37.3x on its best-sampled platform. DISTINCT FROM 10: pattern 10 opens on a REAL historical scene and pivots; this builds an INVENTED counterfactual and embeds a quoted rationalisation inside it |
| 29 | Scope Tightener With the Unit Named | Ask the question, then immediately rule out the low-effort answers by tightening the scope in one clause, and name the unit an answer should arrive in, so replies are comparable to each other instead of a pile of anecdotes | "[The question, naming the specific things being compared] [+ a tightener that rules out the casual case: fully, as the main tool, not as a side experiment]? [Then: what an answer should contain, with the UNIT named in a parenthesis]." | Two Ask HN submissions, one about replacing a commercial model with a local one for daily work and one about managing a constant stream of ideas. Seen in 2 posts across 2 submitters, at 439x and 41x the TRUE median of every story submitted to that platform in a full 24-hour window (median 3 points, 90th percentile 22). The shorter of the two produced 563 comments off about 230 characters. DISTINCT FROM 6: pattern 6 implicates the reader personally and wants a feeling; this one narrows a factual question and specifies the format of the answer |
| 30 | The Universal Opener | Open on a blunt fact that is true of every reader regardless of whether they care about your subject, then narrow to your subject afterwards, so the audience is recruited before the topic can filter them out | "[Fact true of everyone, second person, under six words]. [Its consequence, with a real time unit or number]. [If that is so, why are you [the thing they are doing]?]" | Matt Gray, TikTok, his 26 second video opening on mortality. Single sighting, and one of the largest raw results in the corpus: 896,100 views, against six siblings on the same account running 248 to 2,805 views and an account median of 782 across the seven collected. Its six siblings all open by addressing founders and run 248 to 2,805 views. DISTINCT FROM 4: pattern 4 leads with the INSTRUCTION and uses mortality as the justification; this one leads with the bare fact, withholds any instruction until the final beat, and its whole mechanism is that beat 1 contains no niche word at all |
| 31 | The Outsider's Concession | Open by apologising to the group and admitting you personally held the exact belief the group is tired of hearing, before offering any evidence, so the reader gets vindication instead of another diagnosis | "[Apology, addressed to the group, before any content]. [Admit having held the dismissal that group actually hears, phrased the way they hear it]. [Why it seemed reasonable at the time]. [Flat correction, one sentence]." | The top-of-year post in r/ADHD, written by someone without the condition who lives with two people who have it. Single sighting, and the largest absolute and relative result in the reddit set: 12,286 upvotes at 4,095x that community's TRUE median of 3, computed from an unbiased 163-post window of its /new listing. DISTINCT FROM 15: pattern 15 is an unflattering admission about YOURSELF with the lesson delayed; here the confessor is not the subject, the group is, and what is conceded is the group's own long-running argument |

## Verification caveats (carry forward, don't drop)

- Patterns 15, 17, and 23 are supported by real, verified people and real context, but not by a
  single clean verbatim quote, treat the shape as real, not the specific wording.
- Pattern 26 is supported by only 2 posts from a single creator. Both are large outliers for that
  account, which is why it is recorded, but treat it as promising rather than proven until a second
  creator shows the same shape.
- Patterns 24 and 25 were mined from short-form video, where a hook is the first three seconds of
  spoken words. Both should transfer to text, but that has not been measured here.
- Pattern 25 rests on 2 posts and only one of them is the complete shape (state plus the reader's
  own excuses); the other names the state alone. It is the thinnest of the three mined rows. Neither
  post had a retrievable view or like count, so there is no performance evidence behind it at all,
  only the structure.
- Pattern 27 rests on 2 posts that carry the shape at the opening. Both are strong performers for
  their accounts but neither is a measured outlier, and LinkedIn exposes no view counts, so there is
  engagement evidence behind it but no reach evidence.
- Rows 24 to 26 draw on no LinkedIn body.
- Pattern 28 rests on a SINGLE post. It is included, where other single sightings encountered in the
  same mining pass were refused, and the reason is worth recording so the bar stays consistent: this
  one is the largest clean multiple measured anywhere in the corpus (37.3x) and it comes from the
  only platform sampled without cherry-picking, so it carries real performance evidence. The single
  sightings that were refused had either no performance evidence or negative performance. n=1 with a
  strong measured result on an unbiased sample is not the same as n=1 with none, but it is still
  n=1: treat the shape as promising, not proven, until a second creator is seen using it. If LinkedIn entries later clear their
  provenance check, they may add rows; they did not inform these.
- Pattern 29 is the best-evidenced row in this file. Its two posts drew 1,318 and 124 points and
  563 and 149 comments, and its baseline is the only one in the corpus measured against an entire
  PLATFORM rather than one account or one community: every story submitted in a full 24-hour window,
  1,000 of 1,012, whose median is 3 points and whose 90th percentile is 22. The one limit: both are
  Ask-prefixed posts on a forum whose audience self-selects by subject, so whether the tightener
  transfers to a follower feed is untested.
- Patterns 30 and 31 each rest on a SINGLE post, and are admitted on exactly the precedent pattern
  28 set: n=1 carrying a genuinely large result is not the same as n=1 with none. 896,100 views and
  12,286 upvotes are both far too large to be noise, and both are the biggest results in their
  platform's set. **They are still n=1.** Treat
  each as promising rather than proven until a second creator is seen using it.
- Pattern 30 was mined from short-form video, where the hook is the first three seconds of spoken
  words. Its evidence is the raw view count, not a ratio; this library gates on plain popularity. Like patterns 24 and 25 it should transfer to text, and like them that has not been
  measured here. Note also that this corpus can see the video's WORDS and nothing else: no cuts, no
  faces, no first visual frame.
- Pattern 31 was mined from a community forum, where a post is read by people who chose that
  community. Its mechanism depends on the group having a standing grievance about being disbelieved,
  and on Muxin genuinely being the outsider. Used by an insider it inverts into pattern 15, which is
  a different and weaker post. Do not reuse the mined post's list of observed behaviours in its
  order; the analysis file notes that a previous pass caught itself doing exactly that with a
  different creator.
- **A widely believed thing this corpus tested and did NOT find, kept here so it does not creep back
  into a hook row.** On TikTok, neither the length of a video nor the presence of on-screen text
  predicts how it ranks within its own account (35 seconds or less averages a rank percentile of
  0.51 against 0.50 for longer; with on-screen text 0.49 against 0.51 without). And across 23
  accounts with real windows, the top post is shorter than that account's own average in 11 and
  longer in 12. No hook row here should be justified on the grounds that it is short.
- The joyful-activism register (16–23) is genuinely thinner in short-form (X/LinkedIn) than the
  outrage-framed register. Most source material sits in Substack essays, books, and long-form
  interviews. That's a property of the niche, not a research gap; don't read it as license to
  invent a punchier quote that doesn't exist.
