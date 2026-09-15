# Website link builder: build handoff

Created 2026-09-15. Owner: Muxin. Build home: this repo (Content Studio), worktree
`/Users/Muxin/Documents/GitHub/content-agents-worktrees/mp-1`, branch `mp-1/mission-posts`.
Parent status doc: `/Users/Muxin/Documents/GitHub/content-agents-worktrees/mp-1/docs/website-analytics-handoff.md`.
Site contract: `/Users/Muxin/Documents/GitHub/landing-page/docs/website-analytics.md`.

## Handing off to a new session — read this first

**Not done.** v1 core (pure function + Studio panel + tests) works and is verified. Two items
from the original spec are still open, confirmed by a second independent audit (Grok 4.6) that
re-checked the live code, not just the diff:

1. **Prefill-and-lock is unimplemented** — the spec-required behavior where opening the link
   builder from an existing Studio post/variant should prefill and lock the real variant ID and
   source-post ID. Blocked on missing plumbing, not a UI bug — see "Why gap 1 is blocked" below.
2. **Live round-trip check never run** — open a generated link on the live site, wait for the
   60-second report cache to expire, run Studio's website refresh, confirm a row appears tagged
   `link-builder-test`. This is a manual owner action, not code.

Files to open first in the new session:
- This doc (status + why blocked).
- `/Users/Muxin/Documents/GitHub/content-agents-worktrees/mp-1/src/review/website-link-builder.ts`
  (the shipped pure function — no known issues, do not need to touch for gap 1).
- `/Users/Muxin/Documents/GitHub/content-agents-worktrees/mp-1/src/grow/delivery-binding.ts`
  (where `GrowDeliveryBindingLineage` — the real IDs gap 1 needs — is built and discarded).
- `/Users/Muxin/Documents/GitHub/content-agents-worktrees/mp-1/src/review/signals-experiment-plan-store.ts`
  and `/Users/Muxin/Documents/GitHub/content-agents-worktrees/mp-1/src/review/serve-signals.ts`
  (where the prefill button is currently wired to the wrong IDs).

### Why gap 1 is blocked

`GrowDeliveryBindingLineage` (real `sourceId`/`variantId` per the "ID mapping" section below) is
built in-memory during Grow's delivery pipeline and never persisted anywhere keyed by
`experimentId`. No Studio read path — not the Signals "Experiments and learnings" tab, not the
Venture handoff cards — has access to those real IDs today. Two options, undecided:

- **Option A (matches spec):** add a lineage store keyed by `experimentId`, write to it once from
  the Grow delivery pipeline, read from it in Studio to prefill. Real fix, more plumbing.
- **Option B (pragmatic descope):** wire the prefill button to whatever IDs Studio's own screens
  already display (content-request id + Studio's own variant id) instead of Grow's lineage IDs.
  Ships immediately, but the linked website report rows would then key off a different ID than
  the "ID mapping" section specifies, and nothing currently downstream reads that mapping to
  notice — no auto-publish path consumes these tags yet, it's copy-paste by hand.

This is an owner decision (which ID convention the website-report join should actually use), not
something to resolve unilaterally in a follow-up session — flag it back to Muxin before picking
one.

## Status — 2026-09-15: v1 shipped, two gaps remain

- `src/review/website-link-builder.ts` has the pure `buildWebsiteLink()` function and
  `src/review/website-link-builder.test.ts` covers every "Done when" unit-test bullet below,
  including the site-rule round-trip test. All pass locally (`npm run typecheck`, targeted
  `node --import tsx --test`).
- The Studio panel is live in the Signals room ("What we know" tab), built in
  `src/review/page-link-builder.ts` and wired into `src/review/page.ts`: destination field
  (paste a full URL or a `/essays/<slug>` path), platform/medium dropdowns with a free-text
  "Other…" option, campaign/variant ID/source-post ID fields, a Build button, inline field
  errors, and a Copy button. Nothing is sent to a server; `buildWebsiteLink` runs client-side.
- **Gap: prefill-and-lock still isn't real, on a second Grok 4.6 audit.** A same-day fix added a
  "Build a tagged link for this" button to `signalsHandoffMetaHtml` (`src/review/page.ts`) gated
  on `sourceId`/`variantId` being present. That gate is structurally correct but the data behind
  it isn't: `SignalsExperimentPlanRead` (`src/review/signals-experiment-plan-store.ts`) — what the
  "Experiments and learnings" tab actually renders — has no `sourceId`, no top-level `variantId`,
  and no `lineage` field at all, so the button never appears there in practice (lineage always
  reads "not recorded"). The only cards where the button can appear are Venture handoff cards
  (`signalsVentureHandoffsHtml`, `src/review/serve-signals.ts`), and those set `sourceId` to
  `plan.contentRequest.id` and `variantId` to `row.primaryComparison.treatment.variantId` — a
  Content-request id and a performance-row id, not `GrowDeliveryBindingLineage.sourceId` /
  the queue's `safeId()`-validated `variantId` that the "ID mapping" section below actually
  specifies. Root cause: `GrowDeliveryBindingLineage` (`src/grow/delivery-binding.ts`) is built
  in-memory during Grow's delivery pipeline and is never persisted to a store keyed by
  `experimentId`, so nothing upstream of the render call has the real lineage IDs to pass down —
  this needs new plumbing (a lineage store or lookup), not a UI fix, and no Studio surface
  displays the real lineage IDs today. The original "what's this?" answer this doc's first
  version disputed was right; the first Grok audit's fix for it was not — caught by asking Grok
  to re-verify its own prior fix against the real payload shape instead of trusting the diff.
- **Gap, deliberately out of v1:** no essay picker reads `landing-page/site/src/content/essays/*.md`
  — the doc's own escape valve ("a pasted URL alone is fine for v1") was used, since Studio's
  server has no existing reach into the sibling repo's content folder.
- **Bug caught and fixed same day (Grok 4.6 audit):** the panel's Build button was originally dead
  in the browser. `page.ts` embeds `buildWebsiteLink` via `.toString()`, which copies only the
  function's source text, not the module-level constants (`ALLOWED_HOST`, `TAG_FIELDS`, etc.) it
  closed over — calling it threw `ReferenceError: ALLOWED_HOST is not defined`. Unit tests never
  caught this because they import the module directly rather than going through the
  `.toString()` embed. Fixed by making the function fully self-contained (all constants declared
  inside its own body, matching this file's existing convention for every other `.toString()`-
  embedded function). Also fixed in the same pass: the Copy button's clipboard-missing fallback
  threw instead of falling back, because `navigator.clipboard?.writeText(...)` returns `undefined`
  when unsupported and `.then()` on `undefined` throws outside the optional-chain.
- **Not done, owner action:** the "Done when" live check — open a generated link on the live
  site, run the Studio website refresh after the report cache expires, confirm a row appears with
  a `link-builder-test` campaign.
- Optional recording of generated links against a Studio variant (item 3 in "What to build") was
  skipped — it needs a new store, which the doc says to skip if not cheap.

## In plain words

When we share a link to humaninference.ai in a social post, email or Substack note, the link
needs a few labels on the end. The website report uses those labels to show which post brought
each reader and whether they subscribed. Right now nobody adds the labels because doing it by hand
is fiddly and easy to get wrong.

Build a small tool in Content Studio: pick the site page and the post, get back the labeled link
to copy. When the post already exists in Studio, fill the labels in from Studio's own IDs so the
website report can be matched back to that post later.

Links between pages on the site and the essays themselves do not need labels. Only links that
point to the site from somewhere else do.

## Background (already shipped, do not rebuild)

- The site (`landing-page`, release `v2026.09.15`) reads these query parameters on arrival and
  keeps them for the 30-minute browser session. Signups in that session are credited to them.
- Content Studio's website refresh (`src/review/website-refresh.ts`) already pulls the private
  aggregate report. Report rows are grouped by `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_content` (variant ID), `hi_source_post` (source-post ID) and landing path.

## The link format (must match exactly)

```text
https://humaninference.ai/essays/<slug>?utm_source=<platform>&utm_medium=<medium>&utm_campaign=<campaign>&utm_content=<variant-id>&hi_source_post=<source-post-id>
```

| Parameter | Meaning | Examples |
|---|---|---|
| `utm_source` | Platform the link is posted on | `linkedin`, `x`, `threads`, `bluesky`, `substack`, `email` |
| `utm_medium` | Kind of distribution | `social`, `email`, `newsletter` |
| `utm_campaign` | Campaign or series | `magic-outcomes` |
| `utm_content` | Stable variant ID (one per written version of a post) | Studio `variantId` |
| `hi_source_post` | Stable source-post ID | See "ID mapping" below |

Site-side rules (from `landing-page/site/src/scripts/analytics-context.js`). The builder must
enforce them, because the site **silently drops or truncates** anything else:

- Allowed characters: `A-Z a-z 0-9 . _ ~ : / -`. No spaces, no `&`, `?`, `#`, `=`, `%`.
  A value with any other character is thrown away, not cleaned.
- Maximum 120 characters per value. Longer values are cut to 120 before the check, so two long
  IDs can collapse into one. Reject values over 120; do not trim.
- Use lowercase for `utm_source`, `utm_medium` and `utm_campaign` so `LinkedIn` and `linkedin` do
  not become two rows. Keep IDs exactly as Studio stores them.
- Only `humaninference.ai` destinations are measured. Reject other hosts.

## What to build (v1)

1. **A pure function**, e.g. `buildWebsiteLink(input) -> { url } | { errors }`, with unit tests.
   - Input: destination URL or site path, platform, medium, campaign, variant ID, source-post ID.
   - Use the `URL` API. Keep the destination path. Drop an existing `#hash`. Replace any existing
     `utm_*` / `hi_source_post` values instead of duplicating them. Keep other existing query
     parameters.
   - Return field-level errors for bad host, bad characters, over-length values and missing
     required fields. All five labels are required in v1.
2. **A small Studio UI panel** where the owner makes a link and copies it.
   - Destination: pick an essay or paste a site URL. Essays live in
     `landing-page/site/src/content/essays/*.md`; the URL is `/essays/<filename without .md>`.
     If reading the sibling repo is awkward in Studio's runtime, a pasted URL alone is fine for v1.
   - Platform and medium: dropdowns with the examples above, plus a free-text option that is
     lowercased and validated.
   - When opened from an existing Studio post or variant, prefill the variant ID and source-post
     ID from its lineage and lock them. Opened on its own, let the owner type them.
   - Show the finished link, a Copy button and inline errors. Nothing is sent anywhere.
3. **Optional, only if cheap:** record each generated link against its Studio variant so the
   website report rows can be joined back to the post. Skip it if it needs a new store.

## ID mapping (confirmed 2026-09-15)

The report joins back to Studio only if the IDs in the link are the IDs Studio already uses.
Studio lineage has `sourceId`, `cutId`, `variantId`, `treatmentId`, `experimentId` and
`publishId` (see `src/grow/delivery-binding.ts`, `src/grow/experiment-queue-handoff.ts`).

- `utm_content` = Studio `variantId`, specifically the queue/lineage `variantId` validated by
  `safeId()` in `src/grow/experiment-queue-handoff.ts` (pattern `^[a-zA-Z0-9][a-zA-Z0-9._-]*$`,
  a strict subset of the site's allowed charset). This is **not** the pipe-delimited id built by
  `variantId()` in `src/grow/generation-brief.ts` — that spec-only id can contain `|`, `=` and `&`
  and can exceed 120 characters, so it must never be pasted straight into a link. The link
  builder's own 120-character and charset checks still apply to whatever `variantId` value is
  typed in, since nothing upstream enforces the length limit.
- `hi_source_post` = Studio `sourceId` (`GrowDeliveryBindingLineage.sourceId`, set once per
  `GrowExperimentProposal` from `proposal.source.id`). It is the field that stays constant across
  every variant produced from the same source content, matching the site contract's "stable
  source-post ID" definition. Do not use `publishId`: it is `null` until after posting, and the
  link is needed before posting.

## Out of scope for v1

- Automatically rewriting links inside drafts or scheduled posts (Postiz, Typefully, queue rows).
  This is a sensible next step, but it changes publishing content and needs an owner decision.
- Link shorteners, QR codes, or any third-party analytics.
- Changes to the landing-page site or the report endpoint.

## Done when

- Unit tests cover: a clean build; an existing query string and hash; replacing existing tags;
  rejecting a non-humaninference.ai host; rejecting bad characters; rejecting a value over 120
  characters; normalizing platform case.
- A round-trip test proves every generated value survives the site's rules: copy the
  `SAFE_TAG_PATTERN` and 120-character limit into a test fixture, or import them if the repos
  are linked.
- The owner can open the panel, make a link for a real essay and copy it.
- The ID mapping decision above is filled in.
- One manual check: open a generated link on the live site, run the Studio website refresh after
  the 60-second report cache expires, and see a row with those labels. Use a clearly fake campaign
  such as `link-builder-test` so it is easy to ignore later.
- `docs/website-analytics-handoff.md` gets a one-line status update pointing here.
