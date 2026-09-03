import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeHtmlEntities } from "./html-entities.js";

test("decodes the numeric references Substack's feed actually emits", () => {
  // The exact shapes counted in the 2026-09-02 live pull of "The world's broken. What do we do?":
  // 69 x &#8217;, 23 x &#8220;, 23 x &#8221;, and accented letters inside a real person's name.
  assert.equal(decodeHtmlEntities("I&#8217;ve been asking it myself"), "I’ve been asking it myself");
  assert.equal(decodeHtmlEntities("&#8220;leverage&#8221;"), "“leverage”");
  assert.equal(decodeHtmlEntities("&#8211;"), "–");
  assert.equal(decodeHtmlEntities("Andr&#233;s Guti&#232;rrez Mart&#237;n"), "Andrés Gutièrrez Martín");
});

test("decodes hex references and named references", () => {
  assert.equal(decodeHtmlEntities("&#x2019;&#X2014;"), "’—");
  assert.equal(decodeHtmlEntities("&rsquo;&mdash;&hellip;&eacute;&euro;&trade;"), "’—…é€™");
  assert.equal(decodeHtmlEntities("&amp;&lt;&gt;&quot;&apos;"), "&<>\"'");
});

test("decodes in one pass, so an escaped entity stays escaped", () => {
  // The old sequential chains decoded &amp; first and then re-read their own output, turning an
  // author writing about "&lt;" into a literal "<".
  assert.equal(decodeHtmlEntities("&amp;lt;div&amp;gt;"), "&lt;div&gt;");
  assert.equal(decodeHtmlEntities("&amp;amp;"), "&amp;");
});

test("maps Windows-1252 numeric references the way a browser does", () => {
  assert.equal(decodeHtmlEntities("don&#146;t &#147;quote&#148; me&#133;"), "don’t “quote” me…");
});

test("leaves unreadable or unknown references exactly as written", () => {
  assert.equal(decodeHtmlEntities("&notanentity; &#; &#xZZ; &"), "&notanentity; &#; &#xZZ; &");
  assert.equal(decodeHtmlEntities("&#55296;"), "&#55296;", "lone surrogate");
  assert.equal(decodeHtmlEntities("&#1114112;"), "&#1114112;", "past the last code point");
  assert.equal(decodeHtmlEntities("&#0;"), "&#0;");
});

test("returns the input untouched when there is nothing to decode", () => {
  const plain = "It will change when ordinary people learn where their leverage is.";
  assert.equal(decodeHtmlEntities(plain), plain);
});

test("nbsp decodes to a real non-breaking space; ingest is what flattens it", () => {
  assert.equal(decodeHtmlEntities("a&nbsp;b"), "a\u00a0b");
});

test("the hand-written latin-1 block is in the right order", () => {
  // One omission shifts every later name, and the shift is invisible until a real accented
  // character lands in Muxin's text. These are spot checks at both ends and around the gap.
  const spot: Record<string, string> = {
    nbsp: "\u00a0", copy: "\u00a9", laquo: "\u00ab", reg: "\u00ae", deg: "\u00b0",
    plusmn: "\u00b1", middot: "\u00b7", iquest: "\u00bf", Agrave: "\u00c0", times: "\u00d7",
    szlig: "\u00df", eacute: "\u00e9", egrave: "\u00e8", iacute: "\u00ed", divide: "\u00f7",
    yuml: "\u00ff",
  };
  for (const [name, char] of Object.entries(spot)) {
    assert.equal(decodeHtmlEntities(`&${name};`), char, name);
  }
});

test("never decodes a reference into an invisible control character", () => {
  // The five C1 slots cp1252 leaves unmapped. Decoding these writes an invisible control into
  // source.md, which every derivative then quotes verbatim.
  for (const raw of [129, 141, 143, 144, 157]) {
    assert.equal(decodeHtmlEntities(`&#${raw};`), `&#${raw};`, `decimal ${raw}`);
  }
  assert.equal(decodeHtmlEntities("&#x81;"), "&#x81;", "hex form of an unmapped C1 slot");
  assert.equal(decodeHtmlEntities("a&#8;b"), "a&#8;b", "backspace");
  assert.equal(decodeHtmlEntities("&#127;"), "&#127;", "delete");
  // Mapped cp1252 slots in the same range still decode, and real whitespace is real text.
  assert.equal(decodeHtmlEntities("&#146;&#151;"), "’—", "mapped slots still decode");
  assert.equal(decodeHtmlEntities("a&#9;b&#10;c"), "a\tb\nc", "tab and newline are text");
});
