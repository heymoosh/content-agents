# SLICE-7D: a dateless Typefully draft stops being invisible, and stops releasing a live claim

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

A Typefully draft with no `scheduled_date` is currently dropped by `fetchScheduledDrafts` and the
caller is never told. When this slice is done, two things are true:

1. A dateless draft is resolvable by id, so `provider-status-reconciliation` reports what it
   actually is instead of the `unknown` + "human reconciliation is required" string it returns for
   a genuinely missing draft. A reviewer can tell those two apart.
2. `queue-view`'s `--sync` can no longer RELEASE a ledger claim that a dateless draft may be
   sitting behind. Dropping drafts silently makes the live list incomplete while the source still
   reports `ok: true`, and `ok` is the only thing standing between a claim and release.

## Difficulty

easy — the dangerous half is three lines of plumbing into machinery that already exists.

## Depends on

7A, 7B, 7C accepted. No overlap with any of them.

## The defect, precisely

`src/publish/typefully.ts` in `fetchScheduledDrafts`:

```ts
.filter((d) => d.scheduled_date && (d.status === "scheduled" || new Date(d.scheduled_date) > new Date()))
```

A draft with no `scheduled_date` fails the first clause and vanishes. The function still returns
normally, so every caller reads the result as a complete list.

**Consumer A, fails closed, merely unhelpful.** `src/review/provider-status-reconciliation.ts:51`
looks the row up by id with `.find(...)`. A dateless draft is not in the list, so the reader
returns `status: "unknown"` with `reconciliationError: "Typefully scheduled-list absence cannot
distinguish live, canceled, deleted, or failed; human reconciliation is required"`. That string is
true for a deleted draft and misleading for a dateless one, which is right there and readable.

**Consumer B, does NOT fail closed. This is the reason the slice is not cosmetic.**
`src/publish/queue-view.ts` → `listTypefully` returns `{ items, note: null, ok: true }` on a
successful fetch. `reconcile` then decides release eligibility with exactly this line:

```ts
if (srcs.every((s) => ok[s])) claimedNotLive.push(c);
else uncheckable.push(c); // a needed source was unreachable — can't conclude drift
```

`syncLedger` passes `claimedNotLive` straight to `releaseClaims`. So a future ledger claim whose
draft exists but is dateless is classified as an orphan and the claim is REMOVED, freeing the slot
for another run to claim and schedule into.

The file already contains the argument for why this is wrong, at the `DRAFTS_MAX_PAGES` cap a few
lines above the filter: a truncated live list is more dangerous than an unreachable one, because
`reconcile()` trusts a successful return as complete and will release claims it cannot match. That
cap THROWS rather than return a partial list that looks complete. The dateless filter does exactly
what that comment forbids, silently, two lines below it.

## The fix

Reuse the existing incompleteness channel rather than inventing one.

1. `fetchScheduledDrafts` keeps returning only genuinely scheduled drafts (its contract, and
   `queue-view` sorts by time, so do NOT widen `TypefullyScheduled.whenIso` to nullable). Instead
   expose the dropped ones. Preferred shape: a new exported `fetchAllDrafts()` that does the fetch,
   pagination and dedup, with `fetchScheduledDrafts` filtering from it, so there is ONE fetch path
   and no second pagination implementation to drift.
2. `listTypefully` in `queue-view.ts`: when any dateless draft exists, the Typefully live list is
   incomplete, so it must not license a release. Set `ok: false` with an explanatory `note` naming
   the count. Those claims then land in `uncheckable`, which is the existing correct bucket, and
   `--sync` leaves them alone.
3. The typefully reader in `provider-status-reconciliation.ts`: resolve the id against all drafts.
   A found-but-dateless draft reports an honest distinct state rather than `unknown`, and must NOT
   claim to be `scheduled` (it has no time and will not auto-publish). Its message must say the
   draft exists in Typefully and is unscheduled, so a reviewer knows to go set a date rather than
   hunt for a lost post.

Ambiguity still fails closed everywhere: an unreachable Typefully is unchanged, and a draft that is
genuinely absent keeps its existing `unknown` wording verbatim.

## Owned files

Parallel-safe: no — one narrow defect across three files on a single call path; a second lane would
serialize on the same `fetchScheduledDrafts` signature and add handoff cost with no independent
deliverable.

### Lane A — the fix and its proof

- `src/publish/typefully.ts`
- `src/publish/queue-view.ts`
- `src/review/provider-status-reconciliation.ts`
- `src/publish/queue-view.test.ts`
- `src/publish/typefully.test.ts`
- `src/review/provider-status-reconciliation.test.ts`

If a needed test file above does not exist, create it. If the fix demands an edit outside this
list, STOP and report rather than widening scope yourself.

## Do not touch

- `.env` — never read it, write it, or print its values. Not with cat, grep, sed, head, dotenv,
  `--env-file`, or a script. The coordinator owns it. `.env.example` is not yours either.
- No live provider or network calls. No Typefully, Postiz, PostPeer, YouTube or Substack. Stub
  every fetch. A real call to Typefully from a test is an automatic void.
- No writes under `data/`, `~/.content-agents/**`, or `briefs/**`.
- `docs/content-agents-backlog.md`, `docs/operations/launch-slices/evidence/**`.
- `src/review/studio-scheduling.ts` and `src/review/publishing-status.ts` — 7C just landed there.
- Do not commit, stage, push, checkout or stash. The coordinator commits.

## Acceptance

- [ ] There is exactly ONE fetch/pagination/dedup implementation. `fetchScheduledDrafts` derives
      from it rather than duplicating the paging loop.
- [ ] `fetchScheduledDrafts`'s returned shape is unchanged for callers that only want scheduled
      drafts, and `TypefullyScheduled.whenIso` is still a non-nullable string.
- [ ] The `DRAFTS_MAX_PAGES` throw still fires on a truncated list, unchanged.
- [ ] A test proves a dateless draft is excluded from `fetchScheduledDrafts` but IS reachable
      through the all-drafts path.
- [ ] A test proves `listTypefully` reports `ok: false` with a counting note when a dateless draft
      exists, and `ok: true` when none does.
- [ ] A test proves the end-to-end consequence through `syncLedger`: given a future ledger claim and
      a live list whose matching draft is dateless, the claim is NOT released, and appears as
      `uncheckable`. This is the acceptance item the slice exists for; assert on the released list
      being empty, not merely on the `ok` flag.
- [ ] A test proves the converse still works: a genuinely orphaned future claim, with a complete
      live list and no dateless drafts, is STILL released. The fix must not freeze `--sync`.
- [ ] A test proves the typefully status reader distinguishes three cases by id: found and
      scheduled, found but dateless, and genuinely absent. The absent case keeps its existing
      wording byte-for-byte.
- [ ] A found-but-dateless draft is not reported as `scheduled`.
- [ ] No user-facing string gains an em dash or an AI tell (`config/voice.yaml`).

## Verify

Classification: meaningful behavior, medium risk. A wrong change here releases a slot claim that a
real draft is behind, which is how two posts end up in one slot.

Run unsandboxed (`dangerouslyDisableSandbox: true`) — the sandbox produces ~196 phantom venture
failures unrelated to this work.

```
node --import tsx --test src/publish/queue-view.test.ts src/publish/typefully.test.ts src/review/provider-status-reconciliation.test.ts
npm run check
```

## Observable result

`npm run queue -- --sync` no longer silently frees a slot whose Typefully draft exists without a
date, and the Studio row for such a draft says it is unscheduled instead of unknown.

## Risk

medium — audit required: yes. It changes ledger-release eligibility, and a wrong permissive change
frees a claimed slot. Auditor: Grok `grok-4.5`, cross-family. Never a Claude auditor.

## Families

- Builder: Claude
- Auditor: Grok `grok-4.5` — cross-family; Codex capped until 2026-09-15.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results: (exact pass/fail/skip counts, exit codes, sandbox state)
- The release argument: state plainly why a dateless draft can no longer reach `releaseClaims`,
  and name the line that stops it.
- Evidence locations: (new tests by name)
- Unresolved:
- Delivery state: built | verified — workers cannot accept or commit.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline. One lane, fresh context. Report once when
done; do not poll.
