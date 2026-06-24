# content-agents

Systems for Muxin Li's content operation, orchestrated by Claude Code:

- **Build 0 — Strategy Intelligence**: analytics in → SQLite → weekly strategy brief (`briefs/`)
- **Build 1 — Atomization**: original content + brief → platform assets (text, images, video) → human review → publish
- **Build 2 — Fiction**: a serialized, monetized fiction series written chapter-by-chapter
  (`stories/`). The one place AI *composes* original prose. Deliberately walled off from
  Builds 0/1 — see the Build 2 section below.

## Non-negotiable rules

1. **Extraction-first.** Muxin is the author. Text and image derivatives quote and trim verbatim
   lines from the source; light edits for platform format only. NEVER compose new claims,
   arguments, or worldview statements in Muxin's voice. Every such derivative must carry
   `source_lines` frontmatter tracing the lines it was built from.
   - **Scoped exception — video scripts.** Video shorts are a deliberate exception: Grok (via the
     `text-polish` provider, in the `/video` skill) drafts a hook-driven script from the essay's
     *ideas* — not verbatim-traced. This is allowed ONLY because every storyboard is reviewed and
     approved by Muxin in `review-queue.md` *before* any render, and nothing auto-publishes. The
     exception is video scripts only; it must never bleed into text/image derivatives.
2. **Nothing publishes without review.** `/publish` acts only on rows Muxin set to `approve` in
   `review-queue.md`. Text posts go to Typefully as scheduled drafts, never instant posts.
3. **No browser automation for posting.** Official APIs and sanctioned API relays (Typefully,
   YouTube, AT Protocol, PostPeer for TikTok + quote cards, Upload-Post as the card failover) or
   ready-to-paste files only.
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

## Pipeline map

| Step | Trigger | Script(s) | Claude judgment | Output |
|---|---|---|---|---|
| Ingest analytics | files in `data/inbox/` | `npm run ingest`, `npm run bluesky` | — | rows in `data/analytics.db` |
| Tag pillars | untagged posts exist | `npm run snapshot -- --untagged`, `tsx src/db/tag-posts.ts` | assign pillar per post (rubric: `config/pillars.yaml`) | `posts.pillar` |
| Strategy | `/strategy` (weekly) | `npm run grade-bets`, `npm run snapshot`, `npm run resonance`, `npm run tag-source`, `npm run origin-compare`, `npm run link-bet`, `npm run route -- --all` | grade last cycle's bets, synthesize brief citing real posts, compare atomized vs organic traction, record new bets | `briefs/YYYY-MM-DD-strategy-brief.md`, `briefs/bets.md` |
| Route | inside `/atomize` (+ `/strategy`) | `npm run route` | pillar tag drives it; Muxin still approves what's queued | `content/<slug>/routing.md` |
| Atomize | `/atomize <url\|file>`, `/atomize notes` | `npm run new-content`, `npm run new-notes`, `npm run validate` | extraction-first drafting + scoring (text posts + quote cards); `/atomize notes` pulls Substack Notes (not in RSS) and spreads picked ones; record `from_brief`/`directives_applied`; **only for routing `include` platforms** | `content/<slug>/derivatives/`, `review-queue.md` |
| Quote cards | inside `/atomize` | `npm run render -- --still` | extraction-first quote line + cost-first image model | `images/` |
| Video | `/video <file\|folder>` | `npm run render -- --render-video` | Grok script + 5–7 storyboard scenes/visual prompts; storyboard approved as TEXT before any render | `video/storyboard.md`, `video/short.mp4` |
| Review | **Muxin, by hand** | — | — | statuses in `review-queue.md` |
| Publish | `/publish` | `npm run publish:*` | — | Typefully drafts, YouTube upload, TikTok scheduled post (PostPeer), quote-card scheduled post (PostPeer/Upload-Post, `publish:cards`), `ready-to-paste/`, `publish-log.md`, `briefs/bets.md` Placed log |
| Whole cycle | `/cycle` | all of the above | orchestration | — |

## Build 2 — Fiction (composed prose, walled off)

Build 2 is the **opposite** of extraction-first: `/story` *composes* original fiction. Muxin is
the showrunner (world, characters, direction); Claude drafts the prose and holds consistency.
Two drafting modes, set per series in `series.yaml` `prose:`: **claude-native** (default, no API
key, Opus plans the beats and a Sonnet/Haiku writer subagent drafts) or an external **`prose`
provider** (e.g. `grok-openrouter`) via `npm run story:draft` when a key is configured. This composition is allowed **only because every
chapter is reviewed and approved by Muxin on a GitHub PR before it publishes, and nothing
auto-publishes** — the same principle as the video-script exception (rule 1), extended to a
whole build. It must never bleed back into Build 0/1: text/image derivatives stay
extraction-first.

- **Rule 5 does not apply to fiction, except the em-dash ban.** `config/voice.yaml` (Muxin's
  nonfiction PM voice) governs Builds 0/1 only. Fiction is governed by `config/fiction/craft.md`
  + `config/fiction/style.yaml` (and per-series `narrative:` overrides). The one rule that
  carries over: **no em dashes** (Muxin's house rule, fiction included). The fiction guards
  strip them like `voice.yaml` does for nonfiction.
- **Consistency model:** `bible.md` (living world/character reference) + `canon.md` (append-only
  ledger of established facts, updated on lock) + `characters/<name>.md` sheets + loose
  `outline.md`. The plot may evolve; established canon must not silently break.
- **Review loop = GitHub PR, one per chapter.** Muxin comments on lines/ranges (mobile-friendly
  comment bubbles); `/story --revise` makes **surgical edits to only the commented passages**,
  replies on threads, pushes. Never rewrite unannotated prose. Approve → `/story lock`.
- **Skills/scripts:** `/story` (new series, draft chapter, revise from PR comments, lock) and
  `/illustrate` (character fan-art variants + optional consistent-style scene art). Scripts:
  `npm run story:new | story:context | story:draft | story:validate | story:lock | story:illustrate`.
- **Promotion reuses Builds 0/1:** a locked chapter can feed `/atomize` (teaser quoting a real
  excerpt + cliffhanger) and `/video` to drive subscriptions — those quote published prose, so
  they stay extraction-first.

| Step | Trigger | Script(s) | Claude judgment | Output |
|---|---|---|---|---|
| New series | `/story new <notes>` | `npm run story:new` | structure notes → bible + character sheets + outline | `stories/<slug>/` |
| Draft chapter | `/story <series>` | `npm run story:context`, `npm run story:draft`, `npm run story:validate` | beat sheet, QC for page-turner craft + canon consistency, set title | `chapters/chapter-NN.md`, draft PR |
| Revise | PR comments / `/story --revise` | `npm run story:validate` | surgical edits to commented passages only; reply on threads | updated chapter, PR pushes |
| Lock | `/story lock` (after approve) | `npm run story:lock` | continuity entry, character-state updates | `canon.md`, `ready-to-paste/chapter-NN.txt` |
| Illustrate | `/illustrate <series>` | `npm run story:illustrate` | fan-art styles / scene prompts; cost-first model | `illustrations/` |

## Conventions

- TypeScript ESM, run with `tsx`. No build step.
- Provider adapters live in `src/providers/<capability>/<name>.ts`, selected in
  `config/providers.yaml`. Every adapter returns `costUsd`; costs append to `data/cost-log.csv`.
- Content folders: `content/<YYYY-MM-DD>-<slug>/` with `source.md`, `derivatives/`, `images/`,
  `video/`, `ready-to-paste/`, `review-queue.md`, `publish-log.md`.
- Fiction series (Build 2): `stories/<slug>/` with `series.yaml`, `bible.md`, `outline.md`,
  `canon.md`, `characters/`, `chapters/`, `illustrations/`, `ready-to-paste/`. Chapters are
  written one sentence per line so GitHub PR comments anchor to a passage. `config/fiction/`
  holds the craft + style guards (the fiction equivalent of `config/voice.yaml`).
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
  post/platform/PT-day and ≤ `posts_per_week` across runs and streams. Cards (`quote-card` cadence)
  also de-conflict against each platform they fan out to. Edit `config/platforms.yaml` to change
  cadence — Typefully gets explicit times, not its "next-free-slot"; TikTok still honors
  `TIKTOK_SCHEDULE_AT` as a manual one-off override.
- Secrets in `.env` only (see `.env.example`). Never commit `.env` or `data/analytics.db`.
