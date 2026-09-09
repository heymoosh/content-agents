# SLICE-6J: give the closeout gate item one written, assertable form

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only. Do not open
`docs/content-studio-master-status.md` unless a heading is cited below. Do not load the
repository for context. Do not commit.

## Goal

`SLICE-TEMPLATE.md` → `## Closeout` asks every packet author to fill a fenced code block with
"`<closeout gate command from the protocol bindings>`", but this repository's bindings row sets
`Closeout gate` to `none — record PASS or the leftover list in the slice packet`. The template
asks for a command that does not exist here, and each author resolved that differently:
`SLICE-6G.md` and `SLICE-6H.md` each wrote their own sentence to the effect that the gate is
`none`, while `SLICE-6I.md` put `bash scripts/repo-hygiene.sh --rescue` in the fenced gate slot,
promoting the hygiene command into the gate role and then asking for it again in the hygiene item
below. Three packets, three readings of one field.

This is the third and last closeout item still asserted by hand; 6H wrote
`### Hygiene disposition` and 6I wrote `### Read-set measurement` for the other two. When this
slice is done, the bindings file carries `### Closeout gate disposition` saying what a packet must
record when the gate binding is `none`, and `SLICE-TEMPLATE.md` → `## Closeout` points at it
instead of prompting for a command.

## Difficulty

easy — one new documentation section plus a template edit removing a fenced block and adding a
pointer. No command is invented; the disposition transcribes the bindings row and the protocol's
`### Mandatory closeout gate` fallback.

## Depends on

6H and 6I, both accepted — this slice adds the third pointer beside theirs and leaves both of
their pointer lines byte-identical.

Delivery batch: SLICE-6J only — one documentation-only deliverable pair (a bindings section, then
the template pointer naming it). Stop condition: both files accepted and committed, or the
stopping-without-acceptance branch. A free slot does not authorize another slice.
Owner checkpoint: none. The scope decision — a `none` gate binding is recorded, not run — is
already made in the bindings table and in `AGENTS.md` → `### Mandatory closeout gate`.

## Owned files

Parallel-safe: no. The two deliverables are a section and the one line naming it, so the
pointer's wording depends on the section's final heading. Splitting them buys a frozen handoff and
no independently verifiable deliverable; the whole edit is under 35 lines across two files.

### Lane A — the written closeout-gate disposition and its template pointer

- `docs/operations/slice-protocol-environment.md`
- `docs/operations/launch-slices/SLICE-TEMPLATE.md`
- `docs/operations/launch-slices/SLICE-6J.md` (its `## RESULT BLOCK` only)

## Do not touch

- `AGENTS.md` — 24,568 B against a 24,576 B cap. Nothing here goes there; it stays
  byte-identical to `HEAD`.
- `docs/content-studio-master-status.md` — the coordinator rewrites `## START HERE` at closeout.
- `SLICE-6G.md`, `SLICE-6H.md`, `SLICE-6I.md` and every other file under
  `docs/operations/launch-slices/`, `*-LOG.md` siblings included. Their `## Closeout` wording is
  history; this slice fixes the template, not past packets.
- The `### Hygiene disposition` and `### Read-set measurement` sections of the bindings file, and
  their pointer lines in `SLICE-TEMPLATE.md`.
- `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` and
  `data/notes-spread-ledger.jsonl` — another session's uncommitted work.

## Cited headings

`none` — the goal restates everything the worker needs. Do not open the master document.

## Acceptance

- [ ] `docs/operations/slice-protocol-environment.md` contains exactly one line matching
      `^### Closeout gate disposition`.
- [ ] That section states this repository's `Closeout gate` binding is `none` and quotes the row's
      instruction to record `PASS` or the leftover list in the slice packet.
- [ ] That section states the assertable form: the packet's `## Closeout` carries either a line
      beginning `**PASS**` with a date, or an explicit list of what is left, written before the
      slice closes.
- [ ] That section states no command belongs in the `## Closeout` gate slot while the binding is
      `none`, and names `bash scripts/repo-hygiene.sh --rescue` as a separate hygiene item that
      must not be recorded as the closeout gate.
- [ ] That section names `SLICE-6I.md` as the observed instance of that conflation.
- [ ] That section states a packet recording neither `PASS` nor a leftover list has not closed,
      per `AGENTS.md` → `## Slice protocol` → `### Mandatory closeout gate`.
- [ ] `SLICE-TEMPLATE.md` → `## Closeout` contains a pointer naming `### Closeout gate
      disposition` in `docs/operations/slice-protocol-environment.md`.
- [ ] `SLICE-TEMPLATE.md` → `## Closeout` contains zero lines starting with three backticks
      (verify command 4 prints `0`).
- [ ] The `Hygiene disposition` and `Read-set measurement` pointer lines in `SLICE-TEMPLATE.md`
      are unchanged from `HEAD` and each string still occurs exactly once in that file.
- [ ] `SLICE-TEMPLATE.md` still has one `Preflight:` line and one `Gate cost:` line, both
      unchanged from `HEAD`.
- [ ] `git diff HEAD -- AGENTS.md` produces no output.
- [ ] `git diff HEAD --` for `SLICE-6G.md`, `SLICE-6H.md`, `SLICE-6I.md` produces no output.
- [ ] `wc -c < docs/operations/launch-slices/SLICE-6J.md` is at most 12288.
- [ ] `git status --porcelain` lists no modified or added path outside `## Owned files` other
      than the two `## Do not touch` content paths already modified before this slice started.
- [ ] `git diff --check` exits 0.

## Verify

Classification and applicable gate: documentation only. Both changed files are prose; neither is
executable configuration, a generated input, or a runtime prompt, and no code path reads either.
Per that exception this takes coordinator diff review for accuracy, links and rule consistency
plus a whitespace check, and skips `npm run check`, the runtime closeout command and the
detached-checkout freeze. A bounded cross-family audit still applies: a same-family reader is
most likely to reproduce the template's original ambiguity.

For UI changes: not applicable. No page, journey, viewport or flag is touched and there is no
backend, so live integration is not applicable.

```
cd /Users/Muxin/Documents/GitHub/content-agents

# 1. exactly one new heading (expect 1)
awk '/^### Closeout gate disposition/{n++} END{print n+0}' docs/operations/slice-protocol-environment.md

# 2. the new section's text, for the content acceptance items
awk '/^### Closeout gate disposition/{f=1;print;next} f&&/^### /{exit} f' docs/operations/slice-protocol-environment.md

# 3. the template's Closeout section, for the pointer
awk '/^## Closeout/{f=1} f&&/^## /&&!/^## Closeout/{exit} f' docs/operations/launch-slices/SLICE-TEMPLATE.md

# 4. no fence left in that section (expect 0)
awk '/^## Closeout/{f=1} f&&/^## /&&!/^## Closeout/{exit} f&&/^```/{n++} END{print n+0}' docs/operations/launch-slices/SLICE-TEMPLATE.md

# 5. the other two pointers and the two trailing fields survive (expect 1 each)
grep -c 'Hygiene disposition' docs/operations/launch-slices/SLICE-TEMPLATE.md
grep -c 'Read-set measurement' docs/operations/launch-slices/SLICE-TEMPLATE.md
grep -c '^Preflight:' docs/operations/launch-slices/SLICE-TEMPLATE.md
grep -c '^Gate cost:' docs/operations/launch-slices/SLICE-TEMPLATE.md

# 6. untouched files, packet cap, whitespace, strays (expect 0, 0, <=12288)
git diff HEAD -- AGENTS.md | wc -c
git diff HEAD -- docs/operations/launch-slices/SLICE-6G.md docs/operations/launch-slices/SLICE-6H.md docs/operations/launch-slices/SLICE-6I.md | wc -c
wc -c < docs/operations/launch-slices/SLICE-6J.md
git diff --check; echo "diff --check exit: $?"
git status --porcelain
```

## Observable result

Muxin opens `SLICE-TEMPLATE.md` → `## Closeout` and sees three pointers of the same shape —
hygiene, read-set, closeout gate — and no prompt for a command this repository does not have. The
third leads to `### Closeout gate disposition`, which says what a packet must carry to be closed
here and names the packet that got it wrong.

## Risk

low — audit required: yes. Future packets apply this rule without re-deriving it and the failure
mode is silent: an overstated section forbids a legitimate closeout, an understated one re-admits
the conflation this slice exists to stop. Two prose files, no executable path, `git revert`able.
Review boundary: this candidate.
Review scope/budget: one bounded cross-family review at ordinary effort, two questions — (a) does
`### Closeout gate disposition` contradict the bindings' `Closeout gate` row or `AGENTS.md` →
`### Mandatory closeout gate`, either way; (b) does removing the fenced block from the template's
`## Closeout` drop any instruction the three pointers do not restate. Supply the diff, the
changed-file list and the `## Verify` output. No repository export.
Prior accepted evidence: none carried in; first candidate for 6J. 6H's and 6I's accepted sections
are inputs, not re-reviewed; a change to either reopens this.
On reviewer outage: review-blocked, not integrated. Retry condition is the reviewer starting and
returning a verdict; record a failed launch under `## Stopped`, never as a completed audit. No
independent authorized work remains, so take the stopping-without-acceptance branch, not a wait.

## Families

- Builder: Claude, mid-tier, medium effort — one lane, documentation only, low risk.
- Auditor: Codex (GPT family), ordinary effort — a different family from the builder and the
  established cross-family reviewer here per 6F/6G/6H/6I. Launch it unsandboxed if a sandboxed
  launch returns `Operation not permitted`.

## Closeout

Documentation only: record the scoped review/diff result here. The bindings' closeout gate is
`none`, so record `PASS` or the leftover list in this packet — the form this slice writes down.

**PASS** — 2026-09-09. Coordinator diff review plus cross-family Codex audit, no established
defect. One audit flag traced to auditor scope, not the candidate; recorded in `SLICE-6J-LOG.md`.

## RESULT BLOCK

Accepted 2026-09-09. The full RESULT BLOCK and the Codex audit are in `SLICE-6J-LOG.md`.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: serial. A second lane would own the pointer line depending on the first lane's
  heading — a handoff with no independent deliverable.
- Assignment: one Claude mid-tier worker, medium effort, fresh packet-sized context holding this
  packet and the protocol section only. Frozen handoff is the `RESULT BLOCK` plus the diff of the
  two owned files.
- Evidence return: the `## Verify` commands with exit codes and printed values, the changed-file
  list, one-line result. No transcripts or logs.
- Capability boundary: one coherent capability; closeout once at its end. Use the completion
  notification, not polling. The next resume pointer goes into `## START HERE`.
