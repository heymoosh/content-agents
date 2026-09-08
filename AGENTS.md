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

This is the detailed budget for live and authenticated model work only. The general per-slice
procedure is `## Slice protocol` below, which is self-contained and restates the budget line a
worker needs; this section expands it and does not compete with it.

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

<!-- BEGIN PORTABLE PROTOCOL -->

## Slice protocol

### Grok CLI on this Mac

Docker Desktop makes `/var/run/docker.sock` a symlink. Grok `--sandbox read-only`
refuses to start on this machine. Use `--sandbox workspace` for Grok calls, including
audits; do not call `grok_spawn_readonly`. If a plugin is required, use
`grok_spawn_worker` only when it supports an explicit `sandbox=workspace` argument.

For a bounded audit, run from the intended checkout or disposable audit directory:

```sh
grok --sandbox workspace --no-subagents --disable-web-search --max-turns 3 --model grok-4.5 --prompt-file /absolute/path/audit-prompt.txt
```

The prompt must say: "Audit against the supplied requirements. Do not modify files.
Cite path:line. Separate established defects, verification gaps, and optional improvements."
Supply the acceptance criteria, candidate diff, changed-file list and focused check output;
request bounded excerpts for missing evidence. Workspace sandbox is not read-only enforcement:
inspect the diff afterward and never treat the sandbox choice as permission to edit.
Keep the input bounded; if Grok offloads a long prompt, allow enough turns to read it and
finish the audit. Verify exit status and an actual verdict before reporting audit completion.
This launch fix does not expand repository-export or implementation authorization.


This section is the frozen procedure, and it is self-contained on purpose. Session prompts stay
short because they point here. A coordinator that reads only this section, the master document's
`## START HERE` block, and one slice packet has everything it needs. Nothing in this
section depends on reading any other part of this file, and every way a session can end is
described here.

### Repo bindings

This table is the only part of the protocol that changes between repositories. Everything below
it is repository-neutral.

| Binding | This repository |
| --- | --- |
| Repository root | the worktree you were launched in — never `cd` to another checkout |
| Master document | `docs/content-studio-master-status.md` |
| Slice packets | `docs/operations/launch-slices/SLICE-<ID>.md` |
| Packet template | `docs/operations/launch-slices/SLICE-TEMPLATE.md` |
| Repository-wide gate | `npm run check` (typecheck + unit tests). Run it unsandboxed — under the sandbox it reports roughly 196 phantom venture failures. In a fresh worktree run `npm run worktree:setup` once first, or every command fails on missing `node_modules`. |
| Hygiene command | `bash scripts/repo-hygiene.sh --rescue` |
| Closeout gate | none — record `PASS` or the leftover list in the slice packet |
| Integration rule | one coordinator, one reviewed commit at a time, a passing gate on the candidate before each integration commit |
| Delivery boundary | branch `main`, remote `origin` (`heymoosh/content-agents`). Merge is local-first: the recorded local gate result is the merge proof. Hosted CI is a manual diagnostic — never push merely to obtain a CI result. |
| Non-negotiable product rules | Extraction-first: never compose new claims, arguments, or worldview statements in Muxin's voice; text and image derivatives quote and trim verbatim and carry `source_lines`. The scoped exceptions (Content Studio treatments, common hook templates, video scripts, Build 3 Venture, Build 4 Charles) are enumerated in the root `CLAUDE.md` and never widen. Nothing publishes without Muxin's review in `review-queue.md`; committing generated content is not publishing. Generated copy follows `config/voice.yaml` — no em dashes, no AI tells. Prefer subscription and free model routes; every paid call is opt-in and logged to `data/cost-log.csv`. Never edit `docs/content-agents-backlog.md` as text — board writes go through `prose_kanban` only. |
| Live or authenticated model slices | Fix the verification budget before starting: normally one authenticated canary per workflow and at most one retry. Isolate Git, operational data, secrets, ports, and model permissions in a disposable harness. Preserve successful model output when later validation fails. |
| Machine facts that bite | System `grep` is ugrep 7.5.0: never combine `-q` with `-v` — count then test. There is no coreutils `timeout` binary. `git pull` piped through `tail`/`head` prints "Updating a..b" before a would-be-overwritten abort, so verify with `git status -sb`. |

The master document is the single source of truth for status and decisions. Its `## START HERE`
block is the only part a new session reads.

### Roles

- **Coordinator** — the session the owner talks to. Reads this section, the master document's
  `## START HERE` block, and the current slice packet. Nothing else. It does not load the
  repository "for context" and it does not implement. Under the integration rule it is the only
  role that commits or integrates, one reviewed commit at a time.
- **Worker** — a subagent the coordinator spawns. Reads this section and exactly one slice
  packet. It implements, runs the packet's declared checks, and returns a `RESULT BLOCK`. It
  never commits.
- **Auditor** — a subagent from a different model family than the builder. Receives the slice's
  acceptance criteria, the candidate diff, the changed-file list, and the focused check output.
  It never receives the master document, the repository tree, or a worker transcript. If that
  packet cannot establish a claim, it names the missing evidence or requests a bounded excerpt
  rather than inferring that unseen code is correct or defective.

The read limit governs *starting context* — what you load before doing the work. It never blocks
evidence the session itself produces. The coordinator always reads worker `RESULT BLOCK`s, the
candidate diff and its changed-file list, check and gate output, audit findings, and hygiene
output, plus any file the current slice packet names as owned or cited. Reading those **is** the
review this protocol requires, not a departure from it.

A bigger sibling of the builder is not independent review. Never silently substitute a
same-family audit; if cross-family tooling is unavailable, say so and stop.

### Slice packet contract

A slice is the smallest thing that is demonstrably done, not the smallest thing that can be
described. Every packet records: goal, difficulty, dependencies, owned files, files not to
touch, acceptance criteria, the focused verification commands, the observable result, risk and
whether an audit is required, and the builder and auditor families. Copy the packet template
named in the bindings; do not invent a different shape. Handing a worker a packet always
includes this protocol section — "only that packet" bounds what else the worker may read, not
whether it receives the rules.

Prefer parallel work, but only where it is provably safe. Workers share one working tree — they
are concurrent processes on the same files, not isolated copies — so parallelism is safe only
when the lanes cannot touch. Split the owned files into the largest number of lanes for which
**all three** hold, and state in the packet that they hold:

- No path appears in two lanes, and no lane creates, moves or deletes a path inside another
  lane's directories.
- No lane runs a repo-wide command that rewrites files — formatters, codegen, migrations,
  `--fix` linters. Those belong to the coordinator, after every lane has finished.
- Each lane's focused verification reads and writes only its own files.

If any of the three cannot be shown, run the lanes one at a time. Serial is the safe fallback
and needs no justification; a single-lane packet states in one line why the work does not
divide. Conflicting edits and all integration are always serialized, and workers must preserve
other sessions' changes.

### Writing a missing packet

If the START HERE block names a slice packet that does not exist, writing it **is**
coordination, not a departure from the read limit. Without asking permission, the coordinator
may read exactly these and nothing more:

- the packet template named in the bindings;
- the master document's standing-constraints or non-negotiables section, if it has one;
- any heading in the master document that START HERE names;
- a design spec that START HERE or the slice sequence names, limited to that slice's own
  section plus the spec's dependency / running-order section.

Draft the packet from those, then proceed. Stop for the owner only when the slice's goal or
acceptance criteria are genuinely undecided. Permission to read a named input is not a decision
and must not be escalated as one; the owner decides scope, not method.

### Model routing

Start each kind of work on the model that is best at that kind of work *in one shot*, not the
cheapest that might pass. Cost-effective means the least total tokens to *verified* completion,
counting missed requirements, retries, audits, and repairs — not the price of one attempt.

- Coordination, slice boundaries, acceptance calls, integration decisions: strong model.
- Bounded reading, inventories, mechanical edits, status writing: lighter model.
- Difficult or high-stakes implementation: strong model.
- Claude for frontend and Codex for backend are defaults, not rules.

Usage limits override every routing preference. When one hits, record status in the master
document first, then stop.

### Worker contract

A worker returns a compact `RESULT BLOCK` and nothing else: changed paths, outcome, checks run
with their results, evidence locations, and unresolved items. Do not relay worker transcripts
and do not re-summarize the plan; cite section headings instead.

### Completion sequence

Run in this order. Do not start an expensive repository-wide gate while known audit or repair
work remains.

1. Implement only the assigned slice.
2. Run the packet's declared acceptance checks and the relevant regression checks.
3. Fix focused-check failures.
4. Obtain the cross-family audit when the slice requires one.
5. Reproduce and repair established findings, rerun affected checks, and obtain independent
   closure of material findings.
6. Freeze the audit-cleared candidate on a detached checkout — never review the live tree.
7. Run the repository-wide gate from the bindings table. It is the one gate; run it once, last.
8. Close the slice through the mandatory closeout gate (below).
9. The coordinator reviews the final diff and commits only after acceptance, audit closure, and
   a passing gate, keeping the master document current in the same commit.

If the final gate exposes a defect, repair it, rerun the affected checks, obtain independent
review of any material change, and rerun the gate on a new frozen candidate.

Verify a gate by its exit code. A `| tail` pipe reports success when the gate failed.

### Mandatory closeout gate

Every worker slice finishes through the closeout gate named in the bindings. It runs the
declared check and retains only this slice's bounded evidence, then persists `PASS` or an
actionable list of what is left. Where a repository has no such tool, the coordinator records
`PASS` or the leftover list in the slice packet itself before the slice can close.

Audit meaningful behavior changes and high-stakes slices before integration. Tiny mechanical
slices may share one audit at a coherent capability boundary, but every slice still gets focused
checks and a diff review.

### Findings and escalation

Require the auditor to separate established defects, verification gaps, and optional
improvements. Convert every material finding into a builder checklist item carrying evidence, an
acceptance test or reproduction, a state invariant where relevant, and a named symbol or file
search covering every other use of an affected symbol. Close each item with a fix plus evidence,
or an explicit supported disposition. Do not expand scope to satisfy speculative suggestions.

Bound the repair loop. After two repair cycles on one finding produce no new evidence, stop and
call it engineering-blocked: record the finding, what was tried, and the failing output in the
slice packet, then take the stopping-without-acceptance branch below. Tell the owner it is blocked
on engineering, not on a scope decision — it is not a question for them to answer.

If repairs reveal skipped files, omitted verification, or early stopping, raise effort one notch
on the same model. If they reveal a structural blind spot, change model or builder family.
Change one variable at a time, and keep the auditor independent of whoever implements the repair.

The owner decides product scope. Engineering questions are yours to decide and act on, including
which of two routes reaches a fixed product goal. Where a countable target cannot be met by the
target repository, the answer is a sourcing requirement added to the plan, stated plainly —
never a reduced request.

### Verify the outcome, not the call

A test that asserts an argument was passed proves nothing about the process that ran. Assert the
observable outcome.

### Stopping without acceptance

A session that stops before acceptance — blocked on an owner decision, out of usage, engineering-
blocked, or without cross-family audit tooling — still closes out. It takes this branch instead of
the accepted one:

1. Do not commit the candidate. Leave the working tree as it stands.
2. Run the hygiene command from the bindings so nothing is silently lost.
3. Record in the slice packet, under a `## Stopped` heading: the blocker in one line, what was
   actually verified, which paths hold retained work, and the single next action that unblocks it.
4. Rewrite the master document's `## START HERE` block to point at that packet and that blocker,
   then commit **only** the packet and the master-document edit, with a message saying the slice
   is not accepted.
5. Print the master document's full path and the repository root, then stop.

This branch is always available. Nothing here requires an accepted slice before a session may end,
and no session may end by leaving the master document stale.

### Closeout

Before reporting a slice finished:

1. Run the closeout gate from the bindings for the slice, and record `PASS` or the leftover.
2. Run the hygiene command from the bindings. Commit or delete every untracked path **this
   session created**, and report each one by name. A path this session did not create is
   reported and left in place — never delete or commit another session's work, even inside your
   own worktree. Never leave a committed file beside an untracked twin. "Clean" is not a
   report.
3. Coordinator reviews the final diff and commits, master document updated in the same commit.

### Ending a session

Run these in order. The document edits come **before** the hygiene pass and the commit, so they
are covered by both.

1. If the slice was not accepted, use `### Stopping without acceptance` above instead and stop
   there. Otherwise run the closeout above through step 1.
2. Rewrite the master document's `## START HERE` block **in place**, 15 lines maximum, pointers
   only: current slice and its packet path, blocked-on, next dependency-ready slice, last
   decision, repository root, and the master document's own path.
3. Append everything narrative to `## Progress log`. Never rewrite a completed dated section —
   those are append-only history.
4. If a detailed spec has to live in its own file, leave a breadcrumb both ways: the master stays
   the single source of truth for status and decisions, the spec is design only, and the spec's
   top block redirects here.
5. Run the hygiene command from the bindings and settle every path it lists, per the closeout
   rule above.
6. Review the final diff and commit it, master document included in the same commit.
7. Print the master document's full path and the repository root, then stop.
