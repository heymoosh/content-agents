# `/patterns remix`: the one place exact reuse is intended

Read this before running `/patterns remix`. It is the only mechanism in this repo that copies
another creator's words verbatim, and the scope of that is narrow enough to state in one sentence:
the opener and the on-screen title, nothing else.

## The opener half always works. The title half depends on what was collected.

Sabrina's rule names two things to copy exactly: the opener and the on-screen title.

**The opener is always there.** It comes out of the post body, which is the thing the corpus has
always stored.

**The on-screen title is there only when a collector recorded it.** A corpus entry can carry a
`visual` block (added 2026-08-22, validated in `collect.ts`), and its `onscreen_text` field holds
the words rendered on the image, frame, or slide, verbatim. That field is what fills
`onscreen_title`. Entries collected before it existed do not have it, so the bank is **sparse on
titles, not incapable of them**. Null means unknown, never absent and never "probably something
like this". Where it is null, use the manual step below and never write a title the system did not
capture.

**The same `visual` block is what keeps a bad remix source out.** Its `body_is_complete` flag says
whether the body is the whole post. Three of the corpus's highest-engaging posts earned their
numbers outside the text that was collected: a 22-character LinkedIn caption over an image, two
Instagram carousels whose likes came from slide images nobody retrieved, and an X thread opener
whose substance sits in reply posts. The corpus is best at posts whose value is entirely in their
words, which biases it against exactly the kind of post that is winning. Where a collector recorded
`body_is_complete: false`, the bank says so as a fact rather than a guess, and the refuse
conditions below stop the pick.

On text platforms, Substack, LinkedIn, Bluesky, and X, none of this bites. The opener IS the body's
first lines, there is no on-screen title to miss, and those are the platforms the corpus is
strongest on. Build confidently there, and be careful on video and image posts.

## This reverses an earlier rule, on purpose, for exactly two elements

On **2026-08-18** Muxin set the guardrail that governs every other part of this skill, written down
in `.claude/skills/atomize/references/hook-patterns.md`: what gets mined is proven sentence SHAPES,
never the wording. That file's words are "never reuse a real example's exact wording, and never
paraphrase it closely enough that it's recognizable as theirs."

On **2026-08-22** Muxin handed over Sabrina Ramonov's playbook, "How I'd Start a 1-Person Business
with AI in 30 Days", and said to do it. Sabrina's rule is the opposite one. Copy the on-screen
title and the opener exactly, because they are already proven, then remix everything after that
with your own twist, your words, your examples, your take.

**So `/patterns remix` is a deliberate reversal of the 2026-08-18 rule, and the reversal is scoped
to two elements:**

1. **the on-screen title**, the big text on the video
2. **the opener**, the first thing said on a video, or the first two lines on a text platform like
   LinkedIn or Substack

Nothing else moves.

- Everything after the opener is still governed by the 2026-08-18 shapes-not-lines rule, by
  `.claude/skills/atomize/references/civic-adaptation.md`, and by `config/voice.yaml`.
- `hook-patterns.md` and `post-patterns.md` remain **shapes-only libraries**. This mode does not
  change how they work, does not write to them, and does not put anyone's verbatim wording into
  them. It is a separate, narrower mechanism that lives beside them.
- Verbatim openers live in `data/patterns/openers.jsonl`, which is gitignored under
  `data/patterns/**` like the corpus. Another creator's exact text still never reaches git.

## Two honest cautions

- **Sabrina grants blanket permission to remix her content. Other creators have not.** The bank
  records that per opener as `verbatim_ok`, false by default, and shows it at pick time so the call
  is Muxin's with the fact in front of her. The code does not block a `verbatim_ok: false` pick,
  because that is her judgment to make, not the system's.
- **A copied opener over Muxin's own material is a different thing from a copied opener over a
  copied body.** The first is what this playbook actually describes. The second is just reposting
  someone else's work with a new byline. The remix only works if everything after the opener is
  genuinely hers.

## The opener bank

Openers are stored on their own, separate from the shape libraries, because they are stored word
for word.

| Thing | Path | In git? |
|---|---|---|
| The opener bank | `data/patterns/openers.jsonl` | no |
| The code that builds it | `src/patterns/openers.ts` | yes |

Build or refresh it from the corpus:

```
npm run patterns:openers -- [--platform x] [--verbatim-ok @handle,@handle]
```

It prints the bank ranked, strongest first.

**The bank is derived, so never hand-edit it.** A newly recorded on-screen title, a corrected
`body_is_complete`, or a new grant in `config/pattern-mining.yaml` reaches the bank by fixing the
CORPUS entry and rebuilding: delete `data/patterns/openers.jsonl` and run the command again. The
builder only ever appends openers it has not seen, so without the delete an already-banked opener
keeps its old facts.

What the builder does and does not do:

- One opener per corpus entry whose opening can be known. Text posts give the first two lines,
  videos give the first spoken sentences.
- **It skips rather than guesses.** No opener is produced when the entry is recorded as
  `transcript_source: "caption"` (the creator's written caption, not the words they said), when the
  opening carries a truncation marker, or when the whole body ends on a colon. That last one is the
  thread-opener tell: the post promises what comes next and the substance sits in reply posts the
  corpus never collected. A colon in the middle of a post is ordinary writing and is left alone.
- **What it cannot decide, it flags instead of guessing.** Each opener carries typed `warnings`,
  and the ranked listing prints them. Three of the five say the post's substance sat outside the
  collected body, and those are the ones that decide a refusal below:
  - `substance-outside-body`, the recorded one. The entry's `visual.body_is_complete` is false,
    meaning a collector looked at the post and confirmed the body is not the whole of it. Trust
    this one; it is an observation, not a prior.
  - `short-body`, a guess, used only where **no `visual` was recorded**. A body under 80
    characters is short enough to be a caption over an image, a carousel, or a video that was never
    collected, and it is also what a genuinely short post that worked on its own words looks like.
    Nothing in the corpus tells those apart, which is why this reaches Muxin as a flag rather than
    being decided for her.
  - `media-first-platform`, the same kind of guess from the platform, also used only where no
    `visual` was recorded: on Instagram, TikTok, and YouTube the slide, frame, and on-screen text
    usually carry the post.

  A recorded `visual` replaces both guesses rather than stacking on top of them, so a short post
  someone confirmed is the whole post carries no doubt at all.

  The other two are context, not disqualification: `missing-onscreen-title`, where the post has a
  visual that could carry a title and none was captured, which triggers the manual step below, and
  `truncated-body`, where the opener is intact but the post was cut off later.
- `performance.multiple` comes from the same `baselineMultiple` scoring the outlier report uses,
  and it is null when the account has fewer than three other comparably scored posts. Null means
  not measured, not weak, so unmeasured openers rank last rather than as zeroes.
- **`onscreen_title` is always null on a derived opener**, because `CorpusEntry` has nowhere to
  record the big text on a video. A real title has to be added to `openers.jsonl` by hand until
  collection captures it. Null means unknown, so say unknown rather than inventing a title.
- `verbatim_ok` comes from the `verbatim_ok:` list in `config/pattern-mining.yaml`, where each
  entry cites the public grant it rests on. Sabrina Ramonov is on it. `--verbatim-ok @handle` adds
  one ad hoc on top for a one-off run. Everyone not on that list is false, which is the honest
  default. Adding a handle there is Muxin's call and needs a real citable grant, so tell her which
  key to add rather than adding it.

## The mode

```
/patterns remix <content-folder | topic> [--platform X]
```

### Steps

1. **Show Muxin the ranked opener bank for the target platform.** Every row carries the verbatim
   opener text, its on-screen title where there is one, the creator, the measured multiple and the
   metric it was measured on, and whether `verbatim_ok` is set. She picks one. Do not pick for her,
   and do not hide the rows without permission on record.

2. **Keep that opener and that on-screen title EXACTLY. Word for word.** No tightening, no
   rephrasing for voice, no swapping a noun. This is the one place in this repo where exact reuse
   is intended, and a "light edit" here throws away the only thing being borrowed, which is the
   proof that this exact wording worked.

3. **Everything after the opener is hers.** Her list, her picks, her examples, her take. Apply the
   full-post structure from `post-patterns.md` for that platform where one has been mined, and
   `config/voice.yaml` throughout. If that platform's `post-patterns.md` section still reads "Not
   yet mined", say so in the output before the draft, the same as every other mode does, and fall
   back to `hook-patterns.md` plus the channel's `spin_angles` entry in `config/platforms.yaml`.

4. **Civic material still clears the civic-adaptation gate.** The remix rule does not relax it. The
   close is one of the two accepted forms in table 2 of `civic-adaptation.md`, a micro-action a
   reader can finish or neutral record-based value matching, and "vote", "get involved", and "stay
   informed" stay rejected. Rule 4, no invented proof, binds the close exactly as hard here as
   anywhere else.

5. **Write the output to `<content-folder>/pattern-remixes.md`** for her review, the same way
   `/patterns rewrite` writes to `pattern-rewrites.md`. Given a bare file, write
   `<file-stem>-pattern-remixes.md` next to it. **Never into `derivatives/`.** Nothing here
   publishes, queues, renders, or schedules.

6. **State the provenance in the output file itself**, not only in the chat. Every remix names the
   opener that was copied, the creator and handle it came from, its url, its measured multiple, and
   whether `verbatim_ok` was set. This is what makes the borrowing visible to Muxin at review time
   instead of quietly becoming invisible three weeks later.

### When to refuse

Say which one applies, in plain language, and stop.

- **No opener bank yet.** `data/patterns/openers.jsonl` is missing or empty. The fix is
  `/patterns collect`, then `npm run patterns:openers`. Do not fall back to
  writing an opener that sounds like a proven one. An invented opener has none of the proof this
  mode exists to borrow.
- **The chosen opener came from a `"caption"` entry or a truncated body.** The builder skips those,
  so this only comes up when a hand-written record slipped through. The real opener is unknown, and
  copying a written caption or a clipped line word for word copies the wrong thing.
- **The chosen opener's post won on something outside its body.** Any of
  `substance-outside-body`, `short-body`, or `media-first-platform`, and it is a refusal, not a
  warning to read past. Say it in her words, not in code names: "this post won on an image we did
  not collect, so copying its 22-character opener would copy the caption and miss the post."
  `substance-outside-body` is a recorded observation, so it is the strongest form of this and the
  hardest to argue with. The two guesses she can settle in a minute: she opens the original,
  confirms the opener really is the whole hook, and says so, ideally recording what she saw in that
  entry's `visual` block so nobody has to guess again. That is her call made with the facts, which
  is different from the system quietly handing her a fragment.
- **The body she wants to remix is not her own material.** A copied opener over a copied body is
  not a remix. Route her to `/patterns ideas` if there is no source yet, or ask for her own source
  file or content folder.

## What a complete remix needs, and the manual step in the middle of it

Sabrina's method assumes both halves. Where an opener has a `missing-onscreen-title` warning, the
title is a **manual step**, and the flow should say so rather than quietly dropping it:

1. The bank shows the opener with `on-screen title: unknown, read it off the original` and a
   `missing-onscreen-title` warning.
2. **Ask her for it, by name.** "This one is a video. Open the original at <url>, read the big text
   off the first frame, and paste it here exactly as it appears. If there is no on-screen text,
   say so and the remix runs on the opener alone."
3. Use whatever she pastes **verbatim**, the same as the opener. If she says there is none, run on
   the opener alone and say in the output that the title half was not part of this remix.
4. **Offer to persist it, into the CORPUS.** A title she read by hand belongs in that entry's
   `visual.onscreen_text` in `data/patterns/corpus.jsonl`, not in the opener bank. The bank is
   derived, so the way to see it there is to delete `data/patterns/openers.jsonl` and rebuild. Put
   the fact where facts live and the next run stops asking her twice. While editing that entry,
   also set `visual.form` and `visual.body_is_complete` honestly, since those are what decide the
   refusal below.

For a text post on Substack, LinkedIn, Bluesky, or X, there is no on-screen title at all and none
is needed. The opener is the whole of what gets copied, and this step does not apply. Do not invent
a title for a text post to make the method feel complete.

## The daily cadence this came from

Sabrina's plan is one post a day, with the first 17 posts remixed from proven winners and original
work after that. That is the intended usage pattern for this mode: a burst of remixes while there
is nothing of her own that has been proven yet, then a taper back to original posts.

One thing to flag before she tries it. This repo's unified scheduler owns posting timing, and it
enforces per-platform caps: `posts_per_week`, `slot_days`, and `max_slots_per_day` in
`config/platforms.yaml`, claimed through `src/publish/slots.ts` against the shared ledger. A daily
remix habit runs straight into those caps, and extra posts will not find a free slot. Raising them
is a cadence decision, so it is hers to make. Tell her which key to change and leave
`config/platforms.yaml` alone.
