# SLICE-6R — dated session records

Newest first. No session reads this file at start; it exists so `SLICE-6R.md` can stay small.

## Accepted — 2026-09-10

**PASS.** Accepted and committed on `main`.

### RESULT BLOCK

- Changed paths: `src/atomize/reply-draft.ts`, `src/outreach/research.ts`,
  `src/providers/polish/claude-cli.ts`, `src/fiction/continuity.ts`, `src/fiction/idea-inbox.ts`,
  `src/fiction/review-pr.ts`, `src/util/env.test.ts` (new). Nothing else.
- Outcome: all six sites pass `env: withoutDotenvKeys()`, imported from `src/util/env.js`;
  `research.ts` keeps `OUTREACH_SEARCH_BUDGET_COUNTER_FILE`/`OUTREACH_SEARCH_BUDGET_TOTAL`
  byte-for-byte; `review-pr.ts:21` (git/gh) still gets the full environment, asserted by a test.
- Checks run and results: `node --import tsx --test src/util/env.test.ts` — exit 0, 4/4 (worker
  and coordinator, both unsandboxed, real `.env`). Focused regression suite (reply-draft, research,
  continuity, idea-inbox, review-pr) — exit 0, 99/99, matching pre-change baselines. Negative-proof:
  worker temporarily reverted `continuity.ts`'s site, reran the guard test, got a failure naming
  that file, then restored it. `npm run check` unsandboxed — exit 0, 4378/4378 (worker: 152s;
  coordinator's independent re-run: 149.5s). Hygiene — exit 1, listing exactly this slice's own 7
  paths (expected: worker doesn't commit).
- Evidence locations: canary/check transcripts under `/tmp/claude-501/slice-6r/`
  (canary1-script-draft.log, canary1-folder/, canary2-grok.log, npm-check.log, hygiene.log,
  cost-log before/after shas). Codex audit transcript: `/tmp/claude-501/slice-6r-codex-audit.log`.
  Audit input: `/tmp/claude-501/slice-6r-diff.txt`, `/tmp/claude-501/slice-6r-env.test.ts`.
- Unresolved: none against this slice's acceptance list, after disposition of the one audit
  finding below. One deviation: Canary 1 ran over a scratchpad *copy* of an existing `content/`
  folder rather than in place, because `script.ts` writes `video/script-draft.md` into the target
  and appends `data/cost-log.csv`, which acceptance requires unchanged. The `$0` cost row still
  appended to the real repo file during the run; the worker restored `data/cost-log.csv` from a
  byte-exact pre-run backup and confirmed the sha matched before and after (`46583b8a…`). Verified
  by the coordinator via `git status --porcelain -- data/ content/ config/ review-queue.md` —
  clean.
- Delivery state and next action: accepted and committed. No next action for 6R.
- Usage: worker — focused suites ~1s each, `npm run check` 152s, canary 1 14s ($0 subscription
  route), canary 2 13s, token usage `unknown` (not reported). Coordinator — one focused-test
  re-run (161ms), one `npm run check` re-run (149.5s), one Codex audit (42,928 tokens, reported).
  Two canaries total, zero retries. No paid API calls.

### Audit

Codex (cross-family, `codex exec --sandbox read-only --skip-git-repo-check` unsandboxed, default
model — `gpt-5.1-codex-max` rejected on this account, matching 6Q's precedent). Ran against the
six-file diff and the new test file only (not the live repo). Verdict: one established finding
(P2), no production-code defect.

**P2 — source guard uses a windowed substring search, not an exact check that the spawn's `env`
expression is `withoutDotenvKeys()`.** A comment or unrelated mention of the helper name inside a
site's window would in principle satisfy the guard even if the real `env:` value still used
`...process.env`. Flagged as a robustness gap in the guard, not a defect in the six production
sites.

Disposition — no fix required this slice: coordinator checked (`grep -n withoutDotenvKeys` per
file) that in the current source, for all six files, the only in-window occurrence of the helper
name is the real call itself; every file's `import` line falls before its anchor's window starts.
No false-positive currently exists. The packet's own acceptance criterion #4 requires the guard to
fail when a site "does not reference `withoutDotenvKeys`" — the implementation meets that literal
bar, and the continuity.ts negative-mutation proof already demonstrates it catches a real
reversion. Codex's suggested AST-based hardening (assert the exact `env` expression, forbid
`process.env`) is recorded as an optional improvement, out of this slice's scope.

Answers to the four required questions: (1) no site drops environment beyond what
`withoutDotenvKeys()` strips, per the diff; (2) `research.ts`'s budget/counter pair preserved
byte-for-byte, confirmed as unchanged diff context; (3) the guard reliably catches the demonstrated
mutation but is not airtight against a constructed false positive (see P2 disposition above); (4)
no non-agent spawn was narrowed — `review-pr.ts:21`'s git/gh exec is untouched and has its own
guard test.

### Canary

Canary 1 (`claude` family): `npm run script:draft` over a scratchpad copy of
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference`, exit 0, 14s wall, 210-word
draft, `$0.0000 (claude-cli)` subscription route. `data/cost-log.csv` restored to its pre-run sha
afterward (see Unresolved above).

Canary 2 (`grok`, non-`claude` engine): the packet's `callEngineContinuity('grok')` one-liner
under the narrowed environment, exit 0, 13s wall, returned `"OK\n"`. `grok` and `codex` are both
installed and `grok` authenticated, so the Canary-2-unavailable revert rule did not apply — all
six files ship, including the engine trio.

Two canaries total, zero retries.

### Preflight (per bindings' Closeout preflight list)

Candidate sha pinned at commit time; changed paths are exactly the seven Owned files. Every
acceptance item maps to a named command output, canary transcript, or diff review above. Exit
codes captured explicitly, never piped through `tail`. Cross-family audit obtained; its one
material finding closed by disposition (above), no code repair needed. Both canaries recorded.

Gate cost: `npm run check` on the frozen candidate, unsandboxed — 4378/4378, exit 0. Worker's run:
152s. Coordinator's independent re-run: 149.5s (real 2m29.519s). One rerun only, for independent
confirmation, not to refresh paperwork.

### Hygiene

`bash scripts/repo-hygiene.sh --rescue` — exit 1 (non-zero, expected). Output reviewed: it listed
exactly this slice's own seven paths (six modified, one untracked), snapshotted to
`refs/wip/content-agents`. Every path this session created was named and then committed (this
commit). No path belonging to another session appeared in the listing.

### Read-set

`## Slice protocol` section and master document `## START HERE` block sizes as read at worker/
coordinator session start: not captured verbatim this session (protocol prose read via `sed`/`awk`
excerpts rather than the exact byte-count commands in `slice-protocol-environment.md`). Packet as
read at session start: `git show 83c9e30:docs/operations/launch-slices/SLICE-6R.md | wc -c`.
