# Typefully setup (text-post publishing: X + LinkedIn + Bluesky + Threads)

One integration covers all four — the pipeline pushes approved posts as **scheduled drafts**
(next free slot), so Typefully's queue UI is a free second review before anything goes live.

## Setup
1. Create a Typefully account → connect X, LinkedIn, Bluesky (Settings → Accounts).
   Cross-posting requires connecting each network once.
2. Settings → API → generate an API key → `.env` as `TYPEFULLY_API_KEY`.
3. Optional: if you have multiple social sets, pin one with `TYPEFULLY_SOCIAL_SET_ID`
   (the publish script prints available IDs on first run).
4. Set your posting schedule (queue slots) in Typefully — "next-free-slot" drafts land there.

## Pricing caveat (unverified at build time)
API draft creation may require a paid plan — the script surfaces a clear error on HTTP 402.
Check typefully.com/pricing. Expected ~$12–29/mo.

## Fallback: Postiz
If Typefully's API tier is unworkable: Postiz (postiz.com) — $29/mo cloud or free
self-hosted (AGPL, github.com/gitroomhq/postiz-app), API on all paid tiers, same
draft-style flow. Known caveat: its LinkedIn OAuth integration has open bugs (scope errors,
image-upload failures) — test text-only first. Swapping = rewrite `src/publish/typefully.ts`'s
thin client (~100 lines); the queue contract stays identical.
