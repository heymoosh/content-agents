# SLICE-5P: prove the posting path end to end without publishing anything

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Answer, with observed evidence rather than inference, the question SLICE-5O could not answer:
**does a piece of content actually travel from `/atomize` to a live Typefully draft?**

Demonstrably true when done: one real source has been atomized, its row approved by Muxin in
`review-queue.md`, `npm run publish:typefully` has created a **real draft in Muxin's Typefully
account**, that draft has been observed, and it has been cancelled again — with the repository and
Muxin's operational data left exactly as they were found, apart from the ledger migration this
slice is also there to witness.

This is a **verification** slice. Its deliverable is evidence and a defect list, not a feature. If
the path works, the slice ships a recorded PASS and nothing else. If it breaks, the failure is the
deliverable and the repair is a separate slice.

## Difficulty

Hard — not for the code, which is small, but because it is the project's first **live authenticated
run** since the July freeze, it touches Muxin's real Typefully account and her real slot ledger, and
it requires a human approval step in the middle that no worker may perform or simulate.

## Depends on

SLICE-5O (accepted, commit `540c065`) — the ledger migration this slice will witness firing for the
first time in production.

## The safety property this slice is built on

Verified in source before this packet was written, at `src/publish/typefully.ts:136-144`:

> `publishAt: null | undefined` → Typefully saves an **UNSCHEDULED** draft. Status is not
> `"scheduled"`, there is no `scheduled_date`, and **it will not auto-post**. It sits in the queue
> until a human schedules or publishes it. Only a non-null `publishAt` (an ISO time or
> `"next-free-slot"`) creates a scheduled draft that auto-fires.

So the entire real path — auth, payload construction, media upload, the API call, the response
handling — can be exercised against the live service while the thing it produces is structurally
incapable of posting. That is what makes this a dry run rather than a publish.

`cancelDraft` (`typefully.ts:191`) deletes the draft afterwards by the id `createDraft` returned.
`releaseClaims` (exported from `src/publish/slots.ts`) releases the slot claim. Both must run.

**This does not weaken rule 2.** Nothing reaches Typefully at all until Muxin has set the row to
`approve` in `review-queue.md`. The unscheduled-draft property is a second independent guard, not a
substitute for the first.

## Verification budget — fixed before starting, per the protocol's live-slice binding

- **One** authenticated canary through the workflow. **At most one** retry if it fails on
  something transient (network, 5xx). A second substantive failure ends the slice and becomes the
  finding.
- No retry loop around `createDraft` under any circumstance. `typefully.ts:166-167` says why: a
  lost response or a 5xx can arrive after the draft was created, so a retry risks a duplicate.
- If the run produces a good draft but a later step fails, **preserve the draft id and the run
  output** before doing anything else. Do not discard successful live output to reach a clean state.

## Owned files

Parallel-safe: **no — single lane.** The work does not divide: it is one sequential live path with
a human gate in the middle, and every stage's input is the previous stage's output. Two workers
would be two runs against one real account.

### Lane A — the run and its record

- `docs/operations/launch-slices/SLICE-5P.md` (this file — the RESULT BLOCK and the evidence)
- a scratch transcript under `$TMPDIR`, path named in the RESULT BLOCK

No production source file is owned by this slice. **If the run reveals a defect, the worker records
it and stops. It does not fix it here** — a repair inside a verification slice destroys the thing
being verified.

## Do not touch

- `data/cost-log.csv` — just purged of 404 fixture rows on 2026-09-07 and **not tracked by git**
  (`.gitignore:14`), so there is no recovery path. A real paid call during this run may legitimately
  append one row; nothing may rewrite or truncate the file.
- `data/publish-schedule.jsonl` — the legacy ledger. It is the **source** of the migration this
  slice witnesses and must survive the run byte-identical (`3a1d30a6f0f8093c251b46b75947e8d4a8fbc817e57ea596a3ef8702be25ca58`).
- `data/notes-spread-ledger.jsonl`, `data/community-log.md`, `briefs/bets.md` — real operational
  records, append-only or owner-owned.
- `.claude/skills/**` — write-protected by Muxin's settings.
- `review-queue.md` **status column** — the worker may read it and may add generated rows via
  `/atomize`, but only Muxin sets a status to `approve`.

## Cited headings

`none`

## Stages, and where the human gate sits

1. **Pick the source.** A real piece, Muxin's choice, Human Inference brand. Record which.
2. **Atomize it.** Note what routing includes and what it excludes; a platform absent from the run
   because routing excluded it is not a failure.
3. **Stop.** Hand the queue to Muxin. **Worker stops here and reports.**
4. **Muxin approves exactly one row** in `review-queue.md`. One, not several — the budget is one
   canary.
5. **Publish with `publishAt: null`.** Capture the draft id and the full response.
6. **Observe the draft in Typefully** and confirm from the live queue that its status is not
   `"scheduled"` and it carries no `scheduled_date`.
7. **Clean up:** `cancelDraft` the draft, `releaseClaims` the slot.
8. **Re-verify the world.** Hashes and ledger state per Acceptance below.

## Acceptance

- [ ] A1 — `/atomize` produced derivatives for a real source, and the routing decision is recorded
      with the reason each platform was included or excluded.
- [ ] A2 — Nothing reached Typefully before Muxin set a row to `approve`. Establish this from the
      run's ordering, not from the code's intent.
- [ ] A3 — `createDraft` returned a real draft id from Muxin's live account, called exactly once.
- [ ] A4 — That draft, read back from the **live Typefully queue** (not from local state), has
      status ≠ `"scheduled"` and no `scheduled_date`. This is the observation the slice exists for.
- [ ] A5 — **The ledger migration fired in production for the first time.**
      `~/.content-agents/content-agents-154a8dd69ae2/scheduler/publish-schedule.jsonl` now exists and
      contains the 54 historical claims plus the new one. Assert on **claims read**, not on a path.
- [ ] A6 — `data/publish-schedule.jsonl` still hashes `3a1d30a6…`. The migration copies; it must not
      move, truncate, or delete.
- [ ] A7 — The draft is cancelled and the slot claim released. The live queue no longer shows it.
- [ ] A8 — `data/cost-log.csv` grew by only rows that name a genuine paid call, or not at all. No
      `"Acme Co"`. No rewrite of existing rows.
- [ ] A9 — Every defect found is recorded with `file:line` and a reproduction, and **none is fixed
      in this slice**.

## Verify

Run the gate unsandboxed. In a fresh worktree run `npm run worktree:setup` first.

```
npm run check
```

State-of-the-world checks, before and after the run:

```
shasum -a 256 data/publish-schedule.jsonl
wc -l < data/cost-log.csv
ls -la ~/.content-agents/content-agents-154a8dd69ae2/scheduler/ 2>&1
```

Claims actually readable after the migration — assert on the count, not the path:

```
node --import tsx -e 'import {readLedger,ledgerPath} from "./src/publish/slots.ts"; const c=readLedger(); console.log(ledgerPath()); console.log("claims:", c.length); console.log("newest:", JSON.stringify(c[c.length-1]));'
```

## Observable result

Muxin can open Typefully, see a draft appear that is not scheduled to post, and see it disappear
again. Everything else in this packet is there to prove that what she saw was the real path and not
a rehearsal of it.

## Risk

**High** — audit required: **yes.**

It is the first live authenticated run since the freeze, against the owner's real account, on a
path whose failure mode is a post going out unreviewed. The audit's job is narrow and specific:
confirm from evidence that **nothing could have posted**, and that the run exercised the production
path rather than a test double of it. An auditor that cannot establish the unscheduled property from
the captured response should say so rather than infer it.

## Families

- Builder: strong model, one lane. Live credentials and irreversible outward-facing calls.
- Auditor: different family, strong tier. Receives the run transcript, the captured API responses,
  the before/after hashes and the acceptance list — never the master document or the repo tree.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in this
packet before the slice can close.

**Closeout 2026-09-07: NOT ACCEPTED. Stopped before stage 5.** Leftover list:

1. Stage 5 is unsatisfiable against shipped code. `src/publish/typefully.ts:480-484` throws on
   `--no-schedule` (and on `TYPEFULLY_SCHEDULE=off`) before any network call; the unified path
   (`typefully.ts:485-486` → `src/publish/unified-cli.ts:10` → `src/review/publishing-status.ts:286-290`)
   has no unscheduled option. The safety property at `typefully.ts:136-144` is reachable only from
   `buildDraftPayload` / `publishText`, which no command calls with `publishAt: null`. Needs a
   decision from Muxin: restore an unscheduled path (repair slice, then rerun 5P) or authorize a
   scoped verification script that calls `createDraft` directly.
2. The review GUI dispatches a real publish on approve (`src/review/serve.ts:1141-1148`, comment
   at `:1142-1143`: every publisher creates a **scheduled** draft). Muxin's three approve clicks on
   `x-1` were three real publish attempts; all failed before any provider request because
   provider selection tried Postiz first and capability discovery got `fetch failed`
   (`~/.content-agents/content-agents-154a8dd69ae2/publishing-status.jsonl`, three rows at
   17:31:24Z, 17:31:29Z, 17:31:49Z, `state: failed`). Needs a decision from Muxin: is approve the
   publish trigger, or should approve and dispatch be split.
3. `x-1` remains at `approve` in
   `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md:31`. If
   Postiz discovery starts working, a retry creates an auto-firing post. Only Muxin edits status.
4. Postiz capability discovery `fetch failed` blocks the unified path regardless of item 1.
5. The permission classifier blocked the worker's `npm run publish:typefully` command; the
   worker correctly did not script around it.

Defects recorded (A9), none fixed:

- GUI flash: `src/review/page.ts:1350` removes the message after 1400 ms with no dismiss path;
  the failure branch at `page.ts:1666` is what Muxin saw. Owned by SLICE-5Q.
- Write-then-dispatch ordering: `serve.ts:1136` `updateRow` runs before dispatch at `:1148`, so
  status changes even when dispatch fails. Outside 5Q's scope; its own slice.
- Failures go to the publishing-status ledger (`publishing-status.ts:330`), never to stdout, so
  the server log is silent on a failed publish.
- `.claude/skills/atomize/SKILL.md:169` bare `tsx` not on PATH; `SKILL.md:451-453` caption
  platform list stale versus `src/publish/typefully.ts:33` TEXT_PLATFORMS. Write-protected; NEEDS
  MUXIN.
- `new-content` collides with the pre-existing `content/2026-09-02-the-world-s-broken-what-do-we-do/`
  (same essay, 14 pending rows) and created a second folder under a brand-suffixed slug.
- `data/analytics.db`: every X, LinkedIn and Substack row has NULL `brand_id`; only Bluesky rows
  carry `human-inference`, so a `--brand` routing run sees no X history and falls back to config.
  Backfill is its own slice.

## Known-live issues to watch for, not to fix here

- `src/publish/queue-view.ts:346` prints `data/publish-schedule.jsonl` to the user while reading the
  migrated file. If the run surfaces this to Muxin, record it; the repair is its own slice.
- `migrateLegacyDataDirectory` (`jobs.ts:70`) is still non-atomic. Not on this path, but if the run
  touches it, stop and say so.
- Three test files race on the repo-root `.e2e-configured-engine-token`. Pre-existing; if the gate
  fails there, it is not this slice's.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths: none in production source. Generated by `/atomize` (stage 2):
  `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/` (source, extracts,
  routing, review-queue with 14 rows, content-request.json, 14 derivatives, no images).
- Outcome: STOPPED before stage 5. Stages 1 to 4 complete. No `createDraft` call, no draft id,
  nothing reached Typefully. Source: `https://humaninference.ai/essays/the-worlds-broken-what-do-we-do`,
  brand human-inference. Routing included all six platforms (Bluesky on data, civic-tech 1.23x at
  n=28; everything else cold start), none skipped.
- Checks run and results: A1 met; A2 holds (`"no provider request was made"` in all three ledger
  rows, no `publish-log.md`, no Placed row in `briefs/bets.md`, `x-1` still `approve`); A3, A4
  not met; A5 partially met (migration fired from Muxin's `npm run review` session between
  17:21 and 17:38, `readLedger()` returns 54 claims at the migrated path, expected 54+1 but no
  slot was claimed); A6 holds (`data/publish-schedule.jsonl` =
  `3a1d30a6f0f8093c251b46b75947e8d4a8fbc817e57ea596a3ef8702be25ca58`, migrated copy
  byte-identical at 54 lines); A7 not applicable; A8 holds (`data/cost-log.csv` =
  `8250c61f0ba987b81599587fbb9f044c170f9da067f72c1a7554a01dbb8b70c6`, 35 lines); A9 met.
  `npm run check` not run: no source changed.
- Evidence locations: `/tmp/claude-501/slice-5p-transcript.md` (380 lines, section
  `STAGES 5-8 — STOPPED`); `slice-5p-content-before/after.txt`, `slice-5p-gitstatus-before/after.txt`
  beside it; `~/.content-agents/content-agents-154a8dd69ae2/publishing-status.jsonl`;
  `~/.content-agents/content-agents-154a8dd69ae2/scheduler/publish-schedule.jsonl`.
- Unresolved: see Closeout leftover list above.
