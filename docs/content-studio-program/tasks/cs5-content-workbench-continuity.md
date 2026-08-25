# cs5-content-workbench-continuity

## Outcome

Studio's open link for a Content advisor job opens the matching Workbench session when it exists,
instead of routing to a Review item that does not exist until formatting has run.

## Decisions already made

- This is presentation and read-only navigation only. It must not start, retry, approve,
  schedule, publish, or otherwise write anything.
- `develop` and `develop-reply` jobs open the matching Workbench session. If the session is not
  materialized yet, open Content and leave the existing job state honest; do not fabricate an
  artifact.
- Other Content jobs retain their existing Review-queue navigation.
- Preserve durable Studio capture behavior: it remains a local handoff and still waits for an
  explicit next action.
- Preserve extraction-first acceptance, source-line provenance, normal formatting jobs, pending
  review rows, fixture-mode write refusal, and all existing approval gates.
- This does not alter prompts, model routing, generated output, or any content-generation logic.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/charter.md`
- `docs/content-studio-vision.md`
- `src/review/page.ts`
- `src/review/page.test.ts`
- `src/review/studio.ts`
- `src/review/develop.ts`

## Boundaries

- Write paths: `src/review/page.ts`, `src/review/page.test.ts`
- Forbidden paths: all paths listed in the task lease, including `content/**`, `data/**`, server,
  develop, rows, jobs, atomize, and publish modules.
- Semantic locks: `studio:content-workbench-job-continuity` and
  `studio:read-only-content-navigation`.

## Acceptance criteria

1. A `develop` or `develop-reply` job opens Content and targets its matching Workbench piece when
   the piece exists, regardless of whether that job is queued, running, done, failed, or stopped.
2. When no matching session exists, Content opens without a false artifact claim or a write.
3. Existing non-advisor Content job links still navigate to the Review queue.
4. The Workbench remains the visible source-to-advisor-to-cut-to-format path, while Review remains
   a separate, explicit approval step.
5. All edits stay within the lease; `npm run check` and the named review test suite pass.

## Builder return

Return one commit and a JSON builder report matching `protocol.md`. Include the actual model and
effort in the execution report. Do not edit `work.yaml` or `runs/`.
