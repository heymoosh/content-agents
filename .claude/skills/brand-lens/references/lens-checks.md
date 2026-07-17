# The brand lens — seven draft-mode checks

Run these against a draft Muxin wrote, checking `config/brand.yaml` for the canonical language.
Every check produces a flag (with a suggested placement, quoting the draft's own line) or a
confirmation — never an edit. There is no score, no threshold, no gate: Muxin decides what to act
on. The hard rule from SKILL.md governs: propose and flag, never rewrite.

## The seven checks

1. **Belief under audit named.** One sentence, near the top. If the piece critiques something but
   never states the assumption plainly, flag it — and quote the passage that comes closest, as the
   natural place to make it explicit.
2. **Payoff leads, salt follows.** The reader's outcome (what they save, avoid, or gain) appears
   before the teardown. Flag buried payoffs and say where to move them ("the payoff is in
   paragraph 6; consider leading with it").
3. **Verifiable check present.** Evidence, history, or a runnable test backs the audit.
   Assertions without receipts get flagged. When verifying a flag yourself, cite a real quote
   with a live source URL (the `/outreach research` evidence discipline) or don't claim it.
4. **"What Now" where the piece earns it.** The `what_now` heading (brand.yaml) is the treatment
   for despair-adjacent society pieces — pieces touching society-level problems that could leave
   the reader in despair. Not every post warrants it; the pledge text below it is optional
   (long-form only, when it fits). Flag when a piece qualifies but lacks it, AND when the heading
   is forced onto a piece that doesn't need it. The universal requirement is softer — every piece
   ends with something actionable — and that's check 7's job, not this one's.
5. **Signature line placement.** Check whether the signature line (or a natural variant) appears;
   if not, suggest ONE placement point. Do not insert it. While `signature_line.status` is
   `discovering` in brand.yaml: also watch for recurring phrasings across Muxin's drafts that
   express `belief_raw` and flag them as candidates — the line will be discovered from his
   natural usage, not chosen from the candidate list.
6. **Reader/CTA match.** The CTA speaks to the same reader the piece was written for. Flag
   mismatches (an eng-lead piece with a founder CTA). Cross-check the altitude→platform mapping
   in brand.yaml: if the piece reads technical but the CTA and platform say society-essay,
   something's off.
7. **Observable the reader can touch.** A test to run, a sim to play with, a question set to use
   in their next meeting. Flag if the piece is critique-only.

## Output shape

A flag list, most important first, each entry anchored to the draft's own words:

```
- [payoff-leads] The payoff ("you get your Tuesday afternoons back") is in paragraph 6.
  Consider leading with it; the first two paragraphs are all teardown.
- [what-now] This piece qualifies (society-level, ends heavy) but has no "What Now" section.
  The paragraph starting "So what do we do..." is already doing the work; a heading above it
  would make it the branded element.
- [signature-candidate] "we automated the assumption instead of checking it" appears here and
  in the 2026-07-04 essay. Reads like a natural signature-line candidate; logging it, not
  inserting it.
- [pass] Belief under audit: named plainly in sentence 2. No flag.
```

Passes are worth stating (they tell Muxin the brand elements he repeated naturally); flags always
say *where* and *what to consider*, never rewrite the sentence for him.
