# `/patterns remix`: apply a common hook template

Read this before running `/patterns remix`. The mode applies a familiar, widely shared opener
format to Muxin's own material. It does not copy a creator's opener word for word.

## What the opener bank is for

The bank is evidence. It may retain the captured opener and on-screen title verbatim in
`data/patterns/openers.jsonl` so Muxin can inspect what happened, compare examples, and choose a
mechanism. That exact text is not the generated output unless Muxin is deliberately creating a
quotation, attribution, or licensed exception.

The bank remains honest about incomplete media evidence. A short caption over an image, a carousel
whose substance is on later slides, or a video whose spoken hook was not captured is not treated as
complete evidence. `body_is_complete: false`, a caption-only transcript, truncation, or a missing
on-screen title must be shown to Muxin before she chooses the example.

## The common-template rule

The selected opener or title supplies a reusable format, such as:

- a direct promise with a specific number or timeframe;
- a named-audience callout;
- a contrarian reframe followed by the reason;
- a personal admission before the lesson;
- a concrete pain or outcome followed by one next action.

The generated version may stay close to the familiar mad-lib shape. Fill its slots with Muxin's own
claim, experience, evidence, example, and point of view, then write it in her voice. The body and
CTA remain hers and must pass the voice, truthfulness, civic-adaptation, and human-review gates.

Do not copy a distinctive creator-specific phrase sequence, story, claim, example, or body and
swap nouns. A common template is allowed. A signature line that readers recognize as belonging to
one creator is not. Exact source wording is analysis, quotation, attribution, or a licensed
exception only.

## The mode

```
/patterns remix <content-folder | topic> [--platform X]
```

1. Show Muxin the ranked opener evidence for the target platform. Include the source creator,
   platform, URL, metric, comparison scope, body-completeness status, and the common template or
   mechanism inferred from it.
2. Let Muxin select the example or template. The system may recommend a template, but does not
   silently choose a creator-specific line for reuse.
3. Adapt the opener into Muxin's own wording. Preserve the useful rhythm, promise, tension,
   audience callout, or CTA shape, but use her actual substance. Record the selected pattern,
   source evidence, adaptation note, and any uncertainty.
4. Build the rest from her source or supplied thought. Do not invent a result, statistic,
   experience, or worldview statement. Civic material still needs a finishable micro-action or
   neutral record-based value matching CTA.
5. Write the result to `<content-folder>/pattern-remixes.md` or next to a supplied file. Never
   write into `derivatives/`, queue it, schedule it, or publish it.
6. State the provenance in the output, including the source example, its scope, the pattern used,
   what was adapted, and what remains Muxin's own material. Exact evidence can remain local and
   gitignored; the output should not paste it as if it were Muxin's copy.

## When to refuse or pause

- The opener bank is missing or empty. Collect and analyze the corpus first.
- The selected example's spoken hook, visual title, or body is not actually known. Ask Muxin to
  inspect or supply the missing evidence rather than guessing.
- The example has no declared comparison scope, metric, date, or selection rule. It can be an
  observed signal, but not a winner or proven pattern.
- The requested body is not Muxin's own material. Route a bare topic to `/patterns ideas` or ask
  for her thought, essay, note, or source file.
- The proposed adaptation is still recognizably a creator's signature wording or story. Keep the
  mechanism, rewrite the hook, and surface the concern for human review.

## Provenance and permission fields

`verbatim_ok` may remain on internal opener evidence for a public permission, quotation, or licensed
exception. It is not required for ordinary use of a common hook template, because ordinary use does
not reproduce the creator's exact wording. If the output intentionally includes a quotation, record
the permission or attribution and make that choice explicit in the review bundle.
