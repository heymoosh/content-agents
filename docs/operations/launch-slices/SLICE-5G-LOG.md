# SLICE-5G — archived history

Moved out of `SLICE-5G.md` by SLICE-6E to bring the packet under the 12,288-byte cap. Newest
first. Every line here was removed verbatim from the packet.

## Superseded banner wording (2026-09-05)

The status banner's pointer to this record originally read (now repointed at this LOG file):

> implemented and passing before it was dropped; the reasoning is in `## Closeout result` at the
> bottom of this file. The packet body below is kept as the record of what was scoped, not as a
> work order. Do not build it. Do not revive it without re-reading the closeout first.

## Closeout result

**DECLINED — reverted, not merged** (Muxin, 2026-09-05). The working tree was restored with
`git checkout --` on the three modified files and the three new files deleted; `git status` is clean
apart from this record.

Muxin questioned the premise — "I don't remember EVER using a scorer on my content BEFORE we
published" — and the investigation showed the capability was worth less than the port cost:

1. **Almost nothing reads the scores.** `readQueue` (`src/publish/queue.ts:57`) parses cells
   1,2,3,4 and then jumps to cell 8 for status; cells 5/6/7 (`native`, `brand`, `cta`) are never
   read. Publishing never sees them. `tag-source.ts`, `grade-bets.ts`, and `resonance` never see
   them. The only machine consumer anywhere in the repo is `validate.ts:318`, which prints one
   advisory line (`storytelling: N scored, M flagged … not blocking`). The scores are numbers in a
   table for a human's eyes, and have never gated, sorted, or fed anything.
2. **The signal was never validated.** Claude grading its own draft has never been tested against
   real engagement; no evidence exists that a "4 native" post outperforms a "3."
3. **The port added a real cost.** An unconditional model call plus ~7s of latency on every Studio
   generation (see the RESULT BLOCK's unresolved note), paying for output that feeds nothing.

Quality is built in upstream — the `patterns` work, `config/voice.yaml`, and the configured
treatments — not labelled after the fact. A post-hoc grade does not improve a draft.

**This declines the port, not the capability's premise.** `/atomize` keeps scoring exactly as it
does today (real queue rows have carried `| 5 | 4 | yes |` and `flag: spin pass suggested (low:
narrative)` since June); `storytelling.ts` and its `validate` advisory are untouched. The §5
alignment-plan row "Scoring … and the soft gate" is closed as **declined**, not deferred.

Two narrower successors were offered and NOT taken, recorded here so the reasoning is not relitigated
from scratch: (a) port only the storytelling flag into the notes cell, skipping the native/brand/cta
numbers — the one output that would give a genuine "look at this one" signal; (b) first build the
slice that checks whether scores predict real engagement, letting the numbers earn their keep or be
deleted. Revive (a) only if a Studio queue ever gets long enough that triage actually hurts.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths: `src/review/configured-scoring.ts` (new), `src/review/configured-scoring.test.ts`
  (new, 23 tests), `src/review/content-scoring-gate.test.ts` (new, 7 end-to-end tests),
  `src/review/jobs.ts` (+40/-3), `src/publish/queue.ts` (+11/-1), `src/publish/queue.test.ts`
  (+51/-0). **All reverted — see the closeout below. Nothing was committed.**
- Outcome: complete, every acceptance item met. `scoreConfiguredVariants` reused the existing
  subscription analyst seam (`getAnalyst()` → codex CLI, claude-cli fallback, both $0), one batched
  call per run, injectable, placed below the `gateViolations` throw so no score could reach the abort
  path. Threshold and note wording stayed in `storytelling.ts`.
- Checks run and results: focused suite 182 pass / 0 fail; `npx tsc --noEmit` clean; regression set
  88/88 unsandboxed. Live canary: one call, zero retries, `claude-cli`, `costUsd: 0`, 7.2s, response
  parsed correctly (`native:5, brand:5, hook:4, narrative:4, resonance:4, cta:false`).
- Unresolved (the finding that ended the slice): the scorer fired on **every** configured run,
  unlike every other model call in that path, which is reached only by constructing a run that needs
  one. The first regression pass therefore spawned real CLI calls inside `npm test` (254s runtime)
  and broke SLICE-5E's byte-identity assertion with nondeterministic scores. The builder fixed it
  correctly with two env guards (`NODE_TEST_CONTEXT`, `disposableConfiguredEngineAuthorized()`), but
  that it needed guarding at all is the point: this slice added an unconditional per-run model call.
