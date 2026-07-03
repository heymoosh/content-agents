# content-agents — agent notes

Repo-specific notes only. Universal principles live in the global CLAUDE.md — do not duplicate them here.

- Inner loop: verify every change with `npm run check`.
- Behavior gate: run `TODO: e2e/integration command` once, only when user-visible behavior changed.
- Heavy checks (mutation testing, full matrices) are CI-only — never run them locally.
- After pushing, check CI once with `gh pr checks` — don't poll.
- Maturity: when you finish a feature or open a PR (not small fixes), check the next rung in `docs/maturity.md` and propose it if its trigger fires — never auto-apply.
- Living document: when a correction recurs, add the rule here.
