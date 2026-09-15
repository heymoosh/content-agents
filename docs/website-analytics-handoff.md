# Human Inference website analytics: current handoff

Updated 2026-09-15. Implementation home: `/Users/Muxin/Documents/GitHub/landing-page`.
Keep this as the running requirement/status list; update it in place as work ships.
No paid analytics, paid upgrades, new billing, or production deployment authorized by this document.

## Outcome

Answer three questions: What brings interested people here? What converts them into subscribers?
What problems and desired outcomes do those readers report?
Use existing content as well as the six Magic Outcome posts. Do not require an exact experimental
match to learn from historical content, or confuse historical engagement with proof of a hypothesis.

## What we know now

- The last read-only production snapshot has 166 subscriber records, 165 active subscribers,
  and zero saved survey completions. These are stock totals, not new website conversions.
- Muxin clarified that these subscribers were imported from Substack. The empty survey result is
  therefore expected for that imported cohort, not evidence of a broken survey or reader rejection.
  This is owner-reported import provenance, not a per-row classification verified by this session.
- `site/api/essays-subscribe.ts` stores subscriber/source and survey fields. It upserts by email;
  repeated submissions and reactivations must not count as new acquisition. Survey answers can
  change, so latest answers and first completion need distinct treatment.
- Content Studio can refresh aggregate subscriber/survey counts from the database read-only, and
  its configured analytics path can now display the saved website funnel report and diagnostic
  form-flow counters. No live refresh has been run, so the report still has no collected website
  rows in this session.
- Historical website traffic cannot be reconstructed unless an existing analytics source captured
  it. Inspect what is already installed before adding anything. Missing data stays unknown, not zero.
- The landing-page implementation now has a first-party collector for page views, 30-minute
  browser sessions, referrer host, and UTM/source-post attribution. It also records server-backed
  new-signup and first-survey outcomes with idempotent event IDs, plus typed newsletter/survey
  attempt signals. Content Studio now has a server-side reader and aggregate dashboard renderer,
  pending deployment and live refresh.

## Running list

| Priority | Question / measure | Definition and useful breakdown | Status / next step |
|---|---|---|---|
| First | Where do readers arrive? | Sessions and essay/landing-page views by date, page, referrer and tagged source/platform. Sessions are not unique people. | Implemented locally in `landing-page`; Content Studio can render the saved aggregate rows after a configured refresh. Deployment and live collection remain. |
| First | Which posts bring readers? | Campaign + stable source-post and variant IDs on incoming links; connect each variant to its source, platform and optional hypothesis. | `utm_content` is the stable variant ID and `hi_source_post` is the stable source-post ID. Tag contract is documented in `landing-page/docs/website-analytics.md`; Studio mapping and future tagged-link rollout remain. |
| First | Which visits lead to new signups? | Successful new website subscriptions, excluding imports, duplicates, existing subscribers and reactivations. Group by acquisition source, landing page and campaign/variant where known. | Implemented locally: the server writes one deterministic `signup_success` event only for a new website row. `subscriber_origin` defaults to `unknown`; existing import rows need verified owner classification. |
| First | What is the signup conversion rate? | Sessions with a successful new signup / measured eligible sessions, using the same time range and attribution scope. Show numerator and denominator. | The private report returns measured sessions, new-signup sessions, numerator/denominator-based rate, and session coverage gaps; the Studio dashboard now renders these rows. Deployment and live collection remain. |
| First | Do people complete the survey? | First successful completion / eligible new-signup cohort, with a stated follow-up window. Separately report imported subscribers who later answer. | Implemented locally with `survey_first_completed_at`, one idempotent first-completion event, a 14-day website cohort, and separate imported/unknown counts. Legacy first-completion history is not invented. |
| First | What do readers want? | Counts and shares of each saved survey choice, segmented by acquisition cohort/source where useful; show response count and unanswered fields. | The private report returns aggregate categories, response/unanswered counts and shares; free-text Other values are bucketed. Studio now renders the normalized categories without raw answers. |
| Next | Where is the flow failing? | Signup attempts versus successful saves; survey starts versus completions; aggregate validation/server errors. | Implemented locally: typed newsletter form starts/submits and survey starts are included as diagnostic client signals, while saved signup/survey outcomes remain authoritative. Deployment and live collection remain. Never log form bodies or identifiers. |
| Next | Does interest persist? | New subscribers, reactivations and unsubscribes per period; net audience change shown separately from imports. | Current active count exists; historical changes need dated events, not guesses from today's snapshot. |
| Later | Which content sends people toward tools/products? | Explicit CTA clicks to existing destinations. Later add verified activation, qualified requests and purchases only when those flows exist. | Not a prerequisite for this test. No offer means sales conversion is not applicable, not a failed funnel. |

Platform, format and publish time are dimensions of these measures, not separate research projects.
Publication metadata belongs in Content Studio and joins by stable variant ID; website visit time
is not publish time. Compare equal observation windows and show sample sizes. Do not call a
platform, time slot or hypothesis a winner from a few conversions or unequal exposure.

## Free tool approach

**Original suggested default: GA4 Standard for traffic/session reports, existing website Postgres
for authoritative saved subscriptions and survey completions.** This session chose a small
first-party Postgres collector instead, so attribution and authoritative saved outcomes share one
server-side event contract without adding a third-party tracker. GA4 is not installed; it remains
an optional owner decision.
Avoid Analytics 360, paid connectors, BigQuery billing and extra services for this first build.
Sources: [Google's free Standard property guidance](https://support.google.com/analytics/answer/11828307),
[Data API reports](https://developers.google.com/analytics/devguides/reporting/data/v1/basics).

If a simpler traffic-only option is preferred, [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/)
is free and can be used without changing DNS. It is an alternative, not a second required tracker;
do not assume it supplies the custom conversion funnel or Studio export we need without checking.
Existing database/hosting usage can still have limits or costs. Check current allowance before
adding event volume; free analytics does not authorize infrastructure spending.

## Small implementation contract

1. Inspect the current website instrumentation and import process. Preserve existing subscriber
   timestamps and records. Classify historical origin only from verified import evidence; otherwise
   use `unknown`. Do not manufacture historical conversions.
2. Start collecting page/session data and successful signup/survey outcomes. Use stable event IDs
   and idempotency so retries do not double-count. Keep import and reactivation separate.
3. Tag outbound campaign links with `utm_source`, `utm_medium`, `utm_campaign` and `utm_content`
   (stable variant ID). Keep source-post/hypothesis mapping in Studio. Use a documented same-session
   attribution rule initially; preserve missing attribution honestly. Google's
   [campaign URL guidance](https://support.google.com/analytics/answer/10917952) describes these tags.
4. Expose a private, read-only aggregate report for Studio, with date range/timezone, capture time,
   source, metric definitions, cohort/source/page/campaign breakdowns, counts and coverage gaps.
   Cache bounded refreshes and protect brand boundaries. Never expose DB credentials to the browser.
5. Check one disposable signup-to-survey path, duplicate/retry behavior, and import exclusion.
   Use fixtures or an isolated test database, not fake production subscribers or real email sends.
   Deployment and account setup remain explicit owner actions in the dedicated website session.

Privacy: minimize collection; no email, name, free-text survey answers, token-bearing URLs or
subscriber IDs in third-party analytics or Studio exports. Review consent/privacy behavior before
enabling a tracker. Do not use fingerprinting to fill tracking gaps. Client blocking and incomplete
tracking must remain visible alongside server totals. No session replay or heatmaps needed.

## First useful Studio report

One table: **source/platform → landing content → measured sessions → new signup sessions →
signup rate → survey completions**. Add a separate panel for audience needs and a coverage note
with newsletter form starts/submits and survey starts clearly labeled as diagnostic client signals.
Show total existing audience separately. Offer requests, sales and revenue can wait until an offer exists.

Next action: run the first website-measurement refresh from Content Studio and confirm the report
renders. Use the campaign link convention in `landing-page/docs/website-analytics.md` for future
posts; a Studio link builder is specified in `docs/website-link-builder-handoff.md`. See the 2026-09-15 status below for what shipped.

## Shipped — 2026-09-15

- Studio link builder v1 shipped: a pure tagging function plus a panel in the Signals room, unit
  tested. **Not fully done** — two gaps remain open and unresolved (lineage prefill-and-lock is
  blocked on missing plumbing; the live round-trip check was never run). Full status, why it's
  blocked, and an owner decision needed before continuing: `docs/website-link-builder-handoff.md`.
- Owner approved the Terms & Privacy "Website Measurement" wording. No cookie banner: the collector
  uses `sessionStorage` only, readers are mostly US-based, and no third-party tracker is involved.
- Landing-page PR #94 merged and released as `v2026.09.15` (tag-triggered Vercel deploy). Live
  checks: `/api/website-analytics` returns 401 without the token; the privacy section is live.
- `WEBSITE_ANALYTICS_REPORT_TOKEN` is set in Vercel production. Content Studio's `.env` has
  `WEBSITE_ANALYTICS_REPORT_URL` and the matching token.
- Subscriber origin labeled in production with owner-confirmed provenance: 163 `import` (Substack)
  and 3 `website` (owner's own site signups/test emails). No rows remain `unknown`.
- Not yet done: first live Studio refresh. Website funnel rows start from the deploy date;
  earlier traffic is not reconstructed.

## Landing-page implementation status — 2026-09-14

Implemented in `/Users/Muxin/Documents/GitHub/landing-page`:

- `site/src/scripts/lead-events.js` and `site/src/scripts/analytics-context.js` collect privacy-minimal page/session/referrer/UTM context. Query strings are stripped from stored paths and only the referrer hostname is retained.
- `site/api/_analytics.ts` and `site/api/lead-events.ts` add bounded fields, stable event IDs, a unique event index, and client-event allowlisting.
- `site/api/_analytics.ts`, `site/api/lead-events.ts`, and `site/src/scripts/lead-events.js` preserve an allowlisted form type so newsletter attempt and survey-start signals can be counted separately.
- `site/api/essays-subscribe.ts` records new website signups and first survey completions transactionally. Duplicate submissions, existing subscribers, reactivations and imports do not create new signup events.
- `site/api/website-analytics.ts` exposes the token-protected aggregate report with date/timezone filters, page-view breakdowns, conversion rows, needs categories, audience origin totals, coverage gaps, and diagnostic newsletter/survey attempt counts. It does not expose email addresses or raw survey answers.
- `site/src/pages/terms-privacy.astro` discloses the first-party website measurement.
- `docs/website-analytics.md` documents the URL-tagging contract and owner setup.

Validation completed: focused analytics tests passed; the full site suite passed 15 tests; TypeScript
passed; Astro build passed; `git diff --check` passed. No production database, deployment, real
email send, or live Content Studio refresh was exercised. The owner still needs to review consent/
privacy behavior, configure the report token, deploy, classify verified imports, configure Studio,
and run the isolated refresh.

The landing-page implementation is committed locally in `b16618b`
(`feat: add first-party website analytics funnel`), with the diagnostic attempt-signal follow-up in
`2bc54de` (`feat: report website funnel attempt signals`). The next verification pass is still
owner-gated: review the measurement wording and consent requirement, set
`WEBSITE_ANALYTICS_REPORT_TOKEN` in the deployment, and run isolated
new/duplicate/import/reactivation and first/repeat-survey checks against a disposable or approved
database. Until that happens, collection and historical import classification remain unverified.

The follow-up report enhancement is committed in landing-page commit `120e378`
(`feat: expose saved survey totals in analytics report`). Content Studio's server-side adapter is
committed in `3605da9` (`feat: connect Content Studio to website analytics report`). When
`WEBSITE_ANALYTICS_REPORT_URL` and `WEBSITE_ANALYTICS_REPORT_TOKEN` are present in the Content Studio
server environment, its existing read-only website refresh route fetches the protected report,
validates and stores an aggregate-only snapshot, and updates the existing private summary. With
those variables absent, the prior read-only database totals path remains available.

The Studio presentation pass is committed in `3131c93` (`feat: show website analytics in Studio`),
with diagnostic funnel counters in `d7e70d2` (`feat: show website funnel diagnostics in Studio`).
Studio reads and validates the saved aggregate snapshot on each private Signals/Venture read, then
renders the top 25 source/platform-to-landing rows with measured sessions, new signups, signup rate,
and survey completions, plus normalized saved-needs categories and clearly labeled newsletter/survey
diagnostic signals. It also renders the report when no Venture series exists. The full snapshot
remains capped at 500 rows and contains no subscriber identifiers or raw survey answers; a malformed
derived snapshot is ignored while the separate summary remains readable. Older saved snapshots
without the new counters normalize those fields to zero until the next refresh.

Adapter validation: five focused analytics tests passed after the diagnostics pass; the landing-page suite,
TypeScript check, and Astro build passed. The Content Studio repository-wide test run reported
at least 2,729 passing subtests but did not emit its final summary or exit, so it was stopped after
the hang. Content Studio typecheck still reports three unrelated pre-existing test typing errors in
`src/review/publishing-status.test.ts` and `src/review/venture-guide.test.ts`. No live endpoint,
deployment token, production database, import classification, or Content Studio refresh was run.
