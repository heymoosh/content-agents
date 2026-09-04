import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVentureMention, resolveVentureMention, ventureCandidates, ventureDisplayName } from "./venture-resolver.js";

const VENTURES = ventureCandidates(["pricing-sprint", "newsletter-lab", "newsletter-lab-2"]);

test("display names read the slug's separators as spaces; candidates carry both", () => {
  assert.equal(ventureDisplayName("pricing-sprint"), "pricing sprint");
  assert.equal(ventureDisplayName("zz_test__phase2"), "zz test phase2");
  assert.deepEqual(ventureCandidates(["a-b"]), [{ slug: "a-b", name: "a b" }]);
  assert.equal(normalizeVentureMention("  The Pricing-Sprint!! "), "the pricing sprint");
});

test("exact slug or name match resolves, case- and separator-insensitively", () => {
  assert.deepEqual(resolveVentureMention("pricing-sprint", VENTURES), { kind: "resolved", slug: "pricing-sprint" });
  assert.deepEqual(resolveVentureMention("  Pricing Sprint ", VENTURES), { kind: "resolved", slug: "pricing-sprint" });
  // An exact hit wins even when it is also a fragment of a longer venture.
  assert.deepEqual(resolveVentureMention("newsletter-lab", VENTURES), { kind: "resolved", slug: "newsletter-lab" });
});

test("a natural-language mention naming one venture as whole words resolves; a fragment shared by two is ambiguous", () => {
  assert.deepEqual(resolveVentureMention("a probe post idea for the pricing sprint, tomorrow", VENTURES), { kind: "resolved", slug: "pricing-sprint" });
  assert.deepEqual(resolveVentureMention("sprint", VENTURES), { kind: "resolved", slug: "pricing-sprint" });
  const ambiguous = resolveVentureMention("newsletter", VENTURES);
  assert.equal(ambiguous.kind, "ambiguous");
  assert.deepEqual(ambiguous.kind === "ambiguous" ? ambiguous.candidates.map((c) => c.slug) : [], ["newsletter-lab", "newsletter-lab-2"]);
  // Whole words only: "sprinter" is not the pricing sprint.
  assert.deepEqual(resolveVentureMention("a note about a sprinter", VENTURES), { kind: "none" });
  assert.deepEqual(resolveVentureMention("an idea with no venture in it", VENTURES), { kind: "none" });
});

test("an empty mention resolves only when exactly one venture exists", () => {
  assert.deepEqual(resolveVentureMention("", VENTURES.slice(0, 1)), { kind: "resolved", slug: "pricing-sprint" });
  assert.deepEqual(resolveVentureMention("   ", []), { kind: "none" });
  const all = resolveVentureMention("", VENTURES);
  assert.equal(all.kind, "ambiguous");
  assert.equal(all.kind === "ambiguous" ? all.candidates.length : 0, 3);
});

test("the resolver is deterministic and never mutates its input", () => {
  const frozen = Object.freeze(VENTURES.map((v) => Object.freeze({ ...v })));
  const first = resolveVentureMention("newsletter", frozen);
  const second = resolveVentureMention("newsletter", frozen);
  assert.deepEqual(first, second);
  assert.deepEqual(resolveVentureMention("not-a-venture-slug", VENTURES), { kind: "none" }, "a bare unknown slug is not taken on trust");
});
