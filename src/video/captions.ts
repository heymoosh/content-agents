// Convert character-level TTS alignment into word-level captions for @remotion/captions.
// Caption shape matches @remotion/captions: { text, startMs, endMs, timestampMs, confidence }.
// Word text carries a leading space (TikTok-caption convention used by createTikTokStyleCaptions).

export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
}

export function charsToWordCaptions(
  chars: { char: string; startMs: number; endMs: number }[]
): Caption[] {
  const captions: Caption[] = [];
  let word = "";
  let startMs = 0;
  let endMs = 0;

  const flush = () => {
    if (word.trim() === "") {
      word = "";
      return;
    }
    captions.push({
      text: (captions.length === 0 ? "" : " ") + word.trim(),
      startMs,
      endMs,
      timestampMs: Math.round((startMs + endMs) / 2),
      confidence: 1,
    });
    word = "";
  };

  for (const c of chars) {
    if (/\s/.test(c.char)) {
      flush();
      continue;
    }
    if (word === "") startMs = c.startMs;
    word += c.char;
    endMs = c.endMs;
  }
  flush();
  return captions;
}
