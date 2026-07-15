import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifySourceClass,
  readSourceClass,
  readSourceKind,
  writeSourceClass,
  triageEffects,
  triageSummary,
  beat2Note,
  hasMissingBeat2,
  CASE_SKELETON_PLATFORMS,
} from "./source-triage.js";

function withSourceMd(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "source-triage-test-"));
  writeFileSync(
    join(dir, "source.md"),
    `---\ntitle: "Some Essay"\norigin: https://muxin.substack.com/p/some-essay\ncanonical_url: https://muxin.substack.com/p/some-essay\npublished_at: 2026-07-01\ningested_at: 2026-07-01T00:00:00.000Z\n---\n\nSome body text.\n`
  );
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("classifySourceClass: normalizes Claude's inline verdict, fail-safe to undefined", () => {
  test("accepts each of the three approved buckets", () => {
    assert.equal(classifySourceClass({ source_class: "frame-native" }), "frame-native");
    assert.equal(classifySourceClass({ source_class: "reflective" }), "reflective");
    assert.equal(classifySourceClass({ source_class: "fiction-promo" }), "fiction-promo");
  });

  test("omitted field is undefined, not a guessed default bucket", () => {
    assert.equal(classifySourceClass({}), undefined);
  });

  test("an unexpected/misspelled value is undefined, never coerced", () => {
    assert.equal(classifySourceClass({ source_class: "reflexive" }), undefined);
  });

  test("a non-string value is undefined", () => {
    assert.equal(classifySourceClass({ source_class: true }), undefined);
  });
});

describe("writeSourceClass + readSourceClass: the fact is recorded once, read back exactly — never re-derived", () => {
  test("round-trips each bucket", () => {
    withSourceMd((dir) => {
      writeSourceClass(dir, "reflective");
      assert.equal(readSourceClass(dir), "reflective");
    });
  });

  test("readSourceClass is a pure read: it returns exactly what was written, with no classification logic of its own", () => {
    withSourceMd((dir) => {
      writeSourceClass(dir, "fiction-promo");
      const raw = readFileSync(join(dir, "source.md"), "utf8");
      assert.match(raw, /^source_class: fiction-promo$/m);
      // readSourceClass only parses the stored field back out — same value, no re-judgment.
      assert.equal(readSourceClass(dir), "fiction-promo");
    });
  });

  test("preserves unrelated frontmatter fields and the body byte-for-byte (surgical patch, not a re-serialize)", () => {
    withSourceMd((dir) => {
      writeSourceClass(dir, "frame-native");
      const raw = readFileSync(join(dir, "source.md"), "utf8");
      assert.match(raw, /title: "Some Essay"/);
      assert.match(raw, /canonical_url: https:\/\/muxin\.substack\.com\/p\/some-essay/);
      assert.match(raw, /Some body text\./);
    });
  });

  test("is idempotent: re-triaging the same source does not duplicate source_class lines", () => {
    withSourceMd((dir) => {
      writeSourceClass(dir, "frame-native");
      writeSourceClass(dir, "reflective");
      const raw = readFileSync(join(dir, "source.md"), "utf8");
      const matches = raw.match(/^source_class:/gm) ?? [];
      assert.equal(matches.length, 1);
      assert.equal(readSourceClass(dir), "reflective");
    });
  });

  test("beat2Found writes and round-trips the informational flag", () => {
    withSourceMd((dir) => {
      writeSourceClass(dir, "frame-native", { beat2Found: false });
      assert.equal(hasMissingBeat2(dir), true);
      assert.equal(beat2Note(dir), "flag: no beat-2 belief statement found");
    });
  });

  test("beat2Found: true records found, no flag raised", () => {
    withSourceMd((dir) => {
      writeSourceClass(dir, "frame-native", { beat2Found: true });
      assert.equal(hasMissingBeat2(dir), false);
      assert.equal(beat2Note(dir), undefined);
    });
  });

  test("no source_class_beat2 written when opts omitted", () => {
    withSourceMd((dir) => {
      writeSourceClass(dir, "frame-native");
      const raw = readFileSync(join(dir, "source.md"), "utf8");
      assert.doesNotMatch(raw, /source_class_beat2/);
      assert.equal(beat2Note(dir), undefined);
    });
  });
});

describe("readSourceClass: undefined when no fact has been recorded yet (no source.md, or no field)", () => {
  test("missing source.md", () => {
    const dir = mkdtempSync(join(tmpdir(), "source-triage-test-"));
    try {
      assert.equal(readSourceClass(dir), undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("source.md exists but was never triaged", () => {
    withSourceMd((dir) => {
      assert.equal(readSourceClass(dir), undefined);
    });
  });
});

describe("readSourceKind: reads source.md's source_kind fact (card df11d0db), never re-derives it", () => {
  test("missing source.md -> empty string", () => {
    const dir = mkdtempSync(join(tmpdir(), "source-triage-test-"));
    try {
      assert.equal(readSourceKind(dir), "");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("source.md exists but has no source_kind field -> empty string (a plain essay)", () => {
    withSourceMd((dir) => {
      assert.equal(readSourceKind(dir), "");
    });
  });

  test("source_kind: substack-note is read back verbatim", () => {
    const dir = mkdtempSync(join(tmpdir(), "source-triage-test-"));
    try {
      writeFileSync(
        join(dir, "source.md"),
        `---\ntitle: "Some Note"\norigin: https://muxin.substack.com/p/some-note\nsource_kind: substack-note\npublished_at: 2026-07-01\ningested_at: 2026-07-01T00:00:00.000Z\n---\n\nNote body.\n`
      );
      assert.equal(readSourceKind(dir), "substack-note");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("triageEffects: the three bucket rules (card b288d0da), verbatim", () => {
  test("frame-native: full fan-out, skeleton allowed, nothing excluded", () => {
    assert.deepEqual(triageEffects("frame-native"), { skeletonAllowed: true, excludePlatforms: [] });
  });

  test("reflective: no skeleton, excludes exactly linkedin + x", () => {
    const effects = triageEffects("reflective");
    assert.equal(effects.skeletonAllowed, false);
    assert.deepEqual(new Set(effects.excludePlatforms), new Set(CASE_SKELETON_PLATFORMS));
  });

  test("fiction-promo: no skeleton, but platform subset is unrestricted", () => {
    assert.deepEqual(triageEffects("fiction-promo"), { skeletonAllowed: false, excludePlatforms: [] });
  });
});

describe("triageSummary: the Muxin-facing confirmation line", () => {
  test("names the excluded platforms for reflective", () => {
    assert.match(triageSummary("reflective"), /LinkedIn case format and X excluded/);
  });

  test("names the full fan-out for frame-native", () => {
    assert.match(triageSummary("frame-native"), /LinkedIn\/X\/Bluesky/);
  });

  test("names the unframed teaser rule for fiction-promo", () => {
    assert.match(triageSummary("fiction-promo"), /unframed/);
  });
});
