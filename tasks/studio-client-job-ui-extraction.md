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

- Builder family: `codex-builder`
- Auditor family: `codex-independent-auditor`

## Acceptance

`npm run check`

## Unresolved decisions

Confirm the module name. Keep client-side inline helpers duplicated unless a safe string-fragment boundary is established.
