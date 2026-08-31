# Hook frame library

The corpus, turned into something you can write with. And an honest count of how little of it
survives being checked.

The earlier pass over these 62 creator files produced 69 mechanism proposals. Those were
descriptions: "chained real-quote cold open", "appended resource offer". Accurate, and useless at
the keyboard, because a label is not a template. This is the missing half: actual opening
scaffolds, with blanks.

## What a frame is

```
I used to think {old_belief}. Now {new_belief}.
```

Fixed connective English, plus slots you fill from your own thought, claim or experience:

```
npm run patterns:hook-frames -- fill --frame used-to-think-now \
  --slot old_belief="a backlog was a plan" \
  --slot new_belief="it is mostly a list of things nobody decided"
```

```
I used to think a backlog was a plan. Now it is mostly a list of things nobody decided.
```

The scaffolding is language many writers independently produce. The claim, the subject and the
evidence are all yours.

## The headline number: 10 frames, not 41

Every `Opening hook` field in the corpus, 1,644 of them across 59 files, was extracted. Two model
passes proposed 43 candidate shapes and labelled all 1,565 text hooks against them, which after
merging duplicates gave 41 candidate frames.

Then a deterministic check asked one question of each: **is this template's own fixed wording
language that at least two of its cited creators actually wrote?**

**31 of the 41 failed.** Ten ship.

That check is `checkGrounding` in `hook-frame-corpus.ts`, and it is the most useful thing in this
build. What it caught:

- **Invented connective tissue.** Templates ended in "Here is what followed", "Keep that in mind",
  "before you scroll past", "Here is what still works". None of those phrases appear in any hook the
  template cites. The model added them to make the templates read like templates.
- **One creator's line wearing braces.** "Do not use {tool} if you do not know how. Or it will
  {cost}." is one creator's sentence with two words swapped out. Cross-creator counting alone did
  not catch it, because a second hook had been mislabelled onto the frame.

A repair pass, asked to rewrite the 41 using only grounded wording, made the point twice over: it
returned DROP for 13, and for most of the rest it produced a specific creator's signature opener,
which is exactly what must never ship.

**The conclusion to take from this: the corpus supports a small number of genuinely common opening
scaffolds, not a swipe file.** Getting more means more corpus, not more model passes.

## The guards

Three, all fail-closed, in `hook-frame-library.ts` and `hook-frame-corpus.ts`:

- **Cross-creator count**, read off the refs themselves and never off the number written beside
  them. A shape at least two unrelated creators reached for is common language by demonstration.
- **Grounding**, above. Fixed runs of three or more words must appear in at least two cited
  creators' text. Runs found in nobody's text were invented; runs found in one creator's text are
  that creator's phrasing.
- **Verbatim scan.** No eight-word fixed run may appear anywhere in the corpus. Also applied to the
  template's fixed words with the slots closed up, so sprinkling slots through a distinctive
  sentence does not hide it.

Plus: no creator name, handle, URL, em dash, or claim word, across every field including `id` and
`topics`.

## The performance signal, and its limits

The old proposals had no denominator. This one does, and it is deliberately modest.

Each corpus entry is ranked against **the other entries in its own creator's file**, on the single
metric most of that file's entries report. Comparing a 7.9M subscriber channel's view count against
a 900 follower account's would measure audience size, not the opening.

- 1,571 entries rank, across 55 of 62 files
- **28%** land in the top quartile of their own creator's spread

28% is the number every frame is read against. Ordering shrinks each frame's share toward it with
ten pseudo-counts, so four instances that happened to land well do not outrank a frame measured over
thirty.

**What this does not tell you.** These are observational counts with no control. Nobody wrote the
same post twice with two different openings. At these instance counts, two to thirty-one, the share
is a tiebreaker between frames you already like, never evidence that a frame works.

## What it does not do

It does not write posts, pick your topic, or publish anything. `fill` returns text marked
`review: pending` with its frame id and source refs attached.

**To approve a frame, change its `review` field from `pending` to `approved` in
`config/hook-frames.jsonl`.** Until then `list` shows nothing without `--include-pending`.

## Matching a draft to a frame

`list` ranks by evidence and has never seen your draft, which means it will hand back a frame that
fights the piece: a reversed-belief opener is useless against a post that states no belief. `fit`
is the step that reads the draft.

```
npm run patterns:hook-frames -- fit --platform linkedin --draft path/to/draft.md [--show-unfit]
```

Each slot is read for what it demands (a duration, a role, a purchase, a question), the draft is
scanned for that material, and a frame is only offered when the draft can actually supply it.
Frames the draft cannot fill are hidden rather than ranked last. Spans are lifted from the draft
**verbatim**, so a proposed opening is assembled from your own wording; a slot with nothing to draw
on stays `{slot}` for you to fill, because writing it would mean composing a claim your draft does
not make.

```
ive-been-for-timespan  [partial, draft already opens this way]
  I have been {state} for {timespan} now.
    {state} <- "writing on LinkedIn"
    {timespan} <- NOT FOUND (needs a duration)
  proposed: I have been writing on LinkedIn for {timespan} now.
```

Note what it refuses to do there. The draft says "since 2024", which is a start date, not a
duration. Turning one into the other would put a number in your mouth, so the slot stays empty.

`fit` reports what a draft can supply and nothing else. It does not score writing, and it never
claims a proposed opening beats the one you wrote, because the corpus cannot support that judgment.

## Commands

```
npm run patterns:hook-frames -- list --platform linkedin [--topic ...] [--include-pending]
npm run patterns:hook-frames -- fit  --platform linkedin --draft <path> [--show-unfit] [--limit N]
npm run patterns:hook-frames -- fill --frame <id> --slot name=value [--slot ...]
npm run patterns:hook-frames -- verify
```

`verify` re-derives every frame's support, grounding and platform coverage from the read-only corpus
and exits non-zero on any disagreement. It currently reports 0 findings across all 10 frames.
