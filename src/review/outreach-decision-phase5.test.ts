import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

const serve = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.ts", import.meta.url), "utf8");

test("a GUI pass requires and persists a reason for future Scout anti-examples", () => {
  assert.match(serve, /decision === "pass" && !reason/);
  assert.match(serve, /Muxin decided \$\{decision\}.*\$\{reasonSuffix\}/s);
  assert.match(page, /out-pass-reason/);
  assert.match(page, /Scout learns from this/);
  assert.match(page, /\{dir, decision, reason\}/);
});
