# SLICE-5G: score configured derivatives and surface the storytelling soft gate

> **STATUS: DECLINED — not built, will not be built.** Muxin's decision, 2026-09-05. The work was
> implemented and passing before it was dropped; the reasoning is in `## Closeout result` at the
> bottom of this file. The packet body below is kept as the record of what was scoped, not as a
> work order. Do not build it. Do not revive it without re-reading the closeout first.

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`generateConfiguredContent` (`src/review/jobs.ts`) judges each derivative it generates on the six
`/atomize` score dimensions, records them, and surfaces the storytelling soft gate — without
touching a single byte of composed prose.

When the run finishes writing bodies, ONE batched analyst call scores every generated variant at
once on `native`, `brand`, `hook`, `narrative`, `resonance` (integers 1-5) and `cta` (boolean).
For each derivative that scored:

- its frontmatter gains a `scores:` block carrying those six values;
- its `review-queue.md` row's existing `native(1-5)` / `brand(1-5)` / `cta` cells carry the values
  instead of today's `—`;
- when `hook`, `narrative`, or `resonance` is `<= LOW_SCORE_THRESHOLD`, the exact text
  `spinPassNote()` returns is appended to that row's `notes` cell.

**The gate is soft and the scorer fails open.** A low score never blocks, never discards, never
rewrites, and never changes what is generated — it annotates a row that still lands `pending` for
Muxin's review. If the scoring call fails, returns unparseable output, or omits a variant, that
variant keeps today's behavior exactly: no `scores:` line, `—` in all three cells, an unmodified
notes cell, and generation still succeeds.

This is the §5 alignment-plan row "Scoring (native, brand, hook, narrative, resonance, CTA) and the
soft gate" ported into the Content path. It matches the standing decision that these signals
**surface a flag and never auto-apply**: `/atomize`'s own rule is that the storytelling flag goes in
the `notes` cell and the queue table never grows a column.

## Difficulty

hard — the deterministic half is trivial (`storytelling.ts` is already pure plumbing), but the
scores it plumbs do not exist in this path and cannot be computed from text: in `/atomize` they are
Claude's inline judgment. So this slice must introduce the first model call in the configured
generation path that is not body composition, behind a seam that keeps it injectable, batched,
fail-open, and provably unable to alter a body.

## Depends on

None outstanding. 5a-5f are accepted and on `main`; the alignment plan's forced chain requires only
the routing gate and `validate` before the remaining §5 capabilities, and both landed (5a, 5b). This
slice reads `storytelling.ts`, which already exists complete.

## Owned files

Parallel-safe: **no** — lanes run one at a time. The work does not divide: the `jobs.ts` wiring
consumes the widened row type from `queue.ts` and the scorer module's exported types, so every path
here is downstream of another path in the same slice.

### Lane A — the scorer seam, the queue-row widening, and the wiring

- `src/review/configured-scoring.ts` (new)
- `src/review/configured-scoring.test.ts` (new)
- `src/review/jobs.ts`
- `src/review/content-scoring-gate.test.ts` (new)
- `src/publish/queue.ts`
- `src/publish/queue.test.ts`

## Do not touch

- `src/atomize/storytelling.ts` — import `parseStorytelling`, `spinPassNote`, `needsSpinPass`,
  `lowDimensions`, and `LOW_SCORE_THRESHOLD` from it. Do not move, reimplement, re-tune, or
  re-home them, and do not change the threshold value or the note's wording.
- `src/atomize/**` and `.claude/skills/atomize/SKILL.md` — the `/atomize` path stays byte-for-byte
  identical. This slice adds a second consumer of `storytelling.ts`, nothing more.
- **Composed prose.** Derivative bodies, variant ordering, which variants get generated, the
  treated/control split, `source.md`, and the editor/voice checks are all untouched. The scorer
  runs strictly AFTER bodies are written and may only add metadata. It never rewrites, re-requests,
  re-orders, discards, or blocks a variant, whatever it returns.
- `config/providers.yaml`, `config/platforms.yaml`, `config/voice.yaml`, `src/providers/**` — reuse
  an EXISTING subscription-route seam for the call (the analyst seam if one is exported, otherwise
  the seam the configured generator already uses for bodies). Do not add a provider adapter, a new
  config key, a new model route, or anything that could select a paid per-token API.
- The `review-queue.md` table's column count and order — three scripts parse that table by fixed
  column position. Fill the three cells that already exist; never add, remove, or reorder a column,
  and never widen the header written at `src/atomize/new-content.ts`.
- `readQueue`'s `QueueRow` interface (`src/publish/queue.ts`) — it does not parse the score cells
  today and must not start; only the WRITE path (`NewQueueRow` / `appendRows`) changes.
- `src/db/tag-source.ts`, `src/strategy/grade-bets.ts` — reading scores back into analytics is a
  separate downstream slice, out of scope.
- `src/atomize/thread-check.ts` — the sibling soft gate is its own later slice. Do not port it here.

## Cited headings

none

## Acceptance

- [ ] A new module `src/review/configured-scoring.ts` owns the scoring seam: it builds one prompt
      covering ALL generated variants of a run, invokes an existing subscription-route seam once,
      and parses the response into a per-variant map of
      `{ native, brand, hook, narrative, resonance, cta }`. The invoking function is injectable
      (a parameter or exported default that tests can substitute), so every test in this slice runs
      with NO live model call.
- [ ] Parsing is strict and total: a response that is unparseable, is not the expected shape, omits
      a variant, carries a non-integer or out-of-range `1-5` value, or carries a non-boolean `cta`
      yields NO scores for the affected variant rather than a coerced or partial value. A thrown
      error, a rejected promise, or a timeout from the seam is caught and yields no scores for the
      whole run.
- [ ] `generateConfiguredContent` invokes the scorer at most ONCE per run, after all bodies are
      written, and stamps each scored derivative's frontmatter with a `scores:` block carrying the
      six values, spliced alongside the existing 5c/5d/5e frontmatter without reordering or
      displacing any of it.
- [ ] `NewQueueRow` gains optional `native` / `brand` / `cta` fields and `appendRows` writes them
      into the three existing cells; when a field is absent the cell keeps today's exact `—`. The
      header, column count, and column order are unchanged.
- [ ] When `parseStorytelling` yields scores and `needsSpinPass` is true, the row's `notes` cell is
      the existing `configuredQueueNote` text with `spinPassNote()`'s exact string appended (the
      note is preserved, not replaced). When `needsSpinPass` is false, the notes cell is exactly
      what it is today.
- [ ] Soft gate proven soft: a variant scoring `1` on every dimension is still written, still
      appended to `review-queue.md`, and still `pending`. No score value on any dimension can cause
      a variant to be discarded, blocked, regenerated, or reordered, and no score value reaches the
      `gateViolations` abort path.
- [ ] Fail-open proven: with a scorer that throws, one that returns unparseable output, and one that
      returns scores for only some variants, `generateConfiguredContent` completes successfully and
      every unscored derivative is byte-for-byte identical to the pre-change baseline — no `scores:`
      line, `—` in all three cells, notes cell unchanged.
- [ ] Prose untouched, proven by comparison: for the same inputs, a scored run's derivative body and
      `source.md` are byte-for-byte identical to an unscored run's, and the ONLY frontmatter
      difference is the added `scores:` block.
- [ ] `src/review/configured-scoring.test.ts` covers the prompt/parse unit surface (valid response,
      each rejection case above, the batching of multiple variants into one call, and an assertion
      that the seam is invoked exactly once). `src/review/content-scoring-gate.test.ts` covers the
      end-to-end path through a real `generateConfiguredContent` run with an injected scorer:
      scored happy path, all-1s soft-gate annotation, and the three fail-open cases.
      `src/publish/queue.test.ts` gains coverage that an absent score field still writes `—` and a
      present one writes the value, with the row's other cells unchanged.
- [ ] No new dependency. No new config key. The `LOW_SCORE_THRESHOLD` stays the constant in
      `storytelling.ts`.
- [ ] **Live canary, budget: one call, at most one retry.** After the deterministic tests pass, run
      the real seam once against a single small generated variant to confirm the production
      response actually parses into scores. Record the raw response shape and the parsed result in
      the RESULT BLOCK. If it does not parse, do NOT loosen the parser — report it; fail-open means
      the slice is still safe, and the prompt is a follow-up. Use only the subscription route; log
      nothing to `data/cost-log.csv` unless the route billed.

## Verify

Focused, from the repo root:

```
node --import tsx --test src/review/configured-scoring.test.ts src/review/content-scoring-gate.test.ts src/publish/queue.test.ts src/review/jobs.test.ts
```

Then type-check:

```
npx tsc --noEmit
```

## Observable result

Generate content in the Content Studio. Each derivative's frontmatter now carries a `scores:` block,
and the `review-queue.md` rows show real numbers in `native(1-5)` / `brand(1-5)` / `cta` where three
`—` used to sit. A weak variant's row reads, in its notes cell, the existing note followed by
`flag: spin pass suggested (low: hook, narrative)` — and that variant is still sitting there
`pending`, waiting for Muxin, exactly like every other row. Break the scorer and generate again: the
rows look precisely as they do today, and generation still succeeds.

## Risk

medium — audit required: **yes, cross-family**. Three things raise this above the 5b-5f metadata
slices: it introduces the first non-composition model call into the configured generation path, it
widens a shared write path (`appendRows`) that three positional parsers depend on, and a scorer that
misbehaved in the wrong place could in principle influence what ships. The design answers each
(scoring runs after bodies are written, may only add metadata, is batched to one call, is
injectable, and fails open), so the audit's job is to confirm those answers hold in the diff rather
than only in the prose. Audit must specifically establish: no score value can alter, block, discard,
reorder or regenerate a variant; the queue table's column geometry is unchanged; the unscored path
is byte-identical to baseline; and no paid per-token route can be selected.

## Families

- Builder: Claude (strong tier) — single lane.
- Auditor: OpenAI / Codex (GPT, strong tier) — different family from the builder, as required.

## Closeout

Repo-wide gate, run UNSANDBOXED (the sandbox produces phantom venture failures):

```
npm run check
```

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
