# Full-post pattern library

The structure library that sits alongside `references/hook-patterns.md` and
`references/civic-adaptation.md`. Hook patterns cover the first line. This file covers the whole
post: the arc after the hook, what it makes the reader feel, how it closes, and how long it runs.

**Status: mined across three synthesis runs, 2026-08-22 and 2026-08-23, on a 292-entry corpus.**
Every one of the 292 collected posts carries a structural analysis. Sections exist for `reddit`,
`tiktok`, `substack`, `substack-notes`, `hackernews`, `bluesky`, `mastodon`, `threads`, `x`,
`youtube` and `linkedin`; `instagram` and `devto` were mined and are too thin to carry patterns, and
say so in place.

## What this file is and how a pattern earns its place

**The templates are the product.** This file exists so Muxin can find what already works in a place,
take the exact structure, and fill it with her own material. That is the method she picked and it is
the method Sabrina Ramonov and Justin Welsh both use. So judge every record below by one test:
**could she write a post tonight from this template alone, without ever seeing the original?** A full
beat-by-beat skeleton with the real mechanics in it beats an elegant observation every time.

**A post earns its way in by being genuinely, obviously popular.** Not by beating its own author's
average, not by any computed ratio. Big raw numbers, judged against what that place actually
produces. Two things still disqualify a post, and both are about truthfulness rather than metrics:

1. **Its substance has to be in the text that was collected.** A post whose real content sat in an
   image, a carousel, a video or later tweets cannot teach anyone what its words did. Entries flagged
   `body_is_complete: false` are never used as body-structure evidence. This rule has caught four
   real errors in this project, and it is why the two biggest Threads posts and the biggest Substack
   Note in the corpus are not behind any pattern here.
2. **Trivial numbers disqualify.** A 9x on a median of 3 upvotes is noise dressed as a finding. This
   is the main thing the gate now does.

**The popularity floors, stated so they can be argued with.** These are judgment calls, set from what
each platform actually produces in this corpus. They are not sacred and they are visible on purpose.

| platform | floor | measured on |
|---|---|---|
| tiktok | 100,000 | views |
| youtube | 25,000 | views |
| instagram | 10,000 | engagement |
| reddit, hackernews, x, linkedin | 250 | engagement |
| bluesky, mastodon, threads, substack, substack-notes, devto | 150 | engagement |

Engagement means likes plus comments plus shares, whichever of them the platform published. At those
floors, of 292 analysed posts **132 are admitted as pattern evidence**, 80 fall below the floor, 71
are body-incomplete, and 9 are Reddit or Hacker News link and image posts admitted as TITLE evidence
only, because on those two channels the title is a separate field and is most of the craft.

**Multiples against an author's own baseline are recorded as CONTEXT, not as the gate.** Where a real
baseline exists it is quoted, because knowing a post did fourteen times its author's normal is worth
knowing. It is never what admits a post.

**The one caveat about sampling, and then this file stops talking about it.** Some accounts here were
reached by searching for their famous posts, and some came from a real timeline window or a whole
community's true median. That difference is not academic: it reversed a headline finding in this
project once already, which is documented in the image-versus-text section below. Where a section's
numbers come from a search-discovered set, it says so in one line. Read that line, then read the
template.

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

### How that rule gets enforced, and what three passes over it taught

**Read this before writing or editing any record.** The no-reused-wording rule above was swept three
times on 2026-08-23. Each pass found more, and each time the reason was the same: the check was
narrower than the problem. Pass one scanned quoted strings and fixed 16. Pass two scanned Shape
blocks and fixed 13, including three introduced an hour earlier by the same agent that had just
reported the file clean. Pass three scanned every line and fixed 17. The lesson is not that people
are careless about rule 1. It is that each check covered the surface just worked on rather than the
surface a drafter reads.

**Two rules follow from that, and they are worth more than the 46 fixes.**

**1. A single-sighting pattern is presumptively contaminated until checked.** 15 of the 17 lifts in
the third pass came from `(single sighting)` or `(thin evidence)` records, roughly 88 percent of the
errors from about half the patterns. The mechanism is obvious once seen: with one source post there
is nothing to abstract against, so the creator's sentence becomes the skeleton by default. Whenever a
new n=1 record is written, check it against its source before committing, and re-check every existing
n=1 record whenever this file is swept.

**2. Check by n-gram over the WHOLE file, never by scanning quoted strings.** The quoted-string
method missed two real lifts that a word-sequence comparison caught immediately, and both misses are
instructive:

- One was unquoted **beat prose**. A numbered beat in a Structure / arc list is an instruction a
  drafter follows, so it propagates exactly like a Shape block does. **13 of the third pass's 17
  lifts were in beats rather than Shape blocks.** Sweep both, plus Mechanism and Length lines.
- One was **bracket-interleaved**: a creator's opening clause with his content bracketed out, so it
  never formed a long enough quoted run to be extracted, while reading as his sentence to anyone who
  knows the post.

The method that works, in five lines of script: lowercase both sides, strip everything that is not a
letter, digit or apostrophe, build every n-word sequence, and intersect. **Compare against CREATOR
content only**: each entry's `body`, its `media.onscreen_text`, and the post titles quoted inside
`notes`. **Exclude the rest of `notes` and `media.description`**, which are our own collection
metadata describing how a window was pulled or what a baseline covers. That distinction matters
enormously to the numbers: on this file a raw 6-gram sweep returns about 37 hits and looks alarming,
and the split is 1 against creator content and 31 against our own methodology prose. Rule 1 governs
creator wording, not our writing about our own method, so do not spend effort rewording the 31.

**The bar to clear.** Zero at 7-grams. At 6, 5 and 4 grams, read every hit individually rather than
counting them: ordinary English collocations and Real example lines quoting a fragment to identify a
post are both legitimate and both will appear. At the last sweep this file stood at 0 / 1 / 8 / 65
for 7 / 6 / 5 / 4 grams, with every remaining hit read and classified into those two benign
categories, and nothing traceable left inside a template or a beat.

**When this applies:** the same gate as the storytelling re-hook pass, `appliesRehook(platform,
sourceKind)` in `src/atomize/spin.ts`. That gate now covers every platform except ones explicitly
opted out with `rehook: false` in `config/platforms.yaml`, and it still never applies to a
Notes-sourced folder (`source_kind: substack-note`), which stays a near-verbatim cross-post.

**How this file gets written:** the `/patterns` skill collects real posts into `data/patterns/`
(gitignored, other creators' full text never enters git), and `/patterns synthesize` distills the
ones that clear the popularity gate into records below. Only the distilled shapes are committed. If
you want to change what gets mined, edit `config/pattern-mining.yaml`, not this file.

**Reading `data/patterns/analyses.jsonl`, for whoever opens it next.** Each record carries the eight
structural fields, plus `gate` (one of `ADMITTED`, `BELOW-FLOOR`, `INCOMPLETE`, `TITLE-ONLY`),
`admissible` (true only when `gate` is `ADMITTED`), `popularity`, `popularity_metric` and
`platform_floor`. **The per-record `reason` prose is historical working notes from the first pass on
2026-08-23 and may describe a gate that has since been retired.** It was deliberately not rewritten,
because nothing reads it. Trust `gate`, `popularity` and `platform_floor`; treat `reason` as a
diary entry. The field was called `outlier` in earlier passes and was renamed once its meaning
stopped matching `classifyOutlier` in `src/patterns/outliers.ts`.

**Before you add a pattern, read this. It is the most expensive lesson this file has learned.**
Rule 1 forbids reusing a creator's wording. Three separate sweeps for violations each found more,
because each check was narrower than the problem: the first scanned quoted strings, the second
scanned Shape blocks, the third scanned every line. Only the third worked. Two rules follow.

1. **A single-sighting pattern is presumptively contaminated until checked.** Of 17 lifts found in
   the final sweep, 15 came from records resting on one post, which is roughly 88 percent of the
   errors from about half the patterns. The mechanism is simple and it will happen to you: with one
   example there is nothing to abstract against, so the creator's sentence becomes the skeleton by
   default. Three violations were introduced by the agent writing them within an hour of it
   reporting that it had scrubbed 16 of the same class.
2. **Check by n-gram against the collected bodies, over the whole file.** Not by scanning quoted
   strings. Two real violations survived that method: one was unquoted prose in a numbered beat, and
   one was bracket-interleaved so no long unbroken run existed to match. Compare normalised word
   sequences from every line of this file against every collected body, transcript, on-screen text
   and title. Anything at 6 words or longer needs reading individually.

**Structure and arc beats count.** 13 of those 17 lifts were in beats rather than Shape blocks. A
beat is an instruction a drafter follows, so it propagates into copy exactly like a template does.
Sweep both.

**What is NOT in scope:** our own collection metadata in the `notes` field. A raw n-gram run
overlaps heavily with our methodology prose, how a crawler window was pulled, what a baseline
covers. That is our writing, not a creator's, and rewording it makes the metric look better without
making the file safer. Filter to creator content: bodies, transcripts, on-screen text and titles.

## What separated the winners from the same creators' ordinary posts

**A run-level finding from the mining pass, revised 2026-08-23, not a pattern record.** It is placed
above the patterns because it tells you what to ask of a draft rather than which shape to pour it
into. **Everything in this section and the two below is measured on within-account multiples, which
this file records as CONTEXT and no longer gates on.** Read them as what the corpus can and cannot
answer, then go and use a template. Most creators
contributed 4 to 6 posts, so an outlier could be compared against the same person's ordinary work.
That comparison is the thing a list of famous posts cannot give you.

**The finding:** the post that beats a creator's own baseline is the one that gives the reader
something that creator's ordinary posts do not. Recycled, forwarded and inward-facing material lost
almost every time it appeared.

### The length claim died when better data arrived, and that is the useful part

An earlier version of this section, written on 58 posts, said the winner was shorter than the
creator's own average in 7 of 10 accounts. **With 100 posts it was 9 of 18. Recomputed on 292 across
23 accounts with at least four scored posts each, it is 11 shorter and 12 longer. That is a coin
flip, measured twice on growing data, and the claim stays withdrawn.**

The split is not random, and how it splits is the real finding:

- On the **cherry-picked platforms**, where only famous posts were reachable, the winner is usually
  shorter. Those accounts' ordinary posts are long essays and long structured posts, so the winner
  broke format by being brief.
- On **Mastodon, the one platform sampled without cherry-picking**, the direction REVERSES. In 6 of
  7 accounts the winner is LONGER than that creator's own average, by 1.41x to 2.28x. The seventh is
  shorter, and it is the one whose winning post carries an image attachment that was never
  collected. Those accounts' ordinary posts include bare headline links and a 13-character greeting
  that landed below its own account's baseline.

So length was never the variable. It tracks effort relative to whatever that account normally does,
and it points in opposite directions depending on what normal is. **Where the baseline is long
essays, the winner is the short one. Where the baseline is throwaway posts, the winner is the one
with substance.** The constant across both is the finding above.

Two things follow that are worth stating plainly. Sampling method changed the apparent answer, which
is a warning about every number in this file that came from a cherry-picked platform. And "write
shorter" would have been actively bad advice: on the best-sampled platform, the single worst
performer relative to its own baseline is a 13-character greeting, and one of the best is a
482-character admission.

### What did survive

- **No link, recomputed at 292 and now a tendency rather than a rule.** At 100 posts this read "in
  all 8 accounts that had both linked and unlinked posts, the top post was the one without a link."
  Recomputed across the whole corpus, **19 accounts and communities have both, and the top post is
  unlinked in 16 of them.** Broader, and no longer unanimous. The three exceptions are worth naming
  rather than hiding: two Mastodon accounts whose top post carries a link, both of which are
  body-incomplete entries sitting at only 2.0x, and one Reddit community the popularity gate
  eliminated entirely. **Three honest qualifiers.** One creator links on all five of his posts and
  still records the highest raw engagement in his platform's set, so this is about relative
  performance inside one feed rather than a rule that links suppress reach. On Mastodon a linked post
  is usually a forward of somebody else's work, so part of what this measures is that original
  material beats forwarding, which converges with the point below. And the strongest counterexample
  in the corpus is a Bluesky account whose single best post at 13.7x carries TWO links, because it
  puts a verdict and the reason to care in front of both. That is pattern 1 in the mastodon section
  working exactly as written, and it is why "no link" is the wrong lesson to draw. **Say something
  before the link** is the right one.
- **Recycled and forwarded material loses.** The clearest cases sit on opposite ends of the corpus:
  one Substack account's two losers are an openly revisited interview and a republished book
  excerpt, while its two winners open on something the author personally found in a primary source;
  and one Mastodon account's forwarded academic paper drew a thirtieth of what his own arguments
  drew in the same window.
- **Something specific in front of the reader.** On the cherry-picked platforms the winners center a
  named person where the ordinary posts center a topic; one Bluesky post naming and praising one
  person drew 10,135 likes against 153 for that author's most carefully constructed post. On
  Mastodon the equivalent is subtly different and worth keeping separate: the winners center the
  POSTER'S OWN judgment, a verdict, a confession, or a disclosed stake, rather than another person.
  Both are instances of putting something specific and human in front of the material.

### The exceptions, which are what make this credible rather than a slogan

- One Substack account's two outliers are among its LONGEST posts and still beat its ordinary posts
  tenfold, on original primary-source labour.
- Another Substack account's winner is LONGER than its own average, carried by timing and a named
  tool aimed at the exact week the reader was living through.
- On Mastodon, one account's winner is its shortest post, a 52-character solidarity line with no
  link and no information, while that same account's longest and most technically precise post drew
  about a third of it. Within a single account, both directions appear.

The right question to ask of a draft is: **what does this give the reader that my ordinary posts do
not?** Substance, brevity, a specific person, original labour, a disclosed stake, and a real image
are all answers the corpus has seen work. Only one of them is measured rather than observed, and
that is the subject of the next section. Having no answer is the failure the losing posts share.

**One honest limit.** These are engagement comparisons within a single creator's feed, on raw
favourite and like counts, across posts of different ages. The Mastodon multiples are measured
against an unbiased 40-post window and deserve the most weight; every other platform's multiples
rest on cherry-picked siblings and deserve less. None of this is a controlled experiment and no
causal claim here has been tested.

## What form the post takes, and what the corpus can prove about it

**A run-level finding, first written on 56 classified entries in the 2026-08-22 pass, and REWRITTEN
on 2026-08-23 against 292 entries because the larger corpus broke it.** Like the section above, this
is something to ask of a draft before reaching for a skeleton.

### The image-beats-text result did not survive, and this is why the file carries a sampling caveat

The previous version of this section said an image post outperforms a text-only post by 2.19x on 13
body-complete entries against 0.62x on 8, called it "the most trustworthy result in this corpus,"
and said it "survives every control." **That claim is withdrawn.** Here is what happened when the
corpus tripled.

The text-only comparison group grew from 8 entries to 55. Its average went from 0.62x to 2.46x. The
image group grew from 13 to 17 and its average fell from 2.19x to 2.10x. The gap closed and then
crossed.

| body-complete, with a real multiple, all platforms except reddit and Hacker News | n | mean | median |
|---|---|---|---|
| text-only | 55 | **2.46x** | 0.68x |
| image | 17 | **2.10x** | 1.09x |
| mixed | 11 | 2.63x | 0.59x |
| link-preview | 8 | 2.45x | 0.67x |
| short-video | 36 | 34.89x | 1.02x |

Reddit and Hacker News are excluded from that table on purpose: their multiples are measured against
a whole community's median rather than one account's, which puts them on a scale of hundreds and
thousands and would swamp everything else. The short-video mean is likewise one post: remove the
single documented account outlier and it drops from 34.89x to 1.56x, so read its median.

Two things went wrong with the original claim and both are worth naming, because they are the same
two mistakes any future pass can repeat.

- **The losing group was tiny and unrepresentative.** Eight text-only entries carried the whole
  result, and they came mostly from search-discovered accounts where a plain tweet sits next to a
  famous one. The honestly-sampled text-only posts that arrived later, six Substack Notes running
  3.4x to 13.4x against a real 96-note median, six Bluesky posts from an account that posts nothing
  but text, five Threads posts from a real timeline window, are all text-only and several of them
  win.
- **The winning group was one platform wearing a form's clothes.** Of the 17 body-complete image
  entries, 11 are LinkedIn, whose posts were reached by search, and 4 are dev.to, where the
  classified image is an article COVER image rather than an image post. That leaves two genuine
  image posts on honestly-sampled platforms. **Restricted to the platforms sampled without
  cherry-picking, the body-complete image sample is a single post.** There is no image evidence
  there at all.

**What is left, stated at its real strength.** Three LinkedIn creators who do this professionally
put an image on almost every post, and they arrived at that independently. That is convergent
professional practice on one platform and it is worth respecting. It is not a measured result, and
this file should never have called it one.

**What to do with this.** On LinkedIn, carry an image, because the people who live on that platform
all do. Everywhere else, the corpus does not tell you to. What it does tell you, repeatedly and
across five platforms now, is in the section above: give the reader something your ordinary posts do
not. A photograph can be that. So can six numbered steps in plain text.

### Short video is no longer unmeasured, and what it shows is not what anyone expected

The previous version of this section said the absence of short video from the evidence was "a
failure of collection, not a finding about short video," and called fixing it "the single
highest-value improvement to this corpus." **That collection gap is now closed.** 38 TikTok entries
carry real play counts and complete auto-caption transcripts, 37 of them body-complete.

What they show, in full, is in the `tiktok` section below. The three headlines belong here because
they contradict things people believe about the form:

- **Big numbers are common here and they are not evenly spread.** 24 of the 38 videos clear 100,000
  views, 9 clear a million, and the largest is 9.7 million. The corpus's single most striking result
  is a 896,100 view video on an account whose six other collected videos run 248 to 2,805 views, so a
  breakout on this platform can be enormous relative to everything else that account has made.
- **Duration predicts nothing.** Sorted by views inside each account, videos of 35 seconds or less
  average a rank percentile of 0.51 and videos over 35 seconds average 0.50. The corpus's two
  shortest videos are the best post on one account and the worst post on another.
- **On-screen text predicts nothing either.** 20 entries carry it and average 0.49; 18 do not and
  average 0.51. It does real craft work, described in the tiktok section, and it does not buy reach.

**One honest limit that has not changed.** Every TikTok transcript in this corpus is words. Nobody
watched a single video. Cuts, faces, pacing, music and the first visual frame are invisible here, and
on that platform they may matter more than the script does. The gap moved; it did not close.

## Does a completable CTA actually buy reach? The corpus can now answer, and the answer is no

**A third run-level finding, new on 2026-08-23. Computed on within-account multiples, which are
context here rather than the gate, and it answers the question either way.** `.claude/skills/patterns/SKILL.md` mode 2 records
`immediate_payoff` and `cta_completable` on every analysed post, civic or not, and says explicitly
that the point is "to find out whether payoff and completable CTAs correlate with reach across every
niche, which is a real question the corpus can answer and this skill should not pre-answer." All 292
entries now carry both fields, so it can be answered.

Across the corpus, 100 of 292 posts close on a micro-action, 7 close on a vague ask, and 185 ask for
nothing at all.

**On the honestly sampled account platforms, body-complete, measured against real windows:**

| close | n | mean multiple | median |
|---|---|---|---|
| none | 40 | 2.38x | 0.99x |
| micro-action | 14 | 2.31x | 0.86x |

**There is no difference.** The same test on immediate payoff gives the same answer: posts that offer
the reader something right now average 2.62x and posts that offer nothing average 2.55x.

On Reddit and Hacker News the micro-action posts look far worse, a median of 33x against 985x, and
**that comparison must not be used**: it is an artifact of which communities carry which kind of
post. r/LifeProTips is nearly all micro-actions and has a true median of 691, while r/ADHD is nearly
all conversation and has a true median of 3. The two multiples are not on the same scale. The
honest read of Reddit is that both kinds win in the communities that want them.

### What this does and does not mean

**It does not mean drop the civic rubric.** `references/civic-adaptation.md` is Muxin's decided
standard and it was never a reach tactic. It exists so that a reader who has been persuaded has
somewhere to go. Reach and consequence are different outcomes, and this file has just measured one
of them. A post that travels 10x and leaves a moved reader with nothing has succeeded at the thing
that is easy to count and failed at the thing Muxin actually wants.

**It does mean stop expecting the CTA to carry the post.** If a draft is not travelling, adding a
micro-action to the end will not fix it, and the corpus is now clear about that. What separates
winners is in the first section of this file: giving the reader something your ordinary posts do
not. The CTA is what you do once that has already worked.

**One genuinely useful pairing does show up.** The two civic items that travelled furthest anywhere
in this corpus relative to their baselines, a petition at 205x and an open-source deliberation tool
at 114x on Hacker News, plus the strongest civic post on Mastodon, a queryable research map, are all
cases where **the artifact IS the micro-action**. Nobody appended an ask to an argument. They
shipped the thing and the shipping was the post. That is the shape of civic work this corpus
actually rewards, and it is a build instruction rather than a writing one.

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
6. **A record built on one post is presumptively contaminated with that creator's wording.** Before
   committing an n=1 record, compare its Shape block AND its numbered beats against the source
   entry's `body` by word sequence, not by eye. See "How that rule gets enforced" above for the
   method and the reason. This is where 88 percent of rule 1 violations in this file have come from.

## Patterns by platform

What wins is not the same on a 280-character feed and a 40-minute video, so patterns are filed by
the platform they were mined on. Do not carry a pattern across a section heading without evidence
from that platform.

### x

**Provenance:** mined by `/patterns synthesize` on 2026-08-23 from 33 X analyses in a 292-entry
corpus, across 6 accounts contributing 3 to 9 posts each, niches `building-solopreneur`,
`inner-journey` and `general-viral`. **9 clear this file's popularity floor and are the basis for the
templates below**, running from 362 to 16,119 engagements. 15 are body-incomplete and 9 fall below
the floor.

**The admitted posts, so you can see what these templates were built from.** 16,119 engagements on a
single 280-character post; 9,371 on a thread head; 2,429; 2,261; 1,970; 1,502; 1,056; 1,008; 362.
Four creators. Those are real numbers of real people, which is what earns these shapes their place.

**One sampling line.** Every X profile-timeline route tried came back empty, so these posts were
found by web search rather than pulled from a window. That means the collected set skews toward each
account's famous work and there is no baseline to compute a multiple against. It does not make the
engagement counts less real, and this section is written off the counts.

**Two collection limits worth knowing before you copy a length.** Long posts came back truncated at
roughly 279 characters from the endpoint used and were all discarded, so this section is biased
toward short posts. And 15 of the 33 entries hide their payload in an image, a thread continuation or
a quoted post, so they are not behind any template here.

#### 1. One Idea, Three Registers

- **Platform:** x
- **Mechanism:** a single idea is stated three times, as an instruction, then in plain language, then
  as something measurable, so the reader can lift whichever version fits their own sentence. Seen in
  2 posts by 1 creator, at 16,119 and 1,008 engagements, and the construction is visible in 2 more
  posts by 2 other creators. The 16,119 post is the largest single result in the X set.
- **Structure / arc:**
  1. A two word label that classifies the post, of the sort that flags it as advice, or as a
     position the writer expects disagreement with.
  2. The idea as an instruction, four to six words.
  3. The premise it rests on, stated as something the reader cannot avoid.
  4. A short list of instances, in fragments, ending on a dismissive word.
  5. The idea restated in plainer words.
  6. The idea restated a third time as a measurable quantity. Shrink the window. Zoom out.
  7. A closing phrase short enough to be quoted alone.
- **Emotional trigger:** recognition of an unfixable problem, then relief that the fixable part is a
  different variable than the one the reader was pushing on.
- **Immediate personal payoff:** a variable they can change today, named in a way that makes it
  measurable.
- **CTA style:** none in any instance. **CIVIC GATE:** this shape has no close at all, so on civic
  material it fails `references/civic-adaptation.md` until one is added. Add a verified,
  finishable-in-ten-minutes action after beat 7.
- **Length and formatting:** 280 to 300 characters, one block, no line breaks, no bullets, no emoji,
  no hashtags, no link. All the instances that use this shape are unbroken paragraphs.
- **Shape:**
  ```
  [Beat 1: a two-word label classifying the post. Muxin's own words, not a borrowed one]
  [Beat 2: the idea as an instruction, four to six words]
  [Beat 3: the premise. Something the reader cannot avoid]
  [Beat 4: instances, as fragments, ending on a dismissive word]
  [Beat 5: the same idea, plainer]
  [Beat 6: the same idea, measurable]
  [Beat 7: a closing phrase short enough to quote alone]
  ```
  The three restatements are not padding, they are the mechanism. Cutting to one leaves a slogan
  with nothing for a reader to carry.
- **Real example:** the inner-journey account's post about recovery speed after failure. Citation
  only, do not reuse the wording.

#### 2. The List Whose Last Item Is the Question `(single sighting)`

- **Platform:** x
- **Mechanism:** a numbered list of specific things, where the final numbered item is not a thing but
  a question, so the reader completes the list themselves. It converts readers into commenters
  without asking them anything. Seen in 1 post by 1 creator, at 2,261 engagements.
- **Structure / arc:**
  1. A framing verb with no object yet, ending in a colon.
  2. Three or four numbered items, each one or two words, each a specific named group or thing.
  3. The final numbered item, in the same format as the others, is a question rather than a thing.
- **Emotional trigger:** accumulating recognition, then an open door.
- **Immediate personal payoff:** none.
- **CTA style:** none stated. The unfinished item is the ask, and it is the most efficient
  engagement device in this section. **CIVIC GATE:** an open item is not a micro-action. On civic
  material, keep the device and add a verified action underneath it.
- **Length and formatting:** about 130 characters. A five item numbered list where item five is a
  question. No links, no emoji, no hashtags.
- **Shape:**
  ```
  [Beat 1: a framing verb with no object yet, ending in a colon]
  1) [specific thing]
  2) [specific thing]
  3) [specific thing]
  4) [specific thing]
  5) [the question, in the same format as the items above]
  ```
  Items 1 to 4 must be specific and named. A list of abstractions gives the reader nothing to add to.
- **Real example:** the general-viral account's five item list ending on an open question about what
  comes next. Citation only, do not reuse the wording.

#### 3. The Label, Then the Procedure, With Nothing Sold

- **Platform:** x
- **Mechanism:** two words naming what is about to be shown, then the procedure itself in bullets,
  with no claim, no credential, no promise and no link. Seen in 2 posts across 2 creators, at 1,970
  and 1,502 engagements, and both are the best body-complete post on their account.
- **Structure / arc:**
  1. A two or three word label plus a colon, naming what is about to be shown. A process, a data
     update, a teardown.
  2. Stage one, as a small bulleted group.
  3. Stage two, what stage one produces, as a second bulleted group.
  4. One line closing the loop. Then fill in the details.
- **Emotional trigger:** the pull of watching a process rather than being given advice about one.
  The bullets promise it will be short.
- **Immediate personal payoff:** the strongest in this section. A checklist they can apply to the
  next thing they make.
- **CTA style:** none, and the absence is the point. Neither instance sells anything, and the same
  accounts' posts that DO carry a link and an offer are body-incomplete and cannot be compared.
  **CIVIC GATE:** the procedure IS the completable action, so this shape is close to the rubric
  already. It must point at something real.
- **Length and formatting:** 260 to 300 characters. Six bullets in two groups, blank lines between
  every block, no hashtags, no emoji, no link.
- **Shape:**
  ```
  [Beat 1: two or three words naming what this is, then a colon]
  [Beat 2: stage one, as a bulleted group of three]
  [Beat 3: what stage one produces, as a second bulleted group]
  [Beat 4: one line closing the loop]
  ```
  The discipline is the absence. No credential, no result claim, no link. The moment one is added
  this becomes the offer post that the same accounts publish constantly and that this corpus cannot
  evaluate.
- **Real example:** the writing account's three question, five headline, one summary process post.
  Citation only, do not reuse the wording.

#### The one thing in this section Muxin should read as a warning

Two of the highest-engagement posts collected here are personal result claims: a portfolio with
named profit figures, and a career transformation with a revenue number attached. Both are
body-incomplete, so neither is evidence about anything. They are recorded because the shape is
seductive and Muxin cannot use it. **CLAUDE.md rule 1 and `venture/rules.md` item 9 forbid asserting
a result, customer, number or experience she did not have.** A structure whose load-bearing beat is
a number she does not have is not a structure she can borrow. The procedure shape above is the
version of it she can.

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
  7. A second concession, that executing them well is the hard part, which opens the gap.
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
  **The measured backing this record used to cite has been withdrawn.** It quoted image posts at
  2.19x against 0.62x for text-only, computed at 100 corpus entries. At 292 the text-only comparison
  group grew from 8 posts to 55 and the gap closed and crossed; see the image-versus-text section
  above. What still supports this shape is convergent professional practice on this platform, not a
  measured effect.
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
  2. Permission, up front, to use only the parts that apply to them. This is load-bearing.
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
  [Beat 2: permission, in Muxin's own words, to use only the parts that apply]
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
  2. The person named, with an explicit promise that the reader will be glad to know of them.
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
  [Beat 2: their name, and a direct promise that knowing of them is worth the reader's time]
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

**Provenance:** mined by `/patterns synthesize` on 2026-08-23 from 22 Bluesky analyses in a
292-entry corpus, across 4 accounts contributing 4 to 6 posts each, niches `adhd`, `ai-building`,
`product-thinking` and `civic-democracy`.

**7 of the 22 clear this file's 150-engagement floor**, running from 178 to 11,598 engagements. 6
are body-incomplete and 9 fall below the floor. Bluesky publishes no view count, so every number here
is an engagement count.

**One account here is the cleanest single account in the entire corpus.** All six of its posts are
text-only and body-complete, from one creator in one window. Nothing is hidden in an image, nothing
is a thread head, nothing is a forward. Where this section needs a controlled comparison, it uses
that account, and says so.

**Body-complete control.** 6 of the 22 are body-incomplete, and they cluster: one account's top
three posts are all images that were never collected, so that account contributes form observations
and no body patterns.

#### 1. Say Something Before the Link, With the Source First

- **Platform:** bluesky
- **Mechanism:** the poster's own verdict and the reason to care arrive before the link, and then
  TWO destinations are offered in rank order, the primary source first and the poster's own
  commentary second. Seen in 2 posts across 1 creator at 13.7x and 2.1x that account's own baseline,
  both body-complete. **This is the mastodon section's pattern 1 appearing on a second platform**,
  which is the only cross-platform confirmation of a full-post pattern in this file, so read that
  record alongside this one.
- **Structure / arc:**
  1. Who published it and what it is, with the one adjective that matters. Detailed, new, big.
  2. The verdict, given as the poster's own reaction rather than a summary of the piece.
  3. The primary link.
  4. Optional and distinctive: the poster's own notes, offered separately as a second, lower-ranked
     destination.
- **Emotional trigger:** trust transfer. A judgment from someone the reader already relies on, with
  the reason attached, so a reader who never clicks still leaves with something.
- **Immediate personal payoff:** a vetted read plus, in the two-tier version, a shortcut past it.
- **CTA style:** read the linked thing, with the post complete without it. **CIVIC GATE:** on civic
  material the linked thing must be real and verified, and where possible it should be the
  completable thing itself rather than an article about one. The corpus is emphatic on this point:
  the civic items that travelled furthest on Hacker News and Mastodon were both artifacts a reader
  could use, not arguments.
- **Length and formatting:** 200 to 260 characters. Two blocks, each ending on its own link. No
  emoji, no hashtags on either winner.
- **Shape:**
  ```
  [Beat 1: who published it, what it is, and the one adjective that matters]
  [Beat 2: Muxin's verdict, as her reaction. Not a summary]
  [Beat 3: the primary link]
  [Beat 4, optional: her own notes, as a separate second destination]
  ```
  Beat 4 is the addition this platform contributes. Putting the source above your own commentary
  respects readers who want the thing itself, and it costs nothing.
- **Real example:** the technical account's post about a published incident report, pairing the
  primary source with the poster's own separately linked notes. Citation only, do not reuse the
  wording.

#### 2. The Self-Sabotage, Framed As Something Happening To You

- **Platform:** bluesky
- **Mechanism:** the poster describes their own avoidance as an external obligation rather than a
  choice, which is simultaneously the joke and the accurate description. Seen in 1 post by 1 creator
  at 4.0x that account's own baseline, and it is the top post on the cleanest account in the corpus.
  `(thin evidence, single sighting)`
- **Structure / arc:**
  1. A stretched interjection of mock dismay.
  2. The self-indictment, phrased as a discovered requirement rather than a decision: she now
     apparently has to do the avoidance activity instead of the work.
  3. Stop. There is no third beat and no explanation.
- **Emotional trigger:** recognition made safe. The poster is confessing rather than diagnosing the
  reader, so nobody has to get defensive.
- **Immediate personal payoff:** none. Recognition only.
- **CTA style:** none, and this shape cannot carry one. **CIVIC GATE:** not applicable to the mined
  post. If adapted, the action would have to sit outside the joke entirely.
- **Length and formatting:** about 100 characters, one sentence, all lowercase, no emoji, no link,
  no hashtag.
- **Shape:**
  ```
  [Beat 1: mock dismay, stretched. Lowercase]
  [Beat 2: state the avoidance as a discovered requirement, not a choice: apparently she now has
   to do [the avoidance activity] rather than [the actual work]]
  [Stop]
  ```
  The whole device is the fake externality in beat 2. Say "I decided to" and it becomes a
  confession, which is a different and weaker post.
- **Real example:** the ADHD account's one-sentence post about needing to build a system to help
  with work instead of doing the work. Citation only, do not reuse the wording.

#### 3. Grant Every Piece of Advice, Then Collapse

- **Platform:** bluesky
- **Mechanism:** the post ticks off, in the advice's own vocabulary, every thing the reader has ever
  been told to do, then shows that having all of it changes nothing. It refutes an entire genre in
  five lines. Seen in 1 post by 1 creator at 2.0x that account's own baseline. `(thin evidence,
  single sighting)`
- **Structure / arc:**
  1. The setup, ending on a colon, promising a list of things she already knows.
  2. Three or four ticked items, each short, each one of the things advice-givers ask for.
  3. The turn, on a capitalised conjunction.
  4. The image: what actually happens instead, physical and specific.
- **Emotional trigger:** the build of confident checkmarks and then the collapse, which the reader
  sees coming and which lands harder because of it.
- **Immediate personal payoff:** a defence. The reader gets something to point at the next time they
  are told to plan better.
- **CTA style:** none. **CIVIC GATE:** unchanged if adapted.
- **Length and formatting:** about 220 characters. A ticked list using check emoji, one capitalised
  turn, a closing image in one line. No link, no hashtag.
- **Shape:**
  ```
  [Beat 1: set up the list with a colon. She can know all of the following about [X]:]
  [Beat 2: three or four ticked items, in the ADVICE'S own words]
  [Beat 3: the turn, on a capitalised conjunction]
  [Beat 4: what actually happens. Physical, specific, one image]
  ```
  Beat 2 must be generous. If the ticks are strawmen the refutation collapses; the power comes from
  granting the whole case first.
- **Real example:** the ADHD account's post ticking off what, when, why and how before landing on
  sitting frozen while a deadline approaches. Citation only, do not reuse the wording.

#### What the losing posts on the cleanest account establish

This is the section's most useful content and it is not a pattern. One account gives six text-only
body-complete posts from one creator in one window, so the comparison is as controlled as this
corpus gets. Ranked by engagement, its **shortest post is its worst**, at a thirteenth of its top
post: four words, a wry self-title, no context. Its most compressed and cleverest post, two parallel
equations totalling about 60 characters, sits fifth of six.

Put that beside the mastodon section's finding that a 13 character greeting was the worst performer
in that entire sample, and beside the TikTok result that the corpus's two shortest videos are the
best post on one account and the worst on another, and the conclusion is consistent across three
honestly sampled platforms: **maximum compression is not a strategy.** It is a thing that sometimes
coincides with a good post.

The same account also supplies the one counterexample to the ask-back finding in the reddit section.
The only post in the Bluesky set that asks its audience a direct question is the worst post on its
account. Ask-backs work where the community is the product. On a follower feed they appear to be
worth much less, and the two platforms should not be treated as one.

### threads

**Provenance:** mined by `/patterns synthesize` on 2026-08-23 from 15 Threads analyses in a
292-entry corpus, across 3 accounts contributing 5 each, niches `adhd`, `ai-building` and
`building-solopreneur`. **5 clear this file's popularity floor**, at 1,237, 969, 727, 473 and 331
engagements. **All five belong to ONE creator**, and that is stated on every record below because it
is a real limit, not a formatting quirk.

**The sampling here is unusually good and it is worth one line.** Each account's profile was fetched
with a crawler user agent, which returns a server-rendered page; the same URL in a normal browser
returns a login wall with no post text at all. The window is the 15 original top-level posts the page
serves, self-replies filtered out, with each entry's POSITION recorded. So these are real timeline
windows, and the one creator's five posts below are his five most recent originals rather than a
selection of his best.

**Why the other two accounts contribute nothing.** Both of their biggest posts by far, at 1,241 and
4,255 engagements, are image carousels whose substance was never collected. One has four words of
caption and the other has two lines. They are the two largest posts on this platform and neither can
teach anyone what its text did, so neither is behind a template. Their remaining complete posts run
27 to 101 engagements, below the floor.

**What those two eliminated carousels DO establish, as form evidence.** On both accounts the single
biggest post is an image carousel with a caption under 260 characters, and on both the drop to the
next post is enormous: 4,255 to 154 on one, 1,241 to 185 on the other. Whatever is winning biggest on
Threads for those two creators is happening in pictures, and collecting carousel contents is the
highest-value fix available for this platform.

#### 1. The Method Defined By Its Stopping Point

- **Platform:** threads
- **Mechanism:** a method is defined by the STATE that ends it rather than by a quantity, so the
  reader gets a finish line they can actually recognise instead of a number they have to trust. Seen
  in 1 post by 1 creator, at 1,237 engagements including 119 reshares, the largest post on its
  account and the highest reshare count in the Threads set.
- **Structure / arc:**
  1. A superlative claim about method, naming the outcome it produces.
  2. The method, stated as an end condition rather than an amount. Do the thing until [the state
     that means you are finished].
  3. Stop. There is no beat 3, and this is the whole discipline of the pattern.
- **Emotional trigger:** relief from an open-ended obligation. The reader has been told to do this
  daily and never told when it is done.
- **Immediate personal payoff:** a finish line they can apply to the thing they are working on today.
- **CTA style:** none, and adding one breaks it. **CIVIC GATE:** a bare verdict is the furthest thing
  in this file from `references/civic-adaptation.md`, because its entire mechanism is having nothing
  attached. On civic material, either pick a different pattern or put one specific verified action
  finishable in under 5 to 10 minutes on a line beneath the verdict, and accept that the addition
  costs some of what makes the shape work.
- **Length and formatting:** about 100 characters, ONE sentence, no line breaks, no bullets, no
  emoji, no hashtags, no link. Every high-reshare post on this account is one sentence.
- **Shape:**
  ```
  [Beat 1: a superlative claim about method, naming the outcome]
  [Beat 2: the method, defined by the state that ends it, not by a number or a duration]
  [Stop]
  ```
  Beat 2 is the whole pattern. If the stopping condition is a quantity (thirty minutes, a thousand
  words) this becomes ordinary advice. It has to be a state the reader can check themselves against.
- **Real example:** the solopreneur account's one-sentence post defining a writing method by the
  point at which confusion ends. Citation only, do not reuse the wording.

#### 2. The Triple Parallel Swap

- **Platform:** threads
- **Mechanism:** an era or a shift is named, then three replacements are stated in a row in identical
  grammar, so the claim arrives as a pattern rather than an argument. There is no detail to disagree
  with because there is no detail. Seen in 1 post by 1 creator, at 969 engagements including 99
  reshares, second on its account.
- **Structure / arc:**
  1. Name the era or the shift, in a clause that sets up a list.
  2. Swap one: the new thing stated in place of the old one.
  3. Swap two, in the same grammar.
  4. Swap three, in the same grammar, and this one carries the sharpest pair.
  5. Stop. One sentence total.
- **Emotional trigger:** the satisfaction of a tidy frame for a change the reader already feels and
  has not been able to name.
- **Immediate personal payoff:** none, and the record is honest that this is a frame rather than an
  action. It buys language, not a task.
- **CTA style:** none. **CIVIC GATE:** same as pattern 1. A frame with nothing attached fails the
  rubric; add a verified finishable action or choose another shape.
- **Length and formatting:** about 170 characters, one sentence, three parallel clauses separated by
  commas, no bullets, no line breaks, no emoji, no link.
- **Shape:**
  ```
  [Beat 1: name the era or shift, in a clause that sets up a list]
  [Beat 2: swap one. [the new thing] in place of [the old thing]]
  [Beat 3: swap two, in the same grammar as beat 2]
  [Beat 4: swap three, same grammar, carrying the sharpest pair]
  [Stop. One sentence]
  ```
  The three swaps must be in identical grammar and must escalate, with the most contestable pair
  last. Two swaps reads as a throwaway; four reads as a list.
- **Real example:** the solopreneur account's one-sentence post naming a shift with three
  replacements in a row. Citation only, do not reuse the wording.

#### 3. Reattribute the Problem

- **Platform:** threads
- **Mechanism:** the reader is told the thing they have been trying to fix is not broken, and the
  problem is reassigned to a different variable entirely. It absolves and redirects in the same
  breath. Seen in 2 posts by 1 creator, at 473 and 331 engagements, positions 4 and 5 on that
  account's five. **Both are the account's weakest admitted posts**, which is stated because it
  matters: this shape clears the popularity floor and sits at the bottom of its own creator's range,
  so treat it as usable rather than as a winner.
- **Structure / arc:**
  1. The reassurance, stated as a refusal of the standard advice: the thing they blame is not
     broken and does not need fixing.
  2. The reattribution. The problem is not that thing, it is a different variable they lack.
  3. The condition sharpened, so that variable becomes concrete rather than a vague noun.
  4. Stop.
- **Emotional trigger:** contrarian comfort. The reader is let off a hook and handed a different,
  larger problem, which is a trade most people will take.
- **Immediate personal payoff:** a reframe they can apply immediately to something they have been
  blaming themselves for.
- **CTA style:** none in either. **CIVIC GATE:** unchanged. Add a verified finishable action if this
  is used on civic material.
- **Length and formatting:** 210 to 230 characters, three or four sentences run together as one
  block, no bullets, no emoji, no link. Quotation marks around the rejected word in one of the two.
- **Shape:**
  ```
  [Beat 1: absolve them. State that [the thing they blame] is not broken and needs no fixing]
  [Beat 2: reassign the problem. What they are actually missing is [the real variable]]
  [Beat 3: sharpen it, so the missing variable becomes concrete enough to go looking for]
  [Stop]
  ```
  Beat 2 must name something concrete enough to go looking for. Reassigning the problem to a vague
  noun leaves the reader worse off than the advice you just refused.
- **Real example:** the solopreneur account's post reassigning an attention problem to a missing
  target. Citation only, do not reuse the wording.

#### What this account's own range says, and one lead not written as a pattern

Five posts, one creator, one real window, so the internal comparison is honest even though the
cross-account one does not exist.

- **The unexplained verdict beat the explained one, on the same advice.** The account's top post is a
  single sentence. Its third post gives the SAME underlying advice with a three part justification
  attached, and draws 727 against 1,237. Same author, same window, same claim, and adding the
  reasoning cost roughly 40 percent. That is one comparison and it is worth testing rather than
  believing.
- **Reshares track compression.** The top two posts carry 119 and 99 reshares and both are one
  sentence; the bottom two carry 17 and 13. A reader reshares a claim in order to make it themselves,
  so what gets repeated is what is short enough to repeat. This is the Mastodon boost finding
  appearing on a second platform.
- **A lead held at exactly its weight, not written as a pattern.** The worst post on each of the two
  accounts with complete bodies is the most reassuring one: unconditional comfort, nothing withheld,
  nothing asked. Two accounts, two creators, ONE platform, and one of the two accounts is below the
  popularity floor entirely. That is a lead. It is not written up as a pattern and should not be
  until a differently sampled platform confirms it.

### mastodon

**Provenance:** originally mined on 2026-08-23 from 42 Mastodon analyses with the corpus at 100
entries, across 7 accounts contributing 6 posts each. **Updated 2026-08-23 in the 292-entry pass:
two more accounts were collected, so this platform now holds 54 analyses across 9 accounts.** The
three patterns below were re-checked against the two new accounts and all three still hold. The new
accounts add one thing worth knowing and change nothing else: the strongest civic post across both
of them is a queryable research map rather than an argument, which converges with the Hacker News
finding that the two civic submissions that travelled there were a petition and a tool. Note also
that 12 of the 54 now carry a media classification, so the classification gap this section flags
below is partly closed. The paragraph beneath describes the ORIGINAL 7 accounts, whose sampling
method is what earns this section its weight. 3 accounts are `building-solopreneur`,
4 are `civic-democracy`. **`inner-journey` is absent from this platform**, not under-collected: a
search across 11 hashtags on 3 instances found no creator at meaningful scale. Do not plan around
filling that gap.

**This is the best-sampled platform in the corpus and its numbers deserve the most weight.**
Everywhere else, only famous posts were reachable, so a multiple is measured against cherry-picked
siblings. Here the open API returned each account's last 40 original top-level posts, the true
median was computed across all 40, and the 6 kept per account are the single highest-engagement post
plus five chosen purely by POSITION in the timeline (0, 9, 19, 29, 39). **Nothing was selected for
looking good.** The collector also tested selection ratios: two-top-plus-four inflated the corpus
median 2.45x and would have suppressed real outliers, while one-top-plus-five came in at 1.14x mean.
That is what shipped. So a Mastodon multiple is measured against an unbiased window.

10 of the corpus's outliers are here, at least one per account. **Mastodon publishes no view count
by design**, so every result here is an engagement-baseline result and never a view ratio.

**Caveats that constrain what follows:**

- **Body-complete control.** 6 of the 42 carry media attachments and 5 are self-thread heads whose
  continuations were not collected. 8 of the 10 outliers are clean; the 2 that are not are flagged
  on their patterns below and are never used as sole evidence.
- **Two accounts have gone quiet.** One civic account's most recent original post is from
  2025-11-06 and another's is from 2026-01-12, so their 40-post windows reach back one to two years
  while the other five span weeks. **Within-account comparison stays fair. Cross-account comparison
  does not.** No pattern below rests on comparing raw numbers between accounts.
- **One account's niche fit is a judgment call.** A maintainer employed rather than self-employed,
  included because his posts are about the economics of a project he owns. The pattern drawn from
  him is maintainer economics, not open-source politics; if it ever starts reading as the latter,
  it has drifted.

**Boosts, not favourites, are how things travel here.** Several posts in this corpus draw more
boosts than favourites, ratios up to about 1.6, and they are consistently the short quotable
verdicts. A reader boosts a claim to make it themselves. Posts that draw favourites without boosts
tend to be personal or appreciative. Worth knowing when choosing what a post is for.

**Why 3 patterns and not 5 to 7.** The 42 posts contain two arcs that repeat across creators and one
that does not. The rest of the corpus is dominated by bare link shares and throwaway greetings, which
are the LOSING form here and are recorded as counter-evidence inside pattern 1 rather than dressed up
as patterns. Fewer patterns, but these carry the strongest evidence in this file: 8 clean outliers
across 5 creators measured against unbiased baselines.

#### 1. Say Something Before the Link

- **Platform:** mastodon
- **Mechanism:** the poster puts their own judgment in front of the link, so the reader gets the
  payload without clicking and knows why it matters before deciding to. Seen in 3 posts across 3
  creators, all three of them outliers, all three body-complete, at 19.0x, 10.2x and 9.3x. The
  counter-evidence is unusually strong: bare headline-plus-link shares are the single most common
  form in this sample and they cluster at the bottom of every account that uses them.
- **Structure / arc:**
  1. Your own words first. The link never leads.
  2. One of three fills, all evidenced here: a short verdict plus the lifted sentence that earned
     it; a personal frame about why you are posting this; or a recommendation with a turn.
  3. The specific reason the reader should care, in their terms, not a summary of the article.
  4. For a recommendation, the turn: what the thing gives them beyond the obvious.
  5. The link, last.
  6. Optional and effective: a one-line disclosure of your own stake.
- **Emotional trigger:** being handed a judgment by someone whose judgment the reader already
  trusts. The lifted-sentence variant goes further and pre-loads agreement, so the reader has
  accepted the point before the link is even offered.
- **Immediate personal payoff:** the argument itself, delivered inside the post. A reader who never
  clicks still leaves with something, which is why beat 2 cannot be a generic "this is worth
  reading". The clearest case in the corpus: five bare headline shares on one account run 3 to 17
  favourites, and the one post that added two words of reaction and quoted the key sentence ran 93,
  about 19 times that account's true median.
- **CTA style:** read the linked thing, but the post is complete without it. Non-civic material
  keeps the ordinary `config/cta.yaml` default. **CIVIC GATE:** three of the four civic accounts
  here post almost entirely links to news that offers the reader nothing to do, and that is a
  finding about the niche, not a model to copy. To clear Muxin's bar this shape needs a close
  pointing at one specific verified thing the reader can finish in under 5 to 10 minutes, local
  where possible. The one civic winner here already did that: it pointed at a tool the reader could
  use the next time they bought something. One factual note for register, no more: across the civic
  accounts, the constructive posts outperformed the alarm posts within their own windows.
- **Length and formatting:** 150 to 460 characters. Verdict or frame first, quotation as its own
  block when used, link last on its own line. No hashtags on any of the three winners. Note the
  limit case: where an audience is already deep in a running story, three words plus a link is
  enough, so the "something" scales to how much context the reader already has.
- **Shape:**
  ```
  [Beat 1: your own words. The link does not go here.]
  [Beat 2: pick ONE fill and commit to it:
     (a) a short verdict, then the one sentence from the piece that earned it, quoted
     (b) why YOU are posting this, something true about your relationship to the reader
     (c) a recommendation: what this thing is, in one line]
  [Beat 3: the specific reason it matters to them, never a summary of the article]
  [Beat 4, for a recommendation: the turn, what it gives them that they would not expect]
  [Beat 5: the link, last]
  [Beat 6, optional: your stake, disclosed in one short parenthetical]
  ```
  Beat 2(a)'s quotation must be lifted accurately from the source. Beat 6 must be true. If the only
  thing you can say is that something is interesting, this shape has nothing to work with, and the
  corpus shows that a two-word generic praise adds close to nothing.
- **Real example:** Heidi Li Feldman, Mastodon, her post pairing a two-word reaction with a pulled
  quote from a commentary piece, against five bare headline shares on the same account. Also Dan
  Gillmor, Mastodon, his recommendation of a consumer-guidance site with a disclosed donor
  relationship. Citation only, do not reuse the wording.

#### 2. The Candid Constraint

- **Platform:** mastodon
- **Mechanism:** the person running the thing states an unflattering internal reality in specific
  terms, explains why it is that way, and often ends by asking for the help that would fix it. The
  admission buys credibility and the ask spends it. **Seen in 2 posts by 1 creator**, at 841 and 205
  favourites-plus-boosts, both body-complete. It was written on 3 posts across 2 creators; the third,
  a 6.2x post at 117 engagements, fell below this platform's popularity floor when the gate changed
  on 2026-08-23 and is now named as context rather than counted as evidence. Its multiple was real
  and its raw numbers were not big.
- **Structure / arc:**
  1. The uncomfortable fact, first, with an exact number in it where one exists.
  2. The honest reaction, in the words actually used privately rather than in status-update
     language.
  3. The reason, given as a decision the poster made or a constraint they operate under, never as
     an accident.
  4. What it does not mean, meaning the reassurance that stops the admission reading as
     indifference.
  5. The value that explains why this particular thing was hard to say.
  6. The ask, or the constraint named plainly, in one sentence.
- **Emotional trigger:** trust through exposure. Someone volunteering information that makes them
  look worse in the short term is read as evidence that the rest of what they say is true. The
  audience converts an annoyance into loyalty.
- **Immediate personal payoff:** a straight answer about something the reader was confused or
  annoyed by, plus a timeline. Where the post ends in an ask, a small number of readers also get a
  direct route into work they were qualified for and did not know was open.
- **CTA style:** where one exists it is a genuine, completable ask with no link and no form, just
  tell me if this is you. That already clears a micro-action bar. Non-civic here, so the ordinary
  `config/cta.yaml` default applies otherwise.
- **Length and formatting:** 200 to 500 characters. Short paragraphs. Exact numbers in the opening
  sentence. Deliberately informal verbs in the middle. The strongest example carries no link, no
  hashtag and no emoji.
- **Shape:**
  ```
  [Beat 1: the uncomfortable fact, with a real number in it (how many people, how long, how often)]
  [Beat 2: the honest reaction, in the words you would actually use, not the professional version]
  [Beat 3: why, framed as your decision or your constraint, never as bad luck]
  [Beat 4: what it does not mean, so the admission does not read as not caring]
  [Beat 5: the value at stake, one line, why this was hard to say]
  [Beat 6: the ask, specific enough that the right person recognises themselves, or the
     constraint named plainly]
  ```
  **The admission has to cost something.** The same account's post sharing a comfortable internal
  state sat at baseline while its post admitting a gap ran 15.3x. Every number and every constraint
  must be true; a manufactured vulnerability is the exact failure this shape invites.
- **Real example:** Daniel Stenberg, Mastodon, his post about his project's security team lacking
  anyone on a major platform, ending on an open invitation. Also Daniel Supernault, Mastodon, his
  post disabling a shipped migration feature and explaining the one-person constraint behind it.
  Citation only, do not reuse the wording.

#### 3. The Sideways Critique `(single sighting, clean)`

- **Platform:** mastodon
- **Mechanism:** attack the thing on an axis nobody is defending. Everyone in the argument has their
  moral counterarguments loaded, so switching to analogy or to taste walks straight past the
  defence. **Evidence is one clean post and one thread head.** The clean one is the largest multiple
  in the entire corpus at 37.3x; its sibling at 8.8x is a self-thread head whose continuations were
  never collected, and both are from one creator. Recorded because of the size of that one result,
  not because it repeats.
- **Structure / arc:**
  1. Build a counterfactual world in one long sentence, with the harm concrete and its scale pinned
     to something specific.
  2. Put the choice to the reader personally: would they take part in that world.
  3. Voice the rationalisation in quotation marks, in the voice of someone who means it, made
     genuinely plausible rather than strawmanned.
  4. Snap to the real target in one short sentence.
  5. Stop. Do not explain the analogy afterwards.
- **Emotional trigger:** recognition arriving as a small shock. The reader agrees with an argument
  about something else, commits, and only then learns it was about them. Quoting the rationalisation
  fairly is what makes the trap fair rather than cheap.
- **Immediate personal payoff:** a ready-made frame for an argument the reader is probably already
  having, plus the relief of hearing a discomfort named precisely.
- **CTA style:** none, and the winner carried no link and no hashtag. The withheld conclusion is
  what drives boosts, because forwarding it is how the reader makes the argument themselves. On
  civic material this shape would still need a completable close added to clear the rubric, and it
  does not have one natively.
- **Length and formatting:** 280 to 390 characters in two paragraphs, and **the imbalance is the
  mechanism**: a long setup paragraph carrying the whole counterfactual, then a single short
  sentence. No link, no hashtag.
- **Shape:**
  ```
  [Beat 1: the counterfactual world, one long sentence, harm named concretely and scale pinned]
  [Beat 2: put the choice to the reader directly. Would they participate in that world, and on
     what terms]
  [Beat 3: the rationalisation, in quotes, in the voice of someone who believes it and is not stupid]
  [Beat 4: the snap, one short sentence naming the real subject]
  [Stop. No explanation, no restatement, no link.]
  ```
  Beat 1's counterfactual must be recognisably true of the thing it describes, and beat 3 must be a
  rationalisation someone actually makes. A strawman collapses this shape, and an analogy the reader
  can dispute on facts turns the argument into a debate about the analogy.
- **Real example:** Baldur Bjarnason, Mastodon, his post transposing a technology-industry argument
  onto a different regulated industry and snapping back in the final line. Citation only, do not
  reuse the wording; the transposition is the borrowable thing, never the sentences.

### tiktok

**Provenance:** mined by `/patterns synthesize` on 2026-08-23 from 38 TikTok analyses in a 292-entry
corpus, across 7 accounts contributing 3 to 8 posts each: two ADHD and mental-health accounts, two
AI and solopreneur accounts, two civic and news accounts, one general. They range from a small
account to one of the largest in the corpus.

**TikTok is the only platform in this corpus with real view counts AND real spoken transcripts on
every entry.** Every other section is working from engagement sums, or from captions,
or from a description of a video nobody transcribed. Here, 37 of 38 entries carry a complete
auto-caption transcript pulled from TikTok's own JSON, plus a play count and the account's follower
count. That makes one bar available here and nowhere else, and it is the bar Muxin's original
reference tools were built on.

**How popular these actually are.** 24 of the 38 clear this file's 100,000 view floor and are
admitted as pattern evidence; 13 fall below it and 1 is body-incomplete. Of the admitted set, 9 clear
a million views and the largest is 9.7 million. Those are the numbers the templates below were
written from.

**One sampling line, as promised at the top of the file.** These accounts were reached by search, so
which of their videos got collected is not random and a within-account ranking is not a measured
result. One account is the documented exception: its collection notes record a real 7-video account
sample with a median of 782 views, alongside one video at 896,100. Multiples appear below as
context. The view counts are what admit a post.

**Two things the corpus tested and did NOT find. Both matter, because both are widely believed.**

- **Duration does not predict within-account rank.** Sorted by views inside each account and scored
  by rank percentile, videos of 35 seconds or less average 0.51 and videos over 35 seconds average
  0.50, where 0 is best in its account. The two shortest videos in the entire corpus land at
  opposite extremes: a 10 second video is the best post on its account, and a 13 second video is the
  worst on its own. The longest video in the corpus, at 118 seconds, is its account's worst, and the
  second longest, at 94 seconds, is another account's best. **Do not shorten a video because this
  file told you to. This file did not.**
- **On-screen text does not predict within-account rank either.** 20 entries carry on-screen text
  and average 0.49; 18 do not and average 0.51. On-screen text does real craft work, described in
  pattern 2 below, and the corpus cannot show that its presence buys reach.

**What the corpus can see and cannot see.** Every transcript is words. Nobody watched a single
video. Cuts, pacing, faces, captions burned into the frame, music, and the first visual frame are
all invisible here, and on this platform they may matter more than the words do. Read every pattern
below as a claim about the SCRIPT and about nothing else.

#### 1. Open on Something True of Everyone

- **Platform:** tiktok
- **Mechanism:** the first sentence is a fact about the viewer's own life that requires no interest
  in the creator's subject. The topic narrows afterwards. Carried by 1 post from 1 creator, and it
  is the single best-evidenced TikTok record in this file: **896,100 views**, nine times this file's
  floor for the platform. Its six siblings, at 248 to 2,805 views, all open by addressing founders,
  and the account's own collection notes record a 782 view median across the seven.
- **Structure / arc:**
  1. The blunt universal fact, three to six words, second person, no preamble.
  2. A consequence of it, made concrete with real units of time or number.
  3. The pivot: given that, why are you doing the thing you are doing.
  4. The generalisation, one line, that reframes the pressure the viewer is under.
  5. A short instruction to close, two or three parallel clauses.
- **Emotional trigger:** a jolt in the first second, then relief as it converts into permission. The
  jolt is the scroll-stopper and the permission is why the viewer stays to the end.
- **Immediate personal payoff:** permission, applied to something bothering the viewer today. No
  information is transferred at all, which is the point: the payoff is a released obligation.
- **CTA style:** none. The mined post closes on an instruction about how to live, not a click.
  **CIVIC GATE:** this shape opens perfectly for civic material, because a concrete personal
  consequence is exactly what `references/civic-adaptation.md` table 1 asks for in the first three
  seconds. It closes badly, because a life instruction is not a micro-action. Keep beats 1 to 4 and
  replace beat 5 with one specific verified thing finishable in under 5 to 10 minutes, or with
  neutral record-based value matching. Never invent the thing being pointed at.
- **Length and formatting:** 26 seconds, no on-screen text, spoken straight to camera, about 570
  characters of transcript. Note that this is less than half its own account's median duration, and
  note equally that duration explains nothing across the corpus. What changed was the audience the
  first sentence addressed, not the runtime.
- **Shape:**
  ```
  [Beat 1: a fact true of every viewer, second person, under six words]
  [Beat 2: its consequence, with a real number or time unit]
  [Beat 3: the pivot. Given that, ask why they are doing [the thing they are doing]]
  [Beat 4: the reframe, one line]
  [Beat 5: the close. Two or three parallel instructions]
  ```
  Beat 1 has to be true of someone who has never heard of Muxin and does not care about her subject.
  If it contains a job title, a tool name, or a niche word, this shape is not being used.
- **Real example:** Matt Gray, TikTok, his 26 second video opening on mortality, set against the six
  founder-advice videos on the same account. Citation only, do not reuse the wording.

#### 2. The Frame On Screen, the Delivery in the Mouth

- **Platform:** tiktok
- **Mechanism:** the on-screen text says what this is, and the spoken track never does. The audio
  performs, re-enacts or delivers, while the text supplies the premise, the count and the labels.
  Seen in 9 posts across 4 creators. **This is a craft record, not a performance claim:** on-screen
  text does not predict rank in this corpus, so use this for legibility, never as a reach tactic.
- **Structure / arc:**
  1. On-screen line 1: the frame. What the viewer is about to watch, and why.
  2. On-screen line 2, optional: the count, the promise, or the fix.
  3. Spoken track: straight into performance, mid-scene or mid-list, with no framing at all.
  4. On-screen labels appear through the video to number or name what the audio is doing.
  5. No spoken restatement of the frame at any point.
- **Emotional trigger:** varies by fill. The structural effect is that a muted viewer still knows
  what they are watching, and an unmuted one is never told twice.
- **Immediate personal payoff:** varies. The consistent one is orientation in under a second.
- **CTA style:** none in seven of the nine. **CIVIC GATE:** unchanged, and this shape offers a good
  place to put a real micro-action, as a final on-screen line rather than a spoken ask.
- **Length and formatting:** 10 to 94 seconds. On-screen text is short, 2 to 6 lines total, often
  all capitals. The spoken track never opens with a greeting, a name, or a channel introduction in
  any of the nine.
- **Shape:**
  ```
  [ON SCREEN: the frame. What this is]
  [ON SCREEN, optional: the count, the promise, or the fix]
  [SPOKEN: begin mid-scene or mid-list. Never explain the frame]
  [ON SCREEN: labels through the video, numbering or naming]
  [Never say out loud what the screen already said]
  ```
  The discipline is the negative rule. The moment the audio starts explaining the premise, this
  structure collapses into a talking head with subtitles.
- **Real example:** the ADHD account's 10 second video whose on-screen text names three things the
  creator was ashamed of while the audio only acts them out. Citation only, do not reuse the wording.

#### 3. The Chain of Reasonable Steps `(thin evidence, single sighting)`

- **Platform:** tiktok
- **Mechanism:** a simple shared intention, then each line adds one individually sensible
  prerequisite, until the chain has consumed the original intention entirely. The absurdity is
  visible only from outside. Seen in 1 post by 1 creator, ranked 2 of 6 on its account at 460,100
  views.
- **Structure / arc:**
  1. The intention, stated plainly. Small and ordinary.
  2. Prerequisite 1, offered as an improvement rather than an obstacle.
  3. Prerequisites 2 through 4, each triggered by the last, each defensible alone.
  4. A hard blocker appears that cannot be solved today.
  5. The solution defers everything to tomorrow.
  6. The punchline: someone asks what is happening now, and the answer is the original state,
     unchanged.
- **Emotional trigger:** recognition escalating into helpless laughter. The open question is whether
  they will ever get up, and it is withheld until the final line.
- **Immediate personal payoff:** none. Recognition only, which on an identity-niche account is what
  the audience came for.
- **CTA style:** none, and adding one would break the ending. **CIVIC GATE:** this shape has no
  natural place for a micro-action, so on civic material either pick a different pattern or append
  the action as a separate final beat outside the bit.
- **Length and formatting:** 65 seconds, dialogue only, two speakers, no narration. On-screen text
  is a two line frame naming the bit. About 1,200 characters of transcript.
- **Shape:**
  ```
  [Beat 1: the small ordinary intention]
  [Beat 2: prerequisite one, framed as an improvement]
  [Beats 3 to 5: each new prerequisite triggered by the last, each defensible alone]
  [Beat 6: a blocker that cannot be solved today]
  [Beat 7: everything deferred to tomorrow]
  [Beat 8: someone asks what is happening now, and the answer is beat 1, undone]
  ```
  Every link must be genuinely reasonable. One obviously silly step and the viewer stops recognising
  themselves and starts watching a sketch.
- **Real example:** the ADHD account's video about a plan to shower that ends in bed. Citation only,
  do not reuse the dialogue.

#### 4. Evidence First, Judgment Second, Ask Third

- **Platform:** tiktok
- **Mechanism:** the source material plays before any narration, so the viewer forms the reaction
  themselves and the creator arrives to confirm it rather than to install it. Seen in 3 posts across
  2 creators, at 8.4M, 7.9M and 1.1M views.
- **Structure / arc:**
  1. The raw clip or the primary detail, first, with no framing.
  2. The minimum orientation: where, who, what they were doing. Two sentences at most.
  3. An invitation to verify, in the versions that have one, pointing the viewer at the evidence.
  4. The creator's position, often posed as a question to the audience before being answered.
  5. The ask, which in the strongest version is the same act as sharing the post.
  6. A closing line that returns it to the audience as a group.
- **Emotional trigger:** anger or disbelief that the viewer arrived at before being told to, which is
  what makes it feel like their own conclusion.
- **Immediate personal payoff:** an outlet for a feeling the post just created, available in one tap.
- **CTA style:** distribute it. **CIVIC GATE, and read this one carefully.** The strongest post in
  this pattern asks viewers to mass-identify a private individual. That is a real, completable
  action and Muxin must not copy it. `references/civic-adaptation.md` requires the action to point
  at something real and verified, and this file adds the obvious constraint that it must not be a
  person. Take the ordering, evidence then judgment then ask, and put a verified micro-action in the
  ask slot: a specific bill, a specific form, a named record, local where possible.
- **Length and formatting:** 50 to 94 seconds. Little or no on-screen text. Source audio runs before
  the narration in two of the three.
- **Shape:**
  ```
  [Beat 1: the primary source. Plays first. No framing]
  [Beat 2: minimum orientation. Where, who, what. Two sentences]
  [Beat 3: invite the viewer to check for themselves, then supply the evidence]
  [Beat 4: Muxin's position, put as a question first]
  [Beat 5: the ask. One verified, specific, finishable action. Never a person]
  [Beat 6: back to the audience as a group]
  ```
  Beat 1 requires the evidence to actually exist and to be Muxin's to show. Without it this shape is
  just an angry monologue with a delay at the front.
- **Real example:** the Spanish-language civic account's video that opens on the source audio of an
  incident before any narration begins. Citation only, do not reuse the wording, and do not reuse
  the target.

#### 5. The Dry Policy Story Told Through the Joke Everyone Already Has

- **Platform:** tiktok
- **Mechanism:** a piece of genuinely dull policy is delivered entirely through an object the
  audience already jokes about, and the closing line lands the ruling on the viewer's own street.
  Seen in 1 post by 1 creator, at **4,000,000 views**, the second largest in the TikTok set.
  `(thin evidence, single sighting)`
- **Structure / arc:**
  1. Two words of news framing, then the specific outcome in the same sentence.
  2. The scale, in counted units the viewer can picture.
  3. The price or the number that makes it absurd.
  4. The problem quantified, as a percentage or a frequency the audience has personally met.
  5. The old constraint: who was allowed to fix it, and what that cost.
  6. The challenger and the conflict.
  7. The ruling.
  8. The landing: what this means at the branch nearest the viewer.
- **Emotional trigger:** the satisfaction of finally learning why a running joke was true. The
  curiosity gap is why was this ever broken, and the answer turns out to be a policy story.
- **Immediate personal payoff:** understanding of a thing that has personally annoyed them, plus the
  prospect it gets fixed.
- **CTA style:** none in the mined post. **CIVIC GATE:** this is the closest thing in the corpus to
  a model civic structure and it is one beat short of clearing the bar. Beat 8 already localises,
  which table 1 asks for. Add one verified micro-action after it and this shape does everything
  `references/civic-adaptation.md` wants.
- **Length and formatting:** 46 seconds, a two line on-screen news label, dense narration of about
  900 characters carrying at least five specific numbers.
- **Shape:**
  ```
  [Beat 1: news framing plus the specific outcome, one sentence]
  [Beat 2: the scale, in counted units]
  [Beat 3: the number that makes it absurd]
  [Beat 4: the problem, quantified, that the viewer has personally hit]
  [Beat 5: the old constraint and what it cost]
  [Beat 6: the challenger and the fight]
  [Beat 7: the ruling]
  [Beat 8: what it means at the [shop / office / school] nearest the viewer]
  ```
  The object in beat 1 must be something the audience already has a relationship with. On this same
  account, a straightforwardly shocking crime story with no such object ran at a seventh of this
  one's reach.
- **Real example:** the news account's video explaining a right-to-repair ruling entirely through a
  fast food chain's ice cream machines. Citation only, do not reuse the wording.

#### 6. Count and Fix in the Same Breath

- **Platform:** tiktok
- **Mechanism:** the on-screen title names a counted list AND the remedy at once, so the viewer knows
  the length of the commitment and the reward before a word is spoken. Seen in 3 posts across 2
  creators, ranked 1, 3 and 5 on their accounts.
- **Structure / arc:**
  1. On-screen title: the count, then the fix, in one line each.
  2. Straight into the list, no preamble, items delivered fast and surface-level so each is
     checkable against the viewer's own behaviour.
  3. The reframe that stops it being an attack: the problem is doing it badly, not doing it.
  4. The turn to the fix, announced.
  5. The fix delivered in a form the viewer can keep: a prompt, a URL, a specification.
- **Emotional trigger:** mild embarrassment about something they did this week, resolved inside the
  same video rather than left as homework.
- **Immediate personal payoff:** the strongest in the TikTok set. A saveable artifact usable in under
  a minute.
- **CTA style:** save it, or go to a named destination. One of the three reads a URL aloud and shows
  it on screen, and it is the second best post on its account, which is worth knowing given the
  common claim that links suppress a video. **CIVIC GATE:** already close. The destination must be
  real and verified, and on civic material it should be local and specific.
- **Length and formatting:** 38 to 94 seconds. Two line on-screen title carrying the count and the
  promise. No spoken introduction in any of the three.
- **Shape:**
  ```
  [ON SCREEN: a count plus the category, then, on its own line, that a remedy is included]
  [Beat 1: straight into the list. No preamble. Items surface-level and checkable]
  [Beat 2: the reframe. The problem is doing it badly, not doing it]
  [Beat 3: announce the turn to the fix]
  [Beat 4: the fix, in a keepable form: a prompt, a URL, a specification]
  ```
  Beat 2 is what keeps the audience from feeling accused. Beat 4 has to be something they can hold,
  not advice; an instruction to be more careful does not fill this slot.
- **Real example:** the AI account's video listing tells of machine-written text and closing with a
  saveable editing prompt. Citation only, do not reuse the wording or the prompt.

#### What TikTok shows that is worth more than a seventh pattern

- **The biggest scripts in the set contain no information.** The 896,100 view breakout transfers no
  fact, names no tool, and teaches nothing. The two largest videos on other accounts are the same: a
  staged conversation at 3.9 million and a policy explainer at 4 million, and the explainer wraps its
  one fact in an object the audience already jokes about. **The biggest numbers here did not come
  from being useful.** They came from being about the viewer.
- **The weakest accounts open on themselves.** The smallest account in the set by views, at 23,800
  to 48,300, opens every one of its four videos on a thought the creator had. The strongest openers name a state
  the viewer is already in, or start mid-scene with no narrator at all.
- **A repurposed clip lost to five original scenes on the same account, in the same window.** One
  podcast excerpt sits last of six on an account whose other five are original. That is one account,
  and it converges with the recycled-material finding this file already carries from Substack and
  Mastodon.

### youtube

**Provenance:** mined by `/patterns synthesize` on 2026-08-22 from 11 YouTube analyses in a 53-post
corpus, across 4 accounts (Ali Abdaal, Mel Robbins, Dan Koe, Nicole LePera). All are short-form,
roughly 30 to 120 seconds, in the `building-solopreneur` and `inner-journey` niches, so **none of
these are civic and none carry a civic adaptation.** For civic material on this platform, run the
chosen shape through `references/civic-adaptation.md` table 1 before drafting.

**Read this before trusting these records, and note what changed on 2026-08-23.** Under the old
ratio-based gate ZERO YouTube posts qualified. Under the popularity gate **5 of the 24 collected
YouTube entries clear the 25,000 view floor**, at 26,700, 55,100, 73,400, 112,500 and 183,600 views.
That is real popularity and these patterns are no longer evidence-free. What has NOT changed: 13 of
the 24 are body-incomplete, and on this platform that mostly means the collected body is the written
DESCRIPTION rather than the spoken track, so those cannot say what the video said. The patterns below
are supported by repetition across creators as much as by any single number. Where a pattern is
carried by one creator, the record says so.

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
  3. Lower the stakes twice, naming two things the artifact does not have to be.
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
  [Beat 1: announce the first action in the first person plural and begin it immediately, no setup]
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
  [Beat 3: a turn signal in Muxin's own words, marking that the advice is arriving now]
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

**Mined 2026-08-23 and too thin to carry patterns. This is a finding, not a to-do.** 13 Instagram
analyses across 4 accounts. **11 of the 13 are body-incomplete and NONE clears the popularity
floor**, so nothing here is admitted as pattern evidence.

The blocker is structural rather than a matter of collecting more. Every video entry's `body` is the
written CAPTION, not the spoken track, and Instagram exposes no play count to a logged-out reader,
so what a reel actually said and how far it actually travelled are both invisible. One account
contributes three entries with no metrics at all. Under the mode 2 rule, a caption entry cannot be
made to answer for a spoken hook and none was guessed here.

What the captions do show, recorded as caption craft only and not as patterns:

- **Break your own visible rule as the signal.** One account's top caption establishes a five and a
  half year track record, states a rule it has never broken, and then breaks it, letting the breach
  carry the urgency without describing the emergency. It requires a long public track record first.
- **Concede, then draw the line in the first person plural.** Grant the reader's position, then say
  what we cannot do rather than what you cannot do, which lets a disagreeing reader stay in the room.
  This is the joyful-activism register `references/hook-patterns.md` already prefers for civic
  material, compressed into one sentence.
- **Frame the frightening thing as the next lesson.** One caption pivots to an ominous subject by
  calling it the next lesson in a course the audience has been taking, which lowers the temperature
  without softening the content.

**To make this platform minable**, a collection run needs the spoken transcript and a play count.
Until then, do not draft for Instagram from this file. Fall back to `references/hook-patterns.md`
and to the per-channel angle in `config/platforms.yaml`.

### reddit

**Provenance:** mined by `/patterns synthesize` on 2026-08-23 from 25 Reddit analyses in a 292-entry
corpus, across **6 subreddits and 25 different posters** (no poster appears twice). Niches:
`adhd`, `general-viral`, `ai-building`, `product-thinking`, `solopreneur`, `civic-tech`.

**The unit here is the SUBREDDIT, not the account.** Every other section in this file is organised
around creators who have followers. Reddit has neither: 25 posts, 25 strangers, no account effect
to control for. What replaces it is the community, and what wins splits so hard between communities
that a single "Reddit pattern set" would be false in every direction at once.

**These are big numbers first.** 18 of the 25 clear this file's 250-engagement floor and are the
basis for the templates below, running from 422 to 43,342 engagements. 4 are body-incomplete
screenshot or video posts, admitted as TITLE evidence only, and 3 fall below the floor.

**The multiples are unusually good context here, so they are quoted throughout.** Each subreddit's
TRUE median was computed from an unbiased window of its `/new` listing, posts left to settle for days
so votes had landed, and the collected posts are its top-of-year listing with position recorded.
**This is the only place in the corpus where the scoring script is wrong and must be ignored.** `npm run patterns:outliers`
compares each post against its siblings, and here every sibling is also a top-of-year post, so it
reports r/ADHD's biggest post of the year at 2.2x and flags zero Reddit outliers. The real numbers
are these:

| subreddit | true median | top post | multiple | what the top of the year looks like |
|---|---|---|---|---|
| r/SideProject | 1 | 5,777 | 5777x | video demos, positions 1 and 2, first text post at 68 |
| r/ClaudeAI | 2 | 20,414 | 10207x | screenshots, positions 1 to 19, first text post at 20 |
| r/ADHD | 3 | 12,286 | 4095x | **all plain text** |
| r/ProductManagement | 12 | 899 | 75x | one screenshot at 1, then text |
| r/LifeProTips | 691 | 42,477 | 61x | **all plain text** |
| r/civictech | 4 | 27 | 6.8x | **eliminated, see below** |

**Read the r/LifeProTips row against the r/ADHD row before using any multiple here.** 61x in
r/LifeProTips is a harder thing to do than 4095x in r/ADHD, because heavy moderation kills the weak
posts before they can drag the median down, so the median it beats is 691 rather than 3. A multiple
is only meaningful next to the median it was measured against, which is exactly why this file no
longer gates on them. The raw counts are comparable and the multiples are not.

**r/civictech was eliminated by the popularity gate.** Its best post of the entire year is 27
upvotes, which is 34 engagements all in, well under this file's 250 floor. Its 6.8x multiple is
arithmetic on numbers too small to mean anything, and no pattern below is drawn from it. All three of its posts were analysed anyway and are on the record as
eliminated evidence. The useful finding from them is not a shape: **r/civictech is a room of
practitioners, not a distribution channel.** One of its posts opens on a genuinely strong statistic
contrast and still drew 22 upvotes. Structure and venue are separate problems, and this is the
cleanest proof of it in the corpus.

**Where the title patterns went, and why.** Reddit and Hacker News are the only channels in this
corpus where the title is a separate field from the body, and on both of them it is most of the
craft. Those title shapes are written **here, inside the platform sections**, not appended to
`references/hook-patterns.md`. The reason is that a hook pattern is the first line of a body, read
by someone who has already stopped scrolling on that post. A Reddit title is the entire artifact in
the feed: it has to survive alone, with no body visible, and on the two title-first posts in this
set (a screenshot and a video demo) it is also the only text that exists. Those are different jobs,
and merging them would let title logic leak into feeds where it does not apply. Cross-reference
rather than copy.

**Body-complete control.** Four collected posts have `body_is_complete: false`: two r/SideProject
video demos and two screenshot posts, whose bodies are just their titles repeated. They are used as
**title and form evidence only** and never as body-structure evidence. That distinction is load
bearing, because those four are the biggest posts in two of the six subreddits.

#### 1. The Whole-Tip Title `(subreddit-specific: r/LifeProTips)`

- **Platform:** reddit
- **Mechanism:** the title carries the complete, usable tip, so a reader who never opens the post
  still gets the value. The body exists only to prove the title. Seen in 5 posts across 5 posters,
  all 5 in r/LifeProTips, running 61x, 36x, 33x, 19x and 16x that community's true median of 691.
- **Structure / arc:**
  1. Title: the whole instruction, in the imperative, specific enough to act on.
  2. Body beat 1: the occasion it came from, or the source it was read in. Concrete and dated where
     possible.
  3. Body beat 2: what happened without the tip, in the poster's own experience.
  4. Body beat 3: the mechanism spelled out, including the geometry, the number, or the exact
     wording of the alternative.
  5. Body beat 4, optional: a second domain the same rule works in.
  6. Stop. No summary, no moral, no ask.
- **Emotional trigger:** the click of an obvious thing nobody said out loud. There is no suspense
  to hold, and trying to add any is what breaks this shape.
- **Immediate personal payoff:** direct, and it is the whole point of the subreddit. Four of the
  five winners can be acted on within a day at zero cost. The lowest performer of the five is the
  one whose action costs an email and an hour of the reader's time, which is a real signal about
  how much friction this shape tolerates.
- **CTA style:** none. Not one of the five asks for anything, and none carries a link. The tip is
  the CTA. **CIVIC GATE:** this shape is unusually well suited to Muxin's civic rubric, because a
  micro-action that can be finished in under 5 to 10 minutes IS a whole-tip title. It must point at
  something real and verified, never an invented form, deadline, race or measure
  (`references/civic-adaptation.md`). Local and specific beats national and abstract here for the
  same reason the arena-seating tip beat the philosophical ones: the reader can do it.
- **Length and formatting:** title 45 to 115 characters. Body 450 to 1,500 characters, three to
  seven short paragraphs. **No bullet lists in any of the five, including the one describing a
  four-step physical procedure.** No emoji except one closing smiley in one post. No links in any
  of the five.
- **Shape:**
  ```
  TITLE: [the complete instruction, imperative, specific enough to do]
  [Beat 1: the occasion or the source. Where this came from, concretely]
  [Beat 2: what went wrong without it, in your own experience]
  [Beat 3: the mechanism, with the number, the geometry, or the exact alternative wording]
  [Beat 4, optional: one more place the same rule works]
  [Stop]
  ```
  Beat 2 must be Muxin's own experience or clearly attributed to someone else. Beat 3 is where a
  vague tip dies, so if there is no number, geometry or exact wording to put there, this is the
  wrong shape.
- **Real example:** the top-of-year post in r/LifeProTips about how to arrange a group's seats at a
  sports arena, and its sibling about a rule borrowed from a parenting forum. Citation only, do not
  reuse the wording.

#### 2. The Withheld-Payoff Title

- **Platform:** reddit
- **Mechanism:** the title names that something happened without naming what, so the only way to
  close the gap is to open the post. The opposite bet from pattern 1, and it works in the
  discussion subreddits rather than the tip subreddits. Seen in 3 posts across 3 posters in 3
  different subreddits, at 1859x (r/ADHD, true median 3), 33x (r/ProductManagement, true median 12)
  and 943x (r/SideProject, true median 1).
- **Structure / arc:**
  1. Title: two to twelve words. A subject and a verb, or a superlative with the noun missing.
  2. Body beat 1: the mundane setup, stated flatly. The more ordinary this is, the better the turn
     lands.
  3. Body beat 2: the turn, arriving early. In all three cases it is in the first third.
  4. Body beat 3: the specifics, dialogue or detail, so the reader can judge it themselves.
  5. Body beat 4: the poster's own position, stated plainly.
  6. Body beat 5: hand it to the room.
- **Emotional trigger:** an open loop the title opens and only the body closes. Underneath it, in
  all three, sits something the reader wants adjudicated rather than explained.
- **Immediate personal payoff:** thin, and that is honest. Two of the three offer no payoff at all
  beyond a verdict to agree with. The third offers a self-test the reader can run in ten seconds.
  **This shape trades payoff for reach**, and Muxin's civic rubric wants payoff, so see the gate
  below before using it on civic material.
- **CTA style:** a call to conversation, sometimes one word. **CIVIC GATE:** this shape's natural
  close is an opinion request, which is not a micro-action and will not clear
  `references/civic-adaptation.md`. On civic or social-issues material the withheld title can stay,
  but the close must be replaced with either one specific verified action finishable in under 5 to
  10 minutes, or neutral record-based value matching. Never "vote", "get involved", or "stay
  informed". If neither can be verified as real, fall back to the general default rather than
  inventing one.
- **Length and formatting:** title 22 to 60 characters. Body 450 to 1,400 characters. One of the
  three is a single unbroken paragraph, the other two run many one-line paragraphs. Dialogue in
  quotation marks. No emoji, no links, no hashtags in any of the three.
- **Shape:**
  ```
  TITLE: [subject + verb, or a superlative with the noun withheld. Say that it happened, not what]
  [Beat 1: the ordinary setup, flat]
  [Beat 2: the turn, in the first third]
  [Beat 3: the specifics, quoted or counted, so the reader can judge]
  [Beat 4: where Muxin actually stands, one sentence]
  [Beat 5: hand it to the room]
  ```
  Beat 3 is the load-bearing beat. A withheld title that pays off in generalities reads as
  clickbait, and this audience punishes that harder than most.
- **Real example:** the r/ProductManagement post whose title promises the most unexpected part of a
  career and whose body turns out to be about translating one feature for five different internal
  audiences. Citation only, do not reuse the wording.

#### 3. The Self-Implicating Confession Title

- **Platform:** reddit
- **Mechanism:** the poster is the subject of their own criticism, stated in the title, which buys
  the right to make the point without lecturing. Seen in 3 posts across 3 posters in 3 different
  subreddits, at 4095x, 10207x and 992x their community medians. **Note the middle one is a
  screenshot post, admitted here as TITLE evidence only.**
- **Structure / arc:**
  1. Title: first person, past tense, admitting the thing.
  2. Body beat 1: the apology or the admission, addressed to the group, before any content.
  3. Body beat 2: the wrong belief stated in the words the group actually hears from outsiders.
  4. Body beat 3: the correction, blunt and short.
  5. Body beat 4: the evidence, observable and mundane rather than felt or clinical.
  6. Body beat 5: the turn to what actually helps, or to the upside.
  7. No moral, no summary.
- **Emotional trigger:** vindication for the group. Someone is conceding in public a point the
  reader has lost arguments about, and the confession in line one tells them so before they have to
  get defensive.
- **Immediate personal payoff:** social ammunition, right now. The reader gets something they can
  send to a person who does not believe them, which is the payoff the top r/ADHD post of the year
  actually delivered.
- **CTA style:** none in any of the three. **CIVIC GATE:** unchanged. If this shape is used on
  civic material it still needs a verified micro-action or record-based value matching at the
  close, per `references/civic-adaptation.md`, and the confession does not substitute for it.
- **Length and formatting:** title 26 to 58 characters. Body 450 to 1,700 characters. One uses a
  four item bulleted list of observed behaviours, the others use none. No links, no hashtags. The
  one emoji in the set is on the screenshot post's title.
- **Shape:**
  ```
  TITLE: [first person, past tense: the thing Muxin got wrong or did]
  [Beat 1: the admission, addressed to the people it concerns, before any content]
  [Beat 2: the wrong belief, phrased the way those people actually hear it]
  [Beat 3: the correction. One sentence. Blunt]
  [Beat 4: the evidence. Observable and mundane. A list is allowed here and only here]
  [Beat 5: the turn, what actually helps]
  [Stop]
  ```
  Beat 4 must be observation, not feeling. The reason the r/ADHD winner works as ammunition is that
  every item on its list is something a sceptic would accept as visible fact.
- **Real example:** the r/ADHD top-of-year post written by someone without ADHD who lives with two
  people who have it. Citation only, do not reuse the wording, and specifically do not reuse its
  list of observed behaviours in its order.

#### 4. The Refused Framing

- **Platform:** reddit
- **Mechanism:** the post names the obvious reading of a thing, rejects it in one line, and then
  argues for a different one. The rejection is what earns the attention, because the reader has
  already had the obvious thought. Seen in 3 posts across 3 posters in 3 different subreddits, at
  3065x, 26x and 943x their community medians.
- **Structure / arc:**
  1. The subject, one line, stated neutrally.
  2. The obvious framing named and refused in one clause.
  3. The alternative framing, stated as a claim rather than a question.
  4. The mechanics that support it, concrete and checkable.
  5. The concession: the strongest argument for the other side, granted honestly.
  6. The concession withdrawn, narrowly. Not that the other side is wrong, but that the thing
     should stop being treated as routine.
  7. A second supporting thread, usually about money or incentives.
  8. The sharpest version of the claim, labelled as an opinion.
- **Emotional trigger:** the relief of having a shapeless unease turned into a sentence, plus a
  named thing to be against.
- **Immediate personal payoff:** language for an argument the reader was already half having, about
  something they are paying for or living inside right now.
- **CTA style:** none. All three end on an opinion, which is itself the invitation. **CIVIC GATE:**
  this is the shape most likely to be reached for on civic material and it is the one that fails
  the rubric fastest, because a reframe with no action attached is exactly what
  `references/civic-adaptation.md` was written against. Keep beats 1 to 8 and add a real,
  verified, finishable-in-10-minutes close, local and specific where possible. If no verified
  action exists, use the general civic default rather than inventing a form or a deadline.
- **Length and formatting:** 1,400 to 1,700 characters. Ten or more short paragraphs, several of
  them one line, set alone for emphasis. No bullet lists. No emoji, no links, no hashtags.
- **Shape:**
  ```
  [Beat 1: the subject, neutrally, one line]
  [Beat 2: name the obvious reading and reject it, in one clause]
  [Beat 3: the alternative reading, as a claim]
  [Beat 4: the mechanics that support it, checkable]
  [Beat 5: the concession. The best argument against Muxin, granted]
  [Beat 6: the narrow withdrawal. Not that they are wrong, but what she still refuses to accept]
  [Beat 7: a second thread, usually the money or the incentive]
  [Beat 8: the sharpest version, labelled an opinion]
  ```
  Beat 5 is not optional and cannot be a strawman. In all three winners it is the beat that
  survives the top comment, and skipping it is what turns this shape into a rant.
- **Real example:** the r/ClaudeAI post that refuses to read a model launch as a product story and
  reads it as a tiering story instead, granting the safety rationale before rejecting the framing.
  Citation only, do not reuse the wording.

#### 5. The Procedure You Can Finish Tonight

- **Platform:** reddit
- **Mechanism:** a named anxiety, then a procedure short and concrete enough that not doing it
  becomes a choice. Seen in 3 posts across 3 posters in 2 subreddits, at 45x, 19x and 16x their
  community medians.
- **Structure / arc:**
  1. Solidarity, two or three words. The reader's situation named, not their failure.
  2. The comparison that stings: what the better-resourced version of them has.
  3. The fear named out loud, in the reader's own vocabulary.
  4. The refusal: it is not that hard.
  5. The time and place. Name the moment in the reader's evening when they could actually start.
  6. The procedure. Concrete down to the folder name, the price, the angle, or the exact email.
  7. The step that is most often skipped, flagged as the one people get wrong.
  8. The release: that is all, now use what you already know how to do.
- **Emotional trigger:** anxiety about being behind, addressed directly and then dissolved by
  something finishable in one evening.
- **Immediate personal payoff:** the strongest of any Reddit shape here, and it is the payoff
  `references/civic-adaptation.md` names as the thing that makes a piece work: a task the reader
  can complete today, with the cost stated honestly.
- **CTA style:** the procedure is the CTA. Two of the three carry a link and name a real price
  openly, which is what kept them from reading as a sales post. **CIVIC GATE:** this shape already
  clears the bar in its non-civic form. On civic material the procedure must point at something
  verified, and the honesty about cost carries over. Never invent a form, link, deadline, race or
  measure.
- **Length and formatting:** 1,000 to 1,800 characters. The one with a numbered procedure uses
  bullets and a full sample prompt written out; the other two run the procedure in prose despite
  being step-by-step, which suggests the list is optional. At most one outbound link, placed inside
  the procedure rather than at the end. No emoji, no hashtags.
- **Shape:**
  ```
  [Beat 1: solidarity, two or three words]
  [Beat 2: what the better-resourced version of the reader has that they do not]
  [Beat 3: the fear, in their words]
  [Beat 4: the refusal. Say plainly that the feared thing is not difficult]
  [Beat 5: when and where. Tonight, after X]
  [Beat 6: the steps. Concrete to the folder name, the price, the angle, the exact wording]
  [Beat 7: the step most people skip, flagged as the one they get wrong]
  [Beat 8: the release. Now use what you already have]
  ```
  Beat 6 is the test. If a step cannot be written concretely enough that failing it would be
  obvious, the shape has nothing to stand on.
- **Real example:** the r/ProductManagement post that walks a reader from zero to a running agentic
  coding tool in five steps, naming the subscription price out loud. Citation only, do not reuse
  the wording.

#### 6. The Question Only the Room Can Answer

- **Platform:** reddit
- **Mechanism:** the post exists to be replied to, not read. It asks something the poster genuinely
  cannot resolve alone, and the comment count rather than the upvote count is what carries it. Seen
  in 5 posts across 5 posters in 2 subreddits, at 2219x, 1583x and 1859x (r/ADHD) and 33x and 26x
  (r/ProductManagement).
- **Structure / arc:**
  1. The question, in the title, aimed at the group rather than at the world.
  2. Body beat 1: the poster's own legwork. What they already checked, so the question is not lazy.
  3. Body beat 2: their own answer, offered first as the seed data point.
  4. Body beat 3: a sharpening. Is this the thing itself, or an ordinary thing turned up.
  5. Body beat 4: one or two unanswerable extensions. These are the engine, because they give
     people with nothing to report something to argue about.
  6. Body beat 5: the ask, restated in one line, alone.
- **Emotional trigger:** curiosity about oneself. The reader cannot find out whether their
  experience is normal without either reading the replies or adding to them.
- **Immediate personal payoff:** none in the post, by design. The payoff lives in the comments, and
  the poster is trading their own payoff for the room's participation. Worth knowing before
  reaching for this shape, because it is the one Reddit pattern here that does not feed Muxin's
  civic rubric on its own.
- **CTA style:** the ask itself, sometimes one word. **CIVIC GATE:** an open question is not a
  micro-action. On civic material this shape needs a verified, finishable close added underneath
  the question, or it fails `references/civic-adaptation.md`. The two accepted forms are unchanged.
- **Length and formatting:** 600 to 1,100 characters. Casual register, lowercase and typos left in
  on two of the five, which does not appear to have cost anything. No lists, no links, no emoji.
  The ask is the last line and stands alone.
- **Shape:**
  ```
  TITLE: [the question, aimed at this specific group]
  [Beat 1: what Muxin already checked, so it does not read as lazy]
  [Beat 2: her own answer, as the first data point]
  [Beat 3: the sharpening. Is this the thing, or an ordinary thing turned up]
  [Beat 4: one or two unanswerable extensions]
  [Beat 5: the ask, one line, alone]
  ```
  Beat 4 is what separates a post with 65 comments from one with 1,221. Beat 1 is what separates it
  from a question the room ignores.
- **Real example:** the r/ADHD post asking how many people have constant music playing in their
  head, which draws 1,221 comments off roughly 750 characters. Citation only, do not reuse the
  wording.

#### 7. The Insider Parody `(thin evidence, single sighting)`

- **Platform:** reddit
- **Mechanism:** the community's most repetitive complaint genre, played back with the roles
  swapped. Every beat rewards knowledge only that community has. Seen in 1 post by 1 poster, at
  3120x r/ClaudeAI's true median, and it is the FIRST text post in that subreddit's top-of-year
  listing, at position 20 behind nineteen screenshots.
- **Structure / arc:**
  1. The swap established in one line, using the community's own veteran-poster formula.
  2. A baseline: it used to be fine, with two or three specific competences named.
  3. A list, six items, each mapping a piece of the community's jargon onto an ordinary human
     behaviour.
  4. Each item lands on a domestic detail concrete enough to make the mapping click.
  5. The worst category held back for last, given the most human example.
- **Emotional trigger:** recognition escalating into delight, with the list format promising another
  hit every few lines.
- **Immediate personal payoff:** none material. Being seen by a joke that requires exactly the
  knowledge the reader has.
- **CTA style:** none, and adding one would break it. **CIVIC GATE:** not applicable to the mined
  post, which is not civic. If ever adapted to civic material, the rubric applies unchanged and this
  shape offers no natural place to put a micro-action, which is a reason to pick a different one.
- **Length and formatting:** about 1,800 characters. A six item bulleted list with a short paragraph
  above and below. Each bullet opens on the jargon term and then translates it. No emoji, no links.
- **Shape:**
  ```
  [Beat 1: the swap, in the community's own opening formula]
  [Beat 2: the baseline. It used to be fine, and here is what fine looked like]
  [Beat 3: six items. Each one: the jargon term, then the human behaviour it maps to]
  [Beat 4: each item ends on a concrete domestic detail]
  [Beat 5: the last item is the emotional one, held back deliberately]
  ```
  This shape requires Muxin to be a genuine insider in the community she is parodying. It is the
  fastest of any pattern here to read as an outsider doing an impression, and this audience catches
  that immediately.
- **Real example:** the r/ClaudeAI post written from the model's point of view about its human
  being quietly nerfed. Citation only, do not reuse the wording or the mapped list.

#### What r/SideProject and r/ClaudeAI prove that no pattern above can

Two of the six subreddits are won by things this file cannot write a text pattern for, and saying so
plainly is more useful than a seventh skeleton.

- **r/SideProject: positions 1 and 2 of the year are video demos, and the first text post appears at
  position 68.** Both video titles are under 90 characters and neither has a body. On that
  subreddit, writing a good description is a structural disadvantage rather than a style choice. The
  two text posts that did break in (at 68 and 75) both refuse the launch-post conventions entirely:
  no metrics, no stack, no link, no ask.
- **r/ClaudeAI: positions 1 through 19 are screenshots.** The best text post in the community's year
  sits at position 20. The screenshots were never collected, so nothing can be said about what makes
  a good one, and nothing here should be read as saying text competes with them.

Both are collection gaps with a clear fix, and both are worth more to Muxin than another skeleton:
if she wants reach in either community, the medium is the decision and the writing comes second.

### hackernews

**Provenance:** mined by `/patterns synthesize` on 2026-08-23 from 9 Hacker News analyses in a
292-entry corpus, 9 different submitters, niches `ai-building`, `adhd`, `civic-tech` and
`solopreneur`.

**These are big numbers by any reading.** The 4 text submissions behind the templates below run
273 to 3,295 engagements, and their point counts are 124, 1,086, 1,318 and 2,935. The 5 link
submissions are admitted as TITLE evidence only, because Hacker News displays nothing but the title
for a link post.

**The baseline is also the best in the whole corpus, so it is quoted as context throughout.** Every story submitted to HN in one full
24-hour window about 30 days before collection was pulled, 1,000 of the 1,012 in that window, which
is the API's page cap. That population has a **true median of 3 points, a 90th percentile of 22,
and a maximum of 1,778**. Nothing was selected for looking good. So an HN multiple here is measured
against the entire platform rather than against one account, which no other section can say.

Read the scale before reading any number: the smallest collected submission, at 124 points, is
**41x** the median and still above the 90th percentile of the whole window. The largest, at 3,346
points, is **1,115x** the median and nearly double the maximum of that entire 1,000-story day.

**Title and body are separate fields here, and the title is the whole channel.** HN displays nothing
but the title for a link submission, so five of these nine posts have no body at all. As with
Reddit, the title shapes are written here rather than appended to `references/hook-patterns.md`,
because an HN title has to survive alone in a ranked list with no body visible. See the reddit
section for the full reasoning; it is the same argument and it is not repeated.

**One finding this platform gives Muxin that nothing else does.** The two civic submissions here are
the two highest-performing civic items anywhere in the corpus relative to their baseline, at 205x
and 114x, and **neither is an argument.** One is a petition. One is a tool. On this platform a civic
opinion has no visible constituency and a civic ARTIFACT does. That converges exactly with the
strongest civic post on Mastodon, which is a queryable research map rather than a claim, and it is
the clearest cross-platform signal in this pass for what her civic work should ship.

#### 1. The Prefix, the Number, and the Refusal to Sell

- **Platform:** hackernews
- **Mechanism:** the title states an outcome with the arithmetic already done, and the body then
  refuses to be a product pitch, opening on a person instead. Seen in 1 post by 1 submitter at 978x
  the site median, 2,935 points, the highest-scoring text submission collected. `(thin evidence,
  single sighting)`
- **Structure / arc:**
  1. Title: the community's own prefix, then the outcome with both numbers in it. The reader does
     the division themselves.
  2. Body beat 1: an improbable identity claim in one sentence, with a wry aside.
  3. Beat 2: the origin, concrete and unglamorous, with the motive stated as a local need.
  4. Beat 3: a coined phrase that reframes the motive, built off a term the reader already knows.
  5. Beat 4: the honest state of the thing, including a parenthetical admitting it still does not
     fully work.
  6. Beat 5: the narrowing to the one subsystem this post is about, and why it is interesting.
  7. Beat 6: what the expensive version actually does, in technical detail, unexplained.
- **Emotional trigger:** two gaps at once. The title's price gap asks how, the first line's identity
  gap asks who is this person, and answering the second buys patience for the first.
- **Immediate personal payoff:** none material. A build report and a price comparison that resets
  what the reader thinks infrastructure should cost.
- **CTA style:** none. **CIVIC GATE:** if this shape carries civic material it still needs a
  verified, finishable close per `references/civic-adaptation.md`. Note that on this platform the
  civic submissions that travelled ARE the completable thing, so the natural civic version of this
  pattern is shipping the artifact rather than writing about it.
- **Length and formatting:** title 60 to 70 characters with two numbers. Body about 1,000 characters
  in the collected portion, five to seven short paragraphs, no lists, no emoji, no hashtags,
  technical terms used without explanation.
- **Shape:**
  ```
  TITLE: [Show HN: ] [what was replaced] with [what replaced it]. Both numbers, no adjectives
  [Beat 1: an improbable one-sentence identity claim, with a wry aside]
  [Beat 2: the origin. Concrete, unglamorous, with the real motive]
  [Beat 3: a coined phrase built off a term the reader already knows]
  [Beat 4: what is still broken, in a parenthetical]
  [Beat 5: the one subsystem this is about, and why it is interesting]
  [Beat 6: the technical detail, unexplained, as a sign of respect]
  ```
  Beat 4 is not optional. This audience is faster than any other in the corpus at detecting
  marketing register, and the admission is the cheapest available proof that this is a real project.
- **Real example:** the Show HN replacing a six-figure bowling centre scoring system with a low
  four-figure pile of microcontrollers. Citation only, do not reuse the wording.

#### 2. The Question With the Unit Named

- **Platform:** hackernews
- **Mechanism:** an Ask HN that tightens its own scope in one clause and names the unit answers
  should arrive in, so replies are comparable and the low-effort ones are ruled out before they are
  typed. Seen in 2 posts across 2 submitters at 439x and 41x the site median, producing 563 and 149
  comments off bodies of about 230 and 900 characters.
- **Structure / arc:**
  1. Title: the whole question, aimed at practitioners, naming the specific things being compared.
  2. Body beat 1: the scope tightener. Fully, as the main tool, not as a side experiment.
  3. Beat 2: the request for specifics, with the unit named in a parenthesis.
  4. Optional beat 3, on the longer variant: the asker's own position first, including a hedge about
     their own status, which lowers the bar for others to answer.
  5. Optional beat 4: one or two unanswerable extensions, which give people with nothing to report
     something to argue about.
  6. The ask restated as a short list of direct questions.
- **Emotional trigger:** the fear of having missed a shift other people have already made, which
  only the replies can resolve.
- **Immediate personal payoff:** none in the post, by design. The payoff is the thread, and the
  asker is trading their own payoff for the room's.
- **CTA style:** the question. **CIVIC GATE:** an open question is not a micro-action and this shape
  cannot clear `references/civic-adaptation.md` on its own. On civic material, add one verified
  finishable action beneath the question rather than replacing it.
- **Length and formatting:** title 60 to 80 characters, always prefixed. Body 230 to 900 characters.
  The short variant is two sentences. The long variant runs four paragraphs then a bulleted question
  list. Typos and asides left in on the long one, apparently at no cost.
- **Shape:**
  ```
  TITLE: Ask HN: [the question, naming the specific things being compared]
  [Beat 1: the scope tightener. Rule out the casual case in one clause, so the low-effort
   answers are excluded before anyone types one]
  [Beat 2: what to include in an answer, with the UNIT named in a parenthesis]
  [Beat 3, optional: Muxin's own position first, hedged, so others feel entitled to answer]
  [Beat 4, optional: one unanswerable extension]
  [Beat 5: the ask, as a short list of direct questions]
  ```
  Beat 2 is the rare move and the one worth stealing. Naming the unit turns a pile of anecdotes into
  a comparable table.
- **Real example:** the Ask HN about whether anyone has fully swapped a commercial model for a local
  one as their main coding tool, which asks for setup and throughput in a named unit. Citation only,
  do not reuse the wording.

#### 3. The Dated Enthusiasm

- **Platform:** hackernews
- **Mechanism:** the writer names obsolete technologies that date them precisely, is
  self-deprecating about it, and uses the credibility that buys to be sincerely, unguardedly excited
  about something new. Seen in 1 post by 1 submitter at 362x the site median, with 988 comments
  against 1,086 points, the highest comment-to-point ratio in the set. `(thin evidence, single
  sighting)`
- **Structure / arc:**
  1. Title: a fact about the writer, then the claim, in two short sentences.
  2. Body beat 1: the counter-position. What the writer was about to do instead.
  3. Beat 2: a memory list. Three named things from decades ago, deliberately unglamorous.
  4. Beat 3: the self-deprecating aside, these are laughable now.
  5. Beat 4: what they felt like at the time, and the physical effect they had.
  6. Beat 5: the jump forward. The new thing gives the same feeling.
  7. Beat 6: a plain declarative. Three words at most.
  8. Beat 7: the closing image, physical rather than conceptual.
- **Emotional trigger:** recognition across a generation gap. Older readers get their own memory
  named, younger ones get a rare sight of what forty years of enthusiasm looks like.
- **Immediate personal payoff:** none. Permission to be excited, which on a sceptical forum is
  genuinely scarce.
- **CTA style:** none, and adding one would destroy it. **CIVIC GATE:** unchanged if adapted, and
  this shape has no natural slot for an action.
- **Length and formatting:** title two short sentences, about 55 characters. Body about 480
  characters, one paragraph, three named technologies, no lists, no links, no emoji.
- **Shape:**
  ```
  TITLE: [a fact about Muxin]. [the claim].
  [Beat 1: the counter-position. What she was about to do instead]
  [Beat 2: three named things from her own past, specific enough to date her]
  [Beat 3: the self-deprecating aside about them]
  [Beat 4: what they felt like, and the physical effect]
  [Beat 5: the jump. The new thing feels the same]
  [Beat 6: a plain declarative. Three words]
  [Beat 7: a physical closing image]
  ```
  Beat 2 must be true and must be specific. A generic reference to the old days does none of the
  work; the whole device is that the named things place the writer exactly.
- **Real example:** the Tell HN from a sixty year old about a coding tool reigniting the feeling of
  learning server-side programming decades earlier. Citation only, do not reuse the wording.

#### Title shapes, from all 9 including the 5 link submissions

Recorded separately because five of these posts have no body and their titles are still real
evidence. Counts are of the 9 collected titles.

- **The prefix is load-bearing.** 4 of 9 carry a community prefix (Show, Ask, Tell). All 3 body
  patterns above are prefixed submissions. The prefix tells the reader what kind of attention is
  being asked for before the subject arrives.
- **Numbers with no adjectives, 2 of 9.** One title is three numbers and no verb, letting the reader
  compute the interesting ratio themselves. Note that it is the LOWEST scoring of the nine, so this
  is a shape observation, not a performance claim.
- **The plain subject, 2 of 9.** The shortest title in the set is four words naming a topic, with no
  hook at all, and it ran 211x the site median. On a self-selecting audience the subject alone can
  be the hook, which is the opposite of what every other section in this file says.
- **Pointed at the community itself, 1 of 9,** and it is the biggest submission collected at 1,115x.
  Worth knowing and hard to reuse: it only works if you are inside the community you are pointing at.

### substack-notes

**Provenance:** mined by `/patterns synthesize` on 2026-08-23 from 12 Substack Notes analyses in a
292-entry corpus, across 2 accounts contributing 6 each, niches `civic-democracy` and
`general-viral`.

**Notes are not Substack posts.** Different surface, different feed, different numbers, different
craft. Do not carry anything from the `substack` section into this one. A Note is short, it lives in
a scrolling feed rather than an inbox, and its dominant metric is the restack, which is a reader
repeating your sentence as their own.

**These are the largest raw numbers in the corpus.** 8 of the 12 clear the floor and run from 195
to 46,541 engagements; the top note alone carries 39,173 likes and 6,472 restacks. 4 are
body-incomplete and are behind nothing here.

**Baselines are real here too, so they are quoted as context.** Both accounts were sampled by pulling
a chronological window of 96 of that account's own top-level Notes, restacks and replies filtered
out, and computing the true median across all 96. One account's median is 2,930 likes across five months; the other's is 116 likes
across one month. So a multiple in this section is measured against an unbiased window of the same
person's own Notes.

**Read the creator counts before the patterns.** 6 of the 8 admitted posts belong to ONE account. Every pattern below therefore says "1 creator," and that is a real limit, not a formatting
quirk. What saves them from being one person's habits is that they were measured against a
96-note window of that same person's own work, so the comparison inside the account is honest even
though the comparison across accounts does not exist.

**The single most useful thing in this section is a warning, not a shape.** The largest civic Notes
account in the corpus, whose top note drew 39,173 likes and 6,472 restacks, **fails Muxin's CTA
rubric on every close it makes.** Its asks are a demand that money be removed from politics and a
demand that a legislature reject a nominee: both addressed to institutions, neither an action the
reader can finish. Under
`references/civic-adaptation.md` those are the vague form the whole rubric was written against. The
notes travel enormously and they leave a persuaded reader with nowhere to go. Copy the structures
below. Do not copy the closes.

**One measurable thing this account does show.** Across its six notes the ranking tracks specificity
almost perfectly. The top three carry counted facts or a numbered mechanism. The bottom one carries
a principle, with no number, no name and no event in it, and it draws a quarter of the top note.

#### 1. The Numbered Loop

- **Platform:** substack-notes
- **Mechanism:** an accusation is turned into a diagram. Four numbered steps that return to their
  own start, so the structure itself argues that the thing is self-sustaining. Seen in 1 post by 1
  creator at 13.4x that account's true 96-note median, with 6,472 restacks, the most in the set.
  `(thin evidence, single sighting)`
- **Structure / arc:**
  1. One framing sentence promising a mechanism, not an opinion. This is how X works.
  2. Four numbered steps, each under ten words, each an action by a named kind of actor.
  3. The fourth step is the word repeat, which closes the loop.
  4. One line stating what must change.
  5. One line stating why it is the root rather than a symptom.
- **Emotional trigger:** compression. A diffuse grievance collapses onto one screen, and nothing is
  withheld. There is no curiosity gap at all, which is worth noticing: this shape does not need one.
- **Immediate personal payoff:** none, and the record is honest that this is the shape's weakness.
  The reader gets a frame and nothing to do with it.
- **CTA style:** a demand rather than an action, and it is the **vague** form. **CIVIC GATE: this
  close FAILS `references/civic-adaptation.md` as mined and must be replaced.** Keep the loop, then
  put one specific verified thing the reader can finish in under 5 to 10 minutes underneath it,
  local where possible, or neutral record-based value matching. The loop is what earns the restack;
  the action is what makes it worth having earned.
- **Length and formatting:** about 300 characters. Four numbered items with blank lines between
  them, two one-line paragraphs, no emoji, no hashtags, no link.
- **Shape:**
  ```
  [Beat 1: promise a mechanism rather than an opinion. One sentence saying that this is how
   [the thing] operates]
  1) [actor] does [action]
  2) [second actor] does [consequence]
  3) [first actor] gets [payoff]
  4) Repeat
  [Beat 2: what has to change. One line]
  [Beat 3: one verified thing the reader can finish in ten minutes]  <- REQUIRED for civic, replaces the mined close
  ```
  Every step must be something that actually happens, in order. A loop with an invented step is a
  factual claim about real people and `venture/rules.md` item 9 and CLAUDE.md rule 1 both apply.
- **Real example:** the civic Notes account's four-step note on political donations. Citation only,
  do not reuse the wording, and do not reuse its close.

#### 2. Fact, Contrasting Fact, Five Word Verdict

- **Platform:** substack-notes
- **Mechanism:** two checkable numbers are placed beside each other and the argument happens in the
  gap between them. The verdict just names what the reader already concluded. Seen in 2 posts across
  1 creator at 8.7x and 5.1x that account's true median, with 6,016 and 3,355 restacks.
- **Structure / arc:**
  1. Fact one: a promise made, with the incentive or the claim quantified and the place named.
  2. Fact two: what actually happened, quantified, placed against fact one with no connective
     argument.
  3. The verdict: five words or fewer, naming the theory the two facts refute.
  4. In the stronger variant, fact one is a statistic that INCLUDES the other side's own supporters,
     which closes the partisan escape route before it opens.
- **Emotional trigger:** anger arrived at by arithmetic. The reader does the subtraction and owns
  the conclusion.
- **Immediate personal payoff:** none immediate. It hands over an argument with receipts, which is
  social currency rather than an action.
- **CTA style:** none in either. **CIVIC GATE:** no close means no rubric violation and no rubric
  compliance either. This is the shape Muxin can most safely use, because it needs only real numbers
  and one short judgment, and it leaves the close free for a verified micro-action.
- **Length and formatting:** 340 to 360 characters. Three short blocks, one per beat. No lists, no
  links, no emoji, no hashtags. Every number specific and sourced in the writing itself.
- **Shape:**
  ```
  [Beat 1: the promise or the claim, with its number and its place]
  [Beat 2: what happened, with its number. No connective. Just put it there]
  [Beat 3: the verdict. Five words. Name the theory the two facts kill]
  [Beat 4, optional and stronger: make beat 1 a statistic that includes the other side's own people]
  ```
  Both numbers must be real and checkable. This is the pattern in the file with the least room for
  invention and the most dependence on Muxin actually having done the reading.
- **Real example:** the note pairing a company's tax incentives against its job cuts in the same
  period, and its sibling leading on a cross-party polling number. Citation only, do not reuse the
  wording.

#### 3. Do It First, Then Ask

- **Platform:** substack-notes
- **Mechanism:** the writer reports a small action they personally took, dated and counted, before
  recommending it, and immediately qualifies the recommendation for people who cannot afford it.
  Seen in 1 post by 1 creator at 4.9x that account's true median, the best body-complete note on
  that account. `(thin evidence, single sighting)`
- **Structure / arc:**
  1. The action, first person, dated to yesterday, with a count.
  2. The recommendation, followed immediately by the affordability qualification in the same
     sentence.
  3. The stakes widened: why the thing being supported matters and why it is fragile.
  4. The position, stated as a we rather than a you.
  5. The mechanism, what this place is actually for.
  6. The consequence if it fails.
- **Emotional trigger:** solidarity with a cost already paid. The writer spent first, which is what
  licenses the ask.
- **Immediate personal payoff:** real and small. A thing the reader can do in two minutes for
  someone whose work they value.
- **CTA style:** a genuine micro-action, and the best-formed close in this section. It names no
  specific beneficiary, which keeps it from reading as self-promotion. **CIVIC GATE: this one
  passes** as written, and it is the model the two patterns above should borrow their closes from.
- **Length and formatting:** about 600 characters, three paragraphs, no lists, no links, no emoji.
- **Shape:**
  ```
  [Beat 1: what Muxin did. First person, dated, counted]
  [Beat 2: the recommendation, with the affordability qualification in the SAME sentence]
  [Beat 3: why the thing matters, and why it is fragile]
  [Beat 4: the position, as "we"]
  [Beat 5: what happens if it fails]
  ```
  Beat 1 must be true and must have already happened. Recommending an action you have not taken
  inverts this shape into the thing it is designed to avoid.
- **Real example:** the note reporting two paid subscriptions taken out the previous day before
  recommending that readers support independent writers. Citation only, do not reuse the wording.

#### 4. The Reminder Frame `(thin evidence, single sighting, and read the caveat)`

- **Platform:** substack-notes
- **Mechanism:** a contested claim is presented as something everybody already knows and merely
  needs reminding of, which skips the argument entirely. Seen in 2 posts across 1 creator at 10.3x
  and 6.2x that account's true median, with 4,917 and 3,437 restacks.
- **Structure / arc:**
  1. The frame: present the claim as something the reader is merely being reminded of.
  2. The claim, stated as settled history or as a list of settled charges.
  3. In the list variant, three bulleted items, each one line, each a specific action.
  4. The verdict, one line.
- **Emotional trigger:** the comfort of already agreeing, and the small social permission of being
  told this is common knowledge.
- **Immediate personal payoff:** none.
- **CTA style:** the list variant closes on an institutional demand, which is the vague form.
  **CIVIC GATE: fails as mined.** Replace the close.
- **Length and formatting:** 200 to 380 characters. The list variant uses three hyphen bullets. No
  links, no emoji.
- **Shape:**
  ```
  [Beat 1: a reminder frame. Present the claim as something already known, then the subject]
  [Beat 2: the claim as settled fact, or three bulleted specific charges]
  [Beat 3: the verdict, one line]
  [Beat 4: one verified finishable action]  <- REQUIRED for civic
  ```
  **The caveat, and it is the reason this record is marked rather than recommended.** This shape
  works precisely BY not arguing. That is fine when the claim is genuinely settled and documented,
  and it is a way to smuggle a contested claim past scrutiny when it is not. Under CLAUDE.md rule 1
  and `references/civic-adaptation.md`, Muxin uses this only for things she can show are true, and
  she does not use it to make an argument she has not made.
- **Real example:** the two reminder-framed notes on that civic account, one historical and one a
  bulleted charge sheet about a named official. Citation only, do not reuse the wording.

#### Why 4 patterns and not 5 to 7

Twelve notes, two accounts, and six that cleared the bar, five of them from one person. The other
account's biggest note by far is six words of caption attached to an image nobody collected, so its
top result is unusable. Four patterns is what the evidence carries. The fifth thing worth knowing is
not a shape and is recorded above: on the honestly sampled account, ranking tracks specificity, and
the note with no number, name or event in it finished last.

### devto

**Mined 2026-08-23 and too thin to carry patterns, for two reasons, neither of which is popularity.**
4 dev.to analyses from 1 author. **All four clear this file's 150-engagement floor**, at 289 to 457
reactions-plus-comments, so popularity is not what disqualifies them. One author is not a platform,
and the distribution is so compressed there is nothing to learn a shape from.

The sampling is the best in the corpus and the result is still unusable. The author's COMPLETE
published window was pulled from dev.to's own public API, 59 articles over a year, and its true
median is 122 reactions. Her single best article of that entire year draws 265, which is **2.2x**.
The distribution here is compressed: dev.to has winners and it does not really have outliers, so
there is no gap between a great post and an ordinary one large enough to learn a shape from.

One author is also not a platform. Recorded rather than dropped, because two observations are worth
carrying:

- **The candid topic-selection preamble.** Both of her two best articles open by explaining why the
  piece exists and what it deliberately is not, before any technical claim. One names the two kinds
  of article she rejected and why. On a platform of interchangeable tutorials, that preamble is the
  differentiator.
- **Reactions and comments are different currencies, and the shape chooses which.** Her article
  admitting her own uncertainty about a shift in her field draws her LOWEST
  reactions and by far her HIGHEST comments, 257 against her next best of 133. Admitting uncertainty
  converts readers into repliers rather than likers. Pick the shape for the response you want.

**To make this platform minable**, collect several authors rather than one. The per-article ceiling
being 2.2x means dev.to is more useful as a place to be consistently read than as a place to break
out, which is itself worth knowing before Muxin spends time there.
