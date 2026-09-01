import { test, describe } from "node:test";
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
  unfixableReason,
  continuityEngineSpawn,
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

// A conflict the patch cannot apply keeps its severity and loses only the button. The first two
// tests here used to assert the opposite (the parser rewrote such a conflict into a "hold"), which
// is how a chapter that still broke canon could read as green on the rail and be counted as
// "holding" in the canon stamp. That was the bug; this is the contract.

test("a conflict whose span is not in the chapter stays a conflict and says why it cannot be fixed", () => {
  const raw = JSON.stringify({
    items: [{ kind: "conflict", rule: "a rule", span: "a line that was never written", replacement: "something", note: "n" }],
  });
  const r = parseContinuityResponse(raw, BODY);
  assert.equal(r.conflicts.length, 1, "an unfixable conflict is still a conflict, never a hold");
  assert.equal(r.holds.length, 0);
  assert.equal(r.conflicts[0].kind, "conflict");
  assert.equal(r.conflicts[0].fixable, false);
  assert.equal(r.conflicts[0].unfixableReason, "span-missing");
  assert.equal(r.conflicts[0].replacement, "", "an unfixable finding must not carry a replacement Fix the line cannot apply");
});

test("a conflict whose span appears twice stays a conflict, because ambiguity is not agreement", () => {
  const twice = "He did not speak.\nSomething moved.\nHe did not speak.";
  const raw = JSON.stringify({
    items: [{ kind: "conflict", rule: "a rule", span: "He did not speak.", replacement: "He said nothing.", note: "n" }],
  });
  const r = parseContinuityResponse(raw, twice);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.holds.length, 0);
  assert.equal(r.conflicts[0].occurrences, 2);
  assert.equal(r.conflicts[0].fixable, false);
  assert.equal(r.conflicts[0].unfixableReason, "span-repeats");
});

test("two unfixable conflicts both stay breaking, so the report cannot read as cleared", () => {
  const twice = "He did not speak.\nSomething moved.\nHe did not speak.\nThe hatch held.\nThe hatch held.";
  const raw = JSON.stringify({
    items: [
      { kind: "conflict", rule: "one", span: "He did not speak.", replacement: "He said nothing.", note: "n" },
      { kind: "conflict", rule: "two", span: "The hatch held.", replacement: "The hatch gave.", note: "n" },
    ],
  });
  const r = parseContinuityResponse(raw, twice);
  assert.equal(r.conflicts.length, 2, "both contradictions are still contradictions");
  assert.equal(r.holds.length, 0, "nothing here is holding");
});

test("a declared hold stays a hold, and a fixable conflict carries no unfixable reason", () => {
  const r = parseContinuityResponse(wellFormed(), BODY);
  assert.equal(r.holds[0].kind, "hold");
  assert.equal(r.holds[0].unfixableReason, "");
  assert.equal(r.conflicts[0].unfixableReason, "");
});

test("unfixableReason names which of the three things blocked the fix", () => {
  assert.equal(unfixableReason(0, true), "span-missing");
  assert.equal(unfixableReason(2, true), "span-repeats");
  assert.equal(unfixableReason(1, false), "no-replacement");
  assert.equal(unfixableReason(1, true), "");
});

test("a replacement carrying an em dash is never offered as a fix, and never softens the finding", () => {
  const raw = JSON.stringify({
    items: [{ kind: "conflict", rule: "a rule", span: "That was when he felt it.", replacement: "That was when he felt it \u2014 cold.", note: "n" }],
  });
  const r = parseContinuityResponse(raw, BODY);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].fixable, false);
  assert.equal(r.conflicts[0].unfixableReason, "no-replacement");
  assert.ok(hasEmDash("a \u2014 b"));
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

describe("continuityEngineSpawn -- the canon check stays read-only on every engine", () => {
  test("claude: no permission-mode flag, an empty tool list, and the configured model", () => {
    const { command, args } = continuityEngineSpawn("claude", "READ ONLY");
    assert.equal(command, "claude");
    assert.deepEqual(args, ["-p", "READ ONLY", "--model", "sonnet", "--tools", ""]);
    assert.ok(!args.includes("--permission-mode"), "a report-only run must never carry an approval flag");
  });

  test("grok: same read-only shape as claude, no model override invented for it", () => {
    const { command, args } = continuityEngineSpawn("grok", "READ ONLY");
    assert.equal(command, "grok");
    assert.deepEqual(args, ["-p", "READ ONLY", "--tools", ""]);
  });

  test("codex: --sandbox read-only, not the workspace-write default every other codex call gets", () => {
    const { command, args } = continuityEngineSpawn("codex", "READ ONLY");
    assert.equal(command, "codex");
    assert.deepEqual(args, ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "READ ONLY"]);
  });
});

test("runContinuityCheck takes an engine option without requiring callModel to change", async () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-continuity-engine-"));
  try {
    const dir = join(root, "stories", "a-series");
    mkdirSync(join(dir, "chapters"), { recursive: true });
    writeFileSync(join(dir, "series.yaml"), "slug: a-series\n");
    writeFileSync(join(dir, "canon.md"), "# Canon\n");
    writeFileSync(join(dir, "chapters", "chapter-01.md"), `---\nseries: a-series\nchapter: 1\n---\n\n${BODY}\n`);

    // An injected callModel always wins over the engine choice (it IS the model call), which is
    // what lets every other test in this file stay engine-agnostic. This only proves passing
    // `engine` alongside `callModel` is accepted and does not change the report shape.
    const report = await runContinuityCheck(dir, 1, { root, engine: "codex", callModel: async () => wellFormed() });
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.engine, "codex");
    assert.equal(readContinuityReport("a-series", 1, root)?.engine, "codex");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
