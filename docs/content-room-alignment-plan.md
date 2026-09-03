# Aligning the code with the room model

Written 2026-09-02 after tracing what the Studio, Content, Fiction, Charles and Venture rooms
actually do. Muxin's stated model:

> Each room does its job within its own scope, with a button to move its output into Content.
> Studio routes a capture to the right room. Venture builds the business. Fiction and Charles are
> specific kinds of input needing specific interactions. **Content takes any room's output and makes
> the variations for every platform** — treatments, media (auto-selected, manually tweakable),
> review, approval, publish. That is why the editor belongs on Content: Content is where social
> creation and distribution happen.

Nothing here is approved to build. This is the inventory and a proposed order.

## What already matches the model

- **Room to Content buttons exist and are wired.** `page.ts:4394` (venture), `:5215` (fiction),
  `:5420` (charles) post to `/api/{venture,fiction,charles}/handoff` (`serve.ts:1368`, `:1300`,
  `:1329`). Each scaffolds a real content folder via `scaffoldContentFolder` (`new-content.ts:119`,
  writes `source.md`) and writes a `content-request.json`.
- **A handed-off piece lands at pick-a-source and waits there.** `listContentSessions`
  (`develop.ts:442`) lists any `content/` folder with a `source.md` plus at least one durable
  artifact — a develop session, cuts, pending queue rows, or a content request (`develop.ts:424`).
  A handoff satisfies that, so the piece persists in step 1 until worked. No job queue is needed
  for the behaviour Muxin described.
- **Venture measurement is live.** `venture-experiment-handoff.ts:81` feeds an accepted Venture
  learning evaluation into the Signals `buildExperimentPlan()`
  (`grow/experiment-content-handoff.ts`), mounted at `serve.ts:1341`. Outcome readback runs against
  real data: `serve-signals.ts:64-89` opens `data/analytics.db` and joins published variants to
  impressions, replies, clicks and new-follows by provider object ID and canonical URL
  (`grow/signals-experiment-performance.ts:233-282`), with sample-size gating. Venture posts are
  attributed to the `human-inference` brand — `identity/brand.ts:16` maps `origin: "venture"` there,
  and there is no separate venture brand (`BRAND_IDS`, `identity/brand.ts:2`).

## What does not match, in the order it should be fixed

### 1. Venture ships treated variants with no editor and no character limits

`jobs.ts:793-803` gives Venture its own generation branch. It skips four things the studio path
enforces: the blind cold-feed editor, the platform character limits
(`CONFIGURED_PLATFORM_LIMITS`, checked only at `jobs.ts:484`), `source_lines` traceability
(`parseVentureConfiguredBodies` returns `sourceLines: []`, `jobs.ts:597`), and
`assertReviewedMechanismGenerationAuthorization` (guarded by `if (authoritative)` at
`jobs.ts:665-666`, and Venture resolves to `null`).

This is the only live contradiction of the model today: Venture copy ships under Muxin's own byline
with rule 5 in full force, through the room that is supposed to own the editor gate, without it.

**Change:** route the Venture branch through the same editor pass and the same limit check.

### 2. Fiction and Charles cannot produce platform variations at all

`jobs.ts:608-610` throws on any treated variant for those origins:

> `configured fiction treatments are unavailable: no enforceable restricted transformation exists;
> request an untreated control only`

So the Charles button lands his essay in Content and Content can only emit a byte-exact copy of it.
No platform variations, no editor. This is the largest gap against "Content takes that as an input
and makes the content variations for all the platforms."

The error names its own precondition honestly. Studio work is safe to treat because `source_lines`
bounds a treatment against an approved cut; Charles has no cut, so nothing constrains what a
treatment could invent. The fix is to supply the missing enforceable boundary rather than to remove
the check.

**Change, three parts:**

- **A narrow treatment kind whose boundary is mechanically checkable**: every sentence in the
  treated body must already appear in the approved body. Re-hooking, reordering, trimming and
  splitting for a platform all pass; an invented claim cannot. That is an enforceable restricted
  transformation, which is what `jobs.ts:608-610` says does not exist yet.
- **Un-fuse the editor from provenance.** `jobs.ts:804` gates the editor on
  `treated.length && authoritative?.sourceLines.length`. Fiction and Charles get `sourceLines: []`
  (`jobs.ts:655`) because there is no essay to trace to, so they fall into the no-editor fallback as
  a side effect of having no provenance, not as a decision about scannability. Scannability and
  traceability are separate concerns and need separate conditions.
- **Origin-aware voice rubric.** `muxinVoiceFindings` is called unconditionally at `jobs.ts:428`
  (first pass) and `:486` (editor pass). Charles is explicitly exempt from `config/voice.yaml`
  (CLAUDE.md rule 5) and governed by `charles/config/persona.yaml`; Fiction likewise, with the
  em-dash ban carrying over to both. Without this, the first Charles editor pass throws on his own
  satire.

**Approval sequencing is not a problem.** The control variant stays byte-exact (`jobs.ts:831`), so
the upstream approval in `charles/review-queue.md` still covers exactly what it approved. The
treated variants go through the editor and land `pending` in Content's queue for a second look.
Two artifacts, two approvals, nothing stale.

### 3. Work made by `/cycle` is invisible in Content's approve step

`page.ts:1616` filters the review list to pieces that have a content request. `/atomize` never
writes one (`atomize/SKILL.md:495-524` appends queue rows only), so a `/cycle` run produces drafts
that step 1 counts and step 3 hides. The
`content/2026-09-02-the-world-s-broken-what-do-we-do` folder is the live example: 15 derivatives,
14 pending rows, no content request, nothing visible to approve.

`/cycle` is human-invoked only — nothing in the repo calls it, there is no cron entry
(`src/cron/` holds only `bluesky-mentions.ts`), and its only trace in code is the `"from /cycle"`
provenance string. It predates the room model and duplicates it: its step 3 is `/atomize`, its step
4 is the review queue, its step 5 is publish.

**Change:** retire `/cycle`'s drafting, review and publish steps so all drafting goes through the
Content room. Its ingest and strategy steps (1 and 2) are genuinely useful and have no room
equivalent — keep those, under a name that says what they do.

### 4. Studio Start only does server work for Content

`serve.ts:1415` hardcodes the room string `"Content"`. A Fiction, Charles, Venture or Outreach
verdict does no server work at all: the client switches tab and prefills a text box
(`page.ts:6584-6612`). The router's verdict is real and accurate — the 2026-09-02 evidence run put
15 of 16 captures in the right room — but only one room acts on it.

**Change:** give each room a safe create action for Start, so a routed capture lands as a real item
in that room (a Fiction inbox idea, a Charles input, a Venture note) rather than as text typed into
a field that is lost on reload.

### 5. Content does not own most of "make it for social"

The following exist only in the `/atomize` skill and its scripts, and have no equivalent in
`generateConfiguredContent`:

| Capability | Where it lives now |
|---|---|
| Platform routing gate (`include`/`skip`, cold-start, exploration probes) | `src/strategy/route.ts`, `config/routing.yaml` |
| Pillar tagging and `extracts.md` | `/atomize` step 3, `config/pillars.yaml` |
| Spin angles per platform | `src/atomize/spin.ts`, `config/platforms.yaml` |
| Scoring (native, brand, hook, narrative, resonance, CTA) and the soft gate | `src/atomize/storytelling.ts` |
| Home-brand thread check | `src/atomize/thread-check.ts` |
| `npm run validate` (char/word limits, routing gate, skeleton gate, case gate) | `src/atomize/validate.ts` |
| Per-platform quote-card context captions | `/atomize` step 7 |
| Strategy brief directives (`from_brief`, `directives_applied`) | `/atomize` step 2 |
| Source triage (`frame-native` / `reflective` / `fiction-promo`) | `src/atomize/source-triage.ts` |

Meanwhile the `/atomize` path has no live entry point in the GUI: `addSource()` (`page.ts:6475`) is
defined and never wired to an element, and `buildFormatArg` (`jobs.ts:1512`) has no non-test
callers. The only surviving dispatch into it is `POST /api/notes/pick` (`serve.ts:1691`).

So the social-prep machinery Muxin wants Content to own mostly exists, in a path the Content room
cannot reach.

**Change:** port these into the Content generation path. This is the largest item on the list and
should be broken into its own sequence; platform routing and `validate` are the two with the most
leverage, since routing decides which variants get made at all and `validate` is the gate that
already knows every platform's limits from `config/platforms.yaml` rather than from the hardcoded
table at `jobs.ts:438-440`.

Note the two-sources-of-truth problem to resolve while doing it: `jobs.ts:438-440` hardcodes
character limits and `config/platforms.yaml` `max_chars` holds them as configuration. One of these
should survive.

### 6. Media auto-selection — needs a live check, not a code change yet

Muxin expects the system to auto-select media type with manual override.
`buildConfiguredMediaOutputs` (`jobs.ts:776`) and `configuredMediaPlan`
(`review/configured-media.ts:98-125`) write a staged, inspectable plan per variant with an approval
gate, and the content request carries a `recommendations` block. That appears to be the mechanism,
but it has not been exercised end to end in this worktree. Verify against a real run before
deciding whether anything is missing.

## Rule 7

Items 1, 2 and 5 change what future runs generate. They are content-generation LOGIC and each needs
a draft PR carrying an old-versus-new content sample, not a self-vet merge. Items 3, 4 and 6 are
not logic changes.
