# SLICE-5X: Evidence-based analytics brand backfill

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open the master archive. Do not load the repository for context. Workers never commit.

## Goal

Historical Substack analytics positively attributed by Muxin become visible to Human Inference's
brand filter. Preserve legacy X/LinkedIn as unassigned non-Human-Inference experimental data.
Repair only missing identities, with a repeatable preview, backed-up application and recovery proof.
Do not invent topic labels, change metrics or widen publishing permissions.

## Difficulty

Hard — historical attribution and database backup integrity.

## Depends on

5R and 5W accepted. Base b3f206234808a9ecacca110e856fa9d229518a57; last accepted feature cfaa766.

## Owned files

- Builder: `src/db/backfill-analytics-brand.ts`, `src/db/backfill-analytics-brand.test.ts`,
  `package.json` (one command entry).
- Coordinator: this packet, `SLICE-5X-manifest.json` beside it, master START HERE/progress.
- Explicit operational application: `data/analytics.db`, only audited CLI after final gate;
  backup `/Users/Muxin/.content-agents/content-agents-154a8dd69ae2/backups/analytics-before-5x.db`.

### Preparation, execution and verification ownership

All worker outputs are frozen; no worker currently owns an active edit.
- Initial provenance preparation: `/private/tmp/slice-5x-evidence/preparation/`, Terra high,
  then paused and reassigned Terra xhigh after invalid substring-account proof was found.
  That heuristic proof is withdrawn; repaired checksum/post-ID inventory is retained.
- Recovery lane B: `.../recovery/`, Terra high. Bounded input/archive/Git search and reproducible
  readonly coverage probe; no repository/DB changes.
- Mapping lane C: `.../substack-contract/`, Terra xhigh. Owner-attested exact snapshot manifest
  and readonly Notes/article inventory; no repository/DB changes.
- Builder lane D: three source paths in `/private/tmp/content-agents-5x-build`, Terra xhigh.
  Finished builder paused before exclusive same-path repair reassignment to Terra max.
- Verifier lane E: `.../verifier/`, completed lane C investigator reused at Terra xhigh after
  thread limit prevented another verifier. Own fixture/scripts only; no implementation ownership.
- Auditor: Grok 4.5 workspace, bounded criteria/diff/actual checks only, no edits.

Parallel-safe: B/C wrote disjoint evidence paths using pinned read-only inputs; D/E independently
prepared implementation and verification tooling with disjoint writes. No repo-wide rewriters.
Actual verification waited for frozen D handoff. Conflicting ownership and integration serialized.
Coordinator owns the final gate, real application and commit. Evidence directories above share
prefix `/private/tmp/slice-5x-evidence/`; prior preparation remains immutable.

## Do not touch

- Existing attribution, nonidentity columns, unrelated tables, content, approvals, provider state,
  scheduler claims, credentials, backlog, other builds or generated copy.
- Preserve four pre-existing edits: `AGENTS.md`, `docs/operations/launch-slices/SLICE-TEMPLATE.md`,
  `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`,
  `data/notes-spread-ledger.jsonl`. Exclude all four from this commit.
- Do not rerun 5P's live Typefully canary.

## Cited headings

`docs/operations/launch-slices/SLICE-5R.md` → `## Known data gap, not this slice's`.
No master archive headings.

## Acceptance

- [x] A1 — Owner-backed mapping accounts for articles/Notes; ambiguous/conflicting rows fail closed.
      X/LinkedIn remain unassigned experimental data outside HI.
- [x] A2 — Actual dry-run is nonmutating; explicit apply updates only exact NULL identity fields.
- [x] A3 — Replay changes zero rows; failures roll back; validated backup restores the original.
- [x] A4 — Existing direct-import and Notes ingestion regression tests prove future identity binding.
- [x] A5 — Actual CLI plus production measurementScope/latestMetricsJoin/loadData prove brand/account
      isolation and routing visibility. X/LinkedIn retained; no guessed pillar assignment.
- [x] A6 — Grok material findings closed; focused checks PASS; frozen unsandboxed gate 4338/4338 exit 0.
- [x] A7 — Real45/206 repair PASS; backup verified; full DB matches independently verified result.

## Verify

```sh
node --import tsx --test src/db/backfill-analytics-brand.test.ts
node --import tsx --test src/ingest/import.test.ts src/atomize/new-notes.test.ts
npm run backfill:analytics-brand -- --db <explicit-path> --manifest <frozen-manifest>
npm run backfill:analytics-brand -- --db <explicit-path> --manifest <frozen-manifest> --apply --backup <new-absolute-path>
```

Default mode is readonly. Original manifest bytes and original database SHA are pinned for initial
apply; partial/mixed/conflicting states reject. Repeat applied state is a zero-write outcome.
No destructive rollback CLI; restore validated backup into an isolated DB for recovery proof.
Reject dangling backup links, symlinked backup parents and active nonempty WAL/journal; do not
checkpoint or alter unsupported sidecars. Empty WAL/journal and inert SHM are supported.

Independent actual harness: `.../verifier/candidate-verifier.mts` and runner; frozen run evidence
in `.../verifier/candidate-run-unsandboxed/`. First sandboxed invocation hit tsx IPC EPERM before
DB access; fixture-only unsandboxed retry passed. No provider/live-model canary.
Final gate: `npm run worktree:setup` once, then unsandboxed `npm run check` once last on frozen v2;
retained serial shim `/private/tmp/slice-5q-gate-bin/node` sets --test-concurrency=1.
Closeout: `bash scripts/repo-hygiene.sh --rescue`.

## Observable result

45 Substack posts / 206 captures enter HI measurement scope: articles 13/86 at
`human-inference/browser-analytics`; Notes 32/120 at `human-inference/substack`.
Actual routing includes 10 articles  + 32 Notes  = 42 posts. Three articles /6 captures lack pillars
and remain excluded from route cells while becoming brand-queryable. Classification is not assigned.
X 264 posts/2345 captures and LinkedIn 100/430 remain queryable and excluded from HI.
Audience 25/import 22 Substack rows and 879 older unbound Bluesky metrics are measured but excluded.

## Risk

High — cross-family audit required before operational apply and integration.

## Families

- Preparation/build: Codex Terra high/xhigh as lane record above; repair xhigh→max for omitted cases.
- Verifier: Codex Terra xhigh, no builder source ownership.
- Auditor: Grok 4.5, `--sandbox workspace`, never grok_spawn_readonly.

## Closeout

PASS — A1–A7 verified; Grok material findings closed; full gate and real repair passed.
Hygiene disposition is recorded below before coordinator commit.

## RESULT BLOCK

- Source paths: three builder paths above, frozen v2.
- Focused checks: 6/6; typecheck PASS. Existing import/Notes regression 6/6 PASS.
- Actual CLI: dry-run/apply/replay exit 0; backup restored equal to original logical DB.
- Preservation: posts/metrics nonidentity digest, every untouched table and every non-Substack
  identity unchanged. Other-brand target pairs 0. Fixture post-apply and replay byte/logical hashes equal.
- Evidence: `.../coordinator/v2-focused.*`; `.../verifier/candidate-run-unsandboxed/`.
- Full gate: 4338 tests PASS, 0 failures/skips, exit 0,624.37 seconds unsandboxed.
- Operational: real 45/206 repair PASS; full resulting DB/backup match verified fixture bytes.
- Closeout: PASS for this slice; pre-existing edit/branch leftovers dispositioned under Hygiene.

## Owner attribution and recovered source

2026-09-08 Muxin: "Legacy X and LinkedIn can be treated as non-Human Inference but useful for
experimentation and data. Substack is Human inference." This supersedes the previous sourcing
stop at b3f2062. The owner need not invent internal account IDs or find the missing export.

Import code uses data/inbox and data/processed (`src/ingest/import.ts:19-20,121-132,175-179`).
Bounded search covered those 79 retained files, exact naming/storage symbols and Git tracked history.
Original `48db503c-AggregateAnalytics_Muxin%20Li_2025-06-17_2026-06-16.xlsx` was not found.
Distinct alternate `data/processed/505f4c94-AggregateAnalytics_Muxin%20Li_2025-06-17_2026-06-16.xlsx`
has SHA 505f4c94b145e74c395276beddf0e6531bd0e2b2b59d1b29388a06aaa2dbf9a6. It adds all 26 formerly
unjoined LinkedIn post IDs, union 100/100. Its bytes/captured values are not claimed identical to
original SHA 48db503c383057f58de668ad7162f5adbb421302b2027b354b4763d8e79294b5.
Those 26 posts already retain 104 metrics across 4 captures. Missing original is no repair blocker.
Reproducible `.../recovery/recovery-probe.mjs`, stdout/exit and recovery-report.md retain proof.

All 13 articles have recovered checksum-verified source-ID joins. All 32 Notes retain direct-ingest
structure; current cache corroborates 20, while 12 rely on owner attestation plus the pinned legacy
snapshot, never a false cache claim. Historical substring-account heuristics remain withdrawn.

Durable manifest: `docs/operations/launch-slices/SLICE-5X-manifest.json`, SHA
7c44574002b3d7e53f002c75ead63a5503678766eda5bb80d81a86ef4e0d5206. Original DB SHA
ef67f395471207b17abb08f89fc67b8188d5226f0b6ba156a1c97da5120a8670.
Exact readonly evidence: `.../substack-contract/readonly-substack-audit.stdout.json` and exit 0.

## Audit closure and frozen candidate

Prior accepted 5W follow-up Grok workspace audit PASS, exit 0; no new material gap (retained
`.../coordinator/grok-5w-followup.*`). 5X Grok v1 exit 0 HOLD found two reproduced defects:
- F1: dangling backup link created an external sentinel. v2 lstat rejection leaves target absent,
  symlink intact and DB unchanged. Source 219–245; test 252–279.
- F2: live WAL changed logical state without changing main-file hash. v2 rejects nonempty sidecars
  unchanged before inspect, after inspect and under IMMEDIATE. Source 248–260,478,489,508; test 282–351.

Grok v2 exit 0,77.95sec: SOURCE/AUDIT PASS; F1/F2 independently closed; actual CLI/production
routing/A4 evidence accepted. Extra live exclusion count guard is optional: exact original snapshot
plus sidecar rejection pins initial scope, and independent preservation proof covers the outcome.
No speculative soft-reporting/ingestion/classification expansion. Audit logs `.../coordinator/grok-v*.txt`.

Frozen v2 `/private/tmp/content-agents-5x-verify-v2`, detached b3f2062 plus reviewed three-path diff:
- source ca72864916938eef47b055369f4b3c765ef50878e40c47bc7ce881c354ef86d0
- test 7d0c61fc0586497cc4e8bb69e8a52cac63dd9465afca0bd25b5291bbb88a54f9
- package 7622df329d5748cd076279f981e1826bc229c4103fa815f88beac03255e42ec6
Final full gate PASS: 4338 tests, 0 failures/cancellations/skips, exit 0,624.37 seconds.
Retained actual command/exit and unchanged candidate hashes in `.../coordinator/gate.*`.

## Operational result

Real dry-run exit 0: 45 posts/206 metrics proposed, 0 changed, DB hash unchanged. After validated
private backup, actual apply exit 0: exactly 45/206 changed. Post-apply readonly preview exit 0:
replay state, 0 remaining candidates, no mutation. Article 13/86, Notes 32/120, route 42/200,
pillarless 3/6 and experimental 364/2775 match independently verified expectations.

Complete real DB SHA e3f36645bb079e341a735d2505e9d562ef17901959bae9f8371fec592fe24b83 equals the
independently verified post-apply fixture byte-for-byte. This covers nonidentity values, untouched
tables and other-platform identities, beyond count-only evidence. Private backup at the owned
external path is mode 0600, SHA ceea75eb5ee89be12c7b2f5d92b6ce2b427b0c1c8b231b88ce8e05c50553accf;
its complete bytes equal the independently restored backup. CLI also validated isolated restore
logical equality before mutation. No recovery was needed on the real database.

All seven recorded unrelated/approval/provider/scheduler fingerprints unchanged. Evidence:
`.../coordinator/operational-{dry-run,apply,after}.*`, operational-exact-comparison.json and
operational-after.exit.json. Source database is ignored operational state, never added to Git.

## Hygiene

Task-created worktrees removed after exact source hashes were verified against staged Git blobs:
`/private/tmp/content-agents-5x-build`, `/private/tmp/content-agents-5x-verify`,
`/private/tmp/content-agents-5x-verify-v2`; temporary branch slice-5x-backfill removed.
This session created three repository files: SLICE-5X-manifest.json beside this packet,
`src/db/backfill-analytics-brand.ts` and `src/db/backfill-analytics-brand.test.ts`; all staged
for this accepted commit. Private operational backup and bounded temporary evidence are retained.
Hygiene --rescue completed exit 1 for expected staged work and existing local branches; rescue
86428dd. No prunable worktrees. Four pre-existing edits above remain unchanged and excluded.
Existing merged branches slice-5q-queue/slice-5r-routing are other sessions' work, preserved.
Existing local-only branches preserved: agent/cs2-jobs-outreach-charles-extract,
agent/cs2-page-room-pure-helpers, agent/cs2-serve-walled-room-routes,
agent/cs3-studio-durable-handoff, agent/cs6-parallel-safe-ui-completion. These are an explicit
leftover disposition, not a new owner decision. No session-created repository file is omitted
from the six-path accepted commit. Final post-document hygiene output retained in
`.../coordinator/hygiene-closeout.txt` and matching exit JSON. No push.
