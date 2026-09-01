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
2. Edit the existing local `.env` and add credentials **as you need them**, not all at once. The
   repository intentionally keeps one gitignored credential file rather than a second template:

   | Key | Needed for | When |
   |---|---|---|
   | *(none)* | Analytics import + strategy briefs + text derivatives | works today |
   | `BLUESKY_HANDLE` / `BLUESKY_APP_PASSWORD` | auto-fetch Bluesky stats | 2 min, do early |
   | *(subscription CLIs)* | Claude, Grok, and GPT/Codex model selections in Studio | sign in to each installed CLI; no API key here |
   | `OPENROUTER_API_KEY` | Kling video interpolation only | temporarily, when rendering generated video |
   | *local video tools* | voiceover (Kokoro) + captions (whisper.cpp) — no API key, but installs | when you want video — see `docs/setup-kokoro.md` |
   | *yt-dlp* | reading YouTube transcripts into the pattern corpus (no API key). Install with `brew install yt-dlp` | when you run `/patterns collect` on YouTube |
   | `TYPEFULLY_API_KEY` | scheduled posting to X + LinkedIn + Bluesky | when ready to publish — see `docs/setup-typefully.md` |
   | `YOUTUBE_*` | auto-upload Shorts | with video — see `docs/setup-youtube-oauth.md` |
   | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | *fallback* voiceover if you don't like Kokoro | only if you swap `tts: elevenlabs` in `config/providers.yaml` |

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
`npm run ingest:outcomes -- --brand <human-inference|charles|fiction> --input <reviewed-facts.json>`,
`npm run bluesky`, `npm run snapshot`, `npm run resonance`, `npm run render`, `npm run publish:*`.
Outcome imports accept the documented funnel/business envelope, reject body or PII fields, and append
validated facts to the canonical operational ledger. Signals then shows landing visits, opt-ins, and
business-event counts for the selected brand; unassigned historical rows remain excluded. Use
`--json <json-string>` instead of `--input <file>` when supplying the same envelope inline.

## Verification and delivery

This is a private, local-first tool, not a deployed web application. Run
`npm run check` locally before merging. Merging to `main` is the repository's
delivery event; use the commands above from the local checkout afterward.

There is no Vercel production project for this repository, so it intentionally
has no `vercel.json` and no production deployment workflow. The ordinary CI
workflow is manual-only for deliberate diagnostics. Hosted automation is
reserved for the existing security scan and scheduled advisory dependency
work. See `.repo-policy/README.md` for the full policy and the requirements
that apply if a production deployment is added later.

## Video: essay → auto-short

Text + image posts work today with no extra setup. Video is the part that needs a one-time
install, because voiceover runs **locally and free** (Kokoro) instead of a paid API.

**How the video flow works** (the point: you steer with words, not by dictating every shot):

1. `/atomize <your essay>` — the selected subscription-backed model drafts a 60–90s hook-driven script, then Claude storyboards
   it into 5–7 scenes (one visual per scene, styled from `config/style.yaml`) and writes
   `content/<slug>/video/storyboard.md`. **It stops here. Nothing is generated yet.**
2. **You read the storyboard as text** (~30 sec) — the cheap checkpoint. Edit any scene, then
   set the `storyboard` row in `review-queue.md` to `approve` (or `revise` + a note).
3. Generate strong scene art in an attended Codex session, review it, and supply the approved files.
   `npm run render -- --render-video content/<slug>` then creates the voiceover, captions, and final
   9:16 MP4 + thumbnail. Unattended image generation is disabled until a reviewed-file attachment
   step is wired. (Claude runs this for
   you once you approve; it refuses to run while the storyboard is still `pending`.)

Bad scene direction costs nothing to fix (it's just text); a bad image costs ~$0.02; voice is
free. Video scripts are the one place the system writes *for* you — it drafts from your essay's
ideas, and you approve every storyboard before anything renders.

**One-time video setup** — follow `docs/setup-kokoro.md`. In short:
- Set `OPENROUTER_API_KEY` only while Kling remains the production video interpolator.
- Run **Kokoro** for voiceover — easiest is one Docker command (kokoro-fastapi).
- Install **whisper.cpp** (+ a model) and **ffmpeg** — these turn the voiceover into
  word-by-word captions. (Kokoro doesn't emit timing; whisper.cpp recovers it.)
- Don't like Kokoro's voice? Set `tts: elevenlabs` in `config/providers.yaml`, add
  `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`, and the whisper/ffmpeg steps are skipped.

Until the video tools are installed, `/atomize` still does text + images and notes video as
skipped in the review queue.

## Costs (steady state)

- Typefully paid plan (API access) — you've opted in
- Claude, Grok, GPT/Codex text work — existing subscriptions through their local CLIs
- Image generation — attended Codex generation and reviewed file handoff; no image API key
- OpenRouter — Kling video interpolation only, temporarily
- Voiceover — **free** (Kokoro runs locally); ElevenLabs ~$6/mo only if you swap to it
- Everything else (Remotion, whisper.cpp, Bluesky, YouTube, this repo) — free
- Every generated dollar is logged in `data/cost-log.csv`

## When something breaks

- **Import fails listing columns** → the platform changed its export format; the error names
  the file and columns. Tell Claude: "the X export format changed, here's the error."
- **Typefully 402** → API needs the paid plan / account paused (`docs/setup-typefully.md`).
- Every generated dollar is logged in `data/cost-log.csv`.
