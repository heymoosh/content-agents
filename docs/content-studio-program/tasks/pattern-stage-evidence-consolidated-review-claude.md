# pattern-stage-evidence-consolidated-review-claude

## Outcome

Produce one compact, body-free morning review package that reconciles the text/community,
professional/publishing, and visual/video staging lanes without reclassifying, ranking, or
advancing any row past pending or blocked.

## Fixed facts

- The lanes contain exactly 65 disjoint account keys, 499 actual source-evidence rows, and 12
  actual baseline rows: `31 + 14 + 20`, `354 + 70 + 75`, and `12 + 0 + 0`.
- Staging proposals total 30 recommend, 8 hold, and 27 research-further. These remain proposals,
  not reviewed dispositions.
- No account or source is canonical, best, viral, a winner, or authorized for content generation.
- Do not start until all three Claude staging tasks are integrated in `work.yaml`.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/charter.md`
- `docs/content-studio-program/protocol.md`
- `docs/content-studio-program/tasks/pattern-reviewed-metadata-input.md`
- Each lane's `decision-packet.md`, `intake-report.json`, and `ledger-bridge-report.json` under
  `docs/content-studio-program/staging/reviewed-evidence-staging-claude-20260826/`.

Do not read raw `data/patterns/**`, other vision documents, the backlog, or creator bodies.

## Outputs

Write only under
`docs/content-studio-program/staging/reviewed-evidence-staging-claude-20260826/consolidated-review/`:

1. `summary.json`: per-lane and total account, evidence, baseline, readiness, and proposal counts;
   the exact 65 account keys; and an explicit zero-duplicate reconciliation.
2. `morning-review.md`: a compact status table, links to all three lane packets, and a plain
   explanation of what this review does and does not authorize.
3. `verified-facts-vs-unknowns.md`: verified body-free facts separated from identity, topic, pool,
   audience, scope, provenance, completeness, and baseline gaps that remain unreviewed.
4. `decision-sheet.md`: a human-editable approve, narrow, or hold choice for each lane; the open
   pool and metadata questions carried from the lane packets; and blank answer fields.

State this null rule once in the decision sheet: leave a field blank or `null` when not answering
it now. Blank never means false, excluded, or reviewed.

## Lease

- Write path:
  `docs/content-studio-program/staging/reviewed-evidence-staging-claude-20260826/consolidated-review/**`
- Semantic locks: `pattern:consolidated-review-claude` and
  `pattern:body-free-local-evidence-claude:consolidated`.
- Builder family: Claude. Auditor family: Codex.
- Do not edit the three source lanes, coordinator state, task packets, run records, code, config,
  content, canonical data, the backlog, or `STATE.md`.

## Acceptance

1. `npm run check`
2. Run a deterministic Node reconciliation that reads all three `intake-report.json` files and
   asserts 65 accounts, 499 evidence rows, 12 baselines, 30 recommend, 8 hold, 27
   research-further, exactly 65 unique account keys, and zero duplicates in `summary.json`.
3. `git diff --check`
4. A Codex audit confirms that every new number traces to the three lane artifacts and that the
   package contains no raw body, ranking, winner, reviewed, canonical, or generation claim.

## Human decisions requested

1. Approve, narrow, or hold each lane's proposed slate as input to reviewed metadata.
2. Answer or defer each lane's open niche, broad, format, community, creator, and Threads pool
   questions.
3. Decide whether a later, exclusive steward may resolve stable account IDs, account references,
   and baseline numerator or denominator gaps from canonical local data.
4. Mark each lane ready to proceed to `pattern-reviewed-metadata-input`, or request one bounded
   correction pass.

This task never writes reviewed metadata or canonical ledgers. Those remain behind Muxin's answer.
