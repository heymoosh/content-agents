import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("analytics schema contains both account-level research tables", () => {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "src", "db", "schema.sql"), "utf8"));

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as { name: string }[];

  assert.ok(tables.some((table) => table.name === "research_observations"));
  assert.ok(tables.some((table) => table.name === "research_observation_classifications"));
  db.close();
});

test("raw research captures are ignored by git before any capture runs", () => {
  assert.doesNotThrow(() =>
    execFileSync("git", ["check-ignore", "data/research/substack-notes/example.json"], {
      cwd: process.cwd(),
      stdio: "ignore",
    })
  );
});
