# Lane B evidence — 2026-09-02

What this session built, verified, and deliberately did not build, against the room-model
execution order in `docs/content-studio-master-status.md` and the traced gaps in
`docs/content-room-alignment-plan.md`.

**Scope decision, stated before any code was written.** Lane A (P1, P2, items 1 and 2) and lane C
(item 5) are content-generation LOGIC under CLAUDE.md rule 7, and the status doc says plainly:
"No `src/review/jobs.ts` edit should be made until she picks a starting item." Nothing in
`src/review/jobs.ts` was touched. Item 3b (retiring `/cycle`'s drafting step) also holds — it
removes a drafting path, which is a logic change.

Baseline before any edit: `npm run check` unsandboxed, **4,040 tests / 484 suites / 0 failures**.

---

## R1 — `/atomize` writes a `content-request.json`  ✅ done and verified on the real folder

**Why.** `page.ts:1616` (`contentRequestPieces`) filters Content's approve list to pieces where
`originalInput || requestId` is set, and `rows.ts:363-367` sets those three fields only from a
successfully read `content-request.json`. `/atomize` appended review-queue rows and never wrote a
request, so its drafts were counted at step 1 of the room and hidden at step 3.

**Built.** `src/atomize/content-request.ts`, `npm run content-request -- <folder> --brand <brand>`,
called from `/atomize` SKILL.md as new **step 8.5** (and inherited by `--continue` and notes mode,
whose reference file now names steps 2–8.5).

| Requirement | Verified by |
|---|---|
| R1.1 request lands at the same path the Content room reads | `writeContentRequest(folder, …)` is the repo's own writer; test *"writes a request that round-trips through the store's own validation"* |
| R1.2 validates against the existing schema, no new schema | same test — it reads back through `readContentRequest`, which re-runs `buildContentRequest` |
| R1.3 no faked fields | tests *"builds a request from a real atomize folder without inventing configuration"*, *"omits provenance rather than fabricating it when no derivative cites source lines"*, *"drops a non-https canonical url instead of writing an unusable one"*, *"collects and normalizes source_lines, dropping references the schema cannot hold"* |
| R1.4 truthful origin so delivery policy resolves | test *"records the brand's own origin so delivery policy still resolves it"* (`human-inference` / `charles` / `fiction`, matching `brandForOrigin`) |
| R1.5 idempotent, never clobbers Studio work | tests *"re-running refreshes its own request instead of duplicating it"*, *"never clobbers a request written by the Content room"*, *"never clobbers Studio configuration saved onto its own request"* |
| R1.6 the real folder becomes visible | live run, below |
| R1.7 bookkeeping only, changes nothing a run generates | no derivative, score, routing decision or `source_lines` value is read or written by this path |
| R1.8 deterministic coverage + green gate | 11 new tests; full `npm run check` green |

**R1.5 detail.** A Content-room save keeps this writer's id (`mergeContentConfiguration` preserves
`existing.id`), so the id alone cannot distinguish a bare `/atomize` request from one Muxin has
since configured. The writer therefore also refuses to overwrite when the stored request carries
an `approved-cut` provenance, any selected platform/media/treatment, or an enabled control.

**R1.6, the acceptance test, run against the real folder.**

```
$ npm run content-request -- content/2026-09-02-the-world-s-broken-what-do-we-do --brand human-inference
written atomize:2026-09-02-the-world-s-broken-what-do-we-do — … is now visible in the Content room's approve step

$ (listPieces() + page.ts's own filter, run against the real content root)
total pieces: 26 | visible in approve step: 1
target present: true | requestId: atomize:2026-09-02-the-world-s-broken-what-do-we-do
target descriptor: The world’s broken. What do we do?
target visible: true | pending rows: 14
```

Before the change that filter returned **0** pieces. The 14 pending rows named in the plan are now
reachable in the room where Muxin approves them.

The written request records `origin: human-inference`, the verbatim 22,455-character source body,
and `sourceProvenance.kind: "source"` with the 33 distinct `source_lines` its derivatives cite plus
the canonical Substack URL. It selects **no** platform, media or treatment and disables the
untreated control, so it derives **zero** variants — Studio configured and generated none of this
content and the file does not claim it did.

## R2 — item 6, media auto-selection: live check only, two findings  ✅ verified, nothing built

Exercised `recommendSourceDistribution` and the staged media plan against Muxin's real essay
(`content/2026-09-02-the-world-s-broken-what-do-we-do/source.md`, 3,677 words).

```
topic: civic-technology
media recommended:
  static-quote-card  — "the source is long enough to contain a self-supporting line worth preserving verbatim"
  short-video-script — "the source has enough substance for a hook, one developed point, and a conclusion without padding"
platforms requiring media: instagram->image-carousel, tiktok->short-video-script, youtube->short-video-script
```

**R2.1 answer: the mechanism exists and works.** Media type is auto-selected per source with a
reason, pre-checked in the GUI (`page.ts:2991` seeds the media choices from `recommended("media")`),
overridable by hand, and every choice goes through a staged, inspectable plan with an approval
gate before any renderer runs — `configuredMediaPlan` / `configuredMediaStage`
(`src/review/configured-media.ts`). No code change is needed for what item 6 asked about.

**Finding 6a — `image-carousel` can never be auto-recommended for a Substack essay.**
`recommendSourceDistribution` gates the carousel on `words >= 500 && headings >= 3`, counting
headings with `/^#{1,3}\s+/` against the source body. `htmlToText` in
`src/atomize/fetch-substack.ts` emits no markdown headings, so an ingested Substack essay has
**0** by construction — counted on the real body. The carousel is therefore reachable only by
manual override for exactly the sources most likely to want one. Not fixed here: the fix lives in
`fetch-substack.ts`, and emitting headings would shift every line number in `source.md`, which
every derivative's `source_lines` points at. That is a logic change with a real blast radius.

**Finding 6b — `GET /api/content/treatment` returned 400 for every piece.** Fixed; see R2b.

## R2b — the Content room's "decide the treatment" step was broken on `main`  ✅ fixed

`treatment.ts:265` called `loadData()` with no arguments. `loadData` (`src/strategy/route.ts:154`)
requires a `StrategyMeasurementContext` and throws `strategy measurement requires explicit brand
context` without one. `serve.ts:1447` — the only production caller of `readTreatment` — passes no
`data`, so **`GET /api/content/treatment` threw and 400ed for every piece with a pillar on disk.**

Invisible to the 4,040-test gate because every case in `treatment.test.ts` injects `data` through
its `base()` helper, so nothing exercised the default path.

**Fix.** `TreatmentDeps` gains `measurement?: StrategyMeasurementContext`; `readTreatment` refuses a
measured read that has neither injected data nor a brand, with a message that says so, instead of
falling into an unbound `loadData`. `serve.ts` resolves the brand from the piece's own request
origin (`brandForOrigin(request.origin)`), falling back to an explicit `?brand=` parameter, and
400s naming the missing brand if neither is available. No Human Inference default — an unbound
read is exactly what `loadData` refuses.

Verified against the real folder through the endpoint's own code path:

```
resolved brand from request origin: human-inference
pillars: [ 'civic-tech', 'human-ai' ] | pillarSource: routing.md | floor: 0.4
channels: 5 x COLD START, 2 with no label (editorial rule / format asset)
distribution.topic: civic-technology | media: static-quote-card, short-video-script
OK: endpoint payload built
```

Regression test: *"refuses a measured read with no brand instead of calling loadData unbound"*
(`src/review/treatment.test.ts`).

Rule 7: `/api/content/treatment` is a documented read-only endpoint (no ledger write, no queue
mutation) and it currently returns nothing at all, so no old-versus-new content sample is possible.
Self-vet, per the standing rule that a hold requires an evaluable sample.

## R3 — item 3a, retire `/cycle`'s review and publish steps  ✅ done

- `.claude/skills/cycle/SKILL.md`: steps 4 (pending reviews) and 5 (publish) removed; wrap-up
  renumbered to 4 and now points at the Content room. A short "Retired steps" section records why,
  so they are not re-added.
- Step 3 (drafting) **untouched** — that is 3b, it holds, and retiring it would delete the only
  working drafting path. The skill says so explicitly.
- Skill name and description corrected: "the weekly ingest, strategy and drafting loop".
- `README.md` (two places) and `CLAUDE.md`'s pipeline table updated so no document still claims
  `/cycle` reviews or publishes.
- `npm run publish:*`, `/publish` and the Content room all remain reachable; nothing lost a caller.

**Finding 3c, recorded not fixed.** `/atomize` stamps every queue row `from /cycle` as its default
origin regardless of how it was invoked (SKILL.md step 8's origin rule; already noted in
`docs/evidence-base-loop-2026-09-02.md:111`). With `/cycle` no longer owning review, that label is
doubly misleading. It is not fixed here because `QUEUE_ORIGINS` values are parsed by fixed column
position by three separate scripts (`src/publish/queue.ts`), so changing the vocabulary is its own
card.

## R4 — item 4, Studio Start for the other rooms  ⛔ blocked, deliberately not built

`serve.ts:1415` hardcodes `"Content"`; a Fiction/Charles/Venture/Outreach verdict does no server
work and `page.ts:6584-6612` prefills a field that is lost on reload. That gap is real.

It was **not** built, because the durable per-room inboxes it needs are already written and sitting
in held draft PRs waiting on Muxin:

- **#421** "Add Fiction idea inbox and review bridge" — contains `src/fiction/idea-inbox.ts`,
  `src/review/serve-fiction.ts`, and `src/review/page.ts` changes. It *is* the Fiction leg.
- **#423** "Add reviewed Charles persona editing" — contains `src/review/serve-charles.ts` and
  `src/review/page.ts` changes.

Building a Fiction idea inbox or a Charles input endpoint on `main` now would duplicate that work
and conflict with two PRs held under rule 7. **This needs Muxin's decision** on #421/#423 before
item 4 can proceed — that is the open question, not a design question.

## R5 — PR #433 bookkeeping  — see the open questions

#433 ("Partition Strategy and Signals by brand") has an empty body. Reading its diff turned up
something worth Muxin's attention before a body is written for it: **#433's diff adds the
`context?: StrategyMeasurementContext` parameter to `loadData`, which `main` already has**
(`src/strategy/route.ts:153-154`). The brand partition appears to have reached `main` by another
route, so #433 may be wholly or partly superseded rather than merely held. That is a judgment call
about a PR on rule 7's hold list, so it is surfaced, not acted on.

#433 also edits `.claude/skills/cycle/SKILL.md` and `.claude/skills/atomize/SKILL.md`, both changed
in this session; it will need a rebase whatever Muxin decides.

**All four held PRs now conflict with `main`, not just #423** as the status doc said. Tested with
the containment check the status doc itself prescribes:

```
$ git merge-tree --write-tree origin/main origin/<branch>
feature/per-brand-strategy-p2   (#433): CONFLICTS with main
feature/charles-persona-edit    (#423): CONFLICTS with main
feature/outreach-phase5-discovery (#422): CONFLICTS with main
feature/fiction-idea-inbox-p2   (#421): CONFLICTS with main
```

Each needs a rebase before it can be judged. None was rebased here — they are Muxin's to decide on,
and rebasing a held PR silently is not this session's call. Status doc corrected.

## R6 — status-doc reconciliation

`docs/content-studio-master-status.md` updated per its own checklist: the room-model execution
order records 3a and the content-request fix as done, item 6 as verified with its two findings,
item 4 as blocked on #421/#423; the stale "Session state: ten commits unpushed, no PR" line is
corrected.

---

## Gate

`npm run check`, unsandboxed, on the final tree: typecheck clean, **4,052 tests / 484 suites / 0
failures**. Baseline before this session was 4,040/4,040; the 12 added tests are 11 for the atomize
content request and 1 for the treatment brand guard.

## Not done, and why

| Not done | Why |
|---|---|
| Lane A: P1, P2, item 1 (Venture bypass), item 2 (Fiction/Charles variants) | All `src/review/jobs.ts`, all rule 7, and the status doc forbids editing that file until Muxin picks a starting item |
| Lane C: item 5 (`/atomize` capability port) | Same file, same rule, and it collides with lane A |
| Item 3b: retiring `/cycle`'s drafting | Logic change; would delete the only working drafting path before Content can replace it |
| Item 4 | Blocked on held PRs #421 and #423 (above) |
| Finding 6a (`image-carousel` unreachable) | Fix is in `fetch-substack.ts` and would move every `source_lines` number |
| Finding 3c (`from /cycle` origin stamp) | `QUEUE_ORIGINS` is parsed by fixed column position in three scripts |
| Muxin-only decisions | #420 accept/revert, the Postiz approval of a drafted row, the Scout `--theme` sentence, open questions (a)-(d), review of #420-#423 |
