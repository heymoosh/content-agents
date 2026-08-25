# pattern-review-staging-projection

## Outcome

The approved 65-account cohort has a deterministic, body-free staging projection that lets a human
review explicit metadata and provenance without selecting a canonical pattern, inferring missing
facts, or writing `data/patterns/**`.

## Decisions already made

- Input identity is fixed to the approved candidate snapshot: source commit
  `7b1256ea8d6787cea9105d2e4b2b60ea5ff1b3c7`, selection rule `evidenceCount > 0`, cohort size
  65, and the recorded sorted-key SHA-256 digest.
- Fail closed if the source projection's approved cohort count or digest drifts. The projection
  must name the mismatch rather than silently include, exclude, or replace accounts.
- Emit only body-free account-review context: account key, platform, handle, evidence count,
  required metadata fields, source/evidence references, provenance and caveat placeholders, and
  explicit `niche`, `broad`, and `format` disposition choices.
- Preserve `null`, `unknown`, and blocked/unmapped state. Do not derive audience, topics, focus,
  pool membership, scope, baseline, identity mapping, or review status from names, metrics,
  rankings, or model judgment.
- The 306 zero-evidence accounts stay out of this projection and remain explicitly unmapped.
- This task does not fetch, generate, rank, select a winner, publish, or write canonical pattern
  data. A later human review of each row's metadata/provenance is still required before any
  separately leased canonical ledger append.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/charter.md`
- `docs/content-studio-program/protocol.md`
- `docs/content-studio-program/candidate-account-slate-20260825.md`
- `docs/pattern-mining-plan.md`
- `docs/content-system-blueprint.md`
- `src/patterns/review-status.ts`
- `src/patterns/review-metadata.ts`
- `src/patterns/review-queue.ts`
- `src/patterns/review-batch.ts`
- `src/patterns/review-session.ts`
- `src/patterns/source-evidence.ts`
- `src/patterns/reviewed-evidence-intake.ts`

## Boundaries

- Write paths: `src/patterns/review-staging.ts`, `src/patterns/review-staging-cli.ts`, their
  matching tests, and `package.json` for one read-only script.
- Forbidden paths: all `data/**`, `content/**`, `config/**`, all other `src/**`, coordinator
  records, and the repository backlog.
- Semantic lock: `patterns:review-staging-projection`.
- Preserve every existing review-status, intake, ledger, pool-comparison, source-evidence, and
  publish gate. The new surface is an adapter, never a replacement authority.

## Acceptance criteria

1. Given an explicit body-free review-status projection, produce a deterministic cohort-only
   staging artifact with the fixed cohort identity and all required human-review fields visible.
2. Reject a count/digest mismatch, raw-body-bearing input, unsupported metadata fields, or a
   cohort member outside the approved snapshot.
3. Preserve blockers and explicit `null`/`unknown` values; do not create a reviewed row,
   canonical ID, pool membership, baseline, comparison-ready account, ranking, or winner claim.
4. Add a read-only CLI script and tests covering valid projection, deterministic order, drift
   refusal, body exclusion, and zero-evidence exclusion.
5. All edits stay in the lease; `npm run check` and the named targeted test suite pass.

## Builder return

Return one commit and a JSON builder report matching `protocol.md`. Include the actual model and
effort in the execution report. Do not edit `work.yaml` or `runs/`.
