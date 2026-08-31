# Creator research and source-capture workflow

The current 65 accounts are leads only. They are not an approved study set and receive no
preference. Discovery is open to any creator or post with defensible comparative evidence.

This workflow has three deliberately separate stages:

1. Find leaders and qualifying content.
2. Preserve an evidence-backed source record for that content.
3. Later, when Muxin explicitly asks, analyze structures such as openings, storytelling, and
   format. Do not derive reusable templates during stages 1 or 2.

Keep these independent:

1. Niche relevance
2. Broad-platform performance
3. Format-specific performance
4. Relative outperformance where a valid account baseline exists
5. Repeatability across more than one post
6. Evidence quality: traceable items, usable metrics/dates/denominators, and caveats

Do not collapse them into a score or universal ranking. Every stored creator and content record
must carry identity/profile, platform, exact narrow subject, direct content link, publication date,
format, visible engagement and reach, visible audience size, comparison method and set,
account-relative performance when measurable, repeated-performance evidence, caveats, confidence,
and why it is useful to study. Unknown remains explicitly unknown.

## Aug. 26 direction: audience-size-first discovery order

Muxin clarified the goal on Aug. 26: this research finds creators to model after, people who
successfully built large followings in their topic and/or platform, not a hunt for individually
viral posts. Two consequences:

1. **Discovery order, and topic-first vs. platform-first.** Start every pass with sources that
   already categorize creators by audience size or topical authority: SocialDB, the fallback
   discovery sources listed below, and a general web search for existing curated rankings. Only
   fall back to typing a query into a platform's own native search box once categorized sources are
   checked and come up short; native search is the last resort, not the first move. Within that
   order, **topic creators (the five tracked topics) are discovered topic-first, not
   platform-first**: search for the actual major voices in the topic itself (`top <niche> creators
   [year]`, `best <niche> people/newsletters/podcasts to follow`, not scoped to one platform), then
   check which platforms each one is active on and verify natively there. Do not reverse this into
   "this platform needs a slot, so search `<niche> on <platform>`": that framing only surfaces
   people who happen to already show up in a platform-scoped search, and silently undercounts a
   topic's real population of major creators (this is exactly what happened to product thinking,
   discovered almost entirely platform-first and left the thinnest topic in the guide as a result).
   Platform-scoped search (`best <platform> accounts for <niche>`, `top <platform> accounts to
   follow <niche> <year>`) is legitimate only for the separate "platform-wide audience leaders"
   reference material, which is explicitly not topic-tagged and not part of the topic fill count.
2. **Fill criterion.** A platform slot is filled by a verified real, active, content-origin
   creator with a large following in the topic and/or platform (audience size from a credible
   ranking or the platform's own follower count), not by proving two same-magnitude posts in a
   tight window. Native verification's job is to confirm the account is real, active, and
   genuinely posting in the claimed niche (at least one direct, linkable piece of content is still
   required so the record stays traceable) and to apply the provenance filter, not to build a
   post-level virality case. This does not relax the provenance filter, the ban on fabricated or
   unverifiable claims, or the requirement to preserve original links and dates.
3. **Exhaust every method before declaring scarcity.** A "no candidate exists" claim for a
   platform/topic pair is only credible after trying every applicable method, not just the first
   one tried: (a) a database or leaderboard's topic/category filter where offered, actually applied
   (not assumed broken from a prior session); (b) paging past the celebrity/institution tier of a
   ranked list rather than stopping at the top 10-20 (a real content-origin creator with a large
   but non-celebrity-scale following often sits further down the same list, not on a separate
   curated blog post); (c) general web search for curated rankings; (d) named-candidate checks
   (does an already-verified creator elsewhere in this guide, or a known figure in the niche, have
   an account on this platform); (e) native platform search as the last resort. Stopping after one
   or two of these and writing "genuine scarcity" is not sufficient; the platform-check row must
   name which of the five methods were actually tried before a negative claim is accepted.

## Discovery baseline

Use [SocialDB's leaderboard](https://socialdb.xyz/leaderboard) first when it covers the requested
platform and a broad creator comparison is needed. Record the platform, category, sort, result
position or result-count context, and access date. Its audience-size, growth, engagement, and
category filters are discovery evidence only. They find large or comparable accounts, but do not
prove a specific post was viral or that an account is the best fit.

Exclude from the active study set any account whose performance is plausibly driven chiefly by
pre-existing celebrity, political office, executive or institutional power, platform ownership, or
mega-franchise distribution. Do not exclude a creator merely because the creator later became
famous through the same kind of content being studied; document that content-origin trajectory and
still require verified native performance evidence (per the Aug. 26 fill criterion below: a real,
active account with a large following and at least one direct linkable piece of content). If an
excluded account was already captured, retain its direct-source record as archived audit evidence
and state the reason for exclusion; never erase or repurpose it as a study model.

### Fallback discovery sources when SocialDB falls short

When SocialDB lacks coverage for a platform, its category is too broad or empty, or a second
discovery angle is useful, these additional sources may supplement it, checked 2026-08-26:

- **[Social Blade](https://socialblade.com)**: a long-established, browsable creator-statistics
  tracker, widely referenced as a default free-tier tool in this space, though membership is
  required for some features. Its own site blocked an automated fetch during this check (HTTP
  403), so neither its current platform coverage nor its free-vs-paid boundary was freshly
  verified; treat this whole entry as reputation-only until it is actually opened and confirmed
  to load real numbers.
- **[BestCreators](https://bestcreators.com)**: a free, no-signup cross-platform leaderboard
  currently covering YouTube, Twitch, Telegram, Spotify, Patreon, Kick, and Instagram (TikTok and
  X planned), built on public API data such as the YouTube Data API. Useful where it has coverage.
- **[influencers.club](https://influencers.club/content-creator-database/)**: a freemium database
  (340M+ profiles, Instagram/TikTok/YouTube) that supports basic free search; full filtering,
  export, and verified-contact data sit behind signup and payment. Usable for a first discovery
  pass only.

These sources carry the exact same evidentiary limit as SocialDB: discovery and audience-comparison
leads only, never post-level virality proof, and every account or post they surface still requires
native platform verification before anything is stored in the ledger.

**Checked and not added:** [hooked.so/trends](https://www.hooked.so/trends) is a trends showcase
built into an AI video-generation product, oriented toward inspiring paid tool usage rather than
offering neutral, transparent audience metrics; it is not used as a discovery source here. A wider
search of Reddit, Hacker News, and Indie Hackers discussions surfaced mostly paid brand-outreach
platforms (Modash, HypeAuditor, Heepsy, Upfluence, Captiv8, CreatorTag, Impulze.ai) built for
influencer-marketing campaigns rather than free browsable leaderboards; this bounded search did not
identify a free, signup-free option among them worth adding here, not an exhaustive claim that none
exists.

When SocialDB does not cover the platform, a category is too broad, the ranking is empty, or the
research calls for recent/trending leaders, use a browser search designed for the exact question.
Examples: `top creators on <platform>`, `top creators in <niche> on <platform>`, `top trending
creators in <niche> <year>`, and `top <niche> posts on <platform>`. Use the current platform and
niche in the query rather than a fixed phrase. Treat search results as leads and verify every
selected account and post natively.

For each qualifying leader, visit the native profile in Chrome and identify its strongest content
using the platform's visible evidence: a popular/top sort, a pinned item, a playlist, a native
topic result, or a defined recent-feed comparison. Then store the direct profile and content links,
publication date, format, metrics, and the selection method in the human-readable research ledger.
Do not call a post "top" without saying which of those comparison methods supports it.

The source ledger is append-only evidence. Preserve the original creator and content links and the
exact source text when a short source excerpt is captured. Never delete or overwrite a source item,
replace it with a paraphrase, or mix research notes into the source text. A later metric check adds
a dated snapshot rather than changing the earlier observation. Respect copyright limits: a direct
link and metadata are the default record, and any stored excerpt remains short, exact, attributed,
and clearly separated from researcher analysis.

Openings and storytelling are essential study targets, but their analysis belongs to the later
analysis stage. At capture time, retain the direct source and, where appropriate, a short exact
opening excerpt. Do not turn it into a hook template, rewrite it in Muxin's voice, or infer a
pattern before Muxin asks for that separate work.

Do not write canonical pattern data from the source ledger. Creator research, source capture, and
future analysis stay distinct so a study record can never silently become a template or published
content.

## Rerun playbook

Use this sequence whenever Muxin adds a platform, niche, date range, or asks for a fresh creator
pass. It is a research workflow, not a schema-building exercise.

1. Define the comparison question precisely: `<platform> overall`, `<niche> on <platform>`, or
   `recent/trending <niche> creators on <platform>`. Keep the requested niche narrow, for example
   `LLM evaluations for production apps`, not merely `AI`.
2. For a SocialDB-covered platform, start at the platform leaderboard and, when populated, record
   the category, sort, approximate result position, and access date. Use it to find candidates and
   audience context only. If the relevant category is empty, misleadingly broad, or unavailable,
   record that limitation and move to browser search.
3. In Chrome, use an exact discovery query matched to the question, such as `top creators on X`,
   `top creators in AI building on X`, `top trending ADHD creators on Instagram 2026`, or `top
   civic-tech posts on Reddit`. Use search results only to create candidate leads. Do not treat a
   search list, SocialDB, or the old corpus as proof of virality.
4. With one browser operator at a time, open each promising creator's native profile in the
   existing signed-in Chrome session. Do not follow, like, reply, post, or change account settings.
   Capture the profile identity, direct profile link, visible audience size, and exact subjects
   actually covered, rather than a broad vertical label.
5. Select one direct post or video only with a named native comparison: `Popular` or `Top`, a
   pinned item with adjacent-feed evidence, a playlist, a topic-search result, or a bounded
   visible-feed window. Capture date, medium, public reach and engagement metrics, and the direct
   content link. When public metrics are absent, say so; do not fill the field from inference.
6. Separate the evidence in the ledger: absolute reach, audience-normalized engagement where the
   denominator is visible, account-relative outperformance, topic-search performance,
   platform-wide audience/performance context, and repeated creator success. Never substitute one
   for another.
7. Per the Aug. 26 audience-size-first direction above, a creator counts toward the six-per-platform
   target once verified as a real, active, content-origin account with a large following in the
   topic and/or platform, backed by at least one direct, linkable piece of content. Repeated
   performance across two or more posts in a named visible window, where it exists, remains
   valuable supporting evidence but is no longer required to fill a count. An account with no
   verified direct link, or with only a small/unverifiable following, remains a lead in the ledger
   and tracker rather than a filled count. If a platform exposes no usable public metrics or
   comparison mechanism, return the strongest verifiable candidates and state that the target is
   not proven.
8. Apply the provenance filter before making a recommendation. Exclude performance plausibly driven
   chiefly by pre-existing celebrity, political office, executive or institutional power, platform
   ownership, or franchise/media distribution. Keep creators who built their fame through the same
   kind of social content being studied, including very large creators, but record the origin,
   audience-scale, access, trend, production, or topic-fit caveat. Never erase an excluded direct
   source record: archive it with its reason.
9. Update both the human-readable study guide and creator tracker immediately after verification.
   The tracker must include handle, platforms checked, visible audience, exact subjects, direct
   post link, comparison evidence, and status: `study now`, `study lead only`, `hold`, or
   `archived`. Reconcile the platform-count table to the repeated-success gate before reporting a
   platform complete.
10. Preserve originals. Store links and short exact excerpts only where useful. Do not paraphrase
    or erase the original content, infer a template, write canonical pattern data, or convert an
    opening into Muxin's voice. Hook, opening, storytelling, and format analysis is a separate,
    explicitly requested later stage.

Stop and surface the limitation only when Chrome needs a sign-in, a platform exposes no usable
public metrics or comparison set, or Muxin must make a genuine product decision. Otherwise continue
through the requested platform and niche coverage.

## Aug. 26 direction: community-surface discovery (subreddits, groups)

Some platforms don't have a "creator with a following" as their basic unit: the audience lives in
a community (a subreddit, a Facebook Group), not a person's profile. For those platforms, run a
**community pass** instead of forcing a creator search: general web search for `top subreddits for
<topic>` / `best <topic> subreddits` (or the equivalent `top Facebook Groups for <topic>` phrasing
already used for Facebook), then native verification of each candidate's size/activity. Output a
per-topic community table (topic, community, direct link, visible size/activity, exact subject,
selection method and caveat) exactly like the existing "Facebook Groups: native community pass"
section. These are **not** creator slots and do not count toward a platform's six-creator target;
they're a separate, valid form of "where Muxin should be" evidence. Apply this to Reddit's
subreddit layer (in addition to, not instead of, checking whether any individual Redditor
genuinely qualifies as a creator) and to any other platform where community discovery turns out to
be more productive than creator discovery.

## Aug. 26 direction: per-creator content library (verbatim posts, hooks, structure)

Once a creator fills a slot (a confirmed "Study now" row in the Stored content ledger), a later
pass captures their actual best content for pattern study, not just the one verification post
already on file. Scope:

- One agent per creator, run once at the creator's primary platform (the platform where their
  audience or fill is largest or most central), not once per platform-slot a multi-platform
  creator happens to hold.
- Target up to 30 pieces of content per creator, using that platform's actual top/best-performing
  sort where one exists (named below); record the actual count retrieved if fewer exist, never pad
  with curated, saved, or off-topic items to reach 30.
- Per-platform top-sort mechanism to use:
  - YouTube: channel `Videos` tab sorted `Popular`. **Fixed Aug. 27: use `yt-dlp` directly via
    Bash, not the Chrome browser, for transcripts.** `yt-dlp --skip-download --write-auto-sub
    --write-sub --sub-lang en --sub-format json3 -o "<slug>-%(id)s.%(ext)s"
    "https://www.youtube.com/watch?v=<id>"`, run from a writable scratchpad directory (not `/tmp`
    directly, which the sandbox blocks), then parse the resulting `.json3` file's
    `events[].segs[].utf8` fragments into a clean transcript, same parsing logic as the old
    network-capture method. This reaches YouTube over plain HTTP, entirely independent of the
    Chrome extension's video-playback path, and is confirmed immune to the session-wide throttle
    documented below (tested directly against a video that the Chrome-based method could not even
    start playing at the time; `yt-dlp` returned a complete, real transcript). This supersedes the
    older Chrome-network-capture method for transcripts; use `yt-dlp` first for every YouTube
    creator going forward, including retries. Video metadata (title/thumbnail/views/likes/date)
    still comes from the channel's Videos-tab Popular sort in Chrome as before, since that path was
    never affected by the throttle in the first place; only the transcript step changes.
  - Historical context (superseded by the `yt-dlp` fix above, kept for the record in case a
    network egress restriction ever blocks `yt-dlp` and the Chrome method has to come back): the
    visible "Show transcript" panel is unreliable in the automated Chrome session (confirmed Aug.
    26: its backend call can return HTTP 400, or the panel spins forever). The old workaround: let
    the video start playing (muted autoplay is enough), capture the signed `/api/timedtext?...&fmt=
    json3` request YouTube fires from the network log, then fetch that URL directly with `curl`
    (works standalone, not IP-locked) and parse the JSON3 captions into a clean transcript. Also
    confirmed the same day: YouTube's video-streaming path can hit a session-wide rate limit after
    roughly 15 consecutive video loads in one session (playback sticks at `readyState:0`, streaming
    calls return HTTP 503); page metadata (title/views/date/likes) keeps working through this, only
    the transcript path throttles. If it hits mid-batch, stop rather than fabricate, report the
    actual count captured, and retry the remainder later, ideally in a fresh session. Confirmed
    Aug. 26 on a second attempt roughly 20 minutes later, in a brand-new tab, on a never-before-
    loaded video: the throttle persisted (identical `readyState:0` and `503` signature), so it is
    not a short cooldown or a per-video cache issue; a real retry needs either a longer wait or a
    different network/session, not just a new tab minutes later. The threshold is not fixed: one
    solo agent hit it at 15 videos, but when 3 YouTube-transcript agents ran concurrently in the
    same batch (Aug. 26), one hit it at only 10, suggesting the throttle may be shared across
    concurrent Chrome tabs/agents rather than purely per-tab. Batching consequence: put at most one
    YouTube-transcript-heavy creator per batch of 8 rather than several, to keep each one's
    effective budget closer to the higher solo threshold. Confirmed further Aug. 27 (LegalEagle,
    batch 6): the "one per batch" rule alone is not sufficient. The sole YouTube-transcript agent
    in that batch hit the identical `readyState:0`/HTTP-503 signature on its very first video, with
    zero `/api/timedtext` requests ever firing, even though no other YouTube-transcript agent ran
    alongside it; the browser session was still shared with several non-YouTube sibling agents
    (Pinterest, Substack, Dev.to) plus whatever tabs a prior batch's YouTube agents left open,
    consistent with the quota being account/session-wide rather than scoped to concurrent
    YouTube-transcript agents specifically. Practical consequence: before running a
    YouTube-transcript-heavy agent, close out any lingering YouTube tabs from earlier batches, and
    treat any concurrent Chrome activity at all (not just other YouTube agents) as a risk to that
    batch's transcript budget, not just concurrent YouTube activity. Confirmed a third time, more
    severely, Aug. 27 (Johnny Harris, batch 8): run as the sole Chrome-using agent in the entire
    session, with every prior batch's agent already idle (zero concurrent tab activity of any
    kind), the throttle still hit immediately on the very first video, identical
    `readyState:0`/HTTP-503 signature, zero `/api/timedtext` requests ever firing. This rules out
    "wait for concurrent load to clear, then retry" as a working strategy: the earlier
    "account/session-wide" framing undersold it, this is not a live-concurrency quota that frees up
    once other tabs go idle, it is a longer-duration block that persists across the whole browser
    session once triggered (first seen during LegalEagle's attempt roughly an hour earlier in the
    same session) regardless of how much idle time passes in between (confirmed idle time here was
    on the order of an hour, well beyond the ~20-minute gap that earlier failed to clear it).
    Practical consequence, revised: once this throttle triggers anywhere in a session, do not
    schedule further YouTube-transcript attempts in that same browser session at all, not even
    solo, not even after a long wait; a genuine retry needs a different network or a different
    browser session/profile, not more patience in the same one. Non-transcript YouTube metadata
    (title/views/date/likes, channel Videos-tab Popular sort) is unaffected and can still be
    captured normally even while transcripts are fully blocked. **All of the above is why the
    `yt-dlp` fix at the top of this bullet matters**: it removes transcripts from the Chrome
    video-playback path entirely, so this whole throttle history no longer constrains transcript
    capture. The "at most one YouTube-transcript-heavy creator per batch of 8" batching rule is
    correspondingly relaxed for future batches: a batch may run several YouTube creators at once
    as long as they use `yt-dlp` for transcripts, since `yt-dlp` doesn't touch the Chrome tab the
    throttle lives in. Chrome is still used for metadata (title/views/date/thumbnail via the
    Videos-tab Popular sort), so normal Chrome-tab-contention caution still applies there, just not
    the YouTube-specific throttle logic above.
  - Substack (Posts and Notes): publication archive sorted `Top`, or Notes `Top` search on the
    author.
  - Hacker News: Algolia search sorted by points, scoped to the author.
  - X: `from:<handle>` search sorted `Top`, plus the pinned post.
  - Instagram: `Reels` tab sorted by visible view count.
  - TikTok: profile grid sorted by visible view count.
  - LinkedIn, Threads, Bluesky, Mastodon, Pinterest: no native top-sort; capture the best of a
    bounded, dated profile window and say so explicitly, the same "profile top" and "bounded
    window" vocabulary already used in the Stored content ledger.
- Store form depends on media type, revised same day after Muxin clarified the ask twice (once for
  YouTube/Substack, once for short video/image). Every type gets full content, not just an opening
  hook: an opening hook alone was never enough to understand a creator's actual content strategy.
  - **Short-form text** (X, Threads, Bluesky, Substack Notes, LinkedIn): full verbatim post text.
  - **Short-form video** (Instagram Reels, TikTok): full verbatim caption, PLUS a transcript of the
    video's actual spoken words or voiceover where the video has any, PLUS any on-screen text
    overlays transcribed verbatim. The caption alone is not the content, the video is; capture what
    is actually said/shown, not just what is captioned. **Known environment limitation, confirmed
    Aug. 26 on Instagram Reels:** video playback does not load in this automated Chrome session
    (`readyState` stuck at 0, no caption text track exposed), so spoken-word transcription is
    currently not achievable here; record it plainly as "Not captured (video would not play in
    this automated browser session)", never as "none", since "none" would falsely claim the video
    has no speech. On-screen text is still capturable from the static thumbnail/poster frame(s)
    Instagram renders, label that a partial, frame-based capture, not a full scrub through the
    clip. If a full transcript later proves necessary, it needs a session where the video actually
    plays (for example Muxin's own logged-in browser), not more retries in this environment.
  - **Long-form video** (YouTube): title, a description of the thumbnail, PLUS the full transcript
    via the video's transcript panel, not just an opening line. Title and thumbnail are the
    click-decision layer; the transcript is the full content-strategy layer, both are needed.
  - **Long-form text** (Substack essays and similar newsletters): the promotional teaser used to
    drive clicks (a companion Note, subject line, or subtitle, wherever one exists) PLUS the full
    essay text verbatim, not just an opening paragraph.
  - **Image or carousel** (Pinterest pins, Instagram image posts): full verbatim caption, PLUS any
    text baked into the image itself transcribed verbatim (Pinterest pins in particular often carry
    their real hook as on-image text, e.g. a pin titled as a headline), PLUS a plain description of
    the visual.
  A section-level structure map stays useful as a study aid alongside the full text, not instead
  of it, for any long-form item.
- While reading each piece, extract inline: the exact opening hook (verbatim), the structural
  pattern (numbered list, story-to-lesson, contrarian-claim-then-evidence, etc.), and the framing
  device, so hook extraction happens during the same read rather than as a separate pass.
- Record each creator's primary media type (text, short video, long video, image or carousel,
  audio) alongside their handle, audience size, and topic, in a new per-creator content-library
  index.
- Output: one file per creator under `docs/content-studio-program/creator-content/<slug>.md`, so
  concurrent agents never edit the same file; a single index file rolls these up afterward.
- This phase studies confirmed fills only, not leads, rejects, or archived records. Platform-wide
  celebrity leaders and community-surface entries (subreddits, Facebook Groups) are handled as
  separate, explicitly labeled batches if pursued at all, not folded silently into the topic count.

## Rerun playbook: per-creator content library

Use this sequence whenever Muxin asks for a fresh content-library pass (a new confirmed fill, a
refresh of an existing creator's file, or the whole set again). It assumes the discovery/fill phase
above is already done; this phase never runs on a lead, reject, or archived record.

1. Build the roster: pull every row from the Stored content ledger marked as a confirmed fill
   ("Study now" or an equivalent statement that it fills a slot), collapse duplicates by person to
   one row each, and assign each creator their single primary platform, the one where their
   audience or fill is largest or most central, not every platform-slot they happen to hold.
   Exclude platform-wide celebrity leaders and community-surface entries (subreddits, Facebook
   Groups) from the main roster; run those as separate, explicitly labeled batches if pursued.
2. Batch the roster into groups of up to 8. Mix platforms within each batch (don't put multiple
   creators on the same login-gated platform, e.g. LinkedIn, in one batch); public-read platforms
   like Substack and YouTube can share a batch more freely.
3. For each creator, launch a fresh (non-fork) general-purpose agent, not a fork; forking would
   copy this entire research conversation into every agent and is not worth the cost for a
   self-contained capture task. Each agent's prompt must be self-contained and include: the
   creator's name, handle, platform, and a pointer to their confirmed-fill row in the study guide;
   an instruction to load the Chrome tools via `ToolSearch` and create its own tab via
   `tabs_create_mcp`, using only that tab; the exact top-sort mechanism to use for that platform
   (see the list above, or the bounded-window fallback for platforms with no native top-sort); the
   full per-media-type capture rule for that creator's format (see above, this is not optional and
   every rerun must re-state it, an agent given only "capture their best content" will default to
   opening-hook-only and under-deliver); a target of up to 30 items with an instruction to record
   the actual count and never pad; the exact output file path,
   `docs/content-studio-program/creator-content/<slug>.md`, and an instruction to write only that
   file; a note that only the agent's own prose must avoid em dashes, verbatim quoted content may
   legitimately contain them; and an instruction to stop and report exactly what it tried, rather
   than fabricate, if it genuinely cannot reach the content after trying the top-sort, the pinned
   item, and the profile page directly; and an explicit header format that avoids em dashes as a
   separator (a real bug in the first batch's own template): the file's title as `# <Creator>:
   content library`, not `<Creator> — content library`, and each entry's header as `### N. <title>
   (<date>) [link](url)`, not `<title> — <date> — [link]`. Verbatim quoted content may still
   legitimately contain an em dash if the source did; only self-authored structure must avoid one.
4. If Muxin refines the capture spec while a batch is still running (this has happened twice
   already: once narrowing/expanding the long-form rule, once catching that short-form video needs
   a transcript, not just a caption), update this policy file first, then send the correction to
   each affected running agent by name via `SendMessage` rather than waiting for it to finish under
   the old spec and redoing it. Only agents on an affected media type need the correction.
5. After each batch lands, verify before moving to the next: confirm every expected file exists at
   its path, spot-read at least one file in full for structural compliance with the template, run
   `rg -n '—' docs/content-studio-program/creator-content/` scoped to non-blockquote lines (verbatim
   quotes may contain em dashes; only bare prose lines are the check), run `git diff --check`, and
   run a scoped codex audit on the batch's new files for fabricated links, padded counts, or a
   media-type capture rule applied incorrectly (for example an opening-hook-only entry where a full
   transcript was required). Fix what it finds before starting the next batch.
6. For any creator whose long-form full-text capture (30 Substack essays, or a similarly large
   YouTube transcript set) risks a large single-response write: instruct the agent to build the
   file incrementally, a `Write` for the header skeleton, then repeated `Edit` calls appending one
   post or a small batch at a time, rather than composing the whole file in one response. This is a
   real, confirmed failure mode (Aug. 26, John Cutler's first attempt died with "response exceeded
   the 64000 output token maximum" and produced no file at all), not a hypothetical one.
7. Once every batch in a run is done, write or refresh a single index file rolling up all
   per-creator files: creator, handle, primary platform, primary media type, audience size at
   capture, topic(s), items captured, and a link to that creator's content file. This is the
   structured "do we have media type, handle, audience size, topic" record Muxin asked for.

## Aug. 26 exception: approved concurrent Chrome operators

Muxin explicitly approved running multiple native-research agents concurrently against the same
Chrome session (each on a distinct platform) to speed up the remaining coverage sweep, overriding
the "one Chrome operator at a time" default above for this specific run. Each concurrent agent must
create and use its own tab (via `tabs_create_mcp`) immediately, record that tab's own ID, and act
only on that tab for the rest of its run rather than trusting a shared "active tab" from
`tabs_context_mcp`, which may reflect another concurrent agent's focus. This is a one-time,
explicitly authorized exception, not a standing change to the single-operator default; revert to
one Chrome operator at a time once this coverage sweep concludes unless Muxin says otherwise.
