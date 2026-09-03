import test from "node:test";
import assert from "node:assert/strict";

import { buildEngineSpawn, extractEngineText, getEngineMetadata, isEngine } from "./engines.js";
import { parseOllamaList, ollamaAvailability } from "./ollama-availability.js";

test("buildEngineSpawn keeps Claude's existing invocation", () => {
  assert.deepEqual(
    buildEngineSpawn("claude", "do the work", { timeoutMs: 1000 }),
    { command: "claude", args: ["-p", "do the work", "--permission-mode", "acceptEdits"] },
  );
});

test("buildEngineSpawn uses Grok's Claude-compatible headless flags", () => {
  assert.deepEqual(
    buildEngineSpawn("grok", "do the work", { timeoutMs: 1000 }),
    { command: "grok", args: ["-p", "do the work", "--permission-mode", "acceptEdits"] },
  );
});

test("extractEngineText returns only Grok JSON's final answer", () => {
  const observed = JSON.stringify({
    text: "The signal changes the weather.",
    thought: "I should inspect the repository first.",
    usage: { total_tokens: 42 },
  });
  assert.equal(extractEngineText("grok", observed), "The signal changes the weather.");
  assert.equal(extractEngineText("claude", "  final prose  \n"), "final prose");
  assert.throws(() => extractEngineText("grok", "progress chatter\nfinal prose"), /valid final-answer JSON/i);
});

test("buildEngineSpawn captures Codex's final answer and permits workspace edits", () => {
  const built = buildEngineSpawn("codex", "do the work", { timeoutMs: 1000, outputFile: "/tmp/answer.md" });
  assert.equal(built.command, "codex");
  assert.deepEqual(built.args.slice(0, 4), ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check"]);
  assert.ok(built.args.includes("--output-last-message"));
  assert.ok(built.args.includes("/tmp/answer.md"));
  assert.equal(built.args.at(-1), "do the work");
});

test("engine metadata gives stable role guidance without renaming providers", () => {
  assert.deepEqual(getEngineMetadata("grok"), {
    id: "grok",
    label: "Grok",
    description: "Playful ideation, humor, and unexpected angles.",
    roleHint: "Ideation / Humor",
  });
  assert.equal(getEngineMetadata("unknown").id, "claude");
});

test("Ollama GPT-OSS uses the exact local model and sends the prompt through stdin", () => {
  assert.deepEqual(
    buildEngineSpawn("ollama-gpt-oss", "private prompt", { timeoutMs: 1000 }),
    { command: "ollama", args: ["run", "gpt-oss:20b"], input: "private prompt" },
  );
});

test("Ollama GPT-OSS is a distinct engine with stable local metadata", () => {
  assert.equal(isEngine("ollama-gpt-oss"), true);
  assert.deepEqual(getEngineMetadata("ollama-gpt-oss"), {
    id: "ollama-gpt-oss",
    label: "GPT-OSS (local)",
    description: "Local GPT-OSS analysis through Ollama.",
    roleHint: "Deep / Structured Analysis",
  });
});

test("Ollama list parsing recognizes an installed exact model", () => {
  assert.deepEqual(parseOllamaList("NAME              ID              SIZE\ngpt-oss:20b       abc             12 GB\n"), ["gpt-oss:20b"]);
  assert.deepEqual(ollamaAvailability({ listOutput: "NAME\ngpt-oss:20b\n" }), { state: "ready", model: "gpt-oss:20b" });
});

test("Ollama availability distinguishes missing model and unavailable daemon", () => {
  assert.deepEqual(ollamaAvailability({ listOutput: "NAME\nllama3:8b\n" }), { state: "model-missing", model: "gpt-oss:20b" });
  assert.deepEqual(ollamaAvailability({ listError: "Error: could not connect to ollama app" }), { state: "daemon-unavailable", model: "gpt-oss:20b" });
});
