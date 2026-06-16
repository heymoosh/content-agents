# TikTok setup (video publishing via PostPeer)

TikTok has no usable self-serve posting path for a personal tool: the official Content Posting API
forces every post to `SELF_ONLY` until you pass a 2–6 week app audit built for products with a
publishing UI. So the pipeline posts through **[PostPeer](https://www.postpeer.dev)** — a sanctioned
API relay that already holds TikTok's audited access and absorbs the OAuth. We call its REST API
exactly like the Typefully relay; no browser automation, nothing auto-posts without a
`review-queue.md` approval first.

Pricing fits occasional use: **20 free posts/month**, then **pay-as-you-go credits that never
expire** ($9 ≈ 500 posts). At ~4 posts/month you stay inside the free tier.

## Setup
1. Sign up at [postpeer.dev](https://www.postpeer.dev) and confirm **TikTok** is on the free tier
   for your account before relying on it (relay pricing shifts — verify, don't assume).
2. Connect your **TikTok** account via OAuth (optionally inside a "profile" to group it).
3. List your connected accounts → copy the TikTok **`accountId`** → `.env` as
   `POSTPEER_TIKTOK_ACCOUNT_ID`.
4. Dashboard → API key → `.env` as `POSTPEER_API_KEY` (sent as the `x-access-key` header).

## How publishing behaves
- `/publish` schedules approved **`tiktok`** rows via `npm run publish:tiktok`. The same render that
  goes to YouTube feeds TikTok — one short, two destinations, two queue rows.
- **Upload is two-step** under the hood: the script asks PostPeer for a presigned URL, PUTs
  `video/short.mp4` to it, then creates the post referencing the returned public URL.
- **Caption** = `video/title.txt` verbatim (extraction-first; no composed copy).
- **Scheduled, never instant.** Set `TIKTOK_SCHEDULE_AT` (ISO-8601, UTC) for a specific time, or
  leave it unset to schedule `TIKTOK_SCHEDULE_LEAD_MIN` minutes out (default 60). Times are sent in
  UTC (`timezone: "UTC"`).
- **Verify config anytime:** `npm run publish:tiktok -- --check` (read-only — confirms the key
  authenticates and your account id is a connected TikTok account; no upload, no post, no quota).
- **Dry run / cancel window.** PostPeer's API doesn't expose TikTok's `SELF_ONLY` privacy, so there's
  no private test post. Instead, schedule with a lead and **cancel it in the PostPeer dashboard before
  it fires** (or via API: `GET /v1/posts/scheduled` to find it, then
  `DELETE /v1/posts/scheduled/{postId}` — note it can take a few seconds after scheduling to appear).

## Known caveat: AI disclosure
Our shorts are AI-assisted (AI voice, captions, script). TikTok's "made with AI" label is a
**per-post toggle that only appears when you post manually in the app — there is no account-level
setting** (so don't go hunting for one). Posting through PostPeer's API bypasses that screen, and
PostPeer doesn't expose the flag, so **API-scheduled posts can't self-apply the label.** Unlabeled AI
content can be down-ranked or auto-labeled by TikTok. Options: add a disclosure line to the caption
(`video/title.txt`), post AI-heavy shorts by hand, or accept TikTok's auto-detection. If PostPeer
adds a disclosure field to `POST /v1/posts`, wire it into `src/publish/tiktok.ts`.

## If you outgrow the free tier
PostPeer credits never expire ($9 ≈ 500 posts), so topping up is a one-time spend, not a subscription.
Swapping relays entirely = rewrite `src/publish/tiktok.ts`'s thin client; the queue contract stays
identical.
