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

```
<exact command>
```

## Observable result

<what the owner can look at and judge>

## Risk

<low | medium | high> — audit required: <yes | no>

## Families

- Builder: <family and tier> — one per lane above
- Auditor: <different family and tier, or `not required`>

## Closeout

```
<closeout gate command from AGENTS.md bindings>
```

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
