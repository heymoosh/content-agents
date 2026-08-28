import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCreatorFile, type ParsedCreatorFile } from "./creator-content-normalization.js";
import {
  buildCorpusIndex,
  MechanismProposalValidationError,
  MINIMUM_SUPPORT_ENTRIES,
  readMechanismProposals,
  shingles,
  validateProposalsAgainstCorpus,
} from "./creator-mechanism-proposals.js";

// Synthetic corpus. Nothing here is copied from the tracked creator libraries.

interface FixtureEntry {
  readonly title: string;
  readonly metrics: string;
  readonly bodyLabel?: string;
  readonly quoted: string;
  readonly structure: string;
  readonly thirdParty?: boolean;
}

interface FixtureSource {
  readonly parsed: ParsedCreatorFile;
  readonly raw: string;
}

function fixtureSource(name: string, platform: string, entries: readonly FixtureEntry[]): FixtureSource {
  const lines = [
    "# Fixture Creator: content library",
    "",
    "**Handle:** @fixture",
    `**Primary platform:** ${platform}`,
    "**Primary media type:** short-form text",
    "**Audience size:** 1,000 followers",
    "**Topic(s):** Fixture topic",
    "**Capture method:** fixture",
    `**Posts captured:** ${entries.length}/30`,
    "",
    "## Posts",
    "",
  ];
  entries.forEach((entry, index) => {
    lines.push(`### ${index + 1}. ${entry.title} (2026-01-0${(index % 9) + 1}) [link](https://example.test/${index})`);
    lines.push(`**Metrics:** ${entry.metrics}`);
    lines.push(`**${entry.bodyLabel ?? `Full text (verbatim${entry.thirdParty ? ", Someone Else's words" : ""})`}:**`);
    lines.push(`> ${entry.quoted}`);
    lines.push(`**Structure:** ${entry.structure}`);
    lines.push("**Framing:** fixture framing note");
    lines.push("");
  });
  const raw = lines.join("\n");
  return { parsed: parseCreatorFile(name, raw), raw };
}

/** The parsed file plus the exact text it was parsed from, so the copy check has real spans. */
function fixtureCorpus(...sources: readonly FixtureSource[]): { files: readonly ParsedCreatorFile[]; raw: Map<string, string> } {
  return {
    files: sources.map((source) => source.parsed),
    raw: new Map(sources.map((source) => [source.parsed.file, source.raw] as const)),
  };
}

function plainEntry(index: number): FixtureEntry {
  return {
    title: `Fixture title ${index}`,
    metrics: "100 likes, 5 replies",
    quoted: `fixture quoted sentence number ${index} with several distinctive invented words following along`,
    structure: `fixture structural note ${index}`,
  };
}

function corpus(): { files: readonly ParsedCreatorFile[]; raw: Map<string, string> } {
  return fixtureCorpus(
    fixtureSource("fixture-alpha.md", "X", [plainEntry(1), plainEntry(2), plainEntry(3), plainEntry(4)]),
    fixtureSource("fixture-beta.md", "Bluesky", [plainEntry(5), plainEntry(6)]),
  );
}

function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    proposal_id: "mech:hook:constraint-then-change",
    family: "hook",
    name: "Constraint then change",
    mechanism: "Names a constraint the reader already lives with, then supplies the smallest change that removes it, before any credential or context arrives.",
    platforms: ["x"],
    evidence_kinds: ["text"],
    source_refs: [
      "fixture-alpha.md#entry-1-1",
      "fixture-alpha.md#entry-1-2",
      "fixture-alpha.md#entry-1-3",
      "fixture-alpha.md#entry-1-4",
    ],
    third_party_refs: [],
    support: {
      entries: 4,
      distinct_creator_files: 1,
      distinct_platforms: 1,
      metric_backed_entries: 4,
      partial_capture_entries: 0,
      paywalled_entries: 0,
      third_party_entries: 0,
    },
    replication: "single-creator",
    evidence_status: "metric-backed",
    evidence_limitations: [
      "all cited entries come from one account, so this is repetition by one author rather than replication across authors",
      "no baseline, denominator, or comparison window exists for the counts on these entries",
    ],
    adaptation_note: "Supply your own constraint, your own change, and your own wording; the proposal carries an information order only.",
    confidence: "low",
    review_status: "pending",
    originality_status: "pending",
    generates_copy: false,
    creator_body_copy_allowed: false,
    ...overrides,
  };
}

function jsonl(...values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join("\n");
}

test("reads a valid proposal set and reports it as wholly pending", () => {
  const set = readMechanismProposals(jsonl(proposal()));
  assert.equal(set.proposals.length, 1);
  assert.equal(set.summary.pending_review, 1);
  assert.equal(set.summary.pending_originality, 1);
  assert.equal(set.summary.single_creator, 1);
  assert.equal(set.by_family.hook, 1);
  assert.equal(set.by_family.retention, 0);
  assert.equal(set.available_to_generation, false);
  assert.equal(set.body_included, false);
  assert.equal(set.winner_claims_allowed, false);
});

test("fails closed on a prohibited body or copy field", () => {
  for (const key of ["body", "creator_body", "creatorBody", "transcript", "caption", "verbatim", "quote", "excerpt", "example_text", "title", "url", "handle", "score", "winner"]) {
    assert.throws(
      () => readMechanismProposals(jsonl({ ...proposal(), [key]: "anything" })),
      MechanismProposalValidationError,
      `${key} must be rejected`,
    );
  }
});

test("fails closed on a nested prohibited field", () => {
  assert.throws(
    () => readMechanismProposals(jsonl({ ...proposal(), support: { ...(proposal().support as object), body_text: "x" } })),
    MechanismProposalValidationError,
  );
});

test("rejects an unsupported or missing key rather than ignoring it", () => {
  assert.throws(() => readMechanismProposals(jsonl({ ...proposal(), unexpected: 1 })), MechanismProposalValidationError);
  const incomplete = proposal();
  delete incomplete.adaptation_note;
  assert.throws(() => readMechanismProposals(jsonl(incomplete)), MechanismProposalValidationError);
});

test("rejects claim words anywhere in the free text", () => {
  for (const [field, value] of [
    ["name", "Best opener"],
    ["mechanism", "A proven arrangement that reliably goes viral for any account that uses it."],
    ["adaptation_note", "This one is approved and generation-ready."],
  ] as const) {
    assert.throws(() => readMechanismProposals(jsonl(proposal({ [field]: value }))), MechanismProposalValidationError, `${field} must be linted`);
  }
  assert.throws(
    () => readMechanismProposals(jsonl(proposal({ evidence_limitations: ["this is the winner of the set"] }))),
    MechanismProposalValidationError,
  );
});

test("rejects a claim about what an arrangement does to a reader", () => {
  for (const value of [
    "Flags a session as filling up, creating urgency distinct from an evergreen link.",
    "Uses an admitted failure as the basis for the audience's trust in what follows.",
    "Opens with a number that makes the reader stop scrolling.",
    "Front-loads the payoff so that the audience keeps watching.",
  ]) {
    assert.throws(() => readMechanismProposals(jsonl(proposal({ mechanism: value }))), MechanismProposalValidationError, value);
  }
  // Describing the arrangement itself is fine; only the asserted effect is refused.
  assert.doesNotThrow(() => readMechanismProposals(jsonl(proposal({
    mechanism: "Flags a session as filling up, which is a bounded ask rather than an evergreen link.",
  }))));
});

test("lints the proposal id, because an id is a string a human reads too", () => {
  assert.throws(() => readMechanismProposals(jsonl(proposal({ proposal_id: "mech:hook:best" }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ proposal_id: "mech:hook:proven-viral-opener" }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({
    proposal_id: `mech:hook:${"a".repeat(61)}`,
  }))), MechanismProposalValidationError);
});

test("rejects a quoted run, a link, or an em dash smuggled into free text", () => {
  assert.throws(() => readMechanismProposals(jsonl(proposal({ mechanism: 'Opens by saying "here is the one thing nobody tells you about this" and continues.' }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ mechanism: "Points readers at example.com for the rest of the argument." }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ mechanism: "Names a constraint then supplies the change — before any credential." }))), MechanismProposalValidationError);
});

test("refuses to accept a proposal that claims it has been reviewed or may generate copy", () => {
  assert.throws(() => readMechanismProposals(jsonl(proposal({ review_status: "passed" }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ originality_status: "passed" }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ generates_copy: true }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ creator_body_copy_allowed: true }))), MechanismProposalValidationError);
});

test("rejects malformed ids, refs, families, and duplicates", () => {
  assert.throws(() => readMechanismProposals(jsonl(proposal({ proposal_id: "hook-constraint" }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ proposal_id: "mech:structure:constraint", family: "hook" }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ family: "engagement" }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal({ source_refs: ["fixture-alpha.md line 12"] }))), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals(jsonl(proposal(), proposal())), MechanismProposalValidationError);
  assert.throws(() => readMechanismProposals("{not json}"), MechanismProposalValidationError);
});

test("passes cross-validation when every declared number matches the cited entries", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const report = validateProposalsAgainstCorpus(readMechanismProposals(jsonl(proposal())), index);
  assert.deepEqual(report.findings, []);
  assert.equal(report.passed, true);
  assert.equal(report.source_refs_checked, 4);
});

test("catches a source ref that does not resolve to a parsed entry", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({
    source_refs: ["fixture-alpha.md#entry-1-1", "fixture-alpha.md#entry-1-2", "fixture-alpha.md#entry-1-3", "fixture-alpha.md#entry-9-9"],
  })));
  const report = validateProposalsAgainstCorpus(set, index);
  assert.equal(report.passed, false);
  assert.equal(report.findings[0]!.kind, "unknown-source-ref");
});

test("recomputes support and refuses a declared count the entries do not give", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({
    support: { ...(proposal().support as Record<string, number>), distinct_creator_files: 4 },
  })));
  const report = validateProposalsAgainstCorpus(set, index);
  assert.equal(report.passed, false);
  assert.ok(report.findings.some((finding) => finding.kind === "support-mismatch" && finding.detail.includes("distinct_creator_files")));
});

test("refuses to call repetition by one account cross-creator replication", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({ replication: "cross-creator" })));
  const report = validateProposalsAgainstCorpus(set, index);
  assert.ok(report.findings.some((finding) => finding.kind === "replication-mismatch"));
});

test("counts cross-creator replication only when the cited files actually differ", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({
    platforms: ["bluesky", "x"],
    source_refs: [
      "fixture-alpha.md#entry-1-1",
      "fixture-alpha.md#entry-1-2",
      "fixture-beta.md#entry-1-1",
      "fixture-beta.md#entry-1-2",
    ],
    support: { ...(proposal().support as Record<string, number>), distinct_creator_files: 2, distinct_platforms: 2 },
    replication: "cross-creator",
  })));
  assert.deepEqual(validateProposalsAgainstCorpus(set, index).findings, []);
});

test("makes a third-party entry declare itself and keeps it out of the creator count", () => {
  const { files, raw } = fixtureCorpus(fixtureSource("fixture-alpha.md", "X", [
    plainEntry(1), plainEntry(2), plainEntry(3),
    { ...plainEntry(4), thirdParty: true },
  ]));
  const index = buildCorpusIndex(files, raw);
  const undeclared = readMechanismProposals(jsonl(proposal({
    support: { ...(proposal().support as Record<string, number>), third_party_entries: 1 },
  })));
  const report = validateProposalsAgainstCorpus(undeclared, index);
  assert.ok(report.findings.some((finding) => finding.kind === "third-party-ref-mismatch"));

  const declared = readMechanismProposals(jsonl(proposal({
    third_party_refs: ["fixture-alpha.md#entry-1-4"],
    support: { ...(proposal().support as Record<string, number>), third_party_entries: 1 },
  })));
  assert.deepEqual(validateProposalsAgainstCorpus(declared, index).findings, []);
});

test("downgrades evidence status when a cited capture was partial", () => {
  const { files, raw } = fixtureCorpus(fixtureSource("fixture-alpha.md", "X", [
    plainEntry(1), plainEntry(2), plainEntry(3),
    { ...plainEntry(4), bodyLabel: "Full text (everything visible before the paywall)" },
  ]));
  const index = buildCorpusIndex(files, raw);
  const optimistic = readMechanismProposals(jsonl(proposal()));
  assert.ok(validateProposalsAgainstCorpus(optimistic, index).findings.some((finding) => finding.kind === "evidence-status-mismatch"));

  const honest = readMechanismProposals(jsonl(proposal({
    evidence_status: "partial-capture",
    support: { ...(proposal().support as Record<string, number>), partial_capture_entries: 1, paywalled_entries: 1 },
  })));
  assert.deepEqual(validateProposalsAgainstCorpus(honest, index).findings, []);
});

test("rejects a platform no cited entry supports", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({ platforms: ["x", "youtube"] })));
  assert.ok(validateProposalsAgainstCorpus(set, index).findings.some((finding) => finding.kind === "platform-mismatch"));
});

test("refuses to build a corpus index that cannot run the copy check", () => {
  const { files } = corpus();
  assert.throws(() => buildCorpusIndex(files, new Map()), MechanismProposalValidationError);
});

test("catches a copied run smuggled through the proposal id", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const copied = plainEntry(1).quoted.split(" ").slice(0, 8).join("-");
  const set = readMechanismProposals(jsonl(proposal({ proposal_id: `mech:hook:${copied}` })));
  assert.ok(validateProposalsAgainstCorpus(set, index).findings.some((finding) => finding.kind === "verbatim-overlap"));
});

test("catches an exact-text payload hidden in a description field", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({ mechanism: `Opens with the shape of ${plainEntry(1).quoted} and continues.` })));
  const report = validateProposalsAgainstCorpus(set, index);
  assert.equal(report.passed, false);
  assert.ok(report.findings.some((finding) => finding.kind === "verbatim-overlap"));
});

test("catches a proposal that attributes itself to a named creator", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({
    mechanism: "Names a constraint the reader lives with, the way fixture alpha does, then supplies the smallest change that removes it.",
  })));
  assert.ok(validateProposalsAgainstCorpus(set, index).findings.some((finding) => finding.kind === "creator-named"));
});

test("will not call third-party-only support replication of any kind", () => {
  const { files, raw } = fixtureCorpus(fixtureSource("fixture-alpha.md", "X", [
    { ...plainEntry(1), thirdParty: true },
    { ...plainEntry(2), thirdParty: true },
    { ...plainEntry(3), thirdParty: true },
    { ...plainEntry(4), thirdParty: true },
  ]));
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({
    third_party_refs: [
      "fixture-alpha.md#entry-1-1", "fixture-alpha.md#entry-1-2",
      "fixture-alpha.md#entry-1-3", "fixture-alpha.md#entry-1-4",
    ],
    support: {
      ...(proposal().support as Record<string, number>),
      distinct_creator_files: 0,
      distinct_platforms: 0,
      third_party_entries: 4,
    },
  })));
  assert.ok(validateProposalsAgainstCorpus(set, index).findings.some(
    (finding) => finding.kind === "replication-mismatch" && finding.detail.includes("insufficient"),
  ));
});

test("rejects a first-party entry declared as somebody else's post", () => {
  const { files, raw } = corpus();
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({
    third_party_refs: ["fixture-alpha.md#entry-1-1"],
    support: { ...(proposal().support as Record<string, number>), third_party_entries: 1 },
  })));
  assert.ok(validateProposalsAgainstCorpus(set, index).findings.some(
    (finding) => finding.kind === "third-party-ref-mismatch" && finding.detail.includes("account owner's own post"),
  ));
});

test("catches a short creator name and a typographic hyphen", () => {
  const { files, raw } = fixtureCorpus(
    fixtureSource("dril.md", "Bluesky", [plainEntry(1), plainEntry(2), plainEntry(3), plainEntry(4)]),
  );
  const index = buildCorpusIndex(files, raw);
  const refs = [1, 2, 3, 4].map((entry) => `dril.md#entry-1-${entry}`);
  const short = readMechanismProposals(jsonl(proposal({
    platforms: ["bluesky"],
    source_refs: refs,
    mechanism: "Opens on a flat absurd assertion in the register dril uses, then declines to explain it.",
  })));
  assert.ok(validateProposalsAgainstCorpus(short, index).findings.some((finding) => finding.kind === "creator-named"));

  const { files: nameFiles, raw: nameRaw } = corpus();
  const nameIndex = buildCorpusIndex(nameFiles, nameRaw);
  const hyphenated = readMechanismProposals(jsonl(proposal({
    mechanism: "Names a constraint the way fixture\u2010alpha does, then supplies the smallest change that removes it.",
  })));
  assert.ok(validateProposalsAgainstCorpus(hyphenated, nameIndex).findings.some((finding) => finding.kind === "creator-named"));
});

test("holds a thin cluster below the support floor", () => {
  const { files, raw } = fixtureCorpus(fixtureSource("fixture-alpha.md", "X", [plainEntry(1), plainEntry(2), plainEntry(3)]));
  const index = buildCorpusIndex(files, raw);
  const set = readMechanismProposals(jsonl(proposal({
    source_refs: ["fixture-alpha.md#entry-1-1", "fixture-alpha.md#entry-1-2", "fixture-alpha.md#entry-1-3"],
    support: { ...(proposal().support as Record<string, number>), entries: 3, metric_backed_entries: 3 },
    replication: "insufficient",
    evidence_status: "insufficient",
  })));
  const report = validateProposalsAgainstCorpus(set, index);
  assert.ok(report.findings.some((finding) => finding.kind === "insufficient-support"));
  assert.equal(MINIMUM_SUPPORT_ENTRIES, 4);
});

test("shingles ignore punctuation and case but keep word order", () => {
  const left = shingles("one two three four five six seven eight nine");
  assert.equal(left.has("one two three four five six seven eight"), true);
  assert.equal(left.size, 2);
  assert.equal(shingles("One, TWO. three four five six seven EIGHT!").has("one two three four five six seven eight"), true);
  assert.equal(shingles("eight seven six five four three two one").has("one two three four five six seven eight"), false);
});
