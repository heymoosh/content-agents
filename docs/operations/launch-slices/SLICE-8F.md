# SLICE-8F: Bitwarden-backed Postiz runtime secrets

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Prepare and independently review a frozen Postiz Compose candidate and fixed-action launcher that
take every active runtime secret from Bitwarden Secrets Manager at process start, leave no secret
literal in Compose or `.env`, and never emit a value. Do not mutate Bitwarden, provider consoles,
the live stack, or the external `.env` in this slice. Live cutover waits for the owner checkpoint.

## Difficulty

hard — this changes the credential boundary of a live publisher and must preserve the accepted 8E
network/CA repair without exposing or invalidating credentials.

## Depends on

SLICE-8E accepted.

Delivery batch: 8F security preparation, 8G request-boundary validation, and 8H capture lifecycle
repair are authorized. 8G and 8H may be accepted independently. 8F stops after an audit-cleared
frozen candidate until the owner completes provider rotation and supplies a newly scoped Bitwarden
machine token outside Codex; live cutover is then separately verified before acceptance.
Owner checkpoint: owner rotates LinkedIn, Threads, Facebook, Postiz JWT, and Postgres credentials;
stores the complete active secret set in a dedicated Bitwarden project; creates a read-only machine
account token; removes/revokes the globally inherited token; and runs the cutover launcher from a
human terminal. Provider-console rotation may require attended browser work. No secret value is
ever pasted into this repository, a prompt, command argument, log, or evidence file.

## Owned files

Parallel-safe: yes — Lane A owns only a frozen `/private/tmp` candidate and the later external
Compose/launcher paths. 8G and 8H own disjoint repository source/test paths. Final external apply,
Bitwarden population, provider rotation, and container recreation remain serialized.

### Lane A — frozen secure-deployment candidate

- `/private/tmp/content-agents-slice-8f/docker-compose.yaml`
- `/private/tmp/content-agents-slice-8f/postiz-secure`
- `/private/tmp/content-agents-slice-8f/check.sh`
- after audit only: `/Users/Muxin/Documents/Codex/postiz-docker-compose/docker-compose.yaml`
- after audit only: `/Users/Muxin/Documents/Codex/postiz-docker-compose/scripts/postiz-secure`

Pinned read-only inputs: external Compose at the SHA-256 recorded before work; its key names and
value classifications may be read, but values must be redacted before output. Existing 8E CA and
host-gateway lines are immutable acceptance inputs.

Focused checks: structural secret-classification check; Compose `config -q` with fake placeholders;
launcher test against a fake `bws`/Docker harness; shell syntax; exact diff. Frozen handoff is the
candidate hashes plus bounded diff and check output, with no values.

## Do not touch

- `/Users/Muxin/Documents/Codex/postiz-docker-compose/.env`
- Bitwarden projects, secrets, machine accounts, or access tokens
- LinkedIn, Meta, or any other provider console
- running containers, databases, Redis, Temporal, volumes, provider objects, or scheduled rows
- any other dirty or untracked path in the external Compose repository
- `docs/content-agents-backlog.md`

## Cited headings

- `docs/content-studio-master-status.md` → `## Outstanding work`

## Acceptance

- [ ] No active runtime secret has an inline literal in the candidate Compose.
- [ ] JWT and both Postgres password uses resolve from one required `JWT_SECRET` and one required
      `POSTGRES_PASSWORD`; `DATABASE_URL` interpolates that same database secret.
- [ ] Active provider secrets resolve from required environment variables with their existing key
      names; non-secret client IDs and URLs are not mislabeled as secrets.
- [ ] The accepted 8E host-gateway, read-only CA mount, and `NODE_EXTRA_CA_CERTS` lines are unchanged.
- [ ] The launcher supports only fixed `validate`, `up-app`, and `up-all` actions, uses
      `bws run --project-id ... --no-inherit-env`, and never prints or accepts secret values.
- [ ] A fake-secret harness proves the launcher passes the required keys to Compose without writing
      them to disk or output; missing token/project/key failures are fail-closed and value-free.
- [ ] The candidate passes `docker compose config -q` with fake placeholders and a bounded
      cross-family security audit.
- [ ] No live or external file mutation occurs before the owner checkpoint.

## Verify

Classification and applicable gate: meaningful behavior/high risk — credential injection and live
deployment configuration require focused structural/harness checks and a bounded cross-family audit.
The live cutover later requires exact container-health, non-secret environment-key presence, 8E PNG
self-fetch, database reachability, and scheduled-row invariants; never inspect resolved values.

```sh
bash /private/tmp/content-agents-slice-8f/check.sh
```

## Observable result

The reviewed candidate contains only required variable references; a human can provide a scoped
Bitwarden token in a separate terminal and run one fixed launcher action without producing a
plaintext secrets file.

## Risk

high — audit required: yes; a quoting, interpolation, or launcher defect could expose credentials or
prevent Postiz from starting.
Review boundary: frozen Compose, launcher, bounded diff, acceptance list, and fake-harness output.
Review scope/budget: one ordinary-effort Grok 4.5 evidence-only audit, then a delta audit only if a
material finding changes the candidate. No repository or secret export.
Prior accepted evidence: SLICE-8E candidate `bea8bfa7fdcbbc445d0fef278da3f5c64f62e34744bf339099a5afa2c654b982` accepted the CA/host repair;
any change to those lines reopens 8E review.
On reviewer outage: retain the candidate in `/private/tmp`, record review-blocked, and do not apply;
8G/8H continue independently.

## Families

- Builder: Codex worker, related 8E compose context reused at ordinary effort
- Auditor: Grok 4.5, ordinary effort, evidence-only CLI from `/private/tmp` using the Mac standing rule

## Closeout

Preflight: pin source and candidate hashes; enumerate changed paths; map every acceptance item to
value-free output; verify fake harness and Compose exit codes; audit before apply; keep cutover
blocked until every rotated value exists outside this session.
Gate cost: bounded temp-tree checks are expected under one minute; live cutover proof unknown and
not authorized until the owner checkpoint.

Closeout gate: record `PASS` only after the live cutover; otherwise list the checkpoint as leftover.
Hygiene: run `bash scripts/repo-hygiene.sh --rescue`; commit/delete only this slice's repository
paths, and name every other path left untouched.
Read-set: use the binding's exact three byte-count commands for this packet.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
- Delivery state and next action:
- Usage:

## Usage budget and handoff

- Each extra lane: 8G and 8H produce independent source fixes on disjoint paths while human-only
  credential rotation is pending.
- Assignment: reuse the completed SLICE-8E Codex worker; frozen `/private/tmp` handoff only.
- Evidence return: commands, exits, candidate/source hashes, exact key names and classifications,
  short result, no values.
- Capability boundary: security candidate audit and owner checkpoint; completion notification only.

## Stopped

Not stopped yet. Expected checkpoint after build/audit: owner rotation and human-terminal cutover.
