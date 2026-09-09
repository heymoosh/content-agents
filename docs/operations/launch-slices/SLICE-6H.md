# SLICE-6H: make the hygiene closeout item something a slice can actually assert

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

A packet author has a written, assertable form for the hygiene closeout, so no future packet
writes an acceptance item that the closeout rule forbids any slice from satisfying.

`bash scripts/repo-hygiene.sh --rescue` exits non-zero whenever it lists anything, and the
closeout rule requires a session to *report and leave* every path it did not create. So a packet
that says "hygiene exits 0" can only pass on a repository that happens to be empty of other
sessions' work. SLICE-6G hit exactly this and had to record an accepted deviation instead
(`SLICE-6G-LOG.md`), judging it as: run, reviewed, own paths committed, everything else named
and untouched. That judgement becomes the written rule here.

When this slice is done, two files say the same thing: the bindings file carries a
`### Hygiene disposition` subsection defining the form, and `SLICE-TEMPLATE.md` → `## Closeout`
tells a packet author to use it.

## Difficulty

easy — two bounded documentation edits, no executable input, no behavior change.

## Depends on

none. (6G is accepted; this slice records the deviation it already resolved by judgement.)

## Owned files

Parallel-safe: **no** — the whole deliverable is two short prose edits totalling under ~1.5 KB
across two files. Splitting them into two lanes was considered and rejected: neither file's edit
produces a useful independent deliverable, and the two must agree in wording, so a split would
add a cross-lane consistency handoff costlier than the work. Single worker, single lane.

### Lane A — the hygiene disposition form, written once and pointed at

- `docs/operations/slice-protocol-environment.md`
- `docs/operations/launch-slices/SLICE-TEMPLATE.md`
- `docs/operations/launch-slices/SLICE-6H.md` (RESULT BLOCK only)

Pinned read-only inputs: `docs/operations/launch-slices/SLICE-6G-LOG.md` at `HEAD`, for the
recorded deviation wording only. Do not edit it.

## Do not touch

- `AGENTS.md` — `## Slice protocol` is 24,550 B against a 24,576 B cap. The rule goes in the
  bindings file precisely because that section has 26 B of headroom. Any edit here fails the slice.
- Every other `docs/operations/launch-slices/SLICE-*.md` and `SLICE-*-LOG.md`, including
  `SLICE-6G.md` — its deviation is accepted history and is not retro-fixed.
- `docs/content-studio-master-status.md` — the coordinator edits START HERE at integration.
- `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` and
  `data/notes-spread-ledger.jsonl` — another session's uncommitted work, left exactly as found.
- `src/`, `config/`, `scripts/` — no executable input changes in this slice.

## Cited headings

none

## Acceptance

Every item below is checked by a command in `## Verify`.

- [ ] 1. `docs/operations/slice-protocol-environment.md` contains exactly one line matching
  `^### Hygiene disposition`.
- [ ] 2. That subsection states in prose that a non-zero exit from
  `bash scripts/repo-hygiene.sh --rescue` is not by itself a slice failure when every item it
  lists is a path this session did not create.
- [ ] 3. That subsection enumerates the four things a packet asserts instead of an exit code:
  the command was run; its output was reviewed; every path this session created was committed or
  deleted; every other path was named and left in place.
- [ ] 4. That subsection contains the literal string `scripts/repo-hygiene.sh --rescue`.
- [ ] 5. `SLICE-TEMPLATE.md` → `## Closeout` contains the literal string
  `### Hygiene disposition`, pointing a packet author at the form.
- [ ] 6. `SLICE-TEMPLATE.md` contains no line matching `hygiene.*exits? 0` (extended regex).
- [ ] 7. `AGENTS.md` is byte-identical to `HEAD` (`git diff --name-only HEAD -- AGENTS.md` is empty).
- [ ] 8. `git diff --name-only HEAD -- docs/operations/launch-slices/` lists only
  `docs/operations/launch-slices/SLICE-6H.md` and
  `docs/operations/launch-slices/SLICE-TEMPLATE.md`.
- [ ] 9. `docs/operations/slice-protocol-environment.md` is ≤ 8192 B and `SLICE-TEMPLATE.md` is
  ≤ 8192 B.
- [ ] 10. `docs/operations/launch-slices/SLICE-6H.md` is ≤ 12288 B.
- [ ] 11. `git diff --check` exits 0.
- [ ] 12. Hygiene disposition for this slice is recorded in the RESULT BLOCK in the new form:
  command run, output reviewed, session-created paths committed or deleted (each named), all
  other listed paths named and left. An exit code alone is not an acceptable entry.

## Verify

Classification and applicable gate: **documentation only**. No executable input, generated
input, or runtime prompt changes; `scripts/`, `src/` and `config/` are untouched. Per the
protocol's documentation-only exception this takes coordinator review for accuracy, links and
rule consistency plus a whitespace/diff check — no application build, no `npm run check`, no UI
journey. There is no UI change, so no journey matrix, viewport, flag or backend question applies;
live integration is not applicable.

Run from the repository root. Exit codes are read directly, never through a pipe.

```
set -x
grep -c '^### Hygiene disposition' docs/operations/slice-protocol-environment.md          # 1
awk '/^### Hygiene disposition/{f=1;next} f&&/^### /{exit} f' \
  docs/operations/slice-protocol-environment.md                                          # 2,3,4
grep -c 'scripts/repo-hygiene.sh --rescue' docs/operations/slice-protocol-environment.md # 4, >=1
awk '/^## Closeout/{f=1;next} f&&/^## /{exit} f' \
  docs/operations/launch-slices/SLICE-TEMPLATE.md                                        # 5
grep -Ec 'hygiene.*exits? 0' docs/operations/launch-slices/SLICE-TEMPLATE.md; echo "exp 0"  # 6
git diff --name-only HEAD -- AGENTS.md; echo "expect empty"                              # 7
git diff --name-only HEAD -- docs/operations/launch-slices/                               # 8
wc -c docs/operations/slice-protocol-environment.md \
      docs/operations/launch-slices/SLICE-TEMPLATE.md \
      docs/operations/launch-slices/SLICE-6H.md                                          # 9,10
git diff --check; echo "diff-check exit $?"                                              # 11
bash scripts/repo-hygiene.sh --rescue; echo "hygiene exit $? (disposition, not pass/fail)" # 12
```

Items 2, 3 and 5 are judged by the coordinator reading the printed sections against the wording
required above; the `awk` calls exist to print exactly those sections and nothing else.

## Observable result

Open `docs/operations/slice-protocol-environment.md` and read `### Hygiene disposition`. It says
what a packet must assert about hygiene and why an exit code is the wrong assertion. Open
`SLICE-TEMPLATE.md` → `## Closeout` and it sends you there. A packet author who reads only the
protocol section, the bindings file and the template now writes an achievable hygiene item.

## Risk

**low** — audit required: **yes, bounded**. The change is prose only and reversible in one
commit, but it defines a rule future sessions apply without re-deriving it, and SLICE-6G showed
a cross-family reviewer catching meaning changes in documentation edits that every mechanical
check passed. One bounded review of the two-file diff, not a repository review.

Review boundary: this candidate.
Review scope/budget: one ordinary-effort pass over the candidate diff, the changed-file list and
the printed sections. Two unanswered questions for the auditor: (a) does the new wording forbid
anything the closeout rule permits, or permit anything it forbids; (b) does it contradict the
`Hygiene command` row in `### Repo bindings`. No repository export, no wider sweep.
Prior accepted evidence: none retained; this is a first candidate.
On reviewer outage: this is a documentation-only candidate, so the documentation-only clause
applies — the coordinator completes the bounded diff review itself and records that it did so,
naming the reviewer that was unavailable. Do not substitute a same-family audit.

## Families

- Builder: **Claude, mid-tier, medium effort** — bounded prose edit against a fully specified
  target; strongest tier would add cost without changing the outcome.
- Auditor: **Codex (GPT family), ordinary effort**, `codex exec --sandbox read-only`, run
  unsandboxed locally if the sandbox returns `Operation not permitted`. Different family from the
  builder, as required. Grok is the fallback family only if Codex is unavailable; per the
  bindings, Grok launches with `--sandbox workspace` on this machine.

## Closeout

Documentation only: record the scoped review/diff result in this packet. There is no closeout
gate binary in this repository, so record `PASS` or the leftover list here.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: none — serial, because a second lane would only repeat this packet's context
  and add a wording-consistency handoff for under 1.5 KB of prose.
- Assignment: one Claude mid-tier worker, medium effort, fresh packet-sized context. Frozen
  handoff is the worker's RESULT BLOCK plus the unmodified working tree; the coordinator freezes
  the diff before sending it to the auditor.
- Evidence return: the `## Verify` block's commands with their exit codes, the two printed
  sections, byte counts, and the hygiene disposition in the item-12 form. No transcripts.
- Capability boundary: this closes the "packets assert achievable things" capability opened by
  SLICE-6G's accepted deviation. Automatic closeout after integration; next resume pointer is the
  master document's `## START HERE`.
