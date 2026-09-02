import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { muxinVoiceFindings } from "./configured.js";

describe("muxinVoiceFindings", () => {
  test("accepts direct prose that follows the hard voice rules", () => {
    assert.deepEqual(muxinVoiceFindings("You test the assumption before launch. Worth a short call?"), []);
  });

  test("finds the hard punctuation, cadence, colon, and footnote violations", () => {
    const cases: Array<[string, RegExp]> = [
      ["Bad dash — here.", /em dash/i],
      ["Here’s the thing. We should talk.", /AI tell/i],
      ["This isn't evidence. It's theater.", /AI tell/i],
      ["The point isn't defending the plan, it's finding the break.", /AI tell/i],
      ["The point: this starts lowercase.", /lowercase after a colon/i],
      ["A claim.[^1]", /footnote/i],
    ];
    for (const [body, expected] of cases) {
      assert.ok(muxinVoiceFindings(body).some((finding) => expected.test(finding)), body);
    }
  });
});
