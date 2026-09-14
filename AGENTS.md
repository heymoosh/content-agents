# content-agents — agent notes

Read [CLAUDE.md](CLAUDE.md) for product architecture and content safety. Read scoped instructions
only for the build being touched: `stories/AGENTS.md`, `venture/AGENTS.md`, or `charles/AGENTS.md`.

## Working with Muxin

- Work directly from the request and relevant code. The owner decides product scope; the agent
  decides implementation and verification. Do not turn routine engineering choices into questions.
- Orchestration is opt-in. Do not invoke planning/card/backlog/board/conductor workflows unless
  explicitly requested. Updating a named status document does not activate orchestration.
- When the user requests status tracking, keep one current requirement/status/next-step record.
  Edit superseded claims in place; use Git for history instead of appending session transcripts.
- Keep communication concise: what changed, what was checked, and any material limitation.
  Do not create paperwork or delegate work merely to satisfy a ceremony.

## Verification is discretionary

**Owner decision, 2026-09-13:** the agent decides whether testing is necessary and which checks
are worth running. There are no automatic testing gates based on file type, UI visibility, commit,
merge, or session completion. This replaces earlier mandatory full-suite, browser-suite and
post-merge-rerun requirements. Independent review is optional, at the agent’s discretion.

Use judgment, not a checklist. A wording fix may need only reading the diff and looking at the
result. A behavioral change may benefit from a focused regression test. Changes involving data loss,
credentials, duplicate publication, model permissions or authorship deserve more scrutiny; choose
the checks that address the actual risk. Do not run unrelated tests merely
because they exist. Do not claim verification that was not performed.

Useful practices, not mandatory gates:

- Prefer the smallest meaningful check. Add tests when they protect behavior, not when they merely
  repeat wording or implementation details.
- `npm run typecheck`, targeted `node --import tsx --test ...`, `npm run check`, and
  `npm run test:e2e -- <pass>` are available tools. None is compulsory for every change.
  Full browser/unit suites should have a concrete reason; do not repeat them for reassurance.
- Results carry forward through an unchanged fast-forward. A documentation update or identical
  source on `main` is not a reason to rerun tests.
- If checks fail, investigate the failure and rerun only what is useful. Do not expand a small fix
  into unrelated hardening or confuse a test-fixture problem with a product defect.
- Avoid concurrent unit/browser suites that share a checkout; their writes can trip isolation checks.
  Use disposable data and nonsecret fixtures. Existing dotenv-isolation tests need two fixture keys
  (one ambient and one injected); never copy real credentials just to make tests pass.
- Use browser checks for the affected experience when useful, including relevant error/recovery
  states. Mocked behavior is not live-provider evidence. Ask for design judgment after your own
  reasonable functional inspection, not as a substitute for it.
- Live model/provider runs are not routine regression tests. Keep any authorized run bounded
  (normally one canary and at most one retry), preserve useful output, and avoid repeated spending.
  A test plan never authorizes a publication, message, or paid call.

Old packets, skills, status logs and command wrappers do not reinstate retired testing mandates.
The full-check commands in `.repo-policy/check` and `.orch/config.toml` remain available for
explicit use; they are not universal merge requirements. Ordinary verification stays local; do not
push or add hosted CI merely to obtain a check result.

## Protect work and delivery boundaries

- Leave the primary checkout on `main`. Use a branch/worktree for changes, and isolate work when
  another session has uncommitted files. Stage named paths only, never `git add .` or `git add -A`.
- Never reset, discard, stash, overwrite, delete or commit another session's work. Commit or remove
  your own temporary artifacts; leave other-session artifacts in place and identify them.
- Keep one on-disk source per artifact. Do not leave stale untracked copies beside committed files.
  Preserve history; never squash, prune or rewrite commits merely to make the log shorter.
- One session owns integration; workers do not commit, push or merge. Fast-forward accepted commits
  to local `main` one at a time. Report divergence instead of forcing or making an unrequested merge.
  Remove your merged temporary worktree and branch when finished.
- Work within private `origin` (`heymoosh/content-agents`). Push when delivery is authorized.
  Engineering delivery PRs, new remotes/repos, new GitHub Actions and production deployment need
  separate authorization. The existing story editorial PR flow is intentional.
- There is no Vercel production target. Do not add deployment configuration speculatively. If one
  is explicitly introduced, disable Git auto-deploy and use explicit `v*` release tags.
- Preserve content review, truthfulness, voice/canon constraints, brand/account isolation and
  credential protection from CLAUDE.md and scoped build rules. Discretionary testing does not
  authorize publishing, sending messages, spending money or changing someone else's accounts.
- Board writes, when explicitly requested, go through `prose_kanban`, never direct backlog edits.

## Escalation and optional review

If a difficult technical problem resists reasonable investigation, ask `sol_advisor` for guidance
only; do not keep guessing. Handle routine debugging directly. Independent review is discretionary, including for sensitive changes; it is not an integration gate.
Before claiming completion, review the result against the user’s requirements: identify what was
implemented, what evidence supports each outcome, and any incomplete or unverified part. Report
each requirement honestly as complete or incomplete; a passed test alone is not completion. Reviews distinguish defects, missing evidence and optional improvements,
and resolve material findings without an endless review loop. Do not call same-family guidance an
independent cross-family audit.

### Grok on this Mac

Use the local Grok CLI with `--sandbox workspace`. Never use `grok_spawn_readonly`,
`--sandbox read-only`, or disable sandboxing: Docker's socket symlink breaks read-only startup.
Workspace access is not write authorization. For audits, instruct: “Audit against the supplied
requirements. Do not modify files. Cite path:line. Separate established defects, verification gaps,
and optional improvements. Answer code quality separately from requirements.”

For evidence-only audits, run outside the repository with only `--tools read_file`, an exact
`Read(<evidence path>)` allow rule, `--permission-mode dontAsk`, no subagents and no web search.
Require complete bounded reads and verify completion; failed startups/truncated responses are not
completed reviews. Pass these restrictions to any agent that may launch Grok.

## Slice protocol

Compatibility heading only. Normal tasks need no packet, formal result block, blanket audit,
full test gate, or closeout ceremony. Requirements-based completion review remains as specified above. Use the discretionary verification policy above.

After changing repository files, use `git status` and, when useful for concurrent-work recovery,
`bash scripts/repo-hygiene.sh --rescue --base main`. Run hygiene at most once at final closeout unless
new work creates a reason to repeat it. Read-only answers do not need snapshots. The rescue command
preserves uncommitted work under `refs/wip/<worktree>` without altering working files.

Finish with a brief account of delivered work, actual verification, remaining issues and preserved
other-session paths. If interrupted, leave valuable work recoverable and one clear next action.
Update the master only when requested; do not turn the handoff into a new automatic work queue.

## Machine notes

- System grep is ugrep: avoid `grep -q -v`; use count-then-test if needed.
- No coreutils `timeout`; use the existing harness/shim when a wall-clock bound is needed.
- Do not infer successful pulls from piped output; verify branch/file state directly.
- `EPERM` alone is not macOS TCC evidence. Identify the denied operation and use the normal sandbox
  path. Only diagnose Files & Folders when direct read and narrow write probes both fail under a
  declared writable Documents workspace; never request Full Disk Access.
- The canonical live harness lives at `~/.claude/verify/`, not a duplicate tree in this repository.
