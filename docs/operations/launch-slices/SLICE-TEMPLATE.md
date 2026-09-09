# SLICE-<ID>: <one line>

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

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

Before assigning workers, separate preparation, execution, and verification. Identify useful
independent deliverables; a shared execution budget or final artifact serializes only the
operations that modify or consume it. Use parallel lanes when the protocol's three conditions
hold: disjoint write ownership, no repo-wide rewriting commands, and checks that write only
lane-owned paths and read only lane-owned files or explicitly named immutable shared inputs.

For each lane, list its deliverable, owned paths (including temporary/check outputs), pinned
read-only inputs, focused checks, dependencies and frozen handoff checkpoint. Do not read another
lane's unfinished output. Prepare verification tooling independently where useful; actual
candidate verification waits for the frozen handoff.

Parallel-safe: <yes — name concurrent lanes and serialized handoffs | no — name the concrete
blocking dependency/resource conflict and the independent split considered; for a small task,
explain why a separate assignment would add cost without a useful independent deliverable>

### Lane A — <what this lane delivers>

- <path>

### Lane B — <what this lane delivers, or delete this lane>

- <path>

## Do not touch

- <path or area>

## Cited headings

<`docs/content-studio-master-status.md` → `## heading` for each one the worker may open, or `none`>

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
