# content-agents

Your content operation, run by Claude Code:

- **Build 0 — Strategy**: you drop in analytics exports → it tells you what's working and what to double down on.
- **Build 1 — Atomization**: you write an essay (or record a voice memo) → it produces the X/LinkedIn/Bluesky/community posts, quote cards, and videos → you approve → it schedules/uploads them.

You are the author and the editor. The system never writes in your voice (it quotes and trims your own sentences), and nothing is published without your approval in a review queue.

## How to use this (important)

Open **Claude Code inside this folder** (`~/Documents/GitHub/content-agents`). The commands
below (`/cycle`, `/strategy`, `/atomize`, `/publish`) are **project skills** — they only exist
when Claude Code is running in this repo. Everything (data, content, briefs) lives in this
folder too. One window, one folder, that's the whole system.

## One-time setup (in this order)

1. `npm install` (already done if Claude built this on your machine)
2. `cp .env.example .env` — then add keys **as you need them**, not all at once:

   | Key | Needed for | When |
   |---|---|---|
   | *(none)* | Analytics import + strategy briefs + text derivatives | works today |
   | `BLUESKY_HANDLE` / `BLUESKY_APP_PASSWORD` | auto-fetch Bluesky stats | 2 min, do early |
   | `GEMINI_API_KEY` | quote-card backgrounds, video images, voice-memo transcription | when you want images |
   | `TYPEFULLY_API_KEY` | scheduled posting to X + LinkedIn + Bluesky | when ready to publish — see `docs/setup-typefully.md` |
   | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | video voiceover | when/if you settle on the video stack |
   | `YOUTUBE_*` | auto-upload Shorts | with video — see `docs/setup-youtube-oauth.md` |

3. Connect your accounts inside Typefully once (X, LinkedIn, Bluesky) — that's what makes
   one API cover three platforms.

## The weekly routine (~30–40 min, all judgment)

1. **Export analytics** (~10 min, every 1–2 weeks): X, LinkedIn, Substack → drop the files
   into `data/inbox/<platform>/`. Exact clicks: `docs/analytics-export-howto.md`.
2. **Run `/cycle`** in Claude Code. It imports the data, refreshes the strategy brief
   (`briefs/`), asks if you have new content to atomize, and lists anything waiting on you.
3. **Write your thing** as usual (Substack, voice memo, build log). Atomize it:
   `/atomize https://yoursubstack.substack.com/p/your-post` (or a file path, or a `.m4a`).
4. **Review**: open `content/<date>-<slug>/review-queue.md`, set each row to
   `approve` / `revise` (add a note) / `discard`.
5. **`/publish content/<date>-<slug>`**: approved text posts → Typefully queue (you can still
   eyeball them there), video → YouTube as private (flip to public in Studio), community +
   Substack teasers → `ready-to-paste/` files you paste when convenient.
6. **As it happens**: after posting in a community, add a 30-second note to
   `data/community-log.md` — that's the only signal `/strategy` gets about communities.

## Commands

| Command | What it does |
|---|---|
| `/cycle` | The weekly everything: ingest → strategy → atomize prompts → review reminders → publish offer |
| `/strategy` | Just regenerate the strategy brief from current data |
| `/atomize <url\|file>` | Just atomize one piece of content (stops at the review queue) |
| `/atomize --revise <folder>` | Re-draft the rows you marked `revise`, using your notes |
| `/publish <folder>` | Act on `approve` rows only |

Plain scripts (Claude runs these for you, but they work standalone): `npm run ingest`,
`npm run bluesky`, `npm run snapshot`, `npm run resonance`, `npm run render`, `npm run publish:*`.

## Video status

Text + image posts work end-to-end today. The video pipeline is **built and tested**
(Remotion render: 9:16, AI voiceover, word-by-word captions, generated B-roll, ~$0.15–0.30
per video) but voiceover needs a TTS provider — currently wired for ElevenLabs, swappable in
`config/providers.yaml` + one adapter file if you choose a different stack. Remotion itself
is HTML/CSS/React-based rendering, so it composes with whatever direction you land on.
Until then, `/atomize` simply skips video and notes it in the review queue.

## Costs (steady state)

- Typefully paid plan (API access) — you've opted in
- ElevenLabs ~$6/mo — only when video starts
- Gemini pay-per-use — pennies (images $0.02 each)
- Everything else (Remotion, Bluesky, YouTube, this repo) — free

## When something breaks

- **Import fails listing columns** → the platform changed its export format; the error names
  the file and columns. Tell Claude: "the X export format changed, here's the error."
- **Typefully 402** → API needs the paid plan / account paused (`docs/setup-typefully.md`).
- Every generated dollar is logged in `data/cost-log.csv`.
