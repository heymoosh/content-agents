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

This section is the frozen procedure, and it is self-contained on purpose. Session prompts stay
short because they point here. A coordinator that reads only this section, the master document's
`## START HERE` block, the environment file named below and one slice packet has everything it
needs, and every way a session can end is described here.

The bindings table, model routing defaults and the Grok CLI launch fix live in
`docs/operations/slice-protocol-environment.md`, read with this section. "The bindings" below
means that table.

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
same-family audit. If required cross-family tooling is unavailable, mark the candidate
review-blocked and follow the usage-limit checkpoint; do not integrate it.

### Slice packet contract

A slice is the smallest thing that is demonstrably done, not the smallest thing that can be
described. Every packet records: goal, difficulty, dependencies, owned files, files not to
touch, acceptance criteria, the focused verification commands, the observable result, risk and
whether an audit is required, and the builder and auditor families. Copy the packet template
named in the bindings; do not invent a different shape. Handing a worker a packet always
includes this protocol section — "only that packet" bounds what else the worker may read, not
whether it receives the rules.

Before choosing lanes, separate preparation, execution, and verification. Identify useful
independent deliverables and the dependencies between them. A shared execution budget, mutable
resource, or final artifact serializes only the operations that modify or consume it; it does
not by itself justify serializing independent preparation or verification tooling.

Prefer useful parallel work within available agent and resource limits. Workers share one
working tree, so every concurrent lane must satisfy all three conditions, stated in the packet:

- Write ownership is disjoint: no path is owned by two lanes, and no lane creates, moves or
  deletes a path inside another lane's owned directories. Shared read-only inputs are allowed
  only under the third condition below.
- No lane runs a repo-wide command that rewrites files — formatters, codegen, migrations or
  `--fix` linters. Those belong to the coordinator, after every lane has finished.
- Each lane's focused checks write only to its owned paths, including temporary files and
  generated outputs. Checks may read explicitly named immutable shared inputs, pinned to a
  commit or content hash. They must not depend on another lane's unfinished or changing output.

Record each lane's deliverable, owned paths, immutable inputs, focused checks, dependencies and
handoff checkpoint. Independent verification tooling may be prepared against fixed requirements
and lane-owned fixtures while implementation proceeds. Verification of the actual candidate
waits for a completed, frozen handoff; preparation is not proof that the candidate passes.

If a condition fails, serialize the affected operations and reassess the remaining independent
work. For a single-worker slice, name the concrete dependency or resource conflict that prevents
useful parallel work and the independent split considered. "Coupled work", "shared budget", or
"safer serially" alone is insufficient. Small tasks may remain single-worker when a separate
assignment would add coordination cost without a useful independent deliverable; state that
reason. Do not create workers merely to increase utilization or duplicate the same investigation.

Conflicting edits, shared mutable budgets, final integration and commits remain serialized.
Workers must preserve other sessions' changes. A stalled lane triggers a checkpoint and a fresh
look at independent remaining work, not concurrent reassignment of its owned paths. For an
active slice, change lane ownership only after affected workers pause and the coordinator updates
the packet and issues the revised assignments. Cross-family audit requirements remain unchanged.

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

### Audit scope and proportional verification

Classify the candidate in the packet before work; record the reason, applicable checks and
review boundary. Changed behavior and risk determine the class, not file count.

- **Documentation only:** status, planning, prose and owner-directed procedure changes that do
  not alter executable inputs need coordinator review for accuracy, links and rule consistency,
  plus a whitespace/diff check. No external-model audit, application build or UI E2E is required.
  This is the documentation-only exception to the repository-wide gate, runtime closeout
  command, and detached runtime checkout requirement; record the scoped result in the packet
  (or the master progress entry for a separately scoped policy update). Review a frozen diff
  and commit only those documentation hunks. Files consumed as executable configuration,
  generated inputs or runtime prompts are not exempt.
- **Low-risk copy/mechanical:** focused checks and coordinator diff review; no standalone
  maximum-effort audit. Where independent review is required, batch related changes into one
  named capability-boundary audit before integration. Runtime gates still apply, including
  UI journey checks for user-visible copy. Do not use this class to waive a material finding's
  independent closure or to disguise a behavior, privacy, security or data-integrity change.
- **Meaningful behavior or high risk:** focused outcome/regression proof and bounded cross-family
  review before integration. Supply exact changed evidence and affected invariants; use broader
  review only when the change or a demonstrated blind spot warrants it.
- **Feature/experience completion:** reconcile requirements with source and actual end-to-end
  browser evidence. A full review is appropriate at this boundary or when explicitly requested
  by the owner. This does not require repeating it for every small follow-up repair.

Plan one bounded review of a ready candidate, then delta reviews of unresolved material findings
and changed evidence. Retain accepted dispositions with their candidate/input hashes; reopen
only when changed behavior, dependencies or new evidence invalidates them. Do not re-send the
whole repository, re-audit unchanged settled decisions, or create duplicate reports. Record
established defects, verification gaps and optional improvements separately. Verification gaps
need the missing experiment; more model opinion does not close them.

Existing packets and templates inherit these rules; preserve explicit owner-selected reviewers
and security, privacy, authenticated-canary budgets, and release gates. A documentation exception
does not waive validation of executable configuration, generated inputs, or runtime prompts.

### Model routing

Start each kind of work on the model that is best at that kind of work *in one shot*, not the
cheapest that might pass. Cost-effective means the least total tokens to *verified* completion,
counting missed requirements, retries, audits, and repairs — not the price of one attempt.

- Coordination, slice boundaries, acceptance calls, integration decisions: strong model.
- Bounded reading, inventories, mechanical edits, status writing: lighter model.
- Difficult or high-stakes implementation: strong model.

Choose audit effort from the change's risk and unanswered questions, not the strongest available
setting by default. Routine bounded reviews use a capable reviewer at ordinary effort; reserve
high/max effort for difficult, high-stakes, or broad experience reviews. Record the requested
model/effort and the actual result; a failed startup is not a completed audit.

At a usage limit, record the affected lane, evidence, blocker and next retry condition in the
packet and master first. Pause that provider; do not repeatedly probe quota or silently change a
user-required reviewer. Continue dependency-ready work within authorized scope when ownership
and inputs are independent: browser verification, evidence preparation, other repairs, or a
separately accepted documentation change. Required review remains an integration gate for the
blocked candidate. When ending work on that candidate without an independently accepted
deliverable, use the stopping-without-acceptance branch. Separately scoped, accepted changes use
the accepted closeout; keep blocked candidates and their status separate from that commit.

### Usage discipline

Optimize total model work to verified completion, including context, coordination, retries and
review. This qualifies the parallel-work preference above: a safe split alone is insufficient.
Record the useful independent result and expected benefit of each extra lane in one line in the
packet. Keep work serial when another agent would mostly repeat context or add bookkeeping.

Use a fresh packet-sized worker context for unrelated work. Reuse a worker for related repairs
when its retained context saves investigation; preserve ownership until a frozen handoff. Record
worker model and effort with the assignment and apply Model routing to mechanical work as well
as implementation. Do not use the strongest worker merely because it is already available.

Use completion notifications. Poll only for a missing notification, a deadline, a suspected
stalled process or a concrete intervention; do not repeatedly inspect unchanged progress.
Scripts should produce command, exit code, counts, candidate identity and a short result.
Keep raw logs, screenshots and manifests on disk. The coordinator reviews the candidate diff,
RESULT BLOCKs, audit findings and check summaries; load further evidence only for a named
acceptance question or failure. Do not duplicate evidence bundles or narrate their contents.
This limits context overhead, not required outcome tests, visual inspection or independent review.

Perform closeout automatically once per completed coherent capability, not after every worker,
command or repair. Compact when continuing unfinished related work. Prefer a fresh coordinator
chat at the next substantial capability boundary when START HERE and the packet suffice; retain
only the short resume pointers. Neither repeated compaction nor fresh chats substitute for these
usage controls. Do not make the owner monitor workers or restate this policy in session prompts.

### Worker contract

A worker returns a compact `RESULT BLOCK` and nothing else: changed paths, outcome, checks run
with their results, evidence locations, and unresolved items. Do not relay worker transcripts
and do not re-summarize the plan; cite section headings instead.

### Completion sequence

Run in this order for runtime/tooling candidates; documentation-only changes use their scoped
gate above. Do not start an expensive repository-wide gate while known audit or repair work
remains for that candidate. Independent focused browser work may proceed during review outages.

1. Implement only the assigned slice.
2. Run the packet's declared acceptance checks and the relevant regression checks.
3. Fix focused-check failures.
4. Obtain the cross-family audit when the slice requires one.
5. Reproduce and repair established findings, rerun affected checks, and obtain independent
   closure of material findings.
6. Freeze the audit-cleared candidate on a detached checkout; review immutable evidence, never
   a changing live tree. A review-blocked runtime candidate cannot pass this integration step.
7. Run the repository-wide gate from the bindings table. Run required UI journeys on the frozen
   candidate, then the full check once, last; repeat only after a relevant change or failure.
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

For frontend work, agents own functional QA before asking the owner for design judgment. Use the
repo's Playwright CLI/test runner or declared browser equivalent to exercise actual user
journeys, not only components. Each UI packet names the affected journey and error/recovery
paths, viewport(s), feature-flag state, fixture versus live backend, and observable assertions.
Reuse relevant tests; add coverage where a required outcome is absent, not tests that mirror code.

Retain the candidate/build identity, command, exit code, passed/failed/skipped counts and reasons,
and screenshots/traces or print output where needed to prove visibility or layout. A passing
flags-OFF suite that skips the feature is not feature proof: run the affected journey with the
feature enabled in an isolated local test instance, without changing production flags or the
owner's preview. Mocked responses establish controlled UI behavior, not live backend integration.

Before claiming a frontend complete, cover its required journey matrix, including responsive,
theme, loading/error, persistence, accessibility interactions and print states where applicable;
compare the required prototype experience and run a bounded live-backend journey where the
feature has a backend, within existing authorization and canary budgets. Static or entirely local
journeys record that live integration is not applicable and prove their real local behavior
instead. Report blocked live steps separately and continue independent controlled/browser coverage. The owner reviews
subtle visual choices and product decisions; they are not the first functional smoke tester.

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

### Packet size discipline

A slice packet is a specification, not a session log. It is read in full at the start of every
session, so its size is a recurring cost paid by every future session.

- Cap a packet at 12 KB, roughly 3,000 tokens. Measure bytes, not lines. A packet can hold 30 KB
  in 300 lines when its prose is unwrapped, so a line count hides the real cost.
- A packet carries exactly one `## Stopped` section, and that section is at most 4 KB. A frozen
  handoff is a set of pointers to evidence, never the evidence itself.
- Superseded `## Stopped` sections, completed `RESULT BLOCK`s, and every dated session record
  (`## Accepted — <date>`, `## Independent audit — <date>`, `## Resumed — …`) move to
  `SLICE-<ID>-LOG.md` beside the packet, newest first. No session reads that file. It exists so
  the packet can stay small.
- A session cut off mid-work — a usage limit, an interrupt — writes down everything it knows.
  That dump is correct behaviour, not a violation of the cap: an ending session cannot tell
  what the next one will need. The **resuming** session compresses it to pointers as its first
  act, before anything else. It has just read the dump, so it is the cheapest and safest place
  to decide what mattered. Never compress another session's handoff without having read it.
- This protocol section is capped at 24 KB. A section already over the cap is trimmed at the next
  closeout, not appended to.
- At either cap, something is archived or compressed. Nothing is appended past a cap.
- At closeout the coordinator prints its starting read set: the byte size of this protocol
  section, of the master document's `## START HERE` block, and of the packet it read. A number in
  the log is what stops slow drift.

### Effort tiers

The coordinator does two jobs whose cost differs by an order of magnitude. Bind the model and
effort to the job, not to the session. Tiers are named by strength, never by provider.

| Job | Tier |
| --- | --- |
| Write a new slice packet | strongest available model, high effort |
| Run a packet that is already written | mid-tier model, medium effort |
| Judge a bounced, blocked or deviating candidate | strongest available model, high effort |
| Closeout and `## START HERE` rewrite | mid-tier model, low effort |

Workers default to a mid-tier model at medium effort. Escalate a worker only when its packet
declares the work high-risk, or when a first pass fails acceptance. Auditors keep the
cross-family rule above; family matters more than tier for a review.

Writing a packet and running it are separate sessions. A packet session reads this section, the
`## START HERE` block and any cited headings, writes one packet, spawns no workers, and ends.
Before ending, that same packet session rewrites the one `## START HERE` line naming the slice it
just wrote: the planned slice ID is replaced by the packet's path, marked dependency-ready, and
that single-line edit is committed together with the packet. A closeout session names a next slice
by ID only, with no path, because its packet does not exist yet. Without this handshake the
pointer stays one step behind and the execution session refuses work that is already ready.
An execution session runs a packet that already exists. If `## START HERE` names no written,
dependency-ready packet, the execution session stops and asks for a packet session instead of
switching modes mid-session at the wrong tier.
