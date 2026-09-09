import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import fs, { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import type {
  IdeaClassification,
} from "./idea-inbox.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoEnvPath = join(repoRoot, ".env");
const originalReadFileSync = fs.readFileSync;
let blockedRepoEnvReads = 0;

(fs as { readFileSync: unknown }).readFileSync = ((path: string | Buffer | URL | number, ...args: unknown[]) => {
  if (path === repoEnvPath) {
    blockedRepoEnvReads += 1;
    const error = new Error("fiction fixture blocks repository .env reads") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  }
  return Reflect.apply(originalReadFileSync, fs, [path, ...args]);
}) as typeof fs.readFileSync;
syncBuiltinESMExports();

let ideaInbox: typeof import("./idea-inbox.js");
try {
  ideaInbox = await import("./idea-inbox.js");
} finally {
  fs.readFileSync = originalReadFileSync;
  syncBuiltinESMExports();
}

const {
  approveIdea,
  appendClarificationTurn,
  buildIdeaContext,
  classifyIdeaOutput,
  classifyIdeaWithEngine,
  cleanupIdeaWithEngine,
  buildIdeaSpawn,
  createIdea,
  createCleanupProposal,
  readIdea,
  rejectIdea,
  setIdeaClassification,
} = ideaInbox;

assert.equal(blockedRepoEnvReads, 1, "fixture must block the static import chain from reading the repository .env");
const TSX_LOADER = join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");

function seriesRoot() {
  const base = mkdtempSync(join(tmpdir(), "fiction-inbox-"));
  const storageRoot = join(base, "working-state");
  const storiesRoot = join(base, "stories");
  const dir = join(storiesRoot, "series");
  mkdirSync(join(dir, "characters"), { recursive: true });
  writeFileSync(join(dir, "series.yaml"), "slug: series\ntitle: Test\n");
  writeFileSync(join(dir, "bible.md"), "# Bible\n\nExisting world.\n");
  writeFileSync(join(dir, "outline.md"), "# Outline\n\nExisting plot.\n");
  writeFileSync(join(dir, "canon.md"), "# Canon\n\n## Established facts\n");
  writeFileSync(join(dir, "characters", "eli.md"), "# Eli\n\nExisting character.\n");
  return { storageRoot, storiesRoot, dir };
}

function runIsolatedGrokIdeaFixture(): void {
  const root = mkdtempSync(join(tmpdir(), "fiction-grok-fixture-"));
  const bin = join(root, "bin");
  const home = join(root, "home");
  const data = join(root, "data");
  const cost = join(root, "cost");
  const temp = join(root, "tmp");
  const cwd = join(root, "cwd");
  const log = join(root, "grok-calls.jsonl");
  const envReadReceipt = join(root, "env-read.txt");
  const resultReceipt = join(root, "result.json");
  const fixtureEnv = join(root, "fixture.env");
  const envReadLoader = join(root, "env-read-loader.mjs");
  const envReadInterceptor = join(root, "env-read-interceptor.mjs");
  const envReadPreload = join(root, "env-read-preload.mjs");
  const exactRepoEnv = join(repoRoot, ".env");
  const sentinels = [home, data, cost, temp].map((dir) => {
    mkdirSync(dir, { recursive: true });
    const sentinel = join(dir, "sentinel.txt");
    writeFileSync(sentinel, `preserve:${dir}`);
    return sentinel;
  });
  mkdirSync(bin);
  mkdirSync(cwd);
  const fakeGrok = join(bin, "grok");
  writeFileSync(fakeGrok, `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const required = ["--output-format", "--system-prompt-override", "--disable-web-search", "--no-subagents", "--verbatim"];
const allowed = new Set(JSON.parse(process.env.FICTION_GROK_ALLOWED_ENV || "[]"));
const unexpected = Object.keys(process.env).filter((name) => !allowed.has(name));
if (unexpected.length || args.filter((value) => value === "--sandbox").length !== 1 || valueAfter("--sandbox") !== "workspace" || required.some((flag) => !args.includes(flag)) || valueAfter("--output-format") !== "json" || valueAfter("--tools") !== "" || args.includes("acceptEdits")) {
  process.stderr.write("unexpected Grok fixture invocation\\n");
  process.exit(64);
}
const prompt = valueAfter("-p") || "";
const text = prompt.includes("Classify this fiction inbox idea") ? "world" : "Polished cleanup.";
fs.appendFileSync(process.env.FICTION_GROK_FIXTURE_LOG, JSON.stringify({ args, home: process.env.HOME, data: process.env.CONTENT_AGENTS_HOME, cost: process.env.CONTENT_AGENTS_COST_LOG, temp: process.env.TMPDIR }) + "\\n");
process.stdout.write(JSON.stringify({ text }) + "\\n");
`);
  chmodSync(fakeGrok, 0o700);
  try {
    writeFileSync(fixtureEnv, "FICTION_GROK_FIXTURE_LOADED=loaded\n");
    writeFileSync(
      envReadLoader,
      [
        "const envModuleUrl = process.env.CONTENT_AGENTS_TEST_ENV_MODULE_URL;",
        "const interceptorUrl = process.env.CONTENT_AGENTS_TEST_ENV_INTERCEPTOR_URL;",
        "export async function resolve(specifier, context, nextResolve) {",
        "  if (specifier === 'node:fs' && context.parentURL === envModuleUrl) {",
        "    return { url: interceptorUrl, shortCircuit: true };",
        "  }",
        "  return nextResolve(specifier, context);",
        "}",
        "",
      ].join("\n")
    );
    writeFileSync(
      envReadInterceptor,
      [
        "import { appendFileSync, readFileSync as nativeReadFileSync } from 'node:fs';",
        "const exactRepoEnv = process.env.CONTENT_AGENTS_TEST_EXACT_REPO_ENV;",
        "const fixtureEnv = process.env.CONTENT_AGENTS_TEST_FIXTURE_ENV;",
        "const receipt = process.env.CONTENT_AGENTS_TEST_ENV_RECEIPT;",
        "export function readFileSync(path, ...args) {",
        "  if (path !== exactRepoEnv) throw new Error(`unexpected env read: ${path}`);",
        "  appendFileSync(receipt, `substituted:${path}\\n`);",
        "  return nativeReadFileSync(fixtureEnv, ...args);",
        "}",
        "",
      ].join("\n")
    );
    writeFileSync(
      envReadPreload,
      [
        "import { writeFileSync } from 'node:fs';",
        "import { register } from 'node:module';",
        "writeFileSync(process.env.CONTENT_AGENTS_TEST_ENV_RECEIPT, '');",
        "register(new URL('./env-read-loader.mjs', import.meta.url));",
        "",
      ].join("\n")
    );
    const env = {
      HOME: home,
      PATH: bin,
      TMPDIR: temp,
      TMP: temp,
      TEMP: temp,
      NODE_ENV: "test",
      __CF_USER_TEXT_ENCODING: "0x0:0:0",
      CONTENT_AGENTS_HOME: data,
      CONTENT_AGENTS_COST_LOG: join(cost, "cost-log.csv"),
      FICTION_GROK_FIXTURE_LOG: log,
      FICTION_GROK_ALLOWED_ENV: "",
      CONTENT_AGENTS_TEST_ENV_MODULE_URL: pathToFileURL(join(repoRoot, "src", "util", "env.ts")).href,
      CONTENT_AGENTS_TEST_ENV_INTERCEPTOR_URL: pathToFileURL(envReadInterceptor).href,
      CONTENT_AGENTS_TEST_EXACT_REPO_ENV: exactRepoEnv,
      CONTENT_AGENTS_TEST_FIXTURE_ENV: fixtureEnv,
      CONTENT_AGENTS_TEST_ENV_RECEIPT: envReadReceipt,
      CONTENT_AGENTS_TEST_RESULT_RECEIPT: resultReceipt,
      CONTENT_AGENTS_TEST_TARGET_URL: pathToFileURL(join(repoRoot, "src", "fiction", "idea-inbox.ts")).href,
    };
    env.FICTION_GROK_ALLOWED_ENV = JSON.stringify([...Object.keys(env), "FICTION_GROK_FIXTURE_LOADED"].sort());
    const childScript = [
      "import { appendFileSync, readFileSync } from 'node:fs';",
      "const allowed = new Set(JSON.parse(process.env.FICTION_GROK_ALLOWED_ENV || '[]'));",
      "const unexpected = Object.keys(process.env).filter((name) => !allowed.has(name));",
      "if (unexpected.length) throw new Error(`unexpected child environment: ${unexpected.join(',')}`);",
      "const { classifyIdeaWithEngine, cleanupIdeaWithEngine } = await import(process.env.CONTENT_AGENTS_TEST_TARGET_URL);",
      "if (process.env.FICTION_GROK_FIXTURE_LOADED !== 'loaded') throw new Error('fixture env was not loaded');",
      "const classification = await classifyIdeaWithEngine('The city loses power.', 'grok');",
      "const cleanup = await cleanupIdeaWithEngine('The city loses power.', 'world', 'grok');",
      "if (classification !== 'world' || cleanup !== 'Polished cleanup.') throw new Error(`unexpected idea outputs: ${classification} / ${cleanup}`);",
      "const calls = readFileSync(process.env.FICTION_GROK_FIXTURE_LOG, 'utf8').trim().split('\\n').map(JSON.parse);",
      "if (calls.length !== 2) throw new Error(`expected two Grok calls, got ${calls.length}`);",
      "appendFileSync(process.env.CONTENT_AGENTS_TEST_RESULT_RECEIPT, JSON.stringify({ classification, cleanup, calls }) + '\\n');",
      "",
    ].join("\n");
    const child = spawnSync(process.execPath, ["--import", TSX_LOADER, "--import", pathToFileURL(envReadPreload).href, "--input-type=module", "--eval", childScript], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 10_000,
      killSignal: "SIGKILL",
      maxBuffer: 1_000_000,
    });
    assert.equal(child.error, undefined, `idea fixture should finish before the SIGKILL deadline: ${child.error?.message ?? ""}`);
    assert.equal(child.signal, null, `idea fixture should not be terminated: ${child.stderr}`);
    assert.equal(child.status, 0, `idea fixture failed: ${child.stderr}`);
    assert.equal(readFileSync(envReadReceipt, "utf8"), `substituted:${exactRepoEnv}\n`);
    const result = JSON.parse(readFileSync(resultReceipt, "utf8")) as { classification: string; cleanup: string; calls: Array<{ args: string[]; home: string; data: string; cost: string; temp: string }> };
    assert.equal(result.classification, "world");
    assert.equal(result.cleanup, "Polished cleanup.");
    assert.equal(result.calls.length, 2);
    for (const call of result.calls) {
      assert.equal(call.args.filter((value) => value === "--sandbox").length, 1);
      assert.equal(call.args[call.args.indexOf("--sandbox") + 1], "workspace");
      assert.equal(call.home, home);
      assert.equal(call.data, data);
      assert.equal(call.cost, join(cost, "cost-log.csv"));
      assert.equal(call.temp, temp);
    }
    for (const sentinel of sentinels) assert.match(readFileSync(sentinel, "utf8"), /^preserve:/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("classifier accepts only the six exact destinations and abstains to clarify", () => {
  const expected: IdeaClassification[] = ["world", "character", "plot", "chapter", "imagery", "clarify"];
  for (const label of expected) assert.equal(classifyIdeaOutput(label), label);
  assert.equal(classifyIdeaOutput("The answer is world."), "world");
  assert.equal(classifyIdeaOutput("world and character"), "clarify");
  assert.equal(classifyIdeaOutput("unknown"), "clarify");
});

test("Fiction inbox subscription adapters preserve text-only flags and GPT-OSS is paused", async () => {
  for (const engine of ["claude", "grok"] as const) {
    const built = buildIdeaSpawn(engine, "private fiction");
    assert.equal(built.args.includes("acceptEdits"), false);
    assert.ok(built.args.some((value, index) => value === "--tools" && built.args[index + 1] === ""));
    if (engine === "grok") {
      assert.ok(built.args.some((value, index) => value === "--output-format" && built.args[index + 1] === "json"));
      assert.ok(built.args.some((value, index) => value === "--sandbox" && built.args[index + 1] === "workspace"));
      assert.ok(built.args.includes("--system-prompt-override"));
      assert.ok(built.args.includes("--disable-web-search"));
    }
  }
  assert.deepEqual(buildIdeaSpawn("codex", "private fiction").args.slice(0, 3), ["exec", "--sandbox", "read-only"]);
  await assert.rejects(() => classifyIdeaWithEngine("An idea", "ollama-gpt-oss"), /GPT-OSS.*paused/i);
});

test("Grok fixture rejects the retired sandbox and returns classification and cleanup text with isolated state", async () => {
  runIsolatedGrokIdeaFixture();
});

test("raw idea bytes survive durable persistence and identical submission is idempotent", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  const raw = "  Eli says:\n\t\"Do not clean me up.\"  \n";
  const first = createIdea("series", raw, { storageRoot, storiesRoot, targetPath: "characters/eli.md" });
  const second = createIdea("series", raw, { storageRoot, storiesRoot, targetPath: "characters/eli.md" });
  assert.equal(second.id, first.id);
  assert.equal(readIdea("series", first.id, storageRoot)?.rawText, raw);
  assert.equal(JSON.parse(readFileSync(join(storageRoot, "series", "ideas.json"), "utf8"))[0].rawText, raw);
});

test("non-chapter cleanup is reviewable and approved write touches only selected document", () => {
  const { storageRoot, storiesRoot, dir } = seriesRoot();
  const idea = createIdea("series", "  The city's lights fail.  ", { storageRoot, storiesRoot, classification: "character", targetPath: "characters/eli.md" });
  const proposal = createCleanupProposal(idea, "The city lights fail.", "claude");
  assert.equal(proposal.rawText, idea.rawText);
  assert.equal(proposal.cleanedText, "The city lights fail.");
  assert.equal(proposal.provenance.targetPath, "characters/eli.md");
  const before = readFileSync(join(dir, "bible.md"), "utf8");
  approveIdea(proposal, { storageRoot, storiesRoot, canonicalWriteAuthorized: true });
  assert.match(readFileSync(join(dir, "characters", "eli.md"), "utf8"), /The city lights fail/);
  assert.equal(readFileSync(join(dir, "bible.md"), "utf8"), before);
  assert.equal(readFileSync(join(dir, "canon.md"), "utf8"), "# Canon\n\n## Established facts\n");
});

test("rejection never writes canonical documents", () => {
  const { storageRoot, storiesRoot, dir } = seriesRoot();
  const idea = createIdea("series", "A rejected idea", { storageRoot, storiesRoot, classification: "plot", targetPath: "outline.md" });
  const proposal = createCleanupProposal(idea, "A rejected cleanup", "grok");
  const before = readFileSync(join(dir, "outline.md"), "utf8");
  rejectIdea(proposal, { storageRoot, storiesRoot });
  assert.equal(readFileSync(join(dir, "outline.md"), "utf8"), before);
  assert.equal(readIdea("series", idea.id, storageRoot)?.status, "rejected");
});

test("chapter approval queues the existing draft flow and never writes canon", () => {
  const { storageRoot, storiesRoot, dir } = seriesRoot();
  const idea = createIdea("series", "Eli enters the flooded station.", { storageRoot, storiesRoot, classification: "chapter" });
  const proposal = createCleanupProposal(idea, "Eli enters the flooded station.", "codex");
  let queued: { series: string; beats: string; engine: string } | undefined;
  approveIdea(proposal, {
    storageRoot, storiesRoot,
    queueChapter: (series, beats, engine) => { queued = { series, beats, engine }; },
  });
  assert.deepEqual(queued, { series: "series", beats: idea.rawText, engine: "codex" });
  assert.equal(readFileSync(join(dir, "canon.md"), "utf8"), "# Canon\n\n## Established facts\n");
});

test("approval refuses unsafe or append-only targets", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  assert.throws(() => createIdea("series", "bad", { storageRoot, storiesRoot, classification: "world", targetPath: "../../canon.md" }), /unsafe target path/i);
});

test("non-chapter approval requires the caller to prove the main-branch canon lane", () => {
  const { storageRoot, storiesRoot, dir } = seriesRoot();
  const idea = createIdea("series", "The station is flooded.", { storageRoot, storiesRoot, classification: "world" });
  const proposal = createCleanupProposal(idea, "The station is flooded.", "claude");
  const before = readFileSync(join(dir, "bible.md"), "utf8");
  assert.throws(() => approveIdea(proposal, { storageRoot, storiesRoot }), /main branch.*authorization/i);
  assert.equal(readFileSync(join(dir, "bible.md"), "utf8"), before);
});

test("classification normalizes a conflicting target to the only compatible canonical document", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  const idea = createIdea("series", "A world rule", { storageRoot, storiesRoot, targetPath: "outline.md" });
  const classified = setIdeaClassification(idea, "world", "outline.md");
  assert.equal(classified.targetPath, "bible.md");
  assert.equal(createCleanupProposal(classified, "A world rule", "claude").provenance.targetPath, "bible.md");
});

test("approval accepts only the exact pending proposal stored for the idea", () => {
  const { storageRoot, storiesRoot, dir } = seriesRoot();
  const idea = createIdea("series", "Eli keeps the key.", {
    storageRoot, storiesRoot, classification: "character", targetPath: "characters/eli.md",
  });
  const proposal = createCleanupProposal(idea, "Eli keeps the key.", "claude");
  const forged = { ...proposal, cleanedText: "Eli secretly destroys the key." };
  const before = readFileSync(join(dir, "characters", "eli.md"), "utf8");
  assert.throws(() => approveIdea(forged, { storageRoot, storiesRoot }), /pending proposal/i);
  assert.equal(readFileSync(join(dir, "characters", "eli.md"), "utf8"), before);
});

test("rejection accepts only the exact pending proposal stored for the idea", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  const idea = createIdea("series", "Eli keeps the key.", {
    storageRoot, storiesRoot, classification: "character", targetPath: "characters/eli.md",
  });
  const proposal = createCleanupProposal(idea, "Eli keeps the key.", "claude");
  assert.throws(
    () => rejectIdea({ ...proposal, cleanedText: "Forged rejection text" }, { storageRoot, storiesRoot }),
    /pending proposal/i,
  );
  assert.equal(readIdea("series", idea.id, storageRoot)?.status, "needs-review");
});

test("empty input and rewritten chapter beats are refused", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  assert.throws(() => createIdea("series", "", { storageRoot, storiesRoot }), /idea.*empty|required/i);
  const idea = createIdea("series", "Exact chapter beats", { storageRoot, storiesRoot, classification: "chapter" });
  assert.throws(() => createCleanupProposal(idea, "Rewritten beats", "grok"), /chapter proposal.*raw/i);
});

test("clarification turns persist in order without changing the original idea bytes", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  const raw = "  Build something around the signal.\n";
  const idea = createIdea("series", raw, { storageRoot, storiesRoot, engine: "grok" });
  const first = appendClarificationTurn(idea, "Is this for the world or a character?");
  const second = appendClarificationTurn(first, "The world: the signal changes the weather.");
  assert.deepEqual(second.clarificationTurns.map((turn) => turn.text), [
    "Is this for the world or a character?",
    "The world: the signal changes the weather.",
  ]);
  assert.equal(readIdea("series", idea.id, storageRoot)?.rawText, raw);
  assert.equal(appendClarificationTurn(second, second.clarificationTurns[1].text).clarificationTurns.length, 2);
  assert.match(buildIdeaContext(second), /ORIGINAL IDEA[\s\S]*Build something[\s\S]*CLARIFICATION TURNS[\s\S]*Is this[\s\S]*weather/);
});

test("cleanup provenance retains the exact original and ordered clarification turns", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  const idea = createIdea("series", "Raw\tidea", { storageRoot, storiesRoot });
  const clarified = appendClarificationTurn(idea, "It belongs in the world bible.");
  const classified = setIdeaClassification(clarified, "world");
  const proposal = createCleanupProposal(classified, "Raw idea, clarified.", "claude");
  assert.equal(proposal.rawText, "Raw\tidea");
  assert.deepEqual(proposal.provenance.clarificationTurns.map((turn) => turn.text), ["It belongs in the world bible."]);
});

test("clarified chapter approval queues every exact author turn without model cleanup", () => {
  const { storageRoot, storiesRoot } = seriesRoot();
  const idea = createIdea("series", "Open at the station.", { storageRoot, storiesRoot });
  const clarified = appendClarificationTurn(idea, "This is chapter two, from Eli's point of view.");
  const classified = setIdeaClassification(clarified, "chapter");
  const proposal = createCleanupProposal(classified, classified.rawText, "grok");
  let beats = "";
  approveIdea(proposal, { storageRoot, storiesRoot, queueChapter: (_series, value) => { beats = value; } });
  assert.match(beats, /ORIGINAL IDEA[\s\S]*Open at the station/);
  assert.match(beats, /CLARIFICATION TURNS[\s\S]*chapter two, from Eli's point of view/);
});
