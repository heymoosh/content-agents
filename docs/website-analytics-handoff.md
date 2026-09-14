# Human Inference website analytics: current handoff

Updated 2026-09-14. Implementation home: `/Users/Muxin/Documents/GitHub/landing-page`.
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
- Content Studio can refresh aggregate subscriber/survey counts from the database read-only.
  It does not yet have website visits, attributable conversions, or the import/new-signup split.
- Historical website traffic cannot be reconstructed unless an existing analytics source captured
  it. Inspect what is already installed before adding anything. Missing data stays unknown, not zero.

## Running list

| Priority | Question / measure | Definition and useful breakdown | Status / next step |
|---|---|---|---|
| First | Where do readers arrive? | Sessions and essay/landing-page views by date, page, referrer and tagged source/platform. Sessions are not unique people. | Not connected to Studio. Inspect existing instrumentation; add one free collector if absent. |
| First | Which posts bring readers? | Campaign + stable source-post and variant IDs on incoming links; connect each variant to its source, platform and optional hypothesis. | Add consistent link tags and preserve attribution through signup/survey. Untagged or historical traffic remains unattributed unless evidence exists. |
| First | Which visits lead to new signups? | Successful new website subscriptions, excluding imports, duplicates, existing subscribers and reactivations. Group by acquisition source, landing page and campaign/variant where known. | Database has total records, not a reliable acquisition funnel. Separate origin (`import`/`website`/`unknown`) from referrer; preserve import provenance. |
| First | What is the signup conversion rate? | Sessions with a successful new signup / measured eligible sessions, using the same time range and attribution scope. Show numerator and denominator. | Requires session-to-success linkage. Do not divide all DB subscribers by browser sessions or silently mix tracked and untracked populations. |
| First | Do people complete the survey? | First successful completion / eligible new-signup cohort, with a stated follow-up window. Separately report imported subscribers who later answer. | Saved completions exist; cohort attribution and first-completion tracking needed. Imported subscribers who never saw the survey are not funnel drop-offs. |
| First | What do readers want? | Counts and shares of each saved survey choice, segmented by acquisition cohort/source where useful; show response count and unanswered fields. | Existing answer columns are available, currently empty. Keep personal records private; Studio receives aggregate categories, not emails or raw answers. |
| Next | Where is the flow failing? | Signup attempts versus successful saves; survey starts versus completions; aggregate validation/server errors. | Add minimal events only if needed to diagnose loss. A button click is not a saved subscription. Never log form bodies or identifiers. |
| Next | Does interest persist? | New subscribers, reactivations and unsubscribes per period; net audience change shown separately from imports. | Current active count exists; historical changes need dated events, not guesses from today's snapshot. |
| Later | Which content sends people toward tools/products? | Explicit CTA clicks to existing destinations. Later add verified activation, qualified requests and purchases only when those flows exist. | Not a prerequisite for this test. No offer means sales conversion is not applicable, not a failed funnel. |

Platform, format and publish time are dimensions of these measures, not separate research projects.
Publication metadata belongs in Content Studio and joins by stable variant ID; website visit time
is not publish time. Compare equal observation windows and show sample sizes. Do not call a
platform, time slot or hypothesis a winner from a few conversions or unequal exposure.

## Free tool approach

**Suggested default: GA4 Standard for traffic/session reports, existing website Postgres for
authoritative saved subscriptions and survey completions.** This is a proposal, not an installed
integration. GA4 Standard is the free version; its Data API supports programmatic reports.
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
signup rate → survey completions**. Add a separate panel for audience needs and a coverage note.
Show total existing audience separately. Offer requests, sales and revenue can wait until an offer exists.

Next action in the landing-page session: inspect current tracking, implement the First rows as one
small funnel, then connect its aggregate report to Content Studio. This document does not activate
an automatic work queue or authorize changes to the website today.
