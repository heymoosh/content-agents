# SLICE-<ID>: <one line>

Optional orchestration brief. Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. The owning session may read the repository context
needed to complete the work. A worker receives the paths and context needed for its assignment and
never commits or integrates.

## Goal

<what is demonstrably true when this slice is done>

## Difficulty

<easy | hard> — <one line of why>

## Depends on

<slice IDs that must be accepted first, or `none`>

Delivery batch: <authorized slice IDs; design/implementation deliverables; acceptance order
and stop condition — a free slot does not authorize another slice>
Owner checkpoint: <resolved scope decisions; human-only acceptance actions and when needed;
availability/dependencies, or `none` — engineering choices remain with the coordinator>

## Owned files

Before assigning workers, identify useful independent deliverables. Use parallel lanes only when
write ownership is disjoint, no worker runs repo-wide rewriting commands, and worker checks write
only to owned paths. A session working alone does not invent lanes or delegation paperwork.

For each worker lane, list its deliverable, owned paths (including temporary/check outputs), shared
read-only inputs, focused checks, dependencies and handoff checkpoint. Verification of the
candidate waits for the completed handoff.

Parallel-safe: <yes — name concurrent lanes and serialized handoffs | no workers — delegation adds
no useful independent deliverable | no — name the concrete ownership or dependency conflict>

### Lane A — <what this lane delivers>

- <path>

### Lane B — <what this lane delivers, or delete this lane>

- <path>

## Do not touch

- <path or area>

## Relevant context

<paths, symbols, requirements, and any master-document headings relevant to this brief>

## Acceptance

- [ ] <checkable statement>

## Verify

Classification and applicable gate: <documentation only | low-risk copy/mechanical | meaningful
behavior/high risk | feature/experience completion; reason and required checks>

For UI changes: <affected journey and error/recovery paths; viewports; feature flags; fixture
versus live backend; observable assertions; existing browser coverage or missing experiment>
Retain candidate/build identity, commands, exits, pass/fail/skip counts and reasons, and necessary
screenshots/traces/print proof. Flags-OFF skips are not feature proof; controlled responses are
not live integration proof. Static/local-only journeys mark live integration not applicable.
Documentation-only changes use scoped review/diff checks and record the result in the packet,
not application builds or runtime closeout commands.

```
<exact command>
```

## Observable result

<what the owner can look at and judge>

## Risk

<low | medium | high> — audit required: <yes | no; evidence-based reason>
Review boundary: <this candidate | named batch before integration | coordinator documentation review>
Review scope/budget: <unanswered questions and bounded inputs; ordinary effort unless justified>
Prior accepted evidence: <candidate/input hashes and dispositions retained; what would reopen them>
On reviewer outage: <blocked candidate, retry condition, independent authorized work; no integration
of a candidate whose required review is pending>

## Families

- Builder: <family and tier> — one per lane above
- Auditor: <different family, model and effort with reason, or `not required`; preserve explicit owner choice>

## Closeout

Documentation only: record the scoped review/diff result in this packet. Otherwise, use the
`### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md` for the
closeout gate item — not a fenced command.

Preflight: <schema/required fields; pinned candidate and changed paths; ownership; every
acceptance item mapped to accessible evidence; check exit codes; independent audit policy
and evidence completeness; all final-gate prerequisites closed>
Gate cost: <exact command and candidate identity; measured local runtime with evidence or
`unknown`; any additional audit/rerun and its distinct reason; no paperwork-only rerun without
first explaining cost and proposing a separate bounded fix; no bypass or unsupported reuse>

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for
the hygiene item — not a bare exit code.

Use the `### Read-set measurement` form in `docs/operations/slice-protocol-environment.md` for
the closeout read-set print — not an ad hoc re-derivation.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
- Delivery state and next action: <built | verified | accepted | committed; workers cannot accept/commit>
- Usage: <local check elapsed time separately from model calls/provider-reported usage;
  unavailable values `unknown`; prior history behind evidence pointers>

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: <independent result and expected benefit, or serial because delegation adds only overhead>
- Assignment: <worker model/effort; fresh context or related repair reuse; frozen handoff>
- Evidence return: <command, exit, counts, candidate identity, short result and artifact pointers>
- Capability boundary: <automatic closeout and next resume pointer; completion notifications, no routine polling>

## Stopped

<Current frozen handoff only — one section, at most 4 KB, and only while the slice is paused.
Pointers to evidence, not the evidence. Move superseded `## Stopped` sections, completed
`RESULT BLOCK`s and dated session records into `SLICE-<ID>-LOG.md` beside this packet. This
packet stays under 12 KB.>
