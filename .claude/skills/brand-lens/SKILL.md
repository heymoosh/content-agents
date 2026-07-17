---
name: brand-lens
description: The enforcement layer for Muxin's Human Inference brand. Muxin generates the ideas and drafts naturally; this skill runs the brand lens against a source or a draft and PROPOSES changes -- it never rewrites. Inspiration mode (a source/idea in) proposes 2-4 angles; draft mode (something Muxin wrote in) flags where brand elements are missing or buried. Checks against config/brand.yaml. Opt-in only. Usage - /brand-lens <url|file|content-folder|pasted text|topic>.
---

# /brand-lens — the Human Inference enforcement layer

Muxin's brand sticks through repetition of a small set of brand elements. He generates the ideas
and drafts naturally; he does NOT naturally enforce repetition. This skill is the enforcement
layer: take a source of inspiration or a draft, run the brand lens against it, and propose
changes. It makes the branding consistent so the writing can stay instinctive.

One brand container: **Human Inference**. Every element the lens checks lives in
`config/brand.yaml` — read it at the start of every run; never hardcode brand language here.

## The hard rule (overrides everything else in this skill)

**Propose and flag — never rewrite.** Output is annotations and suggestions ("the payoff is in
paragraph 6; consider leading with it"), never replacement prose. Muxin's original voice is
preserved. This skill composes no sentence that could end up in a published piece — no exception
to CLAUDE.md rule 1 is needed because nothing it produces enters the pipeline as content.

## Other rules

1. **Opt-in only.** Never runs as a side effect of `/atomize`, `/scout`, or any other skill.
   Muxin invokes it explicitly. (`/atomize` step 1.5 may *offer* it; it never auto-runs it.)
2. **Evidence discipline** (same as `/outreach research`): when a flag or angle rests on a
   checkable fact, cite a real quote with a live source URL, or don't claim it.
3. **Voice.** The skill's own output prose (annotations, angle proposals) follows
   `config/voice.yaml` — no em dashes, no AI tells.
4. **This skill's flow is content-generation logic** (CLAUDE.md rule 7): a PR touching it holds
   for Muxin's review with an old-vs-new sample. No self-vet-merge.
5. **Signature line is being discovered, not chosen.** `config/brand.yaml` `signature_line` is
   `status: discovering`: in draft mode, watch for recurring phrasings across Muxin's drafts that
   express `belief_raw` and flag them as candidates. Never insert a candidate into his writing.

## Mode dispatch

- Input is something **Muxin wrote** (a draft file, a content folder's `source.md`, pasted
  draft text) → **Draft mode**.
- Input is a **source or idea** (a URL, an article, a benchmark release, a raw idea, a
  conversation excerpt, a `/scout` content-example lead) → **Inspiration mode**.
- Ambiguous → ask which he wants.

## Inspiration mode

Read the source (WebFetch a URL, Read a file or `outreach/leads/content-example-<slug>/lead.md`).
If nothing usable comes back (dead link, paywall, thin content), say so and stop — never fabricate
a stand-in.

Propose **2-4 angles**, each specifying:

- **The reader** (who) and **the payoff** they walk away with (what they can now do).
- **The altitude** — technical / professional / society-field-level — and the platform it maps to
  per `config/brand.yaml` `altitudes`.
- **The belief under audit**, stated in one sentence.
- **The observable**: the cheapest thing the reader could check or run themselves in under a day.

**Legacy derisk flavor** (optional, one angle at most, best for technical-altitude pieces): format
an angle as the old `/derisk` frame — riskiest belief, cheapest test, the decision it unlocks,
what it saves if false. It is an angle *format*, not a piece: still a proposal, still nothing
composed in Muxin's voice.

Output is a proposal in chat. Muxin picks an angle and writes the draft himself — the skill never
writes the piece, and there is no scaffolding step here. When his draft exists, `/atomize` ingests
it as always (and draft mode below can audit it first).

## Draft mode

Read the draft, read `config/brand.yaml`, then run the seven lens checks
(`references/lens-checks.md` has the full rubric):

1. **Belief under audit named** — one sentence, near the top.
2. **Payoff leads, salt follows** — the reader's outcome appears before the teardown.
3. **Verifiable check present** — evidence, history, or a runnable test backs the audit.
4. **"What Now" where the piece earns it** — despair-adjacent society pieces get the heading;
   pieces that don't qualify shouldn't have it forced on.
5. **Signature line placement** — suggest one placement point if absent; never insert.
6. **Reader/CTA match** — the CTA speaks to the reader the piece was written for.
7. **Observable the reader can touch** — flag critique-only pieces.

Output is a **flag list with suggested placements**, quoting the draft's own lines so Muxin can
find each spot ("the payoff is in paragraph 6, 'saves a week of...' — consider leading with it").
Confirmations count too: say which checks the draft already passes. Plus the signature-line watch
(rule 5): flag any recurring phrasing that reads like a natural signature-line candidate.

Never edit the draft file. When the draft lives in a content folder and Muxin wants the audit
saved, write it to `<folder>/lens-notes.md` — a sidecar; `source.md` stays byte-for-byte his.

## What "done" looks like

- Inspiration mode: 2-4 concrete angles in chat, each with reader+payoff, altitude→platform,
  belief-under-audit, and an under-a-day observable. Muxin picks; he writes.
- Draft mode: a flag list against the seven checks, anchored to the draft's own lines, with zero
  modifications to anything Muxin wrote.
