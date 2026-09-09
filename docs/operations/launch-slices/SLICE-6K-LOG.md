# SLICE-6K — dated session records

Newest first. No session reads this file at start; it exists so `SLICE-6K.md` can stay small.

## Accepted — 2026-09-09

**PASS.** `npm run check` exit code captured directly (not piped through `tail`): exit 1,
4372/4373 pass, sole failure is the pre-existing, out-of-scope SLICE-5Z env-leak test
(`src/review/jobs.test.ts`) — reproduced with this slice's files stashed out, confirmed unrelated,
independently reconfirmed by the coordinator's own final run. Every acceptance item is mapped to a
named test (`src/operations/freeze-candidate.test.ts`, 13 tests) or a recorded command/output.

Gate cost: `npm run check` run three times during repair (worker) plus once by the coordinator on
the final candidate. Coordinator's final run: 2m21.510s wall (`real`). Provider-reported model
usage: unknown, not surfaced to either session.

### Cross-family audit (Codex), two rounds

- **Round 1** — HIGH: declared exceptions suppressed the untracked-path refusal (an untracked path
  named in `--allow` reached `ok:true`, so it would be silently missing from the frozen checkout).
  Fixed: untracked check now runs before the exceptions lookup and never consults it; regression
  test added (`freeze-candidate.test.ts`: "a declared exception never suppresses the
  untracked-path refusal").
  MEDIUM: `--scratch-root` had no containment check requiring it to land outside the repository.
  Fixed: added `repoRoot` to `PlanFreezeInput`, a new `scratch_root_inside_repo` refusal reason,
  and an `isInsideRepo()` check; two regression tests added (nested path, repo-root-itself).
  MEDIUM: a failed `git diff --name-only` silently defaulted `changedPaths` to `[]`, so the
  manifest could misstate what it froze. Fixed: the CLI now surfaces the error and exits 1 instead
  of defaulting.
- **Round 2 (repair verification)** — both fixes confirmed real by independent re-read of the new
  code. Two new items surfaced:
  - Gitignored files are absent from `git status --porcelain` and thus silently excluded from the
    untracked-path check. **Coordinator disposition: not a defect, by design** — ignored files are
    never part of any git-tracked candidate sha for any consumer (CI, a clone, a reviewer
    checkout), and this repo has real gitignored clutter (`.env`, `data/analytics.db`,
    `node_modules`, logs) that adding `--ignored` would spuriously flag as blocking. No change.
  - Symlink-mediated scratch-root containment bypass (an "outside" path could pass the check via a
    symlinked ancestor into the repo). **Accepted as P2 hardening, not fixed**: this is local
    single-operator tooling, not an adversarial boundary; low enough risk not to warrant a
    follow-up card.
  - Two cheap test gaps flagged (no regression test for the diff-failure path; the scratch-root
    CLI refusal test only asserted `assert.throws`, not the actual refusal reason) — both closed:
    added a CLI test that provokes the diff failure and asserts nothing gets created, and tightened
    the scratch-root test to assert `stderr` contains `scratch_root_inside_repo`.

### Hygiene disposition

`bash scripts/repo-hygiene.sh --rescue` — exit 1 (expected; non-zero alone is not a failure per
the bindings). Output reviewed. This session created exactly one path: `src/operations/` —
committed in this slice's commit. No other untracked path was created by this session. Every other
path the command listed was **not** created by this session and is named and left in place:
`.gitignore`, `content/2026-09-07-.../review-queue.md`, `data/notes-spread-ledger.jsonl`,
`e2e/run-all.ts` (in-flight, believed to be 6L's work — disjoint owned paths per this packet), the
three `/private/tmp/content-agents-6d-*` worktrees, merged branches `slice-5q-queue`/
`slice-5r-routing`, and unpushed branches `agent/cs2-*`/`agent/cs3-*`/`agent/cs6-*`.

### Read-set measurement

Protocol section (`AGENTS.md` → `## Slice protocol`): 32402 B. Master document `## START HERE`
block: 927 B (measured against the pre-6K commit `83f9aa4`, per the bindings' pinned-commit form).
This packet (`SLICE-6K.md`) at read time, before this closeout trimmed it: 14519 B (over cap;
trimmed to this log at closeout, per packet size discipline).

### RESULT BLOCK (worker, final)

- Changed paths: `src/operations/freeze-candidate.ts` (new), `src/operations/freeze-candidate.test.ts`
  (new, 13 tests), `package.json` (one `scripts` line added, no other change).
- Outcome: built and verified. `planFreeze` is a pure function (no git call, no fs write) that
  refuses on `sha_mismatch`, `untracked_path` (never suppressible by a declared exception),
  `undeclared_modification` (suppressible only by a declared exception), or
  `scratch_root_inside_repo`; otherwise returns an accepted plan carrying sha/changedPaths/
  checkoutPath. The CLI wraps it: reads `git rev-parse HEAD` / `git status --porcelain=v1` / `git
  diff --name-only <base>...HEAD` (refuses on failure rather than defaulting to `[]`), calls the
  pure planner, and on acceptance runs `git worktree add --detach` plus writes a
  `<checkoutPath>.manifest.json` with sha/checkoutPath/changedPaths/ISO timestamp.
- Checks run and results: module tests 13/13 pass; `npx tsc --noEmit` exit 0; `npm run check`
  (coordinator's final run) exit 1, 4372/4373 pass, sole failure pre-existing/out-of-scope
  (SLICE-5Z, `src/review/jobs.test.ts`); `bash scripts/repo-hygiene.sh --rescue` exit 1, reviewed,
  disposition above.
- Real invocation against this candidate: `npm run freeze-candidate -- --expected-sha
  83f9aa4337cd1ac1243a1cb01bf1d45951c513ff --allow ".gitignore,content/2026-09-07-.../review-queue.md,
  data/notes-spread-ledger.jsonl,e2e/run-all.ts,package.json,src/operations/" --scratch-root
  "$TMPDIR/freeze-6k-demo-83f9aa43..."` — exit 0, froze sha `83f9aa4337cd1ac1243a1cb01bf1d45951c513ff`
  (matched `git rev-parse HEAD` and the checkout's own `HEAD`), manifest written alongside the
  checkout, both cleaned up after verification (`git worktree remove --force`).
- Evidence locations: worker's full-suite logs (`/tmp/claude/check-6k.log`, `-2.log`, `-3.log`);
  coordinator's final run `/tmp/check-final.out`; hygiene log `/tmp/hygiene-final.out`; two Codex
  audit transcripts in this session's scratchpad
  (`.../scratchpad/slice-6k-audit-{prompt,result}{,-2}.txt`).
- Unresolved: none carried forward without a disposition. Symlink-containment hardening recorded
  above as accepted P2, not tracked as a follow-up card.
- Delivery state and next action: accepted and committed by the coordinator in the same commit as
  this packet update and the master-document `## START HERE` rewrite.
- Usage: worker's three full `npm run check` runs ~152s/169s (third run skipped, rationale: only
  the test file changed after that point) local elapsed; coordinator's final run 2m21.510s wall.
  Two Codex audit calls: ~30.3K and ~39.0K tokens per their own reported totals. Claude model-call
  usage: unknown, not surfaced to either session.
