# SLICE-8E: Make Postiz self-fetch its public media URLs

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md`. Do not load the repository for context.
Do not commit, stage, push, checkout or stash.

## Goal

The running Postiz container can fetch an uploaded `https://postiz-threads.meta:4443/uploads/...`
URL through the same public hostname stored on scheduled media rows, across container recreation,
without recreating or duplicating the three already-scheduled LinkedIn, Instagram, and Facebook
provider objects.

## Difficulty

hard — executable deployment configuration and a live scheduler must change without losing or
duplicating already-approved scheduled posts.

## Depends on

SLICE-8B accepted.

Delivery batch: SLICE-8E only. Prepare and validate the compose change first; the coordinator then
recreates only the Postiz-facing services, proves health and self-fetch, and reads back the three
existing provider objects. Stop after those checks or at the first evidence of identity/state drift.
Owner checkpoint: Muxin authorized finishing the remaining master work on 2026-09-12. Applying the
live compose change requires the sandbox approval presented at action time. No publish, reschedule,
cancel, or create request is authorized by this packet.

## Owned files

Parallel-safe: no — the implementation is one four-line compose contract whose validation depends
on the exact candidate and whose live proof depends on the recreated service. A second builder
would repeat the same external-deployment context without an independent deliverable. Audit and
live readback wait for a frozen candidate.

### Lane A — compose repair and bounded deployment evidence

- `/Users/Muxin/Documents/Codex/postiz-docker-compose/docker-compose.yaml`
- `docs/operations/launch-slices/SLICE-8E.md` (RESULT BLOCK filled by coordinator)

Pinned read-only inputs: the existing local CA certificate, nginx config, exact uploaded PNG URL
from accepted SLICE-8B evidence, and the three existing provider ids/times recovered through the
repository's read-only status path. Do not print or copy compose credentials.

Focused handoff: a diff containing only the Postiz hostname mapping, CA mount, and Node trust-path
setting; `docker compose config -q`; and a disposable-container fetch of the exact PNG.

## Do not touch

- `.env`, any credential value, Postiz database/volumes, scheduled content, slot ledger, queue rows,
  or provider objects.
- Do not commit the already-dirty external Postiz repository or absorb its pre-existing changes.
- Do not issue provider create, update, reschedule, cancel, or publish calls.

## Cited headings

none

## Acceptance

- [x] The Postiz service maps `postiz-threads.meta` to Docker's host gateway.
- [x] The local CA is mounted read-only and `NODE_EXTRA_CA_CERTS` points at that mounted certificate.
- [x] `docker compose config -q` accepts the frozen compose candidate without printing secrets.
- [x] A disposable container on the production network fetches the exact uploaded public PNG as
  HTTP 200 `image/png` before the live service changes.
- [x] The recreated Postiz service becomes healthy and resolves the hostname away from loopback.
- [x] The recreated live container fetches that exact URL as HTTP 200 `image/png`.
- [x] LinkedIn, Instagram, and Facebook retain the same stable provider ids, planned times, media,
  and scheduled state; no duplicate provider object appears.

## Verify

Classification and applicable gate: meaningful behavior/high risk because executable deployment
configuration changes the scheduler that holds approved posts. The repository source candidate is
unchanged, so `npm run check` cannot validate this external compose change. Required proof is
compose validation, pre-change disposable fetch, post-recreation health/DNS/fetch, exact provider
identity readback, and a bounded cross-family audit of the frozen diff and evidence.

```sh
/Applications/Docker.app/Contents/Resources/bin/docker compose --project-directory /Users/Muxin/Documents/Codex/postiz-docker-compose --env-file /Users/Muxin/Documents/Codex/postiz-docker-compose/.env -f /Users/Muxin/Documents/Codex/postiz-docker-compose/docker-compose.yaml config -q
```

## Observable result

The exact stored public media URL returns HTTP 200 from inside the recreated Postiz container, and
the three later image rows remain the same scheduled provider objects rather than replacements.

## Risk

high — audit required: yes; a wrong DNS/TLS or compose change can strand scheduled media or expose
secrets, while a mistaken recovery can duplicate posts.
Review boundary: the four-line external compose diff plus bounded command outputs and three-object
readback; never the external compose contents or credentials.
Review scope/budget: ordinary-effort Grok audit after the candidate is frozen, then a delta audit
only if a material finding changes the candidate. One live recreation; no provider retry budget
because this slice makes no provider mutation.
Audit result: Grok 4.5 ACCEPT. It found no candidate defect. Its three named verification gaps were
the planned post-recreation health/DNS/fetch, exact object comparison, and no-mutation checks; all
were closed with direct observable evidence before acceptance. The candidate never changed, so no
delta audit was needed.
Prior accepted evidence: SLICE-8B's public Bluesky proof and stable-id retry establish the defect
and exact uploaded URL. Reopen only if the URL, compose diff, or scheduled object identities change.
On reviewer outage: leave the compose candidate unapplied or the applied runtime review-blocked;
record the exact retry condition and do not accept the slice.

## Families

- Builder: Codex worker, ordinary effort, compose-only candidate; coordinator owns live recreation.
- Auditor: Grok 4.5, ordinary effort, bounded evidence-only CLI audit from outside the repository.

## Closeout

Preflight: exact candidate and changed path recorded; every acceptance item maps to compose/Docker
or provider-readback evidence; no secret-bearing output enters the audit bundle; audit precedes live
application; provider objects are read-only throughout.
Gate cost: one compose validation, one disposable preflight fetch, one service recreation, one live
fetch and one object readback. No repository-wide gate because repository runtime source is unchanged.

**PASS** 2026-09-12. The applied external compose is byte-identical to audited candidate
`bea8bfa7`. Only `postiz` and `postiz-https` were recreated; the database, Redis, Temporal, named
volumes, uploaded media, and provider objects were untouched. Postiz is healthy, resolves the
hostname away from loopback, and fetches the exact stored PNG as HTTP 200 `image/png`, 5,930 bytes.
The three scheduled rows match their frozen baseline exactly and each matching object count is one.

Hygiene, 2026-09-12: `bash scripts/repo-hygiene.sh --rescue` was run and its output reviewed. It
listed this session's master, packet, and packet-log edits; all are committed in the acceptance
commit. It also listed the pre-existing merged branches `slice-6m-worker` and `slice-6s-worker`,
which were left in place. Its sandboxed snapshot could not write a Git tree, so the coordinator
commit is the durable rescue. The external Postiz repository was already dirty; this session's
four-line compose hunk remains applied alongside, but does not absorb or commit, its earlier work.
The byte-exact before/candidate files and audit bundle remain under `/private/tmp/content-agents-slice-8e*`.

Closeout read set: protocol section 24,560 B; master `START HERE` 885 B; packet 9,423 B before this
measurement entry. All are within the 24,576 B / 12,288 B caps.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths: `/Users/Muxin/Documents/Codex/postiz-docker-compose/docker-compose.yaml` plus this
  packet, its log, and the master status. The external compose moved from source `4220f43c` to
  audited candidate `bea8bfa7`; a byte-exact rollback copy remains in the slice temp directory.
- Outcome: Postiz now self-fetches its stored public media URL through the host gateway with the
  existing local CA trusted by Node. The three later approved media rows remain unchanged.
- Checks run and results: structural red/green passed; four added lines and zero deletions;
  `docker compose config -q` exit 0; exact disposable fetch exit 0, HTTP 200, `image/png`, 5,930
  bytes. Pre-change live DNS/fetch reproduced `127.0.0.1:4443` refusal. Post-change: container
  `running healthy`, trust env present, CA mount read-only, hostname non-loopback, same exact fetch
  200/PNG/5,930. LinkedIn, Instagram, and Facebook retained exact ids, `QUEUE` states, times,
  groups, content hashes, media hashes/byte counts, no-error flags, and match counts of one.
- Evidence locations: frozen candidate and
  `/private/tmp/content-agents-slice-8e-audit/evidence.txt`; the saved verdict is
  `/private/tmp/content-agents-slice-8e-audit/grok-transcript.md`. No secrets entered the bundle.
  Grok 4.5 returned ACCEPT with no established defect. Live post-checks closed every named gap.
- Unresolved: none within SLICE-8E. Separate operational security issue: three pre-existing OAuth
  client secrets remain inline in the external compose's uncommitted local changes and must be
  rotated/moved to `.env`; no value is repeated here.
- Delivery state and next action: accepted and applied; coordinator closes the master and commit.
- Usage: local checks under one minute each; Grok provider-reported usage unavailable; no provider
  publish/create/update/reschedule/cancel call was made.

## Usage budget and handoff

- Each extra lane: none; the one compose diff and live scheduler are shared mutable resources.
- Assignment: fresh Codex worker context for the compose-only candidate; coordinator applies and
  verifies the live runtime after a frozen handoff.
- Evidence return: changed path, red/green fetch outputs, compose validation exit, candidate hash,
  and no secret-bearing text.
- Capability boundary: close automatically after audit, live proof, identity readback, hygiene,
  master update, and coordinator commit; otherwise write one bounded `## Stopped` handoff.
