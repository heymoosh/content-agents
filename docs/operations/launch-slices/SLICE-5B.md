# SLICE-5B: port the applicable `validate` gates into configured Content generation

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

The configured Content generation path (`generateConfiguredContent` in `src/review/jobs.ts`)
enforces the applicable gates that today live only in `src/atomize/validate.ts` — per-platform
character/word limits, the skeleton gate, and the case gate — **before** it writes any derivative
file or any `review-queue.md` row. Platform limits are read from `config/platforms.yaml` (the P1
winner), not from the hardcoded `CONFIGURED_PLATFORM_LIMITS` table at `jobs.ts:438-440`; that
second source of truth is removed or made to delegate to the config so it can no longer diverge.
A validation failure aborts the whole variant atomically: no partial derivatives on disk, no
pending review row. Valid, origin-specific requests keep everything item 5a already gives them —
the routing subset (`include`/`skip`, controls kept, exploration probes stamped), exact
untreated controls, provenance/`source_lines`, and pending-review status — unchanged. Each room's
scoped exception is honored: the gates never demand `source_lines` from an origin that has none
(Venture, Charles, fiction, video scripts, treated Content) and never weaken extraction-first for
one that does.

## Difficulty

hard — it wires a hard product gate into the live generation/provenance seam of `jobs.ts`; the
failure mode to prevent (partial output or an orphaned review row on a rejected variant) is a
state-atomicity property, and the per-room scoped exceptions must be mapped before editing so a
ported gate does not misfire on an origin that legitimately lacks `source_lines`.

## Depends on

P1 (single source of truth for platform limits — `config/platforms.yaml` wins) and item 5a
(routing gate consumed by `generateConfiguredContent`) — both already accepted and on `main`.
No open slice depends on this one being split.

## Owned files

Parallel-safe: no — single lane. The work is one coupled change to a single region: the gate
call site inside `generateConfiguredContent` in `src/review/jobs.ts` and the shared gate logic it
invokes, plus their tests. The write-atomicity property spans both halves (a gate must run and
reject before the same function writes derivatives or a review row), so there is no path split for
which the protocol's three safety conditions hold. Run it as one worker.

### Lane A — port the gates and prove atomic rejection

- `src/review/jobs.ts` — call the applicable gates in the generation path; remove or delegate the
  hardcoded `CONFIGURED_PLATFORM_LIMITS` table at `jobs.ts:438-440` so `config/platforms.yaml` is
  the only limit source.
- The gate logic the path invokes: reuse `src/atomize/validate.ts`'s existing gate functions if
  they are already importable; otherwise extract the char/word-limit, skeleton, and case gates
  into one shared module (new file, e.g. `src/atomize/gates.ts`) that reads
  `config/platforms.yaml`, and have both `validate.ts` and the Content path call it. If
  `validate.ts` is modified, it may change **only** to delegate to the extracted module — its
  external behavior and its existing tests must stay green (regression).
- New/affected `node:test` files covering: each ported gate firing in the Content path; the
  atomic-rejection invariant (a forced gate failure leaves zero derivative files and zero
  review-queue rows); and a valid request across each origin kind (Venture, Charles/fiction,
  video-script, treated Content, extraction-first Content) passing the gates while retaining 5a
  routing, exact controls, provenance, and pending review.

## Do not touch

- `src/strategy/route.ts`, `config/routing.yaml`, and the routing subset already landed by 5a —
  do not re-implement or weaken routing here. The routing file that refuses an unsupported
  confidence value is **intended P2 strictness**; leave it strict.
- The other seven item-5 capabilities (pillar tagging, spin, scoring/soft gate, thread check,
  quote-card captions, brief directives, source triage). This slice is `validate` only.
- `config/platforms.yaml` and `config/voice.yaml` as data — read them; do not edit their values.
- `docs/content-agents-backlog.md` — board writes go through `prose_kanban` only, never as text.
- `/atomize`'s runtime behavior — `validate.ts` may be refactored to delegate, but the atomize
  path's observable output must not change.

## Cited headings

`none` — everything needed is in this packet, the protocol section, and the two design-spec
sections named under Observable result. Do not open the master document.

## Acceptance

- [ ] `generateConfiguredContent` runs the char/word-limit, skeleton, and case gates before
      writing any derivative or review row; the worker's RESULT BLOCK lists which `validate.ts`
      gates it judged applicable vs. already covered by 5a's routing consumption, with the reason.
- [ ] Platform limits come only from `config/platforms.yaml`; the hardcoded
      `CONFIGURED_PLATFORM_LIMITS` at `jobs.ts:438-440` is removed or delegates to the config, and
      a test proves changing a config limit changes the gate's behavior.
- [ ] Deterministic integration test: a forced gate failure produces **no** partial derivative
      files and **no** pending `review-queue.md` row (atomic rejection).
- [ ] A valid origin-specific request retains 5a's routing subset, exact untreated controls,
      provenance/`source_lines`, and pending-review status — proven per origin kind, including at
      least one origin with no `source_lines` (the gates do not demand tracing where a scoped
      exception applies).
- [ ] `/atomize`'s existing `validate` behavior and tests remain green (no regression from any
      extraction/refactor).
- [ ] Focused/fake-model tests, cross-family audit, one bounded isolated canary, and the
      repository-wide gate all pass.

## Verify

Focused checks (worker runs; records exact file list in RESULT BLOCK). Repo runner is Node's
built-in `node:test` via `tsx`:

```
node --import tsx --test <the new/affected review-generation and validate test files>
```

Bounded canary — verification budget for this slice: **one** isolated end-to-end run of the real
generation path against a **fake model** (no authenticated or paid call is needed; validate is
deterministic), in a Git/HOME/operational-data-isolated harness, forcing one variant to fail a
gate and confirming no partial output and no review row. At most one retry if the harness (not the
behavior) is at fault. If a live authenticated run turns out to be required, cap it at one canary
plus one retry per the bindings, and preserve successful model output if later validation fails.

Repository-wide gate (coordinator runs once, last, **unsandboxed** — the sandbox reports ~196
phantom venture failures; in a fresh worktree run `npm run worktree:setup` first):

```
npm run check
```

## Observable result

The owner can read `docs/content-room-alignment-plan.md` §5 (the capability table's `validate`
row) and §Dependencies and running order (the item-5 sequence: routing gate, then `validate`),
then inspect the diff to `src/review/jobs.ts` plus the integration test proving that a
Content-generated variant which exceeds a `config/platforms.yaml` limit is rejected atomically —
nothing written, nothing queued for review — while a valid variant still lands with 5a routing,
exact controls, provenance, and pending review intact.

## Risk

high — audit required: yes. Touches the live generation/provenance seam; the failure to catch
would be silent partial output, an orphaned review row, or a gate misfiring on a scoped-exception
origin.

## Families

- Builder: Claude, strong tier (backend generation logic).
- Auditor: Codex / GPT, strong tier — a different family from the builder, run via the repo's
  `codex` subscription CLI. Receives only this slice's acceptance criteria, the candidate diff,
  the changed-file list, and the focused check output; never the master document, the repository
  tree, or a worker transcript.

## Closeout

No closeout tool in this repo. The coordinator records `PASS` or the leftover list in this packet
below before the slice can close.

Closeout result: **PASS** (2026-09-05). Cross-family Codex audit: zero established defects; its
one material coverage gap (whole-routed-set atomicity proven with only a single variant) was
converted to a builder checklist item and closed by a new multi-variant abort test. Two trivial
audit hardenings folded in (exact parsed-body compare; canonical-URL/`cta:source` provenance
assertion). Gaps 3–5 dispositioned as already-covered / not-a-spec-violation / defensive, per the
audit's own severity split. Repo-wide gate `npm run check` unsandboxed: **exit 0, 4165 tests /
484 suites / 0 failures / 0 skips**. No untracked leftovers beyond this packet and the slice's own
new test file, both committed with the slice.

## RESULT BLOCK (worker-authored, coordinator-verified)

- Changed paths: `src/atomize/validate.ts` (extracted `checkPlatformLimits`, `checkDerivative`
  delegates to it — external behavior byte-identical); `src/review/jobs.ts`
  (`generateConfiguredContent` runs char/word + skeleton + case gates over all routed candidates
  before any `mkdirSync`/write/`appendRows`; a violation throws, aborting the whole set);
  `src/review/content-validate-gate.test.ts` (new, 7 tests).
- Outcome: the configured Content path enforces the applicable `validate` gates before any write.
  A gate failure aborts the whole routed variant set atomically (no derivatives dir, no
  media-stages dir, byte-identical `review-queue.md`, zero rows) — proven for both a single
  variant and a two-included-platform set where the in-limit sibling is also withheld. Valid
  origin-specific requests keep 5a routing, exact untreated controls, provenance/`source_lines`,
  and pending review. Limits read only from `config/platforms.yaml` (the P1 winner via
  `loadPlatforms()`); the hardcoded `CONFIGURED_PLATFORM_LIMITS` was already removed by P1
  (`c6842cd`). `/atomize`'s existing `validate` behavior and tests unchanged.
- Gate applicability: char/word limit — PORTED (live gate). `source_lines`-presence and
  spin-angle checks — deliberately NOT ported (would misfire on scoped-exception origins with no
  tracing). Routing include/skip — already covered by 5a's `variants` filter, not re-run.
  Skeleton + case gates — PORTED against recorded source-triage facts; defensive with today's
  configured frontmatter vocabulary (direct-helper tests prove both firing and passing shapes).
- Checks run and results: focused `node --import tsx --test src/review/content-validate-gate.test.ts`
  → 7/7; builder's wider focused run (new + `validate` + `content-generation` regressions) → 98/0;
  `jobs.test.ts` → 114/0; `npx tsc --noEmit` → exit 0; coordinator repo-wide `npm run check` →
  exit 0, 4165/484/0.
- Evidence locations: `src/review/content-validate-gate.test.ts`; gate log `$TMPDIR/check-5b.log`
  (transient); cross-family audit bundle `scratchpad/audit-bundle-5b.md` (transient).
- Unresolved: none.
