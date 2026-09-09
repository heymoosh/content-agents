# SLICE-6I: give the closeout read-set print one written, reproducible form

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

The protocol's `### Packet size discipline` ends with a standing requirement: "At closeout the
coordinator prints its starting read set: the byte size of this protocol section, of the master
document's `## START HERE` block, and of the packet it read." No commands for those three numbers
are written down anywhere. Each session re-derives them, and the obvious derivation is wrong:
SLICE-6G found that `awk '/^## START HERE/{f=1} f&&/^## [^S]/{exit} f'` runs straight past
`## Standing constraints` and reports 3,317 B where the block is 927 B — a 3.6x overstatement of
the number that is supposed to detect drift. 6G repaired that inside its own `## Verify`; the
corrected recipe was never lifted anywhere reusable, and the very next slice (6H) closed out
without a read-set line at all.

When this slice is done, `docs/operations/slice-protocol-environment.md` carries a
`### Read-set measurement` section holding the three exact commands, the two cap numbers they are
compared against, and the extraction trap that makes the naive form wrong; and
`SLICE-TEMPLATE.md` → `## Closeout` points at it, the same way it already points at
`### Hygiene disposition`. This is the 6H move applied to the second closeout item that was being
asserted by hand: take a protocol requirement with no written assertable form, and give it one.

## Difficulty

easy — one new documentation section plus one pointer line; the commands are already proven
below and need transcribing, not inventing.

## Depends on

none — 6H is accepted; this slice edits a different section of the same bindings file.

## Owned files

Parallel-safe: no. Three deliverables, two of which are a section and the one-line pointer into
it; the pointer's wording depends on the section's final heading and file, so splitting them
would buy a handoff and no independent deliverable. Total edit is under 40 lines in two files.
A second lane would add coordination cost with nothing to verify independently.

### Lane A — the written measurement form and its pointer

- `docs/operations/slice-protocol-environment.md`
- `docs/operations/launch-slices/SLICE-TEMPLATE.md`
- `docs/operations/launch-slices/SLICE-6I.md` (this packet's `## RESULT BLOCK` only)

## Do not touch

- `AGENTS.md` — the protocol section is 24,568 B against a 24,576 B cap. Eight bytes of headroom.
  Nothing in this slice goes there. It must stay byte-identical to `HEAD`.
- `docs/content-studio-master-status.md` — the coordinator rewrites `## START HERE` at closeout;
  the worker does not open or edit it.
- Every other file under `docs/operations/launch-slices/`, including all `*-LOG.md` siblings.
- `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` and
  `data/notes-spread-ledger.jsonl` — uncommitted work belonging to another session.

## Cited headings

`none` — the goal above restates everything the worker needs. Do not open the master document.

## Acceptance

- [ ] `docs/operations/slice-protocol-environment.md` contains exactly one line matching
      `^### Read-set measurement`.
- [ ] That section contains three shell commands, one for each read-set number: the
      `## Slice protocol` section bytes from `AGENTS.md`, the `## START HERE` block bytes from
      `docs/content-studio-master-status.md`, and the byte size of one
      `docs/operations/launch-slices/SLICE-<ID>.md`.
- [ ] Each of the three commands, copied verbatim and run from the repository root, exits 0 and
      prints exactly one integer (leading whitespace from `wc` is permitted).
- [ ] The section gives each command in a `git show HEAD:<path> | …` pinned form as well, and the
      pinned protocol-section command prints `24568` and the pinned START-HERE command prints
      `927` when run at the commit this slice starts from.
- [ ] The section states both caps as exact byte numbers — 12288 for a `SLICE-<ID>.md` packet and
      24576 for the `## Slice protocol` section — and states that a measured value strictly
      greater than its cap is the violation.
- [ ] The section names the extraction trap explicitly: a terminator predicate of `/^## [^S]/`
      does not stop at `## Standing constraints`, and it records the two numbers that show it
      (927 correct against 3317 from the broken form).
- [ ] The section states that the three numbers are printed at closeout, per
      `AGENTS.md` → `## Slice protocol` → `### Packet size discipline`.
- [ ] `SLICE-TEMPLATE.md` → `## Closeout` contains a pointer naming `### Read-set measurement` in
      `docs/operations/slice-protocol-environment.md`.
- [ ] The existing `### Hygiene disposition` pointer lines in `SLICE-TEMPLATE.md` → `## Closeout`
      are unchanged from `HEAD`.
- [ ] `git diff HEAD -- AGENTS.md` produces no output.
- [ ] `wc -c < docs/operations/launch-slices/SLICE-6I.md` is at most 12288.
- [ ] `git status --porcelain` lists no modified or added path outside `## Owned files`, other
      than the two `## Do not touch` content paths that were already modified before this slice
      started.
- [ ] `git diff --check` exits 0.

## Verify

Classification and applicable gate: documentation only. The changed files are prose read by
coordinators and workers; neither is executable configuration, a generated input, or a runtime
prompt, and no application code path reads them. Per the protocol's documentation-only exception
this takes coordinator diff review for accuracy plus a whitespace check, and skips `npm run check`,
the runtime closeout command and the detached-checkout freeze. It still takes a cross-family
audit, because the whole value of the deliverable is that the transcribed commands are correct
and a same-family reader is the one most likely to reproduce the original derivation error.

For UI changes: not applicable. No page, journey, viewport or flag is touched, and there is no
backend, so live integration is not applicable.

```
cd /Users/Muxin/Documents/GitHub/content-agents

# 1. exactly one new heading
awk '/^### Read-set measurement/{n++} END{print n}' docs/operations/slice-protocol-environment.md

# 2. the three commands, live tree
awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' AGENTS.md | wc -c
awk '/^## START HERE/{f=1} f&&/^## /&&!/^## START HERE/{exit} f' docs/content-studio-master-status.md | wc -c
wc -c < docs/operations/launch-slices/SLICE-6I.md

# 3. the same three pinned to the starting commit (expect 24568 and 927)
git show HEAD:AGENTS.md | awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' | wc -c
git show HEAD:docs/content-studio-master-status.md | awk '/^## START HERE/{f=1} f&&/^## /&&!/^## START HERE/{exit} f' | wc -c

# 4. the trap the section documents (expect 3317, not 927)
git show HEAD:docs/content-studio-master-status.md | awk '/^## START HERE/{f=1} f&&/^## [^S]/{exit} f' | wc -c

# 5. the template pointer, and the untouched hygiene pointer
awk '/^## Closeout/{f=1} f&&/^## /&&!/^## Closeout/{exit} f' docs/operations/launch-slices/SLICE-TEMPLATE.md

# 6. AGENTS.md untouched, whitespace clean, nothing stray
git diff HEAD -- AGENTS.md | wc -c
git diff --check; echo "diff --check exit: $?"
git status --porcelain
```

## Observable result

Muxin opens `docs/operations/slice-protocol-environment.md`, finds
`### Read-set measurement`, copies the three commands into a terminal at the repository root, and
gets three integers with the two caps stated beside them. She can also see, in the same section,
the one-line reason the obvious version of the START HERE command is wrong and by how much.

## Risk

low — audit required: yes. The deliverable is a set of commands that a future session will trust
without re-deriving. A transcription error, a wrong cap number, or a terminator predicate that
regresses to 6G's bug would be silently inherited by every later closeout, which is the exact
failure this slice exists to stop. Nothing else about the change is risky: two prose files, no
executable path, fully reversible by `git revert`.
Review boundary: this candidate.
Review scope/budget: one bounded cross-family review at ordinary effort, answering two questions —
(a) does each documented command, run as written, produce the number the section claims, and
(b) does the section's account of the `/^## [^S]/` trap match what that predicate actually does.
Supply the diff, the changed-file list and the `## Verify` output. No repository export.
Prior accepted evidence: none carried in; this is the first candidate for 6I.
On reviewer outage: the candidate is review-blocked and is not integrated. Retry condition is the
reviewer starting successfully and returning a verdict; record the failed launch in `## Stopped`,
not as a completed audit. Independent authorized work during an outage: none in this slice, so
take the stopping-without-acceptance branch rather than waiting.

## Families

- Builder: Claude, mid-tier, medium effort — one lane, documentation only, low risk.
- Auditor: Codex (GPT family), ordinary effort — different family from the builder, and the
  established cross-family reviewer in this repo per the 6F/6G/6H entries. Per the bindings'
  machine facts, launch it unsandboxed if a sandboxed launch returns `Operation not permitted`.

## Closeout

Documentation only: record the scoped review/diff result in this packet.

```
bash scripts/repo-hygiene.sh --rescue
```

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for
the hygiene item — not a bare exit code.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: serial. A second lane would own the pointer line that depends on the first
  lane's heading, producing a handoff and no independent deliverable.
- Assignment: one Claude mid-tier worker at medium effort, fresh packet-sized context, holding
  this packet and the protocol section only. Frozen handoff is the worker's `RESULT BLOCK` plus
  the working-tree diff of the two owned documentation files.
- Evidence return: the `## Verify` block's commands with their exit codes and printed integers,
  the changed-file list, and a one-line result. No transcripts, no log files.
- Capability boundary: this slice is one coherent capability; run closeout once at its end. Use
  the worker's completion notification rather than polling. Next resume pointer goes into
  `## START HERE` at closeout.
