# cs4-signals-recommendation-decisions

## Outcome

Make every Signals recommendation visibly offer Adopt and Decline while retaining Send to backlog. Adopt is an in-memory acknowledgement for the current page session only; Decline removes the card from the active list and shows it under Declined this session. Reloading restores every recommendation.

## Base and dependencies

- Clean base: `13a632e1d59d951da92e57239c0942eb791db098`
- Dependencies: `cs3-studio-durable-handoff`

## Context paths

- `src/review/page.ts`
- `src/review/page.test.ts`
- `src/review/signals.ts`
- `src/review/signals.test.ts`
- `src/review/serve.ts`

## Forbidden paths

- `docs/content-studio-program/work.yaml`
- `docs/content-studio-program/tasks/**`
- `docs/content-studio-program/runs/**`
- `docs/content-agents-backlog.md`
- `STATE.md`
- `content/**`
- `data/**`
- `briefs/**`
- `venture/**`
- `src/review/signals.ts`
- `src/review/signals.test.ts`
- `src/review/serve.ts`
- `src/review/serve-signals.ts`
- policy, routing, configuration, and generation-prompt files

## Write paths

- `src/review/page.ts`
- `src/review/page.test.ts`

## Semantic locks

- Adopt and Decline perform no fetch, POST, file write, local-storage write, cookie write, routing/policy change, generation, send, publish, or review bypass.
- Session state is JavaScript-memory-only and keyed by recommendation type plus title.
- Adopt visibly says it is adopted for this session and that nothing changed.
- Decline is a dismiss, not a permanent decision: it remains visibly represented this session and returns on a fresh reload.
- Send to backlog remains the sole implementation handoff and keeps its existing no-change-until-shipped wording.
- Existing Signals API response shape and recommendation parsing remain unchanged.

## Families and acceptance

- Builder: `codex` (Luna, high)
- Auditor: `grok`
- Acceptance commands:
  - `npm run check`
  - `node --import tsx --test src/review/page.test.ts src/review/signals.test.ts`
- User-visible behavior: yes
- Content-generation logic: no
- Unresolved human decisions: none.
