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

Parallel-safe: no — the implementation is one three-line compose contract whose validation depends
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

- [ ] The Postiz service maps `postiz-threads.meta` to Docker's host gateway.
- [ ] The local CA is mounted read-only and `NODE_EXTRA_CA_CERTS` points at that mounted certificate.
- [x] `docker compose config -q` accepts the frozen compose candidate without printing secrets.
- [x] A disposable container on the production network fetches the exact uploaded public PNG as
  HTTP 200 `image/png` before the live service changes.
- [ ] The recreated Postiz service becomes healthy and resolves the hostname away from loopback.
- [ ] The recreated live container fetches that exact URL as HTTP 200 `image/png`.
- [ ] LinkedIn, Instagram, and Facebook retain the same stable provider ids, planned times, media,
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
Review boundary: the three-line external compose diff plus bounded command outputs and three-object
readback; never the external compose contents or credentials.
Review scope/budget: ordinary-effort Grok audit after the candidate is frozen, then a delta audit
only if a material finding changes the candidate. One live recreation; no provider retry budget
because this slice makes no provider mutation.
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

Leftover list, 2026-09-12: explicit owner authorization to export the bounded private deployment
evidence to Grok; then audit acceptance, live compose application, health/DNS/fetch proof, and the
three-object identity readback. The live compose and services remain unchanged.

Hygiene, 2026-09-12: `bash scripts/repo-hygiene.sh --rescue` was run and its output reviewed. It
listed only this session's two documentation edits, both committed in the stopped-handoff commit,
and the pre-existing merged branches `slice-6m-worker` and `slice-6s-worker`, which were left in
place. Its attempted snapshot could not write a Git tree under the active sandbox; the subsequent
coordinator commit is the durable rescue. No other path was listed or changed.

Closeout read set: protocol section 24,560 B; master `START HERE` 872 B; packet 9,727 B before this
measurement line. All are within their 24,576 B / 12,288 B caps.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths: `/private/tmp/content-agents-slice-8e/docker-compose.yaml` only; the live external
  compose stayed at SHA-256 `4220f43c97c7a0d320e4bfde8b093d578652176e408e2e28d3fdbf5181664f88`.
- Outcome: frozen candidate `bea8bfa7fdcbbc445d0fef278da3f5c64f62e34744bf339099a5afa2c654b982`
  adds only the host-gateway mapping, read-only CA mount, and Node CA path.
- Checks run and results: structural red/green passed; four added lines and zero deletions;
  `docker compose config -q` exit 0; exact disposable fetch exit 0, HTTP 200, `image/png`, 5,930
  bytes. Pre-change live DNS/fetch reproduced `127.0.0.1:4443` refusal. Read-only database baseline
  found all three target ids once, `QUEUE`, at their recorded times, with stable content/media
  hashes and no error.
- Evidence locations: frozen candidate and
  `/private/tmp/content-agents-slice-8e-audit/evidence.txt`; no secrets are in the audit bundle.
- Unresolved: Grok did not start. The sandbox reviewer rejected export of private deployment
  evidence because this session lacks the owner's specific authorization for that external
  destination. No same-family audit was substituted.
- Delivery state and next action: built and locally verified, review-blocked, not applied. Muxin
  must explicitly authorize sending the bounded audit bundle to Grok; then resume at the audit.
- Usage: local checks under one minute each; model call did not start; provider usage unknown.

## Usage budget and handoff

- Each extra lane: none; the one compose diff and live scheduler are shared mutable resources.
- Assignment: fresh Codex worker context for the compose-only candidate; coordinator applies and
  verifies the live runtime after a frozen handoff.
- Evidence return: changed path, red/green fetch outputs, compose validation exit, candidate hash,
  and no secret-bearing text.
- Capability boundary: close automatically after audit, live proof, identity readback, hygiene,
  master update, and coordinator commit; otherwise write one bounded `## Stopped` handoff.

## Stopped

Blocked: the required cross-family audit cannot receive the frozen private deployment evidence
without Muxin's explicit authorization to send that bounded bundle to Grok.

Verified: candidate hash/diff, compose resolution, exact disposable DNS+TLS media fetch, and the
three target objects' pre-recreation database baseline. The live compose and services were not
changed. Retained work is the candidate and redacted audit bundle under
`/private/tmp/content-agents-slice-8e*`; the committed packet contains their hashes and result.

Next action: Muxin explicitly authorizes (or declines) sending
`/private/tmp/content-agents-slice-8e-audit/evidence.txt` to Grok 4.5 for the required bounded audit.
