# SLICE-5R: X carries building and technical pieces only

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin's routing decision, 2026-09-07, in her words: "I have a preference to keep X only tech
related; society related posts I don't know putting on there unless I'm actually trying to promote
the voting product to right leaning groups." Then, after seeing the numbers: "I don't even know if
X is a place for human ai either" and "I'd keep X on those things (building and tech stuff)".

The numbers behind that, latest metrics per post from `data/analytics.db` on 2026-09-07: 264 X
posts, every pillar averaging about one interaction per post (civic-tech 8 posts at 1.0, human-ai
81 at 0.9, claude-code 62 at 0.9, builder 14 at 0.7, career-work 16 at 0.6, other 71 at 0.5). No
pillar earns X on data. The decision is Muxin's judgment about who is on X, not a data finding.

Today `config/routing.yaml` puts X in every pillar's cold-start default, and the SLICE-5P canary
essay (civic-tech + human-ai) was routed to X for that reason, not because anything fit. The
router already applies hard `rules.<pillar>.never` overrides after the data decision
(`config/routing.yaml` → `rules:`; `src/strategy/route.ts`).

Demonstrably true when done: only building and technical pieces auto-route to X. Document an
existing durable per-piece opt-in if available; otherwise record its absence as the A6 follow-up.
Verified 2026-09-07: a manual routing edit is overwritten by continuation, so a durable opt-in
(for example promoting the voting tool) remains a follow-up, not a delivered capability.

## Decision recorded

- **X stays on `claude-code` and `builder`.** Decided. (Muxin: "claude code only isn't a
  category but building and technical stuff is." The two pillars together are that category.)
- **X comes off `civic-tech`, `human-ai`, `other` and `career-work`: remove `x` from each
  default and add `rules.<pillar>.never: [x]` for each.** Decided, 2026-09-07, in her words:
  "I'd stop doing career-work on X. ONLY technical stuff goes on X cause that's the only thing
  that platform seems to respect these days. Think very silicon valley monoculture, if it fits
  that paradigm, it can go in X." Use that sentence, dated, as the comment in `routing.yaml`.

A piece tagged **both** civic-tech and human-ai (as the 5P essay was) now has X excluded by both
tags. Verified 2026-09-07: a piece tagged civic-tech and builder also excludes X: the existing
merge applies any pillar’s hard veto over another pillar’s include. Record that behavior in the
RESULT BLOCK. Do not change precedence here.

## Known data gap, not this slice's

Every X, LinkedIn and Substack row in `data/analytics.db` has a NULL `brand_id`; only Bluesky rows
carry `human-inference`. A brand-filtered routing run therefore sees no X history at all and
falls back to config. Backfilling `brand_id` is its own slice (see the master doc's START HERE);
do not touch the database here.

## Difficulty

Easy — a config rule that the router already honours, plus a test and a doc line.

## Depends on

SLICE-5P (closed first; it reads routing during a live run).

## Owned files

Parallel-safe: **no — single lane.** The config, behavior tests, and override documentation must agree; one worker.

### Lane A — the rule, its test, and the opt-in path

- `config/routing.yaml` — remove `x` from the `civic-tech`, `human-ai`, `other` and `career-work`
  defaults and add `never: [x]` under `rules.<pillar>` for each (civic-tech keeps its existing
  `always:`); add a two-line comment carrying Muxin's reason and the date. Leave `claude-code`
  and `builder` as they are.
- `src/strategy/route.test.ts` — a case proving X is excluded for civic-tech and for human-ai
  even when the data scores it above `skip_below_score`, and a case proving builder and
  claude-code still include X.
- `content/README.md` or the `routing.md` header the router writes, **whichever already documents
  how Muxin overrides routing for one piece** — add one sentence saying that promoting the voting
  tool on X is a per-piece manual include, and name the exact step (an edit to the piece's
  `routing.md` before `/atomize --continue`, or an existing flag if one exists). Find the existing
  mechanism; do not build a new flag. If no manual-include mechanism exists, record that under
  Unresolved as the follow-up slice and document nothing.

### Gate regression repair — same lane

- `src/review/content-generation.test.ts`: cold-start configured generation expectations must
  reflect X exclusion for the fixture's nontechnical pillar, preserving identity/gating proof.
- `src/strategy/exploration.test.ts`: live-config untested X pillar expectation reflects four
  removed assignments; do not weaken the existing hard-veto router behavior.
- `src/strategy/spin-control.test.ts`: live-config assigned pairs count/list reflect four removals.
- Run these three files and `src/strategy/route.test.ts` unsandboxed; retain actual TAP output.
  No production engine changes. Cross-family review required before the new frozen gate.

## Do not touch

- `src/strategy/route.ts` — the rule engine is not in scope. If `never:` turns out not to be
  honoured after data routing, stop and record `file:line`; that is a defect for its own slice.
- `config/pillars.yaml`, `config/platforms.yaml`.
- Any `content/<slug>/routing.md` already generated.
- `.claude/skills/**` — write-protected.

## Cited headings

`none`

## Acceptance

- [x] A1 — `npm run route -- --brand human-inference --all` (or the router's dry-run form) on the
      folder `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference` shows X
      excluded with a reason naming the rule, and Bluesky and the democratic-resilience community
      still included. Paste the relevant lines.
- [x] A2 — The two new `route.test.ts` cases pass and assert on the router's output list, not on
      the config having been read.
- [x] A3 — Every existing `route.test.ts` case still passes.
- [x] A4 — The comment in `routing.yaml` carries the date and the reason, no em dashes.
- [x] A5 — The RESULT BLOCK states what happens to a dual-tagged piece where one tag excludes X
      and the other keeps it (for example civic-tech + builder).
- [x] A6 — The per-piece opt-in step is documented in an existing place, or its absence is
      recorded as a follow-up.

## Verify

Run unsandboxed.

```
node --import tsx --test src/strategy/route.test.ts
npm run route -- --brand human-inference --all
```

## Observable result

Muxin runs the router on the 5P essay and sees X drop out with the reason written next to it.

## Risk

Low — cross-family audit required before integration, per Muxin’s session instruction.

## Families

- Builder: Codex (GPT), light tier (backend config and test).
- Auditor: Claude (Anthropic), independent of the Codex builder.

## Coordination — 2026-09-07

Dependency-ready after 5P closed and 5Q accepted at `c2dfea2`.
Coordinator owns this packet and master status; worker never commits.
Use a disposable fixture or verified read-only dry run for A1: never run a command that
rewrites existing generated routing or operational data. Inspect the command before using it.
Read only owned files and bounded implementation excerpts needed to establish the existing
router and manual-include mechanism; no master archive or general repository context.
Retain focused TAP output and A1/A5 evidence under `/private/tmp/slice-5r-evidence/`.
Do not run the repository-wide gate; the coordinator runs it once after audit closure.
A6 disposition: `content/README.md` does not exist. Bounded continuation evidence proved
that `/atomize --continue` reruns routing and overwrites manual includes. No header instruction
ships. The durable opt-in mechanism is recorded as follow-up under A6’s explicit fallback.
The previous slice's default Node runner hung. Coordinator may use the documented temporary
serial Node shim for the full gate, preserving the complete suite and exit status.

## Closeout

Closeout: **PASS**, accepted 2026-09-07 after cross-family source audit and final full gate.
Final unsandboxed `npm run check`: exit 0, 4304 tests / 492 suites / 4304 pass / 0 fail,
zero cancelled/skipped/todo. Serial runner, 627884 ms. Initial gate failure retained below.

- Focused check: unsandboxed `node --import tsx --test src/strategy/route.test.ts`, exit 0,
  41 tests passed. Actual loaded config is covered for all six pillars, with high X scores.
- A1: checksum-identical copy of the named essay, with civic-tech + human-ai pillars taken
  from its existing routing header, routed in `/private/tmp/slice-5r-evidence/essay-fixture`.
  X: `skip`, confidence `rule`, reason `hard veto: civic-tech editorial rule says never route
  here (overrides any other pillar's include)`. Bluesky and democratic-resilience: `include`.
  Read-only `node --import tsx src/strategy/route.ts --brand human-inference --all` also passed.
  The sandboxed npm-wrapper attempt hit tsx IPC EPERM; that attempt is not counted as passing.
- A5: civic-tech + builder excludes X; the existing hard veto wins. No precedence changes.
- Audit: Claude Opus (Anthropic) independently reviewed the Codex candidate and bounded evidence.
  Initial documentation/provenance gaps closed in one audit repair cycle. Final PASS is retained
  at `/private/tmp/slice-5r-evidence/audit-final.md`. No engine or generated-header change ships.
- A6 follow-up: **no durable per-piece opt-in across continuation**. Manual `include` edits
  are honored by consumers, but rerouting clobbers them. Evidence:
  `.claude/skills/atomize/references/continue-mode.md:5-8` resumes the routing step;
  `.claude/skills/atomize/SKILL.md:195-196` describes overwrite;
  `src/strategy/route.ts:608` writes the file. `src/strategy/route.ts:358-365` prevents `--explore`
  from overriding a hard veto. Implementing a durable deliberate exception is a follow-up;
  this slice ships no misleading manual-include instruction and changes no protected skills.
- Verification touched disposable routing only; existing generated routing, queues, databases,
  and publishing state were not changed. No authenticated canary or paid model call was needed.
- Gate repair: initial full gate exit 1, 4304 tests / 4300 pass / 4 fail (three leaf assertions
  and their failed parent test), zero cancelled/skipped/todo. Updated live-config expectations
  in content-generation, exploration, and spin-control tests. X stays requested in the fake
  generation fixture, proving it is filtered; reroutes preserve queue bytes and fail closed on
  a partial identity. All four focused files passed: 60 + 21 + 16 + 41 = 138 tests.
  Claude cleared these repairs in `audit-gate-repair.md`; final full-gate proof is
  retained in `gate-final-exit.txt` and final auditor closure in `audit-accepted.md`.
- Gate evidence: `/private/tmp/slice-5r-evidence/gate.log`, `gate-final.log`, and `gate-runner.txt`.
  Serial Node execution preserves the complete suite; default concurrency stability remains
  unverified after the previous slice's runner hang.
- Hygiene: PASS with named dispositions. `bash scripts/repo-hygiene.sh --rescue` exited 1
  for the expected tracked modifications and retained rescue refs. No untracked repository
  paths were created. Coordinator commits the five implementation/test paths plus this packet
  and master status. Pre-existing `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`
  and `data/notes-spread-ledger.jsonl` remain untouched. Existing five `agent/cs*` branches
  and `slice-5q-queue` remain. `slice-5r-routing` retains the accepted commit; disposable
  `/private/tmp/content-agents-slice-5r`, `content-agents-slice-5r-frozen`, and
  `content-agents-slice-5r-frozen-v2` worktrees are removed after integration. Evidence remains
  outside the repository in `/private/tmp/slice-5r-evidence/`; no shadow source file is left.

## RESULT BLOCK

- Changed paths: `config/routing.yaml`, `src/strategy/route.test.ts`,
  `src/review/content-generation.test.ts`, `src/strategy/exploration.test.ts`,
  `src/strategy/spin-control.test.ts`; coordinator also updates
  this packet and `docs/content-studio-master-status.md`.
- Outcome: four nontechnical pillars exclude X through defaults and hard rules; builder and
  claude-code retain X. Mixed civic-tech + builder excludes X. A6 uses its explicit follow-up
  allowance because continuation overwrites manual routing edits.
- Checks: 138/138 focused tests and isolated routing checks passed; cross-family source audit
  PASS; first full gate exit 1 with stale expectations repaired; final full gate exit 0, 4304/4304.
- Evidence: `/private/tmp/slice-5r-evidence/` (candidate-v4.patch, route-tests.tap,
  a1-route.txt, a1-provenance.txt, a5-dual-tag.txt, all-route.txt, continue-overwrite-excerpts.txt,
  manual-override-check.mjs, manual-override-executable.txt, audit-final.md, gate.log).
- Unresolved: durable per-piece X opt-in follow-up; default parallel test-runner stability.
