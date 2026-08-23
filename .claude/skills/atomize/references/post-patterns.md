# Full-post pattern library

The structure library that sits alongside `references/hook-patterns.md` and
`references/civic-adaptation.md`. Hook patterns cover the first line. This file covers the whole
post: the arc after the hook, what it makes the reader feel, how it closes, and how long it runs.

**Status: partly mined, synthesis run 2026-08-22.** `substack` (6 patterns), `youtube`
(5 patterns) and `linkedin` (4 patterns) carry mined records. LinkedIn was withheld from the first
pass pending a data-provenance check, then cleared and mined once its entries had been rebuilt from
raw page markup and independently verified. **Every other platform section below is still a
placeholder.** This file is populated by `/patterns synthesize`, the synthesis step of the pattern-mining
pass. **If you are drafting for a platform whose section still reads "Not yet mined", fall back to
`references/hook-patterns.md`** and to the per-channel angle in `config/platforms.yaml`
`spin_angles`. An empty section is not permission to invent a structure and call it proven, and a
populated section is never permission to carry its patterns to a different platform.

## How to use this, read before drafting

**These are proven post SHAPES, not text to copy.** Same guardrail hook-patterns.md carries, scaled
up from one sentence to a whole post. A pattern's "Shape" row is a skeleton with blanks. Fill every
blank with a specific fact, line, or phrase that is *already in the source material being
atomized*. The structure is the borrowed thing. The words are always Muxin's.

A "Real example" row exists only to prove the arc works in the wild. It is a citation, never a
phrase bank. **Never reuse a real example's wording, and never paraphrase it closely enough that a
reader who follows that creator would recognize it.** These are named people with audiences who
know their own posts. A near-match reads as plagiarism, not inspiration, and it breaks the
extraction-first rule this whole pipeline runs on (CLAUDE.md rule 1).

Two specific ways a full-post pattern can go wrong that a hook pattern cannot:

- **Padding to fit the arc.** If the source has three beats and the pattern wants five, use a
  different pattern. Do not manufacture beats 4 and 5.
- **Importing the example's claim.** A structure can carry a number, a result, or a customer story
  in one of its slots. That slot gets filled from Muxin's own material or it stays empty. Never
  from the cited creator's post.

**When this applies:** the same gate as the storytelling re-hook pass, `appliesRehook(platform,
sourceKind)` in `src/atomize/spin.ts`. That gate now covers every platform except ones explicitly
opted out with `rehook: false` in `config/platforms.yaml`, and it still never applies to a
Notes-sourced folder (`source_kind: substack-note`), which stays a near-verbatim cross-post.

**How this file gets written:** the `/patterns` skill collects real posts into `data/patterns/`
(gitignored, other creators' full text never enters git), scores them for outlier reach, and
`/patterns synthesize` distills the winners into records below. Only the distilled shapes are
committed. If you want to change what gets mined, edit `config/pattern-mining.yaml`, not this file.

## What separated the winners from the same creators' ordinary posts

**This is a run-level finding from the 2026-08-22 mining pass, not a pattern record.** It is placed
above the patterns because it is more useful than any single skeleton below: it tells you what to
ask of a draft, rather than which shape to pour it into. It comes from a 58-post corpus in which
most creators contributed 4 or 5 posts, so an outlier could be compared against the same person's
ordinary work. That comparison is the thing a list of famous posts cannot give you.

**The finding:** the post that beats a creator's own baseline is the one that gives the reader
something that creator's ordinary posts do not. Recycled and inward-facing material lost every time
it appeared.

Three measured contrasts sit behind it:

- **Shorter than their own average, in 7 of the 10 accounts** with two or more scored posts. Six of
  those are dramatic, from 0.03x to 0.62x of the creator's own mean length. **Two of the seven come
  with a caveat that changes their meaning:** on one LinkedIn account and one Instagram account the
  short winner was a CAPTION over a visual, so the brevity is a property of the caption, not of the
  post. Those two are not evidence that short text wins. They are evidence that a visual did work
  the text did not have to. The LinkedIn one is now confirmed: that image was recovered and it
  carries a full compressed argument, so the post was never short in substance, only in text. The
  Instagram carousel's slides were still never collected. See the media section below, which turns
  this caveat into the corpus's strongest measured result.
- **No link.** In all 4 accounts that had both linked and unlinked posts, the top post was the one
  with no link. **The honest counterexample:** one creator links on all five of his posts and still
  records the highest raw engagement in his platform's set. So this is about relative performance
  inside one creator's feed, not a rule that links suppress reach.
- **A person, not a topic.** The winners center someone specific where the same creators' ordinary
  posts center a subject. One Bluesky post naming and praising one person drew 10,135 likes against
  153 for that same author's most carefully constructed post, a 66 to 1 gap on 84 characters versus
  297.

**The three exceptions are what make this credible rather than a slogan.** Not every winner was
short, and the ones that were not are the most instructive:

- One Substack account's two outliers are among its LONGEST posts and still beat its ordinary posts
  tenfold. What they have is original labour: each opens on something the author personally found in
  a primary source. That account's two losers are openly recycled, a revisited interview and a
  republished book excerpt.
- Another Substack account's winner is LONGER than its own average. What it has is timing plus a
  named tool aimed at the exact week the reader was living through.
- One YouTube account's best scored post is its longest of the two, not its shortest.

So "shorter wins" is the wrong lesson and this file does not teach it. The right question to ask of
a draft is: **what does this give the reader that my ordinary posts do not?** Brevity is one answer.
A specific person is another. Original labour is another. **A real image is a fourth, and it is the
only one of the four the corpus can prove**, which is the subject of the next section. Having no
answer is the failure the losing posts in this corpus share.

**One honest limit.** These are engagement comparisons within a single creator's feed, mostly on
raw like counts, on posts of different ages, and on platforms where view counts are not public.
They show relative performance inside an account. They are not controlled experiments, and no
causal claim here has been tested.

## What form the post takes, and the one thing the corpus can prove about it

**A second run-level finding from the 2026-08-22 mining pass, not a pattern record.** Like the
section above it, this is something to ask of a draft before reaching for a skeleton. It comes from
a `media.form` classification on 56 of the 58 corpus entries.

The control that matters here is `body_is_complete`. Some entries are posts whose substance sat in
something never collected, an image, a carousel, a thread, being scored on engagement that
substance earned. Dropping those is what separates a real result from an artifact.

| form | all scorable | body-complete only |
|---|---|---|
| mixed | 2.74x on 12 | 2.63x on 11 |
| image | 2.18x on 17 | **2.19x on 13** |
| text-only | 0.62x on 8 | **0.62x on 8** |
| carousel | 6.34x on 2 | nothing left |
| thread | 23.84x on 1 | nothing left |
| video | 7.69x on 1 | nothing left |
| short-video | 5.89x on 1 | nothing left |

**There are exactly two defensible claims here. Do not extract a third.**

### 1. A post carrying an image outperforms a text-only post, and this survives every control

2.19x on 13 body-complete entries against 0.62x on 8. It is the most trustworthy result in this
corpus, and three independent things back it up:

- **Within one account, holding audience and period constant.** One LinkedIn creator's five posts:
  his four image posts run 5.06x, 1.68x, 0.88x and 0.63x, and his single text-only post is his worst
  at 0.53x. The gradient inside that is worth as much as the ranking. The more the image carried and
  the less the caption said, the better the post did.
- **Convergent professional practice.** 14 of 15 LinkedIn posts in the corpus, from three separate
  creators who do this for a living, carry an image. They arrived at that independently.
- **It is not one account's artifact.** The 8 text-only entries span 4 creators on 4 platforms.
  Excluding the two search-biased X entries, the remaining 6 average 0.78x, still far below the
  image figure. Bluesky points the same way but weakly, image 8.35x against text-only 0.69x at
  n=2 per side, which is directional only.

**Where this does NOT apply: Substack.** The Substack numbers look like a win for illustration,
2.74x on 12 illustrated posts against 0.91x on 3 plain-text ones, and **you should not believe
them.** All three plain-text posts belong to one author whose absolute numbers dwarf every other
account in the corpus. That is an account effect wearing a form effect's clothes. **The corpus
cannot tell whether illustrating a Substack essay helps.** Treat it as an open question.

### 2. Every other form is unmeasured, and that is a collection gap, not a verdict

Carousel, thread, video and short video all lose their entire body-complete sample. Whatever their
rows say in the left column, the corpus has no controlled evidence about any of them.

**This matters most for short video, so say it plainly: the absence of short video from the
evidence above is a failure of collection, not a finding about short video.** Short video is the
second most common form in the corpus at 15 of 58 entries, and only ONE of those 15 is scorable at
all. The other 14 returned no usable metrics, because the platforms hide play counts and like counts
from a logged-out reader. All 11 YouTube entries are Shorts, confirmed against the platform's own
classification at 24 to 159 seconds, vertical and captioned, four of them behind ordinary watch URLs
that disguised it.

Nothing in this file says short video does not work. This corpus simply cannot see it. A reader who
concludes otherwise has misread the table, and a future collection run that fixes the metrics
problem for short video would be the single highest-value improvement to this corpus.

### What to do with this

Ask of any draft: **is this carrying an image, and is the image doing real work?** On LinkedIn the
answer should almost always be yes, and the corpus's strongest single instance is a post where the
image carried the whole argument and the text was a lead-in. On Substack the honest answer is that
nobody knows. On short video there is no answer here at all.

One measure of how far this goes: the single highest-engagement post in the entire corpus, at 38,442
likes, is 331 characters whose body ends on a photo credit and stops. The photograph is the post.
Note that this entry is flagged body-incomplete and therefore sits outside the controlled figures
above, so it illustrates the point rather than proving it.

## Record format

Every pattern `/patterns synthesize` writes into a platform section below uses exactly these
fields, in this order:

```
### <N>. <Pattern name>

- **Platform:** the platform this was mined on (one of the section headings below)
- **Mechanism:** one sentence on why this structure holds attention
- **Structure / arc:** the ordered beats, one per line, each with what the beat has to do
- **Emotional trigger:** what the reader feels, and where in the arc they feel it
- **Immediate personal payoff:** what the reader gets or avoids RIGHT NOW (time, money, power,
  protection of something they care about), and where the arc makes that payoff land. Required on
  every record, civic or not
- **CTA style:** how it closes, or "none" if the winners in this pattern do not ask for anything.
  CIVIC GATE: on civic or social-issues material a CTA has TWO accepted forms. One, a specific
  micro-action the reader can finish in under 5 to 10 minutes. Two, belief- or value-aligned
  matching, kept neutral and record-based, built on an actual vote or an actual position on the
  record and never a partisan characterization. Both must point at something real and verified.
  Never "vote", "get involved" or "stay informed". Value-matching carries the harder rule: if the
  record cannot be verified it is not written at all, not written with a caveat and not labeled as
  needing verification. That is deliberate, not an oversight. A wrong claim about how someone voted
  is a factual assertion about a real person, not a soft guess. See
  `references/civic-adaptation.md` for both forms and the never-invent-a-link rule
- **Length and formatting:** word or character range, paragraph breaks, line breaks, list use,
  hashtag count, emoji use
- **Shape:** the fill-in-the-blanks skeleton, one bracketed blank per beat
- **Real example:** creator, platform, and enough context to find it. Citation only, do not copy.
```

Rules for a written record:

1. Every blank in **Shape** is bracketed and describes what fills it, never a sample phrase.
2. **Real example** is a pointer, not a quote. A short quoted fragment is allowed only where it is
   needed to identify the post, and it is never reused in a draft.
3. A pattern with fewer than three collected posts behind it is marked `(thin evidence)` on its
   name, the same caveat convention hook-patterns.md uses for its unverified rows.
4. A civic or social-issues record with neither a real, verifiable micro-action nor a real,
   verifiable value-matching close available falls back to the general CTA default rather than
   inventing a link, form, deadline, race, ballot measure, or voting record
   (`references/civic-adaptation.md`).
5. No em dashes anywhere in a record (CLAUDE.md rule 5).

## Patterns by platform

What wins is not the same on a 280-character feed and a 40-minute video, so patterns are filed by
the platform they were mined on. Do not carry a pattern across a section heading without evidence
from that platform.

### x

Not yet mined. Fall back to `references/hook-patterns.md`.

### linkedin

**Provenance:** mined by `/patterns synthesize` on 2026-08-22 from 15 LinkedIn analyses, corpus at
58 entries at this run, across 3 accounts (Justin Welsh, Dan Koe, Codie Sanchez), all in the
`building-solopreneur` niche. Not civic, so no civic adaptation is applied; run any civic piece
through `references/civic-adaptation.md` table 1 before using these.

**Data history, because it matters.** These 15 entries were purged from the corpus mid-build and
rebuilt from raw `ld+json` page markup, after a summarizing fetch was found to have returned
paraphrased bodies and, on one post, a COMMENT written by a different person under the creator's
name. The rebuild was verified independently before these patterns were written. Anything you may
have read that was mined from the earlier bodies is void.

**LinkedIn has no public view counts** (impressions are owner-only), so all 15 entries score on
engagement baseline alone, never on a view ratio. One outlier fired here, at 5.1x, and it is the
one pattern below you should be most careful with.

**Why there are 4 patterns and not 7.** Two arcs dominate these 15 posts. Most of the rest are
single sightings, and writing them up as patterns would be describing individual posts, which is
the failure mode this file is meant to avoid. Four evidenced shapes are the honest yield.

**The formatting is the platform signature, and it is not optional.** All 15 posts break almost
every sentence onto its own line, with blank lines between: 33 to 46 line breaks in a 1,000 to
1,400 character post, 65 in a 2,651 character one. Fragments are used as beats. Lists of
professions, negations, or constraints are stacked one item per line so a scrolling reader can
self-select without reading prose. Assume this formatting in every Shape below; it is recorded once
here rather than repeated in each record.

#### 1. The Numbered Playbook

- **Platform:** linkedin
- **Mechanism:** the post pays off completely on its own with a set of discrete, labelled plays, and
  the offer at the end is positioned as more of the same rather than the missing piece, so the
  reader never feels the body was a toll gate. Seen in 5 posts across all 3 creators, the most
  repeated arc on this platform in the corpus.
- **Structure / arc:**
  1. A claim or a promise stated in one line, usually counted.
  2. A short concession that it is hard, which pre-empts the obvious objection.
  3. The condition, meaning what has to be true for the plays to work.
  4. A signposted handoff into the list.
  5. N numbered or dashed plays, each with a short label and two to three sentences under it.
  6. A closing frame naming the plays as the writer's own.
  7. A second concession, that getting them right is not easy, which opens the gap.
  8. One free resource named with its full title, and exactly one link.
- **Emotional trigger:** competence within reach. Each labelled play is small enough to picture
  doing, and the two concessions at beats 2 and 7 stop the post reading as a pitch.
- **Immediate personal payoff:** several concrete operating rules usable this week, delivered in
  full before any click. It lands across beat 5, which is why beat 5 must be genuinely complete
  rather than teased.
- **CTA style:** one click to one free resource, named by its full title, with the link last and
  nowhere else. Non-civic material, so the ordinary `config/cta.yaml` pillar default applies and the
  CTA stays conditional. Note the account-level observation: the creator who links on all five of
  his posts still posts the highest raw numbers here, so a link is not a penalty in this shape.
- **Length and formatting:** 550 to 2,650 characters. Numbered or dashed items with labels, blank
  line between each. Single-sentence paragraphs throughout. No emoji except occasionally one in a
  closing line, no hashtags. The link sits at the very bottom, after the resource is named.
- **Shape:**
  ```
  [Beat 1: the promise, counted: "[N] [plays/steps/traits] for [specific outcome]"]
  [Beat 2: concede it is hard, one line, before anyone objects]
  [Beat 3: the condition, what has to be true for these to work at all]
  [Beat 4: the handoff line into the list]
  [Beat 5: play 1, a short label, then 2 to 3 sentences of how it actually works]
  [Repeat beat 5 for each play, keeping the label-then-explanation shape identical]
  [Beat 6: name them as your own, one line]
  [Beat 7: concede that getting them right is hard, which is what the resource is for]
  [Beat 8: one free resource, named in full, one link, nothing else]
  ```
  Every play at beat 5 must be something Muxin has actually run. N must equal the number delivered.
- **Real example:** Justin Welsh, LinkedIn, his numbered posts on running a one-person business,
  each closing on the same free field manual. Also Codie Sanchez, LinkedIn, her stepwise post on
  acquiring a small business. Citation only, do not reuse the wording.

#### 2. The Refused Premise

- **Platform:** linkedin
- **Mechanism:** line one rejects a choice or a piece of advice the reader has already accepted, and
  the rest of the post supplies the version that fits their real life, so the reader who felt
  cowardly is handed a defensible position instead of a push. Seen in 3 posts across 2 creators.
  Related hook shape: pattern 27 in `hook-patterns.md`.
- **Structure / arc:**
  1. The forced choice or the received advice, stated in the reader's own terms, then rejected flat.
  2. The reader's real constraints, listed one per line, concrete and unglamorous.
  3. A summary line naming what those constraints add up to.
  4. A concession to the appeal of the reckless version.
  5. The alternative introduced as the reasonable route.
  6. Numbered steps, each one line, that fit alongside the reader's current life.
  7. A specific numeric threshold that tells them when they are allowed to take the bigger step.
  8. The permission, then the reasoning for why the threshold is the right one.
  9. The hard part named honestly, which opens the gap the resource fills.
- **Emotional trigger:** defence of the cautious reader. This niche mostly shames people for not
  leaping. Beat 2 is what earns the trust, because it proves the writer knows what the reader
  actually has at stake.
- **Immediate personal payoff:** permission to keep their current situation without feeling like a
  coward, plus a number to aim at. It lands at beat 7, and a version of this shape without a
  specific threshold degrades into a mood.
- **CTA style:** one free resource and one link, same as pattern 1. Non-civic, so the
  `config/cta.yaml` default applies and stays conditional.
- **Length and formatting:** 1,200 to 2,700 characters. The most heavily line-broken shape in the
  set, up to 46 breaks. Stacked constraint lists, a short numbered block, one-word paragraphs used
  as beats. No emoji or hashtags.
- **Shape:**
  ```
  [Beat 1: the advice or forced choice, in the reader's own words, then rejected in one line]
  [Beat 2: their real constraints, one per line, concrete (what they owe, who depends on them)]
  [Beat 3: one line naming what those add up to]
  [Beat 4: concede why the reckless version is appealing]
  [Beat 5: your alternative, introduced as the reasonable route rather than the bold one]
  [Beat 6: the steps, numbered, each one line, each doable alongside what they already do]
  [Beat 7: the threshold, a specific number that tells them when to take the bigger step]
  [Beat 8: the permission, and why that number is the right one]
  [Beat 9: the hard part, named honestly, then the resource and one link]
  ```
  Beat 7's number has to come from Muxin's own experience or her own reasoning she can defend.
  Inventing a threshold is inventing proof.
- **Real example:** Justin Welsh, LinkedIn, his post rejecting the standard quit-your-job advice and
  giving a keep-your-salary route with a stated income threshold. Citation only, do not reuse the
  wording.

#### 3. Status Deflation `(thin evidence)`

- **Platform:** linkedin
- **Mechanism:** a person the reader would consider qualified immediately removes the qualification,
  either by listing their own unremarkable origins, by listing what the success cost them, or by
  saying the successful people they know lack the credentials the reader assumes are required. In
  all three the reader loses their reason to feel disqualified. Seen in 3 posts across 2 creators.
- **Structure / arc:**
  1. The status fact, stated plainly and briefly, with no dwelling on it.
  2. The deflation, immediate, stacked one item per line: ordinary origins, real costs, or absent
     credentials.
  3. The turn, naming what actually explains the outcome, which is always something unglamorous and
     available to anyone.
  4. The close, which is either a flat statement of gratitude, or a small instruction to act today.
- **Emotional trigger:** removal of an excuse, delivered as humility rather than as a challenge.
  Beat 2 has to be genuinely unflattering or the whole thing reads as a humblebrag.
- **Immediate personal payoff:** relief from believing they are unqualified, and in the instruction
  variant, one small step available the same day. It lands at beat 3.
- **CTA style:** varies, and the variation is the finding. The version with NO ask and NO link is
  the top-performing post of its account by more than two and a half times, and it is that
  creator's only post without a link. The versions that close on a link sit below it. Consistent
  with the corpus-wide no-link observation recorded in the findings section near the top of this
  file. Non-civic, so the `config/cta.yaml` default applies and stays conditional.
- **Length and formatting:** 300 to 1,000 characters, short for this platform. Stacked one-per-line
  deflation list, single-sentence paragraphs, no numbering. No hashtags.
- **Shape:**
  ```
  [Beat 1: the status fact, one line, stated flat and then dropped]
  [Beat 2: the deflation, stacked one per line. Pick ONE fill and stay in it:
     (a) your ordinary origins, or (b) what it actually cost you, or
     (c) what the successful people you know visibly lack]
  [Beat 3: the turn, what actually explains it, and make it available to anyone]
  [Beat 4: close on gratitude with no ask, or on one small thing to do today]
  ```
  Beat 2 must be true and must be genuinely unflattering. A softened version inverts the mechanism
  and reads as boasting.
- **Real example:** Codie Sanchez, LinkedIn, her short post listing her unremarkable background and
  closing on gratitude with no link, her highest-performing post in this corpus. Also Justin Welsh,
  LinkedIn, his short post on what successful entrepreneurs he knows do not have. Citation only, do
  not reuse the wording.

#### 4. Caption Over Image `(thin evidence, and read the warning)`

- **Platform:** linkedin
- **Mechanism:** a one-line caption carries no information and exists only to frame an attached
  image, which carries every claim the post makes. Seen in 2 posts from 1 creator, and they are that
  creator's top two by a wide margin.
- **READ THIS BEFORE USING THE TEMPLATE.** The 5.1x outlier behind this pattern is a 22-character
  caption over an image, and **the image has since been recovered and read**, so this record no
  longer describes something invisible. What is now known: the image is a vertical quote card,
  light sans-serif text on a solid dark field, carrying a compressed argument built from one unit of
  time repeated across four short parallel lines and closing on how that unit compounds over a year.
  The caption is a lead-in and carries no argument at all. **What is still unknown is why that
  particular card worked**, because the corpus holds exactly two posts of this form from one
  creator, with no variants to compare against. So the FORM is evidenced and the craft inside the
  image is not. Anyone who reads this as "write four words and win" will omit the half that did the
  work and publish an empty post. This is not a licence to post fragments.
- **Structure / arc:**
  1. The image carries the entire substance: the claim, the framework, the list, the argument.
  2. The caption does one job only, and it is not summary. In the two collected examples it is
     either a bare plea, or a line asserting that the image matters more than it appears to.
  3. Nothing else. No explanation, no link, no list.
- **Emotional trigger:** produced by the image, not the caption. In the recovered example it is the
  relief of a very small commitment: a unit of effort stated so low that refusing it feels
  unreasonable, then compounded to make it feel consequential. The caption's only contribution is a
  referential gap that gives the reader a reason to look down.
- **Immediate personal payoff:** delivered by the image. In the recovered example, permission to
  start at an amount the reader cannot argue is too much, plus a reason to believe it adds up.
- **CTA style:** none in either collected post, and neither carries a link. That is consistent with
  the corpus-wide observation that within an account, the post without a link tends to be the top
  one, but here it may simply be that a caption has no room for one. Do not over-read it.
- **Length and formatting:** 22 to 62 characters of caption. One line, no breaks, no list, no emoji,
  no hashtag, no link. Plus an image, which is the actual post and which this corpus does not have.
- **Shape:**
  ```
  [The image: carries the entire substance. This is the post. Build it first and build it well.]
  [The caption, one line, doing ONE job and not summarising the image:
     either a direct ask, or a claim that the image matters more than it looks like it does]
  [Nothing else. No explanation, no link.]
  ```
  **Do not use this shape unless the image is genuinely strong enough to carry the post by itself.**
  The corpus can now show one image that worked and what it contained, but two posts from one
  creator is not enough to say what makes such an image good in general. That judgment is still
  largely Muxin's.
  The measured backing for the form itself is in the media section above: image posts run 2.19x
  against 0.62x for text-only across 13 and 8 body-complete entries.
- **Real example:** Dan Koe, LinkedIn, his two highest-engagement posts in this corpus, both
  one-line captions over attached images. The higher of the two is a dark quote card whose text
  repeats a single unit of time across four parallel lines. Citation only: describe the shape, never
  reproduce his lines, and this applies to the text inside the image exactly as it applies to post
  copy.

### substack

**Provenance:** mined by `/patterns synthesize` on 2026-08-22 from 16 Substack analyses in a
53-post corpus, across 4 accounts (Anand Giridharadas, Heather Cox Richardson, David Pepper, Deepa
Iyer). 5 of the corpus's 8 scored outliers are Substack posts. Every Substack entry in the corpus
sits in the `civic-democracy` niche, so **every pattern below is written in its ADAPTED form** per
`references/civic-adaptation.md` table 1; each Mechanism line records the raw shape it came from.
The joyful-activism register default (hook-patterns.md 16 to 23) applies to all of them unless the
source is genuinely grief or anger toned.

**One honest note on the CTA fields.** Almost none of the winners behind these patterns closed on
anything a reader could finish. They closed on Share, Subscribe, or nothing. That is a finding
about how this niche actually behaves, not a defect in these records, and it is exactly the gap
Muxin's rubric exists to close. The adapted CTA slot in each Shape is a requirement she is imposing
on the shape, not something the mined creators were doing.

#### 1. The Found Artifact `(thin evidence)`

- **Platform:** substack
- **Mechanism:** the writer earns the right to a big claim by showing one small thing they
  personally found in a primary source, so the reader is buying a discovery rather than an opinion.
  Raw viral shape it came from: the investigative reveal, where a creator teases a single stunning
  item and spends the piece unpacking it. Seen in 2 posts, both from one creator, and both are that
  account's outliers at 10.3x and 9.4x its baseline. One creator, so treat this as promising rather
  than proven.
- **Structure / arc:**
  1. Series marker, if this belongs to one, so the reader knows it is an instalment.
  2. The question or anomaly, in one sentence, phrased as something the writer noticed.
  3. The labour that produced it, named concretely (how long they spent, what they read).
  4. The artifact itself, quoted or described at length and read closely.
  5. The fair concession: where the evidence does not support the writer's own reading.
  6. The widening, from the one artifact to what it says about the larger system.
  7. The landing, a short line that puts the finding back in the reader's hands.
- **Emotional trigger:** the pull of a specific, non-duplicable find. The reader cannot get this
  from the feed around them, and the concession step makes the writer feel fair rather than
  motivated, which is what lets a sceptical reader accept the conclusion.
- **Immediate personal payoff:** a concrete thing to point at. The reader arrives with a vague
  suspicion about a public matter and leaves with one specific document, number, or record they can
  cite in an argument this week. It lands at beat 4 and must be usable without the rest.
- **CTA style:** the mined winners closed on Share, Leave a comment, and Subscribe, all platform
  asks, none completable. ADAPTED, civic gate: close on a micro-action against the same artifact
  class the piece just read, for example looking up one named record on the public portal the piece
  used, in under 5 minutes, and only if that portal or record is verified as real and current. If it
  cannot be verified, fall back to the `config/cta.yaml` civic-tech default. Value-matching is the
  other accepted form and fits this shape well, but only off a vote or a stated position actually on
  the record; if the record cannot be verified it is not written at all.
- **Length and formatting:** 20,000 to 22,000 characters in the mined winners, though this corpus
  shows length is not the driver on this platform. Paragraphs of two to five sentences, heavy
  indented quotation of the primary document, one-line paragraphs at each turn. No lists, no emoji,
  no hashtags. Links only in the header index and the footer, never mid-argument.
- **Shape:**
  ```
  [Beat 1, optional: series name and instalment number, so returning readers know where they are]
  [Beat 2: the anomaly you noticed, one sentence, as a question you put to the source]
  [Beat 3: the labour, a real number from your own work (months spent, records read)]
  [Beat 4: the artifact, quoted or described at length, with the detail that stopped you]
  [Beat 5: the concession, one place the evidence genuinely cuts against your reading]
  [Beat 6: the widening, what this one artifact reveals about how the larger thing operates]
  [Beat 7: the payoff line, what the reader can now point at in their own conversations]
  [Beat 8: the close, one verified micro-action against the same record source, under 5 minutes]
  ```
  Every blank is filled from the writer's own research. Beat 3's number must be real; if no such
  labour happened, this shape does not fit the piece.
- **Real example:** Anand Giridharadas, Substack (The Ink), the numbered chapters of his Epstein
  files series, each opening on something he noticed while reading the released documents. Citation
  only, do not reuse the wording.

#### 2. Named Practice for This Moment

- **Platform:** substack
- **Mechanism:** a reader in overwhelm cannot act on an argument but can act on a named tool, so
  the piece hands over a labelled practice plus explicit permission to use only part of it. Raw
  viral shape it came from: the framework post, where a creator brands a method and teaches it.
  Seen in 4 posts, all from one creator, whose top two posts both use it and whose best is a 3.5x
  outlier. One creator, so the count shows consistency, not cross-creator proof.
- **Structure / arc:**
  1. The offer in one sentence: what this is, who it is for, and the named tool it uses.
  2. Permission, up front, to take what fits and leave the rest. This is load-bearing.
  3. A personal anchor from a comparable past moment, kept short.
  4. The bridge to the reader's present, naming what people have actually been asking.
  5. The practice itself, in named sections, each an instruction rather than an argument.
  6. A pacing move that shrinks an overwhelming horizon into a manageable one.
  7. A closing block of specific questions the reader can answer immediately.
- **Emotional trigger:** overwhelm meeting a handle. The permission line at beat 2 removes the
  implied obligation to do all of it, which is what makes a reader start instead of closing the tab.
- **Immediate personal payoff:** a decision the reader can make today about what they will and will
  not carry, instead of contemplating an unbounded stretch of time. It lands at beats 6 and 7, and
  the closing questions are what make it same-day rather than aspirational.
- **CTA style:** the mined winner closed on a block of reflection prompts, the one genuinely
  completable close in the whole Substack set, plus pointers to the writer's own resources.
  ADAPTED, civic gate: the prompt block IS the micro-action when the prompts are specific and
  answerable in under 5 to 10 minutes. Keep them concrete and local. If the piece needs an external
  action instead, it must point at a real verified thing or fall back to the `config/cta.yaml`
  default.
- **Length and formatting:** 6,000 to 10,000 characters. Named-practice section headers, short
  explanatory paragraphs under each, a closing dashed list of prompts, sometimes split into personal
  and organisational sets. No emoji, no hashtags. Resource links sit in a bracketed aside near the
  top rather than at the close, which keeps the ending clean for the prompts.
- **Shape:**
  ```
  [Beat 1: one sentence, "here is [named practice] for [the specific situation the reader is in]"]
  [Beat 2: permission, in your own words, to use what fits and leave the rest]
  [Beat 3: your own anchor from a comparable moment, two or three sentences, no more]
  [Beat 4: what people have actually been asking you lately, stated plainly]
  [Beat 5: the practice as named steps, each a header plus a short instruction, not an argument]
  [Beat 6: the pacing move, shrinking the horizon (this quarter, this week, this one decision)]
  [Beat 7: 5 to 7 specific questions the reader answers for themselves, right now]
  ```
  Beat 1's named practice has to be something Muxin actually uses or has already written down.
  Naming a method she does not have is inventing proof.
- **Real example:** Deepa Iyer, Substack, her posts applying the social change ecosystem framework
  and its named role sets to a specific current moment, each closing on reflection prompts.
  Citation only, do not reuse the wording.

#### 3. The Handoff `(single sighting on this platform)`

- **Platform:** substack
- **Mechanism:** the writer gives their attention away to one specific named person, which reads as
  generosity rather than argument and gives the reader something to enjoy instead of something to
  fear. Raw viral shape it came from: the creator shoutout. Seen ONCE on Substack, so this is an
  observation rather than an established pattern. It is recorded because that one post is a 7.7x
  outlier and beats its own account's next post by nearly five times, and because the same move
  produced the corpus's single largest multiple on another platform.
- **Structure / arc:**
  1. A one-line principle, stated flat, that the person about to be introduced proves.
  2. The person named, with an explicit promise that the reader will want to meet them.
  3. The writer's own encounter, located and dated concretely.
  4. What the person does, in their own framing, not the writer's summary.
  5. Evidence of why they matter, in plain numbers.
  6. A handoff to the person's own words rather than more of the writer's.
  7. An exact list of where to go find them.
- **Emotional trigger:** generous curiosity and the social pleasure of being early to someone. There
  is no opponent and nothing is asked of the reader, which is rare enough in a civic feed to be its
  own pattern interrupt.
- **Immediate personal payoff:** a specific person to go follow today, and a break from alarm. It
  lands at beat 7, and beat 7 is the reason the post works, so it cannot be cut for length.
- **CTA style:** already completable in the mined post, which is unusual for this corpus: go follow
  this named person, with the exact platforms listed. That clears the civic gate as a micro-action
  on its own. ADAPTED: keep the list exact and verified, and prefer a local person over a national
  one. Never substitute a vague "support voices like hers".
- **Length and formatting:** about 1,500 characters, roughly a fifth of that account's own average,
  and the brevity is part of the mechanism. One and two sentence paragraphs. One short bulleted list
  of platforms at the close. An embedded video or audio can carry the substance, which is what
  licenses the light text. No emoji, no hashtags.
- **Shape:**
  ```
  [Beat 1: one line, the principle this person proves, stated flat with no hedging]
  [Beat 2: their name, and a direct promise that the reader will want to know them]
  [Beat 3: your own encounter, with a real place and a real date]
  [Beat 4: what they do, described the way they describe it]
  [Beat 5: one plain number showing the scale or the effect of what they do]
  [Beat 6: hand off to their own words, quoted, rather than summarising them again]
  [Beat 7: the exact places to follow them, listed, verified as real and current]
  ```
  This shape requires a real person Muxin has actually encountered. Do not fill beat 3 with an
  imagined meeting.
- **Real example:** David Pepper, Substack, his post introducing a rural Ohio creator he interviewed
  on her front porch, closing on a list of her own channels. Citation only, do not reuse the
  wording.

#### 4. Concede Then Turn `(thin evidence)`

- **Platform:** substack
- **Mechanism:** the piece states the opposing feeling or objection in full, in the other person's
  own voice, and grants all of it before turning, so a reader who holds that feeling cannot dismiss
  the answer as coming from someone who did not understand them. Raw viral shape it came from: the
  steelman essay. Seen in 2 posts across 2 creators, one an outlier and one an underperformer, so
  this is recorded as structurally strong rather than performance-proven.
- **Structure / arc:**
  1. The objection or fear, quoted at length in its own voice, with permission noted if it is real.
  2. Why it is being shared: because the person holding it is not alone.
  3. Full concession, every part granted, before any counter-argument.
  4. The turn, on a single word or one short labelled line.
  5. Numbered reasons, each its own headed section, strongest first.
  6. What still has to happen, stated honestly rather than triumphantly.
  7. A close addressed back to the person whose objection opened the piece.
- **Emotional trigger:** being seen before being answered. The concession at beat 3 converts an
  argument into a reply, and skipping it is the usual failure of this shape.
- **Immediate personal payoff:** a reason to keep going that the reader can restate to someone else
  the same day, plus relief that their fear was not dismissed. It lands at beat 4 and is reinforced
  through beat 5.
- **CTA style:** the mined posts closed on Subscribe and Share, not completable. ADAPTED, civic
  gate: the numbered reasons at beat 5 must terminate in one specific low-friction action the reader
  can finish in under 5 to 10 minutes, and it should be local. Never end this shape on "stay in the
  fight" or any of its relatives, which is exactly the vague close table 2 rejects.
- **Length and formatting:** 17,000 to 21,000 characters in the mined posts, though the shape works
  much shorter. A long quoted block at the top, then capitalised or numbered section headers in
  ordinal sequence, short paragraphs, one-line paragraphs at the turns. No emoji or hashtags.
- **Shape:**
  ```
  [Beat 1: the objection or fear, in the other person's actual words, quoted at length]
  [Beat 2: why you are sharing it, one line: because they are not the only one]
  [Beat 3: your concession, granting every part you actually agree with, no hedging]
  [Beat 4: the turn, one word or one short line naming where you land instead]
  [Beat 5: your numbered reasons, each headed, each concrete, strongest first]
  [Beat 6: what is still genuinely unresolved, said plainly]
  [Beat 7: the close, one verified local action under 10 minutes, addressed back to beat 1]
  ```
  Beat 1 needs a real objection someone actually raised, from Muxin's inbox, her comments, or
  `data/community-log.md`. Do not invent a correspondent.
- **Real example:** David Pepper, Substack, his long reply to a reader's frightened email, quoting
  it in full with permission and answering in numbered sections. Citation only, do not reuse the
  wording.

#### 5. The Sourced Chain

- **Platform:** substack
- **Mechanism:** every claim is attributed to a named reporter and outlet as it arrives, in the
  order it arrived, so the piece reads as a record being kept on the reader's behalf rather than an
  opinion being pushed. Raw viral shape it came from: the explainer thread. Seen in 4 posts across
  2 creators. **Be honest about what this is:** it is the reliable baseline format of the largest
  account in the corpus, not what outperformed. Its three uses there sit at that account's 2nd, 3rd
  and 4th ranks, and the post that beat them was nothing like it. Use it as a workhorse, not a
  swing.
- **Structure / arc:**
  1. A self-interrupting or urgency line saying why this is being written now.
  2. The anchor fact, dated, with the outlet and reporters named.
  3. The anomaly inside it: the thing that started and then stopped, or does not add up.
  4. A named authority's reaction, quoted.
  5. The chain widened, each further link attributed as it is introduced.
  6. The pivot to what this displaced, meaning the quieter stories the loud one buried.
  7. A source block so any reader can check the whole thing.
- **Emotional trigger:** alarm held steady by orderliness. The reader feels a story is being tracked
  for them, which is a subscription's real product on this platform.
- **Immediate personal payoff:** being able to speak accurately about a story today without doing
  the reading, plus a short list of what actually moved while attention was elsewhere. It lands at
  beat 6, the beat most drafts drop and should not.
- **CTA style:** the mined posts closed on Share and a source list, with no ask. ADAPTED, civic
  gate: this shape must gain a close it does not natively have. One specific low-friction action
  tied to the local end of the chain, finishable in under 10 minutes, verified. If nothing local and
  verifiable exists, fall back to the `config/cta.yaml` civic-tech default rather than inventing
  one. Do not let the source block stand in for a CTA; sourcing is not an action.
- **Length and formatting:** 9,000 to 14,000 characters. Short chronological paragraphs with named
  attribution in most of them. Closes on a block of bare URLs plus handles. No lists in the body, no
  emoji, no hashtags.
- **Shape:**
  ```
  [Beat 1: why tonight, one line, in your own voice]
  [Beat 2: the anchor fact, with its date, its outlet, and the reporters' names]
  [Beat 3: the anomaly, the part that stopped or does not add up]
  [Beat 4: a named person's reaction to it, quoted exactly]
  [Beat 5: the widening chain, each link attributed as you introduce it]
  [Beat 6: what this crowded out, the quieter thing that moved while everyone watched]
  [Beat 7: the sources, listed plainly so anyone can check you]
  [Beat 8: the close, one verified local action under 10 minutes, tied to beat 6]
  ```
  Every attribution in beats 2 through 5 must be real and checked. This shape is built entirely out
  of other people's reporting, so rule 4's no-invented-proof bar governs every line of it.
- **Real example:** Heather Cox Richardson, Substack (Letters from an American), her nightly
  reconstructions of a developing story with a full source list appended. Citation only, do not
  reuse the wording.

#### 6. The Format Break `(thin evidence)`

- **Platform:** substack
- **Mechanism:** a writer with an established, predictable cadence publishes something very short
  and personal, and the break itself is the event. Raw viral shape it came from: the pattern
  interrupt. Seen in 2 posts across 2 creators, and one of them is the single highest-engagement
  post in the entire corpus at roughly a fortieth of its author's normal length.
- **Structure / arc:**
  1. A callback to something the audience already saw, now resolved.
  2. The disclosure, one line, personal rather than topical.
  3. The specific that gives it weight: a real number, date, or streak that shows the cost.
  4. The occasion, named lightly, as an aside rather than an announcement.
  5. Stop. No argument, no sources, no ask.
- **Emotional trigger:** being let in. For an audience used to a fixed format, the person behind the
  byline appearing briefly is scarce, and the scarcity is the whole mechanism.
- **Immediate personal payoff:** relief and a moment of connection. This is the one pattern here
  whose payoff is purely emotional, and pretending otherwise would be dishonest.
- **CTA style:** none, and none should be added. The mined winner carried no link at all, unlike
  every other post in its account, and adding an ask would convert the gift into a transaction.
  The mined winner carried no ask at all, and this shape breaks if one is added, so treat a
  CTA-less close as part of the pattern rather than as an omission. That is this run's finding
  standing against the civic CTA gate, not an exception Muxin has already granted, so it is subject
  to her approval. If a piece needs a CTA, it needs a different pattern.
- **Length and formatting:** 300 to 1,500 characters, and it must be dramatically shorter than the
  writer's own norm or the mechanism does not fire. Three or four short paragraphs. No sources, no
  lists, no emoji, no hashtags, no link.
- **Shape:**
  ```
  [Beat 1: callback to something your audience already saw from you, now resolved]
  [Beat 2: the disclosure, one line, about your life rather than your subject]
  [Beat 3: the real number that shows what it cost (the streak, the date, the years)]
  [Beat 4: the occasion, mentioned lightly, phrased so agreement is the natural response]
  [Stop here. No ask, no link, no sources.]
  ```
  **Two hard limits.** It only works against an established cadence, so it is not available to a
  channel that has not built one, and it works because it is rare, so it cannot be scheduled.
  Beat 3's number must be true.
- **Real example:** Heather Cox Richardson, Substack, her brief note stepping away from the nightly
  letter for a personal occasion, her most-liked post and by far her shortest. Read it as personal
  vulnerability from a political writer outperforming, not as evidence about register. Citation
  only, do not reuse the wording.

### bluesky

Not yet mined. Fall back to `references/hook-patterns.md`.

### threads

Not yet mined. Fall back to `references/hook-patterns.md`.

### mastodon

Not yet mined. Fall back to `references/hook-patterns.md`.

### tiktok

Not yet mined. Fall back to `references/hook-patterns.md`.

### youtube

**Provenance:** mined by `/patterns synthesize` on 2026-08-22 from 11 YouTube analyses in a 53-post
corpus, across 4 accounts (Ali Abdaal, Mel Robbins, Dan Koe, Nicole LePera). All are short-form,
roughly 30 to 120 seconds, in the `building-solopreneur` and `inner-journey` niches, so **none of
these are civic and none carry a civic adaptation.** For civic material on this platform, run the
chosen shape through `references/civic-adaptation.md` table 1 before drafting.

**Read this before trusting these records.** ZERO YouTube posts cleared the outlier bar. Six of the
eleven returned no view or like count at all, and two accounts have only a single entry, so no
baseline exists to score them against. These patterns therefore rest on posts collected because
they were popular, not on measured outliers, and the strongest of them are supported by repetition
across creators rather than by a performance multiple. Where a pattern is carried by one creator,
the record says so.

A hook here is the first three seconds of spoken words. All four accounts open on content rather
than on a greeting or a channel intro. The one self-introduction in the set is not an exception to
that: it establishes the creator as a peer in a few words and is doing work, which is what pattern
5 below is built on.

#### 1. The Named Tool Handover

- **Platform:** youtube
- **Mechanism:** naming a technique turns an idea into an object the viewer can pick up, remember,
  and repeat to someone else, and handing it over in the first seconds removes any reason to leave.
  Seen in 6 of 11 posts across 3 of the 4 creators, which makes it by a wide margin the most
  repeated structure in this corpus on any platform.
- **Structure / arc:**
  1. The tool named in the first sentence, given a label that can be repeated.
  2. The whole mechanic handed over immediately, in one or two sentences. Nothing is withheld.
  3. The trigger conditions: the specific everyday states in which the viewer should reach for it.
  4. The creator demonstrating it on their own life, with a real and deliberately small example.
  5. The honest limit, meaning the failure rate or the discomfort to expect, stated out loud.
  6. The result named in felt terms rather than outcomes.
  7. A handoff, an excited push to go use it.
- **Emotional trigger:** relief that arrives before any effort is required. Because the mechanic is
  given away at beat 2 rather than teased, the viewer has already received the value and stays for
  the demonstration rather than the reveal.
- **Immediate personal payoff:** a technique usable within seconds of the video ending, requiring
  nothing to buy, install, or schedule. It lands at beat 2, which is why beat 2 cannot be delayed.
- **CTA style:** mostly none. The tool is the payoff and the creators generally let it stand, which
  is a real finding: the highest-repetition shape in the corpus usually closes with no ask at all.
  Where a close exists it is an implicit try-this. For Muxin's non-civic material the ordinary
  `config/cta.yaml` pillar default applies and stays conditional.
- **Length and formatting:** 600 to 900 characters of speech, roughly 30 to 60 seconds. One idea
  only. Second person for instructions, first person for the demonstration. No list scaffolding.
  Beat 5 is the mark of the strongest examples and the one most drafts leave out.
- **Shape:**
  ```
  [Beat 1: name the tool, in a label short enough to repeat: "the [two or three word name]"]
  [Beat 2: the entire mechanic, one or two sentences, given away with nothing held back]
  [Beat 3: when to reach for it, 2 to 4 specific everyday moments the viewer will recognise]
  [Beat 4: you doing it, with a real small example from your own week, not an impressive one]
  [Beat 5: the honest limit, the failure rate or the discomfort, said out loud]
  [Beat 6: the result, named in felt terms rather than in outcomes or metrics]
  [Beat 7: the handoff, one line pushing them to go try it]
  ```
  Beat 1's name must be one Muxin actually uses for a thing she actually does. Beats 4 and 5 have
  to be true of her, which is what keeps this shape inside the extraction-first rule.
- **Real example:** Ali Abdaal, YouTube shorts, his short on a five-minute timer rule for
  procrastination, which states the proportion of times it does not work. Also Mel Robbins, YouTube
  shorts, her two-word relationship technique. Citation only, do not reuse the wording.

#### 2. The Scenario Ladder

- **Platform:** youtube
- **Mechanism:** one grammatical frame repeated across several everyday scenarios, each resolving
  to the same closing phrase, so the viewer is hit personally by at least one rung and has
  memorised the phrase by the end without being asked to. Seen in 4 posts across 2 creators.
- **Structure / arc:**
  1. The frame established, usually attached to a named tool.
  2. Rung one, the most trivial scenario, so nobody is excluded at the start.
  3. Rungs two through four, escalating toward genuinely painful, then stepping back down.
  4. The same closing phrase ending every rung, unchanged.
  5. The reveal of why it works, stated once, after the ladder rather than before it.
  6. The mechanism named in feeling terms.
  7. An excited handoff.
- **Emotional trigger:** recognition on repeat. Each rung is a fresh chance for the viewer to be
  personally hit, and the identical ending converts the tool into something closer to a chant.
- **Immediate personal payoff:** a short script the viewer can use the next time the scenario
  happens, which is often the same day. It lands cumulatively across the ladder.
- **CTA style:** none explicit in the mined posts. The repeated phrase is what travels, so the
  post's real distribution comes from viewers repeating it, not from an ask.
- **Length and formatting:** 750 to 900 characters, 45 to 60 seconds. Three to five rungs. The
  better-performing of the two versions in this corpus used five rungs, claimed the tool as the
  creator's own to hand over, and ended on excitement; the weaker used three rungs, framed the tool
  as something the creator had just heard about, and ended on analysis.
- **Shape:**
  ```
  [Beat 1: the frame, tied to the named tool: "whenever [situation type], [phrase]"]
  [Beat 2: rung one, the smallest, most trivial version anyone would recognise]
  [Beat 3: rungs two to four, escalating to something that genuinely stings, then easing back]
  [Beat 4: every rung ends on the identical phrase, word for word, no variation]
  [Beat 5: the reveal, why it works, stated once and only after the ladder]
  [Beat 6: the felt result, described as what stops rather than what you gain]
  [Beat 7: the handoff, that you cannot wait for them to try it]
  ```
  Every rung must come from situations Muxin has actually seen or lived. A ladder built from
  imagined scenarios is composition, not extraction.
- **Real example:** Mel Robbins, YouTube shorts, her two-word technique run across brunch
  invitations, commitment, and family plans. Two tellings of the same idea sit in this corpus and
  the differences between them are what the Length row above records. Citation only, do not reuse
  the wording.

#### 3. The Counted Promise `(thin evidence)`

- **Platform:** youtube
- **Mechanism:** a number in the first three seconds tells a scrolling viewer exactly how much is
  being asked of them and exactly what they get, and each spoken number afterwards acts as a
  chapter marker that makes every retention decision small. Seen in 2 posts from 1 creator, so
  thin, and recorded mainly because the count is doing visible structural work.
- **Structure / arc:**
  1. The count plus a category label, inside three seconds, with no preamble.
  2. Item one: flat principle, then a concrete physical analogy, then the instruction.
  3. Item two: principle, a repeatable rule, and two interchangeable examples so the viewer can
     substitute their own situation.
  4. Item three: the benefit named before the action.
  5. Item four: a device or a named default, demonstrated with two if-then sentences from the
     creator's own life.
  6. A close, or in a series, a pointer to the other episodes.
- **Emotional trigger:** a bounded, countable promise. Four feels committable in a way that "some
  thoughts on productivity" does not.
- **Immediate personal payoff:** several usable adjustments, at least one applicable the same day,
  with no prerequisite. It lands at each numbered item, so the video pays off even if abandoned
  halfway.
- **CTA style:** none in one of the two, and in the other an explicit pointer to the rest of a
  named series on the creator's profile. That series close is the only content CTA anywhere in this
  corpus's YouTube set, and it trades a thinner single video for a chance at a longer session.
- **Length and formatting:** 600 to 1,200 characters, 30 to 50 seconds. The numbers are spoken
  aloud, not just captioned. Each item runs two to four sentences in the fixed order claim, example,
  instruction. Second person throughout.
- **Shape:**
  ```
  [Beat 1: "[N] [things/habits/rules] [category label]" spoken inside 3 seconds, no greeting]
  [Beat 2: item 1, the principle in one flat sentence]
  [Beat 3: item 1's physical analogy, something the viewer can picture]
  [Beat 4: item 1's instruction, what to actually do]
  [Repeat beats 2 to 4 for each remaining item, keeping the order identical every time]
  [Final beat: either stop, or point at the named series this episode belongs to]
  ```
  N must equal the number of items actually delivered. Padding to reach a rounder number is the
  failure this shape invites.
- **Real example:** Ali Abdaal, YouTube shorts, his counted list of productivity lessons from his
  early twenties, and his numbered mini-habits series. Citation only, do not reuse the wording.

#### 4. Do It With Me `(thin evidence)`

- **Platform:** youtube
- **Mechanism:** the viewer performs the exercise during the video rather than after it, and the
  creator completes it on camera with a deliberately unimpressive real answer, which removes the
  performance pressure that stops people trying a technique they just watched an expert nail. Seen
  in 2 posts across 2 creators, one of them truncated in retrieval, so the evidence is thin even by
  this section's standards.
- **Structure / arc:**
  1. Start the procedure immediately, in the first person plural: we are doing this now.
  2. Defuse the jargon the moment it is introduced.
  3. Lower the stakes twice: this is not pretty, this is not for showing anyone.
  4. The physical setup, given as a concrete instruction.
  5. The creator thinking aloud in real time, including genuinely mundane material.
  6. The creator's own completed artifact shown, with a real reaction to it.
  7. The reframe that stops the exercise becoming another obligation.
  8. Steps two and three, each narrowing the output.
  9. The creator's own final answer revealed, deliberately unglamorous.
  10. The close names what the viewer has just done.
- **Emotional trigger:** permission to be a mess, then relief as the mess narrows to one item. Beat
  9 is the trust move and the one most drafts get wrong by choosing an impressive example.
- **Immediate personal payoff:** a completed artifact and a decided priority, in about five minutes,
  with physical proof. It lands at beats 8 and 9.
- **CTA style:** the whole video is the ask, so no separate CTA is needed or used. This is the one
  YouTube shape where the call to action and the content are the same thing.
- **Length and formatting:** up to about 2,400 characters, the longest form in this corpus's
  YouTube set, and it earns the length by making the viewer a participant. Numbered spoken steps,
  real-time demonstration, second person for instructions and first person for the demonstration.
- **Shape:**
  ```
  [Beat 1: "first, we're going to [do the thing]" and start immediately, no setup]
  [Beat 2: name any jargon and defuse it in the same breath]
  [Beat 3: lower the stakes twice, on quality and on audience, in your own words]
  [Beat 4: the physical setup, concrete enough that they can follow it while watching]
  [Beat 5: think aloud in real time, including boring material, so it looks unrehearsed]
  [Beat 6: show your own actual work in progress and react to it honestly]
  [Beat 7: the reframe that stops this becoming another to-do list]
  [Beat 8: the narrowing steps, each one cutting the output down]
  [Beat 9: reveal your own final answer, and make it genuinely unimpressive]
  [Beat 10: name what they just did, in one line]
  ```
  Beat 9 must be a real answer of Muxin's from the day she records it. A fabricated mundane example
  is still fabrication.
- **Real example:** Mel Robbins, YouTube shorts, her five-minute paper exercise for clearing mental
  clutter, in which she shows her own completed sheet and circles an entirely ordinary errand.
  Citation only, do not reuse the wording.

#### 5. Your State, Then The Push `(thin evidence)`

- **Platform:** youtube
- **Mechanism:** the opening describes the viewer's current state and recites their own excuses back
  to them before they can offer any, which closes the escape route, and the creator's own confessed
  resistance sits between the principle and the instruction so the push comes from someone who has
  just admitted they did not want to either. Seen in 2 posts across 2 creators, one of them
  truncated, so thin.
- **Structure / arc:**
  1. A relational self-introduction that establishes the creator as a peer, not an authority.
  2. The viewer's state named precisely, including their excuses, in the order they would give them.
  3. A signal that the instruction is coming.
  4. The principle, ideally as a two-way trade rather than a command.
  5. The creator's own resistance confessed, with a specific physical detail.
  6. The result named as a run of felt states rather than outcomes.
  7. The bridge back to the viewer's own avoided thing.
  8. A physical trigger, then a blunt instruction, then warmth.
- **Emotional trigger:** being caught, kindly. Naming the excuses first is what makes the push land
  as care rather than scolding, and the peer framing at beat 1 is what licenses the bluntness at
  beat 8.
- **Immediate personal payoff:** a push to start the specific thing the viewer is avoiding right
  now, plus a method for starting it in the next five seconds. It lands at beat 8.
- **CTA style:** a direct instruction to go do the avoided thing, triggered by a physical device
  such as a countdown. This is the most action-oriented close in the YouTube set and it works
  because the action is the viewer's own, already-known task rather than something the creator
  introduced.
- **Length and formatting:** 350 to 900 characters, 30 to 60 seconds. Entirely direct address,
  second person, no list. One first-person confession in the middle as proof. Ends on a trigger, an
  imperative, and a short warm line.
- **Shape:**
  ```
  [Beat 1: introduce yourself as their peer, not their expert, in a few words]
  [Beat 2: their state, then their three most likely excuses, in the order they would actually say them]
  [Beat 3: "here's what I want to tell you", or your own version of the turn signal]
  [Beat 4: the principle as a trade, what easy today costs them later and what hard today buys]
  [Beat 5: your own resistance, with one specific physical detail from a real day]
  [Beat 6: what you felt afterwards, named as felt states rather than as achievements]
  [Beat 7: bridge back to the thing they specifically are avoiding]
  [Beat 8: a physical trigger, then the blunt instruction, then one warm line]
  ```
  Beat 5 must be a real instance of Muxin's own resistance. This shape collapses without it, and
  inventing one would be composing an experience in her voice.
- **Real example:** Mel Robbins, YouTube shorts, her short on doing the hard thing, which names the
  viewer's excuses first and then confesses her own reluctance about a specific piece of exercise
  equipment before pushing. Citation only, do not reuse the wording.

### instagram

Not yet mined. Fall back to `references/hook-patterns.md`.
