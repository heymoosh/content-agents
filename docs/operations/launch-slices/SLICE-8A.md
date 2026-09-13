# SLICE-8A: Quote cards can schedule to Instagram and Facebook through Studio

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md`. Do not load the repository for context.
Do not commit, stage, push, checkout or stash.

## Goal

An approved `quote-card:instagram` or `quote-card:facebook` image row is scheduled by Studio's
Postiz route into a real free slot (not refused for lack of cadence), proven by stubbed tests.
The 2026-09-02 essay folder gets its typographic quote card rendered and two new pending card rows
(Instagram, Facebook), so Muxin can approve one card for LinkedIn, Bluesky, Instagram and Facebook.
Future `/atomize` runs add Instagram and Facebook card rows alongside the routed platforms.

## Difficulty

easy — config entries, a focused test, skill prose and one content folder. Existing route code
(`postizShape`, `selectDeliveryRoute`) already accepts these destinations.

## Depends on

none

Delivery batch: SLICE-8A only. Implementation. Stop after the RESULT BLOCK.
Owner checkpoint (resolved 2026-09-12 by Muxin):
- Instagram and Facebook cadence matches cards: `posts_per_week: 3`, `slot_days: [Tue, Wed, Thu]`,
  `slot_time_pst: "12:00"`, at most one post per PT day.
- X is dropped for this essay's card (civic-tech and human-ai are `never: [x]`). Do NOT edit the
  existing `quote-card-1-x` row; Muxin discards it herself.
- Human-only: Muxin approves the new rows in Studio after the slice is committed.

## Owned files

Parallel-safe: no. One worker. Lane B's `npm run validate` reads the platform entries Lane A adds,
and the render is about a minute, so a second assignment adds cost without an independent result.

### Lane A — scheduling and generation

- `config/platforms.yaml` — add `instagram` and `facebook` entries with the cadence above,
  `min_reuse_days: 30`, and `max_chars` 2200 (instagram) and 63206 (facebook), matching
  `POSTIZ_MAX_CHARS` in `src/review/studio-scheduling.ts`. First confirm no code treats every
  `platforms.yaml` key as a text or routing platform; if one does, fail closed and report it.
- `config/cta.yaml` — only if CTA placement for these two destinations does not already resolve to
  inline: add `instagram: inline` and `facebook: inline`. Never invent a new placement mode.
- A new or extended `*.test.ts` beside `src/review/studio-scheduling.ts` proving: an approved
  `quote-card:instagram` and `quote-card:facebook` image row routes to Postiz, claims a Tue/Wed/Thu
  12:00 PT slot, respects one per PT day, and places the source CTA. Stub every fetch and the
  slot ledger; no network, no writes under `data/` or `~/.content-agents/`.
- `.claude/skills/atomize/SKILL.md` — steps 7 and 8: card rows go to each routed text platform
  that the card path supports, PLUS `instagram` and `facebook` always (image-only destinations
  routing never targets). Keep routing `never` rules governing the text platforms.
- `config/routing.yaml` — header comment only: note Instagram and Facebook receive card rows,
  never text. No change to `defaults`, `rules` or `thresholds`.

If a write to `.claude/skills/` is refused by permissions, do not work around it; list it under
Unresolved with the exact prose you would add.

### Lane B — the 2026-09-02 folder (after Lane A's config is in place)

- `content/2026-09-02-the-world-s-broken-what-do-we-do/images/quote-card-1.png` (and the `.mp4`
  companion only if the render command writes it by default). Render with
  `npm run render -- --still content/2026-09-02-the-world-s-broken-what-do-we-do --quote quote-card-1`.
  Free, local. Never pass `--with-image`.
- `content/2026-09-02-the-world-s-broken-what-do-we-do/derivatives/quote-card-1-instagram.md` and
  `quote-card-1-facebook.md` — the body of `quote-card-1-linkedin.md` byte for byte, same
  `source_lines`, `cta: source`, `cta_label`, `content_type`, `thread_check`; `platform` set to
  the destination. Drop `spin`/`angle` only if validate rejects them for that platform. No new
  words: extraction-first (CLAUDE.md rule 1).
- `content/2026-09-02-the-world-s-broken-what-do-we-do/review-queue.md` — append two rows after
  `quote-card-1-bluesky`, same shape:
  `quote-card-1-instagram | quote-card:instagram | image | images/quote-card-1.png | 5 | 5 | true | pending | caption from quote-card-1-linkedin | from SLICE-8A`
  and the same for facebook. Status stays `pending`. Touch no other row.

## Do not touch

- `.env`, `.env.example`: read it, write it, or print its values and the slice is void.
- Anything under `data/`, `~/.content-agents/`, `briefs/`, `docs/content-agents-backlog.md`,
  `docs/operations/launch-slices/evidence/**`, `docs/content-studio-master-status.md`.
- `src/publish/postiz.ts`, `src/publish/cards.ts`, `src/strategy/route.ts` unless a test proves a
  defect; then stop and report rather than widen scope.
- No live Postiz, Typefully, PostPeer, YouTube, Substack or dispatch call. Never run `/publish`.

## Cited headings

none

## Acceptance

- [ ] `config/platforms.yaml` has instagram and facebook with exactly the owner cadence.
- [ ] A stubbed test shows both card rows schedule via Postiz into a Tue/Wed/Thu 12:00 PT slot,
      one per PT day, with the source CTA placed; it fails before the config change.
- [ ] Nothing else that reads `platforms.yaml` changed behavior (full `npm run check` green).
- [ ] Atomize skill prose and the routing header describe the new card rows (or Unresolved).
- [ ] `images/quote-card-1.png` exists and was rendered locally with no paid call.
- [ ] Two new pending rows and derivatives; captions byte-identical to the LinkedIn body;
      `npm run validate` on the folder passes.
- [ ] No em dashes in any new user-facing string.

## Verify

Classification: meaningful behavior (scheduler config and content-generation prose). Full gate.

```
node --import tsx --test src/review/studio-scheduling*.test.ts
npm run validate -- content/2026-09-02-the-world-s-broken-what-do-we-do
npm run check
```

Run unsandboxed. Record exits and pass/fail/skip counts.

## Observable result

Studio's review queue for the 2026-09-02 essay shows the rendered card with pending rows for
LinkedIn, Bluesky, Instagram and Facebook.

## Risk

medium — audit required: yes. It changes which channels future card rows target and adds
scheduler cadence for two live destinations.
Review boundary: this candidate. Review scope: the diff, changed-file list and check output.
On reviewer outage: candidate blocked, not integrated.

## Families

- Builder: Claude (Sonnet 5)
- Auditor: Grok `grok-4.5`, cross-family. Codex capped until 2026-09-15. Never a Claude auditor.

## RESULT BLOCK

- Changed paths: config/platforms.yaml (instagram, facebook cadence + max_chars), config/routing.yaml
  (header comment), .claude/skills/atomize/SKILL.md (steps 7c, 8), review-queue.md (2 pending rows),
  derivatives quote-card-1-instagram.md and quote-card-1-facebook.md, new
  src/review/studio-scheduling-instagram-facebook.test.ts. Rendered images/quote-card-1.png and .mp4
  (gitignored, local).
- Coordinator-authorized fixture changes: src/review/jobs.test.ts (instagram now pinned to 2200 and
  facebook to 63206, since loadPlatformMax maps a present entry without max_chars to Infinity) and
  src/review/studio-scheduling-postiz-reuse.test.ts (facebook no-slot test pre-fills the ledger;
  assertions byte-identical).
- Incidents: the first version of the new test did not isolate CONTENT_AGENTS_TEST_BETS_PATH and
  wrote 14 fake placed rows to briefs/human-inference/bets.md. The test is fixed and the coordinator
  removed the rows (file back to HEAD). The worker ran git stash/stash pop (forbidden), which left
  platforms.yaml staged; content was correct.
- Checks: focused suites 232/0; npm run validate exit 0 (17 derivatives); npm run check 4574/0.
- Audit: Grok grok-4.5 BLOCKING on 2 items, both resolved by the coordinator: (1) the two new rows
  were `approve` from an early click, reset to `pending` so Muxin re-approves in Studio, which is the
  only thing that schedules; (2) missing evidence, supplied above. Deviations judged honest.
  Non-blocking: em dashes in SKILL.md and routing.yaml comments (not user-facing).
- Delivery state: accepted and committed by the coordinator. Next: Muxin approves instagram, facebook,
  linkedin, bluesky card rows and discards the x row; then verify the schedule.
