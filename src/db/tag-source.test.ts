import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE } from "../strategy/route.js";
import { classifyHit, readPlaced, OUTREACH_MESSAGE_SOURCE, type Placed } from "./tag-source.js";

function placed(overrides: Partial<Placed> = {}): Placed {
  return { platform: "linkedin", prefix: "a real prefix long enough", spin: false, controlRun: false, exploration: false, outreachMessage: false, ...overrides };
}

describe("classifyHit: outreach-message classification + priority ordering", () => {
  test("a hit with no markers classifies as plain atomized", () => {
    assert.deepEqual(classifyHit(placed()), { value: "atomized", tag: "" });
  });

  test("no hit at all (undefined) classifies as plain atomized", () => {
    assert.deepEqual(classifyHit(undefined), { value: "atomized", tag: "" });
  });

  test("outreachMessage alone classifies as atomized-outreach", () => {
    assert.deepEqual(classifyHit(placed({ outreachMessage: true })), {
      value: OUTREACH_MESSAGE_SOURCE,
      tag: " (outreach-message)",
    });
  });

  test("outreachMessage outranks spin", () => {
    assert.deepEqual(classifyHit(placed({ outreachMessage: true, spin: true })), {
      value: OUTREACH_MESSAGE_SOURCE,
      tag: " (outreach-message)",
    });
  });

  test("controlRun outranks outreachMessage", () => {
    assert.deepEqual(classifyHit(placed({ outreachMessage: true, controlRun: true })), {
      value: CONTROL_RUN_SOURCE,
      tag: " (control-run)",
    });
  });

  test("exploration outranks outreachMessage", () => {
    assert.deepEqual(classifyHit(placed({ outreachMessage: true, exploration: true })), {
      value: EXPLORATION_SOURCE,
      tag: " (exploration)",
    });
  });
});

describe("readPlaced: parses the ` | outreach-message` marker out of briefs/bets.md placed rows", () => {
  const FIXTURE_PATH = join(repoRoot, "data", ".tag-source-test-bets.md");

  after(() => {
    if (existsSync(FIXTURE_PATH)) unlinkSync(FIXTURE_PATH);
  });

  test("a placed row carrying the outreach-message marker parses with outreachMessage: true", () => {
    const line =
      `- placed 2026-07-10T00:00:00.000Z [client-posthog/message-01] linkedin → derivatives/li.md` +
      ` | outreach-message | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    const rows = readPlaced(FIXTURE_PATH);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outreachMessage, true);
    assert.equal(rows[0].platform, "linkedin");
  });

  test("a placed row with no outreach-message marker parses with outreachMessage: false", () => {
    const line =
      `- placed 2026-07-10T00:00:00.000Z [some-post/text] x → derivatives/x.md` +
      ` | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].outreachMessage, false);
  });

  test("the marker is scoped before the quoted text, so a quote merely containing the words 'outreach-message' does not false-positive", () => {
    const line =
      `- placed 2026-07-10T00:00:00.000Z [some-post/text] x → derivatives/x.md` +
      ` | "this post happens to say outreach-message right here in the text"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].outreachMessage, false);
  });

  test("a missing bets.md file returns an empty array, no throw", () => {
    assert.deepEqual(readPlaced(join(repoRoot, "data", ".tag-source-test-bets-nonexistent.md")), []);
  });
});
