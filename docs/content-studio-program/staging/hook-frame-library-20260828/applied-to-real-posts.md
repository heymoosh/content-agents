# Applying the frames to Muxin's own posts

The worked examples fill frames with placeholder material, which shows the mechanics and proves
nothing. This is the real test: take posts Muxin actually wrote, apply the frames to their openings,
and put the two side by side. Body copy is untouched; frames only govern the first line.

Every slot below is filled from wording already in her own post. Nothing was invented.

Only three of the ten frames list LinkedIn, so LinkedIn posts are what could be tested.

---

## Post 1: "Human Inference: defining a brand in an AI-drenched world"

`content/2026-07-10-human-inference-defining-a-brand-in-an-ai-drench/derivatives/linkedin-1.md`

**Her opening:**

> I've been writing on LinkedIn since 2024. Looking back, I can't tell heads from tails what it was
> actually about. Like most people, I posted because everyone says you should.

**Frame `ive-been-for-timespan` applied:**

> I have been writing on LinkedIn for two years now.

**Verdict: the frame adds nothing, because she already wrote it.** Her opening is that frame, with a
better second and third sentence attached. The frame is a strict subset of what she did unaided, and
it drops "I can't tell heads from tails what it was actually about", which is the line doing the
work.

---

## Post 2: "Building an innovation nation"

`content/2026-06-16-building-an-innovation-nation/derivatives/linkedin-1.md`

**Her opening:**

> I mostly focus on product innovation. That is my expertise as a product manager, and I've spent
> hundreds of hours listening to founders describe what it actually takes to build a successful tech
> company.

**Frame `if-youve-ever-read-this` applied,** with the slot filled from her own line further down the
post ("talking to customers gets treated like a checkbox instead of the art and practice that it
really is"):

> If you have ever watched talking to customers get treated like a checkbox instead of the art and
> practice that it really is, read this.

**Verdict: the frame is worse.** Her original earns attention with a specific credential and a
specific number of hours. The framed version trades that for a generic listicle opening and buries
her authority. "read this" is also the weakest possible ask.

**Frame `used-to-think-now`:** not applicable. Filling it would require stating a belief she used to
hold, and this post does not contain one. Inventing it would be composing a claim in her voice, which
rule 1 forbids.

---

## What this test actually shows

1. **Her openings are already at or above frame level.** In the one case where a frame cleanly fit,
   it fit because she had independently written that exact shape. That is a real result: it says the
   frames describe competent practice, and she is already writing competently.

2. **A frame applied to a post that did not want it makes the post worse.** The `if-youve-ever`
   opener is a valid corpus shape, and it is the wrong shape for a credential-led argument post. The
   library ranks frames by evidence, not by fit to a specific draft, so it will happily hand back a
   frame that damages the piece.

3. **The LinkedIn bank is three frames deep.** That is not enough coverage to expect a good match for
   an arbitrary post.

## What this test cannot show

Whether a reframed opening would perform better. There is no A/B here and there never will be from
this corpus. The only honest read is a human one: put the two openings next to each other and decide
which sounds more like something worth reading.

On these two, the originals win.

## What that implies for the library

The value is not "rewrite Muxin's openings". It is a prompt for the blank page: when there is no
draft yet, or when a draft opens flat, the bank offers ten shapes other people demonstrably use, with
the counts attached. Reaching for one should be her choice, made against a draft, not something
applied because the ranking put it on top.
