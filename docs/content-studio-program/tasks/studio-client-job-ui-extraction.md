# studio-client-job-ui-extraction

## Outcome

Extract Node-side pure job UI types/helpers from `src/review/page.ts` into
`src/review/studio-job-ui.ts` without changing browser output or behavior.

## Dependencies

None. Base: `18ff66d4e0dc2ffbf54bb46a719b8839ca93e9ff`.

## Context paths

- `docs/content-studio-program/charter.md`
- `src/review/page.ts`

## Forbidden paths

- `src/review/serve.ts`
- `src/review/jobs.ts`
- `src/review/fixtures.ts`
- `src/review/engines.ts`
- `content/**`
- `data/**`
- `config/**`
- `src/venture/**`
- `src/fiction/**`
- `src/charles/**`

## Write paths

- `src/review/page.ts`
- `src/review/studio-job-ui.ts`

## Semantic locks

Preserve job-room mappings, labels, colors, timing, status handling, HTML output, inline client mirrors, and the no-build/no-request page architecture. No content-generation changes.

## Builder and auditor

- Builder family: `codex`
- Auditor family: `grok`

## Acceptance

`npm run check`

`node --import tsx --test src/review/page.test.ts src/review/serve.test.ts src/review/jobs.test.ts src/review/studio.test.ts`

## Resolved decisions

- The module is `src/review/studio-job-ui.ts`.
- Client-side helpers remain inline because the browser script is emitted as a string fragment and
  there is no safe shared runtime boundary in this tranche.
