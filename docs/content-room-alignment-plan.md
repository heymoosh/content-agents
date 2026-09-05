# Aligning the code with the room model

> **Design/reference only — status and decisions live in**
> [`docs/content-studio-master-status.md`](content-studio-master-status.md). **Do not use this
> document's historical “approved”, “done”, PR, or sequencing prose as current status.** The next
> action is always in the master's **START HERE** section. Read §5 and
> §Dependencies and running order here only when that handoff directs you to them. Do not maintain
> a second current-slice pointer in this design specification.

Written 2026-09-02 after tracing what the Studio, Content, Fiction, Charles and Venture rooms
actually do. Muxin's stated model:

> Each room does its job within its own scope, with a button to move its output into Content.
> Studio routes a capture to the right room. Venture builds the business. Fiction and Charles are
> specific kinds of input needing specific interactions. **Content takes any room's output and makes
> the variations for every platform** — treatments, media (auto-selected, manually tweakable),
> review, approval, publish. That is why the editor belongs on Content: Content is where social
> creation and distribution happen.

This is the inventory and design rationale. The master status document determines authorization,
current completion, and execution order.

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

### 1. Content does not always run the editor — Venture has a bypass branch inside it

**Decided 2026-09-02 (Muxin):** Venture's job is to send its work into Content (directly, or via a
Signals experiment that then sends it to Content), and **Content always runs the editor**. The code
does not do that today, so this is a bypass to delete rather than a design to change.

`jobs.ts:793-803` gives Venture its own generation branch *inside* `generateConfiguredContent`. It skips four things the studio path
enforces: the blind cold-feed editor, the platform character limits
(`CONFIGURED_PLATFORM_LIMITS`, checked only at `jobs.ts:484`), `source_lines` traceability
(`parseVentureConfiguredBodies` returns `sourceLines: []`, `jobs.ts:597`), and
`assertReviewedMechanismGenerationAuthorization` (guarded by `if (authoritative)` at
`jobs.ts:665-666`, and Venture resolves to `null`).

This is the only live contradiction of the model today: Venture copy ships under Muxin's own byline
with rule 5 in full force, through the room that is supposed to own the editor gate, without it.

**Change:** route the Venture branch through the same editor pass and the same limit check every
other origin gets. Venture keeps its scoped tracing exception (`claim_refs` instead of
`source_lines`, CLAUDE.md rule 1) — that exemption is from tracing, not from the editor.

### 2. Fiction and Charles cannot produce platform variations at all

**Decided 2026-09-02 (Muxin):** Content should apply good hooks and storytelling to Fiction and
Charles work like anything else, but it must **retain the voice and the point of its original
input**. Content has to know it is handling a Charles or a Fiction source so it does not
over-flatten the piece with generic platform optimization.

"Cannot produce variations" is literal, not a judgment call: `jobs.ts:608-610` throws on any treated
variant for those origins:

> `configured fiction treatments are unavailable: no enforceable restricted transformation exists;
> request an untreated control only`

So the Charles button lands his essay in Content and Content can only emit a byte-exact copy of it.
No platform variations, no editor. This is the largest gap against "Content takes that as an input
and makes the content variations for all the platforms."

The error names its own precondition honestly. Studio work is safe to treat because `source_lines`
bounds a treatment against an approved cut; Charles has no cut, so nothing constrains what a
treatment could invent. The fix is to supply the missing enforceable boundary rather than to remove
the check.

**Change, four parts:**

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
- **Separate editors, one per source kind — not one editor told to switch personality.**
  (Muxin, 2026-09-02.) There is one editor today: `configuredColdFeedEditorPrompt`
  (`jobs.ts:443-461`), a single function with `config/voice.yaml` written into it as a literal
  instruction line, called for every origin. Run unchanged over Charles it flattens a satirical
  persona into optimized copy that passes every check and loses the thing worth publishing.
  The fix is **not** a conditional prompt: a prompt carrying several voice contracts and a rule for
  choosing between them is one editor with multiple personalities, and it will blur them.
  Instead, an **editor registry**: a named editor per source kind, each a complete and independent
  instruction set written for its own focus — a Fiction social editor, a Charles social editor, a
  Venture social editor, and today's prompt moved in unchanged as the Studio/Human-Inference one.
  Each registry entry owns three things: its full prompt, its own voice rubric (Charles's is
  `charles/config/persona.yaml`, not `config/voice.yaml`; the em-dash ban carries over to every
  one), and its own `editor_pass:` stamp, so a derivative's frontmatter records which editor made
  it rather than today's single `cold-feed-v1` (`jobs.ts:840`). Selection defaults from
  `request.origin` and stays choosable.
  This replaces the separate "origin-aware voice rubric" bullet above as a mechanism: the rubric
  is no longer a branch inside a shared validator, it is a property each editor carries.

**Approval sequencing is not a problem.** The control variant stays byte-exact (`jobs.ts:831`), so
the upstream approval in `charles/review-queue.md` still covers exactly what it approved. The
treated variants go through the editor and land `pending` in Content's queue for a second look.
Two artifacts, two approvals, nothing stale.

### 3. Work made by `/cycle` is invisible in Content's approve step

**Fixed 2026-09-02** — `/atomize` now writes the request at step 8.5
(`npm run content-request`), and the live folder below is visible again. The description below is
the state it fixed; keep it for the reasoning, not as current behavior.

`page.ts:1616` filters the review list to pieces that have a content request. `/atomize` did not
write one (`atomize/SKILL.md:495-524` appended queue rows only), so a `/cycle` run produced drafts
that step 1 counted and step 3 hid. The
`content/2026-09-02-the-world-s-broken-what-do-we-do` folder was the live example: 15 derivatives,
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

## Dependencies and running order

All six items are agreed work; there is no priority order among them by preference (Muxin,
2026-09-02). What follows is the order the code forces, and what can genuinely run at the same
time.

### Two prerequisites that are cheap and block the rest

- **P1 — one source of truth for platform limits.** `jobs.ts:438-440` hardcodes
  `CONFIGURED_PLATFORM_LIMITS` and `config/platforms.yaml` holds `max_chars` as configuration.
  This must be settled **before** item 1, because item 1 wires Venture into the limit check and
  doing that against the hardcoded table entrenches the wrong source of truth in a second place.
  `config/platforms.yaml` should win; it is what `validate.ts` already reads.
- **P2 — the editor registry and un-fusing the editor from provenance.** Items 1 and 2 both need
  the editor to run for an origin that has no `source_lines`, and both need an editor chosen by
  source kind. That is the registry above plus splitting the `jobs.ts:804` gate
  (`treated.length && authoritative?.sourceLines.length`) into its two separate questions. Building
  it once, first, is the difference between one change and the same change made twice
  incompatibly.

### The forced chain

```
P1 -> P2 -> item 1 (Venture)  -> item 2 (Fiction/Charles)
              \-> item 5 port sequence -> item 3b (retire /cycle drafting)
```

- **Item 1 after P2**, not before: deleting the Venture branch at `jobs.ts:793-803` drops Venture
  through to the `:804` gate, which is false for it (`resolveConfiguredAuthoritative` returns
  `null` for Venture), so without P2 the bypass is replaced by a different bypass.
- **Item 2 after item 1** only because both rewrite the same region of `jobs.ts`. They are
  independent in design and serial in merge. Item 2 additionally needs its own new piece — the
  mechanically checkable restricted treatment kind — which nothing else blocks and which can be
  written and tested while item 1 is in review.
- **Item 3 splits.** `/cycle`'s review and publish steps duplicate what the Content room already
  owns and can be retired immediately, dependent on nothing (**3a**). Its drafting step cannot be
  retired until Content can do what `/atomize` does, so **3b depends on the item 5 port**. Retiring
  drafting first would remove the only working path.
- **Item 5 is its own sequence**, roughly: routing gate (decides which variants get made at all),
  then `validate`, then the remaining seven capabilities, which are largely independent of each
  other once the first two land.

### What is genuinely parallel

| Lane | Work | Touches | Notes |
|---|---|---|---|
| A | P1, P2, item 1, item 2 | `src/review/jobs.ts` | Strictly serial within itself: one file, one region. |
| B | item 4 (Studio Start), item 6 (media check), 3a, and the `/atomize` content-request fix below | `serve.ts`, `page.ts`, skills, verification | No overlap with lane A at all. Fully parallel. Start item 6 first — it is verification with no code, it is cheap, and it may change item 5's scope. |
| C | item 5's port sequence | `src/review/jobs.ts` generation path | **Collides with lane A on the same file.** Run C after lane A rather than beside it, or split the generation module before starting either. |

So: two lanes safely in parallel (A and B), with C queued behind A. Not three.

### One small independent fix worth doing early — DONE 2026-09-02

`/atomize` wrote no `content-request.json`, which was the whole reason the 14 pending rows in
`content/2026-09-02-the-world-s-broken-what-do-we-do` were invisible in Content's approve step
(`page.ts:1616`). It now writes one at step 8.5, on the default, `--continue` and `notes` paths.
See `docs/evidence-lane-b-2026-09-02.md`.

## Rule 7

Lane A (P1, P2, items 1 and 2) and lane C (item 5) change what future runs generate. They are
content-generation LOGIC: each needs a draft PR carrying an old-versus-new content sample, not a
self-vet merge. Lane B is not logic — item 4, item 6, 3a and the content-request fix change
routing, verification and bookkeeping, not what a run produces — with one exception: **3b**, which
removes a drafting path, is a logic change and holds.
