# pattern-creator-corpus-to-mechanism-proposals

## Outcome

Turn the merged PR #403 creator-content library into a deterministic, body-free, reviewable set of
mechanism proposals with exact source references, actual coverage/gap accounting, evidence caveats,
and a storage-boundary recommendation, without making any proposal available to generation or
changing canonical pattern data.

## Decisions already made

- The merged Markdown is research evidence, not a reviewed template library or live Content input.
- Measure the files as they exist. Do not assume literal field counts match entry counts; support
  source-appropriate hook labels, `Structure`/`Structure map`, visual hooks, partial bodies,
  paywalls, transcript gaps, and bounded platform windows explicitly.
- Persist no full creator body, full transcript, exact creator hook, distinctive phrase sequence,
  story, or example in the body-free projection. Store source file/entry references and abstract
  mechanisms instead.
- Keep hook, structure, framing, retention, CTA, storytelling sequence, native format, and visual
  treatment distinct. Unknown remains unknown.
- Preserve platform, topic, medium/format, selection method, metrics, comparison window or
  denominator, repeatability, caveats, and confidence when available. Do not invent missing facts
  or claim universal virality.
- Every proposal starts `review_status: pending` and `originality_status: pending`, with
  `generates_copy: false` and `creator_body_copy_allowed: false`.
- Do not edit the eight existing reviewed hook-template rows, platform-treatment configuration,
  canonical data, raw corpus, Content generation, or UI.
- Do not move or delete the tracked raw corpus. Produce a precise, recoverable migration
  recommendation comparing the current tracked state with the charter's local/gitignored boundary.
- Stop after audited proposals. Muxin reviews them before a separate content-generation-logic task
  can populate reviewed templates or wire Content.

## Required context

- `docs/content-studio-program/charter.md`
- `docs/content-studio-program/corpus-ui-reconciliation-20260827.md`
- `docs/content-system-blueprint.md`
- `docs/content-studio-program/creator-content-index.md`
- `docs/content-studio-program/creator-content/**`
- `config/patterns/hook-template-ledger.jsonl`
- `src/patterns/hook-template-ledger.ts`
- `src/patterns/platform-treatment-blueprint.ts`
- `src/patterns/types.ts`

## Boundaries

- Write paths: `src/patterns/creator-content-normalization.ts`,
  `src/patterns/creator-content-normalization.test.ts`,
  `src/patterns/creator-mechanism-proposals.ts`,
  `src/patterns/creator-mechanism-proposals.test.ts`,
  `src/patterns/creator-mechanism-proposals-cli.ts`, `package.json`,
  `docs/content-studio-program/staging/creator-mechanism-proposals-20260827/**`.
- Read-only corpus inputs outside the write lease: `docs/content-studio-program/creator-content/**`
  and `docs/content-studio-program/creator-content-index.md`. They may be inspected only for this
  task and must not be modified.
- Forbidden paths: coordinator state and run records; `data/**`; `config/**`; `content/**`;
  `briefs/**`; `src/review/**`; `src/grow/**`;
  `src/atomize/**`; `src/publish/**`; `src/venture/**`; `src/fiction/**`; `src/outreach/**`;
  `src/charles/**`.
- Semantic locks: `pattern:creator-corpus-normalization`,
  `pattern:body-free-mechanism-proposals`, `pattern:raw-corpus-storage-reconciliation`,
  `pattern:no-template-availability`.
- This task does not hold `canonical:data/patterns/**` and may not write there.

## Acceptance criteria

- A deterministic parser/validator inventories every actual creator entry and reports recognized
  field variants, missing/partial fields, source accessibility, capture windows, metric availability,
  and index-to-file discrepancies without reading unrelated corpus data.
- Tests cover text, image, short-video, long-video/transcript, long-form/paywalled, partial capture,
  visual-only hook, missing field, and malformed entry cases.
- The body-free proposal artifact contains no creator bodies or verbatim hook text and fails closed
  if a prohibited body/copy field or exact-text payload is introduced.
- Mechanism proposals retain source references and evidence limitations, keep mechanism families
  separate, identify support counts without equating repeated entries from one creator with
  cross-creator replication, and preserve ties/unknowns.
- The storage report inventories the tracked raw-body footprint and proposes a recoverable migration
  sequence, but performs no deletion or move.
- The task emits a compact human review document describing proposed mechanisms, rejected or
  unsupported clusters, coverage gaps, originality risks, and the exact decision required before
  template integration.
- No proposal is labeled approved, reviewed, best, winner, proven viral, or generation-ready.
- `npm run check`, targeted normalization/proposal tests, the proposal CLI validation command, and
  `git diff --check` pass.
- Return one final commit plus a builder report; do not merge into main.

## Builder return

Return the final commit and a JSON builder report matching `protocol.md`, including changed paths,
actual corpus counts, tests, risks, unresolved items, and the storage recommendation. Do not edit
`work.yaml` or `runs/`, and do not create or change generation templates.
