// One HTML entity decoder for every ingest path that turns fetched markup into the plain text
// that becomes extraction-first ground truth (source.md, a collected pattern sample, a
// transcript). Before this existed each caller hand-rolled a five-or-six entity `.replace`
// chain, so Substack's smart punctuation and every accented character survived into the text
// verbatim: the 2026-09-02 live base-loop run pulled one real essay and found 119 undecoded
// references in it (`&#8217;` x69, `&#8220;`/`&#8221;` x46, and `&#233;`/`&#232;`/`&#237;` inside
// a real person's name). A derivative quotes source.md line for line, so anything left encoded
// here ships to a platform encoded.
//
// Two properties the old chains did not have:
//   - Numeric references, decimal and hex, are decoded. That is where smart quotes and accents
//     actually live in Substack's RSS.
//   - Decoding is ONE pass. A sequential chain decodes `&amp;lt;` to `<` because the output of
//     the `&amp;` step is re-read by the `&lt;` step; a single scan leaves it as the literal
//     `&lt;` the author wrote.

// HTML4 Latin-1 names, code points 160-255 in order. Written as a list because the block is
// contiguous and a 96-entry object literal is only noise.
const LATIN1 =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy " +
  "reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo " +
  "frac14 frac12 frac34 iquest " +
  "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute " +
  "Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml " +
  "Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc " +
  "euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash " +
  "ugrave uacute ucirc uuml yacute thorn yuml";

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  // Punctuation an editorial feed actually emits.
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", sbquo: "‚",
  ldquo: "“", rdquo: "”", bdquo: "„", dagger: "†", Dagger: "‡",
  bull: "•", hellip: "…", permil: "‰", prime: "′", Prime: "″",
  lsaquo: "‹", rsaquo: "›", oline: "‾", frasl: "⁄", euro: "€",
  trade: "™", larr: "←", uarr: "↑", rarr: "→", darr: "↓",
  harr: "↔", ensp: " ", emsp: " ", thinsp: " ",
};
const LATIN1_NAMES = LATIN1.split(" ");
// 160..255 inclusive. Asserted because the block is written out by hand and a single missing
// name (`reg`, the first time) silently shifts every later letter — `&eacute;` decoded to "è".
if (LATIN1_NAMES.length !== 96) throw new Error(`latin-1 entity table is ${LATIN1_NAMES.length} names, expected 96`);
LATIN1_NAMES.forEach((name, i) => { NAMED[name] = String.fromCodePoint(160 + i); });

// Windows-1252 bytes smuggled in as numeric references. Authoring tools emit `&#146;` for a
// right single quote; the raw code point is an unprintable C1 control, so the browser rule is to
// map 128-159 through cp1252 instead. Unmapped slots stay undecoded rather than becoming junk (enforced in fromCodePoint below).
const CP1252: Record<number, number> = {
  128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026, 134: 0x2020, 135: 0x2021,
  136: 0x02c6, 137: 0x2030, 138: 0x0160, 139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018,
  146: 0x2019, 147: 0x201c, 148: 0x201d, 149: 0x2022, 150: 0x2013, 151: 0x2014, 152: 0x02dc,
  153: 0x2122, 154: 0x0161, 155: 0x203a, 156: 0x0153, 158: 0x017e, 159: 0x0178,
};

function fromCodePoint(raw: number): string | null {
  const cp = CP1252[raw] ?? raw;
  // Surrogates and out-of-range values have no character to become. Leave the reference alone
  // rather than substituting U+FFFD, so a malformed input stays visible instead of silently
  // turning into a replacement character inside Muxin's text.
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return null;
  if (cp >= 0xd800 && cp <= 0xdfff) return null;
  // Control characters, the same way: invisible junk in a file that is quoted verbatim. This
  // covers the C1 slots cp1252 does NOT map (129, 141, 143, 144, 157) as well as `&#8;`, which
  // would otherwise plant a backspace in source.md. Tab, newline and carriage return are real
  // text and stay.
  if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) return null;
  if (cp >= 0x7f && cp <= 0x9f) return null;
  return String.fromCodePoint(cp);
}

/**
 * Decode HTML character references in one left-to-right pass. Unknown or malformed references
 * are returned untouched — this text is quoted verbatim downstream, so dropping something we
 * could not read would be worse than leaving it readable.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const digits = hex ? body.slice(2) : body.slice(1);
      const parsed = Number.parseInt(digits, hex ? 16 : 10);
      return fromCodePoint(parsed) ?? match;
    }
    return NAMED[body] ?? match;
  });
}
