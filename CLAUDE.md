# content-agents

Systems for Muxin Li's content operation, orchestrated by Claude Code:

- **Build 0 — Strategy Intelligence**: analytics in → SQLite → weekly strategy brief (`briefs/`)
- **Build 1 — Atomization**: original content + brief → platform assets (text, images, video) → human review → publish
- **Build 2 — Fiction**: a serialized, monetized fiction series written chapter-by-chapter
  (`stories/`). The one place AI *composes* original prose. Deliberately walled off from
  Builds 0/1 — see `stories/AGENTS.md`.
- **Build 3 — Venture**: a phased solo-business sprint (intake → Attention → Audience → Offer →
  Operations) that composes original business-testing content — post ideas, probe posts, and
  later a lead magnet, an offer, an operating plan (`venture/`). The second place AI *composes*
  original work, and unlike Build 2 it ships under Muxin's own byline in her own voice.
  Deliberately walled off from Builds 0/1 — see `venture/AGENTS.md`.
- **Build 4 — Charles Lord Featherbottom**: a satirical persona, a consultant to oligarchs
  secretly panicking as belief in "inevitable power" erodes. `/charles` composes his one-liners,
  essays, and replies from scratch — no source essay, no Muxin byline. Memes are out of scope
  (Muxin handles those herself elsewhere).
  Deliberately walled off from Builds 0/1/3 — see `charles/AGENTS.md`.

## Non-negotiable rules

1. **Extraction-first.** Muxin is the author. Text and image derivatives quote and trim verbatim
   lines from the source; light edits for platform format only. NEVER compose new claims,
   arguments, or worldview statements in Muxin's voice. Every such derivative must carry
   `source_lines` frontmatter tracing the lines it was built from.
   - **Scoped exception -- approved social treatments.** A configured Content Studio treatment
     may re-hook, reorder, trim, clarify, and add connective structure so an essay-derived social
     post makes one intelligible standalone point. It may not invent a factual claim, statistic,
     example, experience, metaphor, or worldview position outside its cited `source_lines`.
     The untreated control remains byte-for-byte exact. Treated copy must pass `config/voice.yaml`,
     strip source footnote syntax, carry source provenance, attach `cta: source` when an essay or
     other long-form source has a canonical URL, never link back to a Substack Note, and remain pending until Muxin reviews it. This is the same narrow
     source-grounded latitude used by Spin and `/patterns rewrite`, not permission for freeform
     authorship or untraced claims.
   - **Scoped exception -- common platform hook templates.** The newer Grow/patterns path may
     generate a platform-specific opening from a common, widely shared hook template in mad-lib
     form, using Muxin's supplied thought, claim, experience, evidence, and point of view. This
     may change the hook's wording and order, but it may not invent a factual claim, copy a
     distinctive creator-specific phrase sequence, or copy a creator's body, story, or examples.
     The adapted hook must retain provenance to the selected pattern/evidence and pass Muxin's
     voice and human-review gates. Exact creator wording is analysis, quotation, attribution, or
     a licensed exception only. Legacy extraction-only modes remain extraction-first until their
     own skill migration explicitly adopts this exception.
   - **Scoped exception — video scripts.** Video shorts are a deliberate exception: Claude (via the
     `text-polish` provider — `claude-cli`, on Muxin's subscription, $0; `npm run script:draft`, in
     the `/video` skill) drafts a hook-driven script from the essay's *ideas* — not verbatim-traced.
     This is allowed ONLY because every storyboard is reviewed and approved by Muxin in
     `review-queue.md` *before* any render, and nothing auto-publishes. The exception is video
     scripts only; it must never bleed into text/image derivatives.
   - **Scoped exception — Build 3 (Venture).** `venture/` composes original business-testing copy:
     Phase 1's ten post ideas and three drafted probe posts, then later phases' lead magnet,
     landing page, emails, offer and operating plan. There is no source essay, so no
     `source_lines`. Allowed ONLY because every judgment step ends in a decision record Muxin
     selects, every user-facing draft is editorially approved by her, and nothing publishes
     without her explicit action. **The exemption is from tracing, not from truthfulness** —
     `venture/rules.md` §3, item 9 ("No invented proof") keeps rule 1's real prohibition alive
     inside the exception: never assert a result, customer, number, or experience Muxin did not
     have.
     Unlike Build 2, **rule 5 applies in full here** — this copy ships in Muxin's nonfiction voice
     under her own name, so `config/voice.yaml` governs it completely. See `venture/AGENTS.md`.
     The exception is Venture-composed business copy only; it must never bleed into text/image
     derivatives.
   - `/brand-lens` (`.claude/skills/brand-lens/`) is NOT an exception to this rule: it proposes
     angles and flags branding gaps against `config/brand.yaml`, but never composes or rewrites
     prose that enters the pipeline as content.
   - **Scoped exception — Build 4 (Charles Lord Featherbottom).** `charles/` composes an entire
     fictional persona's posts (one-liners, essays, replies) from scratch — there
     is no source essay, no `source_lines`, and it never claims to be Muxin's voice. Allowed ONLY
     because every draft is reviewed and approved by Muxin in `charles/review-queue.md` before
     anything posts, and nothing auto-publishes (`/charles` never posts — delivery is
     ready-to-paste, Muxin pastes it herself). **The exemption is from tracing, not from
     truthfulness**: Charles's "useful leaks" (real ballot measures, orgs) must stay factually
     accurate to the sourced claims in `charles/config/persona.yaml`'s leak bank — see
     `charles/AGENTS.md`. The exception is Charles-composed satire only; it must never bleed into
     text/image derivatives or Muxin's own voice.
2. **Nothing publishes without review.** `/publish` acts only on rows Muxin set to `approve` in
   `review-queue.md`. Text posts go to Typefully as scheduled drafts, never instant posts.
3. **Browser automation for posting is allowed only with Muxin's explicit approval.** Prefer
   official APIs and sanctioned API relays (Typefully — text posts and, since 2026-07-08, quote
   cards as native image posts too — YouTube, AT Protocol, PostPeer for TikTok) or ready-to-paste
   files — they're more reliable. Where no usable API exists (e.g. Substack), a constrained browser
   agent MAY post, but only on content Muxin has approved — rule 2 still governs, nothing posts
   unreviewed. Never auto-post via browser without that approval.
   Published-source CTAs follow the same review-first policy: a derivative with a canonical essay
   or chapter points back to that long-form source by default. A Substack Note never links back to
   itself. A project, offer, or lead-generating CTA
   may replace an absent source only when its destination already exists and is explicitly reviewed
   as both high-fit and high-value. Never invent a lead magnet or force a generic promotional ask.
4. **Discrete verifiable outputs.** Every pipeline step writes a file or DB rows that can be
   inspected. Scripts do deterministic work; Claude does judgment (tagging, synthesis,
   extraction, scoring) inline while running skills.
5. **Muxin's voice, no AI tells.** Every word a human will read (text derivatives, video
   scripts, titles, the strategy brief, ready-to-paste copy) follows `config/voice.yaml`. No
   em dashes, no "here's the thing", none of the obvious AI writing patterns listed there.
   Em dashes are never Muxin's; they ride in on AI-generated copy (derivatives, or an
   AI-processed `source.md` copy whose dashes were never in his original). Strip them to
   periods, commas, colons, or parentheses. Read it aloud; if it sounds like a brand instead of
   Muxin talking, rewrite it.
   - **Exemption — Build 4 (Charles Lord Featherbottom).** Charles is not Muxin and is not
     nonfiction-PM-voiced on purpose — `config/voice.yaml` does not govern him. He is governed
     instead by `charles/config/persona.yaml`. The em-dash ban still carries over, same as
     Build 2's fiction. See `charles/AGENTS.md`.
6. **Prefer subscription / free model routes; minimize per-token API cost.** Default any model
   call to the cheapest acceptable route: Claude, Grok, and GPT/Codex through their installed,
   signed-in subscription CLIs, plus free-local media (Remotion / SVG / HyperFrames, kokoro TTS,
   whisper.cpp) before paid APIs. Reserve Grok for deliberate cross-family work. OpenRouter is a
   temporary exception for Kling video generation while local Wan 2.2 is evaluated; every paid
   call remains opt-in and logged to `data/cost-log.csv`. Attended Codex image generation is a
   reviewed-file workflow, not a callable repository API. New builds inherit this.
7. **PR merge: prove routine changes locally; hold only for changes to content-generation LOGIC,
   never for generated content itself.** The conductor merges a clean, locally verified PR
   immediately after self-vet; routine hosted CI is manual/advisory. The ONLY reason to hold
   a PR open for Muxin's explicit review is a change to the *code/prompts that decide what content
   says* — `src/atomize/` extraction or spin logic, quote-card copy/image-prompt generation logic,
   video script/storyboard drafting logic, `src/strategy/` brief-synthesis logic, Build 2 fiction
   chapter-drafting logic, Build 3 Venture phase logic and gate predicates (`src/venture/**`), its
   runtime rubric input (`venture/rules.yaml`), and its skill prompts (`.claude/skills/venture/**`),
   Build 4 Charles's persona/voice config (`charles/config/persona.yaml`) and its skill prompts
   (`.claude/skills/charles/**`). That is judgment-affecting and needs her eyes every time. Everything
   else merges after the local check, full stop — including: the generated content itself committed to
   git (derivatives, quote-card text, drafted chapters), review-queue/publish-log/ledger state,
   backlog bookkeeping, docs, scripts, infra, config. Committing already-generated or
   already-decided content to git is not "publishing" (rule 2 still gates actual publish via
   `review-queue.md`) and is not a logic change, so it never needs a held PR. If in doubt whether a
   diff is "logic" or "content," ask: does this diff change what future runs will generate, or is
   it just this run's output/state? Only the former holds.
   - **Conductor mechanics for a held content-generation-logic PR.** Open it as a **draft PR**,
     never auto-merge, and put an **old-vs-new content sample side by side** in the PR
     description (run the changed logic on a real or representative input before/after so Muxin
     can see the actual output delta, not just the diff). This applies to every content-generation
     LOGIC change with no exceptions — there is no self-vet carve-out for these, even when the
     diff also touches a UI surface (e.g. review-GUI tooling bundled with a logic change still
     holds on the logic half). The narrower self-vet exception for review-GUI/tooling-only PRs
     (no logic change) still stands — see the diagnostic above: only "is it a logic change"
     decides, UI-surface-or-not is irrelevant to that decision.

## Pipeline map

| Step | Trigger | Script(s) | Claude judgment | Output |
|---|---|---|---|---|
| Ingest analytics | files in `data/inbox/` | `npm run ingest`, `npm run bluesky` | — | rows in `data/analytics.db` |
| Tag pillars | untagged posts exist | `npm run snapshot -- --untagged`, `tsx src/db/tag-posts.ts` | assign pillar per post (rubric: `config/pillars.yaml`) | `posts.pillar` |
| Strategy | `/strategy` (weekly) | `npm run grade-bets`, `npm run snapshot`, `npm run resonance`, `npm run tag-source`, `npm run origin-compare`, `npm run link-bet`, `npm run route -- --brand <brand> --all` | grade last cycle's bets, synthesize brief citing real posts, compare atomized vs organic traction, record new bets | `briefs/YYYY-MM-DD-strategy-brief.md`, `briefs/bets.md` |
| Route | inside `/atomize` (+ `/strategy`) | `npm run route` | pillar tag drives it; Muxin still approves what's queued | `content/<slug>/routing.md` |
| Atomize | `/atomize <url\|file>`, `/atomize notes` | `npm run new-content`, `npm run new-notes`, `npm run validate`, `npm run content-request` | extraction-first drafting + scoring (text posts + quote cards); `/atomize notes` pulls Substack Notes (not in RSS) and spreads picked ones; record `from_brief`/`directives_applied`; **only for routing `include` platforms** | `content/<slug>/derivatives/`, `review-queue.md`, `content-request.json` (makes the folder visible in the Content room) |
| Quote cards | inside `/atomize` | `npm run render -- --still` | extraction-first quote line + cost-first image model | `images/` |
| Video | `/video <file\|folder>` | `npm run script:draft`, `npm run render -- --render-video` | Claude-drafted script ($0 subscription) + 5–7 storyboard scenes/visual prompts; storyboard approved as TEXT before any render | `video/storyboard.md`, `video/short.mp4` |
| Review | **Muxin, by hand** | — | — | statuses in `review-queue.md` |
| Publish | `/publish` | `npm run publish:*` | — | Typefully drafts, YouTube upload, TikTok scheduled post (PostPeer), quote-card scheduled post (PostPeer/Upload-Post, `publish:cards`), `ready-to-paste/`, `publish-log.md`, `briefs/bets.md` Placed log |
| Weekly loop to drafting | `/cycle` | ingest + strategy + atomize steps above | orchestration | — (review and publish are the Content room's, not `/cycle`'s) |
| Venture intake | `/venture new <slug>` | `npm run venture:new` | 25-question interview one question at a time, voice evidence, Day 14 scorecard fields | `venture/<slug>/intake.md` |
| Venture Phase 1 | `/venture <slug>` | `npm run venture:phase1` | research plan (Muxin-reviewed before drafting), platform pick, 10 ideas + 4-factor rank, 3 selected with distinct-unknown coverage, drafted across `substack-post`/`text-post-note` with `claim_refs`; then the Phase 1→2 bridge (research read, Muxin-reviewed, then a continuation decision that either loops back into more Phase 1 ideas or unlocks Phase 2) | `venture/<slug>/phase-1-attention/`, `decisions.jsonl`, `artifacts.jsonl` |
| Venture Phase 2 | `/venture <slug>` (once unlocked) | `npm run venture:phase2` | 5 lead-magnet concepts + 6-factor rank, 1 selected; lead magnet, landing page, and welcome-email drafts (`claim_refs` where applicable); a fit review of Muxin's existing survey (not a new one); an optional announcement | `venture/<slug>/phase-2-audience/`, `decisions.jsonl`, `artifacts.jsonl` |
| Venture Phase 3 | `/venture <slug>` (once unlocked) | `npm run venture:phase3` | ingest survey responses (`response-ingest`/`response-correct`) until the response gate opens (20 min / 30 target eligible unique respondents) — every analysis command below refuses until then; cluster responses into 3-5 problems; score each on 6 factors and Muxin selects the core problem; draft a single plain transformation sentence (no vague verbs, no em dashes) and Muxin approves it; draft a 5-7 section product outline built backward from that sentence for Muxin's approval; rank price/format options and Muxin selects one; draft the price-decision (recommended price, considered range, reasoning, known uncertainty, pitch paragraph, optional illustrative-only scenario math — refuses the $49 worked-example price outright) for Muxin's approval | `venture/<slug>/phase-3-offer/`, `cluster-analysis.json`, `responses.jsonl`, `decisions.jsonl`, `artifacts.jsonl` |
| Venture Phase 4 | `/venture <slug>` (once unlocked) | `npm run venture:phase4` | compare the intake time budget against the canonical 2h15m daily routine and offer a recorded choice (use it as-is, rotate the five jobs across the week, extend the timeline, or revise pace/scope) for Muxin to select; write the daily operating plan (schedule, triage of recurring work into never-build/ignore/automate — never automating insight, voice, audience empathy, product judgment, or final approval — and the automation configuration order) for Muxin's approval; draft short thank-you notes to early respondents one at a time, each linked privately to its source response, capped at two sentences, never auto-sent; draft the Day 14 review against the fixed scorecard (posts live, pace, clicks/opt-in vs. intake targets, eligible unique responses, response quality, sustainability) for Muxin's approval of the facts; Muxin makes the final Day 14 decision (continue, revise positioning, revise the lead magnet, collect more evidence, or stop) — Phase 4 ends with this human decision, there is no fourth checkpoint | `venture/<slug>/phase-4-operations/`, `decisions.jsonl`, `artifacts.jsonl` |
| Venture deliver | `/venture <slug> deliver` | `npm run venture:deliver` | — | `ready-to-paste/` (essay) or a live Substack Note via the shared scheduler |
| Venture checkpoint | `/venture <slug> checkpoint` | `npm run venture:checkpoint` | verify each required artifact is editorially approved AND delivery-confirmed live; Checkpoint 1 also requires pace recorded, Checkpoint 2 does not, Checkpoint 3 instead requires its three Phase 3 decisions (problem, transformation, price/format) all `selected` | `canon.md` ledger event, next phase unlocked |
| Venture status | `/venture <slug> status` | `npm run venture:status` | — (read-only) | plain-language phase/checkpoint status |
| Charles draft | `/charles oneliner\|essay\|reply` | — | in-character drafting off `charles/config/persona.yaml`; picks a comic-engine angle; cites leak-bank sources only; a one-click copy of `charles/config/persona-brief.md` (her verbatim brief) sits on the page for meme work she does elsewhere | `charles/posts/<type>/`, `charles/review-queue.md` |
| Charles review | **Muxin, by hand** | — | — | statuses in `charles/review-queue.md`; she pastes approved drafts to Substack herself |

## Conductor: reaching into job-search-agent (JSA)

The outreach engine (`docs/outreach-engine-plan.md`) treats JSA as a sibling repo it sometimes
needs to build or run in directly, not just read from. Normal outreach-engine reads go through
`JSA_DB_PATH` (`manual_research.db`, read-only — see the plan's §2a handoff format). Some work
needs more than a read: running JSA's own `scripts/auto_analyze.py` on demand (e.g. a "find
companies" request beyond what's already scored), or a content-agents card whose `DECISION` names
job-search-agent outright.

For that, this repo's conductor lane launches with `--add-dir` reach into JSA already granted —
the `content-agents` entry in `~/.claude/orchestrator-repos*.json` carries `add_dirs` for
`job-search-agent` and `job-search-agent-worktrees`, the same way simple-kanban's lane reaches into
claude-config. A card whose `DECISION` names job-search-agent builds there instead of here:
worktree under `job-search-agent-worktrees/wt-<slug>`, base branch `master` (JSA's own
`.orchestrator.json`), JSA's own self-vet/merge rules apply there, not this repo's.

JSA keeps its own backlog (`docs/operations/backlog.md`) and its own independent conductor lane —
this add_dir grant does not fold JSA's card queue into content-agents' loop. It only gives
content-agents-originated work (backlog cards or runtime skill calls, e.g. the outreach engine's
"find companies" step) somewhere to actually run JSA code when it needs to.

## Conventions

- Provider adapters live in `src/providers/<capability>/<name>.ts`, selected in
  `config/providers.yaml`. Every adapter returns `costUsd`; costs append to `data/cost-log.csv`.
- Fiction chapters (Build 2, `stories/<slug>/chapters/`) are written one sentence per line so
  GitHub PR comments anchor to a passage.
- `data/community-log.md` is Muxin's append-only manual observation log — read it during
  `/strategy`, never edit it.
- `briefs/bets.md` is the feedback loop's memory: `/strategy` writes a bet per recommendation and
  grades the prior cycle's bets against fresh data (`npm run grade-bets`); `/publish` appends
  append-only `Placed log` rows when assets ship; `npm run link-bet` stamps `posts.bet_id` once a
  published post is matched to its analytics outcome. Committed every cycle (unlike `analytics.db`).
- Channels with <4 weeks of data must be flagged INSUFFICIENT in briefs (computed by
  `snapshot.ts`, not by judgment). Recency-weighted engagement (`snapshot`/`resonance`, 4-wk
  half-life) and `grade-bets` flags guard against fossilized strategy.
- Routing decides which platforms a piece is atomized to (`route.ts` + `config/routing.yaml`),
  gating generation in `/atomize` — not "post everywhere." Data narrows it; cold-start posts
  broadly to config defaults. Routing only gates what's *generated/queued*; Muxin's
  `review-queue.md` approval is still the only thing that publishes.
- Publish timing is owned by ONE unified scheduler (`src/publish/slots.ts` + the `posts_per_week` /
  `slot_days` / `slot_time_pst` cadence in `config/platforms.yaml` + the shared slot ledger
  `data/publish-schedule.jsonl`), used by ALL scheduled channels — text (Typefully), cards (image
  relays), and TikTok (PostPeer). It claims the next free, PT-anchored slot per platform, ≤1
  post/platform/PT-day by default (a platform's `max_slots_per_day` can raise that, spacing extra
  slots across the day) and ≤ `posts_per_week` across runs and streams. Cards (`quote-card` cadence)
  also de-conflict against each platform they fan out to. Edit `config/platforms.yaml` to change
  cadence — Typefully gets explicit times, not its "next-free-slot"; TikTok still honors
  `TIKTOK_SCHEDULE_AT` as a manual one-off override.
- Secrets in the single repository-root `.env` only. Never commit `.env` or `data/analytics.db`.
- A freshly created git worktree has no `node_modules`. Run `npm run worktree:setup` (a plain
  `npm ci` from the committed lockfile) once before running `npm test` or any script in it.
