# SLICE-6V: trim `## Slice protocol` back under its 24576 B cap without losing a rule

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`AGENTS.md` → `## Slice protocol` measures at most 24576 B, and every normative rule it stated
before the trim is still stated after it. The section is the runtime prompt every worker is handed,
so the deliverable is compression of wording, never removal of obligation.

Measured on `main` at packet time: **26179 B**, 17 `### ` subsections. The overrun is 1603 B (6.1%),
carried across two closeouts (6T, 6U) and now into 6V.

## Difficulty

hard — the size target is trivially checkable, the rule-preservation half is not. A dropped
"never" reads as clean prose and only surfaces later as a worker that was never told.

## Depends on

none — 6U is accepted and pushed; this touches no file 6U touched.

Delivery batch: SLICE-6V alone. Deliverable is implementation (an edited section) plus its rule
inventory. Acceptance order: size check, then rule inventory, then cross-family audit, then gate.
Stop condition: this slice closes when the section is at or under cap with the inventory complete.
A free slot does not authorize pulling 6W.
Owner checkpoint: none. Scope is fixed by the cap already recorded in the bindings; which prose
to compress is an engineering choice and stays with the coordinator. No human-only step.

## Owned files

Parallel-safe: **no.** The cut is one global judgment: which of three near-duplicate statements
about model strength survives depends on what the other two subsections keep. Split considered and
rejected — Lane A subsections 1-9, Lane B 10-17 — because the redundancy this slice exploits runs
*across* that boundary (Model routing / Usage discipline / Effort tiers all restate one rule), so
the lanes would both cut it or both keep it. Each lane would also reload the whole section anyway
and still need a serialized reconciliation pass.

### Lane A — the only lane

- `AGENTS.md` — the `## Slice protocol` section only, first line to the line before the next `## `
- `docs/operations/launch-slices/SLICE-6V-LOG.md` — new; holds the rule inventory
- `docs/operations/launch-slices/SLICE-6V.md` — this packet, RESULT BLOCK and Closeout only

## Do not touch

- Any part of `AGENTS.md` outside the `## Slice protocol` section, including its other `## `
  sections and the file's front matter.
- `docs/operations/slice-protocol-environment.md`, `docs/operations/launch-slices/SLICE-TEMPLATE.md`,
  and every other `SLICE-*.md`. **Relocation is not compression.** Both are already in the reader's
  required set, so moving text there lowers this number while raising the real cost. Text moved out
  counts as removed and fails the rule inventory unless the rule survives in the section itself.
  If genuinely repository-specific text turns up, name it under Unresolved; do not move it.
- `docs/content-studio-master-status.md` — coordinator edits it at closeout, not the worker.
- Any `src/`, `e2e/`, `scripts/`, `config/` or `data/` path. This slice changes no code.

## Cited headings

none

## Acceptance

- [ ] `awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' AGENTS.md | wc -c`
      prints a value **≤ 24576**.
- [ ] That same value is **≤ 24000**, leaving headroom so the next rule added does not immediately
      re-breach. If rule preservation and this target conflict, preservation wins: meet ≤ 24576,
      leave this item unchecked, and record the specific rule that blocked it under Unresolved.
- [ ] The section contains exactly **17** `### ` subsections, with the same 17 titles in the same
      order as before the trim. No subsection was deleted, renamed, merged or reordered.
- [ ] `SLICE-6V-LOG.md` contains a rule inventory: one row per normative statement in the
      **pre-trim** section (every MUST / NEVER / ALWAYS / "do not" / "only" / numbered-sequence
      obligation), each row carrying the pre-trim wording in brief and the post-trim line that
      still carries it. Every row resolves to a post-trim line; zero rows are marked dropped.
- [ ] Spot-check, verifiable independently of the inventory: the post-trim section still states
      each of these, in the section itself — the cross-family audit rule and its ban on a
      same-family substitute; the three parallel-lane conditions; the two-repair-cycle bound
      before engineering-blocked; the `## Stopped` 4 KB limit and the 12288 B packet cap; the
      24576 B cap on this section; the "verify a gate by its exit code, a `| tail` pipe reports
      success when the gate failed" warning; the packet-session / execution-session handshake that
      rewrites the one START HERE line.
- [ ] `git diff --check AGENTS.md` exits 0 (no trailing whitespace, no conflict markers).
- [ ] `git diff --stat -- AGENTS.md` shows `AGENTS.md` as the only changed path in the diff.
- [ ] `npm run check` exits 0, run unsandboxed.
- [ ] The cross-family audit named under Families returned a verdict, and every established defect
      it raised is fixed or carries an explicit recorded disposition.

## Verify

Classification and applicable gate: **low-risk copy/mechanical, audit required.** The section is
prose, but the bindings' documentation-only exception explicitly does not cover runtime prompts,
and this section is exactly that — it is handed verbatim to every worker. So the documentation-only
waiver does not apply: the repository-wide gate runs, and one bounded cross-family review runs.
Not "meaningful behavior/high risk" — no executable path changes — but the failure mode is silent
rule loss, which a same-family reviewer that just wrote the trim will confirm rather than catch.
Review scope is rule preservation, not prose taste.

For UI changes: not applicable. This slice renders nothing and has no journey, viewport, flag or
backend. Live integration not applicable; there is no runtime behavior to exercise.

```
# size, before and after (the bindings' Read-set measurement form)
awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' AGENTS.md | wc -c
git show HEAD:AGENTS.md | awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' | wc -c

# structure: 17 subsections, same titles, same order
awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' AGENTS.md | grep -c '^### '
git show HEAD:AGENTS.md | awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' | grep '^### ' > "$TMPDIR/6v-before.txt"
awk '/^## Slice protocol/{f=1} f&&/^## /&&!/^## Slice protocol/{exit} f' AGENTS.md | grep '^### ' > "$TMPDIR/6v-after.txt"
diff "$TMPDIR/6v-before.txt" "$TMPDIR/6v-after.txt"

# diff hygiene and scope
git diff --check AGENTS.md
git diff --stat -- AGENTS.md

# repository-wide gate, unsandboxed
npm run check
```

## Observable result

One number Muxin can read: the section measures at or under 24576 B where it measured 26179 B,
and the leftover carried since 6T is gone. The rule inventory in `SLICE-6V-LOG.md` is the
evidence that the number was bought with wording and not with rules.

## Risk

**medium** — audit required: **yes.** Not because it can break a build (it touches no code) but
because this section is the operating instruction for every future worker and auditor here. A rule
silently dropped degrades every later slice and is near-undetectable after the fact — exactly the
claim an independent family should test. Reversible in one `git revert`, so medium not high.
Review boundary: this candidate, before integration.
Review scope/budget: one bounded review at ordinary effort. Unanswered question is single and
fixed — does any normative statement present in the pre-trim section have no carrier in the
post-trim section? Inputs are bounded: the two section texts, the unified diff, and the rule
inventory. Nothing else is sent; no repository tree, no transcript. One retry at most if the
reviewer returns no verdict. Do not escalate to high effort for prose taste.
Prior accepted evidence: none to retain — no prior candidate for this slice exists.
On reviewer outage: the candidate is review-blocked and is not integrated. Record the blocker and
retry condition in `## Stopped`, take the stopping-without-acceptance branch, and leave the edited
section uncommitted in the working tree. There is no independent authorized work to continue into.

## Families

- Builder: **Claude, strongest tier, high effort** — one lane. Escalated above the mid-tier default
  on this packet's authority: the work looks mechanical and is not. Deciding which of three
  overlapping sentences is load-bearing is judgment, and a weaker model trades a rule for bytes
  because bytes are the visible target.
- Auditor: **Codex (GPT family), ordinary effort** — different family from the builder, and the
  reviewer already proven against this repository in 6U. Invocation
  `codex exec --sandbox read-only`. The prompt must say: audit against the supplied requirements,
  do not modify files, cite `path:line`, separate established defects, verification gaps and
  optional improvements; and must ask the one fixed question under Review scope. Grok is the
  fallback if Codex returns no verdict twice, using `--sandbox workspace` per the bindings.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md`:
the binding is `none`, so record a `**PASS**` line with a date here, or the explicit leftover
list, before this slice closes. No command belongs in this slot.

**PASS** — 2026-09-11. Gate binding is `none`; nothing left over. Section is 24560 B (≤ 24576),
17 subsection titles byte-identical in order, rule inventory resolves every pre-trim normative
statement, `npm run check` exited 0. Only the ≤ 24000 stretch target (non-blocking) is unmet.
Cross-family audit ran twice, found four defects total; all repaired and re-verified — disposition
in `SLICE-6V-LOG.md`.

Preflight satisfied: candidate = working-tree edit to `AGENTS.md` + new `SLICE-6V-LOG.md`; single
lane; every acceptance item mapped to a `## Verify` command or log artifact; exit codes recorded;
audit evidence set = two section texts, diff, inventory. Gate ran once, `npm run check` unsandboxed,
no rerun needed (no relevant change/failure after the fix).

Hygiene (`### Hygiene disposition` form): ran `bash scripts/repo-hygiene.sh --rescue`, exit 1 —
this session's own paths (`AGENTS.md`, this packet, `SLICE-6V-LOG.md`) committed; four other-session
items named and left in place: worktrees `wt-slice-6m`, `wt-slice-6s`; merged branches
`slice-6m-worker`, `slice-6s-worker` (same four listed at 6U).

## RESULT BLOCK

Completed and moved to `SLICE-6V-LOG.md` at closeout, per `### Packet size discipline`. Summary:
accepted, committed. Section 26179 B → 24560 B (≤ 24576 cap, 16 B margin). Two Codex audit rounds
found four dropped rules total; all four repaired and independently re-verified (PASS on round 3).
`npm run check` unsandboxed: 4379/4379 pass.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: none. Serial, because a second lane would reload the same whole section to make
  a decision that has to be made once; delegation here adds only bookkeeping.
- Assignment: one worker, Claude strongest tier at high effort, fresh packet-sized context. Reuse
  that same worker for audit repairs — its retained context is the inventory it just built, which
  is precisely what a repair needs. Freeze the handoff before the audit.
- Evidence return: command, exit code, before/after byte counts, subsection count, candidate
  identity, and a pointer to the inventory in `SLICE-6V-LOG.md`. Not the inventory itself.
- Capability boundary: this slice is one capability; run closeout once at its end, then leave
  resume pointers in `## START HERE`. Use completion notifications; do not poll the worker.
