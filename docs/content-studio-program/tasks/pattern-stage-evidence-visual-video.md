# pattern-stage-evidence-visual-video

## Outcome

Produce a body-free, noncanonical reviewed-evidence proposal for the exact 20 visual/video
accounts and their 75 local source records. Preserve 5 recommend, 2 hold, and 13 research-further
dispositions. Caption, transcript, onscreen-text, media, and body-completeness gaps remain explicit.

## Decisions already made

- Cover only Instagram, TikTok, and YouTube accounts in the corrected slate.
- Every account and source row stays pending, blocked, or unmapped until consolidated review.
- Keep W, R, B, Body, Repeat, and Meta independent. Do not infer bodies, transcripts, captions,
  formats, audiences, mechanisms, provenance, or comparison universes.
- Preserve null for not collected/not applicable and unknown only after a checked fact is unresolved.
- Output body-free identifiers, locators, proposals, provenance, caveats, and blockers only.
- This is staging only: no canonical ledger append, generation, ranking, or publishing.

## Required context

- AGENTS.md and CLAUDE.md
- docs/content-studio-program/charter.md
- docs/content-studio-program/protocol.md
- docs/content-studio-program/staging/corrected-candidate-account-slate-20260825/**
- docs/content-studio-program/staging/local-evidence-inventory-20260825/**
- docs/content-studio-program/staging/broad-pattern-research-20260825/visual-video/**
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

Under docs/content-studio-program/staging/reviewed-evidence-staging-20260826/visual-video/ create
intake-input.json, exact intake-report.json, exact ledger-bridge-report.json, and decision-packet.md
using the same body-free pending proposal contract as the text/community lease.

## Boundaries and acceptance

- Write only the visual/video staging directory. Do not edit coordinator state, task packets,
  other staging families, data, content, config, application code, backlog, or STATE.md.
- Semantic locks: pattern:reviewed-evidence-staging:visual-video and
  pattern:body-free-local-evidence:visual-video.
- Reconcile exactly 20 accounts, 75 source records, no invented baselines, and dispositions 5/2/13.
- Keep body/media provenance gaps explicit. No row may be reviewed, canonical, best, or viral.
- Intake and bridge CLIs must accept artifacts with no side effects or body data.
- npm run check and git diff --check pass.

## Builder return

Return one commit plus a protocol-shaped JSON builder report. Do not edit work.yaml, tasks, or runs.
