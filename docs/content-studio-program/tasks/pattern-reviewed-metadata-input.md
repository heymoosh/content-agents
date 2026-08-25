# pattern-reviewed-metadata-input

## Outcome

Muxin supplies explicit, body-free account metadata and provenance decisions for the approved
65-account review cohort, or records an explicit blocked/unmapped disposition per account. This
is the required human input before any canonical account or source-evidence ledger append.

## Decisions already made

- The cohort is exactly the approved 65-account snapshot and must not be widened or replaced.
- All 65 staging rows currently remain unreviewed. Evidence presence does not establish identity,
  audience, topic, focus, pool, scope, baseline, quality, or a winner.
- For each row, preserve `null` when not collected/not applicable and use `unknown` only after
  checking without resolution. Do not invent fields from account names, metrics, ranking, or model
  output.
- A reviewed row needs the explicit metadata contract: stable account identity/status, topics,
  focus, niche label, pool memberships/reasons, popularity/sample/baseline scope and source,
  medium, format, audience snapshot with provenance/dates, evidence links, reviewer, and review
  timestamp. A blocked or unmapped row must state its disposition and caveat/reason.
- No response to this gate selects a canonical pattern or permits a best/winner claim. Source/post
  evidence and baseline gates remain independently required.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/candidate-account-slate-20260825.md`
- `docs/content-studio-program/runs/pattern-review-staging-20260825/review-staging-result.json`
- `docs/pattern-mining-plan.md`
- `docs/content-system-blueprint.md`

## Review artifact

The read-only staging command produced 65 body-free rows, 499 existing evidence records,
no canonical-write authority, and no winner authority. Recreate the JSON packet locally with:

    node --import tsx src/patterns/review-status.ts --format json > /private/tmp/pattern-review-status.json
    node --import tsx src/patterns/review-staging-cli.ts --input /private/tmp/pattern-review-status.json --format json > /private/tmp/pattern-review-staging.json

Use the existing review-input contract in `patterns:review-status` to supply the reviewed metadata;
do not copy creator bodies into that input.

## Decision requested

Provide or identify the body-free review metadata/provenance input for the 65 accounts, including
explicit blocked/unmapped rows where facts are unavailable. Once supplied, the coordinator will
validate it, run the resulting read-only readiness reports, then scope the separately leased
canonical ledger append and its independent evidence audit.
