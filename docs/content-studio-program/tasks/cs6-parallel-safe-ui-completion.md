# cs6-parallel-safe-ui-completion

## Outcome

Complete the remaining parallel-safe Content Studio frontend experience from the authoritative
vision, including a typed fixture-backed viral-recommendation seam and honest blocked states,
without reading raw creator bodies or changing content generation, evidence policy, approval,
scheduling, publishing, or backend engine behavior.

## Decisions already made

- Rehost existing capabilities; do not rebuild the room engines or migrate frameworks.
- The Studio remains calm and conversation-shaped: one capture, one judgment surface, real elapsed
  time, and direct log access.
- Use `Format for platforms` in product copy. `Atomize` must not appear in the rendered UI.
- Content recommendations derived from the new corpus are not available yet. The UI may implement
  typed fixture examples plus `blocked`, `insufficient evidence`, `awaiting review`, and
  `unavailable` states, but it must not load raw corpus Markdown or imply the recipes are live.
- Signals Adopt and Decline remain session-only until a separately reviewed policy task exists.
- Preserve current approval, queue, retry, stop, scheduling, publishing, engine-routing, Venture,
  Fiction, Outreach, Charles, and Signals contracts.
- Use the existing TypeScript/local-server architecture. Do not add React, Tailwind, Tiptap,
  Zustand, TanStack Query, or another application framework.
- Final visual/product review is Muxin's only ordinary gate. A material decision that contradicts
  or is absent from the authoritative vision is a genuine blocker.

## Required context

- `docs/content-studio-program/charter.md`
- `docs/content-studio-program/corpus-ui-reconciliation-20260827.md`
- `docs/content-studio-vision.md`
- `docs/content-studio-reset-handoff.md`
- `docs/content-studio-gemini-review-brief.md`
- `stories/AGENTS.md`
- `venture/AGENTS.md`
- `charles/AGENTS.md`
- `src/review/page.ts`
- `src/review/page.test.ts`
- `src/review/fixtures.ts`
- `src/review/studio.ts`
- `src/review/studio.test.ts`
- `src/review/studio-job-ui.ts`
- `src/review/page-capture.ts`
- `src/review/page-fiction.ts`
- `src/review/page-outreach.ts`
- `src/review/page-signals.ts`

## Boundaries

- Write paths: `src/review/**`, `e2e/**`.
- Forbidden paths: coordinator state and run records; `docs/content-studio-program/creator-content/**`;
  creator study/research policy documents; `data/**`; `config/**`; `content/**`; `briefs/**`;
  `src/patterns/**`; `src/grow/**`; `src/atomize/**`; `src/publish/**`; `src/venture/**`;
  `src/fiction/**`; `src/outreach/**`; `src/charles/**`.
- Semantic locks: `studio:parallel-safe-ui-completion`, `studio:conversation-surface`,
  `studio:fixture-backed-pattern-seam`, `studio:no-generation-change`.
- Never allow two workers to edit `src/review/page.ts` or the same semantic surface concurrently.
- Do not use the shared signed-in Chrome session. Use fixture mode and an isolated local test
  browser/context.

## Acceptance criteria

- Start with a current-vs-vision completion matrix and finish every parallel-safe item it identifies;
  the matrix must distinguish completed, deferred-research-dependent, and genuinely blocked work.
- Studio home, capture, activity, Content Workbench, room navigation, and room-specific state
  presentations match the authoritative vision without exposing internal pipeline plumbing.
- Content shows readable message cuts and uses `Format for platforms` in every rendered user-facing
  label while preserving source-line provenance and human review.
- Outreach surfaces the matchmaker read and follow-up origin context; Fiction, Venture, Charles,
  and Signals preserve their scoped walls and existing state machines.
- Signals keeps attention, conversation, audience, and business outcomes separate and renders
  insufficient-data states honestly.
- Queued, running, blocked, answered, failed, stopped, retryable, done, empty, cold-start, approval,
  scheduling, interruption, and quiet-history states remain inspectable in fixtures and appear in
  the appropriate active surface, interruption, activity, or history location.
- The fixture-backed recommendation seam cannot claim that a corpus mechanism is approved or live;
  no production path reads `creator-content/**`.
- Responsive and keyboard-accessible behavior is covered in the changed surfaces.
- All changed paths remain inside the lease. `npm run check`, the targeted review tests, and one
  local `npm run test:e2e` pass for the completed user-visible batch.
- Return coherent commits plus a builder report; do not merge into main.

## Builder return

Return the final commit and a JSON builder report matching `protocol.md`, with the completed vision
matrix, test evidence, deferred research-dependent items, and manual-review instructions. Do not
edit `work.yaml` or `runs/`, and do not resolve integration conflicts outside this task worktree.

