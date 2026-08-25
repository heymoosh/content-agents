# pattern-professional-evidence-boundary-correction

## Outcome

The three access-blocked Threads rows in the noncanonical professional-publishing package contain
only source-supported facts. Their topic, focus, medium, format, niche assessment, and pool
rationale are explicit `unknown`/not assessed rather than claims based on a catalog key or known
editorial reputation.

## Decisions already made

- Correct only `threads|danidonovan`, `threads|rowancheung`, and `threads|thedankoe`.
- Their first-party profile URLs were access-limited; no account identity beyond the seed key, no
  topic, focus, medium, format, audience, metric, baseline, or pool claim is supported by the
  retained evidence.
- Preserve each source ID/URL, blocked status, date, access caveat, `research further`
  recommendation, zero body fields, and all non-Threads rows exactly as they are.
- Do not fetch new sources, inspect raw corpus data, use model knowledge, or infer from a handle.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/broad-pattern-research-policy-20260825.md`
- `docs/content-studio-program/tasks/pattern-research-professional-publishing.md`
- the four staging artifacts named in `work.yaml`

## Boundaries

- Write only `docs/content-studio-program/staging/broad-pattern-research-20260825/professional-publishing/**`.
- Do not change `data/**`, product code, coordinator records, or another staging package.

## Acceptance criteria

1. The three named Threads rows have no unsupported editorial-focus/topic/medium/format/pool
   claim in JSON or Markdown; their evidence fields accurately say access was limited.
2. All 14 seed keys, source URLs, source caps, body-free behavior, recommendation vocabulary, and
   every non-Threads row remain unchanged.
3. `npm run check`, the packet manual-platform report command, and `git diff --check` pass.

## Builder return

Return one commit and a protocol-shaped report with actual model/effort. Do not edit `work.yaml`
or `runs/`.
