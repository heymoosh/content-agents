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
- Inner loop: verify runtime/tooling changes with `npm run check` (typecheck + unit tests);
  documentation-only changes use the scoped exception in the Slice protocol.
- Local-first merge gate: the recorded local `npm run check` result is the
  ordinary merge proof. Do not push solely to obtain a hosted test result, and
  do not wait on the manual CI workflow for routine changes.
- Behavior gate: run `npm run test:e2e` once, only when user-visible behavior changed.
- Heavy checks (mutation testing, full matrices) are CI-only — never run them locally.
- After pushing, inspect only retained workflows that were intentionally
  triggered (for example the secret scan); do not poll for routine test CI.
- Maturity: when you finish a feature (not a small fix), check the next rung in `docs/maturity.md` and propose it if its trigger fires — never auto-apply.
- Living document: when a correction recurs, add the rule here.

## Required repository behavior

- Work inside the private `origin` boundary (`heymoosh/content-agents`). A session may push a
  reviewed, gated commit when delivery is part of the authorized work. Workers and subagents never
  push or merge. Do not open an engineering delivery pull request, create another remote or hosted
  repository, or add a GitHub Actions workflow without separate owner authorization. The existing
  story editorial PR flow, manual diagnostic, secret-scan, dependency-audit and Dependabot files
  are intentional and remain in place.
- One session owns integration and merges one reviewed commit at a time. Runtime and tooling changes
  pass `npm run check` before integration; documentation-only work uses the scoped gate in
  `## Slice protocol`.
- Do not reset, discard, stash, overwrite, or commit another session's work. Use an isolated
  worktree when the active checkout is dirty. Stage only named paths, never `git add .` or
  `git add -A`.
- Do not deploy production from pull-request events or ordinary pushes to `main`. This repository
  has no Vercel project or production deployment. Do not add Vercel configuration or a deployment
  workflow unless a real production target is first verified and explicitly authorized. If that
  changes, disable Vercel Git auto-deploy and allow production only from explicit `v*` release tags.

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

## Session-end repository hygiene

Before a session or worker reports work finished, run:

```sh
bash scripts/repo-hygiene.sh --rescue --base main
```

Local `main` is the integration ref; `origin/main` can lag until fetch or push and therefore gives
false reports about branches already integrated locally. `--rescue` snapshots uncommitted work to
`refs/wip/<worktree>` without changing the working tree, index, or branch.

Commit or delete every untracked path this session created. Report every other path the command
lists and leave it in place. Never delete, commit, reset, stash, or overwrite another session's
work. Name what was committed, deleted, and deliberately left; "clean" is not a sufficient report.

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

## Escalation rule

When stuck on a challenging technical, architectural, or debugging problem that cannot be resolved
cleanly after reasonable effort, ask the `sol_advisor` subagent for guidance only. Do not continue
guessing. Handle routine implementation and straightforward debugging directly.

The owner decides product scope; the session decides the engineering route to that fixed goal. Do
not bring an implementation choice to the owner as though it were a scope decision. If a countable
target cannot be met from the repository's current inputs, add a sourcing requirement to the plan
instead of silently reducing the target.

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
- The private `origin` remote is authorized. A session may push its reviewed, gated commit when
  delivery is in scope, but it does not open an engineering delivery pull request. The scoped story
  editorial PR flow remains available for chapter review. Workers and subagents never push.

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
Changes that cite harness evidence should reference it by that path; don't expect or add a local
copy.

<!-- BEGIN PORTABLE PROTOCOL -->

## Slice protocol

(The heading name is kept because `orch doctor` looks for it. Read it as "working protocol".)

**Owner decision, 2026-09-13.** This repository adopts `orch`'s single-session operating model.
The packet-then-clear-then-blind-build handoff is retired: one session keeps its context, reads the
repository as needed, and owns a task through verification and integration. Packets remain optional
briefs for explicitly requested orchestration work. The rules below keep concurrent work safe and
results checkable; they do not prescribe an implementation method.

### Grok CLI on this Mac

Docker Desktop makes `/var/run/docker.sock` a symlink, so Grok's read-only sandbox refuses to
start on this Mac. Use the local Grok CLI with `--sandbox workspace`; never call
`grok_spawn_readonly` or use `grok --sandbox read-only`. Use `grok_spawn_worker` only when a
plugin is necessary and can explicitly pass `sandbox=workspace`. Workspace access is not
authorization to edit: audit prompts must say, "Audit against the supplied requirements. Do not
modify files. Cite path:line. Separate established defects, verification gaps, and optional
improvements. Answer the code-quality question separately from the requirements question."

For an evidence-only audit, work outside the repository. Allow only `read_file` with a
`Read(<exact evidence path>)` allow rule, use `--permission-mode dontAsk`, and disable subagents
and web search. Point the prompt at frozen evidence and require complete bounded reads. Never disable
sandboxing as a fallback. Verify the exit status, a complete verdict, and an unchanged candidate
before reporting the audit complete.

### Repo bindings

This table is the only part of the protocol that changes between repositories.

| Binding | This repository |
| --- | --- |
| Repository root | the worktree you were launched in — never `cd` to another checkout |
| Master document | `docs/content-studio-master-status.md`, only when the owner explicitly invokes orchestration |
| Slice packets | `docs/operations/launch-slices/SLICE-<ID>.md` |
| Packet template | `docs/operations/launch-slices/SLICE-TEMPLATE.md` |
| Repository-wide gate | `npm run check`; documentation-only changes run `git diff --check` plus a session review for accuracy, links, and rule consistency |
| Hygiene command | `bash scripts/repo-hygiene.sh --rescue --base main` |
| Closeout gate | none; record `PASS` or an actionable leftover list in the packet when one exists, otherwise in the final handoff |
| Integration rule | one session owns integration, one reviewed commit at a time, with the applicable gate passing before each integration commit |
| Delivery boundary | private `origin` (`heymoosh/content-agents`) authorized; a session may push reviewed gated work when delivery is in scope; no engineering delivery pull request or new hosted workflow without separate authorization; the scoped story editorial PR flow remains available |
| Base branch | `main` |

For normal requests, work directly from the user's request and relevant repository files; do not
read or update the master document, packets, backlog, or board. When the owner explicitly invokes
orchestration, the master document is the status and decision source, its `## START HERE` block is
the entry point, and a packet is an optional work brief.

### Roles

- **Session** — the session the owner talks to. It owns one piece of work end to end, keeps its
  own context, reads the repository as it sees fit, and decides its own method: build alone or
  spawn workers. It is the only role that commits or integrates, one reviewed commit at a time.
- **Worker** — a subagent the session chooses to spawn. Give it what it needs, not "only the
  packet". It returns a compact `RESULT BLOCK` (changed paths, outcome, checks run with results,
  evidence locations, unresolved items). It never commits.
- **Auditor** — a model from a different family than the builder. Gets the acceptance criteria,
  the candidate diff, the changed-file list and the check output. If that cannot establish a
  claim, it names the missing evidence rather than guessing.

One session works in one git worktree and one branch. A session that finds another session's
uncommitted paths reports them; it does not commit, revert, or stash them. Stage only paths named
for the current change, never `git add -A` or `git add .`.

A bigger sibling of the builder is not independent review. Never silently substitute a
same-family audit. If cross-family tooling is unavailable, say so and take the
stopping-without-acceptance branch; do not integrate.

If you spawn workers sharing one working tree: write ownership is disjoint; no lane runs a
repo-wide rewriting command (formatters, codegen, `--fix` linters) — the session does that after
every lane is done; each lane's checks write only to its own paths. Do not create workers merely
to raise utilization. Say in one line what each extra lane buys.

### Scope and the owner

The owner decides product scope. Engineering questions — including which of two routes reaches
a fixed goal — are yours to decide and act on. Do not pull extra work from the
backlog on your own; a free slot is not authorization. Collect genuine scope decisions into one
short owner checkpoint rather than a stream of questions. Report built, verified, accepted and
committed as separate states. Report wall-clock time separately from provider-reported usage;
never infer tokens from runtime.

### Model routing

Start each kind of work on the model that is best at it in one shot. Cost-effective means the
least total work to *verified* completion, counting retries, audits and repairs.

- Judgment calls — scope, acceptance, integration, blocked or deviating candidates: strong model,
  high effort.
- Bounded reading, inventories, mechanical edits, status writing: lighter model.
- Difficult or high-stakes implementation: strong model.
- Claude for frontend and Codex for backend are defaults, not rules.

Choose audit effort from the change's risk, not the strongest setting by default. Record the
requested model/effort and the actual result; a failed startup is not a completed audit. At a
usage limit, record the blocker and next retry condition in the current handoff (and the master
document when orchestration is active), pause that provider, and continue independent work. Do not
repeatedly probe quota or silently swap a required reviewer.

### Audit scope and proportional verification

Classify the change before work and record the reason. Changed behavior and risk set the class,
not file count.

- **Documentation only:** session review for accuracy and links, then the documentation-only
  gate from the bindings. No external audit. Files consumed as executable configuration,
  generated inputs or runtime prompts are not documentation.
- **Low-risk mechanical:** focused checks and a diff review. Batch related changes into one
  audit at a capability boundary if independent review is needed.
- **Meaningful behavior or high risk:** focused outcome/regression proof and a cross-family
  audit before integration.
- **Feature/experience completion:** reconcile requirements with source and real end-to-end
  browser evidence.

Plan one bounded audit of a ready candidate, then delta reviews of unresolved material findings
only. Retain accepted dispositions with their candidate hashes; do not re-audit settled
decisions. Verification gaps need the missing experiment; more model opinion does not close them.

### Usage discipline

Optimize total model work to verified completion, including context, coordination, retries and
review. Use completion notifications; poll only for a missing notification or a suspected stall.
Keep raw logs, screenshots and manifests on disk and cite them; do not narrate their contents.
Load further evidence only for a named acceptance question or failure.

### Worker contract

A worker returns a compact `RESULT BLOCK` and nothing else. Do not relay worker transcripts. A
worker must report when a prediction in its brief is disproven, with the evidence, and must not
relax a constraint or manufacture a success to fit the prediction. Comments that claim a
guarantee must describe behavior the change actually provides.

### Completion sequence

For runtime/tooling candidates; documentation-only changes use their scoped gate. Do not start
the expensive repository-wide gate while known audit or repair work remains.

1. Implement the work.
2. Run the focused acceptance checks and the relevant regression checks; fix what fails.
3. Obtain the cross-family audit when the class requires one; repair established findings and
   rerun affected checks.
4. Run the repository-wide gate from the bindings table once, last, on the frozen candidate.
   Verify it by exit code — a `| tail` pipe hides a failure.
5. Close through the closeout gate below.
6. Review the final diff and commit only after acceptance, audit closure and a passing gate,
   with the master document updated in the same commit when orchestration is active.

If the final gate exposes a defect, repair it, rerun affected checks, get independent review of
any material change, and rerun the gate on a new frozen candidate. Do not weaken required gates
or reuse results contrary to this protocol. If closeout would force a full rerun solely for
paperwork, say so and propose a bounded closeout fix instead.

### Mandatory closeout gate

This repository has no closeout command. For runtime or tooling work, record `PASS` or an
actionable leftover list in the current packet when orchestration is active, or in the final handoff
for direct work. This record is separate from the hygiene command and does not replace it.
Documentation-only work records its scoped review and diff-check result.

### Findings and escalation

The auditor separates established defects, verification gaps and optional improvements, and
answers a code-quality question separately from the requirements question. **Every finding in
every bucket gets a written disposition from the builder** — fixed with evidence, or declined
with a reason. A finding with no disposition is an open finding. (Bake-off lesson: a real
lock-timeout defect was filed under "optional improvements" and silently dropped.)

Bound the repair loop by surface, finding and attempt count. After two repair cycles on one
finding produce no new evidence, stop and call it engineering-blocked. Two rounds with genuinely
new evidence but no progress trigger a stronger model or tier, never an equivalent retry. Change
one variable at a time and keep the auditor independent of whoever repairs. An engineering block
is an engineering report to the owner, not a scope question.

### Verify the outcome, not the call

A test that asserts an argument was passed proves nothing about the process that ran. Assert the
observable outcome.

For frontend work, agents own functional QA before asking the owner for design judgment. Use the
repo's browser test runner to exercise real user journeys, including error/recovery paths,
viewports, flag state, and responsive/theme/loading/persistence/accessibility states where they
apply. A passing flags-OFF suite that skips the feature is not feature proof. Mocked responses
establish controlled UI behavior, not live backend integration. Retain build identity, command,
exit code, counts and screenshots/traces. The owner reviews subtle visual choices; they are not
the first smoke tester.

### Stopping without acceptance

A session that stops before acceptance because of an owner decision, usage limit, engineering block,
or unavailable required cross-family audit still closes out:

1. Do not commit the candidate.
2. Run the hygiene command and settle only paths this session created.
3. Record the blocker, verified work, retained paths, and single next action. For explicitly
   requested orchestration, update the current packet and the master document's `## START HERE`
   block and append the narrative to `## Progress log`. For direct work, report the same facts in
   the final handoff without touching orchestration state.
4. If orchestration requires a status-only commit, commit only that paperwork with a message saying
   the candidate is not accepted.
5. Print the repository root and, when orchestration is active, the master document path.

### Closeout

Before reporting work finished:

1. Record `PASS` or the leftover as the closeout binding requires.
2. Run the hygiene command from the bindings. Commit or delete every untracked path **this
   session created**, and report each by name. A path this session did not create is reported
   and left in place. "Clean" is not a report.
3. Review the final diff and commit; include the master document only when orchestration is active.

### Ending a session

1. If the work is not accepted, use `### Stopping without acceptance`.
2. If orchestration is active, update `## START HERE` in place to no more than 15 lines of pointers,
   append narrative only to `## Progress log`, and stage the packet and master by name. Normal
   direct work does not read or modify those files.
3. Run the hygiene command and settle every path this session created.
4. Review the final diff and commit only the intended paths after the applicable gate passes.
5. If working in a branch worktree, fast-forward it into local `main`. If it cannot fast-forward,
   report the divergence; do not create a merge commit or force it. Rerun the applicable gate on
   `main`, then remove the worktree and delete the merged branch with `git branch -d`.
6. Print the repository root and, when orchestration is active, the master document path.

### Size discipline

This section stays under 24 KB. Optional slice packets stay under 12,288 B; their status and
evidence are pointers, not session transcripts. A session interrupted mid-work writes down what it
knows, and the resuming session compresses that handoff after reading it. Narrative belongs in the
master progress log only when orchestration is active.
