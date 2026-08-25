# fiction-job-orchestration-extraction

## Outcome

Extract Fiction-specific job orchestration from `src/review/jobs.ts` into
`src/review/fiction-jobs.ts`, retaining generic queue settlement in `jobs.ts`.

## Dependencies

None. Base: `18ff66d4e0dc2ffbf54bb46a719b8839ca93e9ff`.

## Context paths

- `docs/content-studio-program/charter.md`
- `src/review/jobs.ts`

## Forbidden paths

- `src/review/page.ts`
- `src/review/serve.ts`
- `src/review/fiction.ts`
- `src/fiction/**`
- `stories/**`
- `content/**`
- `data/**`
- `.git/**`

## Write paths

- `src/review/jobs.ts`
- `src/review/fiction-jobs.ts`

## Semantic locks

Preserve Fiction job kinds, IDs, duplicate rules, prompts byte-for-byte, timeouts, selected-engine behavior, artifact verification, git-drift enforcement, scene-beat anchoring, automatic continuity checks, and all existing Fiction engines.

## Builder and auditor

- Builder family: `codex-builder`
- Auditor family: `codex-independent-auditor`

## Acceptance

`npm run check`

## Unresolved decisions

Confirm the adapter shape for private `Job` state and whether `GitState` helpers move with the Fiction module. Keep `settleJob` and the global drain mutex authoritative in `jobs.ts`.
