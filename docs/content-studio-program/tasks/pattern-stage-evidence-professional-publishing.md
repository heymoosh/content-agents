# pattern-stage-evidence-professional-publishing

## Outcome

Produce a body-free, noncanonical reviewed-evidence proposal for the exact 14
professional/publishing accounts and their 70 local source records. Preserve 11 recommend and 3
research-further dispositions. Unsupported Threads metadata remains unknown and the prior
evidence-boundary correction must not be reversed.

## Decisions already made

- Cover only LinkedIn, Substack, Substack Notes, and Threads accounts in the corrected slate.
- Every account and source row stays pending, blocked, or unmapped until consolidated review.
- Keep W, R, B, Body, Repeat, and Meta independent. Do not pool platform metrics or infer
  comparison universes, audience facts, formats, editorial focus, or baselines.
- Preserve null and unknown precisely, especially the corrected Threads unknowns.
- Output body-free identifiers, locators, proposals, provenance, caveats, and blockers only.
- This is staging only: no canonical ledger append, generation, ranking, or publishing.

## Required context

- AGENTS.md and CLAUDE.md
- docs/content-studio-program/charter.md
- docs/content-studio-program/protocol.md
- docs/content-studio-program/staging/corrected-candidate-account-slate-20260825/**
- docs/content-studio-program/staging/local-evidence-inventory-20260825/**
- docs/content-studio-program/staging/broad-pattern-research-20260825/professional-publishing/**
- docs/pattern-mining-plan.md
- docs/content-system-blueprint.md
- package.json
- data/patterns/corpus.jsonl
- data/patterns/analyses.jsonl
- data/patterns/baselines.jsonl
- src/patterns/review-metadata.ts
- src/patterns/source-evidence.ts
- src/patterns/reviewed-evidence-intake.ts
- src/patterns/reviewed-evidence-intake-cli.ts
- src/patterns/reviewed-evidence-ledger-bridge.ts
- src/patterns/reviewed-evidence-ledger-bridge-cli.ts
- src/patterns/account-review-ledger.ts
- src/patterns/source-evidence-ledger.ts

## Required artifacts

Under docs/content-studio-program/staging/reviewed-evidence-staging-20260826/professional-publishing/
create intake-input.json, exact intake-report.json, exact ledger-bridge-report.json, and
decision-packet.md using the same body-free pending proposal contract as the text/community lease.

## Boundaries and acceptance

- Write only the professional/publishing staging directory. Do not edit coordinator state, task
  packets, other staging families, data, content, config, application code, backlog, or STATE.md.
- Semantic locks: pattern:reviewed-evidence-staging:professional-publishing and
  pattern:body-free-local-evidence:professional-publishing.
- Reconcile exactly 14 accounts, 70 source records, no invented baselines, and dispositions 11/3.
- Preserve corrected Threads unknowns and provenance blockers.
- Intake and bridge CLIs must accept artifacts with no side effects or body data.
- npm run check and git diff --check pass.

## Builder return

Return one commit plus a protocol-shaped JSON builder report. Do not edit work.yaml, tasks, or runs.
