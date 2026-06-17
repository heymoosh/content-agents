# content-agents

Two connected systems for Muxin Li's content operation, orchestrated by Claude Code:

- **Build 0 — Strategy Intelligence**: analytics in → SQLite → weekly strategy brief (`briefs/`)
- **Build 1 — Atomization**: original content + brief → platform assets (text, images, video) → human review → publish

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
   YouTube, AT Protocol, PostPeer for TikTok) or ready-to-paste files only.
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
| Strategy | `/strategy` (weekly) | `npm run grade-bets`, `npm run snapshot`, `npm run resonance`, `npm run link-bet`, `npm run route -- --all` | grade last cycle's bets, synthesize brief citing real posts, record new bets | `briefs/YYYY-MM-DD-strategy-brief.md`, `briefs/bets.md` |
| Route | inside `/atomize` (+ `/strategy`) | `npm run route` | pillar tag drives it; Muxin still approves what's queued | `content/<slug>/routing.md` |
| Atomize | `/atomize <url\|file>` | `npm run new-content`, `npm run validate` | extraction-first drafting + scoring (text posts + quote cards); record `from_brief`/`directives_applied`; **only for routing `include` platforms** | `content/<slug>/derivatives/`, `review-queue.md` |
| Quote cards | inside `/atomize` | `npm run render -- --still` | extraction-first quote line + cost-first image model | `images/` |
| Video | `/video <file\|folder>` | `npm run render -- --render-video` | Grok script + 5–7 storyboard scenes/visual prompts; storyboard approved as TEXT before any render | `video/storyboard.md`, `video/short.mp4` |
| Review | **Muxin, by hand** | — | — | statuses in `review-queue.md` |
| Publish | `/publish` | `npm run publish:*` | — | Typefully drafts, YouTube upload, TikTok scheduled post (PostPeer), `ready-to-paste/`, `publish-log.md`, `briefs/bets.md` Placed log |
| Whole cycle | `/cycle` | all of the above | orchestration | — |

## Conventions

- TypeScript ESM, run with `tsx`. No build step.
- Provider adapters live in `src/providers/<capability>/<name>.ts`, selected in
  `config/providers.yaml`. Every adapter returns `costUsd`; costs append to `data/cost-log.csv`.
- Content folders: `content/<YYYY-MM-DD>-<slug>/` with `source.md`, `derivatives/`, `images/`,
  `video/`, `ready-to-paste/`, `review-queue.md`, `publish-log.md`.
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
- Secrets in `.env` only (see `.env.example`). Never commit `.env` or `data/analytics.db`.
