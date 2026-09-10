import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { repoRoot } from "../db/db.js";
import { dotenvInjectedKeys, withoutDotenvKeys } from "./env.js";

const execFileP = promisify(execFile);

// The child prints its own environment's key list, so every assertion below is about the process
// that actually ran, not about the argument we passed.
const PRINT_KEYS = "process.stdout.write(JSON.stringify(Object.keys(process.env)))";

function requireInjectedKeys(): ReadonlySet<string> {
  assert.ok(
    dotenvInjectedKeys.size > 0,
    `dotenvInjectedKeys is empty: no .env was loaded from ${join(repoRoot, ".env")}, so this test ` +
      `would pass vacuously. Run it unsandboxed from the repository root with the real .env present.`,
  );
  return dotenvInjectedKeys;
}

function assertStripped(childKeys: string[], injected: ReadonlySet<string>): void {
  const leaked = childKeys.filter((k) => injected.has(k));
  assert.deepEqual(leaked, [], `child inherited .env-injected keys: ${leaked.join(", ")}`);
  assert.ok(childKeys.includes("PATH"), "child lost PATH, so the environment was over-stripped");
}

test("a real spawn child under withoutDotenvKeys() sees no .env key and keeps PATH", async () => {
  const injected = requireInjectedKeys();
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", PRINT_KEYS], { env: withoutDotenvKeys() });
    let out = "";
    child.stdout.on("data", (c) => (out += c.toString("utf8")));
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`child exited ${code}`))));
  });
  assertStripped(JSON.parse(stdout) as string[], injected);
});

test("a real execFile child under withoutDotenvKeys() sees no .env key and keeps PATH", async () => {
  const injected = requireInjectedKeys();
  const { stdout } = await execFileP(process.execPath, ["-e", PRINT_KEYS], { env: withoutDotenvKeys() });
  assertStripped(JSON.parse(stdout) as string[], injected);
});

// Source guard. Each entry anchors the ONE agent-CLI spawn site in its file; the window is the
// call's own options object, so reverting that site fails here even though the file still imports
// the helper elsewhere.
const AGENT_SPAWN_SITES: ReadonlyArray<{ file: string; anchor: string; window: number }> = [
  { file: "src/atomize/reply-draft.ts", anchor: `const child = spawn("claude", ["-p", prompt, "--tools", ""], {`, window: 300 },
  { file: "src/outreach/research.ts", anchor: "const r = await execFileP(", window: 900 },
  { file: "src/providers/polish/claude-cli.ts", anchor: `const r = await execFileP("claude", ["-p", prompt, "--model", model], {`, window: 300 },
  { file: "src/fiction/continuity.ts", anchor: "const { stdout } = await execFileP(command, args, {", window: 300 },
  { file: "src/fiction/idea-inbox.ts", anchor: "const child = spawn(built.command, built.args, {", window: 250 },
  { file: "src/fiction/review-pr.ts", anchor: "const child = spawn(built.command, built.args, {", window: 250 },
];

test("every agent-CLI spawn site narrows the child environment", () => {
  const offenders: string[] = [];
  for (const site of AGENT_SPAWN_SITES) {
    const source = readFileSync(join(repoRoot, site.file), "utf8");
    const at = source.indexOf(site.anchor);
    assert.notEqual(at, -1, `${site.file}: spawn-site anchor not found, so this guard is not checking anything`);
    if (!source.slice(at, at + site.anchor.length + site.window).includes("withoutDotenvKeys")) offenders.push(site.file);
  }
  assert.deepEqual(offenders, [], `agent-CLI spawn sites still inheriting .env: ${offenders.join(", ")}`);
});

test("review-pr's git/gh runner still gets the full environment", () => {
  const source = readFileSync(join(repoRoot, "src/fiction/review-pr.ts"), "utf8");
  const at = source.indexOf("const result = await execFileP(command, args, {");
  assert.notEqual(at, -1, "defaultRun's exec call moved; re-anchor this guard");
  assert.ok(
    !source.slice(at, at + 300).includes("withoutDotenvKeys"),
    "defaultRun runs git/gh and needs a .env-sourced GITHUB_TOKEN; it must not be narrowed",
  );
});
