import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  approveIdea,
  appendClarificationTurn,
  buildIdeaContext,
  classifyIdeaOutput,
  classifyIdeaWithEngine,
  buildIdeaSpawn,
  createIdea,
  createCleanupProposal,
  readIdea,
  rejectIdea,
  setIdeaClassification,
  type IdeaClassification,
} from "./idea-inbox.js";

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

test("classifier accepts only the six exact destinations and abstains to clarify", () => {
  const expected: IdeaClassification[] = ["world", "character", "plot", "chapter", "imagery", "clarify"];
  for (const label of expected) assert.equal(classifyIdeaOutput(label), label);
  assert.equal(classifyIdeaOutput("The answer is world."), "world");
  assert.equal(classifyIdeaOutput("world and character"), "clarify");
  assert.equal(classifyIdeaOutput("unknown"), "clarify");
});

test("Fiction inbox subscription adapters cannot edit files and GPT-OSS is paused", async () => {
  for (const engine of ["claude", "grok"] as const) {
    const built = buildIdeaSpawn(engine, "private fiction");
    assert.equal(built.args.includes("acceptEdits"), false);
    assert.ok(built.args.some((value, index) => value === "--tools" && built.args[index + 1] === ""));
    if (engine === "grok") {
      assert.ok(built.args.some((value, index) => value === "--output-format" && built.args[index + 1] === "json"));
      assert.ok(built.args.some((value, index) => value === "--sandbox" && built.args[index + 1] === "read-only"));
      assert.ok(built.args.includes("--system-prompt-override"));
      assert.ok(built.args.includes("--disable-web-search"));
    }
  }
  assert.deepEqual(buildIdeaSpawn("codex", "private fiction").args.slice(0, 3), ["exec", "--sandbox", "read-only"]);
  await assert.rejects(() => classifyIdeaWithEngine("An idea", "ollama-gpt-oss"), /GPT-OSS.*paused/i);
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
