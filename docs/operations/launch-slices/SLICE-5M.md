# SLICE-5M: a Notes drafting job that worked must say it worked

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

When Muxin runs "Pull Substack Notes" in the review GUI and picks a note, the resulting continue
job inspects the folder that was actually written, so a run that produced rows and derivatives
reports progress instead of "formatting ran but added no new rows or derivatives", and
`stampFolderEngine` runs.

A run that genuinely produced nothing must still report no progress. **Do not make the message
always-success.** The bug is that the check looks in the wrong place, not that the check is too
strict.

## Difficulty

easy to change, easy to get wrong — the one-line fix that looks obvious breaks the other caller.
See "The trap" below.

## Depends on

none. (SLICE-5L found and recorded this defect but changed no `.ts` file.)

## Background — the defect

`scaffoldContentFolder` (`src/atomize/new-content.ts:125`) returns an **absolute** path.
`src/review/serve.ts:1786` enqueues it verbatim as `` addJob("continue", `--continue ${r.dir}`) ``.
`runContinueJob` (`src/review/jobs.ts:2220`) then does `join(repoRoot, parsed.folder)`. Joining a
repo root onto an already-absolute path concatenates rather than discarding, so the result names a
directory that does not exist. `continueArtifactCounts` reads that non-existent directory, before
and after are both zero, `continueJobProgressed` returns false, and the job reports failure on a run
that worked. `stampFolderEngine` (`jobs.ts:2237`) sits in the same unreached `done` branch and never
runs.

Reproduced empirically with the real parser during SLICE-5L, not reasoned about.

## The trap

**There are two producers of `--continue <dir>` and they disagree about path shape.**

- `buildFormatArg` (`src/review/jobs.ts:2101`) produces `--continue content/<slug>` — **relative**.
  For this caller `join(repoRoot, folder)` is correct and must keep working.
- `serve.ts:1786` produces an **absolute** path.

So "make `runContinueJob` resolve absolute paths" and "make `serve.ts` emit a relative path" are both
plausible, and a change that only considers the failing caller will break the passing one. Decide
which end owns the normalization, state the reason in the RESULT BLOCK, and prove **both** callers
work afterward.

Second trap: `parseContinueArg` already rejects traversal (`develop.test.ts:252` asserts
`--cut ../evil` returns null). Whatever you change must not widen what a `--continue` argument is
allowed to name. A folder outside the repository's `content/` tree must still be refused. Add a test
that proves the refusal survives your change.

## Owned files

Parallel-safe: **no** — single lane. The producer, the consumer and their tests are one causal
chain; splitting them would put two workers in the same functions.

### Lane A — the path fix and its proof

- `src/review/jobs.ts`
- `src/review/serve.ts`
- `src/review/develop.test.ts`
- `src/review/jobs.test.ts`

## Do not touch

- `src/atomize/new-content.ts` — `scaffoldContentFolder` returning an absolute path is relied on
  elsewhere. Fix the mismatch on the review side.
- `.claude/skills/**` — no skill behaviour changes here.
- `.claude/worktrees/**` — another session's checkout.
- `docs/content-studio-master-status.md` — the coordinator owns it.
- Anything in `src/publish/**`. This slice does not touch delivery.

## Cited headings

none

## Acceptance

- [ ] A test exercises `runContinueJob`'s folder resolution with an **absolute** folder, as
      `serve.ts:1786` produces it, and asserts the **observable outcome**: the artifact counts read
      the real directory, so a folder that gained rows and derivatives is reported as progress.
      Asserting that a particular path string was computed is not enough — assert what the job
      concludes.
- [ ] A test covers the **relative** folder from `buildFormatArg` and shows it still resolves to the
      same real directory. Both callers pass.
- [ ] A test shows a genuinely empty run still reports no progress. The fix does not launder failure
      into success.
- [ ] A test shows a `--continue` argument naming a folder outside the repository's `content/` tree
      is still refused, and the existing `--cut ../evil` rejection still holds.
- [ ] `stampFolderEngine` is shown to run on a successful continue job. If it is unreachable for a
      second, unrelated reason, say so in the RESULT BLOCK rather than fixing that too.
- [ ] The RESULT BLOCK names which end took the normalization and why the other end was left alone.
- [ ] No behaviour change to any path other than continue-job folder resolution.

## Verify

Run directly with `node`. `npm test -- <files>` does **not** narrow the run — the script appends
named files to a glob and runs everything.

```
node --import tsx --test src/review/develop.test.ts src/review/jobs.test.ts src/review/serve.test.ts
npx tsc --noEmit -p tsconfig.json
```

## Observable result

Muxin picks a note in the review GUI and the job reports what happened. Today a successful pick
reports failure, which teaches her to distrust a feature that works.

## Risk

medium — audit required: **yes**. It is a small diff in a live path in the only room she publishes
from, and the obvious fix breaks a second caller.

## Families

- Builder: Claude, strong tier.
- Auditor: different family (Codex/GPT), given the changed-file list, the diff, this packet's
  acceptance criteria and the focused check output. Ask it specifically whether **both** producers
  of `--continue` are proven, and whether path-traversal refusal survived.

## Closeout

The repository has no closeout tool. The coordinator records `PASS` or the leftover list in this
packet.

```
npm run check          # unsandboxed, coordinator runs it once, last
bash scripts/repo-hygiene.sh --rescue
```

## RESULT BLOCK

**ACCEPTED 2026-09-06.** Closeout: **PASS**. Gate `npm run check` unsandboxed: **4260 tests, 488
suites, 0 fail**, exit 0 (up from 4248 — twelve new tests). `npx tsc --noEmit` exit 0.

- **Changed paths:** `src/review/jobs.ts`, `src/review/develop.test.ts`. `src/review/serve.ts`
  deliberately unchanged. No skill file, no publishing code, no `src/atomize/**`.
- **Outcome:** the defect is fixed and the room's Notes path now reports what actually happened.

### What was wrong with this packet

**The packet's central claim was false, and it was the coordinator's error, not the builder's.**
It stated there are two live producers of `--continue <folder>` and built its whole "trap" section
around protecting the relative one. `buildFormatArg` (`jobs.ts:2100`) has **zero production
callers** — verified during repair cycle 1 by grepping every call site: only its own definition and
tests. `addJob("continue", …)` has exactly ONE call site in the repository, `serve.ts:1786`, the
notes picker, absolute. The false claim came from trusting a status-document phrasing without
tracing a caller: this project's signature bug, committed inside the document written to prevent it.

The fix survives the correction — consumer-side normalization is right either way, and the relative
branch is cheap insurance — but the code and test comments that asserted "two producers" were
corrected to say what is true. `buildFormatArg` was **not** deleted; that is a separate decision,
and it belongs with the other dead-code findings in the master document's item (d3).

### The fix

Normalization lives at the **consumer**. `resolveContinueArg` (`jobs.ts:2205`) returns a three-way
`ContinueResolution` — `ok` / `refused` / `unparseable` — and `settleContinueRun` (`jobs.ts:2221`)
owns the verdict, extracted from `runContinueJob` so it is testable without spawning `claude`.

`serve.ts` was left alone on purpose: it hands the same string to the `/atomize` subprocess as
`job.arg`, and that subprocess already worked. Only the verification was broken. Rewriting the
producer would have changed what a working live spawn receives, in the one room Muxin publishes
from, to fix a bug that was never in the spawn.

The three resolution states are deliberately not two. `unparseable` keeps the historic escape hatch
(spawn, verify by exit code only, stamp nothing). `refused` fails the job **without spawning** —
`runContinueJob` settles it ahead of `runAtomizeJob`.

### What the audit caught, across three rounds

The cross-family auditor (Codex) returned "do not accept" **twice** before clearing it. Both
rejections were correct.

1. **Round 1 — the containment check the builder added created a false-success branch.** An
   out-of-tree folder resolved to null, and null was already the "cannot inspect, trust the exit
   code" branch, so `content/../evil` went from *failing on no growth* to *passing silently*. A
   guard that widened an escape hatch. Fixed by the three-way resolution above.
2. **Round 1 — containment was a string prefix test, so a symlink walked through it.** Reproduced:
   a symlink under `content/` got outside files counted and an outside file stamped
   `engine: codex`. Fixed by canonicalizing both sides first.
3. **Round 2 — `canonicalPath` treated every `realpathSync` error as "does not exist yet".** A
   dangling symlink and an `EACCES` both fell through to lexical acceptance. Now **ENOENT only**,
   with an `lstatSync` probe to separate a genuinely missing entry from a dangling link; anything
   else refuses. Containment that cannot be established is a refusal, never a fallback.
4. **Round 2 — the guard checked one path and handed the subprocess another.** `resolve()` collapses
   `..` before symlinks resolve, so `content/link/../marker` passed as `content/marker` while the OS
   would follow it to `outside/marker`. Killed at the class level rather than per-traversal: **any
   `..` segment is refused before resolution**, one condition, consistent with `parseContinueArg`
   already refusing `..` in a `--cut` value.
5. **Round 2 — the one test written to prove "no spawn" did not prove it.** It set
   `stoppedByMuxin: true`, which short-circuits earlier anyway, so it passed with the refusal branch
   deleted. That is the "assert the outcome, not the call" rule failing inside its own enforcement
   test. Rewritten against a live job, asserting on what an entered spawn observably leaves behind
   (`lastSpawn`, the job log, both written before the spawn).
6. **Round 3 — a test restored `process.env.PATH` as the literal string `"undefined"`** when it had
   been absent. Fixed to delete rather than assign.

### Scope calls made, and why

- **Containment was never in this packet.** The builder added it while fixing a path-shape bug, and
  every audit finding after round 1 was against that addition rather than the original defect. The
  defect itself — a working Notes job reporting failure — was fixed in cycle 0 and stayed fixed.
  Before pushing further, the producer surface was checked: one call site, argument generated by
  this codebase, no route and no user input. **This is correctness hygiene, not a security
  boundary**, and the builder was told so explicitly to stop it building defence in depth.
- **DECLINED — uppercase `CONTENT/slug` is refused on case-insensitive macOS.** Real and reproduced.
  No producer emits it, refusing is the strict-and-safe direction, and case-folding a containment
  check correctly across filesystems costs more than the case is worth. Accepted limitation.
- **DECLINED — the resolver's filesystem calls are not atomic** against a concurrent symlink swap.
  Theoretical; nothing local reaches it. No redesign.
- **DECLINED — `..` refusal also rejects legal-but-unusual filenames** containing a
  backslash-delimited `..`. No producer emits one.
- **RECORDED, NOT FIXED — `jobs.ts:86` joins an unrestricted `row.asset` onto the folder,** so an
  ordinary, properly contained folder can stamp a file outside the repository. Reproduced by the
  auditor. Pre-existing, different function, different surface, not in this slice's owned files.
  Filed as item (e) in the master document.
- **NOTED — the new `try/catch` around `stampFolderEngine` is a deliberate behaviour change.**
  Previously an exception escaped before the job settled. Swallowing matches the rule the
  atomize-family branch of `drain()` already applies to the same two stamp calls.

### Checks

- `npm run check` (unsandboxed, coordinator, once, last): **4260 / 488 / 0 fail**, exit 0.
- `node --import tsx --test src/review/develop.test.ts src/review/jobs.test.ts src/review/serve.test.ts`:
  249 pass, 0 fail. Under the sandbox `serve.test.ts` contributes 3 `listen EPERM` failures
  unrelated to this diff — a known machine fact, not a defect.
- Mutation checks, each fix reverted alone and confirmed to turn its own test red, then restored:
  the resolution line, the ENOENT-only guard, the `..` refusal, and the early refusal branch.

### Evidence locations

- Absolute producer, observable outcome plus engine stamp, fixture pinned to the real
  `scaffoldContentFolder`: `src/review/develop.test.ts:332`.
- Relative shape still resolving to the same directory (dead producer, kept as insurance):
  `develop.test.ts:424`.
- Genuinely empty run still reports no progress: `develop.test.ts` empty-run test.
- Out-of-tree refusal asserting `job.status` and `job.error`: `develop.test.ts:551` region.
- Dangling symlink and `EACCES` refused, not-yet-created folder still accepted: `develop.test.ts:551`.
- Non-null spawn failure beats real artifact growth: `develop.test.ts:470`.
- Refusal settles without spawning: `develop.test.ts:615`.

### Unresolved

Only the recorded out-of-scope item: `jobs.ts:86`'s unrestricted `row.asset` join, filed as master
document item (e).
