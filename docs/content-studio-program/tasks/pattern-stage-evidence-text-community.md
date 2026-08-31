# pattern-stage-evidence-text-community

## Outcome

Produce a body-free, noncanonical reviewed-evidence proposal for the exact 31 text/community
accounts and their 354 local source records. Preserve the corrected slate's 14 recommend, 6 hold,
and 11 research-further dispositions without converting them into reviewed status, pool winners,
or canonical facts. Preserve the 12 existing Reddit baseline artifacts as staged facts only.

## Decisions already made

- Cover only Bluesky, Dev.to, Hacker News, Mastodon, Reddit, and X accounts in the corrected
  65-account slate. Do not add or remove accounts.
- A staging recommendation is not a reviewed metadata decision. Every account, source, and
  baseline row stays pending, blocked, or unmapped until Muxin's consolidated review.
- Keep W, R, B, Body, Repeat, and Meta independent. Never turn a source-listing winner flag into
  an account winner, or a local comparator into a universal baseline.
- Preserve null for not collected/not applicable and unknown only after a checked fact cannot be
  resolved. Do not infer metadata, provenance, completeness, or comparison scope.
- Output body-free identifiers, locators, metadata proposals, provenance, caveats, and blockers
  only. Never copy creator bodies, captions, transcripts, titles, hooks, or examples.
- This is staging only: no canonical ledger append, generation, ranking, or publishing.

## Required context

- AGENTS.md and CLAUDE.md
- docs/content-studio-program/charter.md
- docs/content-studio-program/protocol.md
- docs/content-studio-program/staging/corrected-candidate-account-slate-20260825/**
- docs/content-studio-program/staging/local-evidence-inventory-20260825/**
- docs/content-studio-program/staging/broad-pattern-research-20260825/text-community/**
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

Under docs/content-studio-program/staging/reviewed-evidence-staging-20260826/text-community/ create:

1. intake-input.json: deterministic pending account, source-evidence, and baseline proposal rows
   accepted by the existing intake contract, all with bodyIncluded false.
2. intake-report.json: exact JSON output of the intake CLI.
3. ledger-bridge-report.json: exact body-free bridge output. Do not execute a ledger writer.
4. decision-packet.md: reconciliation, provenance and baseline gaps, pool-choice questions, and
   exact human decisions, explicitly stating that no row is reviewed or canonical.

## Boundaries and acceptance

- Write only the text/community staging directory. Do not edit coordinator state, task packets,
  other staging families, data, content, config, application code, backlog, or STATE.md.
- Semantic locks: pattern:reviewed-evidence-staging:text-community and
  pattern:body-free-local-evidence:text-community.
- Reconcile exactly 31 accounts, 354 source records, 12 baseline rows, and dispositions 14/6/11.
- Intake and bridge CLIs must accept committed artifacts with no side effects or body data.
- Identifiers and arrays are deterministic and duplicate-free; unknowns remain explicit.
- npm run check and git diff --check pass.

## Builder return

Return one commit plus a protocol-shaped JSON builder report. Do not edit work.yaml, tasks, or runs.
