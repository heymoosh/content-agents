# SLICE-8H: A promoted capture stops showing as waiting

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Record a durable, idempotent promoted-without-job terminal state for Studio captures so a Fiction or
other room promotion no longer remains on Home as “CAPTURE WAITING HERE.”

## Difficulty

hard — this extends persisted operational state and must migrate old rows without confusing promotion,
job start, retry, or unresolved captures.

## Depends on

none.

Delivery batch: 8F, 8G, and 8H are authorized; 8H may integrate independently after audit and the
single final gate.
Owner checkpoint: none; the visible outcome is explicitly recorded in the master.

## Owned files

Parallel-safe: yes — this lane owns capture lifecycle, promotion call sites, and their focused tests;
8G owns Content request validation and 8F owns external deployment files. No repo-wide rewrite.

### Lane A — capture promotion lifecycle

- `src/review/captures.ts`
- `src/review/captures.test.ts`
- smallest exact Fiction/room promotion call-site module and focused test
- smallest exact Home capture rendering/filter module and focused test, only if separate

Pinned read-only inputs: current capture version/schema, Fiction promotion route, and Home queue reader
at the assignment commit. All tests use temporary operational paths.

## Do not touch

- model job lifecycle beyond capture linkage
- content requests, provider/publishing code, external Postiz repository, real operational data
- unrelated room behavior or page design
- `docs/content-agents-backlog.md`

## Cited headings

- `docs/content-studio-master-status.md` → `### Open, recorded, not scheduled`

## Acceptance

- [ ] A capture can be atomically and idempotently marked promoted to one named room/item without a
      fabricated job id.
- [ ] Promoted captures do not appear in the unresolved/waiting Home list after reload.
- [ ] Existing unstarted, started, duplicate, and legacy capture rows retain correct behavior.
- [ ] Promotion and job-start states cannot silently overwrite or contradict each other.
- [ ] The real Fiction promotion path writes the new state only after its durable idea exists; failure
      leaves the capture honestly retryable.
- [ ] Focused tests assert persisted observable state and rendered/listed outcome, not only a helper call.

## Verify

Classification and applicable gate: meaningful behavior/high risk — persisted lifecycle/UI truth;
focused tests, bounded cross-family audit, then frozen-candidate `npm run check` once last.
UI journey: disposable backend, Home → promote Fiction capture → reload Home; normal desktop viewport;
assert exact idea exists and capture is absent from waiting, while a failed promotion stays visible.

```sh
npx tsx --test src/review/captures.test.ts src/review/room-queue.test.ts
```

## Observable result

After a Fiction capture becomes a durable idea, reloading Studio Home no longer claims it is waiting;
a failed promotion remains visible and retryable.

## Risk

medium — audit required: yes; persisted-state changes can hide unresolved work or create duplicate room
items if ordering/idempotency is wrong.
Review boundary: candidate diff, migration/state invariants, call-site inventory, focused output.
Review scope/budget: one ordinary-effort Grok 4.5 audit, one delta only for material repair.
Prior accepted evidence: existing capture idempotency and room-queue tests remain regression proof only.
On reviewer outage: retain uncommitted candidate, mark review-blocked, continue 8F/8G.

## Families

- Builder: Codex worker, ordinary effort
- Auditor: Grok 4.5, ordinary effort, evidence-only under the Mac standing rule

## Closeout

Preflight: schema/version decided; write ordering and all readers inventoried; red/green proof; UI outcome
covered; audit complete; final gate prerequisites closed.
Gate cost: focused tests expected under one minute; `npm run check` runtime unknown, once on the
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

- Each extra lane: closes an independent visible lifecycle defect while security cutover is pending.
- Assignment: fresh Codex worker; frozen diff/check handoff.
- Evidence return: command, exit, counts, candidate identity, short result, audit-ready excerpts.
- Capability boundary: accepted capture truth, then next recorded defect.

## Stopped

Not stopped.
