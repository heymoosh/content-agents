# Hook frame library

The corpus, turned into something you can write with.

The earlier pass over these 62 creator files produced 69 mechanism proposals. Those were
descriptions: "chained real-quote cold open", "appended resource offer". Accurate, and useless at
the keyboard, because a label is not a template. This is the missing half: the actual opening
scaffolds, with blanks.

## What a frame is

```
Much has been said about {object}. But {surprising_result}.
```

Fixed connective English, plus slots you fill from your own thought, claim or experience. Filling
it takes seconds:

```
npm run patterns:hook-frames -- fill --frame conventional-wisdom-pivot \
  --slot object="AI replacing product managers" \
  --slot surprising_result="the teams shipping fastest kept a human owning the roadmap"
```

```
Much has been said about AI replacing product managers. But the teams shipping fastest kept a
human owning the roadmap.
```

That output is yours. The scaffolding is language a hundred writers would independently produce;
the claim, the subject and the evidence are all things you supplied.

## Where the frames come from

Every `Opening hook` field in the corpus, 1,644 of them across 59 files, was extracted and grouped
into recurring shapes. A shape only becomes a frame if **at least two different creators** reached
for it independently. That is the whole originality argument, and it is a stronger one than a
wordlist: a construction two unrelated people arrived at separately is common language by
demonstration, not one creator's distinctive line with braces swapped in.

Three further gates, all fail-closed, all in `src/patterns/hook-frame-library.ts`:

- at least five fixed words outside the slots, so a "frame" like `{question}` cannot ship
- no eight-word fixed run that appears verbatim anywhere in the corpus
- no creator name, handle, URL, em dash, or performance claim word

A frame failing any of these is dropped from the library and reported, never silently kept.

## The performance signal, and its limits

The old proposals had no denominator. This one does, and it is deliberately modest.

Each corpus entry is ranked against **the other entries in its own creator's file**, not against
the corpus. Comparing a 7.9M subscriber channel's view count to a 900 follower account's would
measure audience size, not the opening. Within a file, the comparison is fair.

- 1,571 entries carry a readable reach count and sit in a file with enough entries to rank
- 55 of 62 files have a usable distribution
- **28%** of ranked entries land in the top quartile of their own creator's spread

28% is the number every frame is read against. A frame whose instances land top-quartile 50% of
the time did better than the corpus baseline; one at 20% did worse.

**What this does not tell you.** These are observational counts with no control. Nobody wrote the
same post twice with two different openings. A frame's share reflects the topics, the creators and
the moments it happened to appear in as much as the opening itself. At the instance counts in this
first bank, mostly two to seven, the share is noise; treat it as a tiebreaker between frames you
already like, never as evidence a frame works.

## What it does not do

It does not write posts, pick your topic, or publish anything. `fill` returns text marked
`review: pending` with its frame id and source refs attached. Nothing here reaches generation
until you mark frames approved in `config/hook-frames.jsonl`.

## Commands

```
npm run patterns:hook-frames -- list --platform linkedin [--topic ...] [--include-pending]
npm run patterns:hook-frames -- fill --frame <id> --slot name=value [--slot ...]
npm run patterns:hook-frames -- verify
```

`verify` is the one that keeps the bank honest. It re-derives every frame's support from the
read-only corpus and refuses to take the bank's own numbers on faith: a citation that resolves to
no entry, a miscounted creator, a platform the refs do not actually cover, all surface as findings
and a non-zero exit.
