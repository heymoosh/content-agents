// Prose formatting helpers shared by draft (split → one sentence per line for line-level PR
// review) and lock (rejoin → flowing paragraphs for the Substack paste).

// Split a paragraph into sentences. Heuristic, tuned to not break on common abbreviations or
// mid-sentence quotes; good enough for review formatting (the author fixes the rare miss).
const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|St|Sr|Jr|vs|etc|Inc|Ltd|No|Mt)\.$/i;

function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  let buf = "";
  const tokens = paragraph.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    buf += tokens[i];
    const isSpace = /^\s+$/.test(tokens[i]);
    if (!isSpace) continue;
    const word = buf.trimEnd();
    // A sentence ends on . ! ? optionally followed by a closing quote/paren, and the NEXT
    // non-space token starts with a capital or opening quote.
    const endsSentence = /[.!?]["'”’\)\]]?$/.test(word) && !ABBREV.test(word);
    const next = tokens.slice(i + 1).find((t) => !/^\s+$/.test(t));
    const nextStartsNew = !next || /^["'“‘(\[]?[A-Z0-9]/.test(next);
    if (endsSentence && nextStartsNew) {
      out.push(word);
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// One sentence per line; blank line between paragraphs preserved.
export function oneSentencePerLine(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return paragraphs
    .map((p) => splitSentences(p.replace(/\s*\n\s*/g, " ").trim()).join("\n"))
    .join("\n\n")
    .trim();
}

// Reverse: rejoin one-sentence-per-line back into flowing paragraphs for publishing.
export function reflowParagraphs(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return paragraphs
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

// How many sentences are crammed on a single line — used by validate to enforce the
// one-per-line format (tolerant: dialogue lines can legitimately hold 2 short sentences).
export function sentencesOnLine(line: string): number {
  return splitSentences(line.trim()).length;
}
