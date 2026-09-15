# Website link builder: build handoff

Created 2026-09-15. Owner: Muxin. Build home: this repo (Content Studio).
Parent status doc: `docs/website-analytics-handoff.md`. Site contract:
`/Users/Muxin/Documents/GitHub/landing-page/docs/website-analytics.md`.

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

## ID mapping (confirm before building)

The report joins back to Studio only if the IDs in the link are the IDs Studio already uses.
Studio lineage has `sourceId`, `cutId`, `variantId`, `treatmentId`, `experimentId` and
`publishId` (see `src/grow/delivery-binding.ts`, `src/grow/experiment-queue-handoff.ts`).

- `utm_content` = Studio `variantId`. Studio's variant ID pattern `^[a-zA-Z0-9][a-zA-Z0-9._-]*$`
  already fits the site rules. Still check the 120-character limit, since generated variant IDs
  (`src/grow/generation-brief.ts`) combine several parts.
- `hi_source_post`: the site contract calls this the stable **source-post** ID. Read the lineage
  code and pick the Studio field that names one post across its variants. `sourceId` is the likely
  match. Write the choice down in this doc. Do not use `publishId`: it does not exist until after
  posting, and the link is needed before posting.

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
