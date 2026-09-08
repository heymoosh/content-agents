# SLICE-5X: Evidence-based analytics brand backfill

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open the master archive. Do not load the repository for context. Do not commit.

## Goal

Brand-filtered routing sees historical analytics that can be positively attributed to that brand.
Backfill missing brand_id using retained provenance, preserving existing attribution and metrics;
ambiguous rows remain explicitly reported, never guessed. Provide a repeatable safe repair and
prevent the identified ingestion paths from recreating the gap.

## Difficulty

Hard — attribution is a data integrity boundary across platform ingestion and routing.

## Depends on

5R and 5W accepted; base cfaa76626e5c50da2adf1cd0840302a334439936.

## Owned files

Preparation checkpoint only. No implementation or database writes until the coordinator freezes
an evidence-based mapping contract and exact source ownership here.

Parallel-safe: yes — lane A bounded provenance investigation writes only preparation evidence;
coordinator's requested follow-up Grok audit reads immutable 5W evidence and writes separate logs.
Neither runs rewriting commands; shared source inputs are pinned to base cfaa766. Candidate
verification and any operational repair wait for frozen implementation and cross-family audit.
Independent verifier tooling will be assigned after the schema/mapping interface is fixed.

### Lane A — provenance and implementation contract preparation

- Own only `/private/tmp/slice-5x-evidence/preparation/`.
- Read-only inputs: `data/analytics.db` via SQLite mode=ro (never connect with write defaults),
  `src/strategy/route.ts`, `src/strategy/route.test.ts`, `package.json`, and exact imports/symbol
  uses for analytics schema, brand_id ingestion and brand-filtered routing. Locate only those
  symbols with bounded rg; read only their relevant bodies. No tree inventory or broad context.
- Establish actual schema, aggregate counts of missing/existing brand IDs by platform and
  provenance join coverage. Do not output content bodies, secrets, account tokens, personal data.
- Follow exact provenance references only as necessary to prove brand mappings; output aggregate
  counts, path:line code evidence, and anonymized minimal fixture shapes. Do not infer all rows
  are Human Inference from a platform name or current default.
- Deliver proposed exact owned source/test paths, dry-run/apply interface, transaction/idempotence
  and backup/rollback contract, future-ingestion regression scope, checks and immutable input hashes.
- No repo writes, DB migrations, provider calls or implementation. Frozen handoff to coordinator.

## Do not touch

- Real database, content, operational ledgers, provider state and credentials during preparation.
- AGENTS.md, packet template, unrelated changes, backlog, scoped builds or generated copy.
- Existing brand assignments, analytics metrics or approval/publishing policies.

## Cited headings

`docs/operations/launch-slices/SLICE-5R.md` → `## Known data gap, not this slice's`.
No master archive headings.

## Acceptance

- [ ] A1 — Measured inventory and evidence-based attribution rules account for missing brand IDs;
      ambiguous or conflicting provenance remains unmodified and is reported.
- [ ] A2 — Supported dry-run reports exact proposed changes without mutation; explicit apply
      transaction updates only proven NULL brand_id rows, preserving metrics and existing labels.
- [ ] A3 — Repeated apply is idempotent; failed/conflicting operations leave no partial updates;
      recoverable backup and bounded rollback evidence exist before real database application.
- [ ] A4 — Identified ingestion paths preserve known brand attribution on future analytics writes.
- [ ] A5 — Isolated actual-command verification demonstrates attributed history becomes visible to
      the intended brand filter, other brands remain isolated, and unknown rows are not assigned.
- [ ] A6 — Grok cross-family audit closes material gaps before operational application; focused
      checks and one final frozen unsandboxed npm run check pass before coordinator integration.
- [ ] A7 — Operational repair result records before/after aggregate counts and preserved-state
      evidence, or a supported zero-safe-candidates result. No speculative bulk attribution.

## Verify

Preparation: SQLite read-only aggregate inventory plus bounded source path:line proof and hashes.
Exact implementation commands will be frozen at the preparation checkpoint before assignment.
No provider or live model canary. No paid calls beyond the separately authorized Grok audit.
Coordinator: fresh worktree setup once, frozen unsandboxed `npm run check` once last;
`bash scripts/repo-hygiene.sh --rescue` for closeout.

## Observable result

Historical platform analytics with proven brand provenance appear in that brand's routing input;
the repair report explains every changed or unresolved row without guessing.

## Risk

High — audit required: yes; database attribution and future ingestion integrity.

## Families

- Preparation: Codex GPT-5.6 Terra high; bounded backend investigation.
- Builder: Codex GPT-5.6 Terra xhigh planned after exact ownership checkpoint.
- Auditor: Grok 4.5, --sandbox workspace, no edits, path:line citations.

## Closeout

NOT ACCEPTED — preparation found missing source-account binding; no implementation or database mutation. See ## Stopped.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:

## Prior-slice follow-up audit

Requested Grok 4.5 follow-up completed using --sandbox workspace, exit 0: PASS A1–A7
and audit A8 for committed 5W. No new established defects or material verification gaps.
F1 symlink closure: src/strategy/route.ts:329, :357, :368; F2 header: :595.
Existing broader CLI matrices remain optional with focused coverage; no scope expansion.
Pinned source and unrelated-file hashes unchanged after audit. Evidence:
`/private/tmp/slice-5x-evidence/coordinator/grok-5w-followup.txt` and matching exit JSON.

## Preparation repair checkpoint

Initial preparation worker paused. No source ownership assigned. Coordinator found that
`export-join-audit.ts` flattened arbitrary config strings and tested URL substring membership;
that cannot establish canonical account identity. Any Substack/LinkedIn sufficient-account claim
from that output is withdrawn pending exact identity proof. Existing checksum/post-ID coverage
is a separate claim and must not be confused with ownership evidence.

Lane A evidence ownership is reassigned exclusively to Codex Terra xhigh for this bounded repair:
`/private/tmp/slice-5x-evidence/preparation/`. The former Terra high worker is paused and must not
edit. Read-only inputs additionally include `config/brand-accounts.yaml` and exact parser sources
named in `export-join-audit.ts`. Verify explicit per-platform measurement account fields using
canonical parsed URL identity components; never flattened arbitrary strings or substrings.
Record actual reproducible command output, exact missing LinkedIn filename/checksum, and the
minimal account attestation needed for unresolved platforms. Do not output secrets or content.
Do not broaden discovery, edit repository source, mutate DB, or commit. Correct contradicted
claims in the contract in place, including the stale claim that all 409 posts lack recoverable
provenance. Substack Note 32 posts remain separately unresolved unless exact retained proof exists.

## Stopped

Blocker: legacy export-to-brand/account binding requires owner-supplied provenance; exact source
recovery also lacks one LinkedIn export. This is a missing sourcing input, not permission to read
repository context and not a reduction of the requested backfill.

Verified: 5W follow-up Grok PASS (exit 0); 5X SQLite read-only inventory and checksum-verified
source recovery. Legacy unbound counts: X 264 posts/2345 metrics, LinkedIn 100/430,
Substack 13/86, Substack Note 32/120. Recovered export post-ID coverage: X 264/264,
LinkedIn 74/100, Substack 13/13. No repaired source or DB candidate exists; no repository-wide
gate was run for preparation-only documentation.

Account-match evidence from the first preparation pass was defective and is withdrawn:
flattened config substrings cannot prove ownership. Higher-effort same-model repair found no
explicit platform public-account-to-brand binding in the configuration. All export-to-brand
assignments therefore remain unproven pending owner evidence. Source-ID joins alone do not
establish brand or metric-capture attribution. The 32 Substack Note posts still require bounded
provenance work; do not silently omit them from the target.

The 879 NULL-identity Bluesky child metrics have known parents but predate already bound latest
metrics. Read-only routing simulation stays 95 latest rows/95 posts, with zero repaired rows
selected. That optional integrity repair does not substitute for this slice's missing history.

Retained work: this packet, the master START HERE/progress entry, and
`/private/tmp/slice-5x-evidence/` containing Grok logs and preparation scripts/results/contract.
Only these packet/master changes may be committed; no source or DB changes were made.

Single next action: obtain a durable owner account attestation for the checksum-pinned legacy
exports and the missing LinkedIn source (or an exact alternate mapping), then freeze the mapping
contract and implementation/verifier ownership. Prepared source references and exact missing
artifact are retained in the preparation evidence contract. No manual per-row mapping is required
when the recovered export plus account attestation can establish it.

Pre-existing edits left unchanged and excluded: AGENTS.md; docs/operations/launch-slices/SLICE-TEMPLATE.md;
content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md;
data/notes-spread-ledger.jsonl. No worktrees/branches created in this slice; temporary scripts/logs
are retained outside the repository. Hygiene results are recorded before documentation commit.

## Hygiene evidence

Hygiene --rescue completed with exit 1 for expected documentation/unrelated edits and existing
local branches; rescue snapshot 88fad7a. No prunable worktrees. This session created only
`docs/operations/launch-slices/SLICE-5X.md` inside the repo; it is included in the documentation
commit. Four pre-existing edits listed above remain unchanged and excluded. Existing merged
branches slice-5q-queue/slice-5r-routing and five local-only agent/cs* branches are other sessions'
work and left intact; exact names/output in coordinator/hygiene.txt. No candidate source to commit.

## Frozen preparation result

Terra xhigh repair completed; actual command exit 0, no signal, stderr 0 bytes. Authoritative
output: `/private/tmp/slice-5x-evidence/preparation/provenance-account-audit.stdout.json` and
matching exit JSON. Input hashes and exact source-reference inventory are retained there.
`source-reference-attestation.json` (mode 0600) pins source checksums for the owner attestation.
Prior heuristic ownership claims are explicitly withdrawn in `prior-evidence-withdrawal.md`.

42/43 source references checksum-verified. Of 409 legacy posts, 351 have recovered source-ID
joins. Substack's 22 verified sources include 11 parser failures; the successfully parsed sources
cover its 13 legacy posts, but capture-level coverage still needs verification before repair.
No parsed public account owner is declared equivalent to the configured brand identity. None of
these source-ID joins is yet an approved brand assignment. All 32 Note posts remain unresolved.

Exact missing source: `data/processed/48db503c-AggregateAnalytics_Muxin%20Li_2025-06-17_2026-06-16.xlsx`.
Original filename: `AggregateAnalytics_Muxin%20Li_2025-06-17_2026-06-16.xlsx`.
SHA-256: `48db503c383057f58de668ad7162f5adbb421302b2027b354b4763d8e79294b5`.
A user confirmation of which brand/public accounts own the listed exports can supply the missing
binding; coordinator maps that attestation to the existing canonical internal identity keys.
Do not require the user to invent internal IDs or manually label rows recoverable from exports.
