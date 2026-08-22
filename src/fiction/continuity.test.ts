import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildContinuityPrompt,
  parseContinuityResponse,
  extractJsonObject,
  countOccurrences,
  hasEmDash,
  runContinuityCheck,
  continuityReportPath,
  readContinuityReport,
  CONTINUITY_STEPS,
} from "./continuity.js";

const BODY = [
  "The airlock was quiet.",
  "He ran his gloved hand along the bulkhead, past the frost near the primary vent.",
  "That was when he felt it.",
  "He did not speak into the comms.",
].join("\n");

function wellFormed(extra: Record<string, unknown>[] = []): string {
  return JSON.stringify({
    rules_read: 12,
    items: [
      {
        kind: "conflict",
        rule: "Eli's left hand",
        span: "He ran his gloved hand along the bulkhead",
        canon_says: "He lost two fingers on that hand in chapter one.",
        replacement: "He ran his two remaining fingers along the bulkhead",
        note: "The draft sweeps a whole hand.",
      },
      {
        kind: "hold",
        rule: "space is silent",
        span: "The airlock was quiet.",
        canon_says: "",
        replacement: "",
        note: "No klaxon, no alarm. The dread is the hum.",
      },
      ...extra,
    ],
  });
}

test("parses a well-formed model response into conflicts and holds", () => {
  const r = parseContinuityResponse(wellFormed(), BODY);
  assert.equal(r.rulesRead, 12);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.holds.length, 1);
  const c = r.conflicts[0];
  assert.equal(c.rule, "Eli's left hand");
  assert.equal(c.span, "He ran his gloved hand along the bulkhead");
  assert.equal(c.replacement, "He ran his two remaining fingers along the bulkhead");
  assert.equal(c.canonSays, "He lost two fingers on that hand in chapter one.");
  assert.equal(c.occurrences, 1);
  assert.equal(c.fixable, true);
  assert.equal(r.holds[0].fixable, false);
});

test("a conflict whose span is not in the chapter degrades to an unfixable hold", () => {
  const raw = JSON.stringify({
    items: [{ kind: "conflict", rule: "a rule", span: "a line that was never written", replacement: "something", note: "n" }],
  });
  const r = parseContinuityResponse(raw, BODY);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.holds.length, 1);
  assert.equal(r.holds[0].fixable, false);
  assert.equal(r.holds[0].replacement, "", "an unfixable finding must not carry a replacement Fix the line cannot apply");
});

test("a conflict whose span appears twice degrades too, because there is no single line to fix", () => {
  const twice = "He did not speak.\nSomething moved.\nHe did not speak.";
  const raw = JSON.stringify({
    items: [{ kind: "conflict", rule: "a rule", span: "He did not speak.", replacement: "He said nothing.", note: "n" }],
  });
  const r = parseContinuityResponse(raw, twice);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.holds[0].occurrences, 2);
  assert.equal(r.holds[0].fixable, false);
});

test("a replacement carrying an em dash is never offered as a fix", () => {
  const raw = JSON.stringify({
    items: [{ kind: "conflict", rule: "a rule", span: "That was when he felt it.", replacement: "That was when he felt it — cold.", note: "n" }],
  });
  const r = parseContinuityResponse(raw, BODY);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.holds[0].fixable, false);
  assert.ok(hasEmDash("a — b"));
  assert.ok(!hasEmDash("a, b"));
});

test("tolerates a preamble and a markdown fence around the JSON", () => {
  const raw = "Here is what I found:\n```json\n" + wellFormed() + "\n```\n";
  assert.ok(extractJsonObject(raw));
  const r = parseContinuityResponse(raw, BODY);
  assert.equal(r.conflicts.length, 1);
});

test("refuses output that carries no findings object at all", () => {
  assert.throws(() => parseContinuityResponse("I could not read the chapter.", BODY), /parses as findings/);
  assert.throws(() => parseContinuityResponse("{not json at all}", BODY), /not valid JSON/);
});

test("an empty items array is a valid answer, not an error", () => {
  const r = parseContinuityResponse(JSON.stringify({ rules_read: 3, items: [] }), BODY);
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(r.holds, []);
});

test("countOccurrences counts non-overlapping exact matches", () => {
  assert.equal(countOccurrences("aXbXc", "X"), 2);
  assert.equal(countOccurrences("aaaa", "aa"), 2);
  assert.equal(countOccurrences(BODY, "nowhere"), 0);
  assert.equal(countOccurrences(BODY, ""), 0);
});

test("the prompt bans em dashes and demands a uniquely quotable span", () => {
  const p = buildContinuityPrompt("CANON HERE", BODY);
  assert.ok(p.includes("NO EM DASHES"));
  assert.ok(p.includes("EXACTLY ONCE"));
  assert.ok(p.includes("CANON HERE"));
  assert.ok(p.includes("The airlock was quiet."));
  assert.ok(/do not touch any file/i.test(p));
});

test("runContinuityCheck emits the four steps in order and writes a report outside the series", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-continuity-"));
  try {
    const dir = join(root, "stories", "a-series");
    mkdirSync(join(dir, "chapters"), { recursive: true });
    mkdirSync(join(dir, "characters"), { recursive: true });
    writeFileSync(join(dir, "series.yaml"), "slug: a-series\ntitle: A Series\n");
    writeFileSync(join(dir, "bible.md"), "# A Series\n\nThe world.\n");
    writeFileSync(join(dir, "canon.md"), "# Canon\n\n- Eli lost two fingers on his left hand.\n");
    writeFileSync(join(dir, "characters", "eli.md"), "## Appearance\n\nTwo fingers left on the left hand.\n");
    writeFileSync(
      join(dir, "chapters", "chapter-01.md"),
      `---\nseries: a-series\nchapter: 1\npov: Eli\nstatus: drafting\n---\n\n${BODY}\n`,
    );
    const reportRoot = join(root, "reports");

    const seen: string[] = [];
    let promptSeen = "";
    const report = await runContinuityCheck(dir, 1, {
      root: reportRoot,
      onStep: (n, total, label) => seen.push(`${n}/${total} ${label}`),
      callModel: async (prompt) => {
        promptSeen = prompt;
        return wellFormed();
      },
    });

    assert.deepEqual(seen, CONTINUITY_STEPS.map((label, i) => `${i + 1}/${CONTINUITY_STEPS.length} ${label}`));
    // The canon and the character sheet reached the model through context.ts's own assembly.
    assert.ok(promptSeen.includes("Eli lost two fingers on his left hand."));
    assert.ok(promptSeen.includes("Two fingers left on the left hand."));

    assert.equal(report.series, "a-series");
    assert.equal(report.chapter, 1);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.holds.length, 1);

    const written = JSON.parse(readFileSync(continuityReportPath("a-series", 1, reportRoot), "utf8"));
    assert.equal(written.conflicts[0].span, "He ran his gloved hand along the bulkhead");
    assert.deepEqual(readContinuityReport("a-series", 1, reportRoot)?.conflicts.length, 1);
    assert.equal(readContinuityReport("a-series", 9, reportRoot), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runContinuityCheck refuses a chapter that does not exist", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-continuity-"));
  try {
    const dir = join(root, "stories", "a-series");
    mkdirSync(join(dir, "chapters"), { recursive: true });
    writeFileSync(join(dir, "series.yaml"), "slug: a-series\n");
    writeFileSync(join(dir, "canon.md"), "# Canon\n");
    await assert.rejects(
      () => runContinuityCheck(dir, 4, { root, callModel: async () => wellFormed() }),
      /no chapter 4/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the step labels stay short prose written to Muxin, with no trailing period", () => {
  for (const label of CONTINUITY_STEPS) {
    assert.ok(label.length < 48, `too long: ${label}`);
    assert.ok(!label.endsWith("."), `trailing period: ${label}`);
    assert.ok(!/[—–]/.test(label), `em dash: ${label}`);
  }
});
