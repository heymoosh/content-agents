# SLICE-6W: the first real scheduled delivery through Studio, and the first real move of it

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

One Bluesky text post that Muxin has already approved is scheduled to the live provider from the
Studio Publishing room's own Schedule action, is then moved once to a different real slot, is
confirmed live by her, and carries a recorded terminal delivery event. Before any live call, the
same path is proven hermetically and by a create-and-cancel canary.

This is the claim the publishing stack has never made: the code has been green for weeks, but no
real piece has ever gone out through Studio.

## Difficulty

hard — irreversible live publishing on Muxin's real account, one human gate in the middle, and a
provider rate limit that has already bitten this repo once (recorded 2026-09-02: Postiz's ~90
requests/hour ceiling ended the Bluesky carousel canary).

## Depends on

6V (accepted). No code dependency.

Delivery batch: 6W only. Deliverable: an operational proof, not a feature — code changes only if a
live step exposes a defect, and then only paths named in this packet first. Acceptance order:
Stage 1 must record PASS before any Stage 2 command runs. Stop condition: stop when Stage 2's
evidence is recorded, or at the second failed attempt on any one live step (then engineering-blocked).
Owner checkpoint: one, before Stage 2. Already decided, not hers to re-decide: channel Bluesky,
media text, exactly one post, taken from a row she has already approved. She does exactly three
things — (1) name the slug and row id of one approved Bluesky text row; (2) confirm her standing
Postiz canary approval (given 2026-09-02) still holds, or supply a fresh
`POSTIZ_CANARY_APPROVAL_JSON`; (3) after the moved slot passes, look at Bluesky and say whether the
post is live at the moved time. Nothing here publishes anything she has not approved in
`review-queue.md`.

## Owned files

Parallel-safe: no. Every step consumes one shared, rate-limited live resource (one Postiz
workspace, one Bluesky account) plus one human gate, and each step must observe the previous step's
provider state before acting. The split considered was Stage 1's hermetic proof in one lane and
Stage 2 preparation in another; rejected because Stage 2's only preparation is reading Stage 1's
frozen result, so a second worker would add a handoff and no independent deliverable.

### Lane A — the single serial lane

- `docs/operations/launch-slices/SLICE-6W.md` (this packet; coordinator writes, worker reads)
- `docs/operations/launch-slices/SLICE-6W-LOG.md` (dated records, canary reports, screenshots index)
- `$TMPDIR/slice-6w/` (canary report JSON, reconcile output, Studio screenshots)

Written by the commands themselves, never hand-edited: `review-queue.md` (the one named row's
status only), `data/publish-schedule.jsonl`, the delivery-event ledger,
`data/provider-reconciliation-health.json`, `data/cost-log.csv`.

## Do not touch

- `src/**`, `e2e/**`, `config/**`, `AGENTS.md` — any repair here requires this packet to name the
  path first, then a cross-family audit of that diff.
- `.env` — read by the commands, never written, never copied into a scratch root.
- Any `review-queue.md` row other than the one Muxin names, and any other slug's content folder.

Superseded 2026-09-11: the general fix (wiring a backfill into `serve.ts`'s queue-load path) was
attempted, got two rounds of cross-family audit, and was deferred after a second **BLOCK** verdict
(four open defects — see `SLICE-6W-LOG.md` → `## Deferred — general provenance-journal fix,
2026-09-11`). No `src/**` file changed as a result; all worker edits were reverted uncommitted.

Named exception, owner-decided 2026-09-11 ("yes, but fix it properly" deferred; narrow path
approved for now): a new one-off script, `scripts/slice-6w-seed-provenance.ts`, may call the
existing, already-tested `recordNewQueueRows` (`src/review/approval-provenance.ts`) directly and
only for the row Muxin named (`bluesky-2`), to seed one real `approval-dispatch-safety.jsonl` entry
so Studio's Schedule action stops treating it as legacy. No file under `src/**` is edited. The
script itself gets a cross-family audit (Codex) before it is run for real, same as any other
Stage-2-affecting change.

## Cited headings

`docs/content-studio-master-status.md` → `## Standing constraints`

## Acceptance

- [ ] 1. `npm run test:e2e` exits 0 with 0 failures, counts recorded, before any live call.
- [ ] 2. `npm run verify:postiz-canary` scoped to Bluesky exits 0; its report shows the Bluesky text
  channel `ok: true` with a `postId` and a `scheduledAt`.
- [ ] 3. That same report shows the canary post reconciled to `canceled` — Stage 1 leaves nothing
  standing at the provider.
- [ ] 4. That same report records a `rescheduledTo` different from its `scheduledAt`, proving the
  move path before it is used for real.
- [ ] 5. Muxin has named exactly one Bluesky text row (slug + row id), and that row's status in
  `review-queue.md` reads `approve` at the moment of scheduling.
- [ ] 6. That row is scheduled through the Studio Publishing room's Schedule action in a browser,
  not by a CLI shortcut, and the Studio page afterwards shows it scheduled with a concrete PT date
  and time.
- [ ] 7. The scheduled time came from the unified scheduler's next free Bluesky slot: a matching
  line exists in `data/publish-schedule.jsonl` and no time was typed by hand.
- [ ] 8. Exactly one provider object was created for that row. Bluesky is configured for both
  `postiz` and `typefully` in `config/brand-accounts.yaml`; the evidence must show one post, not one
  per provider.
- [ ] 9. `npm run publish:reschedule -- --slug <slug> --id <row> --to <ISO> --dry-run` lists that one
  row and no other; the same command without `--dry-run` then exits 0.
- [ ] 10. `npm run publish:reconcile` exits 0 and the row's delivery event carries a
  provider-reported scheduled time equal to the moved time, not merely the requested time.
- [ ] 11. After the moved slot passes, Muxin confirms the post is live, and
  `npm run publish:record-evidence` exits 0 printing an event with `state` `live`.
- [ ] 12. No other `review-queue.md` row changed status, and the Bluesky account gained exactly one
  new post from this slice.
- [ ] 13. `npm run check` run unsandboxed exits 0 with 0 failures, last.

## Verify

Classification and applicable gate: feature/experience completion — a real user journey against a
live backend with an irreversible outcome. Requires the browser journey, the full repository gate,
and a cross-family audit of the evidence bundle before acceptance. No documentation-only or
low-risk exception applies.

For UI changes: journey is the Publishing room's Schedule action, then its scheduled-row display
after the move. Error/recovery path: a provider `429`. If one appears, stop, wait out the hour, and
count that as the single allowed retry. Viewport 1440x900 desktop. No feature flags. Live backend,
not fixtures — `npm run review:fixtures` must not be used anywhere in Stage 2. Retain Studio
screenshots of the row before scheduling, after scheduling, and after the move, plus the browser's
network evidence that one create call was made.
Retain candidate/build identity, commands, exits, pass/fail/skip counts and reasons.

Stage 1 — hermetic and create-and-cancel, no owner gate, run first:

```
npm run test:e2e
POSTIZ_CANARY_ONLY=bluesky \
POSTIZ_CANARY_REPORT="$TMPDIR/slice-6w/canary.json" \
POSTIZ_CANARY_RESCHEDULE_TO=<ISO far-future, later than the canary scheduledAt> \
POSTIZ_CANARY_APPROVAL_JSON=<Muxin's approval object> \
POSTIZ_CANARY_INPUT_JSON=<one Bluesky text input, scheduled far out> \
  npm run verify:postiz-canary
```

Stage 2 — one real delivery, only after Stage 1 records PASS and Muxin names the row:

```
npm run review
# drive the Publishing room's Schedule action in the browser, then:
npm run publish:reschedule -- --slug <slug> --id <row> --to <ISO> --dry-run
npm run publish:reschedule -- --slug <slug> --id <row> --to <ISO>
npm run publish:reconcile
# after the moved slot passes and Muxin confirms:
npm run publish:record-evidence -- --slug <slug> --row <row> --state live \
  --evidence "<what she checked>" --url <post url>
npm run check
```

## Observable result

Muxin opens Bluesky and sees one post she approved, live at a time she never typed. Studio shows
the same row saying the same thing, and one evidence line records what she checked and when.

## Risk

high — audit required: yes, evidence-based. This is the first irreversible live publish through
this stack. A wrong row, a duplicate post, or a double-provider fan-out is visible to her audience
and cannot be fully undone.
Review boundary: this candidate.
Review scope/budget: one bounded pass over the evidence bundle plus any code-repair diff, ordinary
inputs, high effort justified by irreversibility. Unanswered questions to put to the auditor: does
the evidence show exactly one provider object, given Bluesky lists two providers; does the ledger's
moved time come from the provider's report or only from the request; did any step write `.env` or
touch a second row.
Prior accepted evidence: 6V's `npm run check` 4379/0 and 6U's `npm run test:e2e` 50 pass / 0 fail /
16 blocked. Reopened by any change under `src/` or `e2e/`.
On reviewer outage: if the cross-family reviewer is unavailable, mark the candidate review-blocked
and do not run Stage 2 at all. Stage 1 is create-and-cancel and may stand as a separately recorded
partial. Retry when the reviewer returns; never integrate a live delivery whose review is pending.

## Families

- Builder: Claude, strongest tier, high effort — this packet declares the work high-risk, which is
  the escalation condition in `### Effort tiers`.
- Auditor: Codex (GPT family), `codex exec --sandbox read-only`, high effort. Different family from
  the builder, as the protocol requires.

## Closeout

Record `**PASS**` with a date, or the explicit leftover list, in this packet before the slice
closes. The binding's closeout gate is `none`; no command belongs in this slot.

Preflight: this packet names every owned path and every command; Stage 1 PASS is recorded before
Stage 2 starts; the row Muxin named is pinned by slug and id in the RESULT BLOCK; every acceptance
item above maps to a file, a command exit code, or a named human confirmation; no acceptance item
rests on intent.
Gate cost: `npm run check`, unsandboxed, on the frozen candidate — measured at 173 s on 2026-09-11.
`npm run test:e2e` runs once in Stage 1 and again only if `src/` or `e2e/` changed. No
paperwork-only rerun.

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for the
hygiene item — not a bare exit code. Four other-session items are already known to be listed
(`wt-slice-6m`, `wt-slice-6s`, and two merged branches); name them and leave them in place.

Use the `### Read-set measurement` form in the same file for the closeout read-set print.

## Stopped

Resolved 2026-09-11: `bluesky-2` now carries real `approval-dispatch-safety.jsonl` provenance
(`{"kind":"fresh"}`) via the audited one-off `scripts/slice-6w-seed-provenance.ts` — see
`SLICE-6W-LOG.md` → `## One-off provenance seed, 2026-09-11`. The general systemic gap (production
never populates that journal for newly-approved rows) is real and still open, deferred for a future
slice — see `SLICE-6W-LOG.md` → `## Deferred — general provenance-journal fix, 2026-09-11`.

Verified: Stage 1 PASSED (hermetic + live create-and-cancel Bluesky canary, nothing left standing).
Stage 2, done for real through Studio's own UI (not CLI): live Schedule click on `bluesky-2`
succeeded (one `POST /api/publishing/schedule`, 200; provider object `cmtxe0dww0004mn81r740iylk`,
first slot Sat Sep 12 6:30 PM PT, confirmed against the unified scheduler's own ledger entry, not
hand-typed) — acceptance items 6-8. Then moved once to a different real slot via
`npm run publish:reschedule --to 2026-09-14T01:30:00.000Z` (dry-run first, listed only this row;
real run `ok:true`, same provider object, new `plannedFor` Sun Sep 13 6:30 PM PT), confirmed in
Studio's own UI after the move — acceptance item 9. `npm run publish:reconcile` ran clean
(`state:"ok"`, exit 0; 0 observations, since the slot has not passed yet) — acceptance item 10's
mechanical half.

Retained: `content/.../review-queue.md` (bluesky-2→approve, uncommitted);
`$TMPDIR/slice-6w/canary.json`.

Next action: wait for the moved slot (2026-09-14T01:30:00.000Z / Sun Sep 13, 6:30 PM PT) to pass,
get Muxin's live confirmation the post is on Bluesky, then `npm run publish:record-evidence`, a
final check of item 12 (no other row changed, exactly one new post), and unsandboxed
`npm run check` to close. Note for closeout: this packet is over the 12,288 B cap — trim then.

## RESULT BLOCK

See `SLICE-6W-LOG.md` → `## RESULT BLOCK — 2026-09-11`.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Extra lanes: none. Serial, because the live account, the rate limit and the human gate serialize
  every step; a second worker would add bookkeeping and no independent result.
- Assignment: one worker, fresh packet-sized context, Claude strongest tier at high effort. Reuse
  the same worker for any repair the live run exposes, so its provider-state context is not lost.
- Evidence return: command, exit code, counts, the row's slug and id, the provider object id, and
  pointers to `$TMPDIR/slice-6w/` artifacts. Never paste the report files into the transcript.
- Capability boundary: closeout runs once, after Stage 2's evidence is recorded. Use completion
  notifications between Stage 1 and the owner checkpoint; do not poll the provider for the moved
  slot to pass.
