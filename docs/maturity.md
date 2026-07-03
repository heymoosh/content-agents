# Maturity ladder

Current stage: 0
<!-- Agent: update the line above when a rung's actions are completed. -->

Agent protocol: at the end of substantive work — a finished feature or an
opened PR, never small fixes or docs changes — check ONLY the next rung's
TRIGGER (current stage + 1). Triggers are cheap file/git lookups; never run
builds or tests to evaluate them. If the trigger fires, propose once:
"This repo looks ready for Stage N: <action>. This PR or a follow-up?"
Never auto-apply. At most one proposal per session. If declined, add
`Declined <date>: <reason>` under that rung and do not re-propose for two
weeks or until conditions visibly change.

## Stage 0 — prototype / spike (where every repo starts)
Inner loop only (`check` on every change). Deliberately absent: CI, e2e,
coverage, error tracking. Resist adding them early.

## Stage 1 — first deploy / real users
TRIGGER: a deploy config exists (`vercel.json`, `.vercel/`, `netlify.toml`,
`fly.toml`, or a deploy/release workflow under `.github/workflows/`) AND no
workflow runs the inner-loop check on PRs.
ACTION:
- CI workflow running the inner-loop check on every PR; ask the user to mark
  it a required check (repo Settings → Branches).
- One e2e smoke test covering the single most important user flow
  (web: Playwright); wire it as the `e2e` script — this becomes the
  behavior gate named in AGENTS.md.
- Error visibility: confirm where to look when production breaks (platform
  logs are enough); propose alerting (e.g. Sentry) only if asked.

## Stage 2 — growing codebase
TRIGGER: Stage 1 complete AND (≥ 25 source files OR ≥ 10 test files —
count with `git ls-files`).
ACTION:
- Mutation testing (JS/TS: Stryker), CI-only, using the skip-pass pattern:
  (1) the job always fires on PRs so it can be a required check without
  deadlocking docs-only PRs; (2) a dorny/paths-filter step INSIDE the job
  gates the heavy steps — unmatched PRs exit 0 in seconds with a ::notice;
  (3) nightly cron + workflow_dispatch run the full scope so PR-time skips
  cannot hide drift; (4) concurrency with cancel-in-progress.
- Coverage reporting in CI (report only; ratchet a threshold later).
- Dependency hygiene: Dependabot/Renovate, or a weekly `npm audit` CI job.
- Write `docs/testing.md`: the three-tier table (inner loop / behavior gate /
  CI-only heavy) with this repo's real commands.

## Stage 3 — collaborators or production-critical
TRIGGER: ≥ 2 human commit authors in the last 90 days
(`git shortlog -sne --since="90 days ago"`) OR the user states that real
users depend on this in production.
ACTION:
- Branch protection on main: require PRs and the existing CI checks;
  squash-merge as the default.
- Security cadence: run a security review on any PR touching auth, secrets,
  or data handling, before merge.
- Rollback note in README: exact steps to revert a bad deploy on this platform.

Beyond Stage 3: new durable practices arrive as new rungs (see the starter
kit's maintenance ritual). This file is a living document.
