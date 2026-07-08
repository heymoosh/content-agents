# ⏸ PUBLISHING FREEZE (Muxin, 2026-07-04)

`/cycle` and `/publish` are PAUSED — no further content goes out (including GUI-Approve
auto-scheduling on text rows, per `a4a2ce27`) until the measurement scaffolding below ships:
`7e550e48` (routing drift flag), `92bb2ae6` (exploration budget), `ffa6491d` (posting-cap
decision). Rationale: don't build out further pipeline features or publish more content on an
unmeasured setup — get the experiment design in first. All other Backlog/To Do build-out waits
behind this group; it isn't cancelled, just sequenced after. Lift this banner once all three
scaffolding cards are Done and Muxin confirms resuming.

---

**Exploration budget: periodically test off-assignment pillars per platform to find missed coverage (separate from spin, separate from drift monitoring)**
- Distinct problem from the routing-drift flag (7e550e48): that card only monitors pillar/platform pairs ALREADY assigned in `routing.yaml` defaults — it can never discover whether an UNassigned pillar would also work on a platform, because pinning defaults to brand means that pillar never gets posted there at all. This card is the deliberate probe that fills that gap.
- CATCH-22 (Muxin, 2026-07-04): if LinkedIn only ever gets career-work content, that's the only data you can ever analyze from LinkedIn — you don't learn whether LinkedIn is ALSO good for other topics. Resolve via a small, deliberate, LABELED exploration budget, not a change to the default pinned assignment (brand consistency stays the day-to-day default; this is a rare, tagged probe on top of it).
- SPIN NOTE (Muxin, 2026-07-04): explicitly NOT about spin-vs-no-spin — Muxin considers spin necessary and isn't worried about isolating it. This card is purely about TOPIC coverage (untested pillar/platform pairs), not angle execution. The `--no-spin` control-run idea from 7e550e48 stays there, low-priority, decoupled from this card.
- ACTUAL UNTESTED SURFACE (derived from `config/routing.yaml` defaults, 2026-07-04): X already gets all 6 pillars by default (exploration doesn't apply there — full coverage exists). LinkedIn is untested for civic-tech and other (2 pillars). Bluesky is untested for career-work, builder, and other (3 pillars). Re-derive this list if routing.yaml's defaults change.
- CADENCE (Muxin, 2026-07-04, resolved same day): MONTHLY, not quarterly — quarterly was rejected as too slow (round-robining one platform's untested pillars would take ~1.5yrs to reach n=3 on any single pillar, effectively never resolving). Monthly, rotating through only the platform's actual untested pillars (2-3, not all 6), reaches n=3 per pillar in roughly 4-9 months depending on platform. Biweekly was raised as a faster alternative if monthly proves too slow in practice — leave as an easy dial to turn, not a redesign, if picked up later.
- MECHANISM: once a month per platform (LinkedIn, Bluesky — skip X, no gap there), pick whichever untested pillar has gone longest without a probe, draft ONE derivative for it tagged as an explicit exploration probe (distinct from a normal routed post), queue for Muxin's normal review-queue approval like anything else (rule 2 still governs — nothing auto-posts).
- DATA HANDLING: an exploration probe's result must NOT get folded into the platform/pillar's "official" resonance average used by route.ts or the drift flag — track it as its own coverage-data bucket so one exploratory flop/win doesn't skew the assigned-pillar signal. Surface accumulated exploration results (n, avg engagement per untested pillar) in `/strategy` once enough data exists to say anything.
- GOAL_CONDITION: each of LinkedIn's 2 and Bluesky's 3 untested pillars gets one tagged exploration probe roughly monthly; exploration-probe engagement data is tracked separately from (never merged into) the pillar/platform resonance figures route.ts and the drift flag use; `/strategy` surfaces accumulated exploration coverage once any untested pillar reaches n≥3.
- PRIORITY (Muxin, 2026-07-04): sequences alongside 7e550e48 as part of the same measurement-scaffolding group; same design conversation, likely shares one `/strategy` step with the drift flag and the angle refresh.
- STATUS: Review
- DECISION: approved (Muxin, 2026-07-04) — build the exploration budget; monthly cadence; scope limited to topic coverage, not spin isolation.
- GROOMED: ready — DECISION: approved, explicit GOAL_CONDITION (monthly probe cadence, separate coverage-data bucket, /strategy surfacing threshold); last of the 3 publishing-freeze scaffolding cards, prioritized ahead of other backlog build-out per the freeze banner
<!-- card-id: 92bb2ae6-936c-4d23-a72a-1b838f7434be -->

**[P0] Ask Claude buggy on the GUI?**
- I used Ask Claude to edit a Blue Sky post and turn it into an X post - I wanted it to ALSO create an X post based on the source content. Nothing’s working?
- Also I had my vault dashboard running at the same time which also uses Claude subscription for responses - I went back to it after submitting a task to it, and I noticed it didn’t finish its original task. I wonder if it’s because I triggered Ask Claude in the content GUI. Am I only able to ask for 1 single Claude task at a time? I’d want to be able to launch both my vault dashboard and content agents GUI and use them whenever I want - so if there’s conflicts, I don’t understand why. Isn’t each ‘request’ just a separate Claude task?
- I tried getting the GUI to create content from Substack notes that I selected - it’s been stuck on ‘working’ for like 10 mins. I can’t tell if it’s actually doing anything. I’m waiting for it to land on the Review tab.
- ROOT-CAUSED (2026-07-07): see docs/codebase-review.md Part 1 §1-3. Ask Claude is hard-scoped to editing one existing derivative body in place (its prompt forbids platform changes and new files, serve.ts:373-394), so both requests were impossible by design and the "didn't change anything" error only flashes for 1.4s. No hard one-Claude-task limit exists: only atomize jobs queue; the vault dashboard shares nothing with this GUI except subscription rate limits. The 10-min "working" is a black box because job output is buffered and discarded (no logs, no progress, 15-min timeout). Fix plan: persist+stream job logs, heartbeat in the jobs pill, durable inline errors, a per-row "Duplicate to platform" action, all Claude spawns through the one job queue.
- STATUS: Backlog
<!-- card-id: 9304e4a5-38f7-47dc-9b58-75e595b90fa7 -->

**[P2] Video script to Storyboard gap on GUI**
- If I approve the script, what happens next? Right now on the GUI I can’t even hit ‘approve’ to approve the script. 
- ROOT-CAUSED (2026-07-07): see docs/codebase-review.md Part 1 §6. Approve is deliberately blocked until video/storyboard.md exists (the phantom-approve guard from card 4bef9a7c, correct as-is), but the GUI has no way to run /video — its job queue only runs /atomize — so the video path dead-ends. Fix: add a "Generate storyboard" button on video-script rows that enqueues /video through the same job queue, making it a two-stage flow: script review → storyboard generation → storyboard approval → render.
- STATUS: Backlog
<!-- card-id: 9e20a616-3e13-4194-ab39-863acd5d53be -->

**[P1] Refresh button on GUI - purpose?**
- What does hitting Refresh on the GUI do?
- If I hit refresh on each tab - Add/Queue, Review, Analytics - what does it do and does it automatically update everything in the pipeline to sync?
- ANSWERED (2026-07-07): see docs/codebase-review.md Part 1 §5. One global Refresh (not per-tab): it re-scans every content/*/review-queue.md from disk, live-reconciles Typefully/PostPeer scheduled state when needed, and re-fetches the job list. It does NOT refresh the Analytics tab (brief loads once per page load; raw exports have their own button) and triggers no pipeline work. Fix: make it tab-aware, label it, show a last-refreshed timestamp.
- STATUS: Backlog
<!-- card-id: 3625b185-8025-4329-82d4-cb3b35c6ee70 -->

**[P0] GUI error - no content folder created**
- atomize finished but created no new content folder — check the terminal running the GUI
- This is all that the terminal said: Last login: Sun Jul  5 11:37:57 on ttys002
You have mail.

The default interactive shell is now zsh.
To update your account to use zsh, please run `chsh -s /bin/zsh`.
For more details, please visit https://support.apple.com/kb/HT208050.
MacBook-Pro-2:~ Muxin$ create-content

> content-agents@0.1.0 review
> tsx src/review/serve.ts


  Review queue → http://localhost:4600

  Approve / revise / discard / edit every pending derivative in one place.
  Only 'approve' rows are acted on by /publish. Ctrl-C to stop.

Cadence schedule (PT):
  bluesky:
    bluesky-2 → Wed, Jul 15, 6:30 PM PT
  ↳ note: bluesky-2 cta:source → homepage (no canonical_url in source.md)
scheduled: bluesky-2 (bluesky) → Wed, Jul 15, 6:30 PM PT → typefully draft 9778798, cta→inline
scheduled: quote-card-6-x (x) → upload-post upload-post job 090360eb3d464e06966cb7011183ad79 → x @ 2026-07-21T19:00:00.000Z
- ROOT-CAUSED (2026-07-07): see docs/codebase-review.md Part 1 §4. "Finished" only means the claude subprocess exited 0 (which it does even when /atomize accomplishes nothing); folder detection requires review-queue.md to exist, so a partially scaffolded folder reads as "no folder"; and the job's stdout is buffered then discarded, never reaching the terminal — the schedule lines seen were from unrelated approve actions. Fix: persist per-job log files, verify success by artifact (new folder + review-queue.md rows, or a machine-readable final line from /atomize), attach the log tail to the job error.
- STATUS: Backlog
<!-- card-id: c43a8041-60f9-4bea-b365-bc5d684eaca8 -->

**[P0] Use browser automation for image uploads**
- Instead of relying on the 3rd party, can’t I login to the sites on chrome, have that securely stashed, and we can just upload images that way? We do it for the analytics already.
- RECOMMENDATION (2026-07-07): don't build browser posting — see docs/codebase-review.md Part 1 §7. Pull is read-with-download-proof; posting is a fragile multi-step composer against platforms that fingerprint automation, with ToS exposure and no scheduling (breaks the scheduled-draft safety posture). The cheaper path is already in the repo: Typefully's v2 API officially supports image upload (verified in their migration-guide feature matrix 2026-07-07), and typefully.ts uploadMedia + media: frontmatter already implements that exact flow — proven live once with the animated-card mp4 (draft 9638763). PNG not yet exercised from this repo: do ONE supervised test card first, then rewire cards.ts so quote cards ship as native image posts on X/LinkedIn/Bluesky through the existing scheduled+reviewed Typefully path — retiring PostPeer/Upload-Post for cards. Keep PostPeer only for TikTok (its audited API beats any browser). Bluesky could optionally go direct AT Proto (SDK already a dependency).
- STATUS: Backlog
- DECISION: hold (Muxin, 2026-07-07) — confirmed the Typefully-native-image-upload recommendation above is clear as written. Build it and open the PR, but watch the first supervised test card (one PNG through Typefully) before rewiring cards.ts further or retiring PostPeer/Upload-Post for cards. Implementation tracked as its own child card, see Codebase-review fix — Phase 4.
<!-- card-id: ca75b2e0-aad3-4b2e-a069-660b64938029 -->

**Create quote and image cards**
- Combine both image gen and quote — an image post that carries BOTH a quote and a generated image, distinct from the existing text-only quote-card pipeline (a3127104, Done).
- I created an img folder - I’ll be using either ChatGPT or a free app to add images to it
- SCOPE CLARIFIED (Muxin, 2026-07-07): NOT the API image pipeline (config/providers.yaml image provider, ~$0.02-0.23/gen) — deliberately cheaper, using tools Muxin already has for free: ChatGPT (his own account, iterate on the image concept there) or a free/open-source local model. Not superseded by a3127104 (contextual per-platform captions) — that's a different feature (caption text), this is quote+image combined in one post.
- LIKELY PATTERN: Claude suggests an image concept/prompt from the source content; Muxin iterates externally (ChatGPT or his open-source model) until he likes a result; drops the file in; the pipeline assembles it into a quote+image card (verbatim quote + Muxin-provided image, no API image-gen call). May need to generalize into a "non-API image gen" pattern — wait for Muxin to hand off a file he likes, then assemble — rather than a generate-in-pipeline step.
- PRIORITY (Muxin, 2026-07-07): lower priority — revisit after the current content-stack work.
- STATUS: Backlog
- DECISION: defer (pre-flight, 2026-07-07) — Muxin already marked this lower priority, revisit after current content-stack work; hand-off pattern (ChatGPT vs free local model) not yet settled.
<!-- card-id: 1653734b-8eea-480b-93ea-3c5926159f81 -->

**Explore Draw Things (free local) for short-form video gen as a Kling cost-saver**
- ORIGIN: raised by Muxin 2026-07-07 alongside the quote+image card discussion — a tangent, not scoped yet.
- Draw Things is a free, local (on-device) image/video-gen app. Worth a bakeoff-style eval against Kling (currently ~$0.08/s via OpenRouter, used for video-broll first+last-frame animation) to see if it can do first+last-frame or general short-clip animation at comparable quality for $0.
- Unverified: whether Draw Things actually supports video generation (vs. image-only) — confirm this before scoping further.
- PRIORITY (Muxin, 2026-07-07): low — exploratory, not blocking anything.
- STATUS: Backlog
- DECISION: defer (pre-flight, 2026-07-07) — exploratory, unverified whether Draw Things even does video gen; Muxin marked low priority, not blocking anything.
<!-- card-id: 059c24ae-ffd5-4537-9e09-52c8d5682b05 -->

**Voice Notes to Published**
- Allow me to just drop a voice note (or typed) into Claude, we figure out what it should say at the end, and then it automatically runs /atomize or whatever the skills are to create good content out of
- Orchestrator level - I stay out of entering commands, Claude handles figuring out which skill to use. Still checks with me on approving content before they go out, but handles all the scheduling and making sure the right content goes on the right platform at the right cadence and publishing times etc..
- Skills Sanity Check
- RE-SCOPED (Muxin, 2026-06-30): the review/approval surface is NOT this card — it's the "Unified review + approval GUI" (a4a2ce27), the single approve-before-send surface. This card = the UPSTREAM half only: drop a voice note (or text) → figure out what it should say → auto-run /atomize (Claude picks the skill) → schedule, FEEDING the GUI. Approval + send happen in the GUI.
- STATUS: Backlog
- DEPENDS ON: Per-channel positioning: one clear angle per platform ("Swizzle")
- DECISION: defer — large orchestrator feature; scope the boundaries before building
<!-- card-id: 664189d9-8b3f-417f-a077-e8cd71d30477 -->

**Smarter routing**
- No longer going to keep a simple ’subscribe to substack’ CTA - it will depend on the content. See notes:
If the post is derived from a Substack essay and the main value is the argument, CTA = read the full essay / subscribe.

If the post is about a project, tool, system, case study, or build process, CTA = explore the project or landing page.

If the post diagnoses a builder/product problem, CTA = work with me or landing page.

If the post is broad worldview but mentions a concrete artifact, CTA = read essay + see project.

If the post is personal reflection, CTA = follow/subscribe, unless it connects directly to a project.

Mermaid of Job of Each Piece for CTA
flowchart TD
    A[New social/content piece] --> B{Main job of the piece?}

    B -->|Expand an essay idea| C[Send to Substack]
    B -->|Show what you built| D[Send to project page]
    B -->|Diagnose a builder/product problem| E[Send to work-with-me page]
    B -->|Personal reflection or point of view| F[Send to follow/subscribe]
    B -->|Mix of essay + artifact| G[Dual CTA:\nRead essay + see project]

    C --> H[Deepen audience]
    D --> I[Build proof]
    E --> J[Create income opportunity]
    F --> K[Build relationship]
    G --> L[Connect worldview to practice]

Examples - use both Primary and a Secondary CTA

| Content type               | Primary CTA                 | Secondary CTA                    |
| -------------------------- | --------------------------- | -------------------------------- |
| Essay excerpt              | Read full essay on Substack | See related project              |
| Society/capitalism piece   | Subscribe/read more         | Optional: explore projects       |
| AI agency thesis           | Read full essay             | See what I'm building            |
| Product/builder insight    | See how I think/work        | Read related essay               |
| Project demo               | Explore the project         | Work with me                     |
| Offer-adjacent post        | Work with me / landing page | Read my thinking                 |
| Personal career reflection | Subscribe/follow            | Maybe: see my job-search project |
| Case study                 | See projects / work with me | Read the essay behind it         |
- STATUS: Backlog
- DEPENDS ON: Landing page
- DECISION: hold (Muxin, 2026-07-04): agreed to hold pre-flight rec — needs real destination URLs for project/landing-page + work-with-me CTAs, and the tie-breaker rule for ambiguous posts, before this can be built.
<!-- card-id: 6dcaee98-1a54-4fc8-b170-92611872676f -->

**Add skill run-order quick-reference to the Obsidian Content Agents doc**
- Add a 'when to run each skill' quick-reference table to the external doc Personal Obsidian/Content Agents.md.
- Worked OUTSIDE this repo by Muxin. The conductor provides the markdown to paste.
- Keeps the human-facing run-order guide in sync with the pipeline.
- STATUS: Backlog
- DECISION: defer — external; Muxin updates the Obsidian doc outside this repo using the markdown the conductor provides
<!-- card-id: 5e86bf0e-10c6-4f59-8f3c-538596ee5e31 -->

**Landing page**
- Landing page for content CTAs (work-with-me / project pages / read-the-essay).
- Worked on OUTSIDE this repo. Smarter routing depends on this being live.
- When the landing page is live, mark this Done so Smarter routing unblocks.
- STATUS: Backlog
- DECISION: defer — external; built outside this repo. Mark Done when the landing page is live to unblock Smarter routing
<!-- card-id: 87c86b16-e30f-455b-9c3f-bd3b0e3f2648 -->

**Substack publishing automation (constrained browser agent, approved content only)**
- We auto-publish to X/LinkedIn/Bluesky (Typefully), YouTube, TikTok (PostPeer), and quote cards, but there is NO automation for publishing to Substack. Substack has no usable publishing API (CLAUDE.md rule 3).
- Build the POST side of the constrained browser agent we already use for analytics pull (src/pull/): drive the saved Substack session to publish or schedule an approved piece, and nothing else.
- SAFETY (non-negotiable): only acts on content Muxin set to `approve` in review-queue.md (rule 2), and browser posting needs Muxin's explicit go-ahead (rule 3). Never auto-post unreviewed.
- SCOPE ANSWERED (Muxin, 2026-07-04): NOTES ONLY. Muxin is good at writing his own essays/posts directly on Substack and wants to keep doing that himself — that stays manual. The actual gap is that Substack isn't part of the unified GUI's automated publishing flow yet; this card closes that gap for Notes.
- Reuses: the saved-session stealth-Chrome agent + diagnostics from the pull build; the unified scheduler (src/publish/slots.ts) for timing.
- RENEWED INTEREST (Muxin, 2026-07-07): flagged wanting Substack posting automation while discussing posting caps; target cap if/when built = 1 post/day max on Substack. Still deferred per the 2026-07-04 call below — revisit priority explicitly before starting, don't silently pick this up.
- STATUS: Backlog
- DECISION: defer — scope answered (Notes only, fold into the unified GUI publishing flow; Muxin keeps writing/scheduling his own essays/posts himself) but deprioritized: a new channel, not part of the content-stack work he wants tackled first. 2026-07-04
<!-- card-id: 8026f53c-0c52-46a2-aba1-e7e0bd416bdb -->

**Inbound listening + voice-replies (Build 3)**
- New capability: listen for mentions/replies/DMs on the channels, and draft replies in Muxin's voice (config/voice.yaml) for her to approve.
- Where a platform has no API (e.g. Substack), reuse the constrained browser-agent capability (see analytics-download card) to read/post.
- Drafts surface in the unified review GUI as suggested replies. SAFETY: draft-only, never auto-send — mirror the notes-daily pattern (unscheduled drafts, human sends).
- This is the "AI answers in my voice" idea — scope and test carefully before any send path exists.
- STATUS: Backlog
- DEPENDS ON: Automate the analytics download for /cycle (constrained browser agent)
- DECISION: approved — green-lit to start (draft-only replies, dependency already Done). Sequencing note UPDATED (2026-07-05): 87cb6d93 and 8b00ab2e — the two cards this was queued behind — are both now Done. This card is no longer blocked by sequencing; ready to pick up whenever prioritized.
<!-- card-id: db22283f-2e26-4f21-89a0-fcfe8f8fd4e9 -->

**Growth via borrowed audiences (other people's platforms), not just native social**
- Strategy note to fold into the weekly strategy brief: prioritize getting in front of OTHER people's existing audiences — podcast guest spots, guest essays / features in other newsletters, collabs, interviews, cross-posts — over grinding native social. Typically far more effective for reach and trust. NOT podcast-specific; any borrowed-audience channel counts.
- Treat native social (X/LinkedIn/Bluesky) as inbound funnels; Substack is home. Borrowed audiences drive new people toward Substack.
- Action seed: maintain a target list of podcasts / newsletters / platforms + a pitch angle aligned to the per-channel positioning card.
- STATUS: Backlog
- DECISION: defer — stays in Backlog, not now (Muxin, 2026-07-04).
<!-- card-id: 30772ba1-3c4a-4823-85ad-3a79788ed867 -->

**Content agent: find fit clients (lead-gen) — values + "open to changing their mind"**
- A content/research agent that finds and qualifies potential clients who are a genuine fit to work with Muxin — not just anyone with a budget.
- Fit situation 1 (turnaround): they've tried many times and nothing's working — Muxin comes in and finds the hidden/untested assumption that's the real problem. Surfacing what nobody tested is her core strength.
- Fit situation 2 (greenfield): they don't yet know what to build and want to avoid building the wrong thing early — she helps build the right thing the first time (or after their 10th/20th try).
- HARD qualifier: they must be OPEN to changing their minds / direction. NOT a fit if they just want execution of already-made decisions, or there's heavy politics blocking a change of direction.
- Shared values — the worldview detailed across her essays/content.
- The agent: build an ideal-fit profile from the above + her essays, then source + qualify candidates and surface them for her review (eventually into the unified review GUI). Could adapt the existing profile→research→score pattern (cf. the company-research skill, inverted: finding clients, not employers).
- Relates-to: Landing page (87c86b16, the work-with-me destination) + Smarter routing's work-with-me CTA. Sibling of the platform-finder card (same machinery, different target).
- SHARED ENGINE (Muxin approved, 2026-06-30): build ONE "fit-finder engine" (profile → source → qualify → surface) ONCE; this card + platform-finder are its two configs (target = clients vs platforms). Don't build two divergent implementations.
- STATUS: Backlog
- DECISION: hold — shared fit-finder engine approach already approved 2026-06-30, but needs proper scoping/triage before a worker starts; not urgent right now. 2026-07-04
<!-- card-id: ba9769af-f171-4f73-a373-2ca2cef5004c -->

**Content agent: find platforms to appear on (podcasts, channels, newsletters)**
- A content/research agent that finds OTHER people's platforms that are a strong fit for Muxin to talk about her work — podcasts, channels, newsletters, anyone with an audience and a real overlap, whether the hook is her essays (AI & society / fairness) or her product/build work.
- The agent: build a fit profile (topic overlap + audience + values), then source + qualify candidate platforms/hosts and surface them with a suggested pitch angle for her review.
- FEEDS the target list in "Growth via borrowed audiences" (30772ba1) — that card is the strategy; this is the agent that sources the targets. Pitch angle aligns to the per-channel positioning ("Swizzle"/Spin).
- Sibling of the client-finder card (same ideal-fit-profile → source → qualify → surface machinery, different target: platforms vs clients).
- SHARED ENGINE (Muxin approved, 2026-06-30): build ONE "fit-finder engine" (profile → source → qualify → surface) ONCE; client-finder + this card are its two configs (target = clients vs platforms). Don't build two divergent implementations.
- STATUS: Backlog
- DEPENDS ON: Per-channel positioning: one clear angle per platform ("Swizzle")
- DECISION: hold — same as ba9769af (shared engine, needs scoping); also still blocked on the Swizzle epic dependency. Not urgent right now. 2026-07-04
<!-- card-id: b7dcb608-4089-4f19-ba5c-df5dc1c75b7c -->

**Minimize model API cost — prefer subscription / free routes over per-token API (retro review + standing policy)**
- Requirement (Muxin, 2026-06-30): for ALL builds, default model usage to subscription / flat-rate / free routes and minimize per-token API spend. We lean on OpenRouter (per-token) more than needed.
- Part 1 — RETRO REVIEW the current setup (config/providers.yaml + skills). Today's paid/per-token routes: text-polish = grok-openrouter (VIDEO SCRIPTS); prose = grok-openrouter (FICTION, opt-in — default is already claude-native = $0); image = openrouter Riverflow ~$0.02 cost-first + paid step-ups (Nano ~$0.13, gpt-5.4-image ~$0.23); video-broll = Kling ~$0.08/s; transcription = gemini. For each: move to Claude-via-harness-subscription where quality allows, free-local where acceptable, or keep as a logged opt-in.
- Part 2 — CODIFY as a standing requirement so all unbuilt cards inherit it: policy added to CLAUDE.md (rule 6) + reflect in config/providers.yaml defaults; verify savings via the existing data/cost-log.csv.
- HONEST CONSTRAINT: there is NO clean "subscription API" for Grok or GPT — their APIs bill per token and the app subscriptions aren't programmatic. The real lever is "default to Claude (subscription via the harness)"; treat Grok/GPT/paid-image as opt-in only where they add value Claude can't (e.g. Grok's fiction voice). Don't promise subscription-Grok we can't deliver.
- Biggest concrete wins to evaluate: (a) video scripts on claude-native instead of grok-openrouter; (b) keep images free/cost-first, escalate only on request (already the policy); (c) confirm all Claude work routes through the harness subscription, not an Anthropic API key.
- Applies to simple-kanban builds too ("all builds") — same policy belongs in the conductor config via the claude-config lane (handoff; that conductor is live).
- STATUS: Backlog
- DECISION: defer — deprioritized, not high priority right now. Keep in Backlog. Flag when picked up: part of its scope touches the shared ~/.claude conductor config (cross-repo blast radius). 2026-07-04
<!-- card-id: a1a6f379-556f-4e46-83a8-5e70fbd3c2b4 -->

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
<!-- card-id: b0e4ecc5-6120-4b40-a6dd-859c34ca332a -->

**Track a storytelling-improved bucket in bets.md / origin-compare**
- - Consider whether origin-compare / briefs/bets.md should eventually track a
- "storytelling-improved" bucket the way spin/verbatim is tracked, so Muxin can measure
- whether the rehook pass actually lifts resonance.
- - Depends on: enough published volume with the new storytelling dimension scored.
- - CHAIN: 1
- STATUS: Backlog
- DECISION: defer (pre-flight, 2026-07-07) — data-gated (CHAIN:1 follow-up), needs published volume with the storytelling dimension scored that does not exist yet; nothing to build tonight.
<!-- card-id: f77b6670-d39d-4c13-b9be-004084510e58 -->

**Codebase-review fix — Phase 2: GUI actions (storyboard button, duplicate-to-platform, unified job queue, tab-aware refresh)**
- Add a "Generate storyboard" button on video-script rows that enqueues `claude -p "/video <folder>"` through the existing job queue (serve.ts:796) — turns the video path into script review → storyboard generation → storyboard approval → render, all inside the GUI. Closes 9e20a616.
- Add a per-row "Duplicate to platform..." action: copies the derivative, respins it for the target platform's angle via the existing spin path, appends a new review-queue row, lands back in Review. This is the missing "create a post" affordance behind the rest of 9304e4a5's Ask Claude complaint.
- Route ALL Claude spawns (revise serve.ts:411, insights 530, ask 571, brief revise 671) through the one existing job queue so GUI concurrency is bounded and every run gets a log (built in Phase 1).
- Teach Ask Claude to refuse out-of-scope requests (platform change, new post) with a one-line reason instead of silently no-op'ing.
- Make Refresh tab-aware (refresh whichever tab is active, including the brief), label it, show a "last refreshed HH:MM" stamp. Closes 3625b185.
- ORIGIN: docs/codebase-review.md Part 3, Phase 2 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Backlog
- DEPENDS ON: Codebase-review fix — Phase 1: job observability (uses the job queue + logs Phase 1 builds)
<!-- card-id: 4e7cb5d3-a032-41db-8c49-474a48779261 -->

**Codebase-review fix — Phase 4: quote cards ship as native Typefully image posts**
- Attach card PNGs as `media:` on Typefully drafts (uploadMedia + media: frontmatter already implemented, typefully.ts:61-75, 304-313, proven once for an animated mp4). Rewire cards.ts so quote cards ship as native image posts on X/LinkedIn/Bluesky through the existing scheduled+reviewed Typefully path — retiring PostPeer/Upload-Post for cards. PostPeer stays for TikTok only (audited API, genuinely better there).
- This IS the build implementing ca75b2e0's recommendation (don't build browser posting — use Typefully's existing image-upload path instead).
- HOLD (inherits ca75b2e0's DECISION, 2026-07-07): do ONE supervised test card first (a real PNG through Typefully, confirm it renders on X/LinkedIn/Bluesky drafts) — Muxin watches that first live test — before rewiring cards.ts fully or retiring the relays.
- ORIGIN: docs/codebase-review.md Part 1 §7, Part 3 Phase 4 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Backlog
- DEPENDS ON: Use browser automation for image uploads (shares the same recommendation/decision; this card is its implementation)
- DECISION: hold — inherits ca75b2e0's decision (Muxin, 2026-07-07): build it and open the PR, but watch the first supervised test card (one real PNG through Typefully) before rewiring cards.ts fully or retiring PostPeer/Upload-Post for cards.
<!-- card-id: 1829fdf9-4b9e-4cad-9744-cb42e094300d -->

**Multi-slot-per-day scheduler: support >1 post/platform/PT-day, starting with X**
- ORIGIN: split out of ffa6491d's own DECISION (2026-07-07) — Muxin's actual ask for X is multiple posts/day, but the unified scheduler (src/publish/slots.ts + data/publish-schedule.jsonl) enforces ≤1 post/platform/PT-day; ffa6491d explicitly called this 'a separate, bigger follow-up, not bundled into this config bump' and shipped only the X posts_per_week 5→7 config change instead.
- Bluesky is already at this architecture's ceiling (7/wk, all slot_days) with no headroom left — confirms the limit is structural, not a config number.
- Scope: extend slots.ts's claim logic so a platform's config can allow N slots/PT-day (default 1, preserving today's behavior for LinkedIn/Bluesky/every other platform); wire a per-platform max into config/platforms.yaml; space claimed slots across the day rather than one fixed time.
- Muxin still needs to pick X's actual target (ffa6491d cited industry guidance of 3-5 posts/day) and confirm content supply can fill the added slots without violating min_reuse_days — a follow-up decision for whoever picks this up, not a blocker to scoping the mechanism itself.
- GOAL_CONDITION: src/publish/slots.ts can claim more than one slot per platform per PT-day when that platform's config specifies a max >1; before, claimSlots hard-caps every platform at ≤1/day regardless of config; after, X (once configured with a max >1) can hold multiple claimed slots within one PT-day while LinkedIn/Bluesky/other platforms keep defaulting to 1 and are unaffected.
- PARENT: ffa6491d-46f9-416f-b521-1fb15e1a391b
- ORIGIN: proposed by propose-cards 2026-07-07 from epic Evaluate raising per-platform posting caps (X, LinkedIn, Bluesky) for more volume (ffa6491d-46f9-416f-b521-1fb15e1a391b)
- STATUS: To Do
- GROOMED: ready — mechanism-only scope (configurable N slots/PT-day, default 1 preserves current behavior), concrete GOAL_CONDITION, X's actual target number explicitly deferred as separate decision, not approval-worthy (no external/cost/security surface) + 2026-07-07
<!-- card-id: c58fa530-544b-4cde-a04f-2be6b83ed510 -->

**Systematize periodic --no-spin control runs per pillar/platform pair (feeds the routing drift flag's spin/topic-fit isolation)**
- ORIGIN: 7e550e48's own EXPERIMENTAL RIGOR requirement #2 — 'Systematize the --no-spin control runs the retro card (2eb4ea51) already recommended ad hoc — a periodic, deliberate control per pillar/platform pair, not a one-off gut check.' The shipped drift flag (7e550e48, Done) only reports whether a no-spin control exists per pillar/platform pair; it doesn't generate those controls itself, so every pair currently reports 'no control available' with nothing to change that.
- Without a live no-spin baseline the flag can't separate 'wrong platform for this topic' from 'angle isn't landing' — the exact ambiguity 7e550e48 was designed to resolve for Muxin.
- Scope: on a periodic cadence (fits the /strategy pass, same rhythm as the angle refresh (8ba83a4c) and exploration budget (92bb2ae6)), pick one pillar/platform pair and draft one derivative with --no-spin, tagged as a control run distinct from normal spin-on posts; queue it through the normal review-queue.md approval like any other derivative.
- Data handling: track control-run engagement in its own bucket, same posture as 92bb2ae6's exploration-probe bucket — never folded into the pillar/platform's official resonance average.
- Once ≥1 control run exists for a pair, route.ts --all's divergence flag should report no-spin-control availability as true for that pair instead of permanently false.
- GOAL_CONDITION: Running the control-run step produces a --no-spin derivative tagged as a control run for one pillar/platform pair on each periodic pass, tracked separately from spin-on engagement data; after at least one control run exists for a pair, route.ts --all's divergence flag reports no-spin-control availability as true for that pair (previously always false, since no mechanism produced these controls).
- PARENT: 7e550e48-adcf-44d3-83ea-626ee079b9ef
- ORIGIN: proposed by propose-cards 2026-07-07 from epic Routing drift flag: surface data-vs-brand platform divergence in /strategy (never auto-gate) (7e550e48-adcf-44d3-83ea-626ee079b9ef)
- STATUS: To Do
- GROOMED: ready — cadence/selection explicitly inherits sibling card 92bb2ae6's MECHANISM (monthly, longest-since-last-control rule), concrete GOAL_CONDITION, output goes through normal review-queue.md approval (rule 2 still governs) + 2026-07-07
<!-- card-id: f444f440-7221-4741-a682-254f27f66e29 -->

**Re-validate storytelling rubric once broader real-data sample exists (n>=20 across >=3 sources)**
- ORIGIN: follow-up from card 9be7688d (Validate storytelling rubric against real /atomize output) — docs/storytelling-rubric-validation.md.
- That validation found the live sample (n=6, ONE source, 2026-07-05-hey-substack) does not reproduce the original eval's all-three-dimension 2-3 clustering: hook is 4 on every real derivative so far, resonance is 4-5, only narrative actually clusters at the LOW_SCORE_THRESHOLD=3 soft-gate (3 on 4 of 6, correctly flagged).
- FOLDER NOTE: 9be7688d's own DECISION named content/2026-07-05-what-i-ve-described-in-my-essay-building-an-inno/ as the target ('most recent /atomize output at time of decision'). At execution time (and still true as of this filing) that folder has only source.md + review-queue.md -- no derivatives/, so it has never been through a full /atomize scoring pass and had no storytelling scores to validate. Used content/2026-07-05-hey-substack-i-m-looking-for-others-who-feel-int/ instead, the only folder in the repo with real populated hook/narrative/resonance scores. Worth checking the originally-named folder too once/if it gets atomized.
- Recommendation was to keep the rubric/threshold as-is (sample too thin to retune) but re-check once storytelling scores exist across a handful of distinct source pieces.
- Scope: once npm run validate has real hook/narrative/resonance scores across n>=20 derivatives spanning >=3 different source essays/notes (not just more posts from the same source), re-run the same comparison. Specifically check whether hook/resonance keep showing zero variance across multiple sources -- if so, that is worth a real conversation about narrowing the rubric to the dimension that actually discriminates (narrative) vs keeping all three.
- GOAL_CONDITION: a findings note (extending or superseding docs/storytelling-rubric-validation.md) reports the hook/narrative/resonance distribution across >=20 real scored derivatives spanning >=3 distinct source pieces, states whether hook/resonance still show zero variance, and gives a concrete keep-as-is-or-change recommendation.
- CHAIN: 1
- STATUS: Backlog
<!-- card-id: f1a928d1-3e2e-444e-8f68-058726f3053e -->

**queue --sync orphan-release can misfire past a live-service pagination limit**
- - ORIGIN: follow-up auto-filed while building card 5f039a7e (Phase 3b: provider retry/backoff + orphaned slot cleanup).
- syncLedger releases a future ledger claim once reconcile() confirms no live post matches it, but the live-post lists it checks against are paginated at the source (Typefully fetchScheduledDrafts limit=50, YouTube listScheduledUploads maxResults=25). A genuinely-live post sitting beyond that page would misreport as claimedNotLive and get released, letting a later run double-book that slot.
- Not realistically triggerable today (posts_per_week caps are well under 50/25 and the ledger only ever holds a few weeks of future claims), so shipped as a documented, low-probability limitation rather than blocking Phase 3b on it.
- Fix is a product/design call, not mechanical: options include full pagination on both list calls, a grace period before releasing a claimedNotLive claim (skip release until it has been unmatched across 2+ consecutive --sync runs), or reverting --sync to advisory-only (report, never release).
- GOAL_CONDITION: pick one of the three mitigations above (or an equivalent), implement it, and add a test proving a live post beyond the current pagination limit is never wrongly released by --sync.
- CHAIN: 1
- STATUS: Backlog
<!-- card-id: c18c39a9-72d7-4e51-a05e-e13fa57ae601 -->

**Codebase-review fix — Phase 5c: split serve.ts into page/jobs/rows/routes**
- M1: serve.ts is a 1,720-line monolith — the HTTP server (~15 routes, 889-1086), a ~620-line inlined HTML/CSS/JS template (1099-1720, including a hand-rolled markdown renderer whose regexes need double-escaping inside the template literal), fs mutation, and Claude subprocess orchestration all in one file. Everything behind the Phase 1/2 complaint fixes is untestable while it's tangled with I/O.
- Mechanical split, no behavior change: page.ts (client), jobs.ts (queue + claude runner), rows.ts (fs read/write), serve.ts (routes only).
- P1 (fold in, same file): /api/queue re-reads + re-parses every content folder synchronously on every request (listPieces, serve.ts:305-336), sometimes plus a live Typefully/PostPeer fetch — fine at ~33 folders, degrades linearly as content accumulates. Fix while splitting: cache parsed rows keyed by file mtime; run provider reconciliation on a background interval with a staleness stamp instead of inline per-request.
- DO THIS BEFORE further GUI feature work piles onto serve.ts (per the doc's own recommendation) — ideally right after Phase 1/2 ship, not deferred indefinitely.
- ORIGIN: docs/codebase-review.md Part 2 M1/P1, Part 3 Phase 5 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Done
- GROOMED: ready — mechanical serve.ts split (page/jobs/rows/routes) + request caching for /api/queue, no behavior change intended
<!-- card-id: c310160b-d296-4219-ab28-4cd50c0a3b40 -->

**Codebase-review fix — Phase 5b: unify review-queue.md column parsing**
- M2: the 10-column review-queue.md table (the approval database) is decoded by hard-coded `cells[N]` offsets in 3 independent places: src/publish/queue.ts:29-52 (canonical), src/review/serve.ts:339-361 (updateRow reimplements the write path), src/video/render.ts:198-211 (a third parser). The 2026-07-04 origin-column addition already required hand-hunting all three. Fix: one typed review-queue module (grow queue.ts) exposing readRows/writeCell; route serve.ts and render.ts through it.
- M4 (fold in, adjacent code): serve.ts:85-95 (splitRaw) forks src/util/frontmatter.ts to keep the raw header for byte-preserving edits. Fix: extend splitFrontmatter with an option to return the raw header; delete the fork.
- ORIGIN: docs/codebase-review.md Part 2 M2/M4, Part 3 Phase 5 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Done
- GROOMED: ready — unify 3 independent review-queue.md column parsers into one typed module, exact files named, no schema break
<!-- card-id: 570e8c90-c081-49b8-b77e-dc5c1080bd2b -->

**Codebase-review fix — Phase 5a: config validation & loaders (zod, memoized loader, slots/cta tests)**
- R4: zod is a dependency but used nowhere. Configs load as `parse(readFileSync(...)) as T` inside bare `catch {}` blocks that silently return defaults — one YAML typo silently disables behavior: typefully.ts:77-89 (max_chars → Infinity, over-length posts ship), cta.ts:19-33 (CTAs vanish), slots.ts:25-42 (cadence falls back to next-free-slot), reuse-guard.ts:26-40 (reuse limits off). Fix: per-config zod schema validated once at load; ENOENT → defaults, anything else → loud throw naming the file + reason.
- M3: config/platforms.yaml is independently read + cast in 6 files (thread-check.ts:21, validate.ts:126, spin.ts:15, typefully.ts:79, reuse-guard.ts:28, slots.ts:27), each with its own partial `as {...}` shape that can drift. Fix: one memoized loadPlatforms() returning the R4-validated object; same pattern for other config files.
- R5 (fold in, same touched files): zero tests on slots.claimSlots (decides every post's send time — DST math, weekly caps, daily uniqueness) and cta.ts. Add table-driven tests for both while hardening their config loading — pure logic, nothing to mock.
- ORIGIN: docs/codebase-review.md Part 2 R4/M3/R5, Part 3 Phase 5 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Done
- GROOMED: ready — zod config validation + memoized loader + tests, exact files named, no external/cost/security surface
<!-- card-id: 5b3a258b-202d-4036-8a6f-f797a4def753 -->

**Codebase-review fix — Phase 3b: provider retry/backoff + orphaned slot cleanup**
- R2: no retry/backoff on any of the 28 provider fetch sites — a single 429/5xx/network blip aborts the row (the only existing retry is Typefully media transcoding, typefully.ts:324-338), and these transient blips are what turn into Phase 3a's partial-post states. Fix: one small shared fetchWithRetry (exponential backoff on 429/5xx/network) wrapped around publish + provider adapters.
- R3: slots are claimed in the ledger BEFORE posting (slots.ts:132-197); a mid-run abort leaves a future claim with no post behind it. pruneLedger only drops past days; queue --sync detects this as claimedNotLive drift (queue-view.ts:296-298) but doesn't clean it, so every failed run permanently shifts later posts. Fix: extend --sync to release future claimedNotLive claims (print the diff), and/or release a claim in a `finally` when its post never happened.
- P2 (fold in while touching slots.ts): pruneLedger's single writeFileSync rewrite of publish-schedule.jsonl (slots.ts:110-119) isn't atomic — a crash mid-write truncates the ledger. Write-temp-then-rename.
- Sequence BEFORE raising posting caps (ffa6491d), same reasoning as Phase 3a. Can run in parallel with 3a (touches slots.ts/provider adapters vs. cards.ts/queue.ts).
- ORIGIN: docs/codebase-review.md Part 2 R2/R3/P2, Part 3 Phase 3 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Done
- GROOMED: ready — shared retry/backoff wrapper + orphaned-slot cleanup + atomic ledger write, exact files named, no new external/cost/security surface
<!-- card-id: 5f039a7e-c4f0-48d5-930f-c1700c4f57c4 -->

**Codebase-review fix — Phase 3a: publish idempotency (fix the multi-group double-post window)**
- R1: /publish's only idempotency guard is flipping the review-queue row to `published` (queue.ts:54), which happens AFTER provider calls. Worst case: cards.ts:278-285 posts a withLink group (Bluesky/LinkedIn) then a noLink group (X); if group 2 fails transiently, group 1 is already live, the row stays `approve`, and the next /publish re-posts BOTH groups.
- Fix: consult publish-log.md before posting (the parser + findLoggedRef already exist in src/review/reconcile.ts); write a per-group placement marker immediately after each successful provider call; skip already-logged groups on re-run.
- Sequence BEFORE raising posting caps (ffa6491d) — more volume makes this failure mode more likely, not less.
- ORIGIN: docs/codebase-review.md Part 2 R1, Part 3 Phase 3 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Done
- GROOMED: ready — concrete idempotency fix (consult publish-log before posting, per-group markers), exact files named, no new external/cost/security surface
<!-- card-id: a47073b9-85e0-4c44-8afd-ba87724a462e -->

**Validate storytelling rubric against real /atomize output**
- - Run the new storytelling rubric (hook/narrative/resonance) against the next real /atomize
- output to get real scores and validate the soft-gate against live data, not just the test
- fixture used to build it.
- - Depends on: nothing — ready now, just needs an actual /atomize scoring pass on real content.
- - CHAIN: 1
- STATUS: Done
- DECISION: unparked (Muxin, 2026-07-07) — validate against `content/2026-07-05-what-i-ve-described-in-my-essay-building-an-inno/` (most recent /atomize output at time of decision).
- GROOMED: ready — bounded validation task (run storytelling rubric against real /atomize output, compare to fixture baseline), CHAIN:1, no blocking dependency
<!-- card-id: 9be7688d-a41d-4e58-9fce-a9c8df8e4644 -->

**Codebase-review fix — Phase 1: job observability (persist + stream Claude job logs)**
- Persist every Claude/atomize job's stdout/stderr to a log file (e.g. ~/.content-agents/logs/gui-jobs/<jobId>.log), streaming as it arrives (spawn with piped streams, not execFile's 40MB in-memory buffer, serve.ts:796-801).
- Add elapsed time + last-stdout-line heartbeat to /api/jobs; render both in the jobs pill (serve.ts:735-740, 1622-1629).
- Add a "view log" link per job serving the log file.
- Replace the 1.4s auto-hiding toast (serve.ts:1332, 1458) with durable inline error text on the row.
- Verify success by artifact, not exit code: after the subprocess exits, check a new folder + review-queue.md rows exist (or parse a machine-readable final line /atomize prints); attach the last ~30 log lines to job.error on failure.
- Closes cards c43a8041 (no content folder created) and the stuck-working + invisible-error halves of 9304e4a5 (Ask Claude buggy) — see docs/codebase-review.md Part 1 §3-4 for full root cause.
- ORIGIN: docs/codebase-review.md Part 3, Phase 1 (split from 5ec087d4, 2026-07-07)
- PARENT: 5ec087d4-fd64-4932-b5cd-4e9edeec5460
- STATUS: Done
- DECISION: merged (Muxin, 2026-07-07) — PR #99 reviewed and merged.
- GROOMED: ready — detailed technical fix (persist/stream job logs, heartbeat, durable errors, artifact-based success check), exact files/lines named, no external/cost/security surface
<!-- card-id: efae4554-cc52-4aec-ad32-9475d6aa4fdf -->

**Surface the thread-check advisory in review-queue.md itself, not just validate output and the GUI badge**
- - Follow-up from card 87cb6d93 (Home-brand-thread check at review time, with Spin auto-drafting the thread in when missing).
- Currently the pass/missing signal lives in derivative frontmatter (thread_check/thread_spin_applied, read by the review GUI badge) and in npm run validate's advisory console summary. Someone skimming the raw review-queue.md markdown directly (not the GUI, not validate output) sees nothing.
- Consider appending a short note to review-queue.md's notes column when a piece is queued with thread_check: missing after a Spin-draft attempt, so the raw markdown itself surfaces it too.
- Small, additive, no schema break — extends the existing notes column convention.
- CHAIN: 1
- STATUS: Done
- GROOMED: ready — small additive review-queue.md notes-column change (surface thread_check:missing), no schema break, CHAIN:1
<!-- card-id: 4c3eb6be-fbf4-4a6c-ae25-992009f9b848 -->

**Add LinkedIn to the notes-daily spread platforms**
- STALE REFERENCE (2026-07-04): notes-daily.ts no longer has a SPREAD_PLATFORMS list at all — it doesn't draft anything anymore (see the content-generation-review fix, same date). Real per-note platform selection now happens locally via `/atomize notes` (`.claude/skills/atomize/references/notes-mode.md`), which routes through the normal `config/routing.yaml` per-pillar logic like any other piece, not a notes-specific hardcoded list.
- Add 'linkedin' if Muxin wants longer / essay-like notes echoed there.
- Muxin's call on whether his notes fit the LinkedIn register.
- VERIFIED (conductor, 2026-07-07): already covered, no code change needed. `/atomize notes` (notes-mode.md step 3) routes every note through the exact same `config/routing.yaml` per-pillar logic as any other content — grepped `src/atomize/new-notes.ts` and `src/cron/notes-daily.ts`, no LinkedIn-specific filter exists anywhere. LinkedIn is already a default platform for 4 of 6 pillars (human-ai, claude-code, career-work, builder) in `config/routing.yaml`, excluded only for civic-tech/other — exactly the DECISION's "same platform-fit test, not a blanket add." Expanding LinkedIn into civic-tech/other's defaults would be a separate routing-config judgment call (the exploration-budget card 92bb2ae6 is the deliberate mechanism for probing that), out of scope here.
- STATUS: Done
- DECISION: approved — LinkedIn gets the SAME platform-fit test the other spread platforms already use, not a blanket add: if a note is a good fit for a platform, it spreads there, and that rule now includes LinkedIn too (Muxin, 2026-07-04). Check whether config/routing.yaml already covers this for notes, or needs a small adjustment there.
- GROOMED: ready — DECISION: approved, LinkedIn gets same platform-fit test as other spread platforms via config/routing.yaml, small bounded check/adjustment
<!-- card-id: 48df9ed1-1e90-4cc5-84f5-29750bffa5bb -->

**Evaluate raising per-platform posting caps (X, LinkedIn, Bluesky) for more volume**
- Muxin's read from real-world experience (2026-07-04), not yet reconciled with config: X can handle a LOT more than the current `posts_per_week: 5`; LinkedIn can comfortably run 5/week (current cap: 2/week, Tue/Thu only); Bluesky — no strong opinion, Muxin only checks it occasionally for political updates, open to review; Substack — sees daily to multiple Notes/day in the wild, but N/A here (see below).
- SUBSTACK IS NOT IN SCOPE: `config/platforms.yaml` has no `substack` entry because Substack is the SOURCE channel, not a routing target (see `config/routing.yaml` header) — the pipeline doesn't automate or cap Muxin's own Notes posting there at all; that stays entirely manual and outside this card.
- ARCHITECTURE CONSTRAINT (found 2026-07-04): the unified scheduler enforces ≤1 post/platform/PT-day via the shared ledger (`data/publish-schedule.jsonl`, `src/publish/slots.ts`). Bluesky's current `posts_per_week: 7` with all 7 `slot_days` is ALREADY at the ceiling this architecture supports (one/day, every day) — going beyond daily on any platform needs real multiple-slots-per-day scheduler work, not a config number change. Before scoping, confirm whether "X can do a lot per day" means (a) more days/week within the existing ≤1/day model (a config bump, e.g. 5→7-10/wk within slot_days), or (b) literally multiple posts/day (needs new scheduler logic) — these are very different sized changes.
- CONTENT-SUPPLY CHECK: raising caps only helps if there's enough distinct original source material weekly to fill the added slots without violating each platform's `min_reuse_days` (x:14, linkedin:60, bluesky:21) or thinning derivative quality by over-atomizing the same source. Check actual weekly essay/note output against proposed new caps before locking numbers in.
- WHY THIS MATTERS BEYOND VOLUME: more posts/week directly speeds up how fast pillar/platform cells reach the n≥3 sample floor used by route.ts, grade-bets.ts, and the two sibling cards above (routing drift flag 7e550e48, exploration budget 92bb2ae6) — this isn't purely a growth lever, it also shortens the wait on every data-driven decision in the pipeline.
- OPEN QUESTIONS for whoever picks this up: (1) confirm X daily-multiple vs. weekly-bump scope per above; (2) pick actual new `posts_per_week` + `slot_days` numbers per platform with Muxin; (3) decide if Bluesky needs anything beyond its current daily ceiling, or stays as-is given Muxin's lack of strong opinion; (4) verify source-content supply supports the new volume.
- GOAL_CONDITION: Muxin has picked explicit new `posts_per_week`/`slot_days` values for X and LinkedIn (Bluesky stays or changes per his call once reviewed); if any platform needs more than 1 post/PT-day, that scheduler gap is either resolved or explicitly deferred as its own follow-up; config/platforms.yaml reflects the decided numbers.
- PRIORITY (Muxin, 2026-07-04): sequences alongside 7e550e48 and 92bb2ae6 as part of the same measurement-scaffolding group: more volume speeds up how fast every experiment above reaches a usable sample size, so the cap decision is scaffolding too, not just a growth lever.
- LIGHT RESEARCH (2026-07-07): checked Muxin's read against current best-practice guidance. X: data-backed guides put the sustainable sweet spot at 3-5 posts/day (accounts posting 1-3x/day see the strongest growth; beyond ~5x/day shows diminishing returns) — Muxin's "post a lot more" instinct is directionally right, but the architecture (≤1 post/platform/PT-day via the shared ledger) can't do more than 1/day today, so hitting even the low end of that range needs the multi-slot-per-day scheduler work this card's ARCHITECTURE CONSTRAINT already flags, not a config number. LinkedIn: guidance ranges 2-5x/week; Muxin's real-world experience running 5x/week is within the credible range. Bluesky: no frequency-specific guidance found beyond "consistency over volume, don't overpost" — nothing pushes for more than the current daily ceiling.
- DECISION (Muxin, 2026-07-07):
  - LinkedIn → posts_per_week: 5, slot_days: [Mon, Tue, Wed, Thu, Fri] (stays business-hours-only, spread across the work week). Fits inside the existing ≤1/day model — pure config change, no scheduler work needed. min_reuse_days:60 is unaffected (governs same-slug reuse, not distinct-post volume) — worth watching content supply after the bump, per this card's own CONTENT-SUPPLY CHECK.
  - X → immediate step: posts_per_week 5 → 7 (slot_days already all 7 days) — the max the current 1-post/PT-day architecture supports. Muxin's actual ask (multiple posts/day) needs the multi-slot-per-day scheduler work called out in this card's ARCHITECTURE CONSTRAINT; that's a separate, bigger follow-up, not bundled into this config bump.
  - Bluesky → no change. Already at the architecture's daily ceiling (7/wk, all days); Muxin has no strong opinion and the research doesn't push for more.
  - Substack → confirmed NOT automated today (no posting path exists in the pipeline; card 8026f53c scopes Notes-only browser-agent posting and is currently deferred/deprioritized). Muxin flagged renewed interest 2026-07-07 with a target cap of 1 post/day max if/when built — recorded on 8026f53c, still deferred for now (see that card). Muxin's own essays stay fully manual either way.
- STATUS: Done
- DECISION: approved (Muxin, 2026-07-07) — LinkedIn: posts_per_week 5, slot_days Mon-Fri (config-only change). X: posts_per_week 5->7 (multi-slot/day scheduler work for Muxin's full ask deferred as separate follow-up). Bluesky: no change (already at daily ceiling). Substack: confirmed not automated (see 8026f53c, still deferred).
- GROOMED: ready — Muxin resolved concrete numbers (LinkedIn 5/wk Mon-Fri, X 5->7/wk, Bluesky unchanged), pure config/platforms.yaml change, multi-slot-per-day scheduler work explicitly deferred as separate follow-up
<!-- card-id: ffa6491d-46f9-416f-b521-1fb15e1a391b -->

**Routing drift flag: surface data-vs-brand platform divergence in /strategy (never auto-gate)**
- Resolves the routing-authority question (Muxin, 2026-07-04): today `config/routing.yaml`'s per-pillar platform `defaults` only govern cold-start (<4wks/<3 posts); once real data accrues, `route.ts` lets the fit score hard-override them — a pillar can get SKIPPED on a platform Muxin considers its brand home if it underperforms there. DECISION: routing.yaml's defaults become the PINNED editorial call instead — Muxin's own definition of which topics belong on which platform, never hard-overridden by score.
- Change `route.ts`'s `decideForPillar`: decision always follows `routing.yaml` defaults (like cold-start logic today), regardless of data volume. The fit score is still computed and shown, but stops driving include/skip.
- Add a flag step (fits `/strategy` or `route.ts --all`, same cadence as the angle refresh below) that compares each pillar's live fit score against its assigned platform(s) and surfaces a loud divergence warning when a pillar persistently scores under `skip_below_score` on its assigned platform, or unusually high on a non-assigned one. Muxin decides by hand whether to edit routing.yaml; the step makes zero writes to it.
- Mirrors the "surface, never auto-overwrite" posture already agreed for the per-channel angle refresh (8ba83a4c) — same posture, sibling config (routing.yaml topic-fit vs platforms.yaml angle/slant). The two could plausibly share one refresh pass in /strategy; scope that when picked up.
- Touches `validate.ts`'s platform-fit hard gate (00dea0f, shipped 2026-07-04) only in that routing.md's underlying decisions change from score-driven to defaults-driven — the gate itself (hard-fail on `skip`) is unaffected.
- EXPERIMENTAL RIGOR (Muxin, 2026-07-04): the flag must be run as a deliberate experiment, not a single noisy look. Reuses the n≥3 / ≥4wks sample floor already standard across route.ts/grade-bets.ts/snapshot.ts — do NOT invent a new threshold — but that floor alone is thin (one viral or one flop post can flip a 3-post average), and checking 6 pillars × ~7 platforms at once means some cells will look divergent from noise alone (multiple-comparisons problem). Requirements:
  1. PERSISTENCE: only flag a pillar/platform pair when the divergence holds across ≥2 independent snapshots/windows, not one look.
  2. ISOLATE SPIN FROM TOPIC-FIT: spin is always-on (33aa10f8) so there is currently no live baseline to tell "wrong platform for this topic" apart from "angle isn't landing." Systematize the `--no-spin` control runs the retro card (2eb4ea51) already recommended ad hoc — a periodic, deliberate control per pillar/platform pair, not a one-off gut check.
  3. SEPARATE THE TWO HYPOTHESES AT FLAG TIME: when a flag fires, surface (a) the actual n and whether it clears a persistence check, and (b) whether a no-spin control exists for that cell — so Muxin can judge "move the topic" vs. "fix the angle" vs. "not enough data yet" instead of one ambiguous score.
- GOAL_CONDITION: `route.ts --pillar <p>` never returns `skip` for a platform in that pillar's `routing.yaml` defaults solely due to a low fit score; the score is still visible in the decision output. `/strategy` (or `route.ts --all`) emits a divergence flag ONLY for pillar/platform pairs meeting the persistence check above, each flag stating n, window count, and no-spin-control availability; zero writes are made to routing.yaml or platforms.yaml by the flag step itself.
- PRIORITY (Muxin, 2026-07-04): bumped to top priority, first of a small measurement-scaffolding group (with 92bb2ae6 and ffa6491d) — decided in the same conversation as, and independent of, 87cb6d93/8b00ab2e/d8a990a9 (all since shipped separately). Still worth prioritizing: no experiment-design/measurement layer exists yet for routing decisions.
- STATUS: Done
- DECISION: approved — hybrid model chosen (Muxin, 2026-07-04): routing.yaml stays brand-pinned; data flags divergence for manual review, never auto-gates. Experimental-rigor requirements (persistence check, no-spin controls, hypothesis separation) added same day.
- GROOMED: ready — DECISION: approved, explicit GOAL_CONDITION (routing.yaml defaults-driven, persistence-checked divergence flag, zero writes to config)
<!-- card-id: 7e550e48-adcf-44d3-83ea-626ee079b9ef -->

**Use Opus for animating quote cards**
- Let’s compare how Opus vs Sonnet 5 does handling quote card animations
- STATUS: Done
- DECISION: approved (Muxin, 2026-07-07) — both models route through the Claude Code subscription ($0 marginal, CLAUDE.md rule 6), so this is a capped-cost eval, not paid-API spend. Sequence: try Sonnet 5 first; only spend an Opus run if the Sonnet 5 result isn't good enough.
- GROOMED: ready — DECISION: approved, capped-cost model comparison (Sonnet 5 first, Opus only if insufficient), $0 marginal via subscription
<!-- card-id: 05ad98aa-06c4-4c74-9793-79ab9a142a4e -->

**Adopt the codebase-review fix plan (docs/codebase-review.md)**
- ORIGIN: filed 2026-07-07 from a full codebase review (docs/codebase-review.md) that root-caused the P0/P1/P2 complaint cards above (each now carries its diagnosis inline) and audited src/ for maintainability, reliability, and performance.
- This card covers the GENERAL improvements from Part 2/3 of that doc, in its suggested phase order. Phases 1-2 (job observability, GUI actions) close the complaint cards directly; the rest hardens the pipeline:
- Phase 3 — publish integrity BEFORE raising posting caps (ffa6491d): fix the multi-group card double-post window (cards.ts posts group 1, fails group 2, re-run re-posts both — idempotency via publish-log consultation + per-group markers), add a shared fetchWithRetry for transient 429/5xx, clean up orphaned future slot claims in queue --sync.
- Phase 4 — quote cards via Typefully media: attach card PNGs as media: on Typefully drafts; retires PostPeer/Upload-Post for cards (see the browser-automation card's recommendation); PostPeer stays for TikTok only.
- Phase 5 — structure + guardrails: zod-validate config YAML loads and stop bare catch{} from swallowing parse errors (a typo in platforms.yaml currently disables max_chars/CTAs/cadence silently); unify the 3 independent review-queue.md column-index parsers into one typed module; one memoized loader for platforms.yaml (read+cast in 6 files today); split the 1,720-line serve.ts into page/jobs/rows/routes; add tests for slots.claimSlots and cta.ts (zero coverage on the code that decides every send time).
- Each phase is sized in the doc's Part 3 table; split into per-phase cards when picked up rather than working this card whole.
- SPLIT (Muxin, 2026-07-07): split into 8 per-phase cards per the doc's own recommendation, sequenced per Part 3's fix order. This epic card is now just the index; work happens on the child cards below.
  1. Job observability — efae4554-cc52-4aec-ad32-9475d6aa4fdf
  2. GUI actions — 4e7cb5d3-a032-41db-8c49-474a48779261
  3a. Publish idempotency (R1) — a47073b9-85e0-4c44-8afd-ba87724a462e
  3b. Provider retry/backoff + orphaned slot cleanup (R2/R3) — 5f039a7e-c4f0-48d5-930f-c1700c4f57c4
  4. Quote cards via Typefully media — 1829fdf9-4b9e-4cad-9744-cb42e094300d (implements ca75b2e0's recommendation; holds on ca75b2e0's supervised test first)
  5a. Config validation & loaders (R4) — 5b3a258b-202d-4036-8a6f-f797a4def753
  5b. Unify review-queue.md parsing (M2) — 570e8c90-c081-49b8-b77e-dc5c1080bd2b
  5c. Split serve.ts (M1) — c310160b-d296-4219-ab28-4cd50c0a3b40
- ORDER: 1 → 2 (close the complaint cards) → 3a/3b (publish integrity, before ffa6491d raises posting caps) → 4 (overlaps ca75b2e0, gated on its supervised test) → 5a/5b/5c (hardening, can trail behind or interleave once 1-4 are stable).
- STATUS: Done
<!-- card-id: 5ec087d4-fd64-4932-b5cd-4e9edeec5460 -->

**Per-channel positioning: one clear angle per platform ("Swizzle")**
- "Swizzle" = a publish-time lens: before publishing to a platform, write the post from the perspective of "this audience cares about XYZ — how does this content relate to XYZ?" Borrow Muxin's OWN language and ideas, but tailor the POV / point of the post to that specific audience. Distinct from CTA routing — this shapes the argument itself, not just where to send people.
- Goal: make each platform consistently signal "Muxin is X for Y audience" so the algorithm can pin her fast (she believes reach is largely decided in the first ~24h / first ~50 viewers). Today's publishing logic doesn't make the per-channel angle explicit.
- Channel map (starting point): X = tech, LinkedIn = business/career, Substack = society (and her home base), Bluesky = political. Then narrow each to a specific recurring angle.
- STEP: run through Muxin's EXISTING Obsidian content-ideas to DERIVE (and periodically refresh) the X-for-Y angle per channel — the pipeline consults these, it does NOT invent new content streams. Keep riding what she'd write anyway, reframed per channel.
- Encode the channel → audience → angle map and have publishing logic surface/enforce it per platform at publish time; stay consistent over time.
- Substack = home (most "her"); X/LinkedIn/Bluesky are inbound funnels back to Substack. Relates to "Smarter routing" (CTA-by-content-type, 6dcaee98) and the Landing page card.
- EXISTING (don't reinvent): this IS the "Spin" idea — docs/spin-experiment.md + /atomize --spin (reframe/re-angle for the platform, never invent claims). Per-channel audience/angle notes already live in config/platforms.yaml; content pillars in config/pillars.yaml. Scope = promote Spin from an opt-in experiment to an always-on default driven by an explicit X-for-Y angle per channel, fed by the Obsidian content ideas.
- APPROVED ANGLES (Muxin, 2026-06-30; X + LinkedIn sharpened): X = voice of the non-engineer OUTSIDE the SV tech bubble — what these AI tools are actually like for the 96% of non-tech workers, and how the hidden assumptions baked in by that bubble misfire for and harm them (tech audience). LinkedIn = critiques business innovation broadly (NOT just product craft) — how corporate / business norms quietly strangle the creative innovation they claim to want (business/career). Substack = builder-philosopher: the real AI risk isn't the machine, it's the unexamined human systems we're about to automate at full speed (society). Bluesky = the PM who treats democracy as broken UX + AI as making the fairness gap unignorable (political).
- HOME-BRAND THREAD (Muxin, required): the HOME BRAND is the core WORLDVIEW — "the real AI risk isn't the machine, it's the unexamined human systems we're about to automate at full speed; I ship software as the proof." The Substack ANGLE is its fullest expression, but Substack is still a newsletter CHANNEL, not the home. (A separate future Landing page will be the actual home that drives CTAs.) The angle core per channel is right, but every per-channel piece must carry a visible thread back to this home brand; no channel may read as a standalone/disconnected identity — the four are one worldview pointed at different audiences.
- HOME-BRAND LINE EVOLVED (Muxin, 2026-07-01): the home-brand line is now **"I uncover harmful hidden beliefs and why they need to change before AI automates everything."** This IS the worldview and the home brand, in mission voice. The prior line ("the real AI risk isn't the machine, it's the unexamined human systems we're about to automate at full speed; I ship software as the proof") remains the expanded worldview statement behind it and the Substack angle's fullest expression. THREAD CHECK below unchanged — "building the right thing" stays part of the test, so the ship-as-proof half is still enforced per piece. Site docs synced same day (`Branding/Human Inference/` in Obsidian).
- THREAD CHECK (Muxin, 2026-06-30): Muxin won't always remember to include the thread, so the agent must CHECK every piece carries it at review time. Operational test: does the piece connect back to the HOME BRAND worldview (unexamined human systems we're automating / who benefits / building the right thing)? The AI lens is ONE facet of that home brand, not the whole test — do NOT reduce it to "is this about AI." If the thread is missing from a note/essay, Spin DRAFTS it in, then iterate with Muxin until it feels right via the GH editing loop (see the Unified review GUI card). Surface/suggest, never hard-block.
- RESOLVED (Muxin, 2026-07-07): every explicit to-do in this epic's own text now has its own Done card — Spin promoted to always-on default (33aa10f8, Done), home-brand thread check + auto-draft (87cb6d93, Done), angle refresh loop from Obsidian content-ideas (8ba83a4c, Done). The small review-queue.md surfacing follow-up (4c3eb6be) is tracked separately and doesn't block closing the epic. No open scope remains here.
- STATUS: Done
<!-- card-id: d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4 -->

**Periodically refresh the per-channel X-for-Y angles from Muxin's Obsidian content-ideas (surface drift, never auto-overwrite approved angles)**
- Traces to the epic's STEP bullet: "run through Muxin's EXISTING Obsidian content-ideas to DERIVE (and periodically refresh) the X-for-Y angle per channel — the pipeline consults these, it does NOT invent new content streams." The one-time derivation is Done (33aa10f8 encoded the four 2026-06-30 approved angles verbatim into config/platforms.yaml); what's still unbuilt is the refresh loop that keeps those angles honest to what Muxin is actually writing.
- Add an on-demand refresh step (fits the existing /strategy or /cycle pass — "periodically" = each strategy run, not a newly-invented timer) that reads the current Obsidian content-ideas plus config/pillars.yaml and re-derives a candidate X-for-Y angle per channel (X / LinkedIn / Substack / Bluesky).
- Compare each freshly-derived candidate against the encoded approved angle in config/platforms.yaml (spin_angles) and surface only the divergences for Muxin — matching the epic's stated posture that angles change only on Muxin's explicit approval (the four angles were APPROVED 2026-06-30) and that the pipeline never invents new content streams, only reframes what she'd already write.
- Surface/suggest only: the step makes zero writes to config/platforms.yaml; an angle changes solely when Muxin approves the suggested refinement. Mirrors the "surface, never hard-block" posture used for the home-brand thread check (87cb6d93).
- Out of scope: rewording the four approved angle statements themselves, and the home-brand THREAD CHECK (already filed as 87cb6d93).
- GOAL_CONDITION: Running the refresh step reads the current Obsidian content-ideas plus config/pillars.yaml and emits a per-channel report (X, LinkedIn, Substack, Bluesky) comparing a freshly-derived candidate angle against the encoded approved angle in config/platforms.yaml. Before: angle drift can only be caught by Muxin manually re-reading. After: any divergence is flagged for Muxin's re-approval and the step makes zero writes to config/platforms.yaml (the four approved angles change only on Muxin's explicit approval).
- PARENT: d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4
- ORIGIN: proposed by propose-cards 2026-07-04 from epic Per-channel positioning: one clear angle per platform ("Swizzle") (d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4)
- STATUS: Done
- GROOMED: ready — clear scope (surface-only drift report, zero writes to platforms.yaml), stateable GOAL_CONDITION, no dependency overlaps + 2026-07-04
<!-- card-id: 8ba83a4c-0903-4103-93cf-a7abea7ea99c -->

**Live Typefully/PostPeer schedule reconciliation in the review GUI**
- Wire item (3) of the review GUI's STILL TO WIRE list: the dashboard reflects what is actually scheduled at the providers, not just what Muxin approved.
- Pull actual scheduled state from Typefully (text drafts) and PostPeer (TikTok/cards) and reconcile it against the GUI's approved rows.
- For a row approved and scheduled at a provider, display the provider's real scheduled time/status; for a row approved but not found at the provider, flag an unscheduled/mismatch indicator.
- Read-only reconciliation: it reflects provider state, it does not push or change schedules.
- GOAL_CONDITION: With one known scheduled Typefully/PostPeer draft and one approved-but-unscheduled row: before, the GUI shows only approved/not-approved. After, the scheduled row displays the provider's actual scheduled time and the unscheduled row is flagged as a mismatch.
- PARENT: a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9
- ORIGIN: proposed by propose-cards 2026-07-04 from epic Unified review + approval GUI (one page for everything awaiting Muxin) (a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9)
- STATUS: Done
- GROOMED: ready — read-only reconciliation scope, explicit GOAL_CONDITION + 2026-07-04
<!-- card-id: 383756f4-aae7-48c7-88a0-2b06b4a867dc -->

**Origin source-tags on every review GUI row (from /cycle / reply to mention / from GUL queue)**
- Wire item (2) of the review GUI's STILL TO WIRE list: every row awaiting Muxin carries an origin source-tag identifying which pipeline produced it — one of "from /cycle", "reply to mention", or "from GUI queue".
- Set the origin at the point content enters the queue (whichever pipeline created the row) and persist it on the row so the GUI can render it without recomputing.
- Render the origin as a visible badge/column on each awaiting-Muxin row.
- Scope: data plumbing + display only. Does not change approve/reject behavior or scheduling.
- GOAL_CONDITION: Load the review GUI with rows sourced from all three origins. Before: rows show no origin. After: every awaiting-Muxin row renders exactly one origin tag from {from /cycle, reply to mention, from GUI queue}, matching the pipeline that created it.
- PARENT: a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9
- ORIGIN: proposed by propose-cards 2026-07-04 from epic Unified review + approval GUI (one page for everything awaiting Muxin) (a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9)
- STATUS: Done
- GROOMED: ready — scoped to data plumbing + display, explicit GOAL_CONDITION + 2026-07-04
<!-- card-id: edec9293-7b72-494e-99ce-3c2895637a94 -->

**Wire cards/TikTok/video auto-schedule into GUI Approve**
- Card a4a2ce27 (Unified review + approval GUI) flagged this as the explicit next-priority follow-up (2026-07-04): text rows already auto-schedule to Typefully on Approve via publishText (src/review/serve.ts /api/status handler, SCHEDULABLE set currently only x/linkedin/bluesky), but card/tiktok/video rows fall through to a plain approve status update and still require a separate manual /publish run.
- Extend the same Approve handler so card rows call the existing src/publish/cards.ts scheduling path, tiktok rows call src/publish/tiktok.ts scheduleToTikTok, and video rows call src/publish/youtube.ts's scheduled-upload path -- mirroring the try/catch + scheduleError pattern already used for text so a failure leaves the row at approve with a visible reason instead of silently losing it.
- Per the epic's own note: this triggers real sends (PostPeer/Upload-Post/YouTube), so treat it under the content-agents generation-hold standing directive if the change touches what gets sent, not just scheduling plumbing.
- Out of scope (separate, not yet filed): origin source-tags and live Typefully/PostPeer schedule reconciliation in the dashboard -- both listed in the same epic as separate still-to-wire items.
- GOAL_CONDITION: Approving a card, tiktok, or video row in the review GUI results in the same content folder's row being scheduled via its platform's existing publish function (cards.ts / tiktok.ts / youtube.ts) with no separate /publish invocation required -- verified by an Approve action producing a scheduled draft/post (or a visible scheduleError on the row) for at least one row of each of the three row types.
- PARENT: a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9
- ORIGIN: proposed by propose-cards 2026-07-04 from epic Unified review + approval GUI (one page for everything awaiting Muxin) (a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9)
- STATUS: Done
- DECISION: approved — build approach confirmed (each platform schedules through its own existing path: cards.ts/tiktok.ts/youtube.ts, not the text scheduler). Sequence AFTER 87cb6d93 and 8b00ab2e — those are the priority for right now. 2026-07-04
- GROOMED: ready — exact files/behavior specified, explicit GOAL_CONDITION + 2026-07-04
<!-- card-id: d8a990a9-ffcd-46b6-849f-fcebf62e0ab6 -->

**Guard the review GUI: don't allow Approve on a storyboard/video row with no rendered file**
- The review GUI (`src/review/serve.ts`) writes `approve` straight into review-queue.md on any row's Approve click. A `video-script` / `storyboard`-type row can be approved even when its storyboard/video file doesn't exist yet (asset cell is `—`), producing a phantom approval that means nothing to `/publish` and reads as an unauthorized edit.
- Observed 2026-07-04 (during repo sync): the innovation-nation `video-script` row was found flipped `blocked → approve` in the working tree with no storyboard file present — an uncommitted, unauthorized-looking edit traced back to a GUI Approve click on a not-yet-rendered row.
- Fix: in `serve.ts`, guard the Approve action for storyboard/video rows whose asset file is missing (cell `—` / not on disk) — disable the button or reject the write, and surface why ("storyboard not rendered yet — run /video"). Text / image / quote-card rows unaffected. Small, local to `src/review/serve.ts`; no schema change.
- ORIGIN: filed 2026-07-04 from the phantom-approve found during repo sync.
- STATUS: Done
- GROOMED: ready — small, well-scoped guard fix, local to src/review/serve.ts, no schema change, clear repro + fix approach + 2026-07-04
<!-- card-id: 4bef9a7c-9148-4c59-afcf-04475ea11ff5 -->

**Strong storytelling for social posts (hooks, narrative, practical angle) — eval current + design approach**
- Social posts need HOOKS, NARRATIVE, and PRACTICAL ANGLES — strong storytelling is a must (Muxin). The current workflow is basic on this.
- EVAL FIRST: build a storytelling rubric (hook strength / narrative arc / practical takeaway / overall storytelling) and TEST current output against it — score a sample of real content/<slug>/derivatives/, find where extraction-first posts fall flat on hook + narrative. THEN design the approach.
- KEY TENSION to resolve: extraction-first (CLAUDE.md rule 1 — never compose new claims) vs strong storytelling (hooks/narratives usually need crafted connective tissue + a real hook). Spin already carves the middle path — "re-angle, re-order, change the framing and the HOOK to fit the audience, but never introduce a new claim/argument/worldview" (docs/spin-experiment.md). So storytelling likely = lean into Spin's latitude + a storytelling rubric/score, NOT a new claim-composing mode. Decide how much latitude is allowed.
- OVERLAPS Spin / Swizzle (d23bfc5d): coordinate so storytelling is PART of the Spin engine (make the post engaging), not a separate pass. Add a STORYTELLING / HOOK dimension to /atomize's scoring (today: native/brand/cta) so weak hooks get caught pre-queue.
- Deliverable: (1) storytelling rubric, (2) eval of current output with gaps, (3) recommended approach — how Spin optimizes hook + narrative + practical-angle within the no-new-claims guardrail + the new score dimension.
- EVAL DONE (2026-06-30): rubric = hook / narrative / practical-angle / overall. Tested 10 real derivatives. FINDING: brand/native score 4-5 but storytelling clusters at 2-3 — the pipeline rewards the wrong thing; the 2 posts that DO tell a story (Trillionaire, Congress) score well only by accident (their SOURCE already had a hook/action). Spin's re-hook/re-order latitude is BUILT but UNUSED (no `spin: true` derivative in the sample) — so much of the gap is just "Spin isn't on." Ties directly to the Swizzle card (promote Spin to always-on).
- APPROACH — ship now (pure upside, no guardrail change): (A) add a `storytelling` score to /atomize (today: native/brand/cta). DIMENSIONS = HOOK + NARRATIVE + RESONANCE (does it state a truth people are feeling / give them something to react to — NOT "does it ask for engagement", which is false). PRACTICAL ANGLE + CTA are CONDITIONAL, never scored requirements — present only when Muxin genuinely has something useful or a CTA truly fits; never penalize a society/economy post for lacking them. Soft-gate the queue on hook/narrative/resonance (low → flag for a Spin pass; Muxin's approve stays final). (B) apply Spin's existing latitude on X + LinkedIn — re-hook (lead with the strongest existing line, drop "What I described in my essay…"), re-order for arc, and STOP trimming the concrete personal specifics that ARE the story (e.g. the cut ADHD / "14 projects" details). Leave Bluesky/Notes near-verbatim.
- DECISION (Muxin, 2026-06-30): engagement = RESONANCE, not conversion. NEVER ask for engagement (false/inauthentic) — her best Substack notes don't; they state a felt truth and THAT is what people react to, and she wants to stay that way. So practical-angle is NOT always required for society/economy posts — only when she actually has something useful to share (and that comes from HER source, so extraction-first stays intact). CTA = selective, ONLY where it genuinely makes sense; never the default, never turn every post into a conversion (cringey). REJECTED: blanket-CTA (was option ii-as-default) and relaxing extraction-first to manufacture takeaways (option iii). Each post should be a conversation / something to react to.
- Key files: /atomize SKILL.md scoring (~lines 129-133), docs/spin-experiment.md (guardrail #1), config/voice.yaml.
- STATUS: Done
- DECISION: approved — PRIORITY 2 (Muxin, 2026-07-04): work this second, right after 87cb6d93. Shapes how generated content is scored/hooked, so it holds for PR review per the content-generation standing directive.
- GROOMED: ready — eval already done (2026-06-30), approach decided (storytelling score dimension + selective Spin latitude), exact files named + 2026-07-04
<!-- card-id: 8b00ab2e-31e4-4fe0-a1da-4d5ce9616ae1 -->

**Home-brand-thread check at review time, with Spin auto-drafting the thread in when missing**
- Per the card's THREAD CHECK: every published piece must carry a visible thread back to the home-brand worldview — "I uncover harmful hidden beliefs and why they need to change before AI automates everything" (and the fuller unexamined-human-systems / who-benefits / building-the-right-thing statement behind it).
- Operational test is NOT "is this about AI" — it's whether the piece connects back to that worldview; add this as an explicit check run before a piece reaches Muxin's review queue.
- If the thread is missing, Spin drafts it in, then the piece routes through the existing GH editing loop (see Unified review + approval GUI card) for Muxin to iterate until it feels right.
- Surface/suggest only — never hard-block a piece from publishing over a missing thread.
- GOAL_CONDITION: Each piece reaching Muxin's review queue carries a thread-check result (pass/missing) against the home-brand worldview line; any piece flagged missing already has a Spin-drafted thread inserted before Muxin sees it, and no piece is blocked from publishing solely due to a missing/failing check.
- ORIGIN: proposed by propose-cards 2026-07-02 from epic Per-channel positioning: one clear angle per platform ("Swizzle") (d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4)
- STATUS: Done
- DECISION: approved — PRIORITY 1 (Muxin, 2026-07-04): work this first. Touches generated content (Spin auto-draft), so it holds for PR review per the content-generation standing directive regardless of this approval-to-build.
- GROOMED: ready — explicit GOAL_CONDITION, DECISION: approved PRIORITY 1 + 2026-07-04
<!-- card-id: 87cb6d93-5e6f-405f-9188-99c9d96434e2 -->

**Smoke-test the notes-daily job on its first real run**
- SUPERSEDED premise (Muxin, 2026-07-04): the original test — "confirm drafts land UNSCHEDULED, not Scheduled" — no longer applies at all. notes-daily drafts NOTHING now: it only fetches new Substack Notes and marks them seen in the ledger. Real per-platform drafting (Spin's per-channel reframing) needs genuine Claude judgment, which only runs locally (the review GUI's "Pull Substack Notes" button, `claude -p "/atomize notes"`, $0 on the subscription).
- CORRECTION (2026-07-04, same day): the GitHub Actions replacement noted below never actually worked — Substack's WAF 403s every request from GitHub's runner IPs regardless of headers (see 1eda54e7). "Works regardless of whether Muxin's Mac is on" was wrong; that benefit was never real. `.github/workflows/notes-daily.yml` is deleted. Final design is local-only: `config/launchd/com.content-agents.notes-daily.plist` (daily 07:00 local) + `docs/setup-notes-daily-launchd.md`, same posture as the weekly-pull job (b2e1c9b6) — Mac must be on.
- NEW test (supersedes the cloud-PR test above): after Muxin runs the launchd enable steps, confirm (a) `launchctl start com.content-agents.notes-daily` runs clean (check `~/.content-agents/logs/notes-daily.log`), (b) new notes get appended to data/notes-spread-ledger.jsonl and aren't re-flagged on a second run, and (c) running "Pull Substack Notes" in the review GUI still drafts fresh (it doesn't consult this ledger, so nothing here blocks it).
- STATUS: Done
- GROOMED: ready — local job shipped in code; PARKED pending Muxin's one-time launchd enable (persistent system config, deliberately not auto-installed) + 2026-07-04
<!-- card-id: 2972c204-ca9e-4799-ae8f-b8fc71bddcde -->

**Substack blocks GitHub Actions runner IPs on notes-daily fetch — decide: paid proxy or drop cloud fetch**
- ORIGIN: follow-up auto-filed from card 2972c204 (Smoke-test the notes-daily cloud routine), 2026-07-04.
- The smoke test found the notes-daily GitHub Actions cron's Substack fetch (src/atomize/fetch-notes.ts) gets a 403 from Substack's WAF, and it is NOT a header/User-Agent issue: PR #77 added a browser UA, and a follow-up commit added a full realistic browser header set (accept, accept-language, referer, origin, sec-fetch-*, sec-ch-ua*) -- both produced the IDENTICAL 403, same step, same latency, no change at all. That signature points to IP-reputation blocking of GitHub Actions runner IPs by Substack's WAF, which no client-side request change can fix.
- Two real options, both with tradeoffs -- this is Muxin's call, not something to silently implement: (1) route this one fetch through a paid residential/rotating-proxy or scraping-API service -- adds real recurring cost + a new vendor dependency; or (2) drop the cloud-fetch step from notes-daily.yml and keep Substack Notes fetching local-only (same posture the drafting step already has) -- costs nothing, needs no new code, but loses the 'runs even if my Mac is off' benefit that was the whole point of the GitHub Actions move (PR #75).
- CHAIN: 1
- GOAL_CONDITION: Muxin has chosen option (1) or (2) above; if (1), a proxy/scraping-API is wired into fetch-notes.ts's two calls and a real GH Actions run succeeds past the profile-fetch step; if (2), notes-daily.yml's fetch step is removed/disabled and the workflow's remaining scope (ledger-only, or retired entirely) reflects that decision.
- DECISION (Muxin, 2026-07-04): option (2) — "mac must be on job is acceptable." Dropped the cloud fetch entirely rather than pay for a proxy vendor. `.github/workflows/notes-daily.yml` deleted outright (no residual scope — the fetch fails from that IP range regardless of trigger, so even workflow_dispatch-only had no value). Replaced with a local launchd job, same pattern as the weekly-pull card (b2e1c9b6): `config/launchd/com.content-agents.notes-daily.plist` + `docs/setup-notes-daily-launchd.md`.
- STATUS: Done
<!-- card-id: 1eda54e7-8e11-4e91-ab2d-f3c762542d88 -->

**Create the claude.ai Routine for notes-daily (manual UI step)**
- - ORIGIN: follow-up auto-filed by the conductor from card 2972c204 (Smoke-test the notes-daily cloud routine), 2026-07-02.
- The notes-daily code shipped in PR #52, but docs/setup-cloud-routine.md Step 3 (create the Routine in claude.ai -> Routines UI, daily 14:00 UTC) appears never done: the committed dedup ledger has zero entries and no routine commits exist on any branch 5-6 days after merge.
- SUPERSEDED #1 (Muxin, 2026-07-04): Muxin couldn't find the claude.ai Routines UI, and what he actually needs is "runs even if my Mac is off" — a genuine cloud job, not tied to any Claude session. Replaced with `.github/workflows/notes-daily.yml` (GitHub Actions, on his GitHub Pro plan).
- SUPERSEDED #2 (Muxin, 2026-07-04, same day): the GitHub Actions job never actually worked — Substack's WAF returns a flat 403 to every request from GitHub's runner IPs, confirmed on two live runs, unfixed by a browser User-Agent or a full realistic header set (see 1eda54e7). Muxin's call: "mac must be on job is acceptable" — dropped the cloud-fetch idea entirely. `.github/workflows/notes-daily.yml` is deleted; replaced with a local `launchd` job (`config/launchd/com.content-agents.notes-daily.plist`, daily 07:00 local), same pattern as the weekly-pull job (b2e1c9b6). Setup: `docs/setup-notes-daily-launchd.md`.
- DONE (2026-07-04): local launchd plist + setup doc shipped. PENDING Muxin: run the 3-command enable in docs/setup-notes-daily-launchd.md (persistent system config — deliberately not auto-installed).
- STATUS: Done
<!-- card-id: bd499018-a6fa-46a2-a419-cd5ed01139fd -->

**Unified review + approval GUI (one page for everything awaiting Muxin)**
- Replace opening multiple windows + hand-editing review-queue.md. One web page shows everything pending review in one place.
- Each item is source-tagged ("from /cycle", "reply to <comment/mention>", etc.), inline-editable, with one Approve action that then schedules/sends it on the right platform at the right cadence.
- Covers /cycle output now; designed to also hold inbound voice-replies (see Inbound card) once those exist.
- Overlaps with "Voice Notes to Published" (664189d9) — RESOLVED (Muxin, 2026-06-30): THIS card is the single review/approval surface; 664189d9 re-scoped to the upstream voice-note→/atomize→schedule orchestration that feeds this GUI.
- EDITING MODEL (Muxin, 2026-06-30; DECIDED): keep the editing room SEPARATE from the GUI — reuse the /story GitHub-PR comment loop (Muxin comments on the exact line the agent wrote; agent makes SURGICAL edits to only that passage, no rehashing the location in chat). The GUI = the one-page dashboard (see everything pending, source-tagged, approve at a glance); items needing iteration live as GitHub PRs. CONVENIENCE (required): for each such item the GUI surfaces a DIRECT DEEP-LINK to the exact GitHub page she needs — the PR, ideally the specific file/line/comment thread — so one click from the dashboard lands her on the right spot, no hunting. Then approve/merge → publish.
- BUILT v1 (2026-07-03): `npm run review` → local page (src/review/serve.ts, zero new deps, Node http) aggregating all 21 content/*/review-queue.md. Previews post text / quote-card image / video storyboard inline; surfaces spin + angle + source_lines; Approve / Revise(+note) / Discard write status back through the SAME cell /publish reads (verified byte-clean round-trip — only the status cell changes). Mobile-responsive. Reviewed live with Muxin.
- DECISIONS (Muxin, 2026-07-03): (1) EDITING MODEL — KEEP inline edit-in-place (supersedes the earlier GitHub-PR-deeplink plan for now; Build-1 derivatives aren't in PRs yet — revisit if they move there). (2) APPROVE BEHAVIOR — Approve → AUTO-SCHEDULE, and it's BUILT for text rows: approving an x/linkedin/bluesky row now calls `publishText(folder, {onlyIds:[id]})` → a real Typefully SCHEDULED draft at the cadence slot → row flips to published; button reads "Approve → schedule"; schedule failures surface in the GUI instead of throwing. Done via a pure refactor of typefully.ts (new exported `publishText`; CLI + notes-daily paths unchanged; 48/48 tests green). Muxin takes the FIRST live Approve→schedule click (outward-facing) to watch it land.
- SHIPPED SINCE (2026-07-03/04): PR #67 added an "Add / Queue" tab — Muxin can drop a source (pasted text, Obsidian/file path, or Substack URL) or hit "Pull Substack Notes" straight from the GUI; a single-worker job queue runs the real `/atomize` headlessly (`claude -p`, subscription, $0), one at a time, and auto-refreshes the Review tab when a job finishes. This is the GUI's "creating our own content" half — feed the pipeline without leaving the page. PR #68 fixed the video-script row to show the drafted script (`video/script-draft.md`) before the storyboard exists.
- STILL TO WIRE (follow-ups, this is the "publishing" half that's still manual): (1) cards / tiktok / video auto-schedule from Approve — still requires a separate `/publish` run, unlike text rows which already auto-schedule to Typefully on Approve; (2) origin source-tags ("from /cycle" / "reply to mention" / "from GUI queue"); (3) live Typefully/PostPeer schedule reconciliation in the dashboard (so the GUI reflects what's actually scheduled, not just what was approved).
- RESOLVED (2026-07-05): all three STILL-TO-WIRE items above have since shipped as their own Done cards — (1) cards/tiktok/video auto-schedule from Approve → `d8a990a9`, (2) origin source-tags → `edec9293`, (3) live Typefully/PostPeer reconciliation → `383756f4`. The GUI's Approve action now covers publishing for every row type, not just text.
- PRIORITY (Muxin, 2026-07-04): next GUI work — wire (1) above (cards/tiktok/video auto-schedule from Approve) so the GUI's Approve action fully covers publishing, not just text. Note: this is a content-agents content-generation-adjacent surface (it triggers /publish, which sends real drafts) — treat per the content-agents generation-hold standing directive if the change touches what gets generated/sent, not just scheduling plumbing. SUPERSEDED — see RESOLVED note above.
- STATUS: Done
- DEPENDS ON: Per-channel positioning: one clear angle per platform ("Swizzle")
<!-- card-id: a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9 -->

**Contextual per-platform card captions (a quote never ships out of context)**
- Problem (Muxin, 2026-07-03): a quote card posted alone was the quote as an image + the same quote repeated as the caption — no anchor, easy to misread / dunk on out of context.
- Built: a card is now a bare-quote IMAGE + a spun, CONTEXT-ONLY caption per platform. Rows become `quote-card:<target>` (x/linkedin/bluesky), each sharing `images/quote-card-N.png` with its own `derivatives/quote-card-N-<target>.md` caption (context drawn from the lines AROUND the quote, never the quote itself; spun through the channel angle; extraction-first, source_lines best-effort). The quote / image / animation are unchanged. The `quote-card-N.md` definition derivative keeps the verbatim quote for rendering.
- ANALYTICS (Muxin's constraint — testing per-platform performance): each platform's card now has a DISTINCT caption = a distinct match key, and cards.ts records the placement under the REAL destination platform with the caption as the key (was the quote) + `fm.spin` → the `| spin` marker. So `tag-source` attributes each card post per platform and classifies it atomized-spin; `origin-compare` measures per-channel card performance. Strictly better than the old shared-quote model.
- Code: `src/publish/cards.ts` (per-platform posting + caption + bet wiring), +4 tests (52 green). `validate.ts` + `render.ts` UNCHANGED (caption declares `platform:<target>` so it validates as a normal spun text post; render still reads the definition derivative's quote). Skill updated: SKILL.md steps 4/4.5/7/8 + references/spin-mode.md.
- STILL TO WIRE (follow-ups): (1) ANIMATED cards — the `.mp4` companion reuses the same per-platform context caption, but /atomize doesn't yet auto-generate the per-platform animated PUBLISH rows (native video via Typefully, `media:` the mp4); small follow-up. (2) card rows don't auto-schedule on GUI Approve yet (still `publish:cards`) — same follow-up as the Unified review GUI card. (3) Notes cards keep the legacy single-caption fan-out (a note is self-contained; no surrounding context to extract).
- STATUS: Done
<!-- card-id: a3127104-aa8a-4e4e-a4fe-fe7db245d8d5 -->

**Recurring weekly analytics pull (scheduler — "don't ask me")**
- Follow-up to 0026b615: the pull capability shipped, but nothing ran it on a schedule — on-demand only. A post gains traction over time, so stats need refreshing on a cadence without Muxin asking.
- Must run LOCALLY: the saved browser session lives on Muxin's Mac (`~/.content-agents/browser-profiles/`); a claude.ai cloud routine has no session and would hit a login wall. So it's a macOS launchd job, not a cloud routine.
- BUILT (2026-07-03): `npm run pull:weekly` (src/cron/weekly-pull.ts) chains `pull -- --ingest` (LinkedIn/X/Substack) + `bluesky` with per-step failure isolation and a loud "session lapsed → pull:login" summary. Ready-to-load LaunchAgent at config/launchd/com.content-agents.weekly-pull.plist (Sunday 07:00 local, before /strategy); 3-command enable in docs/setup-weekly-pull.md. PENDING: Muxin runs the enable (persistent system config — deliberately not auto-installed).
- CONFIRMED SAFE for weekly re-pull: ingest upserts posts on (platform, platform_post_id) + APPENDS a timestamped metrics snapshot; snapshot.ts/resonance.ts read MAX(captured_at) per post and recency-weight by posted_at → traction refreshes, history kept, no double-count, old posts don't look artificially fresh.
- STATUS: Done
<!-- card-id: b2e1c9b6-fe3b-4f2c-8629-f5b5442c783f -->

**Wire Substack aggregate reach/growth (summary-v2) into the audience table**
- Follow-up to the analytics-pull work (card 0026b615, PR #56). The per-post Substack pull is live, but the aggregate reach/growth endpoint isn't ingested yet.
- Source: `GET /api/v1/publish-dashboard/summary-v2?range=365` on the writer dashboard (subscribers, total views, growth). Verified live this session: subs 4→38, views 89→504.
- Wire it into the `audience` table (like LinkedIn demographics) so `npm run audience` and the strategy brief see real Substack subscriber totals + growth, not just the DB's undercounted per-post rows.
- Small: the endpoint + auth path are already proven in src/pull/platforms/substack.ts; this adds an aggregate fetch + an audience-row writer.
- DONE (2026-07-04): shipped as PR #71 (merged) — summary-v2 wired end-to-end, verified against Muxin's live account (ingest + audience showed substack | 38 | +34, matching the real 4→38 growth).
- STATUS: Done
<!-- card-id: 0f604c03-5e6c-467e-9bc2-6be45395dd42 -->

**Retire stale spin-experiment prose in /strategy skill**
- .claude/skills/strategy/SKILL.md still tells /strategy to surface 'SPIN BASELINE READY / time to run /atomize --spin' when origin-compare says the verbatim baseline is ready. Spin is now the default, so that call-to-action is obsolete; reword to report verbatim-vs-spin-vs-organic and suggest --no-spin control runs instead.
- Discovered while building card 33aa10f8 (Promote Spin to always-on default).
- CHAIN: 1
- DONE (2026-07-04): shipped as PR #70 (merged) — origin-compare.ts and the /strategy skill now report verbatim-vs-spin-vs-organic and nudge occasional --no-spin control runs instead of the old spin-readiness language.
- STATUS: Done
- DEPENDS ON: Promote Spin from opt-in experiment to always-on default, driven by the approved per-channel angles
<!-- card-id: 2eb4ea51-3845-4d99-9501-2dbd9ac4548a -->

**Automate the analytics download for /cycle (constrained browser agent)**
- The only manual blocker to an unattended weekly /cycle is hand-downloading the analytics export files before `npm run ingest`.
- Build a constrained browser agent (Hermes-style) that does ONE narrow job: log into the analytics source(s), follow a fixed path, and download the export files in the exact order/format the ingest step expects — nothing else.
- This is the first concrete use of a general capability: a browser agent for sites with no usable API. The same pattern later serves Substack (no API) for publishing + listening.
- Success: /cycle runs start-to-finish (ingest → strategy → atomize → review queue) without Muxin fetching any files.
- DONE (2026-07-03): shipped as PR #55 (LinkedIn) + PR #56 (X + Substack). All three platforms auto-pull real per-post analytics via `npm run pull -- <platform>` (saved-session Playwright agent, no stored passwords, src/pull/). X pulls the Analytics > Content "Download CSV"; Substack pulls the writer dashboard JSON API (real per-post views), NOT the email-only data export. Self-triaging with diagnostics bundles.
- STATUS: Done
<!-- card-id: 0026b615-cc84-483a-8812-496eaf87aa00 -->

**Promote Spin from opt-in experiment to always-on default, driven by the approved per-channel angles**
- Spin (docs/spin-experiment.md, /atomize --spin) already does platform reframing but is opt-in; per the goal card's stated scope, promote it to an always-on default for every publish — no --spin flag needed.
- Encode the four APPROVED angles (Muxin, 2026-06-30) into config/platforms.yaml: X = voice of the non-engineer outside the SV tech bubble; LinkedIn = critiques business innovation broadly (how corporate norms strangle creative innovation); Substack = builder-philosopher (real AI risk is unexamined human systems, not the machine); Bluesky = the PM who treats democracy as broken UX + AI as making the fairness gap unignorable.
- Publishing logic reads this channel→audience→angle map and enforces/surfaces it per platform at publish time, per the card.
- Never invents new content streams — reframes what Muxin would already write, per her existing Obsidian content-ideas and config/pillars.yaml.
- GOAL_CONDITION: Running /atomize with no --spin flag applies platform-specific angle reframing to all four channels (X, LinkedIn, Substack, Bluesky) by default; config/platforms.yaml contains the four 2026-06-30 approved angle statements verbatim.
- ORIGIN: proposed by propose-cards 2026-07-02 from epic Per-channel positioning: one clear angle per platform ("Swizzle") (d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4)
- DONE (2026-07-03): shipped as PR #54 (main 417d273). Spin is now the always-on default for every /atomize run; the four approved angles are encoded in config/platforms.yaml spin_angles; --no-spin is the opt-out; validate.ts enforces angle↔platform match. Reviewed live with Muxin (X/LinkedIn/Bluesky samples on "Building an Innovation Nation") before merge; review-queue approval gate unchanged.
- STATUS: Done
- GROOMED: 2026-07-02 pre-flight groom: decomposes the Swizzle epic's own stated scope (promote Spin to always-on default); four angles approved by Muxin 2026-06-30 verbatim in epic; verifiable GOAL_CONDITION present
<!-- card-id: 33aa10f8-9b90-4e0c-8e4a-515432851926 -->

**Let fresh worktrees run the test suite (node_modules)**
- - Tests cannot run inside a freshly created worktree (no node_modules); the audit ran them from the main checkout instead.
- Decide whether worktree creation should run npm install (or share/symlink a node_modules) so delegated workers can run the test suite in-place.
- Open question: isolated install per worktree vs a shared store. Found during the "Confirm we have publishing logic" audit.
- STATUS: Done
- GROOMED: 2026-07-02 conductor re-groom: clear outcome (fresh worktrees can run node:test in place), local dev infra only, no approval-worthy class; open install-strategy question is a technical call
<!-- card-id: cb630070-406e-41d6-9cb2-bc00f5655f80 -->

**Set up a Claude Code cron to automatically pull my substack notes every day and publish them across other channels**
- STATUS: Done
- DECISION: approved — cloud routine. CODE COMPLETE + MERGED in PR #52 (main 74eaa3a): src/cron/notes-daily.ts + committed dedup ledger data/notes-spread-ledger.jsonl + typefully --no-schedule UNSCHEDULED-draft mode; 27/27 tests, typecheck clean; nothing auto-posts. PARKED awaiting Muxin: do the ~5-min claude.ai setup in docs/setup-cloud-routine.md (connect repo; add secrets SUBSTACK_HANDLE + TYPEFULLY_API_KEY; create daily routine running npm run notes-daily then commit/push ledger). SMOKE-TEST the first real run: confirm drafts land in Typefully DRAFTS (unscheduled), not Scheduled (follow-up card 2972c204). Worktree wt-cron-notes-cloud kept until this is Done. Mark Done once routine is live + first run verified.
<!-- card-id: f26bf827-2833-43ec-b5dc-3c62da0ab3e5 -->
