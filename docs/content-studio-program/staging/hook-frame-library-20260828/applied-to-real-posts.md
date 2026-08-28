# Applying the frames to Muxin's own posts

The worked examples fill frames with placeholder material, which shows mechanics and proves nothing.
This applies frames to posts Muxin actually wrote and puts the openings side by side.

Two things have to be stated before the comparison, because an earlier version of this document got
both wrong.

**The frame was chosen by hand, not by the system.** There is no "read this draft, find the frame
that fits it" step. `list` ranks frames by platform and evidence; it has never seen the draft. That
selection step is the missing piece of what was asked for, and it is not built.

**"Better" and "worse" were asserted, not measured.** The first version of this document declared
winners on taste. Replaced below with the measurements the corpus can actually support, and with an
explicit "undecidable" where it cannot.

Every slot is filled from wording already in her own post. Nothing was invented.

Only three of the ten frames list LinkedIn, so LinkedIn posts are what could be tested.

---

## Does the corpus show that shorter openings do better?

The obvious hypothesis, and the one that would decide these comparisons. Tested directly.

Hook length was compared against top-quartile status **within each creator file**, the same
within-creator design the ranking uses, so capture conventions and audience size cannot drive it.
51 files had enough entries on both sides to test:

| | files |
|---|---|
| top-quartile hooks shorter than that creator's rest | 21 |
| top-quartile hooks longer than that creator's rest | 23 |
| identical medians | 7 |

**Median of the per-file differences: 0.0 words.**

**So no. Short openings do not outperform long ones in this corpus.** Per platform the pooled
medians say the same thing: LinkedIn 14w top-quartile against 16w for the rest, Bluesky 14w against
12w the other way, YouTube 56w against 56w. There is no length effect to find here.

That answers the question directly: brevity is not a pattern this corpus detected, so it is not a
pattern the library can claim.

## But there is a platform norm, and her openings sit outside it

| | words |
|---|---|
| LinkedIn hook, corpus median | 16 |
| 75th percentile | 22 |
| 90th percentile | 30 |
| Muxin post 1 opening | **30**, longer than 90% of LinkedIn hooks |
| Muxin post 2 opening | **34**, longer than 94% of LinkedIn hooks |

Both openings are near the far end of the LinkedIn distribution. That is a real, measured fact about
convention. It is **not** evidence they perform worse, because the test above found length does not
separate hits from misses within a creator. Shortening is a conformity argument, not a performance
one, and it should be labelled as such rather than smuggled in as "better".

---

## Post 1: "Human Inference: defining a brand in an AI-drenched world"

`content/2026-07-10-human-inference-defining-a-brand-in-an-ai-drench/derivatives/linkedin-1.md`

**Hers (30 words):**

> I've been writing on LinkedIn since 2024. Looking back, I can't tell heads from tails what it was
> actually about. Like most people, I posted because everyone says you should.

**Frame `ive-been-for-timespan` (9 words):**

> I have been writing on LinkedIn for two years now.

**Where this lands.** Her first sentence is already this frame; the frame is a strict subset of what
she wrote unaided. The real difference is the two sentences after it, which take the opening from 9
words to 30 and carry the self-deprecating turn ("I can't tell heads from tails").

**Undecidable on this data.** The frame version matches the platform's central tendency. Hers sits at
the 90th percentile for length. The corpus offers no evidence that either wins, so this is a judgment
call and it is hers to make. What can be said: this is the one case where a frame's shape and a real
draft genuinely coincided.

## Post 2: "Building an innovation nation"

`content/2026-06-16-building-an-innovation-nation/derivatives/linkedin-1.md`

**Hers (34 words):**

> I mostly focus on product innovation. That is my expertise as a product manager, and I've spent
> hundreds of hours listening to founders describe what it actually takes to build a successful tech
> company.

**Frame `if-youve-ever-read-this`,** slot filled from her own later line about customers being treated
as a checkbox:

> If you have ever watched talking to customers get treated like a checkbox instead of the art and
> practice that it really is, read this.

**Where this lands.** The framed version is 27 words, so it does not even buy brevity. It drops the
specific credential and the "hundreds of hours". Whether trading a credential opening for a
shared-grievance opening helps is not something the corpus can answer, since it has no comparison of
the same argument opened two ways.

**Frame `used-to-think-now`:** not applicable. Filling it would require stating a belief she used to
hold, which this post does not contain. Inventing one would compose a claim in her voice, which rule
1 forbids.

---

## What this test actually established

1. **Length is not the pattern.** Measured within creators across 51 files, top-quartile openings are
   no shorter than the rest. Any advice to shorten is convention, not evidence.
2. **Her openings are unusually long for LinkedIn.** 90th and 94th percentile. True, measured, and
   separate from point 1.
3. **The library cannot pick a frame for a draft.** Both frames here were chosen by a human reading
   the post. Ranking by evidence does not answer "which shape suits this piece", and shipping it as
   though it did would hand back frames that fight the draft.
4. **The corpus cannot referee an A/B.** Nobody wrote the same post twice with two openings. Every
   "better" claim about a specific rewrite is a human judgment and should be presented as one.

## The gap this exposes

What was asked for is a system that reads a draft and proposes the frame that fits it. What exists is
a bank of ten evidence-backed shapes with no fit step. Closing that gap means matching a draft's
content (does it contain a reversed belief? a credential? a timespan? a purchase?) against each
frame's slots, and returning only frames whose slots the draft can actually fill from its own
material. That is buildable and deterministic, and it is not built yet.
