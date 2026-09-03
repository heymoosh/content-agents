# content-agents — agent notes

This is the agent-agnostic entry point for repository instructions. Read the root `CLAUDE.md`
for the project's full architecture and safety rules, then read the scoped `AGENTS.md` for any
build you are touching:

- `stories/AGENTS.md` — Build 2 fiction rules
- `venture/AGENTS.md` — Build 3 venture rules
- `charles/AGENTS.md` — Build 4 Charles persona rules

The root `CLAUDE.md` remains as a Claude Code compatibility file for now; all scoped build walls
use `AGENTS.md` so any agent can discover them consistently.

- **Orchestration is opt-in only.** For normal requests, reason directly from the user's request,
  named documents, and relevant implementation. Do not invoke or consult triage, planning, card,
  backlog, SimpleKanban, conductor, or related orchestration workflows unless Muxin explicitly
  requests that workflow by name. Do not read or modify the backlog merely because a task could
  become a card. Repository architecture and safety rules still apply.
- Inner loop: verify every change with `npm run check` (typecheck + unit tests).
- Local-first merge gate: the recorded local `npm run check` result is the
  ordinary merge proof. Do not push solely to obtain a hosted test result, and
  do not wait on the manual CI workflow for routine changes.
- Behavior gate: run `TODO: e2e/integration command` once, only when user-visible behavior changed.
- Heavy checks (mutation testing, full matrices) are CI-only — never run them locally.
- After pushing, inspect only retained workflows that were intentionally
  triggered (for example the secret scan); do not poll for routine test CI.
- Maturity: when you finish a feature or open a PR (not small fixes), check the next rung in `docs/maturity.md` and propose it if its trigger fires — never auto-apply.
- Living document: when a correction recurs, add the rule here.

## Keeping the state clean

These bind every agent — Claude, Codex, Grok, or any other — working anywhere in this repository
or its worktrees. They exist because stale state is what actually confuses a later session, and
none of it comes from having a long commit log.

**Commit depth costs nothing. Never rewrite history to reduce noise.** Git materializes only the
tip: check out a branch and the files on disk are the newest version of each file. The commits
behind them do not co-exist with them, do not get read, and do not dilute anything. A later commit
to a file fully replaces the earlier one. Squashing or pruning to "clean up" buys nothing and
destroys the provenance that makes a reversed decision auditable later. Do not offer it, do not do
it unasked.

What actually rots is the working tree and the prose. Three rules, in the order they bite:

1. **One on-disk copy per artifact.** This is the only real poison: the same filename existing
   twice with contradictory content, both greppable, either one reachable by a search. Whenever a
   file appears in two places, ask which one is committed. The uncommitted one is either newer
   (commit it) or stale (delete it). Never both. A variant that needs to survive belongs on a
   branch, never as an untracked shadow beside the committed file.
2. **Nothing valuable stays uncommitted.** Untracked work is the only work git cannot recover — a
   `git clean` destroys it irrecoverably, and nothing warns you first. Committing early is the
   protection and it is cheap. `git status --short` showing untracked source files is the smell;
   commit them, even as work in progress, rather than leaving them stranded. This is the opposite
   of pruning: the fix is more commits, sooner.
3. **When a decision reverses, edit the sentence that states it.** A file is overwritten by its
   successor; a sentence is not. A document that still asserts a retired gate stays wrong until
   somebody edits that assertion, and appending a correction underneath leaves both claims live and
   equally readable. Edit the claim in place. Where the superseded fact is still worth keeping,
   keep it labelled — "retired as of <date>, diagnostic only" — so the record survives and cannot
   be mistaken for the current rule. `docs/content-studio-master-status.md` and
   `docs/content-room-alignment-plan.md` are the two documents most likely to need this.

Two consequences for how work is arranged:

- **Leave the primary checkout on `main`.** Do feature work in a branch or worktree. A primary
  checkout sitting on a feature branch makes "which version is current?" genuinely hard to answer
  for the next session that opens the repository cold.
- **A planning document that lives only on an unpushed branch is invisible to anyone reading
  `main`.** Land decision records promptly, or say plainly which branch holds the current one.

## Bounded verification contract

For context-heavy or authenticated model workflows, keep proof of behavior separate from adjacent
hardening. Fix the verification budget before work begins (normally one authenticated canary per
workflow and at most one retry), and use this order:

1. Run an early `claude -p` architecture/threat review when private-repository export has been
   authorized for the session.
2. Run focused red/green tests, then a fake-model end-to-end orchestration test.
3. Run the cross-family security audit before the authenticated canary. Auditors must classify each
   finding as introduced blocker, pre-existing problem, or optional hardening.
4. Fix P0/P1 findings only. Record P2 hardening unless it directly threatens data or invalidates
   the canary.
5. Run one isolated authenticated canary, with at most one retry.
6. Run `npm run check` once, at the end, then commit or stop.

The disposable harness must isolate Git, operational data, secrets, ports, and model permissions.
Preserve successful model output when later validation fails. Keep long-command updates to concise
progress/final summaries. Time-box a newly discovered adjacent issue to 30 minutes; if it cannot be
resolved within that window, stop with evidence and ask before broadening scope.

## Repository delivery policy

- This is a private, local-first repository. The declared merge gate is
  `npm run check`, recorded in `.orch/config.toml` and exposed through
  `.repo-policy/check`.
- Ordinary lint, typecheck, unit tests, quality checks, and builds run locally.
  Do not add a pull-request or push-triggered GitHub Action merely to repeat
  them. The existing `ci.yml` workflow is a manual diagnostic only.
- Retain hosted Actions only for a concrete external need such as security
  scanning, scheduled dependency review, publishing, or a real production
  deployment.
- This repository currently has no Vercel production project. Do not add
  `vercel.json` or a Vercel workflow solely for policy compliance. The delivery
  path is merge to `main`, then run the tool locally as documented in README.
- If a Vercel production project is introduced, set
  `git.deploymentEnabled: false`. Any production deployment workflow must be
  triggered only by tags matching `v*`, never by pull requests or ordinary
  pushes to `main`.

## Machine facts (this Mac) — any agent, any vendor

Hard-won on 2026-07-17; these are properties of Muxin's machine, not of any one AI tool.

- **System `grep` is ugrep 7.5.0**, not BSD grep. Its `-q -v` combination exits 1 even when
  lines ARE selected (three CI-grade false failures before a fixture autopsy caught it). Never
  combine `-q` with `-v` in scripts here — use count-then-test:
  `n=$(... | grep -icv PAT || true); [ "${n:-0}" -gt 0 ]`.
- **No coreutils `timeout` binary exists.** Scripts needing a wall-clock cap must ship a shim
  (see `~/.claude/verify/run-canary.sh` for a perl `alarm` fallback with the same exit-124 contract).
- **`git pull` output lies when piped through `tail`/`head` on a checkout with local mods:**
  the "Updating a..b" line prints BEFORE a would-be-overwritten abort, so a filtered pull looks
  successful while deploying nothing (eight merges silently undeployed once). Verify with
  `git status -sb` (look for "behind") or check a merged file exists on disk.
- **Do not diagnose macOS TCC from `EPERM` alone.** First identify the denied operation: sandboxed
  port binding, process inspection, networking, and out-of-workspace writes can also return
  `EPERM`. Treat it as a possible Files & Folders problem only when the denied operation names a
  path under `~/Documents` and both a direct read of a known file and a narrowly scoped write probe
  fail inside a workspace that Codex declares writable. Then stop and ask the human to re-Allow
  the host app under System Settings → Privacy & Security → Files & Folders (never Full Disk
  Access) and fully restart that host process. Otherwise, handle the specific denied operation
  through the normal sandbox approval path.
- **Board writes:** only through `prose_kanban` (coordinator / `locked_rewrite`) — never edit
  `docs/content-agents-backlog.md` as text. The board's merge machinery treats direct edits as a
  guardrail violation.

## Live-verification harness lives elsewhere

The live-verification harness (hermetic fixture test + bounded live canary, gated behind
`CANARY_I_MEAN_IT`) is canonical in the `claude-config` repo at `~/.claude/verify/`
(`run-fixture-test.sh`, `run-canary.sh`) — this repo deliberately has no `verify/` tree of its own.
Machinery PRs opened here that cite harness evidence should reference it by that path; don't expect
or add a local copy.
