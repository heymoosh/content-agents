# SLICE-5H archived session log

Superseded handoffs, result blocks and dated session records moved out of `SLICE-5H.md` so the
packet stays under 12 KB. No session reads this file. See `AGENTS.md` -> `## Slice protocol`
-> `### Packet size discipline`.

## Audit record

Cross-family audit: **Codex / GPT** (builder was Claude), given the acceptance list, the candidate
diff, the changed-file list and the focused check output — not the master document, not the worker
transcript. Three established defects were converted into builder checklist items and closed with
evidence:

1. **The render input was unbound to approval.** The approval digest covers the stage plan, but
   `renderStill` reads the quote off disk, so the companion was a second render input the digest
   never saw: editing it after approval would paint unapproved, possibly non-verbatim, possibly
   over-length text onto the card, defeating the extraction-first guarantee this slice exists to
   provide. Closed by `assertApprovedCardQuoteOnDisk`
   (`src/review/configured-media-runtime.ts:331-352`, called at `:361`), which compares the
   companion body against the approved plan's `sourceText` before anything is spawned and refuses on
   mismatch. Proven by mutating the companion after approval and asserting the render is refused, no
   `images/` is created, and the stage stays `approved` with nothing promoted
   (`configured-media-runtime.test.ts:78-100`).
2. **Cards generated before this slice would be stranded.** Occupancy treated row + post derivative
   + stage as complete, so a pre-existing card returned `existing: true` while rendering failed on
   the missing companion, unrepairable. Closed by adding a fourth `quote` occupancy key for card
   media only and a backfill (`repairConfiguredCardQuotes`, `jobs.ts:1013-1049`) that extracts the
   quote from the source lines the post derivative already recorded — no model call, no new
   authorization boundary — then re-points the stage plan and **drops the stale approval** so a
   changed render input must be reviewed again. Stages already `rendered` or `promotion-pending` are
   skipped, leaving finished assets and their digests intact. The human-reviewed post derivative is
   never rewritten (asserted byte-for-byte).
3. **The byte-identity criterion was under-tested.** It had been checked for `media: "none"` only,
   on selected fields rather than bytes. Closed by capturing a real pre-change baseline (stashing
   the three implementation files) across all five non-card media values and comparing every written
   byte of both derivatives, both media stages and the review queue.

Declined as scope creep, recorded so they are not relitigated: rewriting sentence splitting to
handle decimals and abbreviations, and re-documenting untreated-control behavior.

## Deviations accepted by the coordinator

**The rendered image is named after the quote companion, not the variant id:**
`images/<id>-quote.png` (and `.mp4`), where this packet's `## Observable result` said
`images/<id>.png`. `renderStill` names its output after the derivative it is handed
(`src/video/render.ts:64`) and that file is on the do-not-touch list, so pointing the renderer at
the quote companion necessarily renames the image. The builder updated both the stage record's
`outputPath` and the runtime's `primaryAsset`/companion. Audited and cleared: the auditor traced
`renderStill`, checkpoint/promotion and the publish path and confirmed nothing reconstructs the old
name (the queue row's asset is `media-stages/<id>.json`, and card copy is keyed by `row.id`).
Coordinator-verified independently: no remaining constructor of `images/${variant.identity.id}`
exists in `src/`.


## RESULT BLOCK

- Changed paths: `src/review/jobs.ts` (+188/-14), `src/review/jobs.test.ts` (+379/-1),
  `src/review/configured-media.ts` (+30/-1), `src/review/configured-media.test.ts` (+22/-0),
  `src/review/configured-media-runtime.ts` (+61/-5),
  `src/review/configured-media-runtime.test.ts` (+66/-5). No do-not-touch file changed.
- Outcome: a configured card variant now writes two texts. `derivatives/<id>.md` keeps the post
  text (unchanged path, unchanged consumers: the review row and the publish caption) and a new
  `derivatives/<id>-quote.md` holds the on-image quote — `platform: quote-card`, `source_lines`, no
  spin, gated against the shared `config/platforms.yaml` quote-card limit of 180 alongside every
  other platform limit, so one overrun aborts the whole set atomically. The quote is extracted
  verbatim and deterministically from the variant's OWN approved source lines (longest fitting
  sentence, earliest on a tie; an all-overrunning source is cut at a word boundary, never
  rewritten), never from the treated body. The media plan's `sourceText` is the quote, and the
  runtime hands `--quote <id>-quote` to `renderStill`, so the image carries the quote and the post
  carries the context. Card post text is drafted as context at initial generation under one shared
  `CARD_CONTEXT_RULE` used by both the drafting prompt and the revise path, and
  `isConfiguredCardVariantId` gives base64url Studio ids the card awareness the legacy regex could
  never match. Every non-card media path writes byte-identical files.
- Checks run and results: focused —
  `node --import tsx --test src/review/configured-media.test.ts src/review/configured-media-runtime.test.ts`
  and `node --import tsx --test src/review/jobs.test.ts`, both exit 0; `npx tsc --noEmit` exit 0.
  Byte baseline for the five non-card media values captured against the stashed pre-slice
  implementation and diffed clean (16991 bytes each), then pinned as per-file SHA-256.
  Repo-wide gate `npm run check` UNSANDBOXED: **exit 0, 4204 pass / 485 suites / 0 fail / 0 skip**
  (+19 tests vs 5F's 4185/485/0, same suite count — exactly the new blocks). The three
  `serve.test.ts`-family failures the builder saw when running those files in isolation do not
  occur in the full gate.
- Evidence locations: quote extraction `src/review/jobs.ts:390-435`; pre-write computation and the
  limit gate `:1229-1250`; companion write and plan re-point `:1277-1296`; stage record
  `quoteDerivativePath`/`outputPath` `:995-1006`; shared card rule and Studio-id awareness
  `:126-152`, drafting instruction `:368-386` injected at `:482`; repair `:1013-1049` with
  occupancy `:1067-1080`; approval binding `src/review/configured-media-runtime.ts:331-352` called
  at `:361`; renderer argv and assets `:299-327`.
- Unresolved: none inside this slice. Two card items are deliberately deferred to their own slices
  and recorded under `## Found during this slice` above: Studio cards do not reach `publish:cards`,
  and configured generation renders one image per platform instead of sharing a card.

