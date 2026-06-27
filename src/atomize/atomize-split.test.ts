/**
 * Structural tests for the atomize skill refactor (#45):
 * SKILL.md was split so each non-default mode (notes, spin, revise) lives in its own
 * references/*.md file, and SKILL.md dispatches to each.
 *
 * These tests don't execute any application code — they assert the file structure and
 * frontmatter shape the skill harness depends on so regressions (e.g. a file deleted,
 * a frontmatter key renamed, a dispatch line removed) are caught immediately.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Skill directory relative to this test file: src/atomize/../../.claude/skills/atomize
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skillDir = join(repoRoot, ".claude", "skills", "atomize");
const skillMd  = join(skillDir, "SKILL.md");

describe("atomize skill split structure (#45)", () => {
  test("SKILL.md exists", () => {
    assert.ok(existsSync(skillMd), `SKILL.md missing at ${skillMd}`);
  });

  test("SKILL.md has YAML frontmatter block", () => {
    const content = readFileSync(skillMd, "utf8");
    assert.ok(content.startsWith("---\n"), "SKILL.md must start with '---' (YAML frontmatter)");
    const closeIdx = content.indexOf("\n---\n", 3);
    assert.ok(closeIdx > 0, "SKILL.md frontmatter must be closed with '---'");
  });

  test("SKILL.md frontmatter declares name: atomize", () => {
    const content = readFileSync(skillMd, "utf8");
    const closeIdx = content.indexOf("\n---\n", 3);
    const frontmatter = content.slice(0, closeIdx);
    assert.ok(
      frontmatter.includes("name: atomize"),
      `frontmatter must contain 'name: atomize'; got:\n${frontmatter}`
    );
  });

  test("references/notes-mode.md exists", () => {
    const p = join(skillDir, "references", "notes-mode.md");
    assert.ok(existsSync(p), `notes-mode.md missing at ${p}`);
  });

  test("references/spin-mode.md exists", () => {
    const p = join(skillDir, "references", "spin-mode.md");
    assert.ok(existsSync(p), `spin-mode.md missing at ${p}`);
  });

  test("references/revise-mode.md exists", () => {
    const p = join(skillDir, "references", "revise-mode.md");
    assert.ok(existsSync(p), `revise-mode.md missing at ${p}`);
  });

  test("SKILL.md dispatch block references notes-mode.md", () => {
    const content = readFileSync(skillMd, "utf8");
    assert.ok(
      content.includes("references/notes-mode.md"),
      "SKILL.md must reference references/notes-mode.md in its dispatch block"
    );
  });

  test("SKILL.md dispatch block references spin-mode.md", () => {
    const content = readFileSync(skillMd, "utf8");
    assert.ok(
      content.includes("references/spin-mode.md"),
      "SKILL.md must reference references/spin-mode.md in its dispatch block"
    );
  });

  test("SKILL.md dispatch block references revise-mode.md", () => {
    const content = readFileSync(skillMd, "utf8");
    assert.ok(
      content.includes("references/revise-mode.md"),
      "SKILL.md must reference references/revise-mode.md in its dispatch block"
    );
  });
});
