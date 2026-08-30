import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  FICTION_VENTURE_ID,
  createFictionContentHandoff,
  toContentRequestInput,
  type FictionContentHandoffInput,
} from "./fiction-content-handoff.js";

const base: FictionContentHandoffInput = {
  id: "fiction-launch-1",
  series: { id: "least-of-us", title: "The Least of Us" },
  chapter: { number: 3, title: "The Door Beneath the City" },
  sourcePassages: [
    { ref: "chapter-03:line-12", text: "The door remembered her hand.", locked: true },
    { ref: "chapter-03:line-13", text: "Beyond it, the city held its breath.", locked: true },
  ],
  restrictions: {
    canon: ["Do not contradict the established history of the city."],
    provenance: ["Quote only the locked passages supplied in this handoff."],
  },
  suggestedPromotionalObjective: "Invite readers to begin the serialized story.",
  descriptor: "A door that remembers",
  originalInput: "Promote chapter 3 with a tense, spoiler-light launch note.\nKeep the mystery intact.",
};

describe("fiction content handoff", () => {
  test("creates a locked, provenance-constrained fiction handoff", () => {
    const handoff = createFictionContentHandoff(base);
    assert.equal(handoff.origin, "fiction");
    assert.deepEqual(handoff.series, base.series);
    assert.deepEqual(handoff.chapter, base.chapter);
    assert.deepEqual(handoff.sourcePassages, base.sourcePassages);
    assert.deepEqual(handoff.restrictions, base.restrictions);
    assert.equal(handoff.originalInput, base.originalInput);
  });

  test("rejects incomplete identity, unlocked or missing passages, and empty restrictions", () => {
    assert.throws(() => createFictionContentHandoff({ ...base, chapter: { number: 0, title: "" } }), /chapter/i);
    assert.throws(() => createFictionContentHandoff({ ...base, sourcePassages: [] }), /passage/i);
    assert.throws(() => createFictionContentHandoff({ ...base, sourcePassages: [{ ...base.sourcePassages[0], locked: false }] }), /locked/i);
    assert.throws(() => createFictionContentHandoff({ ...base, restrictions: { ...base.restrictions, canon: [] } }), /canon/i);
    assert.throws(() => createFictionContentHandoff({ ...base, restrictions: { ...base.restrictions, provenance: [] } }), /provenance/i);
  });

  test("converts to the ordinary content request input without selecting a CTA", () => {
    const handoff = createFictionContentHandoff(base);
    const input = toContentRequestInput(handoff);
    assert.equal(input.origin, "fiction");
    assert.equal(input.ventureId, FICTION_VENTURE_ID);
    assert.equal(input.originalInput, base.originalInput);
    assert.equal(input.descriptor, base.descriptor);
    assert.equal("cta" in input, false);
    assert.match(input.originalInput, /spoiler-light/);
  });
});
