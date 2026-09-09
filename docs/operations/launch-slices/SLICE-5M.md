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
