# Person-fit rubric (philosophical depth + alignment)

Ported and generalized from Muxin's existing Cowork values-assessment framework, the
`founder-deep-dive` skill (`~/.claude-science/orgs/.../skills/founder-deep-dive/SKILL.md`,
company-founder profiling for her own outreach). Two of that skill's seven layers are the real
portable content and are ported below: **Layer 2b, the Philosophical Depth Probe**, and **Layer
7, the Introduction Test**. The other five layers (leadership-team analysis, the Bay Area Cliques
network map, the Vibe Check, strategic positioning, "who is this person") are either
company-culture-fit-specific or hardcoded to Muxin's own personal network, credentials, and
Obsidian vault files that do not exist in this repo, so they are deliberately not ported. This
doc is used by `qualify.ts` and Claude's inline judgment at the QUALIFY stage to evaluate **any
named person** at a jobsearch-bucket company for the two-key jobsearch gate
(`config/outreach/clients.md` covers company-level fit; this file covers person-level fit), not
just founders.

The generalization: the original skill scored a founder's alignment against a private file
(`Branding/Muxin/Muxin, Voice, Values, Patterns.md`) and imagined a literal social introduction.
This version scores a person's alignment against this repo's canonical, config-driven worldview
source (`config/platforms.yaml` `home_brand.worldview` / `worldview_expanded`, `config/voice.yaml`,
`config/outreach/worldview-map.md`) instead, and reframes "would you introduce them" as "would
their own quoted words hold up as a genuine match," which is checkable from public evidence
instead of a personal judgment call.

## Philosophical Depth Probe

Rate the person on one of four tiers, using their own public words (interviews, posts, talks,
published writing), never inferred from role or title alone.

- **Genuine depth.** A coherent, evolved worldview that references ideas from outside their own
  professional bubble. Sits with complexity and uncertainty instead of resolving it into a slogan.
  Publishes or engages with philosophical/reflective content, not just product/growth output.
  Their language echoes worldview-map.md's statements in their own vocabulary, unprompted.
- **Developing.** Real instincts toward the worldview-map statements, occasional depth, but not
  fully articulated. Some reflective content exists but it is not their main public voice.
- **Surface-level.** Purpose/mission language is decorative (a values slide, an "about" page
  line) surrounded by content that is entirely product, growth, or hiring focused.
- **Absent.** Pure operator. No philosophical or reflective content in any public channel.

A person must rate **Genuine depth** or **Developing**, with at least one direct quote backing the
rating, to count as the two-key jobsearch gate's "named, evidenced like-minded person." A
**Surface-level** or **Absent** rating, or a rating with no quote behind it, does not clear the
gate: record it as "no person-level match found" rather than rounding up.

## Alignment test (adapted from the original's Layer 7 Introduction Test)

Three questions, answered from evidence already gathered, never from vibes:

1. **Does a direct quote hold up as a genuine match?** Would a specific quote from this person, if
   shown next to `config/platforms.yaml` `home_brand.worldview_expanded`, read as the same belief
   in different words, to someone reading both cold? Yes / Yes with caveats / No.
2. **Why?** Ground the answer in specifics: which worldview-map statement(s) the quote matches,
   the source and date, and any real friction point (a place their public record cuts against the
   worldview). Do not paper over a genuine mismatch to make the case look cleaner.
3. **How would the pitch angle name it?** If the answer is Yes or Yes with caveats, state the one
   sentence the outreach pitch would use to name the shared ground, not a generic compliment: a
   specific point of actual kinship between what this person has said and what Muxin has said.

## Important principles (carried over from the original)

- Exact quotes over paraphrases. A paraphrase is not evidence.
- Actions over words: if there's a visible gap between what someone says and what their company
  or team actually does, flag the gap explicitly rather than resolving it in the person's favor.
- This is a fit assessment, not a psychological evaluation. Stay descriptive, not diagnostic.
- The real question is never "is this a good person." It's "does the evidence show a genuine,
  quotable overlap with the worldview," and "unclear" is always a legal, honest answer.
