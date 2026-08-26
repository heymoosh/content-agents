# pattern-local-evidence-inventory-clean-commit

## Outcome

Materialize the existing body-free local-evidence inventory in a commit whose full changed-path
set is exclusively the staging directory. This is a packaging correction, not a new inventory or
an editorial revision.

## Required source

Copy these two files byte-for-byte from commit
`76641280ffae77764a292fea75a093b1813b6bc9`:

- `docs/content-studio-program/staging/local-evidence-inventory-20260825/inventory.json`
- `docs/content-studio-program/staging/local-evidence-inventory-20260825/inventory.md`

Use Git to recover the files. Do not manually rewrite, reinterpret, extend, or recompute the
inventory.

## Boundaries

- Write only `docs/content-studio-program/staging/local-evidence-inventory-20260825/**`.
- Do not edit task packets, run reports, `work.yaml`, `data/**`, `src/**`, `content/**`, or
  `config/**`.
- Do not inspect or reproduce corpus bodies.
- Do not add account rankings, canonical classifications, universal scores, or fresh research.

## Acceptance criteria

- The two staging outputs are byte-identical to their versions at the source commit.
- The full commit changes only the leased staging paths.
- `npm run check`, `npm run patterns:data-status -- --data-dir data/patterns --format json`, and
  `git diff --check` pass.
- The builder returns the exact commit SHA, the complete changed-path list, and actual command
  output summaries.
