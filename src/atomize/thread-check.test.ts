import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadHomeBrand, classifyThread, draftThreadIn, summarizeThreadChecks } from "./thread-check.js";

describe("config/platforms.yaml home_brand: the worldview line the thread-check reads (2026-07-04)", () => {
  const homeBrand = loadHomeBrand();

  test("carries the worldview line and its expanded statement", () => {
    assert.match(homeBrand.worldview, /harmful hidden beliefs/);
    assert.match(homeBrand.worldview_expanded, /unexamined human systems/);
  });

  test("carries signals for judging the connection, not a naive 'is this about AI' check", () => {
    assert.ok(homeBrand.signals.length > 0);
    assert.ok(!homeBrand.signals.some((s) => /^is this (about|an?) ai/i.test(s)));
  });
});

describe("classifyThread: normalizes Claude's inline verdict, fail-safe to missing", () => {
  test('explicit "pass" passes', () => {
    assert.equal(classifyThread({ thread_check: "pass" }), "pass");
  });

  test("omitted field defaults to missing", () => {
    assert.equal(classifyThread({}), "missing");
  });

  test('literal "missing" stays missing', () => {
    assert.equal(classifyThread({ thread_check: "missing" }), "missing");
  });

  test("a stray boolean does not earn a pass (must be the literal string)", () => {
    assert.equal(classifyThread({ thread_check: true }), "missing");
  });

  test("a misspelled or unexpected value defaults to missing", () => {
    assert.equal(classifyThread({ thread_check: "passed" }), "missing");
  });
});

describe("draftThreadIn: Spin weaves the approved worldview language in on missing, never invents new copy", () => {
  const homeBrand = loadHomeBrand();

  test("appends the exact approved worldview_expanded line to the body", () => {
    const { body, fm } = draftThreadIn("Some post text with no worldview connection.", homeBrand);
    assert.match(body, /Some post text with no worldview connection\./);
    assert.ok(body.includes(homeBrand.worldview_expanded.trim()), "woven body must carry the approved line verbatim");
    assert.deepEqual(fm, { thread_check: "pass", thread_spin_applied: true });
  });

  test("is idempotent: drafting in twice does not duplicate the line", () => {
    const once = draftThreadIn("Some post text.", homeBrand);
    const twice = draftThreadIn(once.body, homeBrand);
    assert.equal(twice.body, once.body);
  });
});

describe("summarizeThreadChecks: advisory rollup, never a pass/fail gate", () => {
  test("counts pass vs missing without throwing", () => {
    const result = summarizeThreadChecks([
      { file: "a.md", fm: { thread_check: "pass" } },
      { file: "b.md", fm: {} },
      { file: "c.md", fm: { thread_check: "missing" } },
    ]);
    assert.equal(result.pass, 1);
    assert.equal(result.missing, 2);
    assert.deepEqual(result.missingFiles, ["b.md", "c.md"]);
  });

  test("all-pass reports zero missing", () => {
    const result = summarizeThreadChecks([{ file: "a.md", fm: { thread_check: "pass" } }]);
    assert.equal(result.missing, 0);
    assert.deepEqual(result.missingFiles, []);
  });
});
