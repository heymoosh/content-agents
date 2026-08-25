# cs3-studio-durable-handoff

## Outcome

Make Studio capture durable across navigation and reload, route it to the owning room as an explicit next action, and surface pending capture work across the six rooms in Studio's judgment view. A capture must never silently start generation, send, publish, or policy changes.

## Base and dependencies

- Clean base: `62d83251bb5a101ac6bc211bfae9dff316efcb9a`
- Dependencies: none

## Context paths

- `docs/content-studio-vision.md`
- `src/review/page.ts`
- `src/review/studio.ts`
- `src/review/studio-job-ui.ts`
- `src/review/page.test.ts`
- `src/review/studio.test.ts`

## Forbidden paths

- `docs/content-studio-program/work.yaml`
- `docs/content-studio-program/tasks/**`
- `docs/content-studio-program/runs/**`
- `docs/content-agents-backlog.md`
- `STATE.md`
- `content/**`
- `data/**`
- `config/**`
- `src/venture/**`
- `src/fiction/**`
- `src/outreach/**`
- `src/review/jobs.ts`
- `src/review/serve-fiction.ts`
- `src/review/serve-charles.ts`
- `src/review/serve-signals.ts`

## Write paths

- `src/review/page.ts`
- `src/review/serve.ts`
- `src/review/studio.ts`
- `src/review/page.test.ts`
- `src/review/studio.test.ts`

## Semantic locks

- `studio:capture-handoff`
- `studio:judgment-surface`
- Preserve the explicit bare-link Content-versus-Signals question.
- Preserve real job elapsed time and log links.
- Captures await Muxin's next explicit action; they never start generation, send, publish, or policy changes.
- No content-generation logic change.

## Families and acceptance

- Builder: `codex`
- Auditor: `grok`
- Acceptance commands:
  - `npm run check`
  - `node --import tsx --test src/review/page.test.ts src/review/studio.test.ts`
- User-visible behavior: yes
- Content-generation logic: no
- Unresolved human decisions: none. A capture is a durable handoff awaiting explicit next action.
