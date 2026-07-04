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

**Smoke-test the notes-daily cloud routine on its first real run**
- - After the cloud routine is set up, confirm the FIRST real run creates Typefully drafts that land in Drafts (UNSCHEDULED), not the Scheduled queue.
- The 'omit publish_at = unscheduled' contract was verified against the codebase's own logic (fetchScheduledDrafts filter), not a live Typefully API call.
- If drafts appear Scheduled, adjust the --no-schedule payload in src/publish/typefully.ts before relying on the routine.
- STATUS: To Do
- GROOMED: 2026-07-02 conductor re-groom: read-only verification probe of notes-daily drafts (unscheduled contract), unblocked by PR #52; fix path is an ordinary code change
- PARKED: parked (unattended) 2026-07-02: inconclusive, routine has never fired. Ledger data/notes-spread-ledger.jsonl is 0 lines, no routine commits on any branch since PR #52 merged 2026-06-27 vs a daily 14:00 UTC schedule. Blocked on Muxin creating the claude.ai Routine (docs/setup-cloud-routine.md Step 3). Re-run once the ledger shows a first real-run entry.
<!-- card-id: 2972c204-ca9e-4799-ae8f-b8fc71bddcde -->

**Add LinkedIn to the notes-daily spread platforms**
- - notes-daily currently spreads to x + bluesky only (SPREAD_PLATFORMS in src/cron/notes-daily.ts).
- Add 'linkedin' if Muxin wants longer / essay-like notes echoed there.
- Muxin's call on whether his notes fit the LinkedIn register.
- STATUS: Backlog
<!-- card-id: 48df9ed1-1e90-4cc5-84f5-29750bffa5bb -->

**Automate the analytics download for /cycle (constrained browser agent)**
- The only manual blocker to an unattended weekly /cycle is hand-downloading the analytics export files before `npm run ingest`.
- Build a constrained browser agent (Hermes-style) that does ONE narrow job: log into the analytics source(s), follow a fixed path, and download the export files in the exact order/format the ingest step expects — nothing else.
- This is the first concrete use of a general capability: a browser agent for sites with no usable API. The same pattern later serves Substack (no API) for publishing + listening.
- Success: /cycle runs start-to-finish (ingest → strategy → atomize → review queue) without Muxin fetching any files.
- STATUS: Done
- DONE (2026-07-03): shipped as PR #55 (LinkedIn) + PR #56 (X + Substack). All three platforms auto-pull real per-post analytics via `npm run pull -- <platform>` (saved-session Playwright agent, no stored passwords, src/pull/). X pulls the Analytics > Content "Download CSV"; Substack pulls the writer dashboard JSON API (real per-post views), NOT the email-only data export. Self-triaging with diagnostics bundles.
<!-- card-id: 0026b615-cc84-483a-8812-496eaf87aa00 -->

**Recurring weekly analytics pull (scheduler — "don't ask me")**
- Follow-up to 0026b615: the pull capability shipped, but nothing ran it on a schedule — on-demand only. A post gains traction over time, so stats need refreshing on a cadence without Muxin asking.
- Must run LOCALLY: the saved browser session lives on Muxin's Mac (`~/.content-agents/browser-profiles/`); a claude.ai cloud routine has no session and would hit a login wall. So it's a macOS launchd job, not a cloud routine.
- STATUS: Review
- BUILT (2026-07-03): `npm run pull:weekly` (src/cron/weekly-pull.ts) chains `pull -- --ingest` (LinkedIn/X/Substack) + `bluesky` with per-step failure isolation and a loud "session lapsed → pull:login" summary. Ready-to-load LaunchAgent at config/launchd/com.content-agents.weekly-pull.plist (Sunday 07:00 local, before /strategy); 3-command enable in docs/setup-weekly-pull.md. PENDING: Muxin runs the enable (persistent system config — deliberately not auto-installed).
- CONFIRMED SAFE for weekly re-pull: ingest upserts posts on (platform, platform_post_id) + APPENDS a timestamped metrics snapshot; snapshot.ts/resonance.ts read MAX(captured_at) per post and recency-weight by posted_at → traction refreshes, history kept, no double-count, old posts don't look artificially fresh.
<!-- card-id: b2e1c9b6-fe3b-4f2c-8629-f5b5442c783f -->

**Contextual per-platform card captions (a quote never ships out of context)**
- Problem (Muxin, 2026-07-03): a quote card posted alone was the quote as an image + the same quote repeated as the caption — no anchor, easy to misread / dunk on out of context.
- Built: a card is now a bare-quote IMAGE + a spun, CONTEXT-ONLY caption per platform. Rows become `quote-card:<target>` (x/linkedin/bluesky), each sharing `images/quote-card-N.png` with its own `derivatives/quote-card-N-<target>.md` caption (context drawn from the lines AROUND the quote, never the quote itself; spun through the channel angle; extraction-first, source_lines best-effort). The quote / image / animation are unchanged. The `quote-card-N.md` definition derivative keeps the verbatim quote for rendering.
- ANALYTICS (Muxin's constraint — testing per-platform performance): each platform's card now has a DISTINCT caption = a distinct match key, and cards.ts records the placement under the REAL destination platform with the caption as the key (was the quote) + `fm.spin` → the `| spin` marker. So `tag-source` attributes each card post per platform and classifies it atomized-spin; `origin-compare` measures per-channel card performance. Strictly better than the old shared-quote model.
- Code: `src/publish/cards.ts` (per-platform posting + caption + bet wiring), +4 tests (52 green). `validate.ts` + `render.ts` UNCHANGED (caption declares `platform:<target>` so it validates as a normal spun text post; render still reads the definition derivative's quote). Skill updated: SKILL.md steps 4/4.5/7/8 + references/spin-mode.md.
- STATUS: Review
- STILL TO WIRE (follow-ups): (1) ANIMATED cards — the `.mp4` companion reuses the same per-platform context caption, but /atomize doesn't yet auto-generate the per-platform animated PUBLISH rows (native video via Typefully, `media:` the mp4); small follow-up. (2) card rows don't auto-schedule on GUI Approve yet (still `publish:cards`) — same follow-up as the Unified review GUI card. (3) Notes cards keep the legacy single-caption fan-out (a note is self-contained; no surrounding context to extract).
<!-- card-id: a3127104-aa8a-4e4e-a4fe-fe7db245d8d5 -->

**Wire Substack aggregate reach/growth (summary-v2) into the audience table**
- Follow-up to the analytics-pull work (card 0026b615, PR #56). The per-post Substack pull is live, but the aggregate reach/growth endpoint isn't ingested yet.
- Source: `GET /api/v1/publish-dashboard/summary-v2?range=365` on the writer dashboard (subscribers, total views, growth). Verified live this session: subs 4→38, views 89→504.
- Wire it into the `audience` table (like LinkedIn demographics) so `npm run audience` and the strategy brief see real Substack subscriber totals + growth, not just the DB's undercounted per-post rows.
- Small: the endpoint + auth path are already proven in src/pull/platforms/substack.ts; this adds an aggregate fetch + an audience-row writer.
- STATUS: Backlog
<!-- card-id: 0f604c03-5e6c-467e-9bc2-6be45395dd42 -->

**Substack publishing automation (constrained browser agent, approved content only)**
- We auto-publish to X/LinkedIn/Bluesky (Typefully), YouTube, TikTok (PostPeer), and quote cards, but there is NO automation for publishing to Substack. Substack has no usable publishing API (CLAUDE.md rule 3).
- Build the POST side of the constrained browser agent we already use for analytics pull (src/pull/): drive the saved Substack session to publish or schedule an approved piece, and nothing else.
- SAFETY (non-negotiable): only acts on content Muxin set to `approve` in review-queue.md (rule 2), and browser posting needs Muxin's explicit go-ahead (rule 3). Never auto-post unreviewed.
- SCOPE QUESTION for Muxin: what should it publish to Substack? Substack is his HOME/origin where he authors originals, so the likely candidates are scheduling his OWN drafted posts and/or posting Notes, NOT AI-composed essays (extraction-first, rule 1). Decide this before building.
- Reuses: the saved-session stealth-Chrome agent + diagnostics from the pull build; the unified scheduler (src/publish/slots.ts) for timing.
- STATUS: Backlog
<!-- card-id: 8026f53c-0c52-46a2-aba1-e7e0bd416bdb -->

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
- STATUS: Backlog
<!-- card-id: d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4 -->

**Unified review + approval GUI (one page for everything awaiting Muxin)**
- Replace opening multiple windows + hand-editing review-queue.md. One web page shows everything pending review in one place.
- Each item is source-tagged ("from /cycle", "reply to <comment/mention>", etc.), inline-editable, with one Approve action that then schedules/sends it on the right platform at the right cadence.
- Covers /cycle output now; designed to also hold inbound voice-replies (see Inbound card) once those exist.
- Overlaps with "Voice Notes to Published" (664189d9) — RESOLVED (Muxin, 2026-06-30): THIS card is the single review/approval surface; 664189d9 re-scoped to the upstream voice-note→/atomize→schedule orchestration that feeds this GUI.
- EDITING MODEL (Muxin, 2026-06-30; DECIDED): keep the editing room SEPARATE from the GUI — reuse the /story GitHub-PR comment loop (Muxin comments on the exact line the agent wrote; agent makes SURGICAL edits to only that passage, no rehashing the location in chat). The GUI = the one-page dashboard (see everything pending, source-tagged, approve at a glance); items needing iteration live as GitHub PRs. CONVENIENCE (required): for each such item the GUI surfaces a DIRECT DEEP-LINK to the exact GitHub page she needs — the PR, ideally the specific file/line/comment thread — so one click from the dashboard lands her on the right spot, no hunting. Then approve/merge → publish.
- STATUS: Review
- BUILT v1 (2026-07-03): `npm run review` → local page (src/review/serve.ts, zero new deps, Node http) aggregating all 21 content/*/review-queue.md. Previews post text / quote-card image / video storyboard inline; surfaces spin + angle + source_lines; Approve / Revise(+note) / Discard write status back through the SAME cell /publish reads (verified byte-clean round-trip — only the status cell changes). Mobile-responsive. Reviewed live with Muxin.
- DECISIONS (Muxin, 2026-07-03): (1) EDITING MODEL — KEEP inline edit-in-place (supersedes the earlier GitHub-PR-deeplink plan for now; Build-1 derivatives aren't in PRs yet — revisit if they move there). (2) APPROVE BEHAVIOR — Approve → AUTO-SCHEDULE, and it's BUILT for text rows: approving an x/linkedin/bluesky row now calls `publishText(folder, {onlyIds:[id]})` → a real Typefully SCHEDULED draft at the cadence slot → row flips to published; button reads "Approve → schedule"; schedule failures surface in the GUI instead of throwing. Done via a pure refactor of typefully.ts (new exported `publishText`; CLI + notes-daily paths unchanged; 48/48 tests green). Muxin takes the FIRST live Approve→schedule click (outward-facing) to watch it land.
- STILL TO WIRE (follow-ups): cards / tiktok / video auto-schedule from Approve (still go via `/publish` for now); origin source-tags ("from /cycle" / "reply to mention"); live Typefully/PostPeer schedule reconciliation in the dashboard.
- DEPENDS ON: Per-channel positioning: one clear angle per platform ("Swizzle")
<!-- card-id: a4a2ce27-d4c4-4084-85b5-7e8b3c563dd9 -->

**Inbound listening + voice-replies (Build 3)**
- New capability: listen for mentions/replies/DMs on the channels, and draft replies in Muxin's voice (config/voice.yaml) for her to approve.
- Where a platform has no API (e.g. Substack), reuse the constrained browser-agent capability (see analytics-download card) to read/post.
- Drafts surface in the unified review GUI as suggested replies. SAFETY: draft-only, never auto-send — mirror the notes-daily pattern (unscheduled drafts, human sends).
- This is the "AI answers in my voice" idea — scope and test carefully before any send path exists.
- STATUS: Backlog
- DEPENDS ON: Automate the analytics download for /cycle (constrained browser agent)
<!-- card-id: db22283f-2e26-4f21-89a0-fcfe8f8fd4e9 -->

**Growth via borrowed audiences (other people's platforms), not just native social**
- Strategy note to fold into the weekly strategy brief: prioritize getting in front of OTHER people's existing audiences — podcast guest spots, guest essays / features in other newsletters, collabs, interviews, cross-posts — over grinding native social. Typically far more effective for reach and trust. NOT podcast-specific; any borrowed-audience channel counts.
- Treat native social (X/LinkedIn/Bluesky) as inbound funnels; Substack is home. Borrowed audiences drive new people toward Substack.
- Action seed: maintain a target list of podcasts / newsletters / platforms + a pitch angle aligned to the per-channel positioning card.
- STATUS: Backlog
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
<!-- card-id: ba9769af-f171-4f73-a373-2ca2cef5004c -->

**Content agent: find platforms to appear on (podcasts, channels, newsletters)**
- A content/research agent that finds OTHER people's platforms that are a strong fit for Muxin to talk about her work — podcasts, channels, newsletters, anyone with an audience and a real overlap, whether the hook is her essays (AI & society / fairness) or her product/build work.
- The agent: build a fit profile (topic overlap + audience + values), then source + qualify candidate platforms/hosts and surface them with a suggested pitch angle for her review.
- FEEDS the target list in "Growth via borrowed audiences" (30772ba1) — that card is the strategy; this is the agent that sources the targets. Pitch angle aligns to the per-channel positioning ("Swizzle"/Spin).
- Sibling of the client-finder card (same ideal-fit-profile → source → qualify → surface machinery, different target: platforms vs clients).
- SHARED ENGINE (Muxin approved, 2026-06-30): build ONE "fit-finder engine" (profile → source → qualify → surface) ONCE; client-finder + this card are its two configs (target = clients vs platforms). Don't build two divergent implementations.
- STATUS: Backlog
- DEPENDS ON: Per-channel positioning: one clear angle per platform ("Swizzle")
<!-- card-id: b7dcb608-4089-4f19-ba5c-df5dc1c75b7c -->

**Minimize model API cost — prefer subscription / free routes over per-token API (retro review + standing policy)**
- Requirement (Muxin, 2026-06-30): for ALL builds, default model usage to subscription / flat-rate / free routes and minimize per-token API spend. We lean on OpenRouter (per-token) more than needed.
- Part 1 — RETRO REVIEW the current setup (config/providers.yaml + skills). Today's paid/per-token routes: text-polish = grok-openrouter (VIDEO SCRIPTS); prose = grok-openrouter (FICTION, opt-in — default is already claude-native = $0); image = openrouter Riverflow ~$0.02 cost-first + paid step-ups (Nano ~$0.13, gpt-5.4-image ~$0.23); video-broll = Kling ~$0.08/s; transcription = gemini. For each: move to Claude-via-harness-subscription where quality allows, free-local where acceptable, or keep as a logged opt-in.
- Part 2 — CODIFY as a standing requirement so all unbuilt cards inherit it: policy added to CLAUDE.md (rule 6) + reflect in config/providers.yaml defaults; verify savings via the existing data/cost-log.csv.
- HONEST CONSTRAINT: there is NO clean "subscription API" for Grok or GPT — their APIs bill per token and the app subscriptions aren't programmatic. The real lever is "default to Claude (subscription via the harness)"; treat Grok/GPT/paid-image as opt-in only where they add value Claude can't (e.g. Grok's fiction voice). Don't promise subscription-Grok we can't deliver.
- Biggest concrete wins to evaluate: (a) video scripts on claude-native instead of grok-openrouter; (b) keep images free/cost-first, escalate only on request (already the policy); (c) confirm all Claude work routes through the harness subscription, not an Anthropic API key.
- Applies to simple-kanban builds too ("all builds") — same policy belongs in the conductor config via the claude-config lane (handoff; that conductor is live).
- STATUS: Backlog
<!-- card-id: a1a6f379-556f-4e46-83a8-5e70fbd3c2b4 -->

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
- STATUS: Backlog
- DEPENDS ON: Per-channel positioning: one clear angle per platform ("Swizzle")
<!-- card-id: 8b00ab2e-31e4-4fe0-a1da-4d5ce9616ae1 -->

**Create the claude.ai Routine for notes-daily (manual UI step)**
- - ORIGIN: follow-up auto-filed by the conductor from card 2972c204 (Smoke-test the notes-daily cloud routine), 2026-07-02.
- The notes-daily code shipped in PR #52, but docs/setup-cloud-routine.md Step 3 (create the Routine in claude.ai -> Routines UI, daily 14:00 UTC) appears never done: the committed dedup ledger has zero entries and no routine commits exist on any branch 5-6 days after merge.
- This is Muxin manual out-of-band action in the claude.ai web UI; nothing to build in this repo.
- Once created and the first real run lands a ledger entry, the parked smoke-test card (2972c204) resumes.
- STATUS: Backlog
<!-- card-id: bd499018-a6fa-46a2-a419-cd5ed01139fd -->

**Promote Spin from opt-in experiment to always-on default, driven by the approved per-channel angles**
- Spin (docs/spin-experiment.md, /atomize --spin) already does platform reframing but is opt-in; per the goal card's stated scope, promote it to an always-on default for every publish — no --spin flag needed.
- Encode the four APPROVED angles (Muxin, 2026-06-30) into config/platforms.yaml: X = voice of the non-engineer outside the SV tech bubble; LinkedIn = critiques business innovation broadly (how corporate norms strangle creative innovation); Substack = builder-philosopher (real AI risk is unexamined human systems, not the machine); Bluesky = the PM who treats democracy as broken UX + AI as making the fairness gap unignorable.
- Publishing logic reads this channel→audience→angle map and enforces/surfaces it per platform at publish time, per the card.
- Never invents new content streams — reframes what Muxin would already write, per her existing Obsidian content-ideas and config/pillars.yaml.
- GOAL_CONDITION: Running /atomize with no --spin flag applies platform-specific angle reframing to all four channels (X, LinkedIn, Substack, Bluesky) by default; config/platforms.yaml contains the four 2026-06-30 approved angle statements verbatim.
- ORIGIN: proposed by propose-cards 2026-07-02 from epic Per-channel positioning: one clear angle per platform ("Swizzle") (d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4)
- STATUS: Done
- DONE (2026-07-03): shipped as PR #54 (main 417d273). Spin is now the always-on default for every /atomize run; the four approved angles are encoded in config/platforms.yaml spin_angles; --no-spin is the opt-out; validate.ts enforces angle↔platform match. Reviewed live with Muxin (X/LinkedIn/Bluesky samples on "Building an Innovation Nation") before merge; review-queue approval gate unchanged.
- GROOMED: 2026-07-02 pre-flight groom: decomposes the Swizzle epic's own stated scope (promote Spin to always-on default); four angles approved by Muxin 2026-06-30 verbatim in epic; verifiable GOAL_CONDITION present
<!-- card-id: 33aa10f8-9b90-4e0c-8e4a-515432851926 -->

**Home-brand-thread check at review time, with Spin auto-drafting the thread in when missing**
- Per the card's THREAD CHECK: every published piece must carry a visible thread back to the home-brand worldview — "I uncover harmful hidden beliefs and why they need to change before AI automates everything" (and the fuller unexamined-human-systems / who-benefits / building-the-right-thing statement behind it).
- Operational test is NOT "is this about AI" — it's whether the piece connects back to that worldview; add this as an explicit check run before a piece reaches Muxin's review queue.
- If the thread is missing, Spin drafts it in, then the piece routes through the existing GH editing loop (see Unified review + approval GUI card) for Muxin to iterate until it feels right.
- Surface/suggest only — never hard-block a piece from publishing over a missing thread.
- GOAL_CONDITION: Each piece reaching Muxin's review queue carries a thread-check result (pass/missing) against the home-brand worldview line; any piece flagged missing already has a Spin-drafted thread inserted before Muxin sees it, and no piece is blocked from publishing solely due to a missing/failing check.
- ORIGIN: proposed by propose-cards 2026-07-02 from epic Per-channel positioning: one clear angle per platform ("Swizzle") (d23bfc5d-da2d-4dba-9a8e-d761e6cac0e4)
- STATUS: Backlog
<!-- card-id: 87cb6d93-5e6f-405f-9188-99c9d96434e2 -->

**Retire stale spin-experiment prose in /strategy skill**
- .claude/skills/strategy/SKILL.md still tells /strategy to surface 'SPIN BASELINE READY / time to run /atomize --spin' when origin-compare says the verbatim baseline is ready. Spin is now the default, so that call-to-action is obsolete; reword to report verbatim-vs-spin-vs-organic and suggest --no-spin control runs instead.
- Discovered while building card 33aa10f8 (Promote Spin to always-on default).
- CHAIN: 1
- STATUS: Backlog
- DEPENDS ON: Promote Spin from opt-in experiment to always-on default, driven by the approved per-channel angles
<!-- card-id: 2eb4ea51-3845-4d99-9501-2dbd9ac4548a -->

**Wire --no-spin through any atomize argument parsing scripts**
- isSpinDefault exists in src/atomize/spin.ts but the atomize skill is prose-driven; if any script (new-content, validate CLI) later grows flag parsing, thread --no-spin through it so the opt-out is machine-enforced, not just skill-prose.
- Discovered while building card 33aa10f8 (Promote Spin to always-on default).
- CHAIN: 1
- STATUS: Backlog
<!-- card-id: 3c0d1956-9fcf-440f-86e8-de112e7c4d83 -->

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

**"Hit record" on-camera video as a first-class media type (auto-topic, auto-route, delete source)**
- New input: Muxin records a raw talking-head / selfie video ("hit record", say a thing, stop) and drops it in. No script, no storyboard — this is the fast, human, face-to-camera lane, DISTINCT from /video (essay → scripted short) and from Voice Notes to Published (664189d9, audio → text).
- AUTO-DETECT TOPIC from the recording itself: transcribe (existing transcription provider in config/providers.yaml) → classify pillar + topic (config/pillars.yaml rubric) → drive routing (route.ts) so it lands on the right platform(s) with no manual tagging.
- PUBLISH natively where video performs (TikTok, YouTube Shorts, X, LinkedIn, Bluesky all accept native vertical video); optionally atomize a text post + quote card from the transcript so one recording fans out. Nothing auto-posts — review-queue.md approval still governs (rule 2).
- DELETE the raw recording after it's live: once published, remove the source video file (no storage bloat). KEEP the published-asset reference + metadata + transcript, NOT the raw footage.
- TRACK media_type (e.g. 'talking-head') in analytics — the media_type dimension already exists (PR #44/#46); this adds a new value so we learn which platforms engage with face-to-camera vs quote cards vs scripted shorts. Feeds "Keeping track of what we've posted... in what format" (b5897047).
- Reuses: transcription (gemini), routing, unified scheduler + reuse guard, publish adapters (PostPeer / YouTube / Typefully). Same "drop raw input → auto-atomize → approve → schedule" orchestration as Voice Notes to Published (664189d9) and the Unified review GUI (a4a2ce27).
- OPEN QUESTIONS for Muxin: (1) publish the raw clip as-is, or add captions / light edit first? (2) which platforms are in-scope for native video by default? (3) delete immediately on publish, or after a short grace window / archive elsewhere first?
- STATUS: Backlog
<!-- card-id: b0e4ecc5-6120-4b40-a6dd-859c34ca332a -->

**Guard the review GUI: don't allow Approve on a storyboard/video row with no rendered file**
- The review GUI (`src/review/serve.ts`) writes `approve` straight into review-queue.md on any row's Approve click. A `video-script` / `storyboard`-type row can be approved even when its storyboard/video file doesn't exist yet (asset cell is `—`), producing a phantom approval that means nothing to `/publish` and reads as an unauthorized edit.
- Observed 2026-07-04 (during repo sync): the innovation-nation `video-script` row was found flipped `blocked → approve` in the working tree with no storyboard file present — an uncommitted, unauthorized-looking edit traced back to a GUI Approve click on a not-yet-rendered row.
- Fix: in `serve.ts`, guard the Approve action for storyboard/video rows whose asset file is missing (cell `—` / not on disk) — disable the button or reject the write, and surface why ("storyboard not rendered yet — run /video"). Text / image / quote-card rows unaffected. Small, local to `src/review/serve.ts`; no schema change.
- ORIGIN: filed 2026-07-04 from the phantom-approve found during repo sync.
- STATUS: Backlog
<!-- card-id: 4bef9a7c-9148-4c59-afcf-04475ea11ff5 -->
