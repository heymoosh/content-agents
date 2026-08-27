# Bella Poarch: content library

**Handle:** @bellapoarch (TikTok)
**Primary platform:** TikTok
**Primary media type:** short-form video
**Audience size:** 91.8M followers; 2.4B profile likes
**Topic(s):** Platform-wide celebrity leader (original music promotion, lip-sync and dance, fashion/beauty, pets, short lifestyle posts)
**Capture method:** profile grid sorted by visible view count (TikTok has no native top-sort)
**Posts captured:** 0/30

## Capture blocked: not fabricated

The profile loads (name, verified badge, "Stay Gone out now" bio, 642 following / 91.8M
followers / 2.4B likes all rendered correctly), but the video grid itself never rendered.
Every attempt returned TikTok's own client-side error state:

> Something went wrong
> Sorry about that! Please try again later.
> [Refresh]

What was tried, in order, on `https://www.tiktok.com/@bellapoarch`:

1. Direct navigation to the profile: grid area blank, then errored on reload.
2. Clicking "Refresh" on the error state: errored again.
3. Re-navigating to the same URL: errored again.
4. Switching the sort tab to "Popular": tab selected but grid stayed empty, then errored.
5. Navigating with `?lang=en` appended: errored.
6. Waiting 3-8 seconds between every attempt (10 attempts total, ~45+ seconds of combined
   wait time) before checking again: no change.
7. Trying TikTok's search (`/search?q=bellapoarch`) as an alternate route to her videos:
   blocked by a mandatory "Log in to search for popular content" modal (no anonymous search).
8. Closing the tab and opening a brand-new one, then re-navigating fresh: errored again,
   identical message.

For comparison, sibling browser tabs open in this same session loaded other very
high-follower TikTok profiles (@khaby.lame, @charlidamelio) and their individual video pages
without issue, so this does not appear to be a session-wide TikTok outage; it is specific to
this profile's video-list endpoint in this session (possibly rate-limiting or bot-detection
triggered by this account's heavy scrape/view traffic).

No posts, captions, transcripts, hooks, or metrics are recorded below because none were
observed. Per instructions, this run stops here rather than inventing entries.

## Posts

None captured; see "Capture blocked" above.
