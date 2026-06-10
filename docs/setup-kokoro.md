# Local voiceover: Kokoro TTS + Whisper captions

The video pipeline defaults to **Kokoro** (free, local, 54 voices) for voiceover. Kokoro
doesn't emit timestamps, so captions come from a **whisper.cpp** forced-alignment pass on the
rendered audio. This is three local installs (Kokoro + whisper.cpp + ffmpeg) — the tradeoff for
$0 voice. If the quality disappoints, switch back to ElevenLabs in one line (bottom of this doc).

## 1. Kokoro (voice)

Two ways to run it — pick one.

### Option A — kokoro-fastapi server (recommended)

OpenAI-compatible HTTP server. Easiest via Docker:

```bash
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
# (or the :latest GPU image if you have CUDA)
```

Then in `.env` (defaults already match):

```
KOKORO_MODE=server
KOKORO_URL=http://localhost:8880/v1/audio/speech
KOKORO_VOICE=af_heart
```

Browse voices at `http://localhost:8880/v1/audio/voices`. The adapter posts
`{ model: "kokoro", voice, input, response_format: "mp3" }` and writes the mp3.

### Option B — CLI wrapper

If you'd rather run Kokoro via a local script (e.g. wrapping `kokoro-onnx`), set:

```
KOKORO_MODE=cli
KOKORO_CMD=/path/to/your/kokoro-wrapper
```

The wrapper is invoked as `KOKORO_CMD "<script text>" "<output.mp3>"` and must write the mp3 to
that second-argument path.

## 2. whisper.cpp (captions)

Build the binary and download a model:

```bash
git clone https://github.com/ggerganov/whisper.cpp && cd whisper.cpp
cmake -B build && cmake --build build --config Release   # produces build/bin/whisper-cli
sh ./models/download-ggml-model.sh base.en               # ~150MB; medium.en is more accurate, larger
```

In `.env`:

```
WHISPER_BACKEND=whispercpp
WHISPER_CPP_BIN=/path/to/whisper.cpp/build/bin/whisper-cli   # or just "whisper-cli" if on PATH
WHISPER_CPP_MODEL=/path/to/whisper.cpp/models/ggml-base.en.bin
```

The alignment step (`src/video/align.ts`) transcodes the mp3 to 16kHz mono WAV with ffmpeg, runs
whisper.cpp with `-ml 1` (token-level timing) and `-oj` (JSON), and synthesizes character
timestamps from the token offsets — feeding the existing caption builder unchanged.

## 3. ffmpeg

```bash
brew install ffmpeg     # macOS
```

Must be on PATH (used to transcode audio for whisper.cpp).

## Switching back to ElevenLabs

If Kokoro's voice quality isn't good enough, edit `config/providers.yaml`:

```yaml
tts: elevenlabs
```

Set `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` in `.env`. ElevenLabs returns character
timestamps directly, so the Whisper/ffmpeg steps above are skipped entirely.
