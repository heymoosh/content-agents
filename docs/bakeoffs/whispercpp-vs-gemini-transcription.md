# Bakeoff: whisper.cpp vs Gemini for voice-memo transcription

Card: "Bakeoff: whisper.cpp vs Gemini for voice-memo transcription." `config/providers.yaml`'s
`transcription: gemini` is a deliberate paid opt-in (CLAUDE.md rule 6). This doc covers what got
built and an engineering smoke test — **not** the real-accuracy verdict, which needs a real
Muxin voice memo (see OPEN section below).

## What was built

- `src/providers/transcription/whispercpp.ts` — a `TranscriptionProvider` adapter (same interface
  as `src/providers/transcription/gemini.ts`, `src/providers/types.ts`). Reuses the exact
  whisper.cpp invocation already proven in `src/video/align.ts`'s `whisperCppAlign()`: transcode
  via `ffmpeg -y -i <audio> -ar 16000 -ac 1 <wav>`, then `whisper-cli -m <model> -f <wav> -ml 1
  -oj -of <outBase>`, parsing `<outBase>.json`'s `transcription[]` array. Unlike `align.ts`, it
  does not synthesize char-level timestamps (alignment-specific, not needed for a plain
  transcript) — it concatenates each segment's trimmed `text` into one string
  (`joinTranscript()`). Reads `WHISPER_CPP_BIN` (default `whisper-cli`) and `WHISPER_CPP_MODEL`
  (throws if unset) from env. Always returns `costUsd: 0` (local, free) to satisfy the interface
  contract (CLAUDE.md rule 6).
- `src/bakeoff/transcription.ts` — a standalone comparison script (separate from
  `src/bakeoff/run.ts`, which is image-gen only). Runs one audio file through both the `gemini`
  and `whispercpp` adapters directly (not through the single-selection provider registry), times
  each call, logs cost to `data/cost-log.csv`, and writes `bakeoff/<run-id>/{results.json,
  comparison.md}` (that top-level `bakeoff/` dir is gitignored, same as the image bakeoff's
  output). One engine failing (e.g. a missing API key) doesn't abort the other. **No automated
  quality scorer** — transcription accuracy can only be judged by a human against what was
  actually said, so the script's job is to produce the side-by-side artifact, not a verdict.
  - Usage: `npm run bakeoff:transcription -- <audio-file> [--name run-id]`
- `config/providers.yaml`'s `transcription:` comment updated to note the adapter now exists and
  point at this doc + the run command. **The default itself was left unchanged**
  (`transcription: gemini`) — flipping it needs the real-memo eval below, which this run could
  not do.

## Synthetic-clip smoke test (engineering proof, not a quality verdict)

No real Muxin voice memo was available in this environment. To prove the adapter/script work
end-to-end (interface contract, cost tracking, latency, no crashes), a ~15-second clip was
synthesized locally with this repo's existing Kokoro-ONNX TTS wrapper (`scripts/kokoro-tts`, see
`docs/setup-kokoro.md`) from a few made-up but natural sentences:

> "Hey, quick voice memo before I forget. I think the strategy brief this week should lead with
> the Bluesky thread about builder culture, since it outperformed everything else by a wide
> margin. Also remind me to check the LinkedIn numbers before Friday."

Run via `npm run bakeoff:transcription -- <synthetic-clip>`:

| Engine | Status | Cost | Latency | Transcript |
|---|---|---|---|---|
| whispercpp | ok | $0.0000 | 6.4s | "Hey , quick voice memo before I forget . I think the strategy brief this week should lead with the blue sky thread about builder culture since it outper formed everything else by a wide margin . Also remind me to check the link in numbers before Friday ." |
| gemini | error | — | — | `GEMINI_API_KEY missing in .env` — this sandboxed run had no access to the repo's `.env` (a fresh git worktree doesn't inherit gitignored files, and copying the real `.env`'s live keys into the worktree was correctly blocked as a credential-leakage risk). The adapter's own guard-clause fired correctly on the missing key, which is itself a pass for that code path; a live authenticated call needs to run somewhere `.env` is naturally present (e.g. the main checkout, not a stripped worktree). |

**Result: engineering PASS.** whisper.cpp ran the real binary end-to-end (ffmpeg transcode →
whisper-cli → JSON parse → join), produced a non-empty, recognizable transcript, correctly
reported `$0` cost, and the intermediate `.wav`/`.json` files were cleaned up afterward. The
comparison script correctly isolated the Gemini failure (missing key) without crashing the whole
run and still wrote a valid `comparison.md`. Gemini's request/response wiring mirrors the
existing, already-in-production `src/providers/transcription/gemini.ts` (used today by
`/atomize`'s audio-memo path) — it was not independently exercised live in this run, only
structurally verified (typecheck + the guard-clause behavior above).

Two synthetic-audio quirks worth noting (whisper.cpp `base.en`, the smallest/fastest model):
"Bluesky" heard as "blue sky" and "LinkedIn" as "link in" — both brand names, both plausible
gaps for a small model on synthetic TTS speech. Not conclusive of anything on real audio; flagged
here only because it's exactly the kind of miss a human reviewer should watch for in the real
test below.

## OPEN — needs a real voice memo

**The card's real question — verbatim transcription accuracy on Muxin's actual voice memos —
is still unanswered.** A synthetic TTS clip cannot answer it: Kokoro's synthesized speech doesn't
carry Muxin's real accent, pacing, filler words, background noise, or the proper nouns/jargon he
actually uses, all of which are exactly what a transcription bakeoff needs to stress. Do not treat
the smoke test above as a quality result, and do not flip `config/providers.yaml`'s
`transcription:` default off the back of it.

**To close this out:** drop a real voice memo in `data/inbox/` (gitignored, safe for audio) and
run:

```
npm run bakeoff:transcription -- data/inbox/<memo-file>
```

Read both transcripts against what was actually said. If whisper.cpp is verbatim-acceptable,
flip `config/providers.yaml` to `transcription: whispercpp` (update the comment too) — that
removes the last paid-API dependency in the `/atomize` audio-memo path (CLAUDE.md rule 6). If
not, `transcription: gemini` stays the default and this doc should record why (which kinds of
misses were disqualifying).
