#!/usr/bin/env python3
"""Local Kokoro-ONNX voiceover for the content-agents video pipeline.

Invoked by the repo's TTS adapter when KOKORO_MODE=cli (see src/providers/tts/kokoro.ts):

    kokoro-tts "<script text>" "<output.mp3>"

Generates speech locally (no network, $0) with Kokoro-ONNX and writes an mp3 to the
second argument. Model/voice paths come from env with sensible defaults under
~/.content-agents/kokoro (override via KOKORO_ONNX_MODEL / KOKORO_ONNX_VOICES).
"""
import os
import sys
import subprocess
import tempfile
from pathlib import Path

BASE = Path(os.environ.get("KOKORO_HOME", Path.home() / ".content-agents" / "kokoro"))
MODEL = os.environ.get("KOKORO_ONNX_MODEL", str(BASE / "kokoro-v1.0.onnx"))
VOICES = os.environ.get("KOKORO_ONNX_VOICES", str(BASE / "voices-v1.0.bin"))
VOICE = os.environ.get("KOKORO_VOICE", "af_heart")
SPEED = float(os.environ.get("KOKORO_SPEED", "1.0"))
LANG = os.environ.get("KOKORO_LANG", "en-us")


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit('usage: kokoro-tts "<text>" "<output.mp3>"')
    text, out_path = sys.argv[1], sys.argv[2]
    if not text.strip():
        sys.exit("kokoro-tts: empty text")

    # Point phonemizer at the pip-bundled espeak-ng (no system install needed).
    try:
        import espeakng_loader
        from phonemizer.backend.espeak.wrapper import EspeakWrapper

        EspeakWrapper.set_library(espeakng_loader.get_library_path())
        EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
    except Exception:
        pass  # newer kokoro-onnx configures this itself

    from kokoro_onnx import Kokoro

    kokoro = Kokoro(MODEL, VOICES)
    samples, sample_rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang=LANG)

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    import soundfile as sf

    tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    try:
        sf.write(tmp_wav, samples, sample_rate)
        # The render pipeline expects an mp3; encode with ffmpeg (already a pipeline dep).
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp_wav, str(out)],
            check=True,
        )
    finally:
        os.unlink(tmp_wav)


if __name__ == "__main__":
    main()
