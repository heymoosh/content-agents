# ✅ PUBLISHING FREEZE LIFTED (Muxin confirmed resuming, 2026-07-08)

All 3 measurement-scaffolding cards shipped — `7e550e48` (routing drift flag), `92bb2ae6`
(exploration budget), `ffa6491d` (posting-cap decision) — and Muxin has confirmed resuming.
`/cycle` and `/publish` are back in normal operation.

---

**Dependabot sweep (2026-07-24) — 5 major-version bumps closed unreviewed, need individual re-evaluation**
- ORIGIN: `/babysit-prs` triage of 12 open Dependabot PRs. Per Muxin's instruction, all 12 were
  closed without merging so they stop sitting open indefinitely; these 5 carry an actual major
  version jump (not just a patch/minor bump) and deserve a real look before anyone reapplies them
  by hand or lets Dependabot reopen them.
- **`zod` 3.25.76 → 4.4.3** (PR #271, closed). Zod v4 is a documented rewrite with breaking API
  changes from v3 (error customization, `.parse`/schema composition changes upstream). No CVE/
  security advisory cited by Dependabot — this is a feature-breaking major bump, not a security
  fix. Needs a real compile+test pass against this repo's actual zod usage before reapplying.
- **`better-sqlite3` 11.10.0 → 12.11.1** (PR #270, closed). Mostly native-binary/prebuild churn
  (Electron v42 support, Node v26 prebuilds, SQLite bumped to 3.53.1) — changelog shows no JS API
  breaking changes, but two releases in the chain (`v12.11.0`, `v12.9.1`) were marked "NOT A VIABLE
  RELEASE" by the maintainer (fixed in the immediately-following patch). If this is reapplied,
  pin directly to `12.11.1`, not a bare `^12`.
- **`typescript` 5.9.3 → 7.0.2** (PR #269, closed). This skips v6 entirely (5.9 → 7.0) — a two-
  major-version jump, near-certain to surface new strictness/type errors across the codebase.
  Dependabot also flagged a maintainer-identity change worth noting: "This version was pushed to
  npm by `microsoft1es`, a new releaser for typescript since your current version." Not
  necessarily suspicious (large orgs rotate publishing accounts) but worth a quick sanity check
  before trusting the package wholesale. Needs its own PR with a full `tsc --noEmit` pass, not a
  drive-by bump.
- **`actions/setup-node` 4 → 7** (PR #262, closed). Major bump, ESM migration + `@actions/cache`
  upgrade upstream. Low local risk (GitHub-hosted runners handle this transparently) but confirm
  CI still passes after reapplying, not just assume it.
- **`actions/checkout` 4 → 7** (PR #261, closed). Major bump with an explicit upstream
  `[BREAKING]` note: v6.1.0 backported "safer `pull_request_target` defaults" (see
  https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/),
  changing fork-PR checkout behavior for `pull_request_target`/`workflow_run` triggers. Check
  whether any workflow in `.github/workflows/` uses `pull_request_target` with a fork checkout
  before reapplying — if so, this could change what actually gets checked out.
- STATUS: Backlog
- DECISION: none yet — the 12 PRs themselves are closed (not merged); this card is the follow-up
  decision point for whether/when to manually reapply each of these 5, one at a time, with its own
  test pass.
<!-- card-id: cb08c639-02d5-4b26-9c6b-229a31f87d08 -->

---

**Dependabot sweep (2026-07-24) — 7 routine minor/patch bumps closed unreviewed**
- ORIGIN: same `/babysit-prs` triage as the major-version card above. These 7 are ordinary patch/
  minor bumps with no breaking-change language or CVE/security-advisory citations in Dependabot's
  own changelog excerpts — lower priority to revisit than the 5 major bumps, but listed here so
  the repo isn't silently behind without a record of what was skipped.
  - `@remotion/captions` 4.0.474 → 4.0.495 (PR #272, closed)
  - `@remotion/cli` 4.0.474 → 4.0.495 (PR #268, closed)
  - `@remotion/bundler` 4.0.474 → 4.0.495 (PR #267, closed)
  - `@remotion/renderer` 4.0.474 → 4.0.495 (PR #266, closed)
  - `remotion` 4.0.474 → 4.0.495 (PR #263, closed) — note all 5 Remotion packages should be
    bumped together in one PR if reapplied by hand; Dependabot opened them as 5 separate PRs.
  - `@atproto/api` 0.13.35 → 0.20.30 (PR #265, closed) — minor-version jump (0.13 → 0.20) is
    larger than it looks since atproto is still pre-1.0 and treats minor bumps as its de facto
    major axis; worth a quick smoke test of the Bluesky posting path if reapplied, not a blind bump.
  - `tsx` (dev dependency) 4.22.4 → 4.23.1 (PR #264, closed)
- STATUS: Backlog
- DECISION: none yet — closed without merging per Muxin's instruction; low urgency to revisit
  individually, but worth reapplying in a single batch PR when someone has a spare CI cycle.
<!-- card-id: e55d201a-2bf0-497b-8141-2a84217b7a3b -->

**Funding + mission-aligned role search for Voter Choice — wire `kind: funding` into the outreach engine**
- ORIGIN: Muxin's Boardy AI conversation (2026-07-24) asking it to find funding for Voter Choice
  (https://voter-choice.vercel.app) that doesn't take equity/IP, plus mission-aligned full-time
  roles leaning on that project. Boardy has already started surfacing and introducing people —
  logged in `outreach/boardy-intros.md` — and Muxin gave detailed, specific search criteria
  (four funding channels, non-dilutive-first priority order, the Nava Labs worked example, the
  founder-studio/residency equity caveat, current oligarchy/money-in-politics focus lens) now
  written up as `config/outreach/funding.md`.
- SCOPE: `LeadKind` (`src/outreach/{intake,research,qualify,draft,validate}.ts`) is currently
  `client | platform | content-example` only. This card is: add `funding` as a fourth kind,
  following the exact precedent the platform-kind Phase 3 addition set (same `add` → `research` →
  `qualify` → `draft` → `lock` flow, own fit field in frontmatter — likely `fit: strong | partial
  | weak | disqualified` mirroring platform-kind rather than a new vocabulary), `research.ts`
  reading `config/outreach/funding.md` as its closed-checklist rubric instead of clients.md/
  platforms.md, and `/scout` extended to discover funding-kind candidates the same way it already
  discovers client/platform ones. Follow-up tracking can likely reuse the existing `client` or a
  new bucket in `tracker.jsonl`/`config/outreach.yaml` — open decision, not yet ratified.
- OPEN DECISIONS (ratify before building, same discipline as docs/outreach-engine-plan.md §2):
  which tracker bucket funding-kind leads use for follow-up windows; whether role-fit leads
  (the second-priority full-time roles) are `kind: funding` too or reuse `kind: client` with a
  Voter-Choice-specific angle; how `outreach/boardy-intros.md`'s manually-logged contacts fold in
  once a person converts into a real lead (currently that file is a plain, unwired log — see its
  own header note on why forcing it into `tracker.jsonl` today would make rows invisible in the
  Follow-ups GUI).
- STATUS: Backlog
- DECISION: none yet — new card, needs Muxin's build-vs-defer call before Phase 1 of this slice starts.
<!-- card-id: ff07cf66-06a3-41a4-bdfc-7f3a113a4d00 -->

---

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

**Implement follow-up message drafting from the Follow-ups tab**
- Epic 659b50f0 specifies ROW SHAPE includes 'one-click mark-responded / send-follow-up / move-on' but only mark-as-sent is filed (240ba67)
- send-follow-up action needs to draft a follow-up message (reusing src/atomize/reply-draft.ts pattern for voice.yaml compliance) and surface it in review-queue for approval
- Message context: locked core-message from the lead's lead.md + time-since-contact + prior message history from tracker.jsonl, draft to review-queue.md as a new row type (follow-up-draft)
- No auto-send — mirrors the review → approve posture of db22283f (voice replies draft-only)
- GOAL_CONDITION: Clicking 'send-follow-up' on a Follow-ups tab row (any bucket) generates a voice.yaml-compliant draft message in review-queue.md as row type follow-up-draft with source_lines tracing to lead.md + prior touch history; npm test covers draft+approve flow with no network calls in dry-run
- PARENT: 659b50f0-6bc7-473b-8673-b901e9c93d11
- ORIGIN: proposed by propose-cards 2026-07-14 from epic Unified follow-up tracking ("Follow-ups" tab) across client, platform, inbound, and job-search outreach (659b50f0-6bc7-473b-8673-b901e9c93d11)
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
- STATUS: To Do
- DECISION: hold -- epic 659b50f0 already approved this row-shape/action ('send-follow-up', draft-only, no auto-send). Scope is clear (reuses src/atomize/reply-draft.ts pattern for voice.yaml compliance). Message-drafting is content-generation-adjacent logic in spirit of rule 7 (produces text Muxin will read/send), so PR HOLDS for review with a real before/after sample rather than auto-merging. (pre-flight 2026-07-14)
- GROOMED: readiness pass: clear GOAL_CONDITION, reuses src/atomize/reply-draft.ts pattern, draft-only mirrors db22283f + 2026-07-15
<!-- card-id: 60743d7a-4919-4776-8c33-596b526c9455 -->

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
