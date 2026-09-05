# SLICE-5E: surface the routed pillar onto Content derivatives

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`generateConfiguredContent` (`src/review/jobs.ts`) stamps the pillar the piece was routed under
onto each generated derivative's frontmatter as a `pillar: <value>` line — read deterministically
from `routing.md`, never recomputed. When `routing.md` names no pillar (`readPillar` returns
`null`), no `pillar:` line is written (matching the existing `pillarSource: "none"` convention).
Everything else about the generated output — bodies, ordering, other frontmatter, `review-queue.md`
rows, media stages, `source.md` — is byte-for-byte unchanged.

This is the `/atomize`-owned pillar-tagging capability (§5 alignment-plan row "Pillar tagging")
ported into the Content path. It is deliberately the SURFACING port only: the pillar the piece was
routed under already lives on disk in `routing.md`'s title line and is read with `readPillar`
(`src/review/reschedule.ts:42`). It is NOT recomputed from `config/pillars.yaml` — pillar assignment
is a Claude judgment (`src/atomize/source-triage.ts:11`), and the deterministic configured path
explicitly forbids inventing one (`src/review/jobs.ts:970` — "never invent a pillar … here").

## Difficulty

easy — one deterministic read (`readPillar(folder)`, already imported-or-adjacent) assembled into a
one-line frontmatter array and spliced at the same site 5c/5d use. No model call, no new config, no
behavior change to what variants are generated or what they say.

## Depends on

5a (accepted) — `generateConfiguredContent` already loads `routing.md` via `parseRecordedRouting`
(`jobs.ts:971-972`), the same file `readPillar` parses. No other slice is a prerequisite; 5b/5c/5d
are accepted and on `main` but this slice does not depend on their behavior.

## Owned files

Parallel-safe: no — single lane. The work is one function edit plus its test; it does not divide
into disjoint paths.

### Lane A — surface the pillar and prove it

- `src/review/jobs.ts`
- `src/review/content-pillar-tag.test.ts` (new)

## Do not touch

- `src/review/reschedule.ts` — `readPillar` is the existing reader; import and call it, do not move
  or reimplement it.
- `config/pillars.yaml`, `config/routing.yaml`, `src/strategy/route.ts` — the rubric and router are
  upstream and unchanged; this slice only reads their already-recorded output.
- `src/atomize/**` — the `/atomize` path stays byte-for-byte identical.
- `source.md` in any content folder — never mutated.
- The triage (`source_class`) and spin (`spin`/`angle`) frontmatter that 5c/5d added — leave their
  values and ordering intact; add the `pillar:` line alongside them, do not reorder them.

## Cited headings

none

## Acceptance

- [ ] `generateConfiguredContent` reads the pillar once via `readPillar(folder)` (the existing
      `src/review/reschedule.ts` reader) and does NOT recompute it from `config/pillars.yaml` or make
      any model call to derive it.
- [ ] When `routing.md` names a pillar, every generated derivative's frontmatter carries a single
      `pillar: <value>` line with that exact value (one of `human-ai`, `claude-code`, `civic-tech`,
      `career-work`, `builder`, `other`, or whatever the routing title holds), stamped alongside the
      existing 5c/5d frontmatter, not replacing it.
- [ ] When `routing.md` is absent or its title names no pillar (`readPillar` returns `null`), no
      `pillar:` line is emitted, and the generated frontmatter is byte-identical to today's output.
- [ ] The pillar-present and pillar-absent paths both leave derivative bodies, variant ordering,
      other frontmatter fields, `review-queue.md` rows, media stages, and `source.md` byte-for-byte
      unchanged versus current behavior (the control/treatment prose is untouched — this is metadata
      only).
- [ ] A new test file `src/review/content-pillar-tag.test.ts` proves: (a) a routed pillar is stamped
      onto derivative frontmatter end-to-end through a real `generateConfiguredContent` run; (b) a
      folder whose `routing.md` names no pillar (or has none) emits no `pillar:` line and is
      byte-identical to the no-pillar baseline; (c) `source.md` is unchanged.
- [ ] No new dependency; deterministic (no network, no model call) — the test needs no live model.

## Verify

Focused, from the repo root:

```
node --import tsx --test src/review/content-pillar-tag.test.ts src/review/jobs.test.ts
```

Then type-check:

```
npx tsc --noEmit
```

## Observable result

Generate content for a folder whose `routing.md` title names a pillar (e.g. `human-ai`): every file
under `derivatives/` carries `pillar: human-ai` in its frontmatter. Generate for a folder with no
pillar in `routing.md`: the derivatives look exactly as they do today, with no `pillar:` line. Diff
the two frontmatter blocks — the only difference is the presence/absence of the one `pillar:` line.

## Risk

low — audit required: no. Deterministic metadata surfacing that mirrors 5c's `...triageFrontmatter`
splice exactly; it changes no composed prose and generates no new variants, so it is a Rule-7
self-vet merge (not a hold). The coordinator still self-verifies the diff against this packet and
runs the full closeout gate before merging; a cross-family spot-check is optional, not required, at
this risk level.

## Families

- Builder: Claude (strong tier) — single lane.
- Auditor: not required (low risk). Coordinator self-verifies the diff vs. this packet.

## Closeout

Repo-wide gate, run UNSANDBOXED (the sandbox produces phantom venture failures):

```
npm run check
```

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths: `src/review/jobs.ts` (+8/-1), `src/review/content-pillar-tag.test.ts` (new, 3 tests)
- Outcome: `generateConfiguredContent` imports `readPillar` (`jobs.ts:25`), builds
  `pillarFrontmatter` next to 5c's `triageFrontmatter` (`jobs.ts:1130-1136`,
  `const routedPillar = readPillar(folder); ... routedPillar ? [\`pillar: ${routedPillar}\`] : []`),
  and splices `...pillarFrontmatter` right after `...triageFrontmatter` at the frontmatter site
  (`jobs.ts:1183`). Deterministic, no recompute, no model call. No pillar in `routing.md` → no line,
  byte-identical output.
- Checks run and results: focused `content-pillar-tag.test.ts` + `jobs.test.ts` = 117/117; `tsc
  --noEmit` exit 0.
- Evidence locations: test `src/review/content-pillar-tag.test.ts`; jobs edit `jobs.ts:25,1130-1136,1183`.
- Unresolved: none.

## Closeout result

**ACCEPTED — merged to local `main`** (2026-09-05, `df26d30`). Coordinator-verified: read the full
`jobs.ts` diff (the exact minimal `...pillarFrontmatter` splice after triage, `folder` in scope) and
the test file (test 1 pins `readPillar`; test 2 proves the end-to-end stamp equals `readPillar`'s
value, exactly one line, the 5c triage stamp still present, `source.md` byte-exact, rows pending;
test 3 removes only the `pillar:` line + normalizes the slug-derived `request_id` and asserts
byte-equality to the no-pillar baseline). Metadata-only, no composed-prose change → Rule-7 self-vet
merge, no hold, no cross-family audit required. Closeout gate `npm run check` UNSANDBOXED: **exit 0,
4181 pass / 484 suites / 0 fail / 0 skip**. Fast-forwarded `feat/content-pillar-5e` into `main`;
branch deleted.
