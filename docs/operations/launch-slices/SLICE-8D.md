# SLICE-8D: Restore Postiz character caps and make publishing tests fail closed

Protocol: `AGENTS.md` -> `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md`. Do not load the repository for context.
Do not commit, stage, push, checkout or stash.

## Goal

A destination configured without `max_chars` falls back to Studio/Postiz's destination limit rather
than Infinity, and any Node test that reaches Placed-log writing without a temp override fails before
it can touch the real log.

## Difficulty

hard - two small fixes protect live publishing boundaries and must preserve non-Studio publishers.

## Depends on

none

Delivery batch: SLICE-8B, SLICE-8C, and SLICE-8D are owner-authorized by the 2026-09-12 Codex
handoff. This slice is the publishing-safety deliverable. Stop after frozen candidate and RESULT BLOCK.
Owner checkpoint: none; the fixed outcomes are explicit in the handoff.

## Owned files

Parallel-safe: yes. This lane owns only the max-character loader/callers and Placed-log safety paths;
SLICE-8C owns Studio row visibility. Focused tests use temp paths only.

### Lane A - character-limit fallback and test-write guard

- `src/publish/typefully.ts`
- `src/publish/typefully.test.ts`
- `src/publish/queue.ts`
- `src/publish/queue.test.ts`
- `src/review/studio-scheduling.ts` and one focused scheduling test only if the fallback cannot be
  expressed without changing the call contract

Pinned read-only inputs: `config/platforms.yaml`, existing `POSTIZ_MAX_CHARS`, package test runner.
Frozen handoff: path-bounded diff plus genuine red/green focused output.

## Do not touch

- real `briefs/**/bets.md`, any operational ledger/journal, `.env`, provider APIs, content folders,
  or SLICE-8C paths.
- Do not weaken a test or add a silent redirect that masks missing isolation.
- Do not run repo-wide rewriting commands.

## Cited headings

none

## Acceptance

- [x] A focused test is genuinely red before each behavior fix.
- [x] Missing `max_chars` is represented as no override, not Infinity.
- [x] Studio/Postiz resolves no override to its destination fallback cap.
- [x] Explicit finite platform limits still win; existing Typefully/card behavior is unchanged.
- [x] Under Node's test context, a publishing-path Placed-log write without the temp override throws
      before opening the production file; a configured temp path still works.
- [x] Focused tests and final repository gate pass without touching a real Placed log.

## Verify

Classification and applicable gate: meaningful publishing/data-integrity behavior; focused TDD,
cross-family audit, then final `npm run check` once on frozen candidate.

```
node --import tsx --test src/publish/typefully.test.ts src/publish/queue.test.ts
```

## Observable result

An absent config cap cannot create an uncapped Postiz post, and a misconfigured publishing test fails
loudly without changing a human-inference Placed log.

## Risk

high - audit required: yes; this changes limit resolution and guards production-adjacent writes.
Review boundary: this candidate.
Review scope/budget: all `loadPlatformMax` consumers and every Placed-log writer reached by tests;
Grok ordinary effort against exact diff, symbol-use search, and focused output.
Prior accepted evidence: SLICE-8A exposed both gaps but did not close them.
On reviewer outage: candidate remains review-blocked; SLICE-8B and SLICE-8C may continue.

## Families

- Builder: Codex Luna worker, high effort.
- Auditor: Grok `grok-4.5`, ordinary effort, cross-family.

## Closeout

Preflight: symbol-use search, red/green output, real-log before/after hash evidence, frozen diff.
Gate cost: final passing `npm run check` took 168.4 seconds.

**PASS** - 2026-09-12. Acceptance, cross-family audit, real-log safety proof, and final gate are
complete.

## RESULT BLOCK

- Changed paths: `src/publish/typefully.ts`, `src/publish/typefully.test.ts`,
  `src/publish/queue.ts`, `src/publish/queue.test.ts`, and
  `src/review/studio-scheduling-postiz.test.ts`.
- Outcome: `loadPlatformMax()` omits unconfigured caps. Studio/Postiz then uses
  `POSTIZ_MAX_CHARS`, while Typefully and Cards retain their explicit `?? Infinity` no-override
  behavior. Node tests now fail closed before a Placed-log write unless
  `CONTENT_AGENTS_TEST_BETS_PATH` is set.
- Checks run and results: cap red failed 2 behavior assertions, green passed 43/43; guard red failed
  1 behavior assertion, green passed 46/46; final focused suite passed 90/90. The first frozen
  typecheck exposed one narrow test-env inference error; a `NodeJS.ProcessEnv` annotation repaired
  it and focused typecheck passed. All 13 direct Placed-log caller suites then passed 172/172.
  Final `npm run check` passed typecheck and 4576/4576 tests from the bound checkout, whose eight
  candidate files were byte-identical to frozen commit
  `6f4a546973d4c4422d2d8169ad5fd29994d7beed`.
- Independent audit: Grok 4.5 ordinary effort found no defect and requested bounded proof for
  Typefully/Cards consumers and the named Postiz fallback. Exact call sites plus the added
  no-override regression closed both findings; delta verdict PASS.
- Evidence locations: focused command outputs and candidate diff summarized here. The real
  `briefs/human-inference/bets.md` hash stayed unchanged across every focused and diagnostic run.
  Detached-checkout full tests failed only because two secret-sanitization tests require the real
  root `.env`; JUnit identified those exact environment refusals. No secret was copied or linked.
- Unresolved: none.
- Delivery state and next action: accepted and ready for coordinator integration.
- Usage: builder/auditor token and cost reports unavailable; final gate 168.4 seconds.

## Usage budget and handoff

- Each extra lane: one safety worker produces an independent, disjoint deliverable while scheduling waits.
- Assignment: fresh Codex Luna worker; retain it for related repairs.
- Evidence return: focused red/green commands, exits/counts, symbol-use search, real-log hash proof.
- Capability boundary: automatic closeout after audit and final gate.
