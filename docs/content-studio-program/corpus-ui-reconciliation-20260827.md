# Corpus and UI reconciliation: 2026-08-27

## Recorded state

PR #403 merged at `497d4ff27ab5f71bcd2788929d67d216a76d5677`. It added the
human-readable creator study guide, one index, and 62 per-creator Markdown libraries. The diff is
documentation-only: it does not add a parser, a body-free mechanism projection, reviewed templates,
generation wiring, an API, or a Studio surface.

The merged library is therefore research evidence, not a live Content input. Its extraction labels
also vary by source and medium (`Opening hook`, transcript-specific opening labels, image text,
`Structure`, and `Structure map`). Coverage must be measured from the actual files rather than
assuming one literal field spelling or one entry shape.

The repository-level readiness interfaces remain blocked independently of the new Markdown:

- the platform/pool matrix has zero ready targets and 352 blocked targets;
- the baseline report has 350 targets still needing measurement in a clean checkout;
- the reviewed hook-template ledger still contains the eight pre-existing body-free rows;
- no source or configuration file references `docs/content-studio-program/creator-content/**`.

## Storage-boundary discrepancy

The charter says raw creator bodies remain local and Content consumes body-free reviewed
interfaces. PR #403 committed full essays, transcripts, captions, and other creator bodies under
`docs/`. Reconciliation does not delete, move, or rewrite those files. The corpus lane must produce
an exact storage-migration recommendation and a body-free replacement projection before Muxin
decides whether the tracked raw files should be removed in a separate recoverable change.

Until that decision, workers outside the corpus lane must not read the raw creator-content files,
and no prompt, UI, or generator may load them.

## Parallel lanes

### UI lane

`cs6-parallel-safe-ui-completion` owns the remaining product presentation that can be implemented
without the new evidence interface. It may create a typed, fixture-backed recommendation seam and
all honest empty, blocked, pending-review, and unavailable states. It may not inspect the raw corpus
or change generation, routing, approval, scheduling, publishing, or pattern policy.

### Corpus lane

`pattern-creator-corpus-to-mechanism-proposals` is the only task allowed to read the raw creator
libraries. It validates actual coverage and source limitations, produces deterministic body-free
mechanism proposals with source references and evidence caveats, and emits a storage-boundary
recommendation. It does not modify canonical pattern data, the reviewed template ledger, Content
generation, or Studio UI.

These leases are file- and semantically disjoint and may run at the same time from the same clean
base SHA.

## Join gate

Neither parallel task makes viral recipes available to Content. The later join requires all of the
following:

1. corpus QA and body-free mechanism proposals pass a cross-family audit;
2. Muxin reviews the proposed mechanisms and storage recommendation;
3. a separate content-generation-logic task adds only approved, originality-passed templates and
   includes before/after samples;
4. the UI consumes that reviewed interface rather than the raw corpus;
5. the joined behavior passes local checks and end-to-end verification before final review.

