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
     `text-polish` provider, in `/atomize` step 7a) drafts a hook-driven script from the essay's
     *ideas* — not verbatim-traced. This is allowed ONLY because every storyboard is reviewed and
     approved by Muxin in `review-queue.md` *before* any render, and nothing auto-publishes. The
     exception is video scripts only; it must never bleed into text/image derivatives.
2. **Nothing publishes without review.** `/publish` acts only on rows Muxin set to `approve` in
   `review-queue.md`. Text posts go to Typefully as scheduled drafts, never instant posts.
3. **No browser automation for posting.** Official APIs (Typefully, YouTube, AT Protocol) or
   ready-to-paste files only.
4. **Discrete verifiable outputs.** Every pipeline step writes a file or DB rows that can be
   inspected. Scripts do deterministic work; Claude does judgment (tagging, synthesis,
   extraction, scoring) inline while running skills.

## Pipeline map

| Step | Trigger | Script(s) | Claude judgment | Output |
|---|---|---|---|---|
| Ingest analytics | files in `data/inbox/` | `npm run ingest`, `npm run bluesky` | — | rows in `data/analytics.db` |
| Tag pillars | untagged posts exist | `npm run snapshot -- --untagged`, `tsx src/db/tag-posts.ts` | assign pillar per post (rubric: `config/pillars.yaml`) | `posts.pillar` |
| Strategy | `/strategy` (weekly) | `npm run snapshot`, `npm run resonance` | synthesize brief, cite real posts | `briefs/YYYY-MM-DD-strategy-brief.md` |
| Atomize | `/atomize <url\|file>` | `npm run new-content`, `npm run validate` | extraction-first drafting + scoring | `content/<slug>/derivatives/`, `review-queue.md` |
| Assets | inside `/atomize` | `npm run render` | storyboard scenes + visual prompts (video script drafted by Grok); approved before render | `images/`, `video/storyboard.md`, `video/` |
| Review | **Muxin, by hand** | — | — | statuses in `review-queue.md` |
| Publish | `/publish` | `npm run publish:*` | — | Typefully drafts, YouTube upload, `ready-to-paste/`, `publish-log.md` |
| Whole cycle | `/cycle` | all of the above | orchestration | — |

## Conventions

- TypeScript ESM, run with `tsx`. No build step.
- Provider adapters live in `src/providers/<capability>/<name>.ts`, selected in
  `config/providers.yaml`. Every adapter returns `costUsd`; costs append to `data/cost-log.csv`.
- Content folders: `content/<YYYY-MM-DD>-<slug>/` with `source.md`, `derivatives/`, `images/`,
  `video/`, `ready-to-paste/`, `review-queue.md`, `publish-log.md`.
- `data/community-log.md` is Muxin's append-only manual observation log — read it during
  `/strategy`, never edit it.
- Channels with <4 weeks of data must be flagged INSUFFICIENT in briefs (computed by
  `snapshot.ts`, not by judgment).
- Secrets in `.env` only (see `.env.example`). Never commit `.env` or `data/analytics.db`.
