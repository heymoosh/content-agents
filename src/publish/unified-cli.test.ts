import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("every legacy publishing CLI delegates writes to the capability-selected path", () => {
  for (const file of ["typefully.ts", "cards.ts", "tiktok.ts", "youtube.ts", "substack.ts"]) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /publishApprovedViaConfiguredProviders/, file);
  }
});
