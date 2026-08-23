# Full-post pattern library

The structure library that sits alongside `references/hook-patterns.md` and
`references/civic-adaptation.md`. Hook patterns cover the first line. This file covers the whole
post: the arc after the hook, what it makes the reader feel, how it closes, and how long it runs.

**Status: empty. Not yet mined.** This file is populated by `/patterns synthesize`, the synthesis
step of the pattern-mining pass. Until the first mining run lands, every platform section below is
a placeholder. **If you are drafting right now and this file is still empty, fall back to
`references/hook-patterns.md`** and to the per-channel angle in `config/platforms.yaml`
`spin_angles`. An empty section is not permission to invent a structure and call it proven.

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

Not yet mined. Fall back to `references/hook-patterns.md`.

### substack

Not yet mined. Fall back to `references/hook-patterns.md`.

### bluesky

Not yet mined. Fall back to `references/hook-patterns.md`.

### threads

Not yet mined. Fall back to `references/hook-patterns.md`.

### mastodon

Not yet mined. Fall back to `references/hook-patterns.md`.

### tiktok

Not yet mined. Fall back to `references/hook-patterns.md`.

### youtube

Not yet mined. Fall back to `references/hook-patterns.md`.

### instagram

Not yet mined. Fall back to `references/hook-patterns.md`.
