import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE } from "../strategy/route.js";
import { classifyHit, readPlaced, OUTREACH_MESSAGE_SOURCE, type Placed } from "./tag-source.js";

function placed(overrides: Partial<Placed> = {}): Placed {
  return {
    platform: "linkedin",
    prefix: "a real prefix long enough",
    spin: false,
    controlRun: false,
    exploration: false,
    outreachMessage: false,
    ctaDestination: null,
    cadenceSource: null,
    ...overrides,
  };
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

describe("readPlaced: parses the ` | cta:<dest>` marker (card d80411bc, strategy lever E)", () => {
  const FIXTURE_PATH = join(repoRoot, "data", ".tag-source-test-bets-cta.md");

  after(() => {
    if (existsSync(FIXTURE_PATH)) unlinkSync(FIXTURE_PATH);
  });

  test("a placed row carrying `| cta:source` parses with ctaDestination: 'source'", () => {
    const line =
      `- placed 2026-07-15T00:00:00.000Z [essay-01/x-1] x → typefully draft 1` +
      ` | cta:source | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].ctaDestination, "source");
  });

  test("a placed row carrying `| cta:work_with_me` parses with the underscored value verbatim", () => {
    const line =
      `- placed 2026-07-15T00:00:00.000Z [essay-01/x-1] x → typefully draft 1` +
      ` | cta:work_with_me | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].ctaDestination, "work_with_me");
  });

  test("a placed row with no cta marker parses with ctaDestination: null", () => {
    const line =
      `- placed 2026-07-10T00:00:00.000Z [some-post/text] x → derivatives/x.md` +
      ` | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].ctaDestination, null);
  });

  test("the marker is scoped before the quoted text, so a quote merely containing 'cta:source' does not false-positive", () => {
    const line =
      `- placed 2026-07-10T00:00:00.000Z [some-post/text] x → derivatives/x.md` +
      ` | "this post happens to say cta:source right here in the text"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].ctaDestination, null);
  });

  test("coexists with other markers (spin + cta together)", () => {
    const line =
      `- placed 2026-07-15T00:00:00.000Z [essay-01/li-1] linkedin → typefully draft 2` +
      ` | spin | cta:project | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    const row = readPlaced(FIXTURE_PATH)[0];
    assert.equal(row.spin, true);
    assert.equal(row.ctaDestination, "project");
  });
});

describe("readPlaced: parses the ` | cadence:<source>` marker (strategy lever C follow-through, epic 2ce597d7)", () => {
  const FIXTURE_PATH = join(repoRoot, "data", ".tag-source-test-bets-cadence.md");

  after(() => {
    if (existsSync(FIXTURE_PATH)) unlinkSync(FIXTURE_PATH);
  });

  test("a placed row carrying `| cadence:override` parses with cadenceSource: 'override'", () => {
    const line =
      `- placed 2026-08-18T00:00:00.000Z [essay-01/x-1] x → typefully draft 1` +
      ` | cadence:override | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].cadenceSource, "override");
  });

  test("a placed row carrying `| cadence:default` parses with cadenceSource: 'default'", () => {
    const line =
      `- placed 2026-08-18T00:00:00.000Z [essay-01/x-1] x → typefully draft 1` +
      ` | cadence:default | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].cadenceSource, "default");
  });

  test("a placed row with no cadence marker parses with cadenceSource: null", () => {
    const line =
      `- placed 2026-08-18T00:00:00.000Z [some-post/text] x → derivatives/x.md` +
      ` | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].cadenceSource, null);
  });

  test("the marker is scoped before the quoted text, so a quote merely containing 'cadence:override' does not false-positive", () => {
    const line =
      `- placed 2026-08-18T00:00:00.000Z [some-post/text] x → derivatives/x.md` +
      ` | "this post happens to say cadence:override right here in the text"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    assert.equal(readPlaced(FIXTURE_PATH)[0].cadenceSource, null);
  });

  test("coexists with the cta marker (cta + cadence together)", () => {
    const line =
      `- placed 2026-08-18T00:00:00.000Z [essay-01/li-1] linkedin → typefully draft 2` +
      ` | cta:project | cadence:default | "a real posted line of text that is long enough to match"\n`;
    writeFileSync(FIXTURE_PATH, `# Placed log\n\n${line}`);
    const row = readPlaced(FIXTURE_PATH)[0];
    assert.equal(row.ctaDestination, "project");
    assert.equal(row.cadenceSource, "default");
  });
});
