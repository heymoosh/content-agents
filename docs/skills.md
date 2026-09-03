# content-agents skills reference

All Claude Code skills in this repo (`.claude/skills/`), one section each. Descriptions come
from each skill's own SKILL.md frontmatter; that file is always the source of truth.

| Skill | Build | One-liner |
|---|---|---|
| `/cycle` | all | The weekly ingest → strategy → atomize loop; review and publish belong to the Content room |
| `/strategy` | 0 | Weekly strategy brief from analytics data, grades last cycle's bets first |
| `/atomize` | 1 | One piece of content → text posts + quote cards + review queue |
| `/brand-lens` | 1 | Human Inference brand enforcement: proposes angles / flags drafts, never rewrites |
| `/video` | 1 | One piece of content → vertical short (script → storyboard → review → render) |
| `/publish` | 1 | Push approved review-queue rows out (Typefully, YouTube, TikTok, paste files) |
| `/bakeoff` | 1 | One prompt across many image models, scored on cost + quality |
| `/scout` | — | Web discovery: cited client/platform/content-example candidates into the outreach inbox |
| `/outreach` | — | Seeded lead → cited pitch report → human-reviewed, hand-locked message |
| `/story` | 2 | Serialized fiction, chapter by chapter, GitHub-PR review loop |
| `/illustrate` | 2 | Character fan-art + consistent in-chapter scene art for a fiction series |

## `/cycle`

Run one weekly content cycle: ingest analytics, refresh the strategy brief, atomize new content.
Pure orchestration; every step delegates to its own skill or script and stops at every human
checkpoint. Review and publish are the Content room's, not `/cycle`'s — it retired those steps so
there is one approve-and-publish surface, not two.

**Usage:** `/cycle`

## `/strategy` (Build 0)

Produce `briefs/<today>-strategy-brief.md` from the analytics DB + community log. Grades last
cycle's bets (`briefs/bets.md`, `npm run grade-bets`) before recommending anything new; every
claim must cite a real post or number. Written in Muxin's voice, no AI tells.

**Usage:** `/strategy` (run after ingesting fresh analytics, or via `/cycle`)

## `/atomize` (Build 1)

Atomize one piece of Muxin's original content into cheap platform assets (text posts + quote
cards) and a review queue. Proposes cut/version options from the same inspiration before
formatting anything (step 1.5); every cut's text is Muxin's own. Extraction-first: derivatives
are verbatim-trimmed, never composed. Video is the separate `/video` skill.

**Usage:**
- `/atomize <substack-url | file | audio-file | pasted text>`
- `/atomize notes` — spread your Substack Notes
- `/atomize --no-spin <arg>` — strict verbatim, no audience spin
- `/atomize --continue <content-folder> [--cut <lens>]` — resume on a scaffolded folder or cut
- `/atomize --revise <content-folder>`

## `/brand-lens` (Build 1)

The enforcement layer for the Human Inference brand. Muxin generates ideas and drafts
naturally; this skill runs the brand lens against a source or a draft and PROPOSES changes.
Hard rule: it never rewrites. Inspiration mode (source/idea in) proposes 2-4 angles; draft mode
(something Muxin wrote in) flags where brand elements are missing or buried. Checks against
`config/brand.yaml`. Opt-in only.

**Usage:** `/brand-lens <url | file | content-folder | pasted text | topic>`

## `/video` (Build 1)

Turn one piece of content into a vertical short: script → storyboard → review → render. The
deliberate, heavier path split out of `/atomize`. The spoken script is the one scoped exception
to extraction-first; the storyboard is approved as text before any render.

**Usage:** `/video <content-folder | substack-url | file | audio-file | text>`,
`/video --revise <content-folder>`

## `/publish` (Build 1)

Act on `<folder>/review-queue.md`: publish ONLY rows Muxin set to `approve`. Typefully
scheduled drafts (X/LinkedIn/Bluesky), YouTube Short upload, TikTok scheduled post (PostPeer),
quote-card image posts, ready-to-paste files. Logs to `publish-log.md` and the bets ledger.

**Usage:** `/publish <content-folder>`

## `/bakeoff` (Build 1)

Image-gen bakeoff: run one prompt across many image models (via OpenRouter) plus a free local
Remotion/SVG contender, view side by side, score, and pick winners on price vs. quality.
Contenders live in `config/bakeoff.yaml`.

**Usage:** `/bakeoff "<prompt>" [--aspect 1:1]`

## `/scout`

Web-discovery agent that finds real, cited candidates for the outreach/discovery inbox:
clients and platforms worth pitching, and real-world examples worth writing about
(`content-example` leads feed `/brand-lens` Inspiration mode). Discovery only, never action;
everything lands in the review GUI's Outreach tab for Muxin to pursue or pass.

**Usage:** `/scout [--kinds client,platform,content-example] [--theme "..."] [--limit N]`

## `/outreach`

The outreach engine (`docs/outreach-engine-plan.md`): turn a seeded company or platform into a
cited, classified pitch report, then (once qualified) a drafted message Muxin reviews and locks
by hand. No discovery, no sending — no send path exists anywhere in the repo.

**Usage:**
- `/outreach add` (manual or `--from-jsa`; client or platform kind)
- `/outreach research <lead-folder>`
- `/outreach qualify <lead-folder>`
- `/outreach draft <lead-folder>`
- `/outreach lock <message-file>`
- `/outreach status [--targets]`

## `/story` (Build 2)

Write and revise an original fiction series one chapter at a time, with a story bible + canon,
illustrations, and a GitHub-PR review loop. The one place AI composes original prose, walled
off from Builds 0/1; every chapter is approved on a PR before anything publishes.

**Usage:**
- `/story new <notes-file | paste>`
- `/story <series> [next | --chapter N]`
- `/story --revise <series> <chapter>`
- `/story lock <series> <chapter>`

## `/illustrate` (Build 2)

Illustrate a fiction series. Two tracks: character fan-art variants (one description, many
styles) for social promo, and optional consistent-style in-chapter scene art using locked
character references. Cost-first model policy (Riverflow default, escalate only on request).

**Usage:** `/illustrate <series> (character <name> | scene <chapter>)`
