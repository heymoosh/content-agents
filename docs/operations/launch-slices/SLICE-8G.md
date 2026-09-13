# SLICE-8G: Reject unknown Content configuration selections

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Make the server-side Content request boundary reject every unknown platform, media, or treatment
selection before persistence or generation, using one shared vocabulary that cannot drift from the
Studio options.

## Difficulty

hard — malformed direct API input currently crosses a safety boundary and can become a nonsensical
variant identity; the fix must preserve stored legacy reads and all legitimate room handoffs.

## Depends on

none.

Delivery batch: 8F, 8G, and 8H are authorized; 8G may integrate independently after audit and the
single final gate.
Owner checkpoint: none; the product intent is already recorded under `Open, recorded, not scheduled`.

## Owned files

Parallel-safe: yes — this lane owns only Content request vocabulary/boundary source and focused tests;
8F owns external deployment files and 8H owns capture lifecycle files. It runs no rewriting command.

### Lane A — shared selection vocabulary and fail-closed validation

- `src/review/content-request.ts`
- `src/review/content-request.test.ts` if present, otherwise one new focused test beside it
- `src/review/content-request-store.ts`
- `src/review/content-request-store.test.ts`
- the smallest existing Studio-options module/test only if needed to establish one shared export

Pinned read-only inputs: current `CONTENT_CONFIG_OPTIONS` declaration and persisted request schema at
the assignment commit. Focused tests must use a temporary data root.

## Do not touch

- publishing/provider code or operational data
- page layout beyond importing the shared vocabulary
- external Postiz repository
- `docs/content-agents-backlog.md`

## Cited headings

- `docs/content-studio-master-status.md` → `### Open, recorded, not scheduled`

## Acceptance

- [ ] Platforms, media, and treatments each validate against one explicit server-owned vocabulary.
- [ ] Unknown, blank, and wrong-type values fail before a content request is written or a generation
      job/provider action can begin.
- [ ] Every option currently offered by Studio remains accepted, including deliberate `none` values.
- [ ] New writes validate strictly while reads remain tolerant of already-persisted legacy
      destinations such as `community` and `community:<name>`; legacy data is not rewritten.
- [ ] Valid Fiction, Charles, Venture, Human Inference, and experiment handoffs remain compatible.
- [ ] Focused tests prove direct malformed input rejection and zero write/dispatch outcome.

## Verify

Classification and applicable gate: meaningful behavior/high risk — server authorization boundary;
focused red/green tests, bounded cross-family audit, then frozen-candidate `npm run check` once last.

```sh
npx tsx --test src/review/content-request*.test.ts
```

## Observable result

A direct Content request containing `platforms: ["quote-card"]` or any other unknown option returns a
clear validation error and creates no request, job, derivative, or provider activity.

## Risk

medium — audit required: yes; a partial vocabulary or overly strict migration can break legitimate
handoffs or leave another entry path open.
Review boundary: candidate diff, changed files, focused test output, and call-site inventory.
Review scope/budget: one ordinary-effort Grok 4.5 audit, one delta only for material repair.
Prior accepted evidence: none for this defect; historical deterministic handoff coverage is regression
evidence but not closure.
On reviewer outage: retain uncommitted candidate, mark review-blocked, continue 8F/8H.

## Families

- Builder: Codex worker, ordinary effort
- Auditor: Grok 4.5, ordinary effort, evidence-only under the Mac standing rule

## Closeout

Preflight: schema and vocabulary paths pinned; every request entry point inventoried; red/green proof;
audit complete; final gate prerequisites closed.
Gate cost: focused tests expected under one minute; `npm run check` runtime unknown and runs once on the
audit-cleared frozen candidate.

Closeout gate: record `PASS` or exact leftovers. Hygiene and read-set use the binding forms verbatim.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
- Delivery state and next action:
- Usage:

## Usage budget and handoff

- Each extra lane: closes an independent server trust defect while credential rotation is pending.
- Assignment: fresh Codex worker; frozen diff/check handoff.
- Evidence return: command, exit, counts, candidate identity, short result, audit-ready excerpts.
- Capability boundary: accepted server selection boundary, then next recorded defect.

## Stopped

Not stopped.
