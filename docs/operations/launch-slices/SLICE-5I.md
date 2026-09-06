# SLICE-5I: one square card render shared across every platform in a request

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

When the Content page's configure-and-generate flow produces quote-card variants for several
platforms in one request, the identical card is rendered **once** and every platform's queue row
points at that one file.

Today each card variant stages its own record (`media-stages/<variant id>.json`) and renders its
own image. The quote painted on the card is deterministic — `configuredCardQuote` picks the
longest approved-source sentence that fits the shared `quote-card` character limit, earliest on a
tie — so two platforms in one request normally get a byte-identical card. That is duplicate render
work and duplicate cost for one artifact, not two different cards. `/atomize` already does the
right thing: one image, fanned out to per-platform rows.

**Owner decision (Muxin, 2026-09-05): square only.** Cards stay 1080x1080 for every platform.
Do not add an aspect-ratio parameter, a portrait or mobile variant, or per-platform dimensions.
If a future slice adds a second aspect, sharing keys off aspect and costs one extra render — not
one render per platform. Build the key so that stays true, but ship one aspect.

## Difficulty

hard — the change is small but sits in a gated pipeline: the stage record, the pre-promotion
assertion that a row's asset is still its stage JSON, the promotion that swaps in the rendered
asset, and the cost log all assume one stage record maps to one render.

## Depends on

none

## Owned files

Parallel-safe: no — single lane. The staging record, the render/promotion runtime and their tests
are one code path; two workers would edit the same files.

### Lane A — shared card render

- `src/review/configured-media.ts`
- `src/review/configured-media-runtime.ts`
- `src/review/jobs.ts` (only the configured-media staging and queue-row write)
- the existing test files covering the above
- new test files alongside them

## Do not touch

- `src/publish/cards.ts`, `src/publish/typefully.ts`, `src/review/studio-scheduling.ts` — the
  publish and dispatch side is out of scope. Rows keep the shape those files already accept.
- `remotion/` — the card compositions stay exactly as they are, 1080x1080.
- `config/platforms.yaml` — no new dimension or aspect keys.
- `/atomize`'s own card path — it already shares one image.
- `docs/content-studio-master-status.md` — the coordinator updates it.

## Cited headings

none

## Acceptance

- [ ] Two card variants in one request whose render inputs are identical (same media value, same
      card quote text, same visual scheme and render params) produce exactly **one** rendered file,
      and both platforms' queue rows carry that same asset path after promotion.
- [ ] The shared render's identity is derived from those render inputs, not from a variant id or a
      platform name, so adding a second aspect later would split the key rather than multiply it.
- [ ] Variants whose render inputs genuinely differ still render separately. A `static-quote-card`
      (`.png`) and an `animated-quote-card` (`.mp4`) are never treated as the same render, and two
      different quote texts are never collapsed.
- [ ] Each platform keeps its own queue row, its own post text (`derivatives/<id>.md`), and its own
      per-platform review state. Only the rendered image is shared.
- [ ] The pre-promotion check that a row's asset is still its stage record, and the promotion that
      rewrites it to the verified rendered file, both still hold for every row sharing a render —
      including the second and later rows, which must not fail because the file already exists.
- [ ] A shared render appends **one** cost row to `data/cost-log.csv`, not one per platform. If the
      card renderer is free and logs nothing today, assert that it still logs nothing and say so in
      the RESULT BLOCK rather than adding a row.
- [ ] Nothing in the diff introduces an aspect, size, width, height, or orientation parameter.
- [ ] Card renders stay 1080x1080 — unchanged, verified by the compositions being untouched.
- [ ] New tests assert the observable outcome — the files on disk and the asset paths on the rows —
      not that a function was called with a particular argument.
- [ ] Extraction-first is intact: sharing a render must not change which text is chosen or painted.
      No new claim, no rewritten quote, no composed copy.

## Intended approach

Content-address the rendered card: name the output from a hash of its render-determining inputs
and write it under the existing configured-media output directory. A variant whose inputs hash to
an existing, already-verified file reuses it instead of rendering again. This makes sharing fall
out of the naming rather than requiring a request-scoped registry, and it stays correct if two
requests produce the same card.

Deviate if the existing runtime makes this wrong, but say why in the RESULT BLOCK.

## Verify

Run the focused tests for the changed path, then report the exact command and its exit code:

```
npm test -- src/review/configured-media.test.ts src/review/configured-media-runtime.test.ts
```

Adjust the paths to the test files that actually exist or that you add. Do not run the
repository-wide gate — the coordinator runs it once, last, unsandboxed.

## Observable result

For a single Content-page request configured for two platforms with a static quote card, the
content folder holds ONE rendered card file, and both queue rows in `review-queue.md` point at it.

## Risk

medium — audit required: yes. It changes what a gated pipeline writes to disk, and a wrong sharing
key would either collapse two genuinely different cards into one or silently skip a needed render.

## Families

- Builder: Claude, strong tier — subtle correctness inside an approval-gated write path.
- Auditor: Codex / GPT, strong tier — different family, receives the diff, the changed-file list
  and the focused check output only.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in this
packet before the slice closes.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
