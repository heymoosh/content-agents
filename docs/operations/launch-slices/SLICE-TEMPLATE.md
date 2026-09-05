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

Group the paths into lanes that share no file. Lanes run at the same time, one worker each.
A single-lane packet needs a one-line reason why the work does not divide.

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
