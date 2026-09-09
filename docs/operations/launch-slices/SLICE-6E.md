# SLICE-6E: bring ten over-cap accepted slice packets under the 12 KB cap

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Ten long-accepted slice packets each measure at most 12,288 bytes, and every line removed from a
packet appears verbatim in its `SLICE-<ID>-LOG.md` beside it. No packet loses a live
specification field; only dated session records (`## Accepted — …`, `## Independent audit — …`,
`## Resumed — …`), completed `RESULT BLOCK`s and superseded `## Stopped` sections move.

## Difficulty

easy — bounded, mechanical prose surgery with a machine-checkable no-loss invariant.

## Depends on

none. This slice is deliberately disjoint from SLICE-6D: it touches no source file, no 6D
evidence, and no path any other session has left modified or untracked. It may proceed while the
6D full gate is still running.

## Owned files

Both lanes are documentation-only, edit disjoint file sets, run no repo-wide rewriting command,
and their checks write only to `$TMPDIR`. The protocol's three parallel conditions hold, so the
two lanes run concurrently. Each lane's independent deliverable is five capped packets plus five
archive files; splitting halves wall time on ~90 KB of careful line-by-line prose triage and adds
no shared bookkeeping, because no path is shared.

Parallel-safe: yes — Lane A and Lane B write disjoint paths. Serialized handoff: each lane
freezes and returns its `RESULT BLOCK`; the coordinator alone reviews the combined diff, runs
hygiene and commits.

### Lane A — five capped packets and their archives

- `docs/operations/launch-slices/SLICE-5C.md`
- `docs/operations/launch-slices/SLICE-5D.md`
- `docs/operations/launch-slices/SLICE-5G.md`
- `docs/operations/launch-slices/SLICE-5J.md`
- `docs/operations/launch-slices/SLICE-5K.md`
- `docs/operations/launch-slices/SLICE-5C-LOG.md`, `SLICE-5D-LOG.md`, `SLICE-5G-LOG.md`,
  `SLICE-5J-LOG.md`, `SLICE-5K-LOG.md` (new)
- `$TMPDIR/6e-lane-a/` (check scratch)

### Lane B — five capped packets and their archives

- `docs/operations/launch-slices/SLICE-5L.md`
- `docs/operations/launch-slices/SLICE-5M.md`
- `docs/operations/launch-slices/SLICE-5N.md`
- `docs/operations/launch-slices/SLICE-5O.md`
- `docs/operations/launch-slices/SLICE-5Q.md`
- `docs/operations/launch-slices/SLICE-5L-LOG.md`, `SLICE-5M-LOG.md`, `SLICE-5N-LOG.md`,
  `SLICE-5O-LOG.md`, `SLICE-5Q-LOG.md` (new)
- `$TMPDIR/6e-lane-b/` (check scratch)

## Do not touch

- `docs/operations/launch-slices/SLICE-6D.md` and `SLICE-6D-LOG.md` — live blocked handoff.
- `SLICE-5H.md`, `SLICE-5P.md`, `SLICE-5R.md`, `SLICE-5S.md`, `SLICE-5T.md`, `SLICE-5W.md`,
  `SLICE-5X.md`, `SLICE-5Y.md`, `SLICE-5Z.md`, `SLICE-6B.md`, `SLICE-6C.md` and their `-LOG.md`
  twins — another session's uncommitted work. `SLICE-5T.md` (12,346 B) and `SLICE-5Z.md`
  (15,775 B) are over cap and are deferred to a later slice for that reason, not overlooked.
- `AGENTS.md` and `docs/operations/launch-slices/SLICE-TEMPLATE.md` — pre-existing edits preserved
  by the 6D handoff. The protocol section is 28,217 B, over its own 24 KB cap; trimming it is a
  separate slice and is out of scope here.
- `docs/operations/launch-slices/SLICE-5L-coverage.md` — companion analysis, not a packet.
- `docs/content-studio-master-status.md` — coordinator writes it at closeout, not a lane.
- All source, config, `data/`, `content/`, `stories/`, `venture/`, `charles/`.
- `/private/tmp/slice-6d-evidence/` and the three 6D checkouts.

## Cited headings

none

## Acceptance

- [ ] Each of the ten owned packets measures ≤ 12,288 bytes (`wc -c`).
- [ ] For each of the ten IDs, a `SLICE-<ID>-LOG.md` exists beside its packet.
- [ ] For each of the ten IDs, the count of removed packet lines absent from its LOG file is 0.
- [ ] Each LOG orders its moved sections newest first.
- [ ] Each packet still contains every template field heading it had before: `## Goal`,
      `## Difficulty`, `## Depends on`, `## Owned files`, `## Do not touch`, `## Cited headings`,
      `## Acceptance`, `## Verify`, `## Observable result`, `## Risk`, `## Families`,
      `## Closeout` (verified by heading-count comparison against `git show HEAD:<packet>`).
- [ ] No packet retains more than one `## Stopped` section.
- [ ] `git status --porcelain` lists no path outside this packet's owned list that this slice
      created or modified.
- [ ] `git diff --check` reports no whitespace error on the owned diff.

## Verify

Classification and applicable gate: documentation only. These files are planning prose read by
coordinators; none is executable configuration, a generated input or a runtime prompt. Per the
protocol's documentation-only exception, the repository-wide `npm run check` and the runtime
closeout command do not apply. Required checks are the three commands below plus coordinator diff
review for accuracy, links and rule consistency.

For UI changes: not applicable — no UI, no journey, no backend. Live integration not applicable.

```
LANES="5C 5D 5G 5J 5K 5L 5M 5N 5O 5Q"
D=docs/operations/launch-slices
for id in $LANES; do
  p="$D/SLICE-$id.md"; l="$D/SLICE-$id-LOG.md"
  b=$(wc -c < "$p")
  git diff -- "$p" | grep '^-' | grep -v '^---' | cut -c2- > "$TMPDIR/6e-removed-$id.txt"
  miss=$(grep -F -x -v -f "$l" "$TMPDIR/6e-removed-$id.txt" | wc -l)
  before=$(git show "HEAD:$p" | grep -c '^## ')
  after=$(grep -c '^## ' "$p")
  stopped=$(grep -c '^## Stopped' "$p")
  echo "$id bytes=$b missing_from_log=$miss headings_before=$before headings_after=$after stopped=$stopped"
done
```

```
git diff --check
```

```
git status --porcelain docs/operations/launch-slices
```

Retain the command, exit code and the ten-line table above as the slice's evidence. Pass means
every row shows `bytes` ≤ 12288, `missing_from_log=0`, `stopped` ≤ 1, and `headings_after` short of
`headings_before` only by dated-record headings the worker names in its `RESULT BLOCK`.

## Observable result

Ten packets the owner can open and see are shorter but complete, each with a `-LOG.md` beside it
holding the moved history newest first, and a ten-row table proving no line was lost.

## Risk

low — audit required: no under the documentation-only class; the no-loss invariant is proved by a
deterministic line-comparison check, not by opinion. One bounded cross-family confirmation is
still requested because "nothing was lost" is the only claim a diff review reads poorly.
Review boundary: this candidate, one bounded pass over the combined diff.
Review scope/budget: the single unanswered question is whether any moved block is a live
specification field rather than a dated record. Inputs are the acceptance list, the combined diff,
the changed-file list and the ten-row check table. Ordinary effort; one pass, no retry.
Prior accepted evidence: none reopened. 6D's retained candidate, evidence and hashes are untouched
and stay valid; nothing here can invalidate them.
On reviewer outage: this slice is documentation-only, so a Grok outage does not block integration —
record the outage in the packet and integrate on the coordinator diff review plus the check table.

## Families

- Builder: Claude, mid-tier model at medium effort — one per lane, per Model routing's
  "bounded reading, mechanical edits" line. Codex is deliberately unused to conserve its budget.
- Auditor: Grok, `grok-4.5` at ordinary effort — a different family from the builder. Launch per
  `AGENTS.md` → Slice protocol → "Grok CLI on this Mac": `--sandbox workspace`, never
  `--sandbox read-only`, never `grok_spawn_readonly`.

## Closeout

Documentation only: record the scoped review/diff result in this packet — `PASS` or the leftover
list — then run the hygiene command before the coordinator commit:

```
bash scripts/repo-hygiene.sh --rescue
```

## Closeout result — 2026-09-09

**PASS**, one recorded deviation. Lane A (5C/5D/5G/5J/5K) and Lane B (5L/5M/5N/5O/5Q) both landed:
all ten packets keep every required template heading, ≤1 `## Stopped` section, and every removed
line verified present verbatim in its sibling LOG (confirmed via an independent non-blank
line-diff — see quirk note below).

Deviation: **SLICE-5O is 12,957 B, 669 B over the 12,288 cap** — coordinator-accepted. Its only
remaining movable content was `## Traps`, live builder guidance rather than a dated
record/RESULT BLOCK/Stopped section, so it stayed in place per the packet's own move rule. Noted
inline in SLICE-5O.md and here rather than silently passed.

Tool-quirk finding (both lanes, independently confirmed): this machine's ugrep drops blank-line
patterns from a `-f` pattern file, so the packet's spec'd `grep -F -x -v -f` verify command reports
nonzero `missing_from_log` on 8 of 10 IDs purely from removed blank lines. Both lanes cross-checked
with an independent Python non-blank line-set diff and got 0 real misses on all ten IDs. Treat the
Python-verified count as authoritative for this check going forward; the `AGENTS.md` "machine facts
that bite" note about ugrep should probably get a line about `-f` pattern files too (out of scope
here — flagging for a future doc slice).

Cross-family audit: requested per Families (Grok, `grok-4.5`, ordinary effort) but Grok returned
`402 Payment Required: Grok Build usage balance exhausted` — a reviewer outage. Per this packet's
own "On reviewer outage" clause (documentation-only class), that does not block integration; the
coordinator completed the bounded diff review instead (byte counts, heading-count deltas, required
headings present, `## Stopped` counts, `git diff --check` exit 0, `git status --porcelain` scoped to
owned paths only). No source, config, data, content, stories, venture, or charles path touched.
6D's retained evidence, checkouts and hashes are untouched.

Hygiene: `bash scripts/repo-hygiene.sh --rescue` exit 0. All pre-existing leftovers (6D checkouts,
other sessions' uncommitted docs edits) snapshotted and retained, nothing pruned, nothing lost.

Resume pointer for a later slice: SLICE-5T/5Z (over cap, deferred by this packet's own scope), the
24 KB `## Slice protocol` trim, and a possible follow-up to re-cap SLICE-5O once the 5O work itself
is revisited (its overage is content-preserving, not urgent).

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Lane A / Lane B: each returns five capped packets and five archives on fully disjoint paths;
  the benefit is halved wall time on ~90 KB of line-level triage with zero shared bookkeeping.
- Assignment: two fresh packet-sized Claude contexts, mid-tier, medium effort. Each receives this
  packet and the protocol section only. Neither reads the other lane's output. Frozen handoff is
  the lane's `RESULT BLOCK` plus its check table.
- Evidence return: the ten-row table, `git diff --check` exit, `git status --porcelain` output for
  the owned directory, and the scratch path under `$TMPDIR`. No transcripts, no file dumps.
- Capability boundary: closeout runs once after both lanes land. Resume pointer for the next
  session is `SLICE-5T`/`SLICE-5Z` (over cap, deferred here) and the 24 KB protocol-section trim.
  Use completion notifications; do not poll the lanes.
