# ✅ PUBLISHING FREEZE LIFTED (Muxin confirmed resuming, 2026-07-08)

All 3 measurement-scaffolding cards shipped — `7e550e48` (routing drift flag), `92bb2ae6`
(exploration budget), `ffa6491d` (posting-cap decision) — and Muxin has confirmed resuming.
`/cycle` and `/publish` are back in normal operation.

---

**Add cancel capability for scheduled posts, across providers**
- ORIGIN: raised by Muxin 2026-07-15, live-triaging unexpected LinkedIn quote-card posts in
  chat. Root cause turned out to be two stale Upload-Post jobs (`quote-card-4`, `quote-card-5` →
  linkedin+bluesky) scheduled 2026-06-24, before the 2026-07-08 Typefully rewire retired
  PostPeer/Upload-Post for cards. Muxin had cancelled her Typefully drafts and checked PostPeer,
  but neither touched these — they lived entirely on upload-post.com, a provider this pipeline
  can no longer even see live (`src/review/reconcile.ts` reports Upload-Post rows as
  `"unavailable"`, not a mismatch, because the adapter that talked to its API was deleted
  wholesale in PR #130). She ended up cancelling them by hand in the upload-post.com dashboard.
- GAP: no provider adapter in this repo — not Typefully, not PostPeer, not any future one —
  implements anything beyond schedule/create. `src/review/reconcile.ts` does live READ
  reconciliation (drift/mismatch detection) but there's no corresponding cancel/delete call
  anywhere, and no "Cancel" action in the review GUI (`src/review/serve.ts`). Killing a
  wrongly-scheduled, duplicate, or stale post always means leaving this dashboard and hunting
  through each provider's own UI by hand.
- ROUGH SCOPE (needs grooming): add a cancel/delete function to each live provider adapter
  (Typefully draft delete via its v2 API, PostPeer post cancel via its API) and surface a
  "Cancel" action in the review GUI next to already-scheduled rows, keyed off the same
  provider-ref parsing `reconcile.ts` already does (`findLoggedRef`). Also worth deciding how a
  retired-provider case (like Upload-Post) should degrade — at minimum the GUI's "unavailable"
  state should point Muxin at exactly which external dashboard to check/cancel in, since a live
  cancel call isn't possible once an adapter's been deleted.
- RETRY: 1
- SHIP: merged (PR #204)
- STATUS: Done
- DECISION: none yet — raised 2026-07-15, not scoped or prioritized.
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
<!-- card-id: e4eca4a1-b755-4d20-bc20-21426ad46a5a -->

---

**Explore Draw Things (free local) for short-form video gen as a Kling cost-saver**
- ORIGIN: raised by Muxin 2026-07-07 alongside the quote+image card discussion — a tangent, not scoped yet.
- Draw Things is a free, local (on-device) image/video-gen app. Worth a bakeoff-style eval against Kling (currently ~$0.08/s via OpenRouter, used for video-broll first+last-frame animation) to see if it can do first+last-frame or general short-clip animation at comparable quality for $0.
- Unverified: whether Draw Things actually supports video generation (vs. image-only) — confirm this before scoping further.
- PRIORITY (Muxin, 2026-07-07): low — exploratory, not blocking anything.
- RESEARCH FINDING (2026-07-10): CONFIRMED — Draw Things supports local I2V video generation (Wan 2.1/Wan Video I2V up to 720p/81 frames, Hunyuan Video, SkyReels I2V, Stable Video Diffusion I2V, LTX-2.3), Apple Silicon, ~2-4s clips on consumer Macs, longer render times than cloud. Sources: wiki.drawthings.ai/wiki/Video_Generation_Basics, wiki.drawthings.ai/wiki/Image_to_Image_and_Image_to_Video. Capability question is resolved; the bakeoff itself needs hands-on GUI use of the native macOS app + local model downloads, which a headless coding agent cannot execute in this environment.
- STATUS: Backlog
- DECISION: defer — capability CONFIRMED via research 2026-07-10 (Draw Things does support local I2V video gen), but the bakeoff itself requires hands-on GUI use of a native macOS app + local model downloads, which this headless conductor cannot execute. Needs Muxin to run manually if/when she wants the comparison.
- PARKED: unbuildable headlessly — Draw Things is a native GUI macOS app requiring local GPU + manual model download/run; video-gen capability now confirmed via research, but the actual bakeoff needs Muxin's hands-on session, not a coding agent
<!-- card-id: 059c24ae-ffd5-4537-9e09-52c8d5682b05 -->

**Landing page**
- Landing page for content CTAs (work-with-me / project pages / read-the-essay).
- Worked on OUTSIDE this repo. Smarter routing depends on this being live.
- When the landing page is live, mark this Done so Smarter routing unblocks.
- STATUS: To Do
- DECISION: defer — external; built outside this repo. Mark Done when the landing page is live to unblock Smarter routing
- GROOMED: clear scoped card, no blocking unknown + 2026-07-10
- PARKED: external work per its own DECISION: defer -- landing page is built outside this repo; conductor should never claim/build this card, only mark Done by hand once the real landing page is live.
<!-- card-id: 87c86b16-e30f-455b-9c3f-bd3b0e3f2648 -->

**Growth via borrowed audiences (other people's platforms), not just native social**
- Strategy note to fold into the weekly strategy brief: prioritize getting in front of OTHER people's existing audiences — podcast guest spots, guest essays / features in other newsletters, collabs, interviews, cross-posts — over grinding native social. Typically far more effective for reach and trust. NOT podcast-specific; any borrowed-audience channel counts.
- Treat native social (X/LinkedIn/Bluesky) as inbound funnels; Substack is home. Borrowed audiences drive new people toward Substack.
- Action seed: maintain a target list of podcasts / newsletters / platforms + a pitch angle aligned to the per-channel positioning card.
- PLAN POINTER (2026-07-08): the target list this card wants is produced by the fit-finder engine's Phase 3 (platform config + `outreach:status --targets` summary surfaced in the weekly brief) — see docs/outreach-engine-plan.md §6. This card stays a strategy note; it needs no build of its own.
- STATUS: To Do
- DEPENDS ON: Outreach engine — Phase 3: platform config + borrowed-audience target list
- DECISION: defer — stays in Backlog, not now (Muxin, 2026-07-04). Target-list mechanics now covered by docs/outreach-engine-plan.md Phase 3 (2026-07-08).
- GROOMED: clear outcome, points at surface area, no blocking unknown + 2026-07-10
- PARKED: conductor mis-claimed 2026-07-10: card carries DECISION defer + own text says no build needed (Phase 3 dependency already Done satisfies the strategy note); reverted to Backlog, not a real build task
<!-- card-id: 30772ba1-3c4a-4823-85ad-3a79788ed867 -->

**Unified follow-up tracking ("Follow-ups" tab) across client, platform, inbound, and job-search outreach**
- ORIGIN: raised by Muxin 2026-07-08 while scoping the fit-finder engine (ba9769af, b7dcb608) and outreach drafting (c308a8cf) — "is it time to follow up with these people, and about what" needs one answer spanning every reason she might be waiting on a reply, not four separate places to check.
- FOUR REASON-BUCKETS, one tracker: client outbound (sourced leads, ba9769af/c308a8cf), client inbound (mentions/DMs needing a reply, db22283f), platform outreach (podcasts/newsletters, b7dcb608), job-search outreach (JSA, external repo).
- GUI DECISION (Muxin approved, 2026-07-08): extend the existing unified review GUI (`src/review/serve.ts`, epic a4a2ce27, Done) with a new "Follow-ups" tab. NOT a new standalone dashboard, and NOT routed through JSA's own planned product UI. Reasoning: content-agents' GUI is already explicitly designed as "one page for everything awaiting Muxin," and already does read-only reconciliation against a live external system (Typefully/PostPeer schedule state, 383756f4/dcc92eb, shipped) — same shape this needs for pulling in JSA's job-search state. JSA's own Level 2/3 product UI (`product/prd/level-2-networking.md`, `level-3-application-tracking.md`, `product/design/*`) is being designed as a sellable surface for JSA's OTHER users (pricing tiers, "42,000+ users helped" goal in `product/technical/productization.md`) — folding Muxin's personal client/platform outreach into a commercial product surface for other people's job searches would be a scope leak in the wrong direction.
- ROW SHAPE: borrowed from JSA's own Level 2 UX brief (`product/prd/level-2-networking.md` — Lead Cards / 3B7 Pipeline Tracker / Relationship View sections; Muxin wrote this spec herself, and it already matches her taste elsewhere in this repo). Per row: who, reason-category, why (surfaces the locked core-message/angle from c308a8cf so context isn't reconstructed cold), last touch, next action + due date, one-click mark-responded / send-follow-up / move-on. Explicit anti-patterns from that same spec to carry over: no CRM aesthetics, no red-alert/guilt-inducing overdue styling, "abandon" reads as closing a chapter, not failure.
- DATA-INTERCHANGE DECISION (Muxin, 2026-07-08): pull job-search state from JSA's local SQLite (`manual_research.db`) read-only. NOT Google Sheets — Muxin confirmed that integration was abandoned, and it's also not wired into JSA's current active pipeline (`scripts/auto_analyze.py` never touches `utils/sheets.py`/`create_sheet.py`). NOT the Obsidian markdown batch summaries either — human-formatted, no stable schema, fragile to parse programmatically. Both content-agents and JSA run locally on Muxin's machine, so a direct read-only file read avoids standing up any API/auth surface at all.
- FINDING (2026-07-08, verified by direct inspection): `manual_research.db`'s `manual_research` table currently holds ONLY Level-1 company-verdict data — company_name, domain, per-dimension scores/notes, verdict, sources, persona/founder_persona, researched_date (140 rows as of this check). No outreach/follow-up state exists anywhere in JSA yet, because Level 2 Networking (where 3B7 tracking would live) is spec-only — status "Early Concept/Brainstorming" in its own PRD, no matching implementation found. So today there is nothing to pull for "is it time to follow up on a job lead" beyond a plain TARGET/CONSIDER candidate list — the follow-up-tracking layer itself doesn't exist yet, in either system. This directly feeds the JSA-Level-2-ownership open question on c308a8cf: whichever way that's decided determines what this tab eventually reads for the job-search bucket versus what it tracks natively.
- IMPLEMENTATION-SCOPED (2026-07-08, stronger-model pass): see docs/outreach-engine-plan.md — data model is `data/outreach/tracker.jsonl` (committed append-only event log, same pattern as publish-schedule.jsonl; events = the 3B7 shape + re_researched; state derived by folding; per-bucket follow-up windows in config/outreach.yaml), surfaced as the Follow-ups tab in page.ts/serve.ts with the row shape + anti-patterns already specced on this card. Builds as Phase 4, after the draft/lock loop (Phase 2) exists to feed it. Jobsearch bucket is pluggable per the c308a8cf Level-2 recommendation (native events, or read-only JSA pull if Muxin picks option (a)); inbound bucket is schema-ready from day one but stays empty until db22283f lands.
- RATIFIED (Muxin, 2026-07-08): plan recommendations agreed, including Level-2 ownership option (b) — the jobsearch bucket is tracked natively here (JSA hands off Level-1 verdicts only), built pluggable per c308a8cf's resolved open question.
CARD TYPE: EPIC
- STATUS: To Do
- DEPENDS ON: Unified review + approval GUI (a4a2ce27, Done) as the base to extend; Draft tailored outreach messages (c308a8cf) for the locked-core-message data this tab surfaces; Inbound listening + voice-replies (db22283f) for the client-inbound bucket.
- DECISION: approved (Muxin, 2026-07-08) — architecture approved (extend the unified review GUI; don't build separately; don't route through JSA's product UI); data-interchange direction set (local SQLite read, not Sheets, not markdown); scoped + ratified per docs/outreach-engine-plan.md §3–§4. Builds as Phase 4, after Phases 1–2 exist to feed it. Phase 4 is GUI/state plumbing, so its PR auto-merges on green CI per rule 7 (no generation logic).
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: superseded as work items by the Outreach engine Phase 1-5 cards (2026-07-09) — kept as reference epics; specs/decisions on these bodies remain canonical
<!-- card-id: 659b50f0-6bc7-473b-8673-b901e9c93d11 -->

**"Hit record" on-camera video as a first-class media type (auto-topic, auto-route, delete source)**
- New input: Muxin records a raw talking-head / selfie video ("hit record", say a thing, stop) and drops it in. No script, no storyboard — this is the fast, human, face-to-camera lane, DISTINCT from /video (essay → scripted short) and from Voice Notes to Published (664189d9, audio → text).
- AUTO-DETECT TOPIC from the recording itself: transcribe (existing transcription provider in config/providers.yaml) → classify pillar + topic (config/pillars.yaml rubric) → drive routing (route.ts) so it lands on the right platform(s) with no manual tagging.
- PUBLISH natively where video performs (TikTok, YouTube Shorts, X, LinkedIn, Bluesky all accept native vertical video); optionally atomize a text post + quote card from the transcript so one recording fans out. Nothing auto-posts — review-queue.md approval still governs (rule 2).
- DELETE the raw recording after it's live: once published, remove the source video file (no storage bloat). KEEP the published-asset reference + metadata + transcript, NOT the raw footage.
- TRACK media_type (e.g. 'talking-head') in analytics — the media_type dimension already exists (PR #44/#46); this adds a new value so we learn which platforms engage with face-to-camera vs quote cards vs scripted shorts. Feeds "Keeping track of what we've posted... in what format" (b5897047).
- Reuses: transcription (gemini), routing, unified scheduler + reuse guard, publish adapters (PostPeer / YouTube / Typefully). Same "drop raw input → auto-atomize → approve → schedule" orchestration as Voice Notes to Published (664189d9) and the Unified review GUI (a4a2ce27).
- OPEN QUESTIONS for Muxin: (1) publish the raw clip as-is, or add captions / light edit first? (2) which platforms are in-scope for native video by default? (3) delete immediately on publish, or after a short grace window / archive elsewhere first?
- STATUS: Backlog
- DECISION: defer — deprioritized, lower priority, new media type. Keep in Backlog. 2026-07-04
- PARKED: not ready: 3 open questions unresolved (raw-vs-captioned publish, platform scope, delete timing) + already deprioritized (DECISION: defer, 2026-07-04) + 2026-07-15
<!-- card-id: b0e4ecc5-6120-4b40-a6dd-859c34ca332a -->

**Track a storytelling-improved bucket in bets.md / origin-compare**
- - Consider whether origin-compare / briefs/bets.md should eventually track a
- "storytelling-improved" bucket the way spin/verbatim is tracked, so Muxin can measure
- whether the rehook pass actually lifts resonance.
- - Depends on: enough published volume with the new storytelling dimension scored.
- - CHAIN: 1
- STATUS: Backlog
- DECISION: defer (pre-flight, 2026-07-07) — data-gated (CHAIN:1 follow-up), needs published volume with the storytelling dimension scored that does not exist yet; nothing to build tonight.
- PARKED: not ready: phrased as an undecided consider-whether, gated on published volume that does not exist yet + 2026-07-15
<!-- card-id: f77b6670-d39d-4c13-b9be-004084510e58 -->

**Re-validate storytelling rubric once broader real-data sample exists (n>=20 across >=3 sources)**
- ORIGIN: follow-up from card 9be7688d (Validate storytelling rubric against real /atomize output) — docs/storytelling-rubric-validation.md.
- That validation found the live sample (n=6, ONE source, 2026-07-05-hey-substack) does not reproduce the original eval's all-three-dimension 2-3 clustering: hook is 4 on every real derivative so far, resonance is 4-5, only narrative actually clusters at the LOW_SCORE_THRESHOLD=3 soft-gate (3 on 4 of 6, correctly flagged).
- FOLDER NOTE: 9be7688d's own DECISION named content/2026-07-05-what-i-ve-described-in-my-essay-building-an-inno/ as the target ('most recent /atomize output at time of decision'). At execution time (and still true as of this filing) that folder has only source.md + review-queue.md -- no derivatives/, so it has never been through a full /atomize scoring pass and had no storytelling scores to validate. Used content/2026-07-05-hey-substack-i-m-looking-for-others-who-feel-int/ instead, the only folder in the repo with real populated hook/narrative/resonance scores. Worth checking the originally-named folder too once/if it gets atomized.
- Recommendation was to keep the rubric/threshold as-is (sample too thin to retune) but re-check once storytelling scores exist across a handful of distinct source pieces.
- Scope: once npm run validate has real hook/narrative/resonance scores across n>=20 derivatives spanning >=3 different source essays/notes (not just more posts from the same source), re-run the same comparison. Specifically check whether hook/resonance keep showing zero variance across multiple sources -- if so, that is worth a real conversation about narrowing the rubric to the dimension that actually discriminates (narrative) vs keeping all three.
- GOAL_CONDITION: a findings note (extending or superseding docs/storytelling-rubric-validation.md) reports the hook/narrative/resonance distribution across >=20 real scored derivatives spanning >=3 distinct source pieces, states whether hook/resonance still show zero variance, and gives a concrete keep-as-is-or-change recommendation.
- CHAIN: 1
- STATUS: To Do
- DECISION: defer -- leave parked; data not ready (n=6 scored derivatives, single source; needs n>=20 across >=3 sources). Revisit when /atomize runs accumulate scored derivatives spanning multiple source essays (2026-07-14)
- GROOMED: explicit GOAL_CONDITION already on card; data-gate (n>=20, >=3 sources) is a natural precondition the task itself checks, not a readiness gap + 2026-07-08
- PARKED: data not ready: card needs n>=20 scored derivatives across >=3 distinct source pieces; repo currently has only 6, all from one source (2026-07-05-hey-substack) - same state as the original validation. Building now would just reproduce that finding. Re-check once more /atomize runs across different essays accumulate scored derivatives.
<!-- card-id: f1a928d1-3e2e-444e-8f68-058726f3053e -->

**Smarter routing — swap the LinkedIn work-with-me stand-in for the real landing page**
- Follow-up to 6dcaee98 (Smarter routing), UPDATED 2026-07-08 (again) per Muxin's PR #140 feedback: "work with me" now HAS a real (if provisional) destination — Muxin's LinkedIn profile (`https://www.linkedin.com/in/muxinli`), wired as a `work_with_me` destination in `config/content-types.yaml` (`work_with_me_url`). `product_builder_insight`, `project_demo`, `offer_adjacent_post`, and `case_study` (the 4 work-flavored types) all resolve to "Connect on LinkedIn" today, unconditionally — none of them fall back to the essay link or resolve to zero CTAs. This SUPERSEDES the card's original premise (it previously assumed no real destination existed at all).
- Remaining scope, once Landing page (87c86b16) ships with a real work-with-me page: flip `work_with_me_url` in `config/content-types.yaml` from the LinkedIn profile to the real landing-page URL — a pure config change, no code/reclassification needed (same pattern as project links). Whether the CTA TEXT should also change at that point (e.g. "Work with me" instead of "Connect on LinkedIn") is Muxin's call when the time comes — flag it, don't decide silently.
GOAL_CONDITION: with the Landing page live and a real work-with-me URL configured, `work_with_me_url` in `config/content-types.yaml` points at the real URL instead of LinkedIn; the 4 work-flavored types' CTA text is confirmed with Muxin (unchanged or updated, her call); every other content type is unchanged.
- STATUS: To Do
- DEPENDS ON: Landing page
- DECISION: approved — Muxin confirmed (2026-07-10, pre-flight): when the real landing page ships, change the CTA TEXT too (e.g. "Work with me" instead of "Connect on LinkedIn") for the 4 work-flavored types, not just the destination URL.
- GROOMED: explicit GOAL_CONDITION already on card; pure config swap once Landing page ships; DEPENDS ON already correctly set + 2026-07-08
<!-- card-id: ae602c84-18ed-4532-8f1b-3bd716e1a10e -->

**Animated HyperFrames companion for the quote+image card variant**
- ORIGIN: follow-up auto-filed while building card 1653734b (Create quote and image cards).
- The existing typographic-only quote card gets a free animated .mp4 companion (renderCardAnimation via HyperFrames) alongside its still PNG. The new quote+image variant (--with-image) was scoped to the still PNG only — no animated companion was built for it.
- Not scoped/requested by Muxin yet; revisit priority explicitly before starting.
- CHAIN: 1
- STATUS: Backlog
- DEPENDS ON: Create quote and image cards
- DECISION: defer (Muxin, 2026-07-09, pre-flight) -- confirmed not yet prioritized, no build tonight.
- PARKED: not ready: card explicitly states not scoped/requested by Muxin yet + 2026-07-15
<!-- card-id: 503a0065-8ddf-4e3f-8a90-af0b671a8572 -->

**Unify resolveCta and resolveEntryUrl's duplicated source/fallback chain**
- ORIGIN: follow-up auto-filed while building card 6dcaee98 (Smarter routing).
- src/publish/cta.ts has two parallel implementations of "resolve a source-style URL, falling back to canonicalUrl ?? cfg.fallbackUrl": resolveCta (the pre-existing pillar/explicit-cta path) and resolveEntryUrl (the new content-type path). They currently agree, but if the source/fallback rule ever changes (e.g. adding a UTM param, changing the homepage fallback), someone has to remember to update both.
- GOAL_CONDITION: resolveCta and resolveEntryUrl share one primitive for the source/fallback resolution (e.g. resolveEntryUrl calls into resolveCta's fallback logic, or both call a shared helper), with src/publish/cta.test.ts and content-type-cta.test.ts still passing unmodified.
- CHAIN: 1
- STATUS: To Do
- DEPENDS ON: Smarter routing
- DECISION: approved — pure refactor unifying duplicated fallback logic, existing tests must still pass unmodified
- GROOMED: explicit GOAL_CONDITION + exact files/tests named; backend dedup, CHAIN:1, dependency (Smarter routing) now Done + 2026-07-08
- PARKED: dangling DEPENDS ON: the original Smarter routing card (6dcaee98) it names is already Done but no longer exists on the board under that title, so the fuzzy dependency matcher cannot resolve it to a Done card and treats it as blocked (dangling ref = blocked, by design). Board bookkeeping only -- needs Muxin (or a groomer pass) to either clear DEPENDS ON or repoint it at a real title; conductor left the link untouched rather than editing a dependency link without approval.
<!-- card-id: e889e512-92fb-40dd-9669-fdcb51c6be11 -->

**Inbound listening: X (mentions/replies/DMs)**
- ORIGIN: follow-up auto-filed while scoping card db22283f (Inbound listening + voice-replies, Build 3) to a Bluesky-only v1.
- X has ZERO read access today: the existing browser agent (src/pull/platforms/x.ts) only drives X's own Analytics "Download CSV" export button. There is no code path anywhere that reads mentions, replies, or DMs for X. Building this means either a paid X API tier (mentions/DM read access is not on X's free tier) or new browser-agent scraping of the notifications page -- both substantial, separate undertakings, not a small extension of what exists.
- GOAL_CONDITION: X inbound listening (mentions/replies, or DMs if in scope) is detected on a schedule and deduped via a ledger, mirroring the Bluesky v1 pattern from db22283f, with an explicit decision on record for which access path (paid API vs. browser-agent scraping) was chosen and why, given CLAUDE.md rule 6 (prefer subscription/free routes, minimize per-token/per-service cost).
- CHAIN: 1
- STATUS: To Do
- DEPENDS ON: Inbound listening + voice-replies (Build 3)
- DECISION: defer (Muxin, 2026-07-09, pre-flight) -- agreed defer, access-path (paid API vs DM/notification scraping) not chosen, not worth building unattended tonight.
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: Muxin deferred (2026-07-09 pre-flight): X access-path (paid API vs browser scraping) not chosen
<!-- card-id: ec217518-9bc8-4ccd-ab37-3eecb78a0406 -->

**Inbound listening: LinkedIn (mentions/comments/DMs)**
- ORIGIN: follow-up auto-filed while scoping card db22283f (Inbound listening + voice-replies, Build 3) to a Bluesky-only v1.
- LinkedIn has ZERO read access today: the existing browser agent (src/pull/platforms/linkedin.ts) only triggers LinkedIn's own Analytics "Export" button for an xlsx download. There is no code path that reads mentions, comments, or DMs. LinkedIn's official API for this is restricted/partner-gated in practice -- likely means new browser-agent scraping of the notifications/messaging surface, a separate undertaking from what exists today.
- GOAL_CONDITION: LinkedIn inbound listening (mentions/comments, or DMs if in scope) is detected on a schedule and deduped via a ledger, mirroring the Bluesky v1 pattern from db22283f, with an explicit decision on record for the access approach given LinkedIn's API restrictions.
- CHAIN: 1
- STATUS: To Do
- DEPENDS ON: Inbound listening + voice-replies (Build 3)
- DECISION: defer (Muxin, 2026-07-09, pre-flight) -- agreed defer, same access-path tradeoff as X; LinkedIn scraping of notifications/DMs carries account-risk exposure not yet accepted.
- GROOMED: readiness pass: clear GOAL_CONDITION, mirrors existing Bluesky v1 pattern (db22283f), points at src/pull/platforms/linkedin.ts + 2026-07-15
- PARKED: DECISION: defer (2026-07-09, account-risk not accepted) -- should never have been claimed; mirrors sibling defer+parked inbound-listening cards (ec217518 X, 81808fa0 Substack) + 2026-07-15
<!-- card-id: aab14467-ac5a-4786-9c93-3bf3b8919222 -->

**Inbound listening: Substack (comment replies)**
- ORIGIN: follow-up auto-filed while scoping card db22283f (Inbound listening + voice-replies, Build 3) to a Bluesky-only v1.
- Substack's browser-agent auth/session plumbing (src/pull/browser.ts, login.ts) is reusable, but it currently only reads two analytics JSON endpoints (post_management/published, publish-dashboard/summary-v2) -- it never opens a post's comment thread or reads comment/reply text, and never touches any DM/chat surface. Reading actual comment-reply text is genuinely new browser-agent code (different pages/selectors, not yet built). Whether Substack DMs are even a real product surface is unconfirmed -- worth checking before scoping this card further.
- GOAL_CONDITION: Substack inbound listening (new comment replies on Muxin's posts, at minimum) is detected on a schedule and deduped via a ledger, mirroring the Bluesky v1 pattern from db22283f, reusing src/pull/browser.ts's session/auth plumbing extended to a comments-reading page.
- CHAIN: 1
- STATUS: To Do
- DEPENDS ON: Inbound listening + voice-replies (Build 3)
- DECISION: defer (Muxin, 2026-07-09, pre-flight) -- agreed defer; also still blocked, db22283f (the pattern this mirrors) is In Progress, not Done.
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: Muxin deferred (2026-07-09 pre-flight): agreed defer on Substack comment-reply listening
<!-- card-id: 81808fa0-7e30-4fd1-9b61-03951b0041bc -->

**Outreach engine — Phase 5: discovery + batch hardening (client + platform)**
- PARENT: ba9769af (completes b7dcb608 too -- shared discovery engine serves both client and platform configs).
- ORIGIN: split out of ba9769af/b7dcb608 per docs/outreach-engine-plan.md §6 Phase 5 -- deliberately LAST.
- SCOPE: discover.ts built to the §9 discovery methodology -- worldview-map query generation (belief x dialect x modality, Claude-generated fresh each run, never a static phrase list), anchor-graph expansion (co-appearance/collaboration/engagement/alumni graphs from config/outreach/anchors.md seeds), mid-tail size-band disqualifiers, lens rotation + dedup ledger + pass-reason anti-examples (never the same list twice). Dedupes against ALL existing lead folders (any status) before surfacing anything. Batch caps + rate-limit backoff exercised for real.
- GOAL_CONDITION (plan §6 Phase 5 definition of done): a real discovery run (client and platform) surfaces NEW candidates not already in any lead folder, respects batch cap + backoff, and logs to data/outreach/run-log.jsonl; a calibration loop compares discovery output against Muxin's pursue/pass record on the grade-bets rhythm.
- WHY LAST: seeded leads validate the qualify/draft pipeline first; discovery quality is the least verifiable stage and benefits from months of Muxin's pursue/pass decisions as a calibration record. Pull it earlier only if Phase 1-3 throughput runs dry of seeded candidates.
- RULE 7: discovery/qualify prompts are content-generation logic -> this PR HOLDS for Muxin's review.

DISCOVERY AMENDMENTS (Muxin, 2026-07-09): (1) Warm start, not cold start: anchor expansion begins from the ingested corpus (see the "Ingest existing research corpus" card) — roughly 30 anchors from the Obsidian vault + 140 JSA-scored companies — not just the 2 seed anchors. (2) The two-key jobsearch gate on the Phase 1 card applies at surfacing time for jobsearch-bucket candidates: discovery that finds an aligned person at a misaligned company surfaces the PERSON as an anchor candidate, not the company as a lead. (3) The anchor graph is the "similar to this kind of company/person" mechanism; the worldview map stays the thesis test — do not reintroduce JSA's Human Enablement score as a discovery signal (see the values-depth finding on the Phase 1 card).
- STATUS: To Do
- DEPENDS ON: Outreach engine — Phase 3: platform config + borrowed-audience target list
- DECISION: defer (Muxin, 2026-07-09, pre-flight) -- confirmed defer; no direct epic approval for this specific phase, and deliberately last per plan anyway.
- GROOMED: split from ba9769af/b7dcb608 per plan §6 Phase 5; explicit GOAL_CONDITION, deliberately-last rationale pinned, DEPENDS ON Phase 3 + 2026-07-09
- PARKED: Muxin deferred (2026-07-09 pre-flight): deliberately last per plan, no direct epic approval yet
<!-- card-id: 96216ecc-86b5-47ba-8a99-4051c17e5423 -->

**Port cost-minimization policy to claude-config/simple-kanban conductor lane**
- Card a1a6f379 (content-agents) codified CLAUDE.md rule 6 (prefer subscription/free model routes, minimize per-token API cost) and fixed a scaffold-default drift bug. That card noted the same policy applies to simple-kanban builds via the claude-config lane, out of scope for the content-agents worktree. ORIGIN: follow-up from a1a6f379.
- STATUS: To Do
- DECISION: approved — Muxin confirmed (2026-07-10, pre-flight): mirror the a1a6f379 cost-minimization fix into the claude-config/simple-kanban conductor lane, low-risk mirrored change.
- GROOMED: clear pointer to a1a6f379's fix to port to claude-config lane + 2026-07-10
- PARKED: INFRA PREREQUISITE (conductor, 2026-07-10): this card DECISION names claude-config/~/.claude as the actual build target (per ~/.claude/CLAUDE.md Conductor rules for claude-config), which needs a session launched with --add-dir ~/.claude --add-dir ~/.claude-worktrees. This content-agents session was not launched that way -- confirmed no write access to ~/.claude (touch: Operation not permitted). Needs a session launched into the claude-config lane specifically to build this, not this content-agents conductor run.
<!-- card-id: 3ddcc3c3-8226-4778-824e-21dd199bde75 -->

**Bakeoff whisper.cpp vs Gemini on a real Muxin voice memo**
- CHAIN: depth 1 (follow-up to b1327a9c-3ffc-41df-a822-0c1e85458a1e, whisper.cpp adapter + bakeoff script). Run npm run bakeoff:transcription -- data/inbox/<memo-file> once a real voice memo exists, read both transcripts against what was actually said, and decide whether to flip config/providers.yaml transcription: from gemini to whispercpp. See docs/bakeoffs/whispercpp-vs-gemini-transcription.md OPEN section. PARKED: needs Muxin to physically drop a real voice memo in data/inbox/ (gitignored) before this can run; no synthetic clip can answer the real question. Surface via morning summary, not a live ask.
- STATUS: Backlog
- DECISION: drop/won't-build -- no in-app voice-memo transcription needed, so no whisper-vs-Gemini bakeoff and no Gemini API dependency. Muxin uses Wispr (external speech-to-text) and pastes the TEXT into the GUI idea-drop input; /atomize just receives text. Recommend archiving this card (2026-07-14)
- PARKED: needs Muxin to physically drop a real voice memo in data/inbox/ before this can run (2026-07-10) — surfaced via morning summary, not a live ask
<!-- card-id: ae96b8e1-4102-4bd6-af10-8df51d21704d -->

**Decide: should atomized-outreach content be excluded from pillar/platform resonance figures?**
- ORIGIN: follow-up auto-filed while building card d5b34590 (Outreach engine Phase 2). route.ts loadData() already excludes CONTROL_RUN_SOURCE/EXPLORATION_SOURCE from strategy resonance math. Phase 2 deliberately did NOT add the new outreach-message tag-source value to that exclusion list (kept the change local to tag-source.ts per its own scope) since that is a strategy-analytics judgment call, not a Phase 2 build decision.
- Worth a deliberate call before Phase 4/5 strategy work leans on resonance figures that might now include outreach-sourced follow-up posts (spin reframes of locked outreach messages, run through /atomize like any other content).
- CHAIN: 1
- STATUS: Backlog
- DECISION: approved -- exclude atomized-outreach content from pillar/platform resonance figures; outreach is cold B2B, counting it would distort the strategy signal that drives drafting (2026-07-14)
- PARKED: not ready: title itself is the unresolved strategy-judgment question (now DECISION: approved, but scope/build approach still unwritten) + 2026-07-15
<!-- card-id: dc47457f-a6b7-49fe-b48d-838b41fc7657 -->

**Build the actual Substack Notes repost path (route.ts target + skill-doc fix)**
- ORIGIN: follow-up auto-filed while building card a52927cd (Clarify which flow produces platform:substack rows), found while tracing the routing comment fix.
- Real gap, not just stale comments: no code path today actually produces a platform: substack review-queue row. src/strategy/route.ts CORE_TEXT (the pillar routers target list) never includes 'substack'. Two project skill docs explicitly say the OPPOSITE of Muxins 2026-07-10 decision: .claude/skills/atomize/references/notes-mode.md step 3 tells Claude 'Substack is already excluded as a routing target, so a note is never reposted back to where it came from'; .claude/skills/atomize/references/spin-mode.md (lines ~12-13) repeats the same stale reserved-not-a-target claim.
- src/publish/substack.ts (PR #164, already merged) is fully wired and works once a row exists -- this card is the missing producer side, plus fixing the two stale skill docs (writes under .claude/skills/ need an attended/interactive session, same constraint cards ebe652a7 and cccfc43a hit).
- GOAL_CONDITION: running /atomize notes on a real Substack Note produces a review-queue.md row with platform: substack when appropriate (conditioned on source_kind: substack-note, per the plan), and .claude/skills/atomize/references/notes-mode.md + spin-mode.md no longer say Substack is excluded as a target.
- RULE 7: this is src/strategy/route.ts routing-decision logic (which platforms a piece is atomized to) -- content-generation-adjacent logic per CLAUDE.md rule 7. This PR should HOLD for Muxins review.
- CHAIN: 1

SHIP: held (draft PR #208 — repo CLAUDE.md Rule 7, routing-logic change, needs Muxin's review; old-vs-new content sample in PR body)
- STATUS: Review
- DECISION: approved -- build the missing Substack Notes repost producer (route.ts) to match Muxin's already-stated 2026-07-10 decision (platform:substack rows should be produced when appropriate); also fix the two stale skill docs. Routing/content-adjacent logic, so PR HOLDS for review per rule 7 regardless of this approval to build. (pre-flight 2026-07-14)
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- CI NOTE: CI: green (as of 2026-07-15 08:25 UTC) — PR #208 https://github.com/heymoosh/content-agents/pull/208
<!-- card-id: df11d0db-c6eb-4f00-bf31-d2d9f0328265 -->

**Wire tracker.ts summarizeFollowups() into the /strategy weekly brief**
- src/outreach/tracker.ts exports summarizeFollowups() (counts per bucket, due/overdue counts) per card 21a5eb84's scope ("summary for /strategy"), but it is not wired into src/strategy/*'s weekly brief synthesis yet -- that wiring was explicitly out of scope for Phase 4. A future card should decide where/how the weekly brief surfaces follow-up due/overdue counts.
ORIGIN: follow-up discovered while building card 21a5eb84 (Outreach engine -- Phase 4: Follow-ups tab + tracker).
CHAIN: 1
- STATUS: To Do
- DEPENDS ON: Outreach engine -- Phase 4: Follow-ups tab + tracker (client/platform/inbound/jobsearch)
- GROOMED: readiness pass: clear reuse task (wire existing summarizeFollowups() into /strategy brief), depends_on already set + 2026-07-15
- PARKED: needs decision (judgment): WHERE/HOW to surface follow-up tracker data in weekly brief not yet decided; recommended: stage — awaiting Muxin's call, 2026-07-14
<!-- card-id: 2a751683-d3a5-46cc-9de2-dd0b25d7edcc -->

**Remove AI smells from writing: add an independent sweep/review-and-edit pass after drafting?**
- ORIGIN: Muxin, 2026-07-10 -- raised while discussing whether /atomize reliably keeps AI writing
tells out of generated copy.
QUESTION: should we add an independent sweep/review-and-edit pass AFTER drafting, instead of (or
in addition to) relying on the drafting prompt alone to avoid AI smells?
CURRENT STATE (verified 2026-07-10): enforcement of config/voice.yaml (no em dashes, no "here's
the thing"/"delve"/etc., the banned list) is PROMPT-ONLY everywhere it's used -- every generation
site (atomize derivatives, video scripts, outreach drafts/research, GUI revise/duplicate jobs)
tells the Claude subprocess "follow config/voice.yaml" as an instruction, and voice.yaml's own
check_before_queue section tells the model to self-check ("count the em dashes, target is zero").
src/atomize/validate.ts is the one deterministic gate that runs before something reaches
review-queue.md, and it does NOT scan for em dashes or banned phrases at all -- it only checks
source_lines traceability, char/word limits, spin-angle match, and the routing skip-gate. So if a
drafting pass slips a tell through, nothing mechanically catches it; it relies entirely on the
model remembering plus Muxin catching it in review.
OPTIONS TO WEIGH (not yet decided):
(a) a cheap deterministic lint added to validate.ts -- regex-scan for em dashes + the banned-phrase
    list from voice.yaml, fail the derivative like a char-limit violation does today. Catches the
    mechanical stuff (em dashes, banned phrases/words) for ~free, but can't judge cadence/tone.
(b) an independent LLM review-and-edit pass after drafting -- a fresh Claude call (not the same
    context that drafted) reads the draft against voice.yaml's is/is_not + rewrites anything that
    reads like a brand instead of Muxin talking. Catches tone/cadence a regex can't, costs an extra
    subprocess call per derivative.
(c) both -- deterministic lint as a hard mechanical gate, independent pass for the judgment layer.
GOAL_CONDITION: not yet defined -- depends on which option(s) Muxin wants; scope this once she
decides the approach.
- STATUS: Backlog
- DECISION: defer (build NOT scheduled) -- research done (docs/research/anti-ai-writing-processes.md): de-AI-ing is a PROCESS problem, not a model/prompt one. Primary path stays Muxin's own: Wispr speech-to-text -> light edit that TRIMS TOWARD the spoken roughness (irregular rhythm + concrete specifics), never smoothing to the AI mean. If any tooling is ever built it is a FLAG-ONLY mechanical sweep of structural tells (em dash, tricolon, 'it's not X it's Y', uniform sentence length, delve/underscore/crucial diction, missing concrete detail) -- surfaces them for Muxin to cut, NEVER an AI rewrite (would violate extraction-first + rule 5). No brand-voice-prompt approach (proven to fail). (2026-07-14)
- PARKED: not ready: GOAL_CONDITION not yet defined, depends on which of 3 options Muxin wants + 2026-07-15
<!-- card-id: e26f6e12-73d6-4378-8be8-f43265e2f139 -->

**Analytics tab: insights follow-up ETA text badly undersells actual wait (~10-60s shown, took ~190s)**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Analytics tab)
BUG: The "ask a follow-up" box under Generate insights shows a fixed ETA of "~10-60s, may re-run a report" while the request is in flight. In a real test (query: "why is X underperforming?"), the actual wait was roughly 180-200 seconds before Claude's answer appeared -- 3-4x past the stated upper bound, with zero progress indication or updated messaging during the extra ~2+ minutes of waiting.
UI LOCATION: Analytics tab, Generate insights panel, follow-up ask box (the "tell Claude..." thread under the synthesis result)
REPRO: 1) Analytics tab -> Generate insights (returns quickly if data/analytics.db is empty). 2) Type a follow-up question, e.g. "why is X underperforming?", click Ask. 3) Observe the "Claude is looking into it... (~10-60s, may re-run a report)" message and time how long it actually takes.
OBSERVED: Static ETA text says ~10-60s; actual completion took ~180-200s (close to the server-side 180s hard timeout in src/review/serve.ts:185 INSIGHTS_ASK_TIMEOUT_MS). No intermediate feedback distinguishes "still working, this is normal" from "about to time out." A user watching the literal estimate would reasonably conclude the UI is frozen/broken well before it resolves.
EXPECTED: Either a more honest ETA (e.g. "~1-3 min"), a progress indicator that doesn't imply a hard ceiling at 60s, or a live elapsed-time counter so users can tell it's still working rather than stuck.
ROOT CAUSE: ETA string hardcoded in src/review/page.ts:655 (askInsights()): "Claude is looking into it... (~10-60s, may re-run a report)". Actual bound is the 180s server-side spawn timeout (src/review/serve.ts:185, jobs.ts:259-264) with no client-side abort/progress wiring (page.ts post() at line ~302 is a plain fetch with no AbortController). The feature itself works correctly (real synthesis returned, and on true timeout the server returns a clear "Claude timed out after 180s" error) -- this is a UX/messaging accuracy issue, not a functional failure.
- STATUS: To Do
- GROOMED: UX-messaging fix; hardcoded ETA string pinned (page.ts:655), 180s real bound; author-granted latitude + 2026-07-11
- PARKED: needs decision (judgment): 3 different UX directions for the ETA text (updated copy / progress indicator / elapsed-time counter); recommended: hold — awaiting Muxin's call, 2026-07-14
<!-- card-id: a14693da-75c7-495b-acc2-baadc6973589 -->

**Review tab: video-script/storyboard body clips most content behind an easy-to-miss scroll**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Review tab rendering)
BUG: The VIDEO-SCRIPT/STORYBOARD row type renders its script body in a box with CSS class `body story` (src/review/page.ts, CSS rule `.body.story { ...; max-height:260px; overflow:auto; }`, ~line 83). For a typical 5-paragraph (~1300-char) drafted script, only the first ~1.5 paragraphs are visible in the 260px window. The scrollbar is a subtle macOS-style overlay scrollbar with no always-visible track, and there is no fade gradient, "more below" cue, or expand affordance. Confirmed the box IS scrollable internally (scrolling down over it reveals the rest of the text), but nothing signals that more content exists below the fold.
UI LOCATION: Review tab, any VIDEO-SCRIPT / STORYBOARD row (folder: 2026-06-16-building-an-innovation-nation, row VIDEO-SCRIPT, status blocked) — applies to this row type generally, not just this one row.
REPRO: 1) Open Review tab. 2) Scroll to a VIDEO-SCRIPT/STORYBOARD row. 3) Observe the script body box shows only the first couple paragraphs, cut off mid-word at the box edge, no visible "more content" indicator.
OBSERVED: Script text truncated at a fixed 260px height with only a faint overlay scrollbar as the sole discoverability cue; a reviewer skimming the queue could easily approve/discard a video script without ever seeing most of its content.
EXPECTED: Either a visible scroll affordance (persistent thin scrollbar or fade-out gradient at the clipped edge), or a taller default height / expand-to-read control for the video-script kind specifically, since these bodies are read in full before approval (unlike short social post excerpts).
ROOT CAUSE: src/review/page.ts, CSS rule `.body.story` (~line 83): `max-height:260px; overflow:auto;` with no companion visual affordance signaling clipped content.
- STATUS: To Do
- GROOMED: clip-affordance outcome clear; .body.story CSS surface pinned + 2026-07-11
- PARKED: needs decision (judgment): 2 UX directions for clipped storyboard body (gradient fade vs expand-to-read); recommended: hold — awaiting Muxin's call, 2026-07-14
<!-- card-id: dcb91654-efd0-4992-8820-a9d97c40ac2e -->

**Outreach tab: long status groups clip cards with no scroll affordance**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Outreach tab)
BUG: A status group's card list (.notelist) has a hardcoded max-height:420px with overflow:auto (src/review/page.ts:140) and no visible scroll indicator, so once a group's content exceeds ~420px it silently clips a card mid-content with zero cue that more content exists below.
UI LOCATION: Outreach tab, any status group panel with enough leads/pitch-text length to exceed ~420px (repro'd on RESEARCHED (5): Anthropic, Fireflies.ai, Mem, Notion, Superhuman -- Notion has an unusually long pitch_angle paragraph).
REPRO:
1. Open Outreach tab, scroll the outer page down until the RESEARCHED panel's bottom edge is in view.
2. The panel's rounded border appears to close right after the Notion card, with Notion's <b>name</b>/pitch/dir divs and the entire Superhuman card invisible -- no scrollbar is visible on macOS (overlay scrollbars auto-hide) so it reads as "the list ends here."
3. Verified via DOM inspection (document.querySelectorAll) that all 5 cards ARE present and correctly populated in the DOM at all times -- box.querySelector('.notelist').scrollHeight (668px) > clientHeight (420px) on the RESEARCHED panel confirms it's pure CSS clipping, not a data/render bug.
OBSERVED: A correctly-fetched, correctly-rendered card (Notion) and an entire correctly-rendered card (Superhuman) are invisible with no affordance telling the user there's more to scroll to. This took direct DOM/network inspection to distinguish from a real data-loss bug -- a normal user has no way to tell the difference and would reasonably conclude the app lost or failed to render their data.
EXPECTED: Either remove the fixed max-height (let the group grow with the page, since the outer page already scrolls), or add a visible scroll cue (a bottom fade gradient, a persistent thin scrollbar via `scrollbar-gutter`/webkit-scrollbar styling, or a "N more" indicator) so a clipped list is visually distinguishable from a complete one.
ROOT CAUSE: src/review/page.ts:140 -- `.notelist { max-height:420px; overflow:auto; }`. Shared by the Outreach tab's per-status groups and the Follow-ups tab's per-bucket lists (same class), so any bucket with enough rows/text is subject to the same silent clipping.
- STATUS: To Do
- GROOMED: clip-affordance outcome clear; .notelist max-height:420px pinned (page.ts:140) + 2026-07-11
- PARKED: needs decision (judgment): 2 layout directions for clipped status groups (remove max-height vs add scroll affordance); recommended: hold — awaiting Muxin's call, 2026-07-14
<!-- card-id: 218cb426-115b-4eda-90bd-70fe34408e60 -->

**Close the loop: strategy analysis actively steers the content engine**
- ORIGIN: Muxin request in the 2026-07-14 groom/preflight session; expands and absorbs closed card 9a7656d9.
- GOAL: /strategy analysis becomes a LIVE input to the content engine -- anything that must follow strategy reads from it, and it evolves as the data changes. Not a one-off gate.
- Mechanism: /strategy computes per-platform signals from real analytics, writes them where routing/generation can read them; content steps consult those signals instead of hardcoded defaults.
- Lever A -- Topic/pillar -> platform fit: draft a topic for a platform only where that pillar actually performs there (data-driven, evolving). Absorbs closed card 9a7656d9. Seed priors ONLY: X=engineering thinking, LinkedIn=career + professional development, Substack=society + human/reflective.
- Lever B -- Media-mix: when images/video are outperforming text on a platform, bias /atomize + /video toward that media there instead of a fixed text-first default.
- Lever C -- Timing (cadence + time-of-day): feed resonance trends into posts_per_week / slot cadence AND slot_time_pst -- post more where engagement is climbing, AND at the times of day that actually perform per platform, not fixed windows.
- Lever D -- Spin-angle emphasis: which framing (case-first, technical-outsider, ...) is converting per platform -> weight the angle accordingly.
- Lever E -- CTA effectiveness: which CTA types actually drive clicks/leads -> recommend the CTA. Ties into c02ff4aa (tactical/useful CTA).
- SCOPE: all five levers + time-of-day approved by Muxin 2026-07-14. This is an EPIC -- grooming should break out an individual build card per lever, not build it as one blob.
- RULE 7: every lever's generation change is content-gen LOGIC -> each build card is a HELD draft PR with before/after samples. None auto-merges.
CARD TYPE: EPIC
- STATUS: To Do
- GROOMED: readiness pass: epic wrapper, scope approved by Muxin 2026-07-14, lever decomposition already done as child cards + 2026-07-15
- PARKED: needs decision (judgment): deploying strategy levers (A-E) untested against real engagement data carries a risk of degrading content performance; recommended: stage -- build per-lever + validate before wiring live, awaiting Muxin's call, 2026-07-15
<!-- card-id: 2ce597d7-acdc-4887-af88-1620fbac16f6 -->

**Strategy lever A: gate content by pillar performance per platform (topic-fit routing)**
- Compute per-platform pillar engagement from analytics each /strategy run
- Write platform-pillar fit data where route.ts can read it (config/strategy/ or data/strategy/)
- Route conditionally gates derivative drafting: skip platforms where source pillar underperforms
- Seed priors: X=engineering thinking, LinkedIn=careers/building, Substack=reflective (per Muxin 2026-07-14)
- Test: /atomize on a piece strong in Substack pillar but weak in X pillar produces Substack derivatives only, skips X
- GOAL_CONDITION: route.ts reads strategy-computed pillar-performance signal per platform instead of hardcoded defaults; /atomize skips platforms where source pillar lacks data-backed fit; npm test green.
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Close the loop: strategy analysis actively steers the content engine (2ce597d7-acdc-4887-af88-1620fbac16f6)
- SCOPE RECONCILED (Muxin, 2026-07-15): this card's literal wording ("route.ts auto-skips
  underperforming platforms") conflicted with the locked card 7e550e48 decision (fit score never
  overrides config/routing.yaml's defaults -- auto-gating surprised Muxin) and with 9a7656d9's
  overfitting/algorithmic-risk flag. Raised the conflict; Muxin's call: "inform me, I decide" --
  given her explicit concern about overfitting to thin/early signal, this builds the
  measurement + RECOMMENDATION half only. route.ts's decision logic and config/routing.yaml
  defaults are untouched (7e550e48 stays intact); nothing auto-changes what /atomize drafts. A
  thin cell (n<3 or <4wks) always reads insufficient-data, never a forced lean-in/ease-off.
  Auto-acting on well-proven pairs is deferred to a future data-gated card once volume is thick
  enough to trust.
- SHIP: held (draft PR #220 -- repo CLAUDE.md Rule 7, content-generation-adjacent strategy logic,
  needs Muxin's review; before/after sample + Bluesky seed-prior confirmation ask in PR body)
- STATUS: Review
- DECISION: hold -- epic 2ce597d7 already approved this lever's scope 2026-07-14, and seed priors are already stated on this card (X=engineering, LinkedIn=careers/building, Substack=reflective, per Muxin 2026-07-14). Built as a RECOMMENDATION-only layer per the 2026-07-15 reconciliation above; PR opens as a HELD draft with before/after samples per rule 7 (routing/content-gen logic) and per the epic's own 'None auto-merges' statement -- no live-posting risk before her review. (pre-flight 2026-07-14)
- GROOMED: readiness pass, no blocking unknowns + 2026-07-14
<!-- card-id: c7638362-5149-4b51-b414-17f24a94ccf7 -->

**Strategy lever B: bias media type (text/image/video) by platform resonance trends**
- Compute per-platform media-type resonance: text engagement vs images vs video from analytics
- Write media preference to config/strategy/ for /atomize + /video to read
- Bias derivative generation toward highest-resonating media type per platform
- Default text-first where data is thin; prefer video/images where they demonstrably outperform
- Test: /atomize on platform where video outperforms text queues prioritized video derivatives
- GOAL_CONDITION: /atomize + /video read strategy-computed media-type preference per platform; generation biases toward highest-performing media instead of fixed text-first default; npm test green.
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Close the loop: strategy analysis actively steers the content engine (2ce597d7-acdc-4887-af88-1620fbac16f6)
- SCOPE RECONCILED (Muxin, 2026-07-15): the card's own test ("queues prioritized video
  derivatives") is structurally impossible without /atomize auto-invoking /video, which is
  deliberately the separately-invoked, human-gated, real-cost path (storyboard approval,
  keyframe approval, "offer cost first, never auto-escalate" per CLAUDE.md rule 6). Raised the
  conflict; Muxin's call: recommend only, never auto-trigger -- same "inform me, I decide"
  resolution as Lever A (c7638362), extended to this axis. /atomize's generation contract (always
  text + quote-card per routed platform) and /video's invocation model (always human-invoked) are
  both untouched. A thin cell on either side of a text-vs-media comparison always reads
  insufficient-data, never a forced lean/steady read.
- SHIP: held (draft PR #222 -- repo CLAUDE.md Rule 7, content-generation-adjacent strategy logic,
  needs Muxin's review; before/after sample in PR body, builds on merged Lever A/#220)
- STATUS: Review
- DECISION: hold -- epic-approved scope (2ce597d7, 2026-07-14); GOAL_CONDITION and test are explicit. Built as a RECOMMENDATION-only layer per the 2026-07-15 reconciliation above; PR opens as a HELD draft per rule 7 -- no live-posting risk before review. (pre-flight 2026-07-14)
- GROOMED: readiness pass, no blocking unknowns + 2026-07-14
<!-- card-id: 27dc7d2d-afee-4e20-9552-b8aa58bd6382 -->

**Strategy lever C: adapt posting cadence + time-of-day by engagement trends per platform**
- Compute per-platform engagement trends (climbing/stable/declining) + daily time-of-day peak hours
- Write adaptive cadence (posts_per_week per platform) + times (slot_time_pst per platform) to config
- /publish reads dynamic cadence/time windows per platform instead of fixed defaults
- Post more frequently where engagement is climbing; respect each platform's peak posting hours
- Test: platform with trending-up engagement shows increased posts_per_week; Typefully scheduling respects per-platform time windows
- GOAL_CONDITION: /publish reads per-platform posts_per_week + slot_time_pst from strategy output; posting cadence + timing adapt per platform to engagement trends; npm test green.
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Close the loop: strategy analysis actively steers the content engine (2ce597d7-acdc-4887-af88-1620fbac16f6)
- SCOPE RECONCILED (Muxin, 2026-07-15): unlike Levers A/B, Muxin's call here was NOT recommend-only
  -- "auto-write a config I approve." src/strategy/cadence-fit.ts -- write proposes per-platform
  posts_per_week + slot_time_pst into config/schedule-overrides.yaml (seeded/shipped inert,
  approved: false); src/publish/slots.ts's loadSchedule() only applies it once Muxin sets
  approved: true herself. Over-posting/rate-limit risk (flagged in the original DECISION) is
  guarded four ways: approved:false default, a conservative single-step posts_per_week nudge
  (never a jump), a hard max_posts_per_week ceiling, and review-queue.md still gating every actual
  publish. Separately: X and LinkedIn's analytics capture only the posting DATE, not the hour --
  every post lands on a synthetic timestamp with no real time-of-day signal (X: 1 distinct PT hour
  across 225 posts; LinkedIn: 1 distinct PT hour across 73). Peak-hour reads for both are correctly
  suppressed as insufficient-data via a distinct-hours-seen guard; only Bluesky has real
  timestamps today. Filed a follow-up card (below) to capture real X/LinkedIn post times in
  ingest. A thin trend window (n<3) always reads insufficient-data, same overfitting posture as
  Levers A/B.
- SHIP: held (draft PR #224 -- repo CLAUDE.md Rule 7, content-generation-adjacent strategy logic
  AND a live-scheduler seam, needs Muxin's review; before/after sample + the four over-posting
  guards + the X/LinkedIn timestamp gap all called out in PR body; builds on merged Levers
  A/#220 and B/#222)
- STATUS: Review
- DECISION: hold -- epic-approved scope (2ce597d7, 2026-07-14). This lever changes live posting cadence/timing, so extra scrutiny is warranted at review -- but building and opening a draft PR carries no live-posting risk by itself (nothing merges/deploys without Muxin's review per rule 7 and the epic's 'None auto-merges' statement). Flag the over-posting/rate-limit risk prominently in the PR description for her review. (pre-flight 2026-07-14)
- GROOMED: readiness pass, no blocking unknowns + 2026-07-14
<!-- card-id: ed23f712-b34d-442c-9d5d-c07b10924924 -->

**Strategy lever D: weight spin angles by conversion performance per platform**
- Score which narrative frame (case-first, technical-outsider, etc) drives conversions per platform from publish-log
- Write angle weight scores to config/strategy/ for spin selection probability
- Spin logic reads weights; higher-scoring angles selected with higher frequency per platform
- Builds on existing per-channel angle templates (c42769b1, 1eeb82a4) — this layer weights them by real conversion data
- Test: /atomize on platform where case-first spin drives conversions preferentially selects case-study angle over other spins
- GOAL_CONDITION: Spin selection reads strategy-computed angle weights per platform; higher-converting narrative frames selected with higher probability; npm test green.
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Close the loop: strategy analysis actively steers the content engine (2ce597d7-acdc-4887-af88-1620fbac16f6)
- SCOPE RECONCILED (Muxin, 2026-07-15): the card's literal ask ("weight spin angles by conversion
  performance") is not buildable today, confirmed by codebase audit: angle is 1:1 with platform
  (src/atomize/spin.ts's resolveAngle(platform) is a straight lookup -- no angle A vs angle B to
  weight within a platform), and no conversion/lead metric exists in the analytics DB (clicks sum
  to ~40 across 1,229 metric rows, NULL on linkedin/bluesky entirely). Reframed to the one framing
  contrast the DB actually supports: spin-on vs the verbatim spin-control-run baseline (card
  f444f440's periodic control run), by engagement, per platform -- src/strategy/frame-fit.ts. This
  closes the loop on the existing spin-control experiment rather than inventing a fake angle-vs-
  angle comparison. Recommendation only, same posture as Levers A/B -- src/atomize/spin.ts's
  per-platform angle stays untouched. Expect mostly insufficient-data today (posts.source untagged
  on most distributed posts, spin-control coverage accrues one pick/month) -- same overfitting
  posture as A/B/C, filling in over time. Filed a follow-up card (below) to persist per-post
  framing tags (angle/case_skeleton/directives_applied) to the DB so a future pass can weight
  individual angles, not just spin-on/off.
- SHIP: held (draft PR #226 -- repo CLAUDE.md Rule 7, content-generation-adjacent strategy logic,
  needs Muxin's review; real + synthetic before/after samples in PR body, including the reframe
  rationale; builds on merged Levers A/#220, B/#222, C/#224)
- STATUS: Review
- DECISION: hold -- epic-approved scope (2ce597d7, 2026-07-14), GOAL_CONDITION explicit, builds on existing per-channel angle templates. PR opens as a HELD draft per rule 7 (content-gen logic: spin-angle selection weighting). (pre-flight 2026-07-14)
- GROOMED: readiness pass, no blocking unknowns + 2026-07-14
<!-- card-id: a4c5b42b-d3a5-4547-964c-58eb4c4507a4 -->

<!-- card-id: 6b2f9d31-4e7c-4a58-9d0b-1f3a7e2c8b45 -->

**Persist per-post framing tags (angle / case_skeleton / directives_applied) to the analytics DB**
- Currently a derivative's angle, case_skeleton flag, and directives_applied list live only in per-derivative frontmatter (content/<slug>/derivatives/*.md) -- never written to data/analytics.db
- Design + implement a linkage so posts.angle (and ideally case_skeleton/directives_applied) get persisted when a post is tagged/ingested, joinable to metrics
- Unblocks a future pass on Lever D (card a4c5b42b) that weights individual angles/directives by measured performance, not just the coarse spin-on/off split frame-fit.ts computes today
- Test: a newly-ingested post's angle is queryable via SQL joined to its metrics row
- GOAL_CONDITION: per-post framing tags are persisted to analytics.db at tag time; a query can join angle/case_skeleton/directives_applied to engagement metrics; npm test green.
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: filed by the a4c5b42b (lever D) build worker 2026-07-15 as a data-gap follow-up -- not part of the original epic decomposition.
- STATUS: To Do
- DECISION: hold -- needs the frontmatter-to-DB linkage designed (which file/step writes it, whether it's a new posts column or a side table) before scoping the build; not epic-approved on its own, revisit once Lever D's frame-fit signal is showing real reads and a deeper angle-level cut is actually wanted.
<!-- card-id: 6b2f9d31-4e7c-4a58-9d0b-1f3a7e2c8b45 -->

**Strategy lever E: recommend CTAs by click-through + lead-gen effectiveness per platform**
- Score per-platform CTA type effectiveness from publish-log + analytics (which CTA drives clicks/replies/conversions)
- Write CTA recommendations to strategy brief + config/strategy/ for content generation to read
- Content routing + derivative composition read CTA preference; recommend highest-performing CTA per platform
- Fallback to defaults where data is thin; weight recommendations by statistical significance
- Test: /strategy identifies platform's best-performing CTA; /atomize + /publish route that CTA in preference for that platform
- GOAL_CONDITION: /strategy scores CTA effectiveness per platform from analytics; /atomize + /publish read and prioritize highest-converting CTA type per platform; npm test green.
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Close the loop: strategy analysis actively steers the content engine (2ce597d7-acdc-4887-af88-1620fbac16f6)
- STATUS: To Do
- DECISION: hold -- epic-approved scope (2ce597d7, 2026-07-14). CTA-effectiveness methodology (metrics/weighting/significance threshold) is underspecified; build worker should choose a reasonable default (e.g. click-through rate, minimum sample size) and flag the choice explicitly in the PR for Muxin to adjust at review. PR opens as a HELD draft per rule 7. (pre-flight 2026-07-14)
- GROOMED: readiness pass, no blocking unknowns + 2026-07-14
<!-- card-id: d80411bc-5884-4cfe-a471-a2f887fc36dc -->

**Capture real X/LinkedIn post times in ingest (unblocks lever C time-of-day for X/LinkedIn)**
- Found building Strategy lever C (card ed23f712, PR #224): src/strategy/cadence-fit.ts's
  peak-posting-hour read correctly suppresses X and LinkedIn as insufficient-data, because their
  analytics exports only carry the posting DATE, not the hour -- src/ingest/parse-x.ts and
  src/ingest/parse-linkedin.ts parse a bare `YYYY-MM-DD` into a synthetic local-midnight
  timestamp (`new Date(date).toISOString()` / `safeIso`), so every post lands on one or two
  distinct UTC hours regardless of when it actually went out (X: 1 distinct PT hour across 225
  posts; LinkedIn: 1 distinct PT hour across 73). Only Bluesky (fetch-bluesky.ts pulls the API's
  real `record.createdAt`) and Substack Notes carry true per-post timestamps today.
- Investigate whether X's/LinkedIn's own analytics export (or their APIs) actually expose a
  real per-post timestamp anywhere Muxin can pull from, and if so wire it into
  src/ingest/parse-x.ts / parse-linkedin.ts so posts.posted_at carries a real hour instead of a
  parsing artifact.
- GOAL_CONDITION: newly ingested X/LinkedIn posts carry a real (non-synthetic) posted_at
  timestamp where the source data supports it; src/strategy/cadence-fit.ts's peak-hour read for
  X/LinkedIn stops reading insufficient-data once enough real-timestamped posts accumulate (no
  code change needed there -- the existing distinct-hours-seen guard already unlocks once the
  data does); npm test green.
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: filed by the ed23f712 (lever C) build worker, 2026-07-15, as a data-gap follow-up --
  not part of the original epic decomposition.
- STATUS: To Do
- DECISION: hold -- this is a data/ingest investigation (does the export or API even expose a
  real timestamp?), not a decided build; needs a quick research pass before scoping the actual
  change. Not itself content-generation logic (rule 7 doesn't apply), but the eventual parser
  change should be reviewed since it changes what posts.posted_at means downstream.
<!-- card-id: 6f1a2e9c-8b4a-4c37-9e5f-2b7d4c9a3e61 -->

**Add Threads as a supported publishing platform (official Graph API)**
- Meta opened the Threads API to broader third-party publishing in 2026 -- richer post types, search/profile discovery, reply management, and real-time publish/delete notifications for third-party apps.
- Per Meta's publishing reference (developers.facebook.com/docs/threads/reference/publishing/): text-only posts require a `text` parameter and support an `auto_publish_text` flag for single-call publishing -- a straightforward REST integration, no browser automation needed.
- Access requires Meta App Review before production use; publishing is rate-limited by an impressions-based formula plus hard 24h caps (per third-party pricing writeups referencing Meta's limits: 250 posts / 1,000 replies / 100 deletions per profile per day) -- worth sizing against current posting cadence in config/platforms.yaml before committing.
- content-agents currently has no Threads adapter or routing entry; this would be a new src/providers/publish/ adapter (likely direct-API, since Typefully does not support Threads), a config/platforms.yaml cadence entry, and a routing.yaml pillar-fit decision -- same shape as the existing Bluesky/X/LinkedIn integrations.
- ORIGIN: idea-scout 2026-07-14 — platform-api-change
- NEEDS DECISION: machine-invented candidate; explicit human promotion required
- EVIDENCE: https://developers.facebook.com/docs/threads/reference/publishing/ (retrieved 2026-07-14)
- HYPOTHESIS: The Threads API's publishing reference requires a `text` parameter for text-only posts and supports an `auto_publish_text` flag for single-call publishing, with expanded third-party publishing, search, analytics, and reply-management access for external apps. Uncertainty: Exact current rate limits and whether Meta App Review approval is fast/easy for a solo creator's small volume were not independently confirmed from a primary Meta source (the 250/1,000/100-per-day figures came from a third-party pricing blog, not developers.facebook.com directly) -- needs verification during build before committing to cadence assumptions.
- GOAL_CONDITION: A /publish run for a content folder with an approved text derivative routed to `threads` creates a live Threads post via the official Threads Graph API (returns a real post ID, verifiable on threads.net), with `threads` present as a platform in config/platforms.yaml and covered by the unified slot scheduler (src/publish/slots.ts) like every other channel.
- STATUS: To Do
- GROOMED: readiness pass, no blocking unknowns + 2026-07-14
- PARKED: needs decision (judgment, idea-scout): new publishing platform; Meta App Review timeline + 250/day rate limit need verification before committing to cadence; recommended: stage — awaiting Muxin's call, 2026-07-14
<!-- card-id: bad4fb64-135f-4ff5-8e9d-0a622c6491e2 -->

**AI-voice disclosure for video shorts ahead of EU AI Act Article 50 (2026-08-02)**
- EU AI Act Article 50, effective 2026-08-02, requires that synthetic AI-generated outputs (including audio) be marked in machine-readable form, and per the Code of Practice draft, disclosure should be prominent/user-facing rather than buried in back-end metadata only.
- content-agents' /video pipeline renders every published short's voiceover via local Kokoro-ONNX TTS -- a fully synthetic voice -- and there is currently no disclosure/label step anywhere in the storyboard-review flow (video/storyboard.md) or in review-queue.md/publish.
- A separate New York law (A8887-B, effective 2026-06-09) requires conspicuous disclosure of 'synthetic performer' use in ads but explicitly carves out audio-only ads -- narrowing but not eliminating exposure here, since these are full videos (visuals + synthetic narration), not audio-only.
- Buildable as: a required disclosure field/toggle added at storyboard-approval time in review-queue.md (mirroring how quote-card image-render gating already blocks Approve without a rendered image), rendered as on-screen text/caption in the exported video, plus setting each platform's own native AI-content toggle at upload where one exists (YouTube and TikTok both expose creator-facing AI-content disclosure toggles at upload time).
- ORIGIN: idea-scout 2026-07-14 — compliance-regulatory
- NEEDS DECISION: machine-invented candidate; explicit human promotion required
- EVIDENCE: https://www.dynamisllp.com/knowledge/ai-disclosure-in-2026-recent-developments-and-practical-steps-for-brands-and-influencers (retrieved 2026-07-14)
- HYPOTHESIS: EU AI Act Article 50 (effective 2026-08-02) requires providers of AI systems generating synthetic outputs to mark those outputs in machine-readable form, and deployers must disclose deepfakes/AI-generated content to end users, with the Code of Practice draft favoring prominent user-facing disclosure over metadata-only marking. Uncertainty: Unclear whether a solo US-based creator with an EU-reachable but not EU-targeted audience is squarely in scope of Article 50's deployer obligations, and unclear whether Kokoro-TTS narration alone (without a synthetic on-screen avatar/face) counts as a 'deepfake' or falls under the narrower 'synthetic audio output' marking duty versus the stricter public-interest-content disclosure duty -- needs a real legal read before deciding exact disclosure copy/placement.
- GOAL_CONDITION: Every video short produced by /video and pushed live by /publish carries a verifiable AI-voice disclosure (on-screen caption/overlay in the rendered .mp4, or the platform's native AI-generated-content upload toggle set to on) before its review-queue row can be set to `approve`; a storyboard missing this field fails a precheck rather than silently publishing undisclosed synthetic narration.
- STATUS: To Do
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: needs decision (judgment, idea-scout): EU AI Act Article 50 effective 2026-08-02 (18 days out); scope applicability + disclosure copy/placement undecided; recommended: stage — awaiting Muxin's call, 2026-07-14
<!-- card-id: 2775170f-14df-4cc0-a045-6d51ebcd9dec -->

**Live smoke-test cancel endpoints (Typefully + PostPeer)**
- ORIGIN: follow-up auto-filed from card e4eca4a1 (cancel capability for scheduled posts). Neither Typefully DELETE /v2/social-sets/{setId}/drafts/{id} nor PostPeer DELETE /v1/posts/{id} is officially documented -- endpoint shapes were inferred from existing REST conventions in the codebase and should be verified against a real scheduled post before relying on them in production.
- GAP: no live smoke test has confirmed either DELETE endpoint actually cancels a real scheduled post at the provider (both are covered by unit tests with injected/fake providers only).
- ROUGH SCOPE (needs grooming): schedule one disposable Typefully draft and one disposable PostPeer post, then trigger the review GUI Cancel action (or a scratch script calling cancelDraft/cancelPost directly) against each and confirm the provider actually cancels it. Depends on live API access to both providers.
- CHAIN: 1
- STATUS: To Do
- DECISION: none yet.
- GROOMED: readiness pass: concrete scope: disposable Typefully draft + PostPeer post, trigger cancel, confirm provider cancels + 2026-07-15
<!-- card-id: df9cdce6-2c67-4c69-9578-811efba9dc48 -->

**Integrate JSA manual_research.db into Follow-ups tab jobsearch bucket**
- Epic 659b50f0 specifies jobsearch bucket as 'pluggable per the c308a8cf Level-2 recommendation (native events, or read-only JSA pull if Muxin picks option (a))'
- Phase 4 (21a5eb84) shipped schema for jobsearch bucket from tracker.jsonl but doesn't explicitly wire JSA's manual_research.db read
- Need to poll JSA's manual_research.db (read-only via JSA_DB_PATH, existing pattern from Phase 1) and populate Follow-ups tab rows for TARGET/CONSIDER verdicts
- Row state (contacted→waiting→responded→follow-up-sent, etc.) still tracked natively in tracker.jsonl per option (b), but initial candidate population comes from JSA
- GOAL_CONDITION: Follow-ups tab's jobsearch bucket renders job-search leads from JSA's manual_research.db with correct state derivation from tracker.jsonl; a TARGET verdict from JSA appears as a contact-candidate row with last_touch and next_action computed from tracker history
- PARENT: 659b50f0-6bc7-473b-8673-b901e9c93d11
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Unified follow-up tracking ("Follow-ups" tab) across client, platform, inbound, and job-search outreach (659b50f0-6bc7-473b-8673-b901e9c93d11)
- SHIP: verified already shipped, no build needed -- buildJobsearchRows() (src/outreach/tracker.ts)
  joins JSA TARGET verdicts via the read-only src/outreach/jsa.ts reader, tested in
  tracker.test.ts. Landed in Phase 1 (#167) + Phase 4 (#187), before this propose-cards-generated
  card was even filed (2026-07-14). Duplicate of already-shipped work -- concrete instance of the
  cold-decomposition duplication bug c8fc8ac3 targets. (verified 2026-07-15)
- STATUS: Done
- GROOMED: readiness pass: clear GOAL_CONDITION, reuses existing JSA_DB_PATH read-only pattern from Phase 1 + 2026-07-15
<!-- card-id: 6f6c5d06-082b-4174-9735-77f125549ff5 -->

**Implement follow-up message drafting from the Follow-ups tab**
- Epic 659b50f0 specifies ROW SHAPE includes 'one-click mark-responded / send-follow-up / move-on' but only mark-as-sent is filed (240ba67)
- send-follow-up action needs to draft a follow-up message (reusing src/atomize/reply-draft.ts pattern for voice.yaml compliance) and surface it in review-queue for approval
- Message context: locked core-message from the lead's lead.md + time-since-contact + prior message history from tracker.jsonl, draft to review-queue.md as a new row type (follow-up-draft)
- No auto-send — mirrors the review → approve posture of db22283f (voice replies draft-only)
- GOAL_CONDITION: Clicking 'send-follow-up' on a Follow-ups tab row (any bucket) generates a voice.yaml-compliant draft message in review-queue.md as row type follow-up-draft with source_lines tracing to lead.md + prior touch history; npm test covers draft+approve flow with no network calls in dry-run
- PARENT: 659b50f0-6bc7-473b-8673-b901e9c93d11
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Unified follow-up tracking ("Follow-ups" tab) across client, platform, inbound, and job-search outreach (659b50f0-6bc7-473b-8673-b901e9c93d11)
- STATUS: To Do
- DECISION: hold -- epic 659b50f0 already approved this row-shape/action ('send-follow-up', draft-only, no auto-send). Scope is clear (reuses src/atomize/reply-draft.ts pattern for voice.yaml compliance). Message-drafting is content-generation-adjacent logic in spirit of rule 7 (produces text Muxin will read/send), so PR HOLDS for review with a real before/after sample rather than auto-merging. (pre-flight 2026-07-14)
- SHIP: verified already shipped, no build needed -- enqueueFollowUpDraft (src/review/jobs.ts) ->
  runDraft (src/outreach/draft.ts, the correct composed-prose Spin path, CLAUDE.md rule 1's scoped
  exception) writes messages/message-NN.md + a pending review-queue.md row, wired to the Follow-ups
  tab's "Draft follow-up" button, hardened for durability/dedup/logging in #215. Landed via #187,
  #207, #215 -- before this propose-cards-generated card was filed (2026-07-14). Scope deltas from
  the literal card text (satisfied in spirit, not worth a rebuild): reuses outreach/draft.ts not
  reply-draft.ts; writes a normal `pending` row, not a distinct `follow-up-draft` row type; only
  fires for client/platform leads with a `dir` (jobsearch/inbound rows have none, so no Draft
  button there yet -- a real but minor residual, flagged for Muxin's call, not auto-filed as a new
  card). (verified 2026-07-15)
- STATUS: Done
- GROOMED: readiness pass: clear GOAL_CONDITION, reuses src/atomize/reply-draft.ts pattern, draft-only mirrors db22283f + 2026-07-15
<!-- card-id: 60743d7a-4919-4776-8c33-596b526c9455 -->

**Wire per-platform inbound listening sources into Follow-ups tracker**
- Inbound listening cards (ec217518, aab14467, 81808fa0) exist but don't explicitly feed into tracker.jsonl — they detect mentions/replies and dedup via ledger, but Follow-ups tab's inbound bucket stays empty
- Epic 659b50f0 says 'inbound bucket is schema-ready from day one but stays empty until db22283f lands' — db22283f (voice replies) is shipped, but the PLUMBING to append inbound events to tracker.jsonl doesn't exist yet
- Need a new module (src/cron/inbound-to-tracker.ts or similar) that runs after each inbound-listening pass and writes mentions/replies as tracker.jsonl events (bucket: inbound, who: author, why: extracted mention/reply context)
- GOAL_CONDITION: After /cron/inbound-to-tracker runs following an inbound-listening pass, a mention detected on Bluesky appears as a tracker.jsonl event and renders in Follow-ups tab inbound bucket with correct last_touch and next_action ("draft reply" or "responded")
- PARENT: 659b50f0-6bc7-473b-8673-b901e9c93d11
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Unified follow-up tracking ("Follow-ups" tab) across client, platform, inbound, and job-search outreach (659b50f0-6bc7-473b-8673-b901e9c93d11)
- VERIFIED NOT BUILT (2026-07-15): confirmed the real gap still stands -- no src/cron/inbound-to-tracker.ts
  or equivalent exists; nothing appends bucket:"inbound" tracker events; src/cron/bluesky-mentions.ts
  writes only its own ledger (data/bluesky-mentions-ledger.jsonl); buildInboundRows()
  (src/outreach/tracker.ts) still returns [] with the literal "(inbound listening not built yet --
  db22283f)" placeholder note. This is the next real build in this epic, unlike its two siblings
  (6f6c5d06, 60743d7a) which turned out already shipped.
- OPEN DESIGN QUESTION (not a readiness gap to guess past): the tracker's event vocabulary
  (contacted/responded/no_response/followup_sent/scheduled/done/abandoned, src/outreach/tracker.ts)
  is outbound-oriented ("I reached out"). An inbound mention is the reverse -- someone reached out
  to Muxin -- so mapping it to next_action "draft reply" vs "responded" needs either a new event
  semantics (e.g. treat the mention itself as the clock-start, "responded" only once Muxin actually
  replies) or an explicit documented reverse-mapping decision. Surface this to Muxin before
  scoping the build, don't guess.
- STATUS: To Do
- GROOMED: readiness pass: clear GOAL_CONDITION, points at new src/cron/inbound-to-tracker.ts module + 2026-07-15
<!-- card-id: 97588dc8-feff-4fe4-8224-1b4d2d211ada -->

**Measure strategy lever effectiveness against baseline**
- Epic 2ce597d7 builds 5 levers that steer content generation, but once deployed they need validation: do they actually improve performance vs. the hardcoded defaults they replace?
- Each lever card includes a test (e.g. 'Test: /atomize on a piece strong in Substack pillar but weak in X pillar produces Substack derivatives only') but these are unit tests, not outcome measurement
- Need a lightweight post-publish feedback loop: track which strategy lever was active for each published piece, measure engagement delta (pillar fit → resonance lift, media-type bias → click lift, CTA choice → conversion lift), and surface findings in /strategy brief or a dedicated signals-effectiveness report
- GOAL_CONDITION: A strategy-validation report (printed by /strategy or a separate command) shows per-lever engagement deltas: pieces routed via Lever A to platform-fit pillars show X% resonance lift vs. baseline, media-type bias (Lever B) shows Y% engagement lift, etc.; uncertainty/sample-size flags included where data is thin
- PARENT: 2ce597d7-acdc-4887-af88-1620fbac16f6
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Close the loop: strategy analysis actively steers the content engine (2ce597d7-acdc-4887-af88-1620fbac16f6)
- STATUS: To Do
- GROOMED: readiness pass: clear GOAL_CONDITION, lightweight post-publish feedback loop scope is concrete + 2026-07-15
<!-- card-id: 83166c51-e65f-41cc-92eb-53e5e8cf1ea5 -->

**Rename propose-cards → follow-up-cards; retarget scope to post-card discovery, not cold epic-decomposition**
- ORIGIN: correction to a misunderstanding surfaced 2026-07-15. Muxin's actual intent for this Pre-flight stage was "when the conductor finishes a card, let it propose follow-up cards for anything it discovered mid-work that aligns with the card's epic/goal" — NOT what `propose-cards` (skills/propose-cards/SKILL.md, repo heymoosh/claude-config) actually does today: a cold, Stage-0, pre-batch pass that reads existing epic/goal-flavored cards and decomposes their stated-but-unfiled children from prose, with zero visibility into what any specific card's execution actually produced.
- WANTED BEHAVIOR: after a card completes (Step 6 / Done), generate up to N follow-up candidates seeded from what THAT card's own work surfaced (new issues found, incomplete edges, related work uncovered) — not from re-reading epic prose cold. Should still respect the epic/goal the completed card traces to, and reuse the current skill's existing safety mechanics (Backlog-only deposit, dedup pass, ORIGIN marker, cap per run, never-auto-promote) — just change the trigger point and the generation input.
- DECISION (Muxin, 2026-07-15): this REPLACES the existing cold epic-decomposition mode entirely — not a second mode running alongside it.
- DECISION (Muxin, 2026-07-15): generation runs as a delegated subprocess (same pattern the current skill already uses for its `claude -p` generator), not inline in the conductor's own context — "subprocess may be fine if it works." Still open: exactly what feeds that subprocess (the card's PR diff? its final worker transcript? its Review-stage self-vet notes? some combination) — needs a decision before this builds, don't guess.
- RENAME: `propose-cards` -> `follow-up-cards` throughout (skill dir, SKILL.md, all cross-references in orchestrate-pipeline SKILL.md / references/preflight.md / references/cold-start.md, any conductor step that invokes it).
- EVIDENCE (2026-07-15, content-agents board hygiene pass): a live instance of exactly the
  duplication problem this card exists to fix. propose-cards' 2026-07-14 cold decomposition of
  epic 659b50f0 filed three children (6f6c5d06, 60743d7a, 97588dc8); two of the three
  (6f6c5d06, 60743d7a) turned out to already be fully shipped by the epic's own Phase 1/4 build
  (#167, #187, #207, #215) before the cold pass even ran -- because it reads epic prose, not what
  the epic's actual execution already produced. Only 97588dc8 was a real gap. Concrete data point
  for this card's WANTED BEHAVIOR (seed from a completed card's own work, not epic prose).
- STATUS: Backlog
- LANE: claude-config (~/.claude) — this is a conductor-mechanism/global-skill change, not a content-agents content change. Build there per the repo's own conductor carve-out (worktree off ~/.claude, base branch master, no backlog_path).
<!-- card-id: c8fc8ac3-ac1a-4471-9f22-916752143960 -->

**Code-enforce research.ts per-signal search budget (currently prompt-text-only)**
- Discovered during fb4d6b28's Step 3.5 code-review: research.ts search_budget_per_signal (config/outreach.yaml, default 2/signal) is enforced only as prompt text ("search at most N times") passed to the claude-cli subprocess, not as code-level call interception. The hard subprocess timeout (5-8 min) IS genuinely enforced via Node timeout option -- only the per-signal count lacks a code-level backstop.
- Not a blocker: the timeout already bounds worst-case wall-clock/cost even if the LLM ignores the budget hint. This is a tightening, not a bug.
- CHAIN: 1
- Superseded 2026-07-15: this session was ceiling-killed with no commits ever made (see PARKED note below); the resume card 43fa1e02 built and shipped this exact scope (PR #216, merged 2026-07-15, code-enforces the budget via a PreToolUse hook). Marking Done here too so this card doesn't stay stuck showing STATUS: In Progress forever.
- STATUS: Done
- DEPENDS ON: Resume Outreach engine Phase 1 build (restart — ceiling-killed session, no worktree ever created)
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: hard context/turn ceiling exceeded (turns=206 tokens=194517) -- session killed mid-card by the watchdog safety valve, never resumed (2026-07-15)
<!-- card-id: 3c6550a6-a388-44cf-a56e-e9d35423b3f1 -->

**Update .claude/skills/atomize + outreach SKILL.md for Phase 2 (draft/lock) + Phase 3 (platform-kind)**
- ORIGIN: follow-up auto-filed while building card d5b34590 (Outreach engine Phase 2: decision gate, draft, lock, /atomize reuse).
- .claude/skills/atomize/SKILL.md step-4 frontmatter example should document `outreach_message: true` so a live /atomize run actually stamps the marker src/db/tag-source.ts now knows how to read. .claude/skills/outreach/SKILL.md non-negotiable-rule-1 and its subcommand list need draft/lock added, replacing any "Phase 2 not built yet" language.
- Could not be done inside the Phase 2 build itself -- writes under .claude/ are not grantable to a headless worker in that session (same constraint card ebe652a7 hit; needs an attended/interactive run).
- EXTENDED (2026-07-10, while building Phase 3 card 6590efec): outreach/SKILL.md also needs a platform-kind walkthrough (mirroring the client-kind flow) and documentation of `outreach:status --targets` -- same headless .claude/ write-permission wall, same attended session can fix both at once.
- GOAL_CONDITION: both SKILL.md files describe outreach:draft and outreach:lock as shipped (not pending), atomize/SKILL.md documents the outreach_message: true frontmatter marker, and outreach/SKILL.md documents the platform-kind flow + outreach:status --targets.
- CHAIN: 1
- Superseded 2026-07-15: this session was ceiling-killed but left its uncommitted diff salvageable in the stale worktree; the resume card 4e5b33d0 verified that diff against the GOAL_CONDITION and shipped it as-is (PR #217, merged 2026-07-15). Marking Done here too so this card doesn't stay stuck showing STATUS: In Progress forever.
- STATUS: Done
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: hard context/turn ceiling exceeded (turns=250 tokens=222823) -- session killed mid-card by the watchdog safety valve, never resumed (2026-07-15)
<!-- card-id: cccfc43a-6547-4f08-aeb4-3e76e7e27c49 -->

**Write/source an anonymized case note for the LinkedIn case-first spin angle to work from**
- ORIGIN: follow-up auto-filed while building card c42769b1 (Update per-channel spin angles), PR #185.
The new LinkedIn case-first spin angle needs a real anonymized third-party case (a team/client situation, not Muxin's own story) to work from. No such material exists yet in the corpus -- PR #185's old-vs-new sample had to use Muxin's own personal-branding essay as the case study, since it was the only source available, which is honest but not the intended target material (a client/team case, per the card's own LINKEDIN SCOPE). Same reasoning applies more mildly to the X angle's technical-sharpening sample.
Scope: write or source a short anonymized case note (a real turnaround/greenfield situation Muxin has worked on or observed) as new atomize source material, so the case-first LinkedIn angle has genuine third-party material instead of only self-referential examples. Once it exists, re-run spin on it to confirm the new angle reads as intended against real case material.
CHAIN: 1

SCOPE EXTENSION (Muxin approved, 2026-07-10): shape the case-note capture as an INTERVIEW TEMPLATE -- five questions mapping one-to-one onto the skeleton beats: (1) what was the situation (with a number/decision), (2) what did the team believe, in their own words, (3) what tested it, (4) what did the miss cost, (5) what's the pattern. Muxin answers in voice or text; Claude transcribes into a case note. She is the author of the answers, so it stays clean under extraction-first (same principle as the voice-notes flow). Target: ~10 minutes of Muxin's time per case.
- Superseded 2026-07-15: this session was ceiling-killed but left its uncommitted diff salvageable in the stale worktree; the resume card 5021f759 verified that diff, closed 2 remaining gaps plus a third (stale spin-mode.md guidance that contradicted the new gate), and shipped it (PR #218, merged 2026-07-15). Marking Done here too so this card doesn't stay stuck showing STATUS: In Progress forever.
- STATUS: Done
- DECISION: close the 'Muxin hand-writes/sources anonymized cases' framing -- she will NOT supply cases. Her intent: the case-first LinkedIn spin is EXTRACTION-ONLY and CONDITIONAL -- for each source the agent checks whether a real, anonymize-able case already exists IN that source; if yes, produce the case-first post; if no real case exists, do NOT force or invent one -- fall back to the essay's own argument. Never fabricate a client case. Content-gen logic (rule 7). Build the conditional detection; candidate home: fold into b288d0da source-triage. (2026-07-14)
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: hard context/turn ceiling exceeded (turns=282 tokens=240549) -- session killed mid-card by the watchdog safety valve, never resumed
<!-- card-id: f7b186c2-0fe8-40b2-bc6d-0351b630bbda -->

**Tie source topic to a real CTA connecting brand/work to product-team value (LinkedIn esp., X some) -- check overlap with PR #185 first**
- ORIGIN: Muxin, 2026-07-10 -- wants the content agent to help surface an angle that ties her
source topic/insight to a real CTA connecting her brand and work to product-team value, especially
on platforms likely to attract clients/customers (LinkedIn especially, X to a lesser degree). Basing
this on "vibes" about what tends to work per platform becoming what people expect there.
LIKELY OVERLAP -- CHECK THIS FIRST: card c42769b1 (Update per-channel spin angles), built earlier
today, is currently sitting in an open PR (#185, draft, CI green, held for review per rule 7) that
already rewrote spin_angles.linkedin to a case-first/client-conversion structure (real anonymized
situation -> named assumption -> cost of having missed it -> pattern zoom-out LAST -> soft
availability signal instead of a hard ask) and sharpened spin_angles.x to be more technically
grounded while keeping the non-engineer-outsider voice. Muxin should review PR #185 before treating
this as new/unscoped work -- it may already deliver most or all of what this card is asking for.
Known gap even after PR #185 merges: its own PR body flags that no anonymized third-party case
existed yet in the corpus, so the LinkedIn sample had to use Muxin's own personal-branding essay as
the stand-in case (follow-up card f7b186c2 already filed to write/source a real one).
NEXT STEP (Muxin's explicit ask): wants an AI strategy session (stronger/advanced model) to help
define the approach for tying source topic to a real CTA per platform, before deciding what (if
anything) is still needed beyond PR #185 + its follow-up. Do not scope new implementation from this
card alone -- start by reviewing PR #185's actual result.

DECISION (Muxin, 2026-07-10 strategy session): SUBSUMED -- delivered by PR #185 (case-first LinkedIn / technical X spin angles) + the new beat-template card (1eeb82a4) + f7b186c2 (real anonymized case note). No separate CTA build. The CTA is the natural last beat of the case skeleton (soft availability signal), not a bolt-on.
- Superseded 2026-07-15: this session was ceiling-killed before any commits landed; the resume card d2746598 built this exact scope fresh and shipped it (PR #219, merged 2026-07-15). Marking Done here too so this card doesn't stay stuck showing STATUS: In Progress forever.
- STATUS: Done
- DECISION: approved to build -- NOT subsumed by PR #185 (that only reworked LinkedIn spin structure + a 'soft availability signal' closer, not a tactical CTA). Keep: tie source topic to a CTA that is TACTICAL / immediately usable (give the reader something to apply now), not necessarily 'product-team value'. Michael Callaway principle: content must be unique AND useful -> that is what converts to leads/clients. CTAs must feel natural, never cringy; orient to attracting paying clients. Content-gen logic -> draft PR held for review per rule 7 (2026-07-14)
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
- PARKED: hard context/turn ceiling exceeded (turns=302 tokens=250899) -- session killed mid-card by the watchdog safety valve, never resumed (2026-07-15)
<!-- card-id: c02ff4aa-4872-4540-8d9f-029ac4b9535a -->

**Nonexistent file path silently treated as plain text, burns minutes of LLM time instead of failing fast**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Add/Queue tab)
BUG: Pasting a well-formed but nonexistent absolute file path into the Add/Queue box does not surface a fast "file not found" error. Instead it silently falls through to the plain-text code path, materializes the raw path string as fake note content, and dispatches a full LLM atomize job against it - taking minutes with zero progress indication before the model itself figures out the input is garbage.
UI LOCATION: Add/Queue tab, paste box + "Add to queue" button
REPRO: Paste an absolute path to a file that does not exist, e.g. /Users/Muxin/Documents/GitHub/content-agents/this/path/does/not/exist/fake-note-12345.md, then click "Add to queue".
OBSERVED: The job was queued with kind "TEXT" (not "FILE"), even though the pasted string is clearly a file path. It ran for 2m59s with the UI showing only the same static generic startup line ("Warning: no stdin data received in 3s...") the entire time - no incremental progress, no "file not found" message - before finally completing with a (correct, well-reasoned) refusal to atomize a non-content string. Comparable jobs in the same session (plain text, bad URL) completed in 18-76s. There was no way for the user to distinguish this from a hang while it ran.
EXPECTED: A pasted string that looks like an absolute/relative file path but does not resolve via existsSync() should fail fast with a clear "file not found" error, without spending an LLM turn (multiple minutes) to discover that.
ROOT CAUSE: classifySource() in src/review/jobs.ts around line 332-345 only returns kind "file" when existsSync(asPath) is true; when the path does not exist it silently falls through to kind "text" (line 343-344) using the raw path string as the label/content instead of surfacing a classification error. addJob() then materializes that raw path string as the literal content of a new .inbox/<id>.md file (jobs.ts ~386) and dispatches it to the claude atomize subprocess, which has no fast local check for "does this look like a path that doesn't exist" and instead spends a full reasoning turn (multiple minutes, several tool calls) concluding the input isn't real content. Fix: when the input matches a path-like pattern (contains / and no spaces, or starts with ~ or a drive letter) but existsSync() fails, return a distinct classification (e.g. kind "file-not-found") and surface an immediate client-side or server-side error instead of dispatching an LLM job.
- SHIP: fixed + merged as PR #211 (commit a98292c) -- classifySource() now returns kind "file-not-found" for a path-like string that fails existsSync(), sourceDispatch() short-circuits with an immediate error before addJob()/LLM dispatch; covered by serve.test.ts. Board was stale (still said In Progress); confirmed via git log + gh pr view, no further build needed.
- STATUS: Done
- GROOMED: clear fail-fast outcome; classifySource() surface + path-like heuristic pinned + 2026-07-11
<!-- card-id: 4450fd23-5a8e-4673-b0d5-b94e013f1fe7 -->

**Review tab: quote-card rows with body text but no rendered image look identical to a normal card**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Review tab rendering)
BUG: Quote-card (IMAGE-type) rows whose derivative body text exists but whose image asset has not been rendered yet show NO visual indication that the image is missing — no placeholder box, no broken-image icon, no distinct styling. The only signal is a small amber note buried among unrelated spin/flag notes, e.g. "note: flag: spin pass suggested (low: narrative); image not yet rendered (sandbox blocked .env read)" — same visual weight as routine advisory notes. This is inconsistent with the OTHER missing-asset case (both body AND image absent), which DOES render an explicit placeholder: a plain — no asset generated yet — div (src/review/page.ts ~line 341, confirmed via QUOTE-CARD-1:X / QUOTE-CARD-1:BLUESKY rows in the 2026-07-04-250th-anniversary-question folder).
UI LOCATION: Review tab, any QUOTE-CARD:* row where body text exists but assetUrl is unset. Confirmed on QUOTE-CARD-1-X, QUOTE-CARD-1-LINKEDIN, QUOTE-CARD-1-BLUESKY in folder 2026-07-05-hey-substack-i-m-looking-for-others-who-feel-int (all three carry "image not yet rendered (sandbox blocked .env read)").
REPRO: 1) Open Review tab. 2) Find a QUOTE-CARD:* row whose note includes "image not yet rendered". 3) Observe the row renders as plain body text with no image and no distinct missing-image treatment, indistinguishable at a glance from a text-only row or a fully-rendered card.
OBSERVED: Row typed IMAGE shows text only, with the missing-image fact mentioned only in small buried note text.
EXPECTED: A row typed IMAGE should visually flag when its image is absent, consistently with the existing no-body-no-image case which already shows an explicit placeholder (— no asset generated yet —). At minimum, this should be as visually prominent, not a note fragment appended after unrelated flags.
ROOT CAUSE: src/review/rows.ts ~line 209-216 (assetUrl only set if existsSync(...) true) and src/review/page.ts ~line 334-341 (image tag only rendered when assetUrl is set; the no-asset placeholder branch only fires when body is ALSO empty, so a body-with-no-image row falls through to plain text rendering with no placeholder).
- SHIP: merged (PR #212) — added explicit "image not rendered yet" placeholder to page.ts's rowEl() preview logic for IMAGE-kind rows with no assetUrl, plus imageMissingHtml() DOM-free mirror + tests (page.test.ts), mirroring the replyContextHtml precedent. No rows.ts change needed — its assetUrl-unset behavior was already correct.
- STATUS: Done
- GROOMED: mirror existing no-asset placeholder branch for IMAGE rows; rows.ts/page.ts surface pinned + 2026-07-11
<!-- card-id: 4c3dd6fc-43e5-41a5-b5bd-387139b6296f -->

**Review GUI: in-progress action state (storyboard/duplicate/ask-Claude) reverts to idle before the real job finishes**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Review tab actions)
BUG: A row's transient in-progress UI state (Generate storyboard's storyboardQueued flag, Duplicate-to-platform's and Ask Claude's "thinking..." indicator) gets silently wiped and the row reverts to its idle/clickable appearance seconds after the click, well before the real backend operation (a claude -p spawn, 10s-2min+) actually finishes.
UI LOCATION: Review tab, any row with Generate storyboard / Duplicate to platform / Ask Claude buttons.
REPRO:
1. Click "Generate storyboard" on a blocked video-script row (e.g. content/2026-06-16-building-an-innovation-nation, row video-script). Flash shows "Queued - generating storyboard", and GET /api/jobs confirms a real job (kind:video, status:queued/running) exists for this folder.
2. Within ~2-5s, the row re-renders back to showing the plain "Generate storyboard" button (not the expected "generating storyboard..." hint span) - even though the job is still queued/running.
3. Clicking "Generate storyboard" AGAIN at this point re-fires POST /api/video/generate; the backend's addVideoJob() happens to dedupe by matching arg+status so no second job is actually created here - but the UI gave no indication the first click was still in effect.
4. Same underlying issue on "Duplicate to platform": clicked Duplicate (x-2 -> linkedin) on content/2026-07-10-human-inference-defining-a-brand-in-an-ai-drench. The dupbox's "Claude is drafting the linkedin version... (~10-60s)" message vanished and the row looked fully idle within a couple seconds, while the real claude -p spawn kept running in the background for well over a minute (confirmed via ps and via the new linkedin-2 row eventually landing in review-queue.md long after the UI had already gone quiet). Unlike Generate storyboard, duplicateToPlatform has no dedupe guard against a second click firing a second real Claude spawn for the same source+target while one is still in flight.
OBSERVED: The button/indicator reverts to idle almost immediately, well before the real async operation completes, with no visible "still working" state in between.
EXPECTED: The in-progress indicator (storyboardQueued hint, thinking spinner) should persist until the specific operation actually resolves, regardless of unrelated queue/job activity elsewhere on the page.
ROOT CAUSE: src/review/page.ts client script - the periodic background poll (setInterval(loadJobs, 3000), gated on any job being queued/running) calls loadJobs(), whose own "a job moved -> refresh review rows" logic (if(before !== JSON.stringify(...)) load();) unconditionally replaces the entire client-side DATA object with a fresh /api/queue response and calls render(), rebuilding every row's DOM from scratch. This clobbers (a) the client-only row.storyboardQueued flag (set by the gen-storyboard handler, never persisted server-side) and (b) any row whose action box was manually set to a "thinking..." innerHTML (ai-send, dup-send handlers in the same file), since render() replaces that DOM node outright. This fires any time ANY job anywhere in the system changes status - not just the job the user just started - so it reproduces easily whenever other queue activity is happening concurrently with a long-running row-level action.
- SHIP: merged (PR #213) — moved in-flight state into module-level registries (aiPending, dupPending, storyboardSlugs) keyed by stable row.id/piece.slug instead of row/DOM-attached state, so load()'s wholesale DATA replacement can no longer wipe it. Added the missing double-click dedupe guard on Duplicate. New storyboardJobDone() predicate clears the storyboard hint on the job's real terminal status. Verified with a Chrome-MCP white-box smoke test (simulated in-flight state, called load() directly, confirmed indicators survived) plus 8 new unit tests.
- STATUS: Done
- GROOMED: persist in-progress indicator outcome clear; poll-render clobber root cause pinned + 2026-07-11
<!-- card-id: fbfea28b-e730-4234-afaf-9ef25d43b7d9 -->

**Review GUI: Approve is not gated for quote-card rows whose image was never rendered (unlike video/storyboard)**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Review tab actions)
BUG: approveBlockReason() (src/review/rows.ts ~line 96-110) only checks row.format === "storyboard" and row.format === "video"/"short", blocking Approve with a clear message ("storyboard not rendered yet", "video not rendered yet") when the asset file is missing. There is no equivalent check for row.format === "image" (quote-card rows) - a quote-card row whose PNG was never rendered (images/ dir doesn't exist for the content folder at all) still reports approveBlocked: null, so the Approve button stays fully clickable with no warning.
UI LOCATION: Review tab, any QUOTE-CARD:* row whose image file does not exist on disk.
REPRO:
1. Confirmed via /api/queue: row quote-card-1-linkedin in content/2026-07-10-human-inference-defining-a-brand-in-an-ai-drench has assetUrl undefined and approveBlocked: null, even though images/quote-card-1.png does not exist in that content folder (confirmed on disk, and this is true in the main checkout too, not just the isolated worktree - the image was genuinely never rendered).
2. Clicked Approve on this row in the GUI - it went through with no warning (approve status set), same UX as approving a fully-rendered card.
3. In this fixture there are no real Typefully credentials, so scheduleApproved() fails early on the credentials check before ever reaching the missing-image read - the backend's own missing-file check in publishCards() (src/publish/cards.ts ~line 213-216: "missing <path> - render the card first: npm run render -- --still <folder>") never got exercised end-to-end here, though reading that code confirms it IS a clean, per-row-caught error, not a crash.
OBSERVED: Approve button offers no warning and is fully clickable for a quote-card row with no rendered image; video/storyboard rows get a proactive block, image rows do not.
EXPECTED: approveBlockReason() should also check row.format === "image" (or equivalently kind === "image") and block Approve with a message like "image not rendered yet - run npm run render -- --still <folder>" when the asset file is missing, mirroring the existing video/storyboard treatment.
ROOT CAUSE: src/review/rows.ts approveBlockReason() (~line 96-110) has no branch for the image/quote-card format, unlike its storyboard and video/short branches.
- SHIP: merged (PR #214) — added the missing image/quote-card branch to approveBlockReason() (rows.ts), mirroring the video/short branch exactly (asset-cell normalization, on-disk exists() check). One function feeds both the client disabled-button/note and the server-side /api/status reject, so this covers both surfaces. Updated the stale test that asserted the old buggy behavior + added 3 new image-gate tests.
- STATUS: Done
- GROOMED: add image branch to approveBlockReason() (rows.ts ~96-110), fully specified, mirrors video/storyboard + 2026-07-11
<!-- card-id: a8cb13a4-4bf5-4e29-aaa7-04acc39abd99 -->

**Follow-ups: Draft follow-up failure is invisible to the user**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Follow-ups tab)
BUG: Draft follow-up (Follow-ups tab, per-lead action) can silently fail with zero durable feedback, and nothing stops duplicate submissions while one is in flight.
UI LOCATION: Follow-ups tab, Client bucket, PostHog row, Draft follow-up button.
REPRO:
1. Open Follow-ups tab, click "Draft follow-up" on a lead (e.g. PostHog).
2. A toast reads "Drafting follow-up... (your subscription, ~30-60s)" but fades after 1.4s (flash() in src/review/page.ts:295 hardcodes a 1400ms display).
3. Under real system load the underlying `claude -p` subprocess (src/outreach/draft.ts) can exceed its own 120s timeout (DRAFT_TIMEOUT_MS, src/outreach/draft.ts:32) -- well past the toast's own "~30-60s" estimate.
4. When it times out, the server returns HTTP 200 with {ok:false, error:"claude -p timed out after 120s during draft"} (src/review/serve.ts:786-791). The client shows this in another 1.4s toast (followupDraft(), src/review/page.ts:763-768) and nothing else.
5. Verified directly: ran runDraft("outreach/leads/client-posthog") standalone via tsx and reproduced "ERROR: claude -p timed out after 120s during draft". Checked ~/.content-agents/logs/gui-jobs/*.log afterward -- no log file exists for this job at all.
OBSERVED: If the user is not staring at the screen during the ~1.4s window the toast is visible, they have no way to tell whether the draft is still running, succeeded, or failed -- no entry in the Jobs pill (Add/Queue tab), no persisted log, nothing in the Follow-ups list itself. The "Draft follow-up" button also has no disabled/in-flight state, so a user unsure whether their click registered can click again, queuing a second real `claude -p` subprocess call (confirmed via network tab: two concurrent POST /api/followups/draft-follow-up fired from two clicks) that burns another up-to-120s of subscription usage for the same lead.
EXPECTED: Draft follow-up should behave like every other Claude-spawning action in this app (atomize, revise, insights): show up in the Jobs pill with live status and a real log link, per the code's own stated intent. The comment at src/review/jobs.ts:651-656 explicitly claims this "reuses the same job queue" and "shows up in the jobs pill with a real log + heartbeat" -- but enqueueFollowUpDraft (src/review/jobs.ts:657-659) calls outreach/draft.ts's runDraft(), which spawns its subprocess via execFile directly (src/outreach/draft.ts:93, imported at line 3) rather than through runClaudeSpawn() (src/review/jobs.ts:241), so it never gets a log file or heartbeat. At minimum the button should disable while its own request is in flight, and the failure/success toast should persist long enough (or land somewhere durable) for the user to actually see it.
ROOT CAUSE: src/outreach/draft.ts's runDraft() bypasses the shared runClaudeSpawn() logging/heartbeat path (src/review/jobs.ts:241-256) that every other Claude-spawning GUI action uses, contradicting the intent stated in the comment at src/review/jobs.ts:651-656. Separately, src/review/page.ts:763-768 followupDraft() has no in-flight guard (no button disable, no queued-toast persistence) and src/review/page.ts:295 flash() is hardcoded to 1400ms regardless of message importance.
- SHIP: merged (PR #215) — client (page.ts): followupDraft() now mirrors the dup-send pattern (fbfea28b) with an fuPending in-flight registry (disables button, durable "drafting..." hint, dedupes a second click to zero fetches) and an fuError durable inline error (survives past 1.4s, points at Add/Queue tab) covering both a server error response and the awaited fetch itself rejecting. Server (jobs.ts/draft.ts): enqueueFollowUpDraft now routes the claude -p subprocess through the shared runClaudeSpawn/decodeSpawnFailure path instead of execFile, so the job gets a real persisted log + heartbeat like every other Claude-spawning GUI action; runDraft() gained an optional callClaude injection seam (default execFile path unchanged for CLI/tests), runClaudeSpawn gained optional model/tools opts + suppressible --permission-mode (purely additive, its 6 existing callers unaffected). Same model/--tools ""/prompt/timeout either way -- not a content-generation logic change, self-vet-merged per rule 7. Verified with a Chrome-MCP white-box smoke test (fixture row injected, since no real outreach lead data exists in this environment) confirming disable/dedupe/durable-error/stale-error-clear/success-clear, plus 725/725 unit tests.
- STATUS: Done
- GROOMED: route runDraft() through shared runClaudeSpawn() + button in-flight guard; intent clear, minimum floor stated + 2026-07-11
<!-- card-id: d39258ab-37ff-4b4c-b317-a3eb744059c2 -->

**Resume: code-enforce research.ts per-signal search budget (restart -- ceiling-killed session, no commits made)**
- ORIGIN: follow-up filed by cold-start after the conductor hit the hard context/turn ceiling mid-card on 3c6550a6-a388-44cf-a56e-e9d35423b3f1 ("Code-enforce research.ts per-signal search budget") -- turns=206 tokens=194517.
- The parked card 3c6550a6-a388-44cf-a56e-e9d35423b3f1 never made any commits (worktree at /Users/Muxin/Documents/GitHub/content-agents-worktrees/wt-3c6550a6-research-budget-3c6550a6, branch wt/3c6550a6-research-budget-3c6550a6, 0 commits ahead of main, clean status) -- so there is nothing to salvage, this is a clean restart of the same scope, not a resume of partial work.
- Scope (from the parked card): code-enforce research.ts per-signal search budget (config/outreach.yaml search_budget_per_signal, currently prompt-text-only) with a code-level call-interception backstop, not just prompt-text hinting.
- The stranded worktree above is left in place for inspection but should be discarded (no commits) once this follow-up is picked up.
- Once this ships, also mark original card 3c6550a6-a388-44cf-a56e-e9d35423b3f1 STATUS: Done with a Superseded note (same pattern already used for 8e8b616e -> fb4d6b28) so it doesn't stay stuck showing STATUS: In Progress forever.
- SHIP: fixed + merged as PR #216 -- added src/outreach/search-budget-hook.ts, a PreToolUse hook wired in via `claude -p --settings <json>`; denies further WebSearch/WebFetch calls once a run's total call count (computeSearchBudgetTotal: search_budget_per_signal x signal-category count, 3 client / 5 platform) is exhausted, a real external process enforcing the cap rather than the model's own restraint. Denies the tool call rather than killing the subprocess so the PROFILE/EVIDENCE/CLASSIFICATION markers still parse. 732/732 tests green (7 new), typecheck clean, manual stdin/stdout smoke test confirmed allow/allow/deny/allow behavior. Original card 3c6550a6 marked Done too (Superseded note added).
- STATUS: Done
- GROOMED: readiness pass: scope fully carried forward from parked 3c6550a6, no blocking unknown, no approval-worthy judgment (backend enforcement tightening, not content-generation logic) + 2026-07-15
<!-- card-id: 43fa1e02-e454-4f02-9a5e-8c8984be16a3 -->

**Resume: Update .claude/skills/atomize + outreach SKILL.md for Phase 2/3 (restart -- ceiling-killed session, uncommitted work salvageable)**
- ORIGIN: follow-up filed by cold-start after the conductor hit the hard context/turn ceiling mid-card on cccfc43a-6547-4f08-aeb4-3e76e7e27c49 ("Update .claude/skills/atomize + outreach SKILL.md for Phase 2 (draft/lock) + Phase 3 (platform-kind)") -- turns=250 tokens=222823.
- The parked card cccfc43a-6547-4f08-aeb4-3e76e7e27c49 left substantial UNCOMMITTED work in its worktree: /Users/Muxin/Documents/GitHub/content-agents-worktrees/wt-update-atomize-outreach-skill-docs-phase2-3-cccfc43a (branch wt/update-atomize-outreach-skill-docs-phase2-3-cccfc43a), 0 commits but a dirty working tree modifying .claude/skills/atomize/SKILL.md (+1 line, outreach_message frontmatter doc) and .claude/skills/outreach/SKILL.md (+86/-26, draft/lock subcommands + platform-kind flow + status --targets) -- this reads as content-complete against the original GOAL_CONDITION, just never committed.
- Do NOT blind-discard the worktree. Before rebuilding from scratch: read the existing diff in that worktree, verify it actually matches the GOAL_CONDITION below, and if so just commit + ship it -- likely far less work than a full redo.
- Likely root cause of the ceiling: same constraint noted on the original card and on ebe652a7/df11d0db -- writes under .claude/ (even project-local .claude/skills/) are not grantable to a headless worker; committing them needs an attended/interactive session willing to grant that write, not a plain execute pass. Confirm this session actually has that grant before starting, or the same stall will recur.
- GOAL_CONDITION: both SKILL.md files describe outreach:draft and outreach:lock as shipped (not pending), atomize/SKILL.md documents the outreach_message: true frontmatter marker, and outreach/SKILL.md documents the platform-kind flow + outreach:status --targets.
- Once this ships, also mark original card cccfc43a-6547-4f08-aeb4-3e76e7e27c49 STATUS: Done with a Superseded note (same pattern used for 8e8b616e -> fb4d6b28 and 3c6550a6 -> 43fa1e02) so it doesn't stay stuck showing STATUS: In Progress forever.
- CHAIN: 1
- SHIP: fixed + merged as PR #217 -- verified the salvaged worktree diff was already content-complete against the GOAL_CONDITION (all 3 parts) and against the actual code (draft.ts/lock.ts exist, status.ts's --targets flag exists, tag-source.ts reads outreach_message) before committing as-is, no further changes needed. Writes under .claude/skills/ in a fresh worktree (a different filesystem path from the main repo's own .claude/) were grantable in this session, resolving the constraint the original card and cccfc43a both flagged. npm test 732/732 green (docs-only change). Original card cccfc43a marked Done too (Superseded note added).
- STATUS: Done
- GROOMED: clear GOAL_CONDITION + explicit resume plan, no blocking unknown + 2026-07-15
<!-- card-id: 4e5b33d0-7e6d-42ea-924f-f58641199e02 -->

**Finish case-evidence detection for LinkedIn case-first spin (resume f7b186c2 uncommitted work)**
- Follow-up to f7b186c2-0fe8-40b2-bc6d-0351b630bbda (PARKED: hard context/turn ceiling exceeded, session killed mid-card, never resumed).
- GOAL_CONDITION: build the conditional case-evidence detection for the LinkedIn/X case-first spin angle per f7b186c2's DECISION (2026-07-14) -- extraction-only and CONDITIONAL: for each source, judge whether a real, anonymize-able third-party case exists IN that source; if yes, a derivative may declare case_skeleton:true; if no, fall back to the essay's own argument -- never fabricate a client case. Folds into b288d0da source-triage (PR #203, already merged).
- Its worktree (/Users/Muxin/Documents/GitHub/content-agents-worktrees/wt-case-note-linkedin-f7b186c2-f7b186c2, branch wt/case-note-linkedin-f7b186c2-f7b186c2) has 0 commits but substantial UNCOMMITTED work: src/atomize/source-triage.ts (+readCaseEvidence/hasCaseEvidence/caseNote, --case CLI flag) and src/atomize/validate.ts (+checkCaseGate hard gate: case_skeleton:true requires source_class_case:found AND non-empty source_lines).
- Do NOT blind-discard the worktree. Verified this diff already: `npx tsc --noEmit` clean, all 37 existing tests in validate.test.ts + source-triage.test.ts still pass (no regressions), and the logic matches the DECISION faithfully -- this reads as content-complete against the GOAL_CONDITION for the two source files.
- Two real gaps remain before this can ship: (1) no new tests cover readCaseEvidence/caseNote/checkCaseGate specifically -- add them, mirroring the existing beat2 test pattern in both test files; (2) .claude/skills/atomize/SKILL.md step 2.5 was never updated to instruct Claude to judge case-evidence per source and pass --case found|not_found to source-triage.ts -- right now the new gate would fail-closed forever since nothing ever sets source_class_case. Wire it in alongside the existing --beat2 instruction (SKILL.md line ~95).
- This is content-generation logic (CLAUDE.md rule 7 -- src/atomize/ extraction/spin logic) -- open as a HELD draft PR with an old-vs-new content sample (a source with a real case vs. one without, showing the gate/fallback behavior), never auto-merge.
- Once shipped (PR merged, not just opened), mark f7b186c2 Done-with-Superseded.
- Built both closed gaps plus a third found along the way: references/spin-mode.md's own guidance still told Claude to force the beat template onto non-case (autobiographical) material as a "stand-in" -- the exact drift this card exists to stop, and it directly contradicted the new gate. Updated that guidance + added case_skeleton to SKILL.md step 4's frontmatter example (nothing previously told Claude to ever SET the field, which would have left the gate permanently inert).

SHIP: merged as PR #218 (2026-07-15T17:16:35Z) -- Muxin reviewed and merged. Original card f7b186c2 marked Done too (Superseded note added).
- STATUS: Done
- DECISION: approved -- carried over from parent f7b186c2 (Muxin DECISION 2026-07-14: extraction-only + CONDITIONAL case-evidence; declare case_skeleton only when a real anonymizable third-party case exists IN-source, else fall back to the essay's own argument; never fabricate a client case). Content-gen LOGIC -> build as HELD draft PR with old-vs-new samples, no auto-merge (rule 7). + 2026-07-15
- GROOMED: clear GOAL_CONDITION, verified diff (tsc clean, tests pass), 2 explicit remaining gaps + 2026-07-15
<!-- card-id: 5021f759-430b-47df-b965-614359b4f390 -->

**Resume: Tie source topic to a real CTA connecting brand/work to product-team value (LinkedIn esp., X some)**
- CHAIN: 1
- Follow-up to c02ff4aa-4872-4540-8d9f-029ac4b9535a (PARKED: hard context/turn ceiling exceeded, session killed mid-card, never resumed 2026-07-15).
- The parked card was ceiling-killed before any commits landed -- its worktree (content-agents-worktrees/wt-cta-product-team-value-c02ff4aa, branch wt/cta-product-team-value-c02ff4aa) is still on disk at the same SHA as main, i.e. zero work done. Safe to build fresh from scratch; no partial state to reconcile.
- Full original scope carries over unchanged: DECISION: approved to build -- NOT subsumed by PR #185. Keep: tie source topic to a CTA that is TACTICAL / immediately usable (give the reader something to apply now), not necessarily product-team value. Michael Callaway principle: content must be unique AND useful. CTAs must feel natural, never cringy; orient to attracting paying clients. Content-gen logic -> draft PR held for review per rule 7.
- Once this ships (PR merged, not just opened), also mark original card c02ff4aa-4872-4540-8d9f-029ac4b9535a STATUS: Done with a Superseded note (same pattern used for 8e8b616e -> fb4d6b28, 3c6550a6 -> 43fa1e02, cccfc43a -> 4e5b33d0) so it doesn't stay stuck showing STATUS: In Progress forever.
- Built: reused the existing cta_label frontmatter field (previously only read by the explicit-cta override path) to also override the work_with_me-destination CTA's text in the content_type path (src/publish/cta.ts resolveContentTypeCtas/resolveOneContentType) -- additive, omitted cta_label keeps today's generic "Connect on LinkedIn" text unchanged. Updated SKILL.md step 4.5 to instruct when/how to write a tactical line (tone matches spin_angles.linkedin beat 5's soft-availability-close, good-vs-cringy example pair, always safe to omit).

SHIP: merged as PR #219 (2026-07-15T17:16:48Z) -- Muxin reviewed and merged. Original card c02ff4aa marked Done too (Superseded note added).
- STATUS: Done
- DECISION: approved -- carried over from parent c02ff4aa (Muxin: tie source topic to a TACTICAL / immediately-usable CTA; natural, never cringy; orient to attracting paying clients; NOT subsumed by PR #185). Content-gen LOGIC -> build as HELD draft PR with old-vs-new samples, no auto-merge (rule 7). + 2026-07-15
- GROOMED: readiness pass: full scope carried forward from parked c02ff4aa (approved to build), worktree = zero commits (safe fresh build), no blocking dependency (propose_dependencies empty); content-gen LOGIC -> ships as HELD draft PR per rule 7 + 2026-07-15
<!-- card-id: d2746598-f27a-403e-ba8c-2d3584fea53e -->

**GUI job logs mix content from unrelated old runs due to append-mode, non-truncated, ID-reused log files**
- ORIGIN: Muxin-requested GUI sweep, 2026-07-11 (Add/Queue tab)
BUG: A job's inline status/error text in the queue UI, and its separate "log" link, can show content concatenated from completely unrelated previous job runs (different content, different job kind, sometimes from a different day/session), making the real result unreadable and misleading.
UI LOCATION: Add/Queue tab, QUEUE list item status text + the "log" link (routes to /api/jobs/:id/log)
REPRO: 1) Ensure the GUI server has been restarted at least once since a prior job-1 was run (or just use a dev instance that has run before). 2) Paste any plain text into the Add/Queue box and click "Add to queue" so it becomes the first job of this server session (job-1). 3) Wait for it to finish and read the inline error/status text, or click "log".
OBSERVED: Submitted plain text "Just some random plain text idea about productivity habits...". The job (job-1) correctly identified the source as too thin to atomize and declined - but the displayed error/log text ALSO contained an entire unrelated previous run about a video storyboard fixture ("content/zz-e2e-storyboard-test-4e7cb5d3", "disposable fixture (origin: e2e-test)") and, mixed in after that, a third unrelated block about a totally different job discussing an /atomize skill text-corruption issue ("Want me to atomize a genuine piece instead? Point me at one.") - none of which belongs to this job. Confirmed via GET /api/jobs that this job's own id/kind/label (job-1, kind text) does not match the storyboard or skill-corruption content embedded in its error field.
EXPECTED: A job's status/error and log view should only ever show that job's own output. Old unrelated runs should never bleed into a new job's displayed result.
ROOT CAUSE: src/review/jobs.ts:201 - module-scoped "let jobSeq = 0" resets to 0 on every server process restart, so job IDs like "job-1" are reused across separate server lifetimes (not unique long-term). jobs.ts:27-30 jobLogPath() keys the on-disk log file purely by that reused ID under a shared, non-project-scoped directory (~/.content-agents/logs/gui-jobs/<id>.log). jobs.ts:247 opens that path with flags "a" (append) and never truncates it before a new job writes to it. Read path: src/review/serve.ts:669-684 (readFileSync(jobLogPath(jobId))) returns the full accumulated multi-run file, and that same content also gets surfaced directly into the job's error field shown inline in the queue UI. Fix should truncate/create-fresh the log file per new job (e.g. flags "w" or delete-before-open), and/or use a globally-unique job id (e.g. include a timestamp or uuid) instead of a process-local reset-to-0 counter.
SHIP: merged -- PR #210 https://github.com/heymoosh/content-agents/pull/210 (539f8fc, rule-7 non-content-gen, auto-merged on green CI)
- STATUS: Done
- DECISION: approved -- truncate/use a unique job id per new job to stop log concatenation. The at-risk data is ephemeral local debug logs only (~/.content-agents/logs/gui-jobs/*.log, not committed, not product data), so the 'destructive' risk is negligible; standard engineering fix, no product-data loss. Non-content-gen logic, auto-merges on green CI. (pre-flight 2026-07-14)
- GROOMED: clear outcome + precise root cause (append-mode/reused-id log files, jobs.ts:201/247); stateable predicate + 2026-07-11
<!-- card-id: 89f7dea5-3a74-4732-80cf-d4b98f49f2fe -->

**GUI approve-time scheduling failure is invisible after the fact (silent 'blocked by reuse guard' state)**
- ORIGIN: Muxin, 2026-07-11 -- "I had a bad experience with the GUI earlier this week and haven't wanted to reopen it since." Reproduced live by opening the Review tab against real queue data.
CONCRETE REPRO FOUND: row `quote-card-6-linkedin` (content/2026-06-16-building-an-innovation-nation/) shows STATUS: approve but has NO entry in that folder's publish-log.md. The Review tab's reconcile pass (src/review/reconcile.ts) flags it with a red warning: "not found at typefully -- no logged Typefully draft id found for this row."
ROOT CAUSE (confirmed by reading code + data, not guessed): the design is actually correct in principle -- src/review/serve.ts's approve handler (~L518-522) deliberately keeps a row at STATUS: approve (never "published") when scheduleApproved() reports a scheduling failure, specifically so the failure reason can be shown. But src/review/page.ts:435 only surfaces that reason as an EPHEMERAL flash-toast: `flash("Approved -- schedule failed: "+r.scheduleError)`. It is never written anywhere persistent (not to the row's notes column, not logged). So if the flash is missed in the moment, the ONLY signal left is the generic reconcile "mismatch" state days later, which does not explain WHY -- it just reads as broken/lost.
THIS SPECIFIC ROW'S actual state (verified via briefs/bets.md Placed log): the same slug already had a LinkedIn placement (`qvid-linkedin`, 2026-06-24) 17 days before the quote-card-6-linkedin approve attempt. LinkedIn's `min_reuse_days` is 60 (config/platforms.yaml). The reuse guard correctly blocked scheduling. This row is NOT stuck forever -- it becomes eligible again ~2026-08-23 -- but nothing in the GUI says that; it just looks broken.
GAP TO CLOSE (not yet scoped/decided -- for grooming): persist the real scheduleError reason somewhere durable when an approve-time schedule attempt fails (e.g. the row's notes column in review-queue.md), and/or have the reconcile pass itself detect a reuse-guard block specifically and report "blocked by reuse guard, eligible again in N days" instead of the generic, alarming "no logged draft" message. Muxin confirmed (2026-07-11) the intended semantics: "when I say approve I do mean that it should go into scheduling" -- so a silent/invisible scheduling failure is a real gap, not a documentation issue.
GOAL_CONDITION: not yet defined -- scope once Muxin decides which half of the gap to close (persist-the-reason vs. smarter-reconcile-message vs. both).

SCOPE DECIDED (Muxin, 2026-07-11): (c) build BOTH halves of the gap. (a) Persist the real scheduleError reason durably when an approve-time schedule attempt fails -- write it to the row's notes column in review-queue.md so it survives past the ephemeral flash-toast (page.ts:435), not just flashed once. (b) Have the reconcile pass (src/review/reconcile.ts) detect a reuse-guard block specifically and report "blocked by reuse guard, eligible again in N days" instead of the generic, alarming "no logged draft" message.
GOAL_CONDITION: an approve-time schedule failure leaves a durable, human-readable reason persisted on the row (not just a toast); AND the reconcile pass, for a row blocked by the reuse guard, reports "blocked by reuse guard, eligible again in N days" -- e.g. the innovation-nation quote-card-6-linkedin row reads as blocked until ~2026-08-23, not "no logged Typefully draft".
- RETRY: 1 (cold-start resume: worktree had zero commits ahead of main but genuine uncommitted progress matching card scope; resuming in place, not redoing)
- SHIP: merged (PR #209, https://github.com/heymoosh/content-agents/pull/209 -- CI green, rule-7 auto-merge, squashed 2026-07-15)
- STATUS: Done
- DECISION: approved -- Muxin already scoped the fix in-card (2026-07-11 SCOPE DECIDED: persist scheduleError reason durably + reuse-guard-aware reconcile message). Low-risk, reversible GUI/bookkeeping fix, no content-generation logic; auto-merges on green CI per rule 7. (pre-flight 2026-07-14)
- GROOMED: decision c (persist reason + reuse-guard-aware reconcile) recorded; GOAL_CONDITION stated + 2026-07-11
<!-- card-id: 174f70bd-1dd3-456f-9d66-6945ac88872a -->

**Follow-ups tab: add a manual mark-as-sent/contacted action**
- Once Muxin actually sends a client/platform/jobsearch follow-up message by hand, nothing today appends a "contacted"/"followup_sent" tracker event for it -- the Follow-ups tab only offers mark-responded/draft-follow-up/move-on per card 21a5eb84's scope. Need a 4th action (or a CLI command) to log a manual send.
ORIGIN: follow-up discovered while building card 21a5eb84 (Outreach engine -- Phase 4: Follow-ups tab + tracker).
CHAIN: 1
- STATUS: Done
- DEPENDS ON: Outreach engine -- Phase 4: Follow-ups tab + tracker (client/platform/inbound/jobsearch)
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
<!-- card-id: bf88258a-5d0f-457a-a403-53a9bbad1648 -->

**Decide: should qualify.ts accept vault: evidence sources (not just https://)?**
- ORIGIN: follow-up auto-filed while building card d4524bd0 (Outreach engine -- Ingest existing research corpus), found by /code-review --fix.
- client-mem/lead.md is classified turnaround, but its only worldview-match evidence item cites a vault: path (Muxin's own Obsidian notes), not a live https:// URL. qualify.ts isValidSourceUrl only accepts https:// -- the moment outreach:qualify runs on this lead (per its own normal contract), it will silently downgrade Mem from turnaround to unclear, losing a real, cited signal purely because of its source format.
- Policy call, not a mechanical bug: should vault:-sourced evidence (ingested research, source: ingested leads) count as legitimate for qualify's URL-validity check across the whole outreach engine, or should ingested leads get re-verified against a live URL before they can qualify? Affects any future ingested lead, not just Mem.
- GOAL_CONDITION: qualify.ts either (a) accepts vault: as a legal evidence source alongside https://, with a test proving it does not downgrade client-mem, or (b) Muxin decides ingested evidence must be re-verified against a live source before qualify -- whichever she picks, client-mem/lead.md ends up with a fit verdict that reflects a deliberate decision, not a silent format-driven downgrade.
- CHAIN: 1
- STATUS: Done
- DECISION: approved -- qualify.ts should accept vault: evidence sources in addition to https://; the real values instrument (founder deep-dives) lives in the Obsidian vault, not the web (2026-07-14)
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
<!-- card-id: 4e2e83f3-cd4f-438a-a5a1-15912c1f4f6f -->

**Fix qualify.ts illegal fit:unclear downgrade for platform-kind leads**
- ORIGIN: follow-up auto-filed while building card 6590efec (Outreach engine Phase 3), found by /code-review --fix.
- qualify.ts evaluateQualify() hardcodes "unclear" as the downgrade value regardless of kind, but "unclear" is not a legal fit value (validate.ts VALID_FITS is strong|partial|weak|disqualified -- unclear is only legal for client-kind classification). intake.ts has the same latent issue (seeds fit: unclear at intake time). If a platform lead is ever qualified from a claimed strong/partial with zero evidence or no worldview-match quote, it would get downgraded to the illegal value fit: unclear and fail shape validation.
- Not exercised by either of Phase 3s 2 real seeded proof leads (both classified weak directly, never hit this downgrade path) -- pre-existing bug, not introduced by Phase 3.
- GOAL_CONDITION: evaluateQualify() downgrades a platform-kind lead to a legal fit value (e.g. weak, not unclear) when evidence is insufficient; a test exercises this path directly.
- CHAIN: 1
- STATUS: Done
- GROOMED: readiness pass: clear scope, no blocking unknown + 2026-07-14
<!-- card-id: 19b348f4-7f8a-4790-9393-8e42739ac1a0 -->

**Only draft content for a platform if the source topic actually fits it (needs a strategy session first)**
- ORIGIN: Muxin, 2026-07-10 -- "if a topic doesn't work on that platform then we shouldn't bother
creating a draft for it using atomize." Muxin wasn't sure whether this was already asked for /
already built, or whether it conflicts with an existing experiment -- flagging both her memory gap
and the current state below so a strategy session doesn't start from scratch.
CURRENT STATE (verified 2026-07-10): there IS an existing gate, but it's coarser than what Muxin is
describing. config/routing.yaml gates which platforms a piece gets atomized to, but at the PILLAR
level (6 broad categories: human-ai, claude-code, civic-tech, career-work, builder, other), not per
specific topic/essay. Once a pillar has >= min_posts_for_data (3) real posts on a platform, resonance
data decides inclusion (skip_below_score: 0.4); below that, it cold-starts to config's per-pillar
defaults. Separately, docs/spin-experiment.md ran a real experiment (approved 2026-06-24, promoted
to always-on 2026-07-02) showing the SAME human-ai content scored very differently by platform
(13.1 as a Substack note, 5.5 on LinkedIn, 1.45 on X as verbatim) -- but that experiment is about HOW
to reframe/word a post once it's already been routed to a platform (spin_angles), not WHETHER to
draft for that platform at all. So today's logic is: pillar-level routing decides platform inclusion,
spin decides framing within it -- neither operates at the finer "this specific source doesn't fit
this platform even though its pillar generally does" level Muxin is describing.
RISK FACTORS Muxin flagged, to carry into the strategy session: (1) topics need time to take root on
a platform -- changing what gets posted where based on thin/early signal is risky; (2) changing an
established platform's topic mix at all carries reputational/algorithmic risk, separate from whether
the individual gating call is correct.
NEXT STEP (Muxin's explicit ask): this needs a dedicated strategy session with a stronger/advanced
model to define the actual approach (what granularity of gating, how much data before acting on it,
how to avoid thrashing an established platform's topic mix) BEFORE any build. Do not scope
implementation from this card alone.

DECISION (Muxin, 2026-07-10 strategy session): RESOLVED BY DESIGN -- no per-topic resonance gating (thin/early signal + algorithmic risk, per the card's own risk flags). Instead gate on register/frame-fit: the new source-triage card (b288d0da) classifies each source as frame-native / reflective / fiction-promo, which drives frame on/off + platform subset. Existing pillar routing + spin stand unchanged. Superseded by b288d0da.
- STATUS: Done
- DECISION: superseded/close as a standalone card -- immediate source->frame->platform-subset mechanism is handled by b288d0da. Do NOT hardcode a platform-topic gate: it must be DATA-DRIVEN from strategy analysis (which topics/pillars actually perform per platform) and evolve over time. Seed priors only: X rewards engineering thinking, LinkedIn = career + professional development, Substack = society + human/reflective thought. The data-driven-gate work belongs in the strategy layer feeding routing; spin off a Backlog tracker if pursued (2026-07-14)
<!-- card-id: 9a7656d9-5b53-4e2a-88c7-96abcc5c6b2e -->

**Source triage step at /atomize time: frame-native / reflective / fiction-promo drives frame on/off + platform subset**
- ORIGIN: Muxin-approved strategy session 2026-07-10 -- 'a system to help me stay consistent with posting what where, and what should have a frame and shouldn't, without me needing to think about it.'
- SCOPE: a classification step when a piece enters /atomize (she writes in Obsidian, runs /atomize on the file): classify the SOURCE once as frame-native / reflective / fiction-promo, record it as a fact in the content folder (e.g. routing.md or source frontmatter), and have every downstream step read it instead of re-deciding.
- BUCKET RULES (Muxin approved): frame-native (carries a testable belief / the move) -> full fan-out, skeleton beats applied per platform dialect. Reflective/personal (e.g. 'What AI Cannot Reach', 'More than Bread') -> NO skeleton ever; skips conversion-facing treatment (LinkedIn case format, X); native to Substack + Bluesky (personal register performs there per platform-pillar data); home = Human Inference landing page + newsletter once live (card 87c86b16), Substack interim. Fiction -> series on Substack; teasers fan out UNFRAMED via the existing extraction-first cliffhanger style.
- UX: triage shows the classification + resulting platform subset ('frame-native -> LinkedIn/X/Bluesky' or 'reflective -> Substack/newsletter, no frame') for Muxin to confirm -- one judgment call per piece, surfaced in the review flow she already uses. Side effect: flags 'no beat-2 belief statement found' so she learns which essays lack the move.
- SUPERSEDES 9a7656d9's ask: gate on register/frame-fit (a judgment classification), not on thin per-topic resonance data.
- RULE 7: routing/content-generation logic -- PR HOLDS for Muxin's review.
- GOAL_CONDITION: running /atomize on a reflective source produces a recorded 'reflective' classification, no skeleton-framed derivatives, and a platform subset excluding LinkedIn-case/X treatment; a frame-native source gets the full framed fan-out; a fiction teaser is never framed; the classification is stored in the content folder and read (not re-derived) by downstream steps.
PR: https://github.com/heymoosh/content-agents/pull/203
SHIP: held
- STATUS: Done
- DEPENDS ON: Beat-template rewrite of spin_angles (LinkedIn + X) + spin-mode.md with exemplar/counter-example
- GROOMED: Muxin-approved scope from 2026-07-10 strategy session; bucket rules + GOAL_CONDITION explicit, depends on beat-template card + 2026-07-10
<!-- card-id: b288d0da-c003-4617-93e4-809e865b7a80 -->

**Beat-template rewrite of spin_angles (LinkedIn + X) + spin-mode.md with exemplar/counter-example**
- ORIGIN: Muxin-approved strategy session 2026-07-10 (branding frame discussion; follows PR #185 / card c42769b1).
- WHY: PR #185's sample drifted thesis-first because spin_angles describes INTENT in prose; runtime Sonnet follows STRUCTURE far more reliably. Encode the brand skeleton ('everyone treats X as fixed; it's actually a belief; here's what testing it revealed') as named beats with per-beat pass/fail tests, not a description.
- SCOPE: rewrite spin_angles.linkedin and spin_angles.x in config/platforms.yaml + the spin-mode.md guidance they drive as fill-in beat templates: (1) specific situation with a number/decision (test: could a stranger picture the scene?); (2) the assumption QUOTED as a belief statement in the holder's own words (test: is there literally a quoted belief sentence? if the source can't produce one, the piece doesn't fit the skeleton -- fall back to normal extraction, never fake it); (3) what testing it revealed + what the miss cost; (4) one-line zoom-out LAST (final two sentences only); (5) LinkedIn only: soft availability signal, no hard ask.
- EXEMPLARS: include Muxin's Oncor case draft ('Personal Obsidian/Branding/Content/Ideas/LinkedIn -- Case Format (Diagnosis Post).md', Draft v1, approved-for-reuse material) verbatim in spin-mode.md as the gold positive example, and PR #185's personal-branding sample as the labeled counter-example ('wrong: thesis-first, subject is me').
- DIALECT PRESERVATION: per-platform sections stay separate config entries -- X keeps its sharper/more-technical compressed register, LinkedIn keeps the case format; voice (Muxin's cadence, config/voice.yaml) is constant across platforms; dialect = compression + example register only.
- RULE 7: content-generation logic -- PR HOLDS for Muxin's review with old-vs-new samples in the description.
- GOAL_CONDITION: spin_angles.linkedin/.x + spin-mode.md contain the beat template (per-beat tests), the Oncor gold exemplar, the counter-example, and the fits/doesn't-fit fallback rule; a before/after spin sample on a real source is in the PR body; npm test green.
PR: https://github.com/heymoosh/content-agents/pull/189 (stacked on PR #185 -- review #185 first)
SHIP: held
- STATUS: Done
- GROOMED: Muxin-approved scope from 2026-07-10 strategy session; explicit GOAL_CONDITION, exemplar named, rule-7 hold flagged + 2026-07-10
<!-- card-id: 1eeb82a4-712b-4b0c-9427-29fc8ef5bef9 -->

**Update per-channel spin angles: LinkedIn to case-study/client-conversion format, X to technical-but-still-outside-the-bubble**
- ORIGIN: 2026-07-10 conversation with Muxin reviewing per-platform positioning (`config/platforms.yaml` `spin_angles`).
- WHY: LinkedIn's diagnosis-of-world register reads as "interesting worldview," not "hire me for this." Muxin confirmed the ick she'd flagged about consulting-flavored content is about the FORMAT (essay-as-thesis), not consulting itself — without a concrete conversion hook there is no path to sales.
- LINKEDIN SCOPE: rewrite `spin_angles.linkedin`'s angle text (and the spin-mode.md guidance it drives) toward a case-first structure: (1) open on a real anonymized situation, not a category ("A team building an onboarding flow was convinced churn was a UX problem"); (2) name the assumption found, in the team's own words, not Muxin's; (3) say what happened when it got tested and what it cost to have missed it; (4) the one-line zoom-out to the broader pattern comes LAST, as the closer, not the headline; (5) end with a soft signal of availability (what she'd look for scoping this kind of engagement) instead of a hard ask — a proof-of-work sample, not a thesis. Reader-reaction target: "I have that exact blind spot," not "interesting way to see the world."
  - Two source paths, resolved at build time by checking what material exists: (a) if an essay already contains a real concrete example, spin's existing rehook latitude (lead with strongest line, reorder for arc — spin-mode.md) restructures it without inventing anything; (b) if the case isn't written up anywhere, it needs a short case note as new atomize source material. Either path lands in the existing `case_study`/`product_builder_insight` content types (`config/content-types.yaml`), which already carry "Connect on LinkedIn" CTA scaffolding — no new plumbing needed there.
- X SCOPE: sharpen `spin_angles.x`'s angle text to read as more technically grounded (real technical specifics, not surface-level), while explicitly preserving the outsider framing — Muxin does NOT want X to read as belonging only inside the tech-circle bubble. A wording tightening of the existing angle, not a flip to an insider/builder voice.
- RULE 7: both are content-generation logic (per-channel angle/spin config driving what future runs generate) — build holds as a draft PR with an old-vs-new sample post per platform so Muxin sees the actual delta before merge, per CLAUDE.md rule 7's conductor mechanics.
- GOAL_CONDITION: `spin_angles.linkedin` reflects the case-first structure above (verified against a real or representative essay run, before/after sample in the PR); `spin_angles.x` reads technically sharper without reading insider-exclusive (verified against a real or representative sample); spin-mode.md guidance updated to match both.
PR: https://github.com/heymoosh/content-agents/pull/185
SHIP: held
- STATUS: Done
- DECISION: approved (Muxin, 2026-07-10) — LinkedIn case-study reframe confirmed; X clarified as technical-but-still-outside-the-bubble, not a flip to insider voice.
- GROOMED: explicit structural spec for LinkedIn, explicit direction for X, both map onto existing scaffolding (spin_angles, case_study/product_builder_insight CTA types, existing rehook latitude) — no blocking unknown; PR will hold for review per rule 7 since this is content-generation logic + 2026-07-10
- CI NOTE: CI: green (as of 2026-07-10T21:58 UTC) -- fixed a stale linkedin spin-angle test assertion that broke on the intentional config rewrite
- LANE: a
<!-- card-id: c42769b1-fdf4-4a78-a888-d21ea9a8ef2d -->

**Outreach engine — Phase 4: Follow-ups tab + tracker (client/platform/inbound/jobsearch)**
- PARENT: 659b50f0
- ORIGIN: split out of 659b50f0 (Unified follow-up tracking) per docs/outreach-engine-plan.md §6 Phase 4.
- SCOPE: tracker.ts (append/fold data/outreach/tracker.jsonl, due-date/overdue computation, summary for /strategy), new 'Follow-ups' tab in src/review/page.ts + serve.ts (row shape: who/bucket/why -- surfaces the locked core-message angle/last touch/next action+due; actions: mark-responded, draft-follow-up via existing job queue, move-on -- no CRM aesthetics, no guilt-styling on overdue), follow-up windows per bucket in config/outreach.yaml, jobsearch bucket wired per the §2b RATIFIED decision (content-agents tracks it natively; JSA hands off Level-1 verdicts only, read-only from manual_research.db).
- THIS IS THE 'FINDING JOBS/COMPANIES' TOUCHPOINT IN THIS REPO: this repo does NOT build a jobs/companies finder -- Muxin's separate Job Search Agent (JSA, external repo) already sources/scores candidate companies. The only jobs/companies-related build here is this tab's jobsearch bucket, tracking JSA's leads read-only.
- GOAL_CONDITION (plan §6 Phase 4 definition of done): Follow-ups tab renders all 4 buckets (client/platform/inbound/jobsearch) from tracker.jsonl with correct due-date/next-action per row; jobsearch bucket populated from a read-only pull of JSA's manual_research.db. Inbound bucket ships schema-ready but empty until db22283f (Inbound listening, currently In Progress) lands -- not a blocking dependency.
- RULE 7: this is GUI/state plumbing, NOT content-generation logic -> auto-merges on green CI (plan §6).
- STATUS: Done
- DEPENDS ON: Outreach engine — Phase 2: decision gate, draft, lock, /atomize reuse
- DECISION: approved — card body itself states this is GUI/state plumbing, not content-generation logic; auto-merges on green CI per plan doc
- GROOMED: split from 659b50f0 per plan §6 Phase 4; explicit GOAL_CONDITION, GUI/state plumbing (auto-merge lane), DEPENDS ON Phase 2 + 2026-07-09
- LANE: b
<!-- card-id: 21a5eb84-d78c-4aca-9672-6500875a3e88 -->

**Content agent: find platforms to appear on (podcasts, channels, newsletters)**
- A content/research agent that finds OTHER people's platforms that are a strong fit for Muxin to talk about her work — podcasts, channels, newsletters, anyone with an audience and a real overlap, whether the hook is her essays (AI & society / fairness) or her product/build work.
- The agent: build a fit profile (topic overlap + audience + values), then source + qualify candidate platforms/hosts and surface them with a suggested pitch angle for her review.
- FEEDS the target list in "Growth via borrowed audiences" (30772ba1) — that card is the strategy; this is the agent that sources the targets. Pitch angle aligns to the per-channel positioning ("Swizzle"/Spin).
- Sibling of the client-finder card (same ideal-fit-profile → source → qualify → surface machinery, different target: platforms vs clients).
- SHARED ENGINE (Muxin approved, 2026-06-30): build ONE "fit-finder engine" (profile → source → qualify → surface) ONCE; client-finder + this card are its two configs (target = clients vs platforms). Don't build two divergent implementations.
- NOTE (2026-07-08): a "companies to work for" third target was considered — Muxin's existing Job Search Agent (JSA) Cowork-skill system, outside this repo, already sources/scores candidate companies, so this isn't rebuilt here. UNVERIFIED how deep JSA's own shared-values matching is versus this repo's worldview material — see c308a8cf for the piece that clearly does belong in content-agents (outreach-message drafting) and the open question on whether JSA's qualifying step needs this repo's input too.
- INTEGRATED DESIGN APPROVED (Muxin, 2026-07-08): same architecture as ba9769af — see c308a8cf for the full write-up (shared engine stages, pitch/decision-gate/draft/lock composition posture, follow-up tracking, subscription-only cost posture). This card is the platform-target config; "topic overlap + audience + values" fit criteria and the pitch-angle output are unchanged from the 2026-06-30 shared-engine approval, now nested inside that fuller design.
- COST RESOLVED (Muxin, 2026-07-08): subscription-only end to end (rule 6) — see ba9769af for the JSA `auto_analyze.py` precedent that proves this pattern holds at real research depth.
- NOT YET IMPLEMENTATION-SCOPED (Muxin, 2026-07-08): architecture-level only; file/module layout, data model, and build sequencing still need a dedicated scoping pass by a stronger/different model before a worker starts.
- IMPLEMENTATION-SCOPED (2026-07-08, stronger-model pass): see docs/outreach-engine-plan.md — this card is the engine's platform config, shipping as Phase 3 (config/outreach/platforms.md fit profile, pitch angle aligned to spin_angles, target-list summary feeding 30772ba1's strategy brief ask). Same shared code as the client config; differs only in fit profile, verdict taxonomy, and pitch framing (plan §5).
- RATIFIED (Muxin, 2026-07-08): plan recommendations agreed — build unblocked, sequenced as Phase 3.
- DISCOVERY METHODOLOGY APPROVED (Muxin, 2026-07-08): plan §9 details the platform-sourcing approach — podcast search at the EPISODE level, not the show level (ListenNotes/Podchaser full-text episode descriptions: "which shows did an episode about untested assumptions" finds mid-tail shows that already care about her themes, not the saturated top-20 list); anchor-graph expansion generalized beyond the Substack recommendation graph to every public graph an anchor sits in (worked example in §9c from Muxin's own seeds, Audrey Tang + the Collective Intelligence Project: shows that hosted Tang are themselves platform candidates, their other guests enter the pool, CIP's collaborator/partner-org cluster and who they publicly recommend expand from there; every locked lead becomes a new anchor so the frontier compounds); mid-tail size bands (podcasts ≳50k listeners / newsletters ≳50k subs downgraded — the engine exists for niches Muxin couldn't have found herself, she can hand-add big names); lens rotation + dedup ledger + pass-reason anti-examples prevent surfacing the same list twice.
- SEED LIST (Muxin, 2026-07-09): first 2 of the Phase 0 platform seed (§8 item 3, docs/outreach-engine-plan.md) — The School for Moral Ambition (moralambition.org, Rutger Bregman's mission-driven career-impact community/foundation, 25k+ members across Circles + Fellowships) and the UN ITU's AI for Good Neural Network (neuralnetwork.aiforgood.itu.int, an AI-matched community/content platform tied to the AI for Good summit — session video, virtual exhibits, AI-powered connection matching). Both satisfy her steer to look beyond LinkedIn toward mission-aligned communities. Still need 1–3 more to hit the 3–5 test-set minimum before Phase 1/3 has a seeded platform set to run against.
CARD TYPE: EPIC
- STATUS: Done
- DEPENDS ON: Per-channel positioning: one clear angle per platform ("Swizzle") — NOTE (2026-07-08): this dependency (d23bfc5d) is now Done. Sequencing dependency: Phases 1–2 of docs/outreach-engine-plan.md (engine core + draft/lock loop) land first.
- DECISION: approved (Muxin, 2026-07-08) — build as Phase 3 per docs/outreach-engine-plan.md (platform fit profile, pitch angle aligned to spin_angles, target-list summary feeding 30772ba1); discovery per plan §9 lands with Phase 5. PR holds for review (rule 7, content-generation logic).
- PARKED: superseded as work items by the Outreach engine Phase 1-5 cards (2026-07-09) — kept as reference epics; specs/decisions on these bodies remain canonical
<!-- card-id: b7dcb608-4089-4f19-ba5c-df5dc1c75b7c -->

**Draft tailored outreach messages for companies worth connecting with on shared values**
- ORIGIN: raised 2026-07-08 while reviewing the client-finder (ba9769af) and platform-finder (b7dcb608) backlog cards. Muxin already runs a separate Job Search Agent (JSA) system (Cowork skills: company-profile-setup, company-research, founder-deep-dive, thoughts-review, vibe-check, job-hunt-continue, job-hunt-ops) that sources and scores candidate companies, including some values dimension. Company sourcing/scoring itself is NOT rebuilt here.
- UNVERIFIED — depth of JSA's values match (Muxin, 2026-07-08): flagged that content-agents defines her values/worldview far more richly than JSA likely does — the home-brand worldview line ("I uncover harmful hidden beliefs and why they need to change before AI automates everything"), the four per-channel angles refined across multiple decision cycles (d23bfc5d), and her actual essays. I've only seen JSA's one-line skill descriptions (e.g. company-profile-setup = "priorities, dealbreakers"), not its real profile content, so I cannot confirm how deep its shared-values scoring actually is — don't take "JSA already qualifies on shared values" as verified or authoritative until someone actually looks at what its profile captures.
- IMPLICATION: the real fix may be upstream, not just downstream — if JSA's values-fit turns out to be shallow, content-agents' worldview definition should feed INTO JSA's qualifying step (so the company-worth-connecting-with call itself is values-rich), not only into the outreach message written after the fact. Whoever scopes this should check JSA's actual profile content first and decide whether this card is outreach-drafting only, or also includes richer values criteria into JSA's qualification.
- MUST BE TWO-SIDED, NOT JUST SHARED VALUES (Muxin, 2026-07-08): shared values alone isn't a reason for THEM to reply — the message must also make clear what's in it for them. Reuse the same fit situations already defined on the client-finder card (ba9769af): does this company look like a turnaround (they've tried repeatedly and something isn't working) or a greenfield (they don't yet know what to build and want to get it right the first time)? The message should name that problem and why Muxin is worth their time on it, not just assert a values match.
- CONFIRMED (Muxin, 2026-07-08): the turnaround/greenfield problem-fit read needs its OWN research pass in content-agents — NOT assumed to already exist in whatever JSA hands off. JSA's research targets a different question (is this a good place for Muxin to work), so its output isn't assumed to carry the specific evidence needed here. This is new build.
- PROCESS (drafted 2026-07-08, sequence not yet build-approved):
  1. Candidate company in (from JSA's shared-values qualification, or wherever Muxin points it).
  2. Evidence-gathering research pass — pull specific, citable signals, not a vibe: TURNAROUND (same role reposted/reopened multiple times in the past 6-12mo, leadership/PM tenure gaps on LinkedIn, public pivot language in press/blog/founder interviews, visibly different core product versions over time via web archive, Glassdoor/Blind commentary about repeated direction changes); GREENFIELD (recent seed/Series A with a vague or unshipped mission, "Founding PM"/"0-to-1" job language, founder interview/podcast content about still exploring direction); DISQUALIFYING (long-tenured exec layer + a roadmap that reads locked from above, JD language like "we know what we're building, just need execution") — mirrors the HARD qualifier already on ba9769af.
  3. Classify: turnaround / greenfield / unclear / disqualified. "Unclear" (insufficient evidence) must be a real, surfaced outcome, never a forced guess — same posture as briefs flagging a channel INSUFFICIENT rather than guessing on thin data.
  4. Draft the outreach message citing the SPECIFIC evidence found (e.g. "noticed you've reposted the Head of Product role three times this year") plus the shared-values thread from Muxin's worldview/essays — using content-agents' voice engine (`config/voice.yaml`).
  5. Muxin reviews company + evidence + classification + draft TOGETHER, so she can catch a wrong read, not just proofread the prose.
  6. She sends it herself.
- RULE 1 IMPLICATION: an outreach message is COMPOSED prose, not extraction-first quoting — this needs the same carve-out already granted to video scripts (rule 1's scoped exception) and Build 2 fiction: composition is allowed only because Muxin reviews and approves every message before it goes out. Never auto-send. Model this identically to the existing exceptions rather than inventing a new posture.
- OPEN QUESTION — handoff format: still need to decide the minimum JSA hands off (company name + its own qualification reasoning, at least) even though the turnaround/greenfield evidence-gathering now happens in content-agents itself. Similar shape to how `/atomize` takes a url|file|pasted-text input today. → RESOLVED (Muxin ratified, 2026-07-08): snapshot-on-intake, file-based — `/outreach add --from-jsa <company>` reads manual_research.db read-only and copies name + domain + verdict + reasoning/sources + personas into a self-contained lead.md; no live link, hand-added leads are first-class. See docs/outreach-engine-plan.md §2a.
- EVIDENCE-SOURCING RESOLVED (Muxin, 2026-07-08): subscription-only, no paid data source — step 2's research runs as Claude web search at draft time via the same `claude-cli` subprocess pattern content-agents already uses for `text-polish`. Confirmed viable at real research depth by JSA's own `scripts/auto_analyze.py`, which does company research entirely through `claude -p` subprocess calls (no Tavily/Gemini/GPT; `ANTHROPIC_API_KEY` deliberately removed from its Docker env to block accidental API charges) — this is the proof the $0-marginal pattern scales to this kind of research, not just short-form drafting. The old open question ("does ad hoc web search surface this reliably, or do we need a dedicated paid data source") is closed: use web search, no paid data source, no cost ceiling to negotiate (rule 6 fully satisfied).
- CROSS-REPO NOTE: JSA also still has an older LangGraph pipeline (`graph/nodes/agent_*.py`, `docs/REF-ARCHITECTURE.md`) that runs company research through paid Tavily + Gemini + GPT (~$0.17/company). `auto_analyze.py` appears to have superseded it (more recent changes, matches JSA's own subscription-first intent per Muxin) but the paid pipeline isn't marked deprecated in JSA's own docs. Not a content-agents action item, but worth flagging to whoever next touches JSA so the paid path doesn't get silently re-enabled.
- INTEGRATED DESIGN APPROVED (Muxin, 2026-07-08) — full pipeline, all three configs (client outbound here, platform via b7dcb608, job-search via JSA read-only):
  1. PROFILE — Muxin's worldview (home-brand line + four channel angles + essays, already in `config/platforms.yaml`/`config/voice.yaml`) + target-specific fit criteria (this card's turnaround/greenfield/HARD-qualifier taxonomy above; b7dcb608's topic/audience/values criteria).
  2. SOURCE — Muxin-seeded candidates + Claude web-search discovery (see EVIDENCE-SOURCING above). No paid search/data API anywhere in this stage.
  3. RESEARCH — Claude aggregates public footprint into a cited profile (mirrors JSA's per-dimension extraction + sources pattern, already proven at Level 1).
  4. QUALIFY + PITCH — evidence-based fit score (this card's turnaround/greenfield/unclear/disqualified taxonomy) PLUS a narrative "why this is worth your time" writeup, mirroring JSA's own `persona`/`founder_persona`/`best_for`/`watch_out` narrative fields (already live in `manual_research.db`). Muxin reads this cold — she isn't expected to know anything about the lead beforehand; the report itself has to make the case.
  5. DECISION GATE — Muxin reads the pitch, decides pursue or pass. If pursuing: she gives her own angle/things-to-say, OR accepts the angle Claude already suggested inside the step-4 report.
  6. DRAFT — Claude composes the actual message from the accepted angle + evidence. This is the ONE place the rule-1 composed-prose exception applies (same posture as video scripts / Build 2 fiction — allowed only because it's reviewed before anything sends).
  7. REVIEW/SIGN-OFF — Muxin edits and approves in the review surface (see REVIEW SURFACE below).
  8. LOCK — the approved text becomes the lead's "core message."
  9. REUSE VIA `/atomize` — once locked, the core message stops being composed prose and becomes EXTRACTION SOURCE, same as an essay's source lines. Follow-ups and repeat touches get Spin/Swizzle-reframed off the locked text (different wording, same throughline) instead of Claude composing fresh each time. This means only step 6 ever needs the rule-1 exception; everything downstream is extraction-first against Muxin's own approved words, consistent with the rest of the pipeline. Practically: the locked core message needs to be readable as a new `/atomize` source type, not just a review-queue row.
  10. FOLLOW-UP TRACKING — confirmed crucial (Muxin, 2026-07-08), not optional. Adopts JSA's own 3B7 shape from its (unbuilt) Level 2 Networking PRD (`product/prd/level-2-networking.md`): contacted → waiting → responded/no-response → follow-up sent → scheduled → done, or abandoned past a threshold, with reminders. Timing windows are a config knob per target type (client vs platform vs job-search cadences likely differ). See the new Follow-ups GUI card (659b50f0) for where this surfaces.
- OPERATIONAL LESSON FROM JSA: `auto_analyze.py` hit real Claude Max 5-hour rolling-window rate limits during bulk batch runs and had to add exit-code/output-size rate-limit detection, backoff, and a model swap to Sonnet for higher limits (its `docs/plans/PLAN_auto_analyze_command_20260129.md`, V14). If this engine ever batches multiple leads in one sitting, design for that failure mode up front rather than discovering it the way JSA did.
- REVIEW SURFACE (Muxin, 2026-07-08): review-queue.md gets the initial draft/approve step (row type extension, as already proposed); ongoing follow-up state (post-approval) is tracked separately in the new unified-GUI "Follow-ups" tab, not in review-queue.md — review-queue.md is a one-shot approve surface, follow-ups are a multi-touch state machine and need the richer row shape described on 659b50f0.
- IMPLEMENTATION-SCOPED (2026-07-08, stronger-model pass): the scoping pass Muxin asked for is done — docs/outreach-engine-plan.md maps all 10 approved stages to concrete modules (src/outreach/, /outreach skill, config/outreach/), defines the lead-folder + message + tracker.jsonl data model, adds what the design left open (dedup memory, per-lead research checkpointing for the rate-limit failure mode, a mechanical two-sided-message guard: message frontmatter must cite ≥1 lead.md evidence item), and sequences the build (Phases 0–5; this card's core is Phase 2: gate → draft → lock → /atomize reuse). Both remaining open questions carry recommendations (handoff §2a above; Level-2 ownership below).
- RATIFIED (Muxin, 2026-07-08): all plan recommendations agreed — both open questions on this card are now RESOLVED (see the two arrows above). No open questions remain.
- PLAN ADDENDUM (Muxin approved, 2026-07-08): docs/outreach-engine-plan.md gained §9 (discovery methodology: worldview-map query generation, anchor-graph expansion, people-not-companies client sourcing, mid-tail caps, quote-required match + disconfirmation pass) and §10 (research anti-churn guards: pull ≠ research, closed-checklist prompt with per-signal search budget, hard timeout, batch cap + backoff, run log). The quote-required match and disconfirmation pass harden this card's stage 4 (QUALIFY + PITCH); the anti-churn guards harden stage 3 (RESEARCH).
- OPEN QUESTION — JSA Level 2 Networking ownership: JSA's own PRD (`product/prd/level-2-networking.md`, status "Early Concept/Brainstorming", unbuilt) specs almost exactly this engine's shape (profile → source people → footprint aggregation → matchmaking → outreach package → message composition → 3B7 tracking → relationship memory) for job-search networking, AND JSA's own docs (`product/technical/productization.md`) frame it as a sellable feature for JSA's other users (pricing tiers, "42,000+ users helped" goal) — not just Muxin's personal tool. Two ways this could go: (a) JSA builds its own Level 2 as a product feature, and content-agents' Follow-ups tab just pulls its state read-only once it exists; or (b) content-agents' shared engine (being built for client/platform outreach anyway) becomes the single place ALL FOUR reason-buckets' outreach/tracking lives, JSA hands off only Level-1 verdicts, and JSA never builds its own Level 2 — avoiding the twin-engine problem already avoided for sourcing. This has real product/roadmap consequences for JSA that aren't visible from content-agents alone; flag for Muxin's call (or the tougher-model scoping pass) rather than deciding silently. → RESOLVED (Muxin ratified, 2026-07-08): option (b), built pluggable — content-agents' Follow-ups tab tracks the jobsearch bucket natively; JSA hands off Level-1 verdicts only and does not build its own Level 2 for Muxin's use (its product-feature path for other users stays open: the bucket can swap to a read-only JSA pull later with no change to the others). Full reasoning: docs/outreach-engine-plan.md §2b. Cross-repo note: flag this to whoever next touches JSA so its roadmap reflects it.
CARD TYPE: EPIC
- STATUS: Done
- DECISION: approved (Muxin, 2026-07-08) — two-sided messaging required (name their problem, not just shared values); the problem-fit read is confirmed new research work in content-agents, not reused from JSA. Depth of JSA's own values-matching gets a timeboxed Phase 0 check (plan §2c) that doesn't block the build. INTEGRATED DESIGN APPROVED + IMPLEMENTATION SCOPED + RATIFIED — build per docs/outreach-engine-plan.md, this card's core is Phase 2 (gate → draft → lock → /atomize reuse), after Phase 1 lands. Drafting-logic PRs hold for Muxin's review per rule 7.
- PARKED: superseded as work items by the Outreach engine Phase 1-5 cards (2026-07-09) — kept as reference epics; specs/decisions on these bodies remain canonical
<!-- card-id: c308a8cf-944b-4518-b019-f82675af3ab2 -->

**Outreach engine — Ingest existing research corpus (Obsidian vault + JSA DB) into anchors + leads**
- Warm-start the anchor graph from data Muxin already has instead of cold-starting from 2 seed anchors. Sources (all read-only): the Obsidian vault at "/Users/Muxin/Documents/Personal Obsidian/Job Hunt/" — Research/Company Research/ (5 deep-researched companies: Anthropic, Notion, Superhuman, Mem, Fireflies — interview notes with verbatim quotes, deep person profiles, Muxin's Thoughts reactions), Research/Chats with People/ (~17 real-contact conversation notes), Contacts/ (SEED_CONTACTS.md 66-person roster, Interest Cross-Reference.md, Anthropic Deep Profiles/) — plus JSA's manual_research.db (~140 scored companies; 10 TARGET / 42 CONSIDER) via JSA_DB_PATH.
- Output: (a) config/outreach/anchors.md entries for the people/orgs the vault already evidences as aligned (Boris Cherny, Cat Wu, Thariq, Kevin Moody, Ivan Zhao, etc.), each with a why-this-anchor line quoting Muxin's own notes + a source path; (b) pre-created outreach/leads/ folders (source: ingested) for already-vetted companies worth pursuing, carrying the vault/JSA evidence snapshotted in lead.md.
- Constraints: NO graph database — ~250 total nodes fits the plan's existing file formats (anchors.md + lead folders); a graph DB is speculative infra. Vault analysis notes parse cleanly (H1 + bold fields + blockquotes); transcripts and thought-dumps need Claude judgment, so ingest is Claude-in-skill, not a deterministic parser. JSA's Human Enablement score is ingested as evidence text only, never as a fit signal (see the values-depth finding on the Phase 1 card). Nothing here contacts anyone; it only seeds config + lead state.
- GOAL_CONDITION: config/outreach/anchors.md contains >=20 anchor entries, each with a why-this-anchor evidence line and a source path into the vault or JSA DB; lead folders exist for at least the 5 deep-researched vault companies with source: ingested and populated ## Evidence sections; the run touches the vault and manual_research.db read-only (no writes outside this repo).
EXPLICIT GO-AHEAD (Muxin, 2026-07-10): confirmed named individuals + paraphrased why-this-anchor basis + source paths are OK to commit, now that the repo is private. Build as originally scoped.
PR: https://github.com/heymoosh/content-agents/pull/181
SHIP: held
- STATUS: Done
- DEPENDS ON: Outreach engine — Phase 1: engine core + client config (seeded leads)
- DECISION: hold — extending the same hold-for-review treatment as its Rule-7 sibling outreach cards resolves the parked concern (lack of a review gate before merge) without needing a live call from Muxin; build + draft PR, hold for review
- GROOMED: scope + sources + GOAL_CONDITION set; depends on Phase 1 (anchors.md/lead formats); no graph DB per Muxin + 2026-07-09
- CI NOTE: CI: green (as of 2026-07-10T19:56 UTC)
<!-- card-id: d4524bd0-39ba-4476-a85d-ef0e52a93f79 -->

**Outreach engine — Phase 3: platform config + borrowed-audience target list**
- PARENT: b7dcb608
- ORIGIN: split out of b7dcb608 (Content agent: find platforms to appear on) per docs/outreach-engine-plan.md §6 Phase 3.
- SCOPE: config/outreach/platforms.md (topic overlap + audience reality check + values + guest-friendliness/pitch-path + recency <=90 days fit profile), platform walkthrough in the /outreach skill, pitch-angle alignment to spin_angles, outreach:status --targets -- a rendered target-list summary of platform-kind leads that /strategy folds into the weekly brief. This IS the 'maintain a target list' action seed from Growth via borrowed audiences (30772ba1), which stays a strategy note and needs no build of its own -- this phase is what satisfies it.
- GOAL_CONDITION (plan §6 Phase 3 definition of done, satisfies 30772ba1): a platform-kind seeded lead runs qualify and produces a pitch report; outreach:status --targets renders a target-list summary that /strategy's weekly brief surfaces.
- SEED CANDIDATES: 2 of 3-5 platform seeds on file (plan §8 item 3) -- The School for Moral Ambition, UN ITU AI for Good Neural Network. 1-3 more still needed to hit the test-set minimum; not blocking the build itself.
- RULE 7: platform qualify/pitch-angle prompts are content-generation logic -> this PR HOLDS for Muxin's review.
- DEPENDENCY NOTE (2026-07-09, Muxin): Phase 3 only needs Phase 1's qualify.ts + lead.md schema, not Phase 2's draft/lock; was over-conservatively pointed at Phase 2. Unblocks Phase 2 (message quality) and Phase 3 (platform-list quality) to build/review independently once Phase 1 lands.
PR: https://github.com/heymoosh/content-agents/pull/177
SHIP: held
- STATUS: Done
- DEPENDS ON: Outreach engine — Phase 1: engine core + client config (seeded leads)
- DECISION: hold — card body itself states Rule 7 applies (platform qualify/pitch-angle prompts are content-generation logic); build + draft PR, hold for review
- GROOMED: split from b7dcb608 per plan §6 Phase 3; explicit GOAL_CONDITION (also satisfies 30772ba1), DEPENDS ON Phase 2 + 2026-07-09
- CI NOTE: CI: green (as of 2026-07-10T18:37 UTC)
<!-- card-id: 6590efec-54ca-4288-9cf7-5e69e034477d -->

**Outreach engine — Phase 2: decision gate, draft, lock, /atomize reuse**
- PARENT: c308a8cf
- ORIGIN: split out of c308a8cf (Draft tailored outreach messages) per docs/outreach-engine-plan.md §6 Phase 2.
- SCOPE: draft.ts (compose message via claude-cli, voice.yaml enforced), validate.ts (message half: two-sided guard -- refuses a draft whose evidence list is empty, references non-existent lead.md ids, or whose classification is unclear/disqualified), lock.ts (approved -> locked, stamps locked_at, appends Decision log), GUI approve-equals-lock semantics (Approve calls lock.ts, NOT publishText -- nothing sends), locked-message-as-/atomize-source frontmatter + tag-source origin value.
- GOAL_CONDITION (plan §6 Phase 2 definition of done): one seeded lead goes gate -> draft -> Muxin edits/approves in GUI -> locked; /atomize accepts the locked file and its derivatives trace source_lines to it.
- RULE 1 SCOPED EXCEPTION: DRAFT (stage 6) is the ONE place composed prose is allowed here, same posture as video scripts/Build 2 fiction -- legal only because Muxin reviews every message before it ships. Everything after lock is extraction-first.
- RULE 2 ANALOG: no send path exists anywhere in this codebase. Approve means lock, never transmit.
- RULE 7: draft prompt is content-generation logic -> this PR HOLDS for Muxin's review.
- DEPENDS ON Outreach engine — Phase 1: engine core + client config (seeded leads) -- needs a researched+qualified lead to gate/draft against.
PR: https://github.com/heymoosh/content-agents/pull/171
SHIP: held
- STATUS: Done
- DEPENDS ON: Outreach engine — Phase 1: engine core + client config (seeded leads)
- DECISION: hold — card body itself states Rule 7 applies (draft prompt is content-generation logic); build + draft PR, hold for review
- GROOMED: split from c308a8cf per plan §6 Phase 2; explicit GOAL_CONDITION, rule-1/rule-2 posture pinned, DEPENDS ON Phase 1 + 2026-07-09
- CI NOTE: CI: green (as of 2026-07-10T16:54 UTC)
<!-- card-id: d5b34590-4354-49f1-952f-3faaf1ce7d4a -->

**Content agent: find fit clients (lead-gen) — values + "open to changing their mind"**
- A content/research agent that finds and qualifies potential clients who are a genuine fit to work with Muxin — not just anyone with a budget.
- Fit situation 1 (turnaround): they've tried many times and nothing's working — Muxin comes in and finds the hidden/untested assumption that's the real problem. Surfacing what nobody tested is her core strength.
- Fit situation 2 (greenfield): they don't yet know what to build and want to avoid building the wrong thing early — she helps build the right thing the first time (or after their 10th/20th try).
- HARD qualifier: they must be OPEN to changing their minds / direction. NOT a fit if they just want execution of already-made decisions, or there's heavy politics blocking a change of direction.
- Shared values — the worldview detailed across her essays/content.
- The agent: build an ideal-fit profile from the above + her essays, then source + qualify candidates and surface them for her review (eventually into the unified review GUI). Could adapt the existing profile→research→score pattern (cf. the company-research skill, inverted: finding clients, not employers).
- Relates-to: Landing page (87c86b16, the work-with-me destination) + Smarter routing's work-with-me CTA. Sibling of the platform-finder card (same machinery, different target).
- SHARED ENGINE (Muxin approved, 2026-06-30): build ONE "fit-finder engine" (profile → source → qualify → surface) ONCE; this card + platform-finder are its two configs (target = clients vs platforms). Don't build two divergent implementations.
- NOTE (2026-07-08): a third "companies to work for" target was considered — Muxin already runs a separate Job Search Agent (JSA) Cowork-skill system (company-research/founder-deep-dive/vibe-check/job-hunt-ops) outside this repo that sources/scores candidate companies, so this is NOT a third config of this engine. UNVERIFIED how deep JSA's own shared-values matching actually is versus what this repo has defined (home-brand line, per-channel angles, essays) — see c308a8cf, which covers the piece that clearly does belong here regardless (outreach-message drafting) and flags the qualifying-step question as open.
- INTEGRATED DESIGN APPROVED (Muxin, 2026-07-08): the full cross-system architecture — shared engine stages, composition posture, follow-up tracking, cost posture — is written up on c308a8cf; this card and b7dcb608 are its two source-side configs (client vs platform), unchanged from the 2026-06-30 shared-engine approval. Read c308a8cf first.
- COST RESOLVED (Muxin, 2026-07-08): subscription-only end to end (rule 6), no exceptions — confirmed JSA itself already proves this pattern works at company-research depth via `scripts/auto_analyze.py` (Claude CLI subprocess on Claude Max subscription, zero paid API calls; `ANTHROPIC_API_KEY` deliberately stripped from its Docker env to prevent accidental charges). The cost-ceiling question that was open as of the last note is closed.
- NOT YET IMPLEMENTATION-SCOPED (Muxin, 2026-07-08): the above is architecture-level (stages, GUI approach, data-interchange direction), not a "this is how we'll build it" plan — file/module layout, data model, and build sequencing still need a dedicated scoping pass. Muxin wants a different/stronger model to do that scoping before a worker starts; don't treat this note as a build-ready green light.
- IMPLEMENTATION-SCOPED (2026-07-08, stronger-model pass): the scoping pass above is done — see docs/outreach-engine-plan.md (file/module layout §4, lead-folder + tracker data model §3, phase sequencing §6). This card ships as Phase 1 (engine core + client config, seeded leads, research/qualify/pitch report) and completes with Phase 5 (discovery sourcing, deliberately last — seeded leads validate qualify quality first). Build unblocks once Muxin ratifies the plan's §8 items.
- RATIFIED (Muxin, 2026-07-08): all plan recommendations agreed — handoff format (§2a), tracker ownership (§2b), phase ordering (§6). Build unblocked.
- DISCOVERY METHODOLOGY APPROVED (Muxin, 2026-07-08): plan §9–§10 detail how sourcing finds worldview matches without token churn or converging on the obvious hot list. Key calls for THIS card: client discovery targets PEOPLE, not companies (reflective founder postmortems / "what I got wrong" writing proves worldview + turnaround fit + openness in one artifact; the company is researched after the person qualifies); queries are GENERATED per run from a worldview map (belief statements × community-dialect paraphrases, config/outreach/worldview-map.md) — never literal keyword search of Muxin's own phrases, which won't recur verbatim in other people's writing; anchor-graph expansion from Muxin-seeded trusted people/orgs (config/outreach/anchors.md; first seeds: Audrey Tang, Collective Intelligence Project) across co-appearance/collaboration/engagement/alumni graphs; mid-tail size caps exclude the big names everyone is vying for. Match rigor: qualify requires QUOTED evidence of shared belief with a link (no quote → unclear) plus a disconfirmation pass. Anti-churn (§10): pull ≠ research, closed-checklist research prompt with per-signal search budget, hard subprocess timeout, batch cap + backoff, run log.
- SEED LIST (Muxin, 2026-07-09): no client candidates supplied — genuinely blank, nothing in mind yet. Directional criteria given instead: smaller, mission-aligned tech companies, judged by the kind of role/engagement on offer rather than brand size. That's fit-profile guidance, not a name list — feeds the Phase 1 `config/outreach/clients.md` fit criteria. The actual Phase 0 seed (§8 item 3, docs/outreach-engine-plan.md) still needs 3–5 real names, either directly from Muxin or the `--from-jsa` TARGET-verdict pull.
- CROSS-REPO NOTE — JSA sourcing model should flip to people-first too (Muxin, 2026-07-09): JSA's job-search sourcing is company-first today (source candidate companies, then `founder-deep-dive` as one research dimension within that). Muxin's call, reasoning from this card's own §9d logic: values are a durable property of the PERSON, while any single company is a moving target — so JSA should source people first via the same reflective/worldview-fit-writing signal and anchor-graph mechanism this engine uses for clients/platforms (not a separate build, same technique), and let base-requirements company filters (comp, location, stage, culture fit) work as a ranking/scoring layer applied AFTER a person is sourced, not as the primary discovery seam. Not a content-agents action item — JSA is a separate repo — but flag this to whoever next scopes JSA's sourcing pipeline; it sharpens the already-open UNVERIFIED JSA-values-depth question (c308a8cf, plan §2c) into a concrete architecture recommendation.
CARD TYPE: EPIC
- STATUS: Done
- DECISION: approved (Muxin, 2026-07-08) — build Phase 1 per docs/outreach-engine-plan.md (engine core + client config, seeded leads; discovery waits for Phase 5; Phase 1 inherits the §9f quote-required match + disconfirmation pass and the §10 anti-churn guards, and lands the worldview-map + anchors config files). Remaining input: the Phase 0 seed list (Muxin names 3–5 clients, or Phase 0 pulls JSA TARGET verdicts via --from-jsa) — still pending, see 2026-07-09 note above. The PR holds for review (rule 7, content-generation logic).
- PARKED: superseded as work items by the Outreach engine Phase 1-5 cards (2026-07-09) — kept as reference epics; specs/decisions on these bodies remain canonical
<!-- card-id: ba9769af-f171-4f73-a373-2ca2cef5004c -->

**Clarify which flow produces platform:substack rows in review-queue.md**
- Follow-up from Substack publishing automation (card 83f60f12, PR #164). config/routing.yaml and config/platforms.yaml comments state Substack is a source channel (analytics pull), not an atomize routing target, but src/publish/substack.ts now consumes review-queue.md rows with platform: substack.
- Look at the /atomize notes flow to find (or build) the actual path that queues those rows, so the new publish automation has real input to act on.
- CHAIN: depth 1 (follow-up of 83f60f12)
- STATUS: Done
- DECISION: approved — Muxin confirmed (2026-07-10, pre-flight): Substack IS an atomize routing target now via the Notes flow. Update config/routing.yaml + config/platforms.yaml comments to reflect Substack as both a source AND a target.
- GROOMED: clear diagnostic task, no blocking unknown + 2026-07-10
<!-- card-id: a52927cd-5d00-41d8-82a6-9febf59e5394 -->

**Bakeoff: whisper.cpp vs Gemini for voice-memo transcription**
- config/providers.yaml transcription: gemini is a deliberate paid opt-in (CLAUDE.md rule 6) pending a whisper.cpp bakeoff to see if a free-local route is quality-acceptable. ORIGIN: follow-up from a1a6f379.
- STATUS: Done
- DECISION: approved — self-contained provider bakeoff/investigation, cost already logged per CLAUDE.md rule 6, no judgment call blocking it
- GROOMED: clear bakeoff scope: whisper.cpp vs Gemini, headless-executable + 2026-07-10
<!-- card-id: de591b28-9f79-47b6-94e7-c96162d6fe5c -->

**Substack publishing automation (constrained browser agent, approved content only)**
- We auto-publish to X/LinkedIn/Bluesky (Typefully), YouTube, TikTok (PostPeer), and quote cards, but there is NO automation for publishing to Substack. Substack has no usable publishing API (CLAUDE.md rule 3).
- Build the POST side of the constrained browser agent we already use for analytics pull (src/pull/): drive the saved Substack session to publish or schedule an approved piece, and nothing else.
- SAFETY (non-negotiable): only acts on content Muxin set to `approve` in review-queue.md (rule 2), and browser posting needs Muxin's explicit go-ahead (rule 3). Never auto-post unreviewed.
- SCOPE ANSWERED (Muxin, 2026-07-04): NOTES ONLY. Muxin is good at writing his own essays/posts directly on Substack and wants to keep doing that himself — that stays manual. The actual gap is that Substack isn't part of the unified GUI's automated publishing flow yet; this card closes that gap for Notes.
- Reuses: the saved-session stealth-Chrome agent + diagnostics from the pull build; the unified scheduler (src/publish/slots.ts) for timing.
- RENEWED INTEREST (Muxin, 2026-07-07): flagged wanting Substack posting automation while discussing posting caps; target cap if/when built = 1 post/day max on Substack. Still deferred per the 2026-07-04 call below — revisit priority explicitly before starting, don't silently pick this up.
- STATUS: Done
- DECISION: approved (Muxin, 2026-07-08) — reprioritized; scope already answered (Notes only, fold into the unified GUI publishing flow), content-stack work that was blocking it is now shipped. Target cap 1 post/day max on Substack per the 2026-07-07 note.
- GROOMED: reprioritized + scope already answered (Notes only), no dependency overlaps, no open questions + 2026-07-08
<!-- card-id: 8026f53c-0c52-46a2-aba1-e7e0bd416bdb -->

**Outreach engine — Phase 0: discovery spike (JSA_DB_PATH + seed list)**
- The plan's Phase 0 (docs/outreach-engine-plan.md SS6) had no card, so it could silently never happen — yet it holds the one blocking input for Phase 1. Two of its three items are now DONE: the JSA values-depth check (SS2c) closed 2026-07-09, finding recorded on the Phase 1 card; the read path is designed (jsa.ts, better-sqlite3 readonly).
- Remaining: (1) add JSA_DB_PATH to .env pointing at manual_research.db and verify a read-only better-sqlite3 query works; (2) MUXIN INPUT REQUIRED — the seed list is still short: platforms have 2 of 3-5 (School for Moral Ambition, AI for Good Neural Network), clients have zero concrete names (only directional criteria: smaller mission-aligned tech companies). Client seeds can come from Muxin's head, the --from-jsa TARGET pull (logistics-fit only — must still pass worldview qualify), or the vault's deep-researched companies via the ingest card.
- GOAL_CONDITION: .env carries JSA_DB_PATH and a read-only query against manual_research.db succeeds from this repo; the plan doc SS8 item 3 records >=3 client seeds and >=3 platform seeds.
- STATUS: Done
- DECISION: approved — Muxin confirmed (2026-07-10, pre-flight): Phase 1 build (PR #167) already satisfies this card -- JSA_DB_PATH read path proven working, 2 real seeds pulled via --from-jsa TARGET/WAIT verdicts (client-posthog, client-axelerant). No separate build needed, marking Done.
- GROOMED: clear GOAL_CONDITION; seed gaps have self-resolution paths (--from-jsa / vault ingest) + 2026-07-10
<!-- card-id: be1e4dcd-36dc-41bf-8c1a-66925d7f4658 -->

**Outreach engine — Phase 1: engine core + client config (seeded leads)**
- PARENT: ba9769af
- ORIGIN: split out of ba9769af (Content agent: find fit clients) per docs/outreach-engine-plan.md §6 Phase 1 -- each phase is one backlog card -> one PR; the epic's accumulated scoping stays on ba9769af (now CARD TYPE: EPIC / parked), this card is the buildable slice.
- SCOPE: intake.ts, jsa.ts (read-only manual_research.db reader, JSA_DB_PATH), research.ts (checkpointed evidence pass via claude-cli web search), qualify.ts (deterministic evidence/classification-legality checks), validate.ts (lead-shape half), config/outreach.yaml + config/outreach/clients.md, /outreach skill (add/research/qualify/status), GUI reads lead review-queues. No discovery, no drafting yet.
- BUILD REQUIREMENTS (plan §9-§10): quote-required worldview match (a values claim must quote the candidate's own words with a link, else classify unclear) + disconfirmation pass; closed-checklist research prompt with per-signal search budget (default 2/signal) + hard subprocess timeout (5-8 min); --from-jsa refuses to bulk-import with no argument; per-run research log line to data/outreach/run-log.jsonl.
- SEED CANDIDATES: Muxin's own client seed list is still blank (0 of 3-5, plan §8 item 3) -- use --from-jsa --verdict TARGET --limit N to pull real seeded candidates from JSA's manual_research.db instead of waiting on manual names.
- GOAL_CONDITION (plan §6 Phase 1 definition of done): Muxin runs /outreach add on a seeded company and gets a cited, classified pitch report she can judge cold; 'unclear' demonstrably surfaces as unclear on at least one thin-evidence lead.
- RULE 7: research/qualify prompts are content-generation logic -> this PR HOLDS for Muxin's review (plan §6, §7).

JSA VALUES-DEPTH FINDING (closes the SS2c UNVERIFIED flag, verified in code 2026-07-09): JSA's verdict (auto_analyze.py compute_verdict) is logistics-weighted. Remote/Parental/Salary/Job Protection carry weight 2.0; Human Enablement, the ONLY mission/values dimension, carries the floor weight 1.0, is never a hard gate, and acts only as a salary-conditioned compensator. The older graph/ pipeline has zero values dimensions. Therefore a JSA TARGET means strong logistics, NOT values alignment: --from-jsa --verdict TARGET is a logistics-fit seed source only, and every JSA-sourced lead MUST still pass this engine's quote-required worldview qualify (SS2c's posture, now confirmed necessary, not just prudent). Treat JSA's Human Enablement search output (mission-language quotes) as useful qualify evidence; ignore its score. Muxin is separately considering removing HE from JSA's scoring entirely since the anchor-graph network design covers similar-to-aligned discovery; that is a JSA-repo call, out of scope here, and this engine's qualify never depended on it either way. The real values instrument already built is the Cowork founder-deep-dive skill (Philosophical Depth Probe tiers + Layer-7 Introduction Test); port its rubric prose into config/outreach/ as the person-level qualify reference (its Apollo/MCP tool steps do not port; use web search).

TWO-KEY JOBSEARCH GATE (Muxin, 2026-07-09): a jobsearch-bucket lead cannot reach pursue without BOTH (a) company-level worldview qualification (quote-required per SS9f) AND (b) a named, evidenced like-minded person there (founder-deep-dive-style, extended beyond founders; Muxin's last job proves person-fit and company-fit diverge). Person-high/company-low still has value: record that person as an anchor in config/outreach/anchors.md (networking + future-referral node) even when the company is passed. Client<->employer conversion is expected: a lead's kind/bucket may change without losing its evidence and decision history. Rationale is strategic, not just preference: aligned people/orgs refer into more aligned work; misaligned ones refer into their own network.
- Superseded 2026-07-10: this session was ceiling-killed before ever creating a worktree (see PARKED note below); the relaunch card fb4d6b28 built and shipped this exact scope (PR #167, merged 2026-07-10, GOAL_CONDITION verified). Marking Done here too so cards that DEPEND ON this card's exact title (Phase 2 d5b34590, Phase 3 6590efec, Phase 5 96216ecc, Ingest-corpus d4524bd0) resolve correctly instead of staying blocked on a dead card forever.
- STATUS: Done
- DECISION: hold — card body itself states Rule 7 applies (research/qualify prompts are content-generation logic); build + draft PR, hold for review
- GROOMED: split from ba9769af per docs/outreach-engine-plan.md §6 Phase 1; explicit GOAL_CONDITION, seed-blocker resolved via --from-jsa pull, plan RATIFIED 2026-07-08 + 2026-07-09
- PARKED: hard context/turn ceiling exceeded (turns=255 tokens=100544) — session killed mid-card by the watchdog safety valve, never resumed — 2026-07-10
<!-- card-id: 8e8b616e-ba97-4421-8fed-978128e0b94b -->

**Inbound listening + voice-replies (Build 3)**
- New capability: listen for mentions/replies/DMs on the channels, and draft replies in Muxin's voice (config/voice.yaml) for her to approve.
- Where a platform has no API (e.g. Substack), reuse the constrained browser-agent capability (see analytics-download card) to read/post.
- Drafts surface in the unified review GUI as suggested replies. SAFETY: draft-only, never auto-send — mirror the notes-daily pattern (unscheduled drafts, human sends).
- This is the "AI answers in my voice" idea — scope and test carefully before any send path exists.
- PRIORITIZED (Muxin, 2026-07-08): moved ahead of Substack publishing automation — content-generation-affecting work goes first next session.
- GOAL_CONDITION: src/atomize/reply-draft.test.ts, src/cron/bluesky-mentions.test.ts, src/cron/bluesky-mentions-ledger.ts, src/publish/reply-approval-gate.test.ts, and src/review/page.test.ts all pass in the "check" CI job (npm test); a drafted reply never lands with queue-row status "approve" (reply-approval-gate.test.ts's gate case); `tsx src/atomize/reply-draft.ts --dry-run` produces a voice.yaml-compliant reply for a fixture mention with zero network calls and zero writes.
- RULE 7: src/atomize/reply-draft.ts drafts what a Bluesky reply says in Muxin's voice -> content-generation logic (same class as the rule's named video-script-drafting example) -> this PR HOLDS for Muxin's review: draft PR, old-vs-new reply-draft sample in the PR body, no auto-merge even though CI is green and the review-GUI touch (src/review/page.ts, rows.ts) is otherwise low-risk.
- SHIP: merged (PR #155, https://github.com/heymoosh/content-agents/pull/155 -- Muxin reviewed + merged 2026-07-10)
- STATUS: Done
- DECISION: approved — green-lit to start (draft-only replies, dependency already Done). Sequencing note UPDATED (2026-07-05): 87cb6d93 and 8b00ab2e — the two cards this was queued behind — are both now Done. This card is no longer blocked by sequencing; ready to pick up whenever prioritized.
- GROOMED: DECISION: approved already on file; dependency 0026b615 confirmed Done + 2026-07-08
<!-- card-id: db22283f-2e26-4f21-89a0-fcfe8f8fd4e9 -->

**Resume Outreach engine Phase 1 build (restart — ceiling-killed session, no worktree ever created)**
- Resume the Outreach engine Phase 1 build (engine core + client config, seeded leads) — previous attempt (card 8e8b616e) was killed mid-card by the watchdog turn/token ceiling before Step 2 (create_worktree) ever completed. No worktree exists and no commits were made — this is a clean restart, nothing to salvage from disk.
Original card 8e8b616e is PARKED (ceiling hit) — see its SCOPE/BUILD REQUIREMENTS/GOAL_CONDITION/RULE 7 lines for the full, already-groomed spec before restarting; nothing about the spec itself needs re-deriving.
RELAUNCH: 1
- Cold-start note (2026-07-10): worktree's uncommitted layer was found mid-revert (src/outreach/*, leads, npm scripts, GUI wiring deleted; unrelated already-merged whisper.cpp files stranded here as stray untracked copies) — restored to the last real commit (nothing lost, it was all committed), stray files removed, rebased clean onto origin/main (2 commits, no conflicts). Re-verified: tsc --noEmit clean, npm test 511/511 green, GOAL_CONDITION evidence confirmed on disk (client-posthog -> classification: greenfield, cited pitch_angle; client-axelerant -> classification: unclear, thin evidence correctly non-pitchable; data/outreach/run-log.jsonl has both real run entries). RULE 7 hold stands -> opening draft PR.
- PR: https://github.com/heymoosh/content-agents/pull/167 (Muxin reviewed + merged 2026-07-10; rebased through a package.json conflict against PR #155 first)
- SHIP: merged
- STATUS: Done
- DECISION: hold — carries forward the same DECISION already on 8e8b616e (RULE 7 applies: research/qualify prompts are content-generation logic; build + draft PR, hold for review). No new judgment call needed to restart.
- GROOMED: restart of ceiling-killed 8e8b616e; spec already fully groomed on the original card, no worktree/commits to salvage + 2026-07-10
<!-- card-id: fb4d6b28-a509-4297-adc6-ff98540eedb2 -->

**Update .claude/skills/publish + atomize SKILL.md for the Typefully card rewire**
- ORIGIN: follow-up auto-filed while building card 1829fdf9 (Phase 4: quote cards via Typefully).
The /publish and /atomize skill docs (.claude/skills/publish/SKILL.md, .claude/skills/atomize/SKILL.md) still describe the retired PostPeer/Upload-Post image_post provider flow for quote cards. The delegated build/review workers could not edit them (writes under .claude/skills/ require interactive permission not available to a headless worker). Update them to describe native Typefully image posts for quote cards on X/LinkedIn/Bluesky, matching the config/cta.yaml, config/providers.yaml, .env.example, and CLAUDE.md rule 3 updates already made in PR for card 1829fdf9.
GOAL_CONDITION: both SKILL.md files describe quote cards shipping as native Typefully image posts (not PostPeer/Upload-Post) for X/LinkedIn/Bluesky, with PostPeer still correctly described for TikTok only.
CHAIN: 1
- Resumed attended 2026-07-10: no real PID collision (verified via ps aux, one orchestrate-pipeline process). publish/SKILL.md step 5 was the only stale section (atomize/SKILL.md step 7 already described the current per-platform quote-card:<target> flow correctly). Shipped as PR #168 (merged, green CI, docs-only -> no RULE 7 hold).
- STATUS: Done
- DECISION: approved (Muxin, 2026-07-09, pre-flight) -- Muxin granted permission for the .claude/skills/ write; worker may request/accept the one-off sandbox override needed to edit publish/atomize SKILL.md.
- GROOMED: well-specified doc sync, explicit GOAL_CONDITION; note - needs an attended/interactive run since .claude/skills/ writes are permission-gated for headless workers + 2026-07-08
<!-- card-id: ebe652a7-f1db-477f-9856-3e11aec6f5fc -->

**Resume whisper.cpp vs Gemini transcription bakeoff (salvage worktree from ceiling-killed session)**
- Resume the whisper.cpp vs Gemini transcription bakeoff (card de591b28) — previous attempt was killed mid-card by the watchdog turn/token ceiling before finishing.
- One commit already sits on the worktree branch at /Users/Muxin/Documents/GitHub/content-agents-worktrees/wt-whispercpp-vs-gemini-transcription-de591b28 (branch wt/whispercpp-vs-gemini-transcription-de591b28, commit 6264f38, "Add whisper.cpp transcription adapter + bakeoff comparison script"). Working tree is clean (no uncommitted changes), no PR opened yet. Worktree left in place, not cleaned up — inspect and continue from that commit rather than rebuilding from scratch.
- Original card de591b28 is PARKED (ceiling hit) — see its DECISION/GROOMED lines for the already-answered scope (whisper.cpp vs Gemini, headless-executable) before restarting.
- STATUS: Done
- DECISION: approved — carries forward the same approval already on de591b28 (self-contained provider bakeoff/investigation, cost already logged per CLAUDE.md rule 6, no judgment call blocking it). review-stage self-vet 2026-07-10 (lane b): no GOAL_CONDITION carried onto this resume card, so self-authored one on HEAD 6264f38 (tsc --noEmit clean; npm test 434/434 green; whispercpp.ts exports a valid TranscriptionProvider; config/providers.yaml transcription: default unchanged=gemini) -> /goal met. /verify verified via the committed smoke-test artifact (whispercpp end-to-end transcript, $0 cost; gemini guard-clause correctly fired on missing key). /security-review PASS (execFileSync array-args only, fixed-list dynamic import, no secrets, scoped rmSync). Non-visual, not content-generation-logic (CLAUDE.md rule 7) -> ships on green, no PR-review hold.
- LANE: b
<!-- card-id: b1327a9c-3ffc-41df-a822-0c1e85458a1e -->

**Fix cards.test.ts leaking a row into real briefs/bets.md**
- Follow-up from Substack publishing automation (card 83f60f12, PR #164) code-review pass. cards.test.ts writes a test row directly into the real briefs/bets.md instead of saving/restoring it like substack.test.ts and reuse-guard.test.ts already do.
- Pre-existing test-isolation bug, consistent with and confirming the already-tracked backlog card aab1eec7 — give cards.test.ts the same save/restore pattern.
- CHAIN: depth 1 (follow-up of 83f60f12)
RESOLVED: already shipped in PR #165 (commit 96fb68e, "Fix cards.test.ts pollution of real briefs/bets.md") — betsPath() now honors CONTENT_AGENTS_TEST_BETS_PATH, cards.test.ts points it at a tmp fixture. Marking Done, no new work needed.
- STATUS: Done
<!-- card-id: 8d89becf-79bf-4c59-a6b8-2f4622bb8b97 -->

**Fix test pollution of briefs/bets.md (npm test writes to real file, not a tmp fixture)**
- Found while reviewing card a1a6f379: running npm test in a content-agents worktree can pollute briefs/bets.md with real test-run rows due to a pre-existing test-isolation bug (some test under src/publish/cards.ts writes to the actual file instead of a tmp fixture). ORIGIN: follow-up from a1a6f379.
- STATUS: Done
- DECISION: approved — pure test-isolation bugfix, no prod mutation, no judgment call
- GROOMED: clear scoped bug: src/publish/cards.ts test writes to real bets.md + 2026-07-10
<!-- card-id: aab1eec7-b913-46d9-8475-e3cc81533109 -->

**Resume Substack publishing automation build (salvage worktree from ceiling-killed session)**
- Resume the Substack publishing automation build (Notes-only browser-agent posting, folded into the unified GUI publish flow) — previous attempt (card 8026f53c) was killed mid-build by the watchdog turn/token ceiling before committing anything.
- Uncommitted work-in-progress already sits in the worktree at /Users/Muxin/Documents/GitHub/content-agents-worktrees/wt-substack-publishing-automation-8026f53c on branch wt/substack-publishing-automation-8026f53c: new src/publish/substack.ts + docs/setup-substack-publish.md, plus edits to src/publish/all.ts, src/publish/paste-files.ts, src/review/serve.ts (+serve.test.ts), config/platforms.yaml, package.json. Worktree left in place, not cleaned up — inspect and salvage before rebuilding from scratch.
- Original card 8026f53c is PARKED (ceiling hit) — see its DECISION/SCOPE lines for the already-answered scope (Notes only, 1 post/day cap) before restarting.
RETRY: 1
RELAUNCH: 1
GOAL_CONDITION: npm test (src/publish/substack.test.ts 6 cases: approve-only gate, no-approved-rows no-op, phase-1 claim, wait-not-due, phase-2 fire, dry-run-zero-mutations, 1/day cap) + src/review/serve.test.ts substack-routing cases all pass; npx tsc --noEmit clean.
- STATUS: Done
- DECISION: approved — carries forward the same approval already on 8026f53c (Muxin, 2026-07-08); scope already answered, no new judgment call needed to start.
- GROOMED: salvage worktree + DECISION already approved, points to exact files + 2026-07-10
<!-- card-id: 83f60f12-ab69-43a8-a38c-ff73c88ed0ed -->

**duplicateToPlatform: check target derivative path does not already exist BEFORE spawning claude, not just after**
- - ORIGIN: follow-up auto-filed while building card 4e7cb5d3 (Phase 2: GUI actions), found during the review stage's code-review pass.
- src/review/jobs.ts duplicateToPlatform() (~591-603) only checks the target derivative path does not already exist AFTER the claude subprocess runs. A stray out-of-band file sitting at that exact computed id could be silently overwritten by the subprocess's write.
- Judged low-severity/speculative at review time (the id is freshly computed via nextDerivativeId(), so a collision needs an unrelated file to already occupy that exact future id) -- not fixed inline, flagged for a real look later.
- GOAL_CONDITION: duplicateToPlatform() checks for an existing file at the target path BEFORE invoking the claude subprocess (not just after), and a test proves it refuses to overwrite instead of silently clobbering.
- CHAIN: 1
- STATUS: Done
- DECISION: approved — pure code fix (path-existence check before subprocess write), no judgment call, low risk
- GROOMED: well-specified bugfix follow-up on the just-shipped duplicateToPlatform(), explicit GOAL_CONDITION + test requirement + 2026-07-08
<!-- card-id: d1ebdd71-ba9f-4fd3-9aa2-f9cbbd4726d3 -->

**Unify the 6 duplicated Claude-job error-decoding blocks in src/review/jobs.ts + serve.ts**
- - ORIGIN: follow-up auto-filed while building card 4e7cb5d3 (Phase 2: GUI actions).
- Six near-duplicate enoent/timedOut/nonzero-exit error-decoding blocks exist across reviseDerivative, reviseBrief, generateInsights, askInsights, duplicateToPlatform, and runVideoJob/drain(): src/review/jobs.ts:121-135,151-159,417-426,481-491,596-603 plus src/review/serve.ts:256-262,292-297.
- Not fixed inline because it touches 6+ call sites with slightly different throw-vs-assign semantics -- a real (small) refactor, not a one-line fix.
- GOAL_CONDITION: the 6 call sites share one extracted error-decoding helper (enoent/timedOut/nonzero-exit), no behavior change, npm test stays green.
- CHAIN: 1
- STATUS: Done
- GROOMED: well-specified refactor, explicit GOAL_CONDITION + file:line refs, no external/cost/security surface + 2026-07-08
<!-- card-id: 84afb9e3-1394-4f15-945c-00d6ee32c613 -->

**Minimize model API cost — prefer subscription / free routes over per-token API (retro review + standing policy)**
- Requirement (Muxin, 2026-06-30): for ALL builds, default model usage to subscription / flat-rate / free routes and minimize per-token API spend. We lean on OpenRouter (per-token) more than needed.
- Part 1 — RETRO REVIEW the current setup (config/providers.yaml + skills). Today's paid/per-token routes: text-polish = grok-openrouter (VIDEO SCRIPTS); prose = grok-openrouter (FICTION, opt-in — default is already claude-native = $0); image = openrouter Riverflow ~$0.02 cost-first + paid step-ups (Nano ~$0.13, gpt-5.4-image ~$0.23); video-broll = Kling ~$0.08/s; transcription = gemini. For each: move to Claude-via-harness-subscription where quality allows, free-local where acceptable, or keep as a logged opt-in.
- Part 2 — CODIFY as a standing requirement so all unbuilt cards inherit it: policy added to CLAUDE.md (rule 6) + reflect in config/providers.yaml defaults; verify savings via the existing data/cost-log.csv.
- HONEST CONSTRAINT: there is NO clean "subscription API" for Grok or GPT — their APIs bill per token and the app subscriptions aren't programmatic. The real lever is "default to Claude (subscription via the harness)"; treat Grok/GPT/paid-image as opt-in only where they add value Claude can't (e.g. Grok's fiction voice). Don't promise subscription-Grok we can't deliver.
- Biggest concrete wins to evaluate: (a) video scripts on claude-native instead of grok-openrouter; (b) keep images free/cost-first, escalate only on request (already the policy); (c) confirm all Claude work routes through the harness subscription, not an Anthropic API key.
- Applies to simple-kanban builds too ("all builds") — same policy belongs in the conductor config via the claude-config lane (handoff; that conductor is live).
- STATUS: Done
- DECISION: defer — deprioritized, not high priority right now. Keep in Backlog. Flag when picked up: part of its scope touches the shared ~/.claude conductor config (cross-repo blast radius). 2026-07-04
- GROOMED: two-part scope clear (retro review of config/providers.yaml + codify CLAUDE.md rule 6), honest constraint already resolves the Grok/GPT subscription question + 2026-07-08
<!-- card-id: a1a6f379-556f-4e46-83a8-5e70fbd3c2b4 -->

**Extend Substack URL to atomize to any URL**
- You know how I can give you a substack essay URL and you can run it through atomize? I wanted to be able to do that with any link. Does it work that way?

SCOPE (Muxin confirmed, 2026-07-09): today /atomize's URL path (src/atomize/new-content.ts -> fetchSubstackPost in src/atomize/fetch-substack.ts) is Substack-only -- it fetches <origin>/feed, parses it as RSS, and matches the item by URL; content:encoded/description supplies the HTML. Any URL is assumed to be Substack; there is no fallback.
Add a generic fallback: when the feed fetch fails, has no matching item, or the URL's host isn't a feed at all, fetch the page HTML directly and extract the main article text via a readability-style extractor (no such library exists in this repo yet -- add @mozilla/readability + a lightweight DOM shim, e.g. linkedom; no native deps). Pull title/author/date from <title>/OpenGraph/meta tags or JSON-LD instead of RSS tags. Keep the existing Substack RSS path as the first attempt (it already handles Substack's paywall/markup correctly) -- this is a fallback, not a replacement.
Known limits to surface, not solve: heavy JS-rendered pages and hard paywalls still won't extract cleanly -- those still go through /atomize <file> or --text same as today.
GOAL_CONDITION: a non-Substack article URL (e.g. a normal blog/news post with no matching /feed item) run through `npm run new-content -- <url>` produces a content/<date>-<slug>/source.md with a correctly extracted title and body text, AND an existing Substack post URL still resolves via the RSS path exactly as before (no regression).
- RULE 7: NOT held -- this is source-ingestion/parsing (mechanical HTML->text extraction via Readability, same nature as the existing htmlToText() regex stripper), not extraction-first *derivative drafting* logic (which decides what a tweet/quote-card quotes from source.md). No LLM judgment, no change to what a derivative says. Auto-merges on green CI.
- SHIP: auto-pending-merge
- STATUS: Done
- GROOMED: scope + GOAL_CONDITION added (generic-URL fallback via readability extraction), no dependency overlaps + 2026-07-09
<!-- card-id: fe83c8f7-0c1c-45ab-b80a-73bbf07cba3a -->
