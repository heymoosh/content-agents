# SLICE-<ID>: <one line>

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

<what is demonstrably true when this slice is done>

## Difficulty

<easy | hard> — <one line of why>

## Depends on

<slice IDs that must be accepted first, or `none`>

## Owned files

Group the paths into lanes. Lanes run at the same time, one worker each, but only if all three
safety conditions in the protocol hold — no shared path or directory, no repo-wide rewriting
command inside a lane, and lane-local verification. Confirm below that they hold, or run the
lanes one at a time. A single-lane packet needs a one-line reason why the work does not divide.

Parallel-safe: <yes — all three conditions hold | no — lanes run one at a time because ...>

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

Documentation only: record the scoped review/diff result in this packet. Otherwise:

```
<closeout gate command from AGENTS.md bindings>
```

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
