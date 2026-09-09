# SLICE-6F: land the orphaned packet-capping wave and return `## Slice protocol` under its own cap

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

The working tree carries an uncommitted second wave of 6E-style packet capping: 11 slice packets
trimmed against 11 new untracked `-LOG.md` siblings, plus a rewrite of the protocol's
parallel-lane rules, a new `### Effort tiers` subsection in `AGENTS.md`, and a
`SLICE-TEMPLATE.md` edit. None of it is recorded in the master document, and it is what makes
every deferred item in the 2026-09-09 progress entry look open.

Done means: that wave is proven lossless, the three packets still over cap are under cap,
`AGENTS.md` → `## Slice protocol` is back under its own 24,576 B cap with no normative statement
lost, and the set lands as one reviewed coordinator commit. The owner authorized this session to
land work it did not create; that covers only the 24 paths under **Owned files**.

Measured starting state:

`HEAD` → working-tree → `-LOG.md` bytes: 5H 16662→13206/3711 · 5P 15213→9791/5677 ·
5R 13258→12107/1406 · 5S 39320→10339/29236 · 5T 17255→12346/5164 · 5W 14390→9350/5295 ·
5X 13517→10679/3093 · 5Y 12889→9594/3550 · 5Z 19443→15775/3923 · 6B 17875→7132/10998 ·
6C 14859→9437/5677.

Over the 12,288 B packet cap in the working tree: **5H (13206), 5T (12346), 5Z (15775)**.
`AGENTS.md` → `## Slice protocol` is 23,605 B at `HEAD` and 28,694 B in the working tree —
4,118 B over its 24,576 B cap, an overage created entirely by the uncommitted edit.

## Difficulty

hard — Lane A is mechanical and provable, but Lane B must shrink a section by 4,118 B without
dropping a rule every future session depends on.

## Depends on

none — 6E is accepted (`628bac7`); nothing else is queued.

## Owned files

Parallel-safe: **yes.** Disjoint write ownership, no repo-wide rewriting command in either lane,
and each lane's checks write only into its own scratch directory. Lane A never opens `AGENTS.md`;
Lane B never opens a `SLICE-*` packet but this one. Both read `HEAD` blobs — immutable, pinned to
`b0c60f8`. Serialized handoff: both lanes freeze their candidates, then the coordinator reviews
and makes the single commit. The split is useful — Lane A is a mechanical line-set diff over 22
files, Lane B a judgment rewrite of one; neither blocks the other.

### Lane A — the packet-capping wave proven lossless and finished

- `docs/operations/launch-slices/SLICE-{5H,5P,5R,5S,5T,5W,5X,5Y,5Z,6B,6C}.md`
- `docs/operations/launch-slices/SLICE-{5H,5P,5R,5S,5T,5W,5X,5Y,5Z,6B,6C}-LOG.md`
- scratch: `$TMPDIR/6f-lane-a/`

### Lane B — `## Slice protocol` back under cap, and the template edit reviewed

- `AGENTS.md`
- `docs/operations/launch-slices/SLICE-TEMPLATE.md`
- `docs/operations/slice-protocol-environment.md` (new)
- scratch: `$TMPDIR/6f-lane-b/`

## Do not touch

- `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`
- `data/notes-spread-ledger.jsonl`

Modified by an unrelated content-pipeline session. Report them by name at closeout and leave them
exactly as found; the owner's authorization covers the 24 documentation paths above, not these.

- `docs/content-studio-master-status.md` — coordinator only, at closeout.
- Every other `SLICE-*.md` in the directory, including the ten 6E already capped.

## Cited headings

none

## Acceptance

- [ ] For each of the 11 IDs, every non-blank line present in the `HEAD` blob of `SLICE-<ID>.md`
      appears verbatim either in the working-tree `SLICE-<ID>.md` or in `SLICE-<ID>-LOG.md`.
      Zero lines unaccounted for, across all 11.
- [ ] `SLICE-5H.md`, `SLICE-5T.md` and `SLICE-5Z.md` are each ≤ 12,288 B, reached only by moving
      dated session records, superseded `## Stopped` sections and completed `RESULT BLOCK`s into
      the sibling `-LOG.md`, newest first. No live specification content is deleted.
- [ ] All 11 packets are ≤ 12,288 B.
- [ ] Each of the 11 `-LOG.md` files exists, is non-empty, and its newest entry is first.
- [ ] Each packet still contains, in order, the headings `## Goal`, `## Acceptance`, `## Verify`,
      and contains at most one `## Stopped` section.
- [ ] `### Grok CLI on this Mac` and the `| Machine facts that bite |` and
      `| Live or authenticated model slices |` binding rows no longer appear in `AGENTS.md` →
      `## Slice protocol`; every non-blank line of all three appears verbatim in
      `docs/operations/slice-protocol-environment.md`.
- [ ] `AGENTS.md` → `## Slice protocol` contains a pointer line naming
      `docs/operations/slice-protocol-environment.md`, and that file's top block redirects to
      `AGENTS.md` → `## Slice protocol` as the source of truth.
- [ ] `AGENTS.md` → `## Slice protocol` is ≤ 24,576 B. If it is not, the packet carries a
      `## Deviation` section naming the exact residual byte count and stating why no further
      environment-specific or repository-specific material could be relocated.
- [ ] Lane B's `RESULT BLOCK` lists every distinct normative statement in the uncommitted
      packet-contract / `### Effort tiers` prose before compression, and every one of them is
      still stated in the committed section afterwards. No rule is dropped, weakened or merged
      into a weaker one.
- [ ] `git diff --check` exits 0.
- [ ] `git status --porcelain` shows exactly the two `## Do not touch` content paths still
      modified, and no untracked path this session created.

## Verify

Classification and applicable gate: **documentation only.** Every owned path is prose — packets,
their logs, the protocol section, the template. None is executable configuration, a generated
input or a runtime prompt consumed by code, so `npm run check` and the runtime closeout do not
apply; the scoped review and diff result are recorded here instead. `AGENTS.md` is still the file
every session reads first, so Lane B's compression carries a cross-family audit (see `## Risk`).

For UI changes: not applicable — no user-visible surface, journey, viewport or flag. Live
integration not applicable.

Machine trap: this system's `grep` is ugrep 7.5.0 and silently drops blank-line patterns from a
`-f` file, so `grep -F -x -v -f` **over-reports** missing lines — 6E hit this in both lanes. Use
the Python line-set diff below, not `grep -f`. There is no coreutils `timeout`.

Lane A — content-loss proof and cap check:

```
python3 - <<'PY'
import subprocess, pathlib
D = pathlib.Path("docs/operations/launch-slices")
bad = 0
for i in ["5H","5P","5R","5S","5T","5W","5X","5Y","5Z","6B","6C"]:
    head = subprocess.run(["git","show",f"HEAD:{D}/SLICE-{i}.md"],
                          capture_output=True, text=True, check=True).stdout
    now  = (D/f"SLICE-{i}.md").read_text(encoding="utf-8")
    log  = (D/f"SLICE-{i}-LOG.md").read_text(encoding="utf-8")
    have = {l.strip() for l in (now+"\n"+log).split("\n") if l.strip()}
    miss = sorted({l.strip() for l in head.split("\n") if l.strip()} - have)
    size = (D/f"SLICE-{i}.md").stat().st_size
    stopped = now.count("\n## Stopped")
    ok = not miss and size <= 12288 and stopped <= 1 and log.strip()
    bad += 0 if ok else 1
    print(f"{i} size={size} missing={len(miss)} stopped={stopped} log={len(log)} {'OK' if ok else 'FAIL'}")
    for m in miss[:5]: print("   MISSING:", m[:110])
print("LANE A", "PASS" if bad == 0 else f"FAIL ({bad})")
PY
```

Lane B — section cap and relocation proof:

```
python3 - <<'PY'
import pathlib
t = pathlib.Path("AGENTS.md").read_text(encoding="utf-8").split("\n")
s = next(i for i,l in enumerate(t) if l.startswith("## Slice protocol"))
e = next((i for i in range(s+1,len(t)) if t[i].startswith("## ")), len(t))
sec = "\n".join(t[s:e]); n = len(sec.encode())
env = pathlib.Path("docs/operations/slice-protocol-environment.md")
moved = env.read_text(encoding="utf-8") if env.exists() else ""
print("section bytes", n, "cap 24576", "OK" if n <= 24576 else f"OVER by {n-24576}")
for probe in ["### Grok CLI on this Mac", "| Machine facts that bite",
              "| Live or authenticated model slices"]:
    print(f"{probe!r:52} in section={probe in sec} in env-file={probe in moved}")
print("pointer present:", "slice-protocol-environment.md" in sec)
print("redirect present:", "## Slice protocol" in moved)
PY
git diff --check ; echo "diff --check exit=$?"
git status --porcelain
```

## Observable result

The owner runs the two blocks above and sees `LANE A PASS`, a section byte count ≤ 24,576, and a
`git status --porcelain` listing only the two `## Do not touch` content paths. One commit holds
24 documentation paths, and `## START HERE` names 6F.

## Risk

medium — audit required: **yes, Lane B only.** Lane A's "no content lost" claim is settled by a
deterministic set difference against immutable `HEAD` blobs, so coordinator diff review suffices.
Lane B compresses prose in the file every session reads first, where a dropped rule is invisible
in a byte count and would silently change how future sessions behave.

Review boundary: this candidate, at Lane B's frozen handoff, before integration.
Review scope/budget: one bounded cross-family review at ordinary effort. Inputs: the `AGENTS.md`
diff, the new environment file, Lane B's before/after normative-statement inventory, and Lane B's
check output. Never the repository, master document or a worker transcript. One question: is any
normative statement present before and absent, weakened or merged after? Delta review only for
unresolved material findings.
Prior accepted evidence: SLICE-6E's ten capped packets are accepted at `628bac7` and are not
reopened; they are `## Do not touch`. Reopen only if Lane A's diff shows one of them changed.
On reviewer outage: Grok is unavailable on this machine (`402 Payment Required`, and the section's
own launch caveat), so the cross-family reviewer here is Codex. If Codex is also unavailable, Lane
B is review-blocked and is **not** integrated; record the blocker and the retry condition in
`## Stopped`, then land Lane A alone as a separately scoped, accepted documentation commit and
leave `AGENTS.md` and `SLICE-TEMPLATE.md` untouched in the working tree.

## Families

- Builder: Lane A — Claude, mid-tier, medium effort (mechanical, deterministic proof).
- Builder: Lane B — Claude, strongest available, high effort (this packet declares the work
  high-risk; a dropped rule is not recoverable by a later byte check).
- Auditor: Codex (GPT family — different from both builders), ordinary effort. Grok is
  unavailable on this machine. A larger Claude is not independent review; never substitute it.

## Closeout

Documentation only: record the scoped review/diff result here — both check blocks' output,
`git diff --check` exit, the audit verdict. The bindings' closeout gate is `none`; record `PASS`
or the leftover list. Then `bash scripts/repo-hygiene.sh --rescue` and report by name every path
it lists, settling only paths this slice owns.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Lane A: delivers the lossless-and-capped proof over 22 files while Lane B does the slow
  judgment rewrite, and can be accepted alone if Lane B is review-blocked.
- Lane B: delivers the section back under cap plus a rule inventory; it is the only lane needing
  an audit, so isolating it keeps the audit input small.
- Assignment: fresh context per lane, this packet plus the protocol section only. Frozen handoff
  is each lane's candidate and its check output; no lane reads the other's scratch.
- Evidence return: command, exit, per-ID byte and missing-line counts, the section byte count,
  the normative-statement inventory, scratch paths.
- Capability boundary: lanes report completion; the coordinator reviews, commits once, and
  rewrites `## START HERE` plus `## Progress log` in that same commit. No polling.
