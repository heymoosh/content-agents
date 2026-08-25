# studio-scheduling-extraction

## Outcome

Extract approval scheduling dispatch from `src/review/serve.ts` into
`src/review/studio-scheduling.ts`, preserving routing, publisher injection, and approval behavior.

## Dependencies

None. Base: `18ff66d4e0dc2ffbf54bb46a719b8839ca93e9ff`.

## Context paths

- `docs/content-studio-program/charter.md`
- `src/review/serve.ts`

## Forbidden paths

- `src/review/page.ts`
- `src/review/jobs.ts`
- `src/review/rows.ts`
- `src/publish/**`
- `src/outreach/**`
- `content/**`
- `data/**`
- `briefs/**`

## Write paths

- `src/review/serve.ts`
- `src/review/studio-scheduling.ts`

## Semantic locks

Preserve scheduler selection, reuse-guard checks, error strings, approval status behavior, injected test dependencies, `schedulingInFlight` ownership, and existing exports/re-exports. No publisher or review-gate changes.

## Builder and auditor

- Builder family: `codex-builder`
- Auditor family: `grok`

## Acceptance

`npm run check`

`node --import tsx --test src/review/page.test.ts src/review/serve.test.ts src/review/jobs.test.ts src/review/studio.test.ts`

## Resolved decisions

- `serve.ts` retains the compatibility re-exports for `scheduleKind`, `scheduleApproved`, and
  their types.
- Route-owned `schedulingInFlight` remains in `serve.ts`.
