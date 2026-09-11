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

This section is the frozen procedure, so session prompts can just point here. A coordinator
reading only this section, the master document's `## START HERE` block, the environment file below
and one slice packet has everything it needs, every way a session may end included.

The bindings table, model routing defaults and the Grok CLI launch fix live in
`docs/operations/slice-protocol-environment.md`, read with this section; "the bindings" means that
table. The master document is the single source of truth for status and decisions, and its
`## START HERE` block is the only part a new session reads.

### Roles

- **Coordinator** — the session the owner talks to. Reads this section, the master's `## START HERE`
  block and the current slice packet, nothing else; it never loads the repository "for context" and
  never implements. Under the integration rule it is the only role that commits or integrates, one
  reviewed commit at a time.
- **Worker** — a subagent the coordinator spawns. Reads this section and exactly one slice packet.
  It implements, runs the packet's declared checks, returns a `RESULT BLOCK`, and never commits.
- **Auditor** — a subagent from a different model family than the builder. Receives the slice's
  acceptance criteria, candidate diff, changed-file list and focused check output, and never the
  master document, the repository tree or a worker transcript. If that cannot establish a claim, it
  names the missing evidence or requests a bounded excerpt rather than assuming unseen code is
  correct or defective.

The read limit governs *starting context* — what you load before the work — never evidence the
session itself produces. The coordinator's standing read set is every worker `RESULT BLOCK`, the
candidate diff and changed-file list, check and gate output, audit findings, hygiene output, and any
file the current packet names as owned or cited. Reading those **is** the review this protocol
requires.

Never silently substitute a same-family audit; a bigger sibling of the builder is not independent
review. If required cross-family tooling is unavailable, mark the candidate review-blocked, follow
the usage-limit checkpoint, and do not integrate it.

### Slice packet contract

A slice is the smallest thing that is demonstrably done, not the smallest thing that can be
described. Every packet records: goal, difficulty, dependencies, owned files, files not to touch,
acceptance criteria, focused verification commands, observable result, risk and whether an audit is
required, and the builder and auditor families. Copy the packet template named in the bindings; do
not invent a different shape. Handing a worker a packet always includes this protocol section —
"only that packet" bounds what else the worker may read, not whether it gets the rules.

Before choosing lanes, separate preparation, execution and verification and identify the useful
independent deliverables and their dependencies. A shared budget, mutable resource or final artifact
serializes only the operations that modify or consume it, not independent preparation or
verification tooling.

Prefer useful parallel work within available agent and resource limits. Workers share one working
tree, so every concurrent lane must satisfy all three conditions, stated in the packet:

- Write ownership is disjoint: no path is owned by two lanes, and no lane creates, moves or deletes
  a path inside another lane's owned directories. Shared read-only inputs are allowed only under the
  third condition.
- No lane runs a repo-wide command that rewrites files — formatters, codegen, migrations or `--fix`
  linters. Those belong to the coordinator, after every lane has finished.
- Each lane's focused checks write only to its owned paths, temporary and generated files included.
  They may read explicitly named immutable shared inputs pinned to a commit or content hash, and
  must not depend on another lane's unfinished or changing output.

Record each lane's deliverable, owned paths, immutable inputs, focused checks, dependencies and
handoff checkpoint. Verification tooling may be prepared against fixed requirements and lane-owned
fixtures while implementation proceeds, but verifying the candidate itself waits for a completed,
frozen handoff; preparation is not proof that it passes. If a condition fails, serialize the affected
operations and reassess the remaining independent work. For a single-worker slice, name the concrete
dependency or resource conflict preventing useful parallel work and the split considered; "coupled
work", "shared budget" or "safer serially" alone is insufficient. A small task may stay single-worker
when a separate assignment would add coordination cost without a useful independent deliverable —
state that reason. Never create workers merely to raise utilization or repeat an investigation.

Conflicting edits, shared mutable budgets, final integration and commits stay serialized, and workers
must preserve other sessions' changes. A stalled lane triggers a checkpoint and a fresh look at
independent remaining work, not concurrent reassignment of its owned paths. On an active slice, change
lane ownership only after affected workers pause and the coordinator updates the packet and reissues
assignments. Cross-family audit requirements are unchanged.

### Delivery batch and owner checkpoint

Before launching, record the authorized slice IDs, dependencies, per-slice deliverables (design or
implementation), acceptance boundaries and stop condition in the current packet. A free slot is not
permission to pull another slice from the backlog; expand the batch only with owner authorization,
though preparation and repairs within its fixed requirements stay engineering decisions. Prefer
accepting built, dependency-ready candidates over more implementation, and preserve healthy running
gates and existing ownership at checkpoints.

Collect genuine scope decisions and human-only acceptance steps in one short upfront owner
checkpoint, recording resolved decisions, remaining human actions and their required checkpoint, and
arranging hands-on verification early enough for the owner's availability. Never ask the owner to
choose engineering methods, manufacture decisions, or treat advance approval as proof that a later
walkthrough occurred. Independent authorized work may continue around a blocker.

Keep handoffs compact: candidate identity, status, evidence pointers, unresolved items, next action.
Reload unchanged packets, histories, diffs or skill references only for a named new question or
changed input; retain durable evidence rather than reconstructing history in context. Report built,
verified, accepted and committed states separately, and local test elapsed time separately from model
calls and provider-reported usage; mark unavailable usage unknown, never inferring tokens or cost
from runtime or a subscription percentage.

### Writing a missing packet

If START HERE names a slice packet that does not exist, writing it **is** coordination, not a
departure from the read limit. Without asking permission the coordinator may read exactly these and
nothing more:

- the packet template named in the bindings;
- the master document's standing-constraints or non-negotiables section, if it has one;
- any heading in the master document that START HERE names;
- a design spec that START HERE or the slice sequence names, limited to that slice's own section
  plus the spec's dependency / running-order section.

Draft the packet from those, then proceed. Stop for the owner only when the slice's goal or
acceptance criteria are genuinely undecided. Permission to read a named input is not a decision and
must never be escalated as one; the owner decides scope, not method.

### Audit scope and proportional verification

Classify the candidate in the packet before work, recording the reason, applicable checks and review
boundary. Changed behavior and risk determine the class, not file count.

- **Documentation only:** status, planning, prose and owner-directed procedure changes that do not
  alter executable inputs need coordinator review for accuracy, links and rule consistency, plus a
  whitespace/diff check — no external-model audit, application build or UI E2E. This is the
  documentation-only exception to the repository-wide gate, runtime closeout command and detached
  runtime checkout requirement; record the scoped result in the packet, or in the master progress
  entry for a separately scoped policy update. Review a frozen diff and commit only those
  documentation hunks. Files consumed as executable configuration, generated inputs or runtime
  prompts are never exempt, here or under any other exception.
- **Low-risk copy/mechanical:** focused checks and coordinator diff review, no standalone
  maximum-effort audit. Where independent review is required, batch related changes into one named
  capability-boundary audit before integration. Runtime gates still apply, including UI journey
  checks for user-visible copy. Never use this class to waive a material finding's independent
  closure or to disguise a behavior, privacy, security or data-integrity change.
- **Meaningful behavior or high risk:** focused outcome/regression proof and bounded cross-family
  review before integration. Supply exact changed evidence and affected invariants; broaden review
  only when the change or a demonstrated blind spot warrants it.
- **Feature/experience completion:** reconcile requirements with source and actual end-to-end
  browser evidence. A full review fits this boundary or an explicit owner request, and need not be
  repeated for every small follow-up repair.

Plan one bounded review of a ready candidate, then delta reviews of unresolved material findings and
changed evidence. Retain accepted dispositions with their candidate/input hashes, reopening only when
changed behavior, dependencies or new evidence invalidates them. Never re-send the whole repository,
re-audit settled decisions, or create duplicate reports. Record the three finding categories below
separately; a verification gap needs the missing experiment, not more opinion.

Existing packets and templates inherit these rules and preserve owner-selected reviewers, security,
privacy and authenticated-canary budgets, and release gates.

### Model routing

Start each kind of work on the model best at it *in one shot*, not the cheapest that might pass:
cost-effective means the least total tokens to *verified* completion, counting missed requirements,
retries, audits and repairs, not the price of one attempt. Coordination, slice boundaries, acceptance
calls, integration decisions and difficult or high-stakes implementation take a strong model; bounded
reading, inventories, mechanical edits and status writing take a lighter one. `### Effort tiers`
binds this to named jobs.

Choose audit effort from the change's risk and unanswered questions, not the strongest available
setting by default. Routine bounded reviews use a capable reviewer at ordinary effort; reserve
high/max effort for difficult, high-stakes or broad experience reviews. Record the requested
model/effort and the actual result; a failed startup is not a completed audit.

At a usage limit, first record the affected lane, evidence, blocker and next retry condition in the
packet and master. Pause that provider; never repeatedly probe quota or silently change a
user-required reviewer. Continue dependency-ready work in authorized scope where ownership and inputs
are independent: browser verification, evidence preparation, other repairs, a separately accepted
documentation change. Required review stays an integration gate for the blocked candidate; ending
work on it without an independently accepted deliverable takes the stopping-without-acceptance
branch. Separately scoped accepted changes use the accepted closeout — keep blocked candidates and
their status out of that commit.

### Usage discipline

Optimize total model work to verified completion, counting context, coordination, retries and
review. This qualifies the parallel-work preference above: a safe split alone is insufficient. Record
each extra lane's useful independent result and expected benefit in one packet line, and keep work
serial when another agent would mostly repeat context or add bookkeeping.

Use a fresh packet-sized worker context for unrelated work. Reuse a worker for related repairs when
its retained context saves investigation, preserving ownership until a frozen handoff. Record worker
model and effort with the assignment, and apply Model routing to mechanical work as well as
implementation — never use the strongest worker merely because it is already available.

Use completion notifications. Poll only for a missing notification, a deadline, a suspected stalled
process or a concrete intervention; never repeatedly inspect unchanged progress. Scripts should emit
command, exit code, counts, candidate identity and a short result, keeping raw logs, screenshots and
manifests on disk. The coordinator reviews its standing read set under Roles and loads further
evidence only for a named acceptance question or failure, never duplicating evidence bundles or
narrating them. This limits context overhead, not required outcome tests, visual inspection or
independent review.

Run closeout automatically once per completed coherent capability, not after every worker, command
or repair. Compact when continuing unfinished related work; prefer a fresh coordinator chat at the
next substantial capability boundary when START HERE and the packet suffice, keeping only short
resume pointers. Neither compaction nor fresh chats substitute for these controls. Never make the
owner monitor workers or restate this policy in session prompts.

### Worker contract

A worker returns a compact `RESULT BLOCK` and nothing else: changed paths, outcome, checks run with
their results, evidence locations, and unresolved items. Never relay worker transcripts or
re-summarize the plan; cite section headings instead.

### Completion sequence

Run in this order for runtime/tooling candidates; documentation-only changes use their scoped gate
above. Never start an expensive repository-wide gate while known audit or repair work remains for
that candidate.

1. Implement only the assigned slice.
2. Run the packet's declared acceptance checks and the relevant regression checks.
3. Fix focused-check failures.
4. Obtain the cross-family audit when the slice requires one.
5. Reproduce and repair established findings, rerun affected checks, and obtain independent closure
   of material findings.
6. Freeze the audit-cleared candidate on a detached checkout; review immutable evidence, never a
   changing live tree. A review-blocked runtime candidate cannot pass this integration step.
7. Run the repository-wide gate from the bindings table. Run required UI journeys on the frozen
   candidate, then the full check once, last; repeat only after a relevant change or failure.
8. Close the slice through the mandatory closeout gate (below).
9. The coordinator reviews the final diff and commits only after acceptance, audit closure and a
   passing gate, keeping the master document current in the same commit.

If the final gate exposes a defect, repair it, rerun the affected checks, obtain independent review
of any material change, and rerun the gate on a new frozen candidate.

Verify a gate by its exit code. A `| tail` pipe reports success when the gate failed.

### Mandatory closeout gate

Every worker slice finishes through the closeout gate named in the bindings: it runs the declared
check, retains only this slice's bounded evidence, and persists `PASS` or an actionable list of what
is left. Where a repository has no such tool, the coordinator records `PASS` or the leftover list in
the slice packet itself before the slice can close.

### Findings and escalation

Require the auditor to separate established defects, verification gaps and optional improvements.
Convert every material finding into a builder checklist item carrying evidence, an acceptance test
or reproduction, a state invariant where relevant, and a named symbol or file search covering every
other use of an affected symbol. Close each with a fix plus evidence or an explicit supported
disposition. Never expand scope for speculative suggestions.

Bound the repair loop. After two repair cycles on one finding produce no new evidence, stop and call
it engineering-blocked: record the finding, what was tried and the failing output in the slice
packet, then take the stopping-without-acceptance branch below. Tell the owner it is blocked on
engineering, not on a scope decision — it is not a question for them to answer.

If repairs reveal skipped files, omitted verification or early stopping, raise effort one notch on
the same model. If they reveal a structural blind spot, change model or builder family. Change one
variable at a time, and keep the auditor independent of whoever implements the repair.

The owner decides product scope; engineering questions, including which of two routes reaches a
fixed product goal, are yours to decide and act on. Where a countable target cannot be met by the
target repository, the answer is a sourcing requirement added to the plan, stated plainly — never a
reduced request.

### Verify the outcome, not the call

A test asserting that an argument was passed proves nothing about the process that ran; assert the
observable outcome.

For frontend work, agents own functional QA before asking the owner for design judgment. Use the
repo's Playwright CLI/test runner or declared browser equivalent to exercise actual user journeys,
not only components. Each UI packet names the affected journey and error/recovery paths, viewport(s),
feature-flag state, fixture versus live backend, and observable assertions. Reuse relevant tests; add
coverage where a required outcome is absent, not tests that mirror code.

Retain the candidate/build identity, command, exit code, passed/failed/skipped counts and reasons,
and screenshots/traces or print output where needed to prove visibility or layout. A passing flags-OFF
suite that skips the feature is not feature proof: run the affected journey with the feature enabled
in an isolated local test instance, without changing production flags or the owner's preview. Mocked
responses establish controlled UI behavior, not live backend integration.

Before claiming a frontend complete, cover its required journey matrix — responsive, theme,
loading/error, persistence, accessibility interactions, print states where applicable — compare the
required prototype experience, and run a bounded live-backend journey where the feature has one,
within existing authorization and canary budgets. Static or entirely local journeys record that
live integration is not applicable and prove their real local behavior instead. Report blocked live
steps separately and continue independent controlled/browser coverage. The owner reviews subtle
visual choices and product decisions, and is not the first functional smoke tester.

### Stopping without acceptance

A session that stops before acceptance — blocked on an owner decision, out of usage, engineering-
blocked, or lacking cross-family audit tooling — still closes out, taking this branch instead of the
accepted one:

1. Never commit the candidate. Leave the working tree as it stands.
2. Run the hygiene command from the bindings so nothing is silently lost.
3. Record in the slice packet, under a `## Stopped` heading: the blocker in one line, what was
   actually verified, which paths hold retained work, and the single next action that unblocks it.
4. Rewrite the master document's `## START HERE` block to point at that packet and that blocker,
   then commit **only** the packet and the master-document edit, with a message saying the slice is
   not accepted.
5. Print the master document's full path and the repository root, then stop.

This branch is always available: no session needs an accepted slice to end, and none may end leaving
the master document stale.

### Closeout

Before reporting a slice finished:

1. Run the closeout gate from the bindings for the slice, and record `PASS` or the leftover.
2. Run the hygiene command from the bindings. Commit or delete every untracked path **this session
   created**, and report each one by name. A path this session did not create is reported and left
   in place — never delete or commit another session's work, even inside your own worktree. Never
   leave a committed file beside an untracked twin. "Clean" is not a report.
3. Coordinator reviews the final diff and commits, master document updated in the same commit.

### Ending a session

Run these in order; the document edits come **before** the hygiene pass and commit, so both cover
them.

1. If the slice was not accepted, use `### Stopping without acceptance` above instead and stop
   there. Otherwise run the closeout above through step 1.
2. Rewrite the master document's `## START HERE` block **in place**, 15 lines maximum, pointers
   only: current slice and its packet path, blocked-on, next dependency-ready slice, last decision,
   repository root, and the master document's own path.
3. Append everything narrative to `## Progress log`. Never rewrite a completed dated section —
   those are append-only history.
4. If a detailed spec lives in its own file, leave a breadcrumb both ways: the spec is design only,
   and its top block redirects here.
5. Run `### Closeout` steps 2 and 3: the hygiene pass, settling every path it lists, then the
   final-diff review and commit with the master document in it.
6. Print the master document's full path and the repository root, then stop.

### Packet size discipline

A packet is a specification, not a session log; every session reads it in full at its start.

- Cap a packet at 12288 B, roughly 3,000 tokens. Measure bytes, not lines.
- A packet carries exactly one `## Stopped` section, at most 4 KB. A frozen handoff is a set of
  pointers to evidence, never the evidence itself.
- Superseded `## Stopped` sections, completed `RESULT BLOCK`s and every dated session record
  (`## Accepted — <date>`, `## Independent audit — <date>`, `## Resumed — …`) move to
  `SLICE-<ID>-LOG.md` beside the packet, newest first. No session reads that file.
- A session cut off mid-work — usage limit, interrupt — writes down everything it knows; that dump
  is correct behaviour, not a cap violation. The **resuming** session compresses it to pointers as
  its first act, before anything else. Never compress another session's handoff without reading it.
- This protocol section is capped at 24576 B. A section already over cap is trimmed at the next
  closeout, not appended to.
- At either cap, something is archived or compressed. Nothing is appended past a cap.
- At closeout the coordinator prints its starting read set: the byte size of this section, of the
  master document's `## START HERE` block, and of the packet it read.

### Effort tiers

Bind the model and effort to the job, not to the session. Tiers are named by strength, never by
provider.

| Job | Tier |
| --- | --- |
| Write a new slice packet | strongest available model, high effort |
| Run a packet that is already written | mid-tier model, medium effort |
| Judge a bounced, blocked or deviating candidate | strongest available model, high effort |
| Closeout and `## START HERE` rewrite | mid-tier model, low effort |

Workers default to a mid-tier model at medium effort. Escalate a worker only when its packet declares
the work high-risk, or when a first pass fails acceptance. Auditors keep the cross-family rule above;
family matters more than tier for a review.

Writing a packet and running it are separate sessions. A packet session reads this section, the
`## START HERE` block and any cited headings, writes one packet, spawns no workers, and ends. Before
ending it rewrites the one `## START HERE` line naming the slice it just wrote: the planned slice ID
is replaced by the packet's path, marked dependency-ready, and that single-line edit is committed
with the packet. A closeout session names a next slice by ID only, with no path, because its packet
does not exist yet.
An execution session runs a packet that already exists; if `## START HERE` names no written,
dependency-ready packet, it stops and asks for a packet session instead of switching modes
mid-session at the wrong tier.
