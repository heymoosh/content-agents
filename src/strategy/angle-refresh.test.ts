import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { loadSpinAngles } from "../atomize/spin.js";
import {
  classifyVerdict,
  compareAngles,
  divergencesOnly,
  formatDriftReport,
  parseCandidates,
} from "./angle-refresh.js";

describe("classifyVerdict: fail-safe like classifyThread — anything but literal 'match' surfaces as drift", () => {
  test('explicit "match" passes', () => {
    assert.equal(classifyVerdict("match"), "match");
  });

  test("omitted verdict defaults to drift", () => {
    assert.equal(classifyVerdict(undefined), "drift");
  });

  test('literal "drift" stays drift', () => {
    assert.equal(classifyVerdict("drift"), "drift");
  });

  test("a stray boolean does not earn a match", () => {
    assert.equal(classifyVerdict(true), "drift");
  });
});

describe("compareAngles: freshly-derived candidate vs. the encoded approved angle, per channel", () => {
  test("verdict 'match' -> drift: false, carries both texts", () => {
    const [x] = compareAngles([{ channel: "x", candidate: "Approved X angle.", verdict: "match" }], {
      x: { angle: "Approved X angle." },
    });
    assert.equal(x.drift, false);
    assert.equal(x.approved, "Approved X angle.");
    assert.equal(x.candidate, "Approved X angle.");
  });

  test("verdict 'drift' -> drift: true, carries the rationale", () => {
    const [x] = compareAngles(
      [{ channel: "x", candidate: "A meaningfully different angle.", verdict: "drift", rationale: "content-ideas shifted to Y" }],
      { x: { angle: "Old X angle." } }
    );
    assert.equal(x.drift, true);
    assert.equal(x.rationale, "content-ideas shifted to Y");
  });

  test("a channel with no candidate derived surfaces as drift, not silently skipped", () => {
    const [li] = compareAngles([], { linkedin: { angle: "Approved LinkedIn angle." } });
    assert.equal(li.drift, true);
    assert.match(li.candidate, /no candidate/);
  });

  test("covers every approved channel, sorted, independent of candidate order", () => {
    const comparisons = compareAngles(
      [
        { channel: "x", candidate: "c1", verdict: "match" },
        { channel: "linkedin", candidate: "c2", verdict: "match" },
      ],
      { x: { angle: "a1" }, linkedin: { angle: "a2" } }
    );
    assert.deepEqual(
      comparisons.map((c) => c.channel),
      ["linkedin", "x"]
    );
  });

  test("channel matching is lenient on case/whitespace — a real candidate is never mistaken for a missing one", () => {
    const [x] = compareAngles([{ channel: " X ", candidate: "c1", verdict: "drift", rationale: "shifted" }], {
      x: { angle: "Approved X angle." },
    });
    assert.equal(x.drift, true);
    assert.equal(x.candidate, "c1");
    assert.equal(x.rationale, "shifted");
  });

  test("an approved angle that is missing/non-string throws a clear config error instead of crashing on .trim()", () => {
    assert.throws(
      () => compareAngles([], { x: { angle: undefined as unknown as string } }),
      /spin_angles\.x\.angle is missing or not a string/
    );
  });
});

describe("parseCandidates: validates untrusted CLI/file JSON before it reaches compareAngles", () => {
  test("valid array of candidates parses through unchanged", () => {
    const candidates = parseCandidates('[{"channel":"x","candidate":"c1","verdict":"match"}]');
    assert.deepEqual(candidates, [{ channel: "x", candidate: "c1", verdict: "match" }]);
  });

  test("malformed JSON throws a clear error, not a raw SyntaxError crash", () => {
    assert.throws(() => parseCandidates("not valid json"), /candidates JSON is not valid JSON/);
  });

  test("valid JSON that isn't an array throws a clear error", () => {
    assert.throws(() => parseCandidates('{"channel":"x"}'), /must be an array/);
  });

  test("a candidate missing the channel field throws a clear error", () => {
    assert.throws(() => parseCandidates('[{"candidate":"c1"}]'), /non-empty "channel" string/);
  });

  test("a candidate missing the candidate field throws a clear error", () => {
    assert.throws(() => parseCandidates('[{"channel":"x"}]'), /needs a "candidate" string/);
  });

  test("duplicate channels (even differing in case) throw instead of silently last-write-wins", () => {
    assert.throws(
      () => parseCandidates('[{"channel":"x","candidate":"c1"},{"channel":"X","candidate":"c2"}]'),
      /duplicate channel/
    );
  });
});

describe("divergencesOnly / formatDriftReport: report divergences only, matches stay silent", () => {
  test("all matches -> no divergences, report says so", () => {
    const comparisons = compareAngles([{ channel: "x", candidate: "Approved X angle.", verdict: "match" }], {
      x: { angle: "Approved X angle." },
    });
    assert.deepEqual(divergencesOnly(comparisons), []);
    assert.match(formatDriftReport(comparisons), /No drift/);
  });

  test("zero approved channels reports the config gap, not a vacuous all-clear", () => {
    const report = formatDriftReport(compareAngles([], {}));
    assert.doesNotMatch(report, /No drift: all 0/);
    assert.match(report, /nothing to compare/);
  });

  test("a drifted channel is reported with approved + candidate + rationale", () => {
    const comparisons = compareAngles(
      [{ channel: "x", candidate: "A new angle.", verdict: "drift", rationale: "shifted focus" }],
      { x: { angle: "Old angle." } }
    );
    const report = formatDriftReport(comparisons);
    assert.match(report, /- x/);
    assert.match(report, /Old angle\./);
    assert.match(report, /A new angle\./);
    assert.match(report, /shifted focus/);
  });

  test("a matching channel's text never appears in the report while another channel drifts", () => {
    const comparisons = compareAngles(
      [
        { channel: "x", candidate: "Unchanged angle.", verdict: "match" },
        { channel: "linkedin", candidate: "New LinkedIn angle.", verdict: "drift" },
      ],
      { x: { angle: "Unchanged angle." }, linkedin: { angle: "Prior LinkedIn angle." } }
    );
    const report = formatDriftReport(comparisons);
    assert.equal(divergencesOnly(comparisons).length, 1);
    assert.doesNotMatch(report, /Unchanged angle\./);
    assert.match(report, /Prior LinkedIn angle\./);
  });
});

describe("zero-write guarantee: this step never modifies config/platforms.yaml", () => {
  test("running the full comparison against the real approved angles leaves the file untouched", () => {
    const path = join(repoRoot, "config", "platforms.yaml");
    const before = readFileSync(path, "utf8");
    const beforeMtime = statSync(path).mtimeMs;

    const approved = loadSpinAngles();
    const candidates = Object.keys(approved).map((channel) => ({
      channel,
      candidate: approved[channel].angle,
      verdict: "match",
    }));
    formatDriftReport(compareAngles(candidates, approved));

    assert.equal(readFileSync(path, "utf8"), before, "file content must be byte-for-byte unchanged");
    assert.equal(statSync(path).mtimeMs, beforeMtime, "file must not have been touched (mtime unchanged)");
  });
});
