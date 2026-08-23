import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readAdvice,
  writeAdvice,
  roundCount,
  parseLineRefs,
  extractSourceLines,
  acceptAngle,
  dismissCard,
  appendReply,
  developSessionForFolder,
  advicePath,
  developLogPath,
  ownDestinationHosts,
  sourceTagFor,
  contentSessionForFolder,
  type Advice,
} from "./develop.js";
import { buildFormatArg, parseContinueArg, continueJobProgressed } from "./jobs.js";

// A minimal content folder: source.md (the verbatim material) + review-queue.md (what makes a
// folder a real content folder everywhere else in this GUI).
function tmpFolder(sourceLines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "develop-test-"));
  writeFileSync(join(dir, "source.md"), sourceLines.join("\n") + "\n");
  writeFileSync(join(dir, "review-queue.md"), "# Review queue — Test piece\n");
  return dir;
}

function sampleAdvice(): Advice {
  return {
    version: 1,
    rounds: [
      {
        index: 1,
        trigger: "initial",
        replyText: null,
        at: "2026-07-17T00:00:00Z",
        cards: [
          {
            id: "r1-c1",
            kind: "angle",
            title: "Belief under audit: fear is aimed at the wrong actor",
            summary: "Advisor rationale prose that must NEVER enter a cut body.",
            lens: "belief-audit",
            sourceLines: [2, "4-5"],
            status: "open",
            acceptedLens: null,
            decidedAt: null,
          },
          {
            id: "r1-c2",
            kind: "cta",
            title: "CTA sense-check",
            summary: "Reads as essay_excerpt; no project link applies.",
            status: "open",
            acceptedLens: null,
            decidedAt: null,
          },
        ],
      },
    ],
  };
}

// ── advice.json round-trip ──────────────────────────────────────────────────────────────────────

test("writeAdvice/readAdvice round-trips, and roundCount counts rounds", () => {
  const dir = tmpFolder(["L1", "L2", "L3", "L4", "L5"]);
  try {
    assert.equal(readAdvice(dir), null);
    assert.equal(roundCount(dir), 0);
    writeAdvice(dir, sampleAdvice());
    const back = readAdvice(dir);
    assert.ok(back);
    assert.equal(back.rounds.length, 1);
    assert.equal(back.rounds[0].cards[0].id, "r1-c1");
    assert.equal(roundCount(dir), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readAdvice returns null on malformed JSON instead of throwing", () => {
  const dir = tmpFolder(["L1"]);
  try {
    mkdirSync(join(dir, "develop"), { recursive: true });
    writeFileSync(advicePath(dir), "{ this is not json");
    assert.equal(readAdvice(dir), null);
    assert.equal(roundCount(dir), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readAdvice normalizes an unknown card kind/status instead of dropping the card", () => {
  const dir = tmpFolder(["L1"]);
  try {
    mkdirSync(join(dir, "develop"), { recursive: true });
    writeFileSync(
      advicePath(dir),
      JSON.stringify({ version: 1, rounds: [{ index: 1, trigger: "initial", cards: [{ id: "r1-c1", kind: "wat", status: "hm", title: "t", summary: "s" }] }] }),
    );
    const advice = readAdvice(dir);
    assert.ok(advice);
    assert.equal(advice.rounds[0].cards[0].kind, "note");
    assert.equal(advice.rounds[0].cards[0].status, "open");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── line refs + verbatim extraction (the extraction-first guardrail's mechanics) ────────────────

test("parseLineRefs accepts bare numbers and start-end ranges", () => {
  assert.deepEqual(parseLineRefs([12, "31-33"]), [[12, 12], [31, 33]]);
});

test("parseLineRefs rejects malformed, reversed, zero, and non-integer refs", () => {
  assert.throws(() => parseLineRefs(["33-31"]), /bad line ref/);
  assert.throws(() => parseLineRefs(["x"]), /bad line ref/);
  assert.throws(() => parseLineRefs([0]), /bad line ref/);
  assert.throws(() => parseLineRefs([1.5]), /bad line ref/);
  assert.throws(() => parseLineRefs([]), /at least one/);
});

test("extractSourceLines returns exactly the referenced verbatim lines, ranges separated by a blank line", () => {
  const dir = tmpFolder(["# Title", "Muxin line two.", "filler", "Range start.", "Range end."]);
  try {
    assert.equal(extractSourceLines(dir, [2, "4-5"]), "Muxin line two.\n\nRange start.\nRange end.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("extractSourceLines throws on a ref past the end of source.md (stale advisor refs)", () => {
  const dir = tmpFolder(["only one line"]);
  try {
    assert.throws(() => extractSourceLines(dir, ["5-9"]), /past the end/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── acceptAngle: the core guardrail ─────────────────────────────────────────────────────────────

test("acceptAngle creates cuts/<lens>/cut.md whose body is EXACTLY the verbatim source lines — advisor prose never enters", () => {
  const dir = tmpFolder(["# Title", "Muxin line two.", "filler", "Range start.", "Range end."]);
  try {
    writeAdvice(dir, sampleAdvice());
    const result = acceptAngle(dir, "r1-c1");
    assert.equal(result.lens, "belief-audit");
    const cutPath = join(dir, "cuts", "belief-audit", "cut.md");
    assert.ok(existsSync(cutPath));
    const raw = readFileSync(cutPath, "utf8");
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
    assert.equal(body, "Muxin line two.\n\nRange start.\nRange end.");
    assert.ok(!raw.includes("Advisor rationale"), "advisor summary must never land in the cut file body");
    // Card flipped + logged
    const advice = readAdvice(dir)!;
    assert.equal(advice.rounds[0].cards[0].status, "accepted");
    assert.equal(advice.rounds[0].cards[0].acceptedLens, "belief-audit");
    assert.match(readFileSync(developLogPath(dir), "utf8"), /## Accepted: belief-audit \(r1-c1\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acceptAngle refuses: double-accept, non-angle cards, colliding lens, bad lens slugs", () => {
  const dir = tmpFolder(["L1", "L2", "L3", "L4", "L5"]);
  try {
    writeAdvice(dir, sampleAdvice());
    acceptAngle(dir, "r1-c1");
    assert.throws(() => acceptAngle(dir, "r1-c1"), /already accepted/);
    assert.throws(() => acceptAngle(dir, "r1-c2"), /only an angle/);
    assert.throws(() => acceptAngle(dir, "nope"), /no such card/);
    // A second open angle proposing the SAME lens collides with the cut on disk.
    const advice = readAdvice(dir)!;
    advice.rounds[0].cards.push({ id: "r1-c3", kind: "angle", title: "again", summary: "s", lens: "belief-audit", sourceLines: [1], status: "open", acceptedLens: null, decidedAt: null });
    advice.rounds[0].cards.push({ id: "r1-c4", kind: "angle", title: "evil", summary: "s", lens: "../evil", sourceLines: [1], status: "open", acceptedLens: null, decidedAt: null });
    advice.rounds[0].cards.push({ id: "r1-c5", kind: "angle", title: "default", summary: "s", lens: "extract", sourceLines: [1], status: "open", acceptedLens: null, decidedAt: null });
    writeAdvice(dir, advice);
    assert.throws(() => acceptAngle(dir, "r1-c3"), /already exists/);
    assert.throws(() => acceptAngle(dir, "r1-c4"), /bad lens/);
    assert.throws(() => acceptAngle(dir, "r1-c5"), /bad lens/); // "extract" is the top-level default, never a cuts/ subfolder
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dismissCard flips status and persists; a decided card can't be dismissed again", () => {
  const dir = tmpFolder(["L1"]);
  try {
    writeAdvice(dir, sampleAdvice());
    dismissCard(dir, "r1-c2");
    assert.equal(readAdvice(dir)!.rounds[0].cards[1].status, "dismissed");
    assert.throws(() => dismissCard(dir, "r1-c2"), /already dismissed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── reply + session view ────────────────────────────────────────────────────────────────────────

test("appendReply writes the Muxin-reply section (numbered for the round the answer will get)", () => {
  const dir = tmpFolder(["L1"]);
  try {
    writeAdvice(dir, sampleAdvice());
    const round = appendReply(dir, "push the second angle harder");
    assert.equal(round, 2);
    const log = readFileSync(developLogPath(dir), "utf8");
    assert.match(log, /## Muxin — reply \(round 2\)/);
    assert.match(log, /push the second angle harder/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("developSessionForFolder resolves angle previews live from source.md; a stale ref becomes an inline error, not a crash", () => {
  const dir = tmpFolder(["# Title", "Muxin line two.", "filler", "Range start.", "Range end."]);
  try {
    assert.equal(developSessionForFolder(dir, "slug"), null); // no advice yet
    const advice = sampleAdvice();
    advice.rounds[0].cards.push({ id: "r1-c9", kind: "angle", title: "stale", summary: "s", lens: "stale", sourceLines: [99], status: "open", acceptedLens: null, decidedAt: null });
    writeAdvice(dir, advice);
    const session = developSessionForFolder(dir, "slug")!;
    assert.equal(session.title, "Test piece"); // firstHeading strips the "Review queue —" prefix
    const [angle, cta, stale] = session.rounds[0].cards;
    assert.equal(angle.previewText, "Muxin line two.\n\nRange start.\nRange end.");
    assert.equal(cta.previewText, undefined); // non-angle cards carry no preview
    assert.match(stale.previewError!, /past the end/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── "Format for platforms" plumbing (jobs.ts pure pieces) ───────────────────────────────────────

test("buildFormatArg: extract targets the folder itself; any other lens adds --cut", () => {
  assert.equal(buildFormatArg("2026-07-17-foo", "extract"), "--continue content/2026-07-17-foo");
  assert.equal(buildFormatArg("2026-07-17-foo", "short"), "--continue content/2026-07-17-foo --cut short");
});

test("parseContinueArg round-trips buildFormatArg and rejects foreign shapes", () => {
  assert.deepEqual(parseContinueArg("--continue content/2026-07-17-foo"), { folder: "content/2026-07-17-foo" });
  assert.deepEqual(parseContinueArg("--continue content/2026-07-17-foo --cut short"), { folder: "content/2026-07-17-foo", lens: "short" });
  assert.equal(parseContinueArg("https://example.com"), null);
  assert.equal(parseContinueArg("--continue content/x --cut ../evil"), null);
});

test("continueJobProgressed: growth in queue rows OR derivatives counts as progress; neither does not", () => {
  assert.equal(continueJobProgressed({ rows: 3, derivatives: 0 }, { rows: 8, derivatives: 0 }), true);
  assert.equal(continueJobProgressed({ rows: 3, derivatives: 2 }, { rows: 3, derivatives: 5 }), true);
  assert.equal(continueJobProgressed({ rows: 3, derivatives: 2 }, { rows: 3, derivatives: 2 }), false);
});

// ── The source picker's tags ────────────────────────────────────────────────────────────────────

const OWN = ["humaninference.ai", "humaninference.substack.com", "voter-choice.vercel.app"];

test("ownDestinationHosts reads the configured destinations and skips the `source` keyword", () => {
  const dir = mkdtempSync(join(tmpdir(), "cta-"));
  try {
    const p = join(dir, "cta.yaml");
    writeFileSync(
      p,
      [
        "targets:",
        "  human-ai:",
        "    url: source",
        "  civic-tech:",
        '    url: "https://voter-choice.vercel.app/"',
        "  builder:",
        '    url: "https://www.humaninference.substack.com"',
        "source_fallback:",
        '  url: "https://humaninference.ai"',
        "",
      ].join("\n"),
    );
    assert.deepEqual(ownDestinationHosts(p), ["humaninference.ai", "humaninference.substack.com", "voter-choice.vercel.app"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ownDestinationHosts on a missing file returns nothing, so no origin is guessed as hers", () => {
  assert.deepEqual(ownDestinationHosts(join(tmpdir(), "no-such-cta-config-here.yaml")), []);
});

test("sourceTagFor: every tag stands on a fact, and an origin that does not say gets no tag", () => {
  // a Note: new-notes.ts only ever ingests HER account, so source_kind alone proves it
  const note = sourceTagFor({ source_kind: "substack-note", origin: "https://substack.com/@x/note/c-1" }, OWN);
  assert.equal(note.tag, "SUBSTACK");
  assert.match(note.basis, /source_kind/);

  // an http origin on one of her own configured destinations
  const own = sourceTagFor({ origin: "https://humaninference.substack.com/p/essay" }, OWN);
  assert.equal(own.tag, "SUBSTACK");
  assert.match(own.basis, /config\/cta\.yaml/);

  // the same shape on a foreign host is NOT hers
  const foreign = sourceTagFor({ origin: "https://example.com/p/someone-else" }, OWN);
  assert.equal(foreign.tag, "READ IN");
  assert.match(foreign.basis, /example\.com/);

  // her own local drafts
  for (const origin of ["file:An Essay.md", "pasted-text", "voice-memo:memo.m4a"]) {
    assert.equal(sourceTagFor({ origin }, OWN).tag, "YOURS", origin);
  }

  // nothing to stand on
  assert.equal(sourceTagFor({}, OWN).tag, null);
  assert.equal(sourceTagFor({ origin: "  " }, OWN).tag, null);
  assert.equal(sourceTagFor({ origin: "reply to mention" }, OWN).tag, null);
  assert.equal(sourceTagFor({ origin: "http://" }, OWN).tag, null);
});

test("sourceTagFor never invents VENTURE, the one prototype tag with no source in this repo", () => {
  const vectors: Record<string, unknown>[] = [
    { origin: "file:x.md" },
    { origin: "pasted-text" },
    { origin: "https://humaninference.substack.com/p/x" },
    { origin: "https://example.com/p/x" },
    { source_kind: "substack-note" },
    {},
  ];
  for (const fm of vectors) assert.notEqual(sourceTagFor(fm, OWN).tag, "VENTURE");
});

test("contentSessionForFolder carries the origin facts the picker renders", () => {
  const dir = mkdtempSync(join(tmpdir(), "cs-"));
  try {
    writeFileSync(
      join(dir, "source.md"),
      '---\ntitle: "T"\norigin: https://example.com/p/x\ncanonical_url: https://example.com/p/x\npublished_at: 2026-08-10\n---\n\n# T\n\nbody\n',
    );
    // a cut on disk is what makes this a workbench piece at all
    mkdirSync(join(dir, "cuts", "extract"), { recursive: true });
    writeFileSync(join(dir, "cuts", "extract", "cut.md"), '---\ntitle: "T"\nsource_lines: [1]\n---\n\nbody\n');
    const s = contentSessionForFolder(dir, "2026-08-10-t", OWN);
    assert.ok(s);
    assert.equal(s.origin, "https://example.com/p/x");
    assert.equal(s.canonicalUrl, "https://example.com/p/x");
    assert.equal(s.publishedAt, "2026-08-10");
    assert.equal(s.tag, "READ IN");
    assert.ok(s.tagBasis.length > 0, "the tag never renders bare");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
