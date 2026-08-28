import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCorpusInventory,
  classifyFieldLabel,
  parseCreatorContentIndex,
  parseCreatorFile,
  parseHeadingDate,
  parseMetricsValue,
  reconcileIndex,
  splitFieldLabel,
  CreatorContentParseError,
} from "./creator-content-normalization.js";

// Every fixture below is invented. Nothing here is copied from the tracked creator corpus: the
// point of this lane is to stop creator bodies from spreading, and a test fixture is a new place
// for them to spread to. The SHAPES are real; the words are not.

function header(overrides: Partial<Record<string, string>> = {}): string {
  const fields: Record<string, string> = {
    "Handle": "@sample (X)",
    "Primary platform": "X",
    "Primary media type": "short-form text",
    "Audience size": "1,000 followers",
    "Topic(s)": "Sample topic",
    "Capture method": "sample sweep",
    "Posts captured": "2/30",
    ...overrides,
  };
  return [
    "# Sample Creator: content library",
    "",
    ...Object.entries(fields).map(([key, value]) => `**${key.trim()}:** ${value}`),
    "",
  ].join("\n");
}

test("parses a text entry, its fields, its metrics, and its date", () => {
  const file = parseCreatorFile("sample-text.md", [
    header(),
    "## Posts",
    "",
    "### 1. A sample title (2026-02-14) [link](https://example.test/1)",
    "**Metrics:** 1.2K likes, 40 replies, 3 reposts",
    "**Opening hook (verbatim):**",
    "> invented opening line",
    "**Full text (verbatim):**",
    "> invented body line one",
    "> invented body line two",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
    "### 2. Another sample title (2026-02-15) [link](https://example.test/2)",
    "**Metrics:** 900 likes, 12 replies",
    "**Opening hook (verbatim):**",
    "> another invented opening",
    "**Full text (verbatim):**",
    "> another invented body",
    "**Structure:** another structural note",
    "**Framing:** another framing note",
    "",
  ].join("\n"));

  assert.equal(file.entries.length, 2);
  assert.equal(file.claimedCaptured, 2);
  assert.equal(file.claimedTarget, 30);
  assert.equal(file.header.platform, "x");
  const [first] = file.entries;
  assert.equal(first!.ref, "sample-text.md#entry-1-1");
  assert.equal(first!.date, "2026-02-14");
  assert.equal(first!.datePrecision, "day");
  assert.equal(first!.evidenceKind, "text");
  assert.deepEqual(first!.metrics.values, [
    { metric: "likes", count: 1200 },
    { metric: "replies", count: 40 },
    { metric: "reposts", count: 3 },
  ]);
  assert.equal(first!.fields.find((field) => field.kind === "hook")?.presence, "present");
  assert.equal(first!.fields.find((field) => field.kind === "body")?.quotedLineCount, 2);
  assert.deepEqual(file.anomalies, []);
});

test("parses an image entry with image text and a visual description", () => {
  const file = parseCreatorFile("sample-image.md", [
    header({ "Primary platform": "Pinterest", "Primary media type": "image (pins)", "Posts captured": "1/30" }),
    "## Pins",
    "",
    "### 1. A sample pin (not shown) [link](https://example.test/pin)",
    "**Metrics:** 120 saves, 8 comments",
    "**Image text (verbatim):**",
    "> invented words rendered on the pin",
    "**Visual description:** invented description of the artwork",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  const [entry] = file.entries;
  assert.equal(entry!.evidenceKind, "image");
  assert.equal(entry!.datePrecision, "source-undated");
  assert.equal(entry!.date, null);
  assert.ok(entry!.fieldKinds.includes("image-text"));
  assert.ok(entry!.fieldKinds.includes("visual-description"));
  assert.equal(file.anomalies.filter((anomaly) => anomaly.kind === "unparsable-date").length, 0);
});

test("parses a short-video entry with a visual-only hook and no spoken audio", () => {
  const file = parseCreatorFile("sample-short.md", [
    header({ "Primary platform": "TikTok", "Primary media type": "short-form video", "Posts captured": "1/30" }),
    "## Posts",
    "",
    "### 1. A sample clip (2024-03-02) [link](https://example.test/clip)",
    "**Metrics:** 4.5M views; 900K likes",
    "**Opening hook (visual description, since mostly wordless):** invented description of the first frames",
    "**Spoken transcript (verbatim, or \"None (wordless...)\" note):**",
    "> None (wordless clip set to music, no original spoken dialogue).",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  const [entry] = file.entries;
  assert.equal(entry!.evidenceKind, "short-video");
  assert.equal(entry!.flags.visualOnlyHook, true);
  assert.equal(entry!.flags.transcriptExpected, true);
  assert.equal(entry!.flags.transcriptFieldPresent, true);
  assert.equal(entry!.flags.transcriptAvailable, false, "a 'None (...)' note is not a transcript");
  assert.deepEqual(entry!.metrics.values, [
    { metric: "likes", count: 900_000 },
    { metric: "views", count: 4_500_000 },
  ]);
});

test("parses a long-video entry and marks an unavailable transcript absent", () => {
  const file = parseCreatorFile("sample-long.md", [
    header({ "Primary platform": "YouTube", "Primary media type": "long video", "Posts captured": "2/30" }),
    "## Videos",
    "",
    "### 1. A sample video (2023-11-01) [link](https://example.test/v1)",
    "**Metrics:** 2,000,000 views; 50,000 likes",
    "**Duration:** 18:42",
    "**Thumbnail description:** invented thumbnail description",
    "**Full transcript (verbatim, from YouTube's auto-generated captions -- no native punctuation/capitalization; see capture note):**",
    "> invented transcript words here",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
    "### 2. Another sample video (2023-12-01) [link](https://example.test/v2)",
    "**Metrics:** 1,000,000 views; 10,000 likes",
    "**Thumbnail description:** invented thumbnail description",
    "**Full transcript (verbatim, or a one-line honest note if genuinely unavailable):**",
    "> Transcript unavailable -- no English captions exist for this video.",
    "**Structure:** Not determined -- cannot be assessed without a transcript.",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  const [withTranscript, withoutTranscript] = file.entries;
  assert.equal(withTranscript!.evidenceKind, "long-video");
  assert.equal(withTranscript!.flags.transcriptAvailable, true);
  assert.equal(withTranscript!.flags.autoCaptions, true);
  assert.equal(withoutTranscript!.flags.transcriptAvailable, false);
  assert.equal(withoutTranscript!.fields.find((field) => field.kind === "structure")?.presence, "absent");
});

test("reads a verbatim body that was written as plain Markdown instead of a blockquote", () => {
  const file = parseCreatorFile("sample-unquoted.md", [
    header({ "Primary platform": "Dev.to", "Primary media type": "long-form text", "Posts captured": "1/30" }),
    "## Posts",
    "",
    "### 1. A sample article (Apr 20, 2026) [link](https://example.test/a)",
    "**Metrics:** 100 reactions",
    "**Full text (verbatim):**",
    "",
    "### A heading the creator wrote inside the article",
    "invented body paragraph written as plain markdown, not quoted",
    "",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  const body = file.entries[0]!.fields.find((field) => field.kind === "body");
  assert.equal(body!.presence, "present", "an unquoted body is still a body");
  assert.equal(body!.quotedLineCount, 0);
  assert.ok(body!.unquotedLineCount >= 2);
  assert.equal(buildCorpusInventory([file], "# index\n").field_coverage.body.present, 1);
});

test("marks a paywalled long-form entry as a partial capture", () => {
  const file = parseCreatorFile("sample-longform.md", [
    header({ "Primary platform": "Substack", "Primary media type": "long-form text", "Posts captured": "1/30" }),
    "## Newsletter posts (long-form)",
    "",
    "### 1. A sample essay (Mar 4, 2026) [link](https://example.test/essay)",
    "**Metrics:** 400 likes, 20 comments, 5 restacks",
    "**Opening hook (verbatim):**",
    "> invented opening line",
    "**Full text (everything visible before the paywall, which cuts in right as step 3 begins):**",
    "> invented free-preview body",
    "**Structure map:** invented structure map note",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  const [entry] = file.entries;
  assert.equal(entry!.evidenceKind, "long-form-text");
  assert.equal(entry!.flags.paywalled, true);
  assert.equal(entry!.flags.partialCapture, true);
  assert.equal(entry!.fields.find((field) => field.kind === "body")?.presence, "partial");
  assert.ok(entry!.fieldKinds.includes("structure-map"));
});

test("flags an entry whose content was authored by someone else", () => {
  const file = parseCreatorFile("sample-repost.md", [
    header({ "Primary platform": "LinkedIn", "Primary media type": "text", "Posts captured": "1/30" }),
    "## Posts",
    "",
    "### 1. A sample repost (2026-01-09) [link](https://example.test/repost)",
    "**Metrics:** 30 reactions, 2 comments",
    "**Opening hook (verbatim, Someone Else's words):**",
    "> invented opening line",
    "**Full text (verbatim, Someone Else's words):**",
    "> invented body line",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  assert.equal(file.entries[0]!.flags.thirdPartyAuthored, true);
});

test("records a missing field rather than inventing one", () => {
  const file = parseCreatorFile("sample-missing.md", [
    header({ "Posts captured": "1/30" }),
    "## Posts",
    "",
    "### 1. A sample title (2026-02-14) [link](https://example.test/1)",
    "**Metrics:** 10 likes",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  const [entry] = file.entries;
  assert.equal(entry!.fields.some((field) => field.kind === "hook"), false);
  assert.equal(entry!.fields.some((field) => field.kind === "structure"), false);
  const inventory = buildCorpusInventory([file], "# index\n");
  assert.equal(inventory.field_coverage.hook.missing, 1);
  assert.equal(inventory.field_coverage.structure.missing, 1);
  assert.equal(inventory.field_coverage.framing.present, 1);
});

test("rejects a numbered heading inside creator body copy and redacts its bold labels", () => {
  const file = parseCreatorFile("sample-embedded.md", [
    header({ "Primary platform": "Dev.to", "Primary media type": "long-form text", "Posts captured": "2/30" }),
    "## Posts",
    "",
    "### 1. A sample article (Apr 20, 2026) [link](https://example.test/a)",
    "**Metrics:** 100 reactions, 4 comments",
    "**Full text (verbatim):**",
    "> invented body line",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
    "### 1. A subhead the creator wrote inside the article",
    "**Some invented bold label the taxonomy does not know:** invented body copy",
    "",
    "### 2. Another subhead the creator wrote",
    "",
    "### 2. A second sample article (Apr 21, 2026) [link](https://example.test/b)",
    "**Metrics:** 60 reactions, 1 comment",
    "**Full text (verbatim):**",
    "> invented body line",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));

  assert.equal(file.entries.length, 2, "only the two real entries are entries");
  const rejected = file.anomalies.filter((anomaly) => anomaly.kind === "body-embedded-heading");
  assert.equal(rejected.length, 2);
  const redacted = file.anomalies.filter((anomaly) => anomaly.kind === "unrecognized-field-label");
  assert.equal(redacted.length, 1);
  assert.match(redacted[0]!.detail, /redacted/);
  assert.equal(
    file.entries.some((entry) => entry.fields.some((field) => field.rawLabel.includes("invented bold label"))),
    false,
    "an unknown bold label is body copy and never persisted",
  );
});

test("reports a claimed-count mismatch and accepts a multi-stream claim", () => {
  const body = (count: number): string => Array.from({ length: count }, (_unused, index) => [
    `### ${index + 1}. A sample title (2026-01-0${(index % 9) + 1}) [link](https://example.test/${index})`,
    "**Metrics:** 10 likes",
    "**Framing:** invented framing note",
    "",
  ].join("\n")).join("\n");

  const mismatched = parseCreatorFile("sample-mismatch.md", [header({ "Posts captured": "2/30" }), "## Posts", "", body(3)].join("\n"));
  assert.equal(mismatched.entries.length, 3);
  assert.equal(mismatched.anomalies.filter((anomaly) => anomaly.kind === "claimed-count-mismatch").length, 1);

  const multiStream = parseCreatorFile("sample-streams.md", [
    header({ "Posts captured": "2/2 clips, 1/1 image post" }),
    "## Clips",
    "",
    body(2),
    "## Image posts",
    "",
    body(1),
  ].join("\n"));
  assert.equal(multiStream.entries.length, 3);
  assert.equal(multiStream.anomalies.filter((anomaly) => anomaly.kind === "claimed-count-mismatch").length, 0);
  assert.deepEqual(multiStream.entries.map((entry) => entry.ref), [
    "sample-streams.md#entry-1-1",
    "sample-streams.md#entry-1-2",
    "sample-streams.md#entry-2-1",
  ]);
});

test("reads completeness from the entries that parse, not the file's summary sentence", () => {
  const body = (count: number): string => Array.from({ length: count }, (_unused, index) => [
    `### ${index + 1}. A sample title (2026-01-0${(index % 9) + 1}) [link](https://example.test/${index})`,
    "**Metrics:** 10 likes",
    "**Framing:** invented framing note",
    "",
  ].join("\n")).join("\n");

  // A trailing pair can report a sub-count of the same items rather than a second stream: how
  // many of the 30 captured videos yielded a transcript. Summing every pair would call this
  // complete capture partial.
  const subCount = parseCreatorFile("sample-subcount.md", [
    header({ "Posts captured": "3/3 (transcripts: 2/3 retrieved; 1 confirmed unavailable)" }),
    "## Posts", "", body(3),
  ].join("\n"));
  const bounded = parseCreatorFile("sample-bounded.md", [header({ "Posts captured": "3/30" }), "## Posts", "", body(3)].join("\n"));
  const inventory = buildCorpusInventory([bounded, subCount], "# index\n");
  const byFile = new Map(inventory.creators.map((creator) => [creator.file, creator] as const));
  assert.equal(byFile.get("sample-subcount.md")!.capture_completeness, "complete");
  assert.equal(byFile.get("sample-bounded.md")!.capture_completeness, "partial-window");
});

test("records a blocked capture as zero entries instead of failing", () => {
  const file = parseCreatorFile("sample-blocked.md", [
    header({ "Posts captured": "0/30" }),
    "## Capture blocked: not fabricated",
    "",
    "The profile loaded but the grid never rendered.",
    "",
    "## Posts",
    "",
    "None captured; see above.",
    "",
  ].join("\n"));

  assert.equal(file.entries.length, 0);
  assert.equal(file.anomalies.filter((anomaly) => anomaly.kind === "no-entries").length, 1);
  assert.equal(file.anomalies.filter((anomaly) => anomaly.kind === "claimed-count-mismatch").length, 0);
});

test("rejects malformed input instead of guessing", () => {
  assert.throws(() => parseCreatorFile("", "# anything"), CreatorContentParseError);
  assert.throws(() => parseCreatorFile("x.md", undefined as unknown as string), CreatorContentParseError);
  const headerless = parseCreatorFile("sample-headerless.md", "## Posts\n\nnothing here\n");
  assert.equal(headerless.entries.length, 0);
  assert.equal(headerless.anomalies.filter((anomaly) => anomaly.kind === "missing-header-field").length, 7);
});

test("classifies field labels and their qualifiers", () => {
  assert.deepEqual(splitFieldLabel("Full text (verbatim, ends at the paywall gate)"), {
    base: "full text",
    qualifier: "verbatim, ends at the paywall gate",
  });
  assert.equal(classifyFieldLabel("Structure map (of the visible portion)").kind, "structure-map");
  assert.equal(classifyFieldLabel("Structure").kind, "structure");
  assert.equal(classifyFieldLabel("Points/comments").kind, "metrics");
  assert.equal(classifyFieldLabel("Opening hook (verbatim, from transcript)").kind, "hook");
  assert.ok(classifyFieldLabel("Opening hook (verbatim, from transcript)").qualifiers.includes("from-transcript"));
  assert.ok(classifyFieldLabel("Full text (everything visible before the paywall)").qualifiers.includes("paywalled"));
  assert.ok(classifyFieldLabel("Opening hook (visual description, since mostly wordless)").qualifiers.includes("visual-only"));
  assert.equal(classifyFieldLabel("Some label nobody defined").kind, "unrecognized");

  // The qualifier decides where a hook came from; the base label does not. A hook labelled
  // "(verbatim, transcript)" was read off a transcript even though the word "from" is absent.
  assert.ok(classifyFieldLabel("Opening hook (verbatim, transcript)").qualifiers.includes("from-transcript"));
  assert.ok(classifyFieldLabel("Full text (verbatim)").qualifiers.includes("from-transcript") === false);

  // "no native punctuation" and "no English captions" are the opposite claim to creator-supplied
  // captions, so an auto-caption label must not also read as creator-provided.
  const autoLabel = classifyFieldLabel("Full transcript (verbatim, from YouTube's auto-generated captions -- no native punctuation/capitalization)");
  assert.ok(autoLabel.qualifiers.includes("auto-captions"));
  assert.equal(autoLabel.qualifiers.includes("creator-captions"), false);
  assert.ok(classifyFieldLabel("Full transcript (verbatim, from YouTube's creator-provided English captions)").qualifiers.includes("creator-captions"));

  // The conditional-absence form carries its own parentheses, so the gap must cross them.
  assert.ok(classifyFieldLabel('Spoken/audio transcript (verbatim, or "None (music/dance...)" note)').qualifiers.includes("conditional-absence"));
});

test("reads every metrics shape the corpus uses and refuses to guess the rest", () => {
  assert.deepEqual(parseMetricsValue("1.6K likes, 193 replies").values, [
    { metric: "likes", count: 1600 },
    { metric: "replies", count: 193 },
  ]);
  assert.deepEqual(parseMetricsValue("12 reactions · 3 comments").values, [
    { metric: "comments", count: 3 },
    { metric: "reactions", count: 12 },
  ]);
  const positional = parseMetricsValue("819 / 25 / 61 (reaction/comment/restack counts)");
  assert.equal(positional.positionalOnly, true);
  assert.deepEqual(positional.values.map((value) => value.count), [819, 25, 61]);
  const named = parseMetricsValue("1275, 265", ["points", "comments"]);
  assert.equal(named.positionalOnly, false);
  assert.deepEqual(named.values, [{ metric: "comments", count: 265 }, { metric: "points", count: 1275 }]);
  const segmented = parseMetricsValue("84 likes, 14 replies (segment 1 of 4; segment 2: 9 likes)");
  assert.equal(segmented.segmented, true);
  const missing = parseMetricsValue("Not visible without login");
  assert.equal(missing.available, false);
  assert.deepEqual(missing.values, []);

  // A comma separates metrics AND thousands. Splitting on every comma turned nearly a billion
  // views into 655, so the comma only separates entries when it is not sitting between digits.
  assert.deepEqual(parseMetricsValue("949,260,655 views; 20,111,082 likes").values, [
    { metric: "likes", count: 20_111_082 },
    { metric: "views", count: 949_260_655 },
  ]);
  assert.deepEqual(parseMetricsValue("1,279 likes, 165 reposts").values, [
    { metric: "likes", count: 1279 },
    { metric: "reposts", count: 165 },
  ]);

  // A partly unreadable list is reported as unreadable, not quietly trimmed to the parts that fit.
  const partial = parseMetricsValue("1,279 likes, 165 reposts, views not shown");
  assert.equal(partial.unparsedTokens, 1);
  assert.equal(partial.values.length, 2);
});

test("an entry whose metric list is partly unreadable raises an anomaly", () => {
  const file = parseCreatorFile("sample-metrics.md", [
    header({ "Posts captured": "1/30" }),
    "## Posts",
    "",
    "### 1. A sample title (2026-02-14) [link](https://example.test/1)",
    "**Metrics:** 1,279 likes, views not shown",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));
  const anomaly = file.anomalies.find((row) => row.kind === "unparsable-metrics");
  assert.ok(anomaly, "an incomplete metric set must be visible, not silently trimmed");
  assert.match(anomaly!.detail, /incomplete/);
  assert.equal(file.entries[0]!.metrics.available, true);
  assert.equal(file.entries[0]!.metrics.unparsedTokens, 1);
});

test("classifies a video the account calls a video even with no transcript captured", () => {
  const file = parseCreatorFile("sample-videopin.md", [
    header({ "Primary platform": "Pinterest", "Primary media type": "video (short-form)", "Posts captured": "1/30" }),
    "## Pins",
    "",
    "### 1. A sample video pin (not shown) [link](https://example.test/pin)",
    "**Metrics:** 40 saves",
    "**Visual description:** invented description of the clip",
    "**Structure:** invented structural note",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));
  assert.equal(file.entries[0]!.evidenceKind, "short-video");
  assert.equal(file.entries[0]!.flags.transcriptExpected, true);
  assert.equal(file.entries[0]!.flags.transcriptFieldPresent, false);

  // An account that publishes both images and video stays ambiguous, and the fields decide.
  const mixed = parseCreatorFile("sample-mixed.md", [
    header({ "Primary platform": "Bluesky", "Primary media type": "image/video with caption", "Posts captured": "1/30" }),
    "## Posts",
    "",
    "### 1. A sample post (2026-02-14) [link](https://example.test/1)",
    "**Metrics:** 40 likes",
    "**Visual description:** invented description",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));
  assert.equal(mixed.entries[0]!.evidenceKind, "image");
});

test("reads every date shape without upgrading an approximation into a date", () => {
  assert.deepEqual(parseHeadingDate("A title (2021-6-30) [link](x)"), { date: "2021-06-30", precision: "day", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (09/16/25, pinned)"), { date: "2025-09-16", precision: "day", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (APR 17, 2025)"), { date: "2025-04-17", precision: "day", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (Sep 1 '25)"), { date: "2025-09-01", precision: "day", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (~mid-Aug 2026)"), { date: "2026-08", precision: "month", approximate: true });
  assert.deepEqual(parseHeadingDate("A title (May 2)"), { date: null, precision: "month", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (3 years ago)"), { date: null, precision: "relative", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (1mo ago)"), { date: null, precision: "relative", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (13h before capture)"), { date: null, precision: "relative", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (19h)"), { date: null, precision: "relative", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (6-28)"), { date: null, precision: "month", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (not shown)"), { date: null, precision: "source-undated", approximate: false });
  assert.deepEqual(parseHeadingDate("A title with nothing datelike"), { date: null, precision: "none", approximate: false });
  // A date that does not exist is not a date. 2024-13-40 is a typo, and reporting it as a day
  // would put an impossible value into the capture window.
  assert.deepEqual(parseHeadingDate("A title (2024-13-40)"), { date: null, precision: "none", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (2026-02-30)"), { date: null, precision: "none", approximate: false });
  assert.deepEqual(parseHeadingDate("A title (Feb 29, 2024)"), { date: "2024-02-29", precision: "day", approximate: false });
  assert.equal(parseHeadingDate("A title (Feb 29, 2025)").date, null, "2025 is not a leap year");
  assert.deepEqual(
    parseHeadingDate("A title (2020-09-20) [link](http://example.test/blog/2019-01-02-post.html)"),
    { date: "2020-09-20", precision: "day", approximate: false },
    "a date inside the link URL never wins over the heading's own",
  );
});

test("reconciles the index against the files on disk", () => {
  const files = [
    parseCreatorFile("sample-a.md", [header({ "Posts captured": "1/30" }), "## Posts", "", "### 1. t (2026-01-01) [link](https://example.test/a)", "**Metrics:** 1 like", "**Framing:** note", ""].join("\n")),
    parseCreatorFile("sample-b.md", [header({ "Posts captured": "1/30" }), "## Posts", "", "### 1. t (2026-01-01) [link](https://example.test/b)", "**Metrics:** 1 like", "**Framing:** note", ""].join("\n")),
  ];
  const indexText = [
    "# Creator content library: index",
    "",
    "**Status as of this pass:** 4 of the confirmed-fill roster captured.",
    "",
    "## Group one",
    "",
    "| Creator | Handle | Platform | Primary media type | Audience size | Items captured | File |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| Sample A | @a | X | text | 1K | 1/30 | [sample-a.md](creator-content/sample-a.md) |",
    "| Sample B | @b | X | text | 1K | 9/30 | [sample-b.md](creator-content/sample-b.md) |",
    "| Sample C | @c | X | text | 1K | 2/30 | [sample-c.md](creator-content/sample-c.md) |",
    "| Sample A again | @a | X | text | 1K | 1/30 | see above |",
    "",
  ].join("\n");

  const rows = parseCreatorContentIndex(indexText);
  assert.equal(rows.length, 4);
  const reconciliation = reconcileIndex(indexText, files);
  assert.equal(reconciliation.declaredCapturedCount, 4);
  assert.equal(reconciliation.distinctLinkedFiles, 3);
  assert.deepEqual(reconciliation.rowsWithoutFileLink, ["Group one / Sample A again"]);
  assert.deepEqual(reconciliation.indexLinksToMissingFiles, ["sample-c.md"]);
  assert.deepEqual(reconciliation.countMismatches, [{ file: "sample-b.md", indexClaim: "9/30", actual: 1 }]);
});

test("the inventory carries counts and references, never creator text", () => {
  const file = parseCreatorFile("sample-text.md", [
    header({ "Posts captured": "1/30" }),
    "## Posts",
    "",
    "### 1. A distinctive invented headline (2026-02-14) [link](https://example.test/unique-slug)",
    "**Metrics:** 10 likes",
    "**Opening hook (verbatim):**",
    "> a distinctive invented opening sentence",
    "**Framing:** invented framing note",
    "",
  ].join("\n"));
  const inventory = buildCorpusInventory([file], "# index\n");
  const serialized = JSON.stringify(inventory);

  assert.equal(inventory.body_included, false);
  assert.equal(inventory.verbatim_included, false);
  assert.equal(inventory.totals.entries, 1);
  assert.equal(serialized.includes("distinctive invented headline"), false, "post titles never reach the inventory");
  assert.equal(serialized.includes("distinctive invented opening sentence"), false, "hook wording never reaches the inventory");
  assert.equal(serialized.includes("unique-slug"), false, "source URLs never reach the inventory");
  assert.equal(serialized.includes("sample-text.md"), true, "the file reference does reach it");
});
