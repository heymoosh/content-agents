/**
 * Unit tests for src/config/load.ts loadYamlConfig — the shared "missing file falls back,
 * anything else throws loudly" contract every config loader in this repo now relies on.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { loadYamlConfig } from "./load.js";

const FIXTURE_DIR = join(process.cwd(), "data", "test-fixture-config-load");
const schema = z.object({ max_chars: z.number() });

describe("loadYamlConfig", () => {
  before(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  after(() => {
    if (existsSync(FIXTURE_DIR)) rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  test("a genuinely missing file (ENOENT) falls back to the provided default", () => {
    const missingPath = join(FIXTURE_DIR, "does-not-exist.yaml");
    const result = loadYamlConfig(missingPath, schema, { max_chars: 999 });
    assert.deepEqual(result, { max_chars: 999 });
  });

  test("malformed YAML throws, naming the file path", () => {
    const badPath = join(FIXTURE_DIR, "bad-yaml.yaml");
    writeFileSync(badPath, "max_chars: [this is not valid yaml::\n  - broken\n");
    assert.throws(
      () => loadYamlConfig(badPath, schema, { max_chars: 0 }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes(badPath), `error should name the file path, got: ${err.message}`);
        return true;
      }
    );
  });

  test("a field with the wrong type throws a validation error naming the file and field", () => {
    const wrongTypePath = join(FIXTURE_DIR, "wrong-type.yaml");
    writeFileSync(wrongTypePath, 'max_chars: "not a number"\n');
    assert.throws(
      () => loadYamlConfig(wrongTypePath, schema, { max_chars: 0 }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes(wrongTypePath), "error should name the file path");
        assert.match(err.message, /max_chars/);
        return true;
      }
    );
  });

  test("a required field missing throws, naming the field", () => {
    const missingFieldPath = join(FIXTURE_DIR, "missing-field.yaml");
    writeFileSync(missingFieldPath, "other_field: 1\n");
    assert.throws(() => loadYamlConfig(missingFieldPath, schema, { max_chars: 0 }), /max_chars/);
  });

  test("a valid file matching the schema loads and validates without throwing", () => {
    const goodPath = join(FIXTURE_DIR, "good.yaml");
    writeFileSync(goodPath, "max_chars: 280\n");
    const result = loadYamlConfig(goodPath, schema, { max_chars: 0 });
    assert.deepEqual(result, { max_chars: 280 });
  });

  test("an unreadable-but-present file (not ENOENT) still throws, does not fall back", () => {
    // A directory at the expected file path fails with EISDIR, not ENOENT — must NOT be
    // treated as "missing" and silently fall back.
    const dirPath = join(FIXTURE_DIR, "actually-a-directory.yaml");
    mkdirSync(dirPath);
    assert.throws(() => loadYamlConfig(dirPath, schema, { max_chars: 0 }));
  });
});
