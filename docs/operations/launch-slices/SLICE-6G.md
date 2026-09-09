# SLICE-6G: one `## Standing constraints`, every real packet under cap, the cap's scope written down

Protocol: `AGENTS.md` → `## Slice protocol`, plus `docs/operations/slice-protocol-environment.md`.
Read those and this file only. Do not open `docs/content-studio-master-status.md` unless a heading
is cited below. Do not load the repository for context. Do not commit.

## Goal

The startup reading surface is correct and self-describing:

1. The master document has one `## Standing constraints` heading. It has two: line 16 is
   `## Standing constraints`.` (stray backtick-period tail) plus an orphaned history bullet, left
   by an earlier in-place `## START HERE` rewrite. Anything anchoring on it hits the empty twin.
2. `SLICE-5O.md` is under the 12,288 B cap. It is 12,957 B, 669 B over. SLICE-6E accepted the
   overage because its only movable content was live `## Traps` guidance. This slice closes it by
   **compressing** that prose, never by deleting a rule.
3. The bindings file states which files under `launch-slices/` the cap governs. Without it every
   sweep re-flags `SLICE-5L-coverage.md` (20,485 B), which SLICE-6E declared "companion analysis,
   not a packet" and nine files cite by path.

## Difficulty

easy — three bounded documentation edits; no executable inputs, no runtime behavior.

## Depends on

6F (accepted 2026-09-09; restored `## Slice protocol` to 24,568 B, finished the second capping
wave). Nothing else.

## Owned files

Parallel-safe: **no.** Deliverable 2 is one continuous judgment over one 13 KB file.
Deliverables 1 and 3 are ~10 lines each, and 1 sits in the block the coordinator rewrites at every
closeout, so a concurrent worker would only conflict there. A second lane repeats this packet's
context and adds a checkpoint for no extra deliverable.

### Lane A — the only lane (one worker, serial)

- `docs/operations/launch-slices/SLICE-5O.md`
- `docs/operations/launch-slices/SLICE-5O-LOG.md` (only if a dated record turns up; compression
  is the primary route)
- `docs/operations/slice-protocol-environment.md`

### Coordinator-owned (not the worker's)

- `docs/content-studio-master-status.md` — deliverable 1, the pointer line, the closeout rewrite.
- `docs/operations/launch-slices/SLICE-6G.md` — the `## RESULT BLOCK` and read-set print.

## Do not touch

- `docs/content-studio-master-status.md` — coordinator-owned here.
- `docs/operations/launch-slices/SLICE-5L-coverage.md` — do not move, rename or trim. Its cap
  exemption is a settled SLICE-6E decision and nine files cite its path. This slice records it.
- `AGENTS.md` — `## Slice protocol` is 24,568 B against a 24,576 B cap. Eight bytes of headroom.
  Nothing is added there; the new text goes in the bindings file.
- Any other `SLICE-*.md` or `*-LOG.md`.
- `content/2026-09-07-the-world-s-broken-.../review-queue.md` and
  `data/notes-spread-ledger.jsonl` — modified by an unrelated session; leave exactly as found.

## Cited headings

`docs/content-studio-master-status.md` → `## Standing constraints`, coordinator only, to confirm
the surviving heading is the real one. The worker cites none.

## Acceptance

Each item is true or false against the working tree, by the matching command in `## Verify`.

- [ ] `grep -c '^## Standing constraints' docs/content-studio-master-status.md` returns exactly `1`.
- [ ] `grep -c '^## Standing constraints`\.$' docs/content-studio-master-status.md` returns `0`.
- [ ] The `## START HERE` block (heading to the line before the next `## `) is ≤15 lines and its
      final content line is a `- ` bullet.
- [ ] The surviving `## Standing constraints` section's `- **` bullet count is unchanged from
      `HEAD`.
- [ ] `wc -c < docs/operations/launch-slices/SLICE-5O.md` is `12288` or less.
- [ ] `SLICE-5O.md`'s heading list is byte-identical to `HEAD`'s, and its `- [ ]` count under
      `## Acceptance` is unchanged (`10`).
- [ ] The bold trap-lead count (`^\*\*`) under `SLICE-5O.md` → `## Traps, all verified in source
      before this packet was written` is `6`, unchanged from `HEAD`; step 5 reports
      `dropped_code_spans: []`, so no trap path or symbol was lost.
- [ ] `SLICE-5O.md` has `0` or `1` lines matching `^## Stopped`.
- [ ] `docs/operations/slice-protocol-environment.md` has a `### Packet cap scope` heading whose
      body names four rules: the 12,288 B cap governs `SLICE-<ID>.md`; `*-LOG.md`,
      `SLICE-TEMPLATE.md` and `SLICE-5L-coverage.md` (companion analysis, per SLICE-6E) are
      exempt.
- [ ] The sweep in `## Verify` reports zero over-cap files across every `SLICE-<ID>.md`.
- [ ] `git diff --check` exits `0`.
- [ ] `bash scripts/repo-hygiene.sh --rescue` is run, its output reviewed, every path this
      session created is committed and every other path reported by name and left in place.
      (The original `exits 0` form was mis-specified — see `SLICE-6G-LOG.md`.)
- [ ] This packet's `## RESULT BLOCK` records the closeout read-set print: byte size of
      `AGENTS.md` → `## Slice protocol`, the master's `## START HERE` block, and this packet.

## Verify

Classification and applicable gate: **documentation only.** No executable, generated or
runtime-prompt input changes. Per that exception: coordinator review for accuracy, links and rule
consistency, plus a whitespace/diff check — not `npm run check`, no runtime closeout command, no
detached checkout. One bounded cross-family review is still required: compression can silently
soften a rule and a byte count cannot detect that.

For UI changes: none. No page, journey, viewport, flag or backend touched. Live integration n/a.

```
cd /Users/Muxin/Documents/GitHub/content-agents

# 1. one Standing constraints heading, no corrupted twin
grep -c '^## Standing constraints' docs/content-studio-master-status.md
grep -c '^## Standing constraints`\.$' docs/content-studio-master-status.md

# 2. START HERE block length and shape
awk '/^## START HERE/{f=1;print;next} f&&/^## /{exit} f' docs/content-studio-master-status.md | wc -l
awk '/^## START HERE/{f=1;next} f&&/^## /{exit} f' docs/content-studio-master-status.md | grep -v '^$' | tail -1

# 3. Standing constraints bullets preserved (both counts must match)
B='/^## Standing constraints$/{f=1;next} f&&/^## /{exit} f'
git show HEAD:docs/content-studio-master-status.md | awk "$B" | grep -c '^- \*\*'
awk "$B" docs/content-studio-master-status.md | grep -c '^- \*\*'

# 4. SLICE-5O under cap
wc -c < docs/operations/launch-slices/SLICE-5O.md
grep -c '^## Stopped' docs/operations/launch-slices/SLICE-5O.md

# 5. SLICE-5O structure preserved (heading set, acceptance count, trap count)
git show HEAD:docs/operations/launch-slices/SLICE-5O.md > "$TMPDIR/5O-head.md"
python3 - "$TMPDIR/5O-head.md" docs/operations/launch-slices/SLICE-5O.md <<'PY'
import re,sys
H=lambda t:[l for l in t.splitlines() if re.match(r'^#{1,3} ',l)]
def S(t,pat):
    m=re.search(pat,t,re.M)
    if not m: return ''
    n=re.search(r'^## ',t[m.end():],re.M)
    return t[m.end():m.end()+(n.start() if n else len(t))]
a,b=[open(f,encoding='utf-8').read() for f in sys.argv[1:3]]
print('headings_identical:',H(a)==H(b),'missing:',[h for h in H(a) if h not in H(b)])
for nm,pat,it in (('acceptance',r'^## Acceptance$',r'^- \[ \]'),('traps',r'^## Traps.*$',r'^\*\*')):
    c=[len(re.findall(it,S(x,pat),re.M)) for x in (a,b)]
    print(nm,'HEAD',c[0],'now',c[1],'unchanged',c[0]==c[1])
print('dropped_code_spans:',sorted(set(re.findall(r'`[^`\n]+`',a))-set(re.findall(r'`[^`\n]+`',b))))
PY

# 6. cap-scope rules recorded
grep -c '^### Packet cap scope' docs/operations/slice-protocol-environment.md
awk '/^### Packet cap scope/{f=1;next} f&&/^#{2,3} /{exit} f' docs/operations/slice-protocol-environment.md

# 7. full sweep — every real packet under cap
for f in docs/operations/launch-slices/SLICE-*.md; do
  case "$f" in *-LOG.md|*TEMPLATE.md|*5L-coverage.md) continue;; esac
  s=$(wc -c <"$f"); st=$(grep -c '^## Stopped' "$f")
  [ "$s" -gt 12288 ] && echo "OVER $f $s"
  [ "$st" -gt 1 ] && echo "MULTI-STOPPED $f $st"
done; echo "sweep done"

# 8. whitespace and hygiene
git diff --check; echo "diff-check exit $?"
bash scripts/repo-hygiene.sh --rescue; echo "hygiene exit $?"

# 9. read-set print for the RESULT BLOCK
awk '/^## Slice protocol/{f=1;print;next} f&&/^## /{exit} f' AGENTS.md | wc -c
awk '/^## START HERE/{f=1;print;next} f&&/^## /{exit} f' docs/content-studio-master-status.md | wc -c
wc -c < docs/operations/launch-slices/SLICE-6G.md
```

Bindings machine facts apply: system `grep` is ugrep 7.5.0 — never combine `-q` with `-v`; count,
then test. Verify each gate by exit code, never a `| tail` pipe.

## Observable result

Muxin opens `docs/content-studio-master-status.md` and sees one `## Standing constraints` heading
where there were two, no stray backtick line between START HERE and it. Step 7 prints only
`sweep done`. `SLICE-5O.md` reads as the same spec, in fewer bytes.

## Risk

**low** — audit required: **yes, bounded.** Byte counts and heading-set diffs prove structure
survived, not that compressed prose still says the same thing. A rule softened inside `## Traps`
passes every mechanical check here. That is the one unanswered question.

Review boundary: this candidate. Scope/budget: the `SLICE-5O.md` diff plus the
`### Packet cap scope` addition — ordinary effort, one pass, no repository export. Do not send the
master-document edit; deleting two orphaned lines is coordinator-reviewable on its face.

Prior accepted evidence: SLICE-6E's ruling that `SLICE-5L-coverage.md` is exempt companion
analysis is retained, not reopened. It reopens only if that file becomes an executed packet.

On reviewer outage: the candidate is review-blocked and **not** integrated. Record the blocker and
retry condition in a `## Stopped` section, take the stopping-without-acceptance branch, leave the
tree as it stands. Never substitute a same-family review. No independent work remains; every
deliverable sits inside the blocked candidate.

## Families

- Builder: **Claude, mid-tier, medium effort** — one worker, Lane A. Per Effort tiers, bounded
  mechanical documentation edits are lighter-model work. Escalate to strongest/high only if a
  first pass fails acceptance.
- Auditor: **Codex (GPT family), ordinary effort** — different family from the builder. Run
  `codex exec --sandbox read-only`; on `Operation not permitted`, rerun unsandboxed locally as the
  6F audit did. Fallback: Grok, only with `--sandbox workspace` per the bindings' launch fix —
  never `--sandbox read-only`, never `grok_spawn_readonly` here. Supply the acceptance criteria,
  the `SLICE-5O.md` diff, the changed-file list and step 5's output. Require it to separate
  established defects, verification gaps and optional improvements, and to name any trap, path or
  symbol whose meaning changed.

## Closeout

Documentation only: record the scoped review/diff result here. The bindings' closeout gate is
`none`, so record `PASS` or the leftover list in this packet.

**PASS** — 2026-09-09. Coordinator diff review plus cross-family Codex audit and delta audit, all
findings closed. One accepted deviation on the hygiene exit code, recorded in `SLICE-6G-LOG.md`.

## RESULT BLOCK

Accepted 2026-09-09. The RESULT BLOCK, both Codex audits, the read-set print and the one
accepted deviation (hygiene exit code) are in `SLICE-6G-LOG.md`.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.

- Each extra lane: none. Serial — deliverables 1 and 3 are ~10 lines each and one sits in the
  coordinator's closeout file, so delegation adds cost with no independent deliverable.
- Assignment: one fresh packet-sized worker context, Claude mid-tier at medium effort, holding
  `## Slice protocol`, the bindings file and this packet. Frozen handoff at its `RESULT BLOCK`.
- Evidence return: the `RESULT BLOCK` only — commands, exit codes, step 5 and 7 output verbatim,
  byte counts before and after, pointers to anything under `$TMPDIR`. No transcript, no replan.
- Capability boundary: one coherent capability (the startup reading surface). Closeout runs once,
  after the audit closes, not after the worker returns. Next resume pointer goes in START HERE.
