import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { approveConfiguredMediaStage, assertApprovedCardQuoteOnDisk, attachReviewedConfiguredMediaFiles, configuredQuoteCardRender, defaultConfiguredMediaRenderer, executeConfiguredMediaStage, type PersistedConfiguredMediaStage } from "./configured-media-runtime.js";
import { tryAcquireFileLease } from "../runtime/file-lock.js";
import { configuredCardImagePath, configuredCardRenderDerivative, configuredCardSourceLine } from "./configured-media.js";
import { readQueue } from "../publish/queue.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { costLogPath } from "../util/cost-log.js";

const COST_LOG_MODULE = fileURLToPath(new URL("../util/cost-log.ts", import.meta.url));

const IMAGE_BYTES = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]),
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01]),
  gif: Buffer.from("GIF89a1"),
  webp: Buffer.from("RIFF\u0004\u0000\u0000\u0000WEBPx"),
} as const;

function fixture(media: string, id = "m1") {
  const folder = mkdtempSync(join(tmpdir(), "configured-media-runtime-"));
  mkdirSync(join(folder, "media-stages"));
  writeFileSync(join(folder, "review-queue.md"), `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| ${id} | linkedin | ${media.includes("image") ? "image" : "video"} | media-stages/${id}.json | — | — | — | pending | | from GUI queue |\n`);
  writeFileSync(join(folder, "media-stages", `${id}.json`), JSON.stringify({ version:"configured-media-stage-v1", id, media, status:"staged", stage:"source-approval-required", plan:{kind:"test"}, primitives:["injected"] }));
  return folder;
}

for (const [media, primary] of [["static-quote-card","images/m1-quote.png"],["animated-quote-card","images/m1-quote.mp4"],["short-video-script","video/short.mp4"],["image","configured-media/m1/image.png"],["image-carousel","configured-media/m1/carousel-manifest.json"],["video-caption-package","configured-media/m1/caption-manifest.json"],["audiogram","configured-media/m1/audiogram.mp4"]] as const) {
  test(`${media} requires approval, verifies injected output, then promotes the queue asset`, async () => {
    const folder = fixture(media);
    await assert.rejects(executeConfiguredMediaStage(folder, "m1", async () => ({ primaryAsset: primary, assets:[primary], costUsd:0 })), /not approved/);
    approveConfiguredMediaStage(folder, "m1");
    await assert.rejects(executeConfiguredMediaStage(folder, "m1", async () => ({ primaryAsset: primary, assets:[primary], costUsd:0 })), /did not create/);
    const result = await executeConfiguredMediaStage(folder, "m1", async (_stage, root) => {
      const out = join(root, primary); mkdirSync(dirname(out), { recursive:true }); writeFileSync(out, "verified");
      return { primaryAsset: primary, assets:[primary], costUsd:0 };
    });
    assert.equal(result.primaryAsset, primary);
    assert.match(readFileSync(join(folder,"review-queue.md"),"utf8"), new RegExp(primary.replaceAll("/","\\/")));
    const stage = JSON.parse(readFileSync(join(folder,"media-stages/m1.json"),"utf8"));
    assert.equal(stage.status,"rendered");
  });
}

test("SLICE-5H: a card renders from its quote companion, not from the post text derivative", () => {
  const still = configuredQuoteCardRender({ id: "treated-eA-c3RhdGljLXF1b3RlLWNhcmQ-c3VtbWFyeQ", media: "static-quote-card" }, "/content/post");
  assert.equal(still.quoteDerivative, "derivatives/treated-eA-c3RhdGljLXF1b3RlLWNhcmQ-c3VtbWFyeQ-quote.md");
  assert.deepEqual([...still.command], [
    "npm", "run", "render", "--", "--still", "/content/post",
    "--quote", "treated-eA-c3RhdGljLXF1b3RlLWNhcmQ-c3VtbWFyeQ-quote",
  ]);
  assert.equal(still.primaryAsset, "images/treated-eA-c3RhdGljLXF1b3RlLWNhcmQ-c3VtbWFyeQ-quote.png");
  assert.deepEqual([...still.assets], [still.primaryAsset, "images/treated-eA-c3RhdGljLXF1b3RlLWNhcmQ-c3VtbWFyeQ-quote.mp4"]);

  const animated = configuredQuoteCardRender({ id: "m1", media: "animated-quote-card" }, "/content/post");
  assert.equal(animated.primaryAsset, "images/m1-quote.mp4");
  assert.deepEqual([...animated.assets], ["images/m1-quote.mp4", "images/m1-quote.png"]);
  assert.deepEqual([...animated.command].slice(-2), ["--quote", "m1-quote"]);
});

// A card fixture whose stage plan is an approved quote, with the companion the renderer reads.
function cardFixture(quote = "Roadmaps fail for boring reasons."): { folder: string; stage: PersistedConfiguredMediaStage } {
  const folder = fixture("static-quote-card");
  const path = join(folder, "media-stages/m1.json");
  const stage = { ...JSON.parse(readFileSync(path, "utf8")), stage: "render-required", plan: { kind: "quote-render-plan", sourceText: quote } };
  writeFileSync(path, JSON.stringify(stage));
  mkdirSync(join(folder, "derivatives"));
  writeFileSync(join(folder, "derivatives/m1-quote.md"), `---\nplatform: quote-card\nsource_lines: [4]\n---\n\n${quote}\n`);
  return { folder, stage: approveConfiguredMediaStage(folder, "m1") };
}

test("SLICE-5H: the card renderer refuses before spawning when the quote derivative is missing", async () => {
  const { folder, stage } = cardFixture();
  rmSync(join(folder, "derivatives/m1-quote.md"));
  await assert.rejects(
    defaultConfiguredMediaRenderer(stage, folder),
    /no quote derivative to render: derivatives\/m1-quote\.md/,
  );
  assert.equal(existsSync(join(folder, "images")), false, "a refused card render writes no image");
});

test("SLICE-5H: a quote edited after approval never reaches the image", async () => {
  const approvedQuote = "Roadmaps fail for boring reasons.";
  const { folder, stage } = cardFixture(approvedQuote);
  // The approval digest covers the stage plan, but the renderer reads the companion off disk, so
  // the file is its own unapproved input: swapping it must refuse, not paint the new text.
  writeFileSync(join(folder, "derivatives/m1-quote.md"), `---\nplatform: quote-card\nsource_lines: [4]\n---\n\nUnapproved text nobody reviewed, and long past the card limit besides.\n`);

  await assert.rejects(
    defaultConfiguredMediaRenderer(stage, folder),
    /derivatives\/m1-quote\.md no longer matches its approved render plan/,
  );
  assert.equal(existsSync(join(folder, "images")), false, "a refused card render writes no image");
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "approved", "and nothing was promoted");

  // Restoring the approved quote clears the refusal: the check binds text, not file mtime.
  writeFileSync(join(folder, "derivatives/m1-quote.md"), `---\nplatform: quote-card\nsource_lines: [4]\n---\n\n${approvedQuote}\n`);
  assert.doesNotThrow(() => assertApprovedCardQuoteOnDisk(stage, folder, "derivatives/m1-quote.md"));
  // A stage with no inspectable quote plan is refused outright rather than rendering something.
  assert.throws(
    () => assertApprovedCardQuoteOnDisk({ ...stage, plan: { kind: "quote-render-plan" } }, folder, "derivatives/m1-quote.md"),
    /no inspectable quote render plan/,
  );
});

// ── SLICE-5I: one square card render shared across every platform in a request ────────────────
//
// The dispatcher shells out to `npm run render`, so the test puts a fake `npm` first on PATH. It
// records every argv and writes the two files renderStill writes (the PNG and its free animated
// companion), which is what makes "how many renders happened" an observable fact on disk rather
// than a spy on an internal call.
function cardRequestFolder(
  cards: readonly { readonly id: string; readonly platform: string; readonly media: string; readonly quote: string; readonly scheme?: string }[],
): { folder: string; names: Map<string, string> } {
  const folder = mkdtempSync(join(tmpdir(), "configured-media-share-"));
  mkdirSync(join(folder, "media-stages"));
  mkdirSync(join(folder, "derivatives"));
  const names = new Map<string, string>();
  const header = "| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n";
  const rows = cards.map((card) => {
    const definition = `---\nplatform: quote-card\n${card.scheme ? `scheme: ${card.scheme}\n` : ""}source_lines: [4]\n---\n\n${card.quote}\n`;
    const name = configuredCardRenderDerivative({ media: card.media, definition, sourceLine: configuredCardSourceLine(folder) });
    names.set(card.id, name);
    writeFileSync(join(folder, "derivatives", `${name}.md`), definition);
    writeFileSync(join(folder, "derivatives", `${card.id}.md`), `---\nplatform: ${card.platform}\n---\n\nPost text for ${card.platform}.\n`);
    writeFileSync(join(folder, "media-stages", `${card.id}.json`), JSON.stringify({
      version: "configured-media-stage-v1", id: card.id, platform: card.platform, media: card.media,
      status: "staged", stage: "render-required", derivativePath: `derivatives/${card.id}.md`,
      quoteDerivativePath: `derivatives/${name}.md`,
      outputPath: configuredCardImagePath(card.media, name),
      plan: { kind: "quote-render-plan", sourceText: card.quote }, primitives: ["injected"],
    }));
    return `| ${card.id} | ${card.platform} | image | media-stages/${card.id}.json | — | — | — | pending | | from GUI queue |\n`;
  });
  writeFileSync(join(folder, "review-queue.md"), header + rows.join(""));
  return { folder, names };
}

/**
 * A `npm` shim that logs its argv and writes exactly the files the real still renderer writes.
 *
 * `bytes` marks whose output a file holds; `fail` reproduces the case existence alone cannot see (a
 * renderer that creates both output paths and THEN dies, leaving truncated files behind); and
 * `produce: false` is the renderer that exits 0 having written nothing at all.
 */
function fakeRenderer(
  folder: string,
  options: {
    readonly bytes?: string; readonly fail?: boolean; readonly produce?: boolean; readonly log?: string;
    // A separate file (never the call log, which other tests parse) the renderer writes its
    // inherited CONTENT_AGENTS_TEST_COST_LOG into. Lets a test observe what the CHILD resolves
    // rather than reading the spawn call and inferring it.
    readonly envProbe?: string;
    // A test-only Node child which imports and calls the real cost logger. Its runner uses a
    // synchronous hard timeout, so no background watchdog process can outlive this fixture.
    readonly childLogScript?: string;
    readonly childRunnerScript?: string;
  } = {},
): { dir: string; log: string; calls: () => string[][] } {
  const dir = mkdtempSync(join(tmpdir(), "fake-npm-"));
  const log = options.log ?? join(dir, "calls.log");
  const images = JSON.stringify(join(folder, "images"));
  const writes = options.produce === false ? [] : [
    `mkdir -p ${images}`,
    `printf '%s' ${JSON.stringify(options.bytes ?? "rendered")} > ${images}/"$last".png`,
    `printf '%s' ${JSON.stringify(options.bytes ?? "rendered")} > ${images}/"$last".mp4`,
  ];
  writeFileSync(join(dir, "npm"), [
    "#!/bin/sh",
    `printf '%s\\n' "$*" >> ${JSON.stringify(log)}`,
    options.envProbe ? `printf '%s\\n' "$CONTENT_AGENTS_TEST_COST_LOG" >> ${JSON.stringify(options.envProbe)}` : "",
    ...(options.childLogScript && options.childRunnerScript ? [
      // The fixture process gets only roots needed for the test. It cannot inherit credentials or
      // provider configuration from the test runner while it proves the cost-log outcome.
      `/usr/bin/env -i PATH=/usr/bin:/bin HOME="$HOME" TMPDIR="$TMPDIR" CONTENT_AGENTS_DATA_ROOT="$CONTENT_AGENTS_DATA_ROOT" CONTENT_AGENTS_TEST_COST_LOG="$CONTENT_AGENTS_TEST_COST_LOG" NODE_TEST_CONTEXT=1 ${JSON.stringify(process.execPath)} --import tsx ${JSON.stringify(options.childRunnerScript)} ${JSON.stringify(options.childLogScript)}`,
    ] : []),
    'for a in "$@"; do last="$a"; done',
    ...writes,
    options.fail ? "exit 1" : "",
    "",
  ].join("\n"));
  chmodSync(join(dir, "npm"), 0o755);
  return {
    dir, log,
    calls: () => (existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((line) => line.split(" ")) : []),
  };
}

async function withFakeNpm<T>(dir: string, task: () => Promise<T>): Promise<T> {
  const previous = process.env.PATH;
  process.env.PATH = `${dir}:${previous ?? ""}`;
  try { return await task(); } finally { process.env.PATH = previous; }
}

function restoreCostLogEnv(previous: string | undefined): void {
  if (previous === undefined) delete process.env.CONTENT_AGENTS_TEST_COST_LOG;
  else process.env.CONTENT_AGENTS_TEST_COST_LOG = previous;
}

async function withIsolatedRenderEnvironment<T>(scratch: string, costLog: string, task: () => Promise<T>): Promise<T> {
  const values = {
    HOME: join(scratch, "home"),
    CONTENT_AGENTS_DATA_ROOT: join(scratch, "data"),
    CONTENT_AGENTS_TEST_COST_LOG: costLog,
    TMPDIR: join(scratch, "tmp"),
  } as const;
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]])) as Record<keyof typeof values, string | undefined>;
  for (const path of Object.values(values)) mkdirSync(path === costLog ? dirname(path) : path, { recursive: true });
  Object.assign(process.env, values);
  try {
    return await task();
  } finally {
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("SLICE-6B: a renderer child writes an observable real logCost row to the isolated shared log", { timeout: 10_000 }, async () => {
  const scratch = mkdtempSync(join(tmpdir(), "configured-media-render-child-"));
  const costLog = join(scratch, "cost", "cost-log.csv");
  try {
    await withIsolatedRenderEnvironment(scratch, costLog, async () => {
      const { folder, names } = cardRequestFolder([
        { id: "child-logged-card", platform: "linkedin", media: "static-quote-card", quote: "A fixture child proves the row is observable." },
      ]);
      const childLogScript = join(scratch, "fixture-render-child.ts");
      writeFileSync(childLogScript, [
        `import { logCost } from ${JSON.stringify(COST_LOG_MODULE)};`,
        'logCost({ step: "fixture:configured-render-child", detail: "isolated render child", costUsd: 0, engine: "fixture" });',
        "",
      ].join("\n"));
      const childRunnerScript = join(scratch, "fixture-render-child-runner.ts");
      writeFileSync(childRunnerScript, [
        'import { spawnSync } from "node:child_process";',
        'const childLogScript = process.argv[2];',
        'if (!childLogScript) throw new Error("missing fixture child script");',
        'const env = {',
        '  PATH: "/usr/bin:/bin",',
        '  HOME: process.env.HOME!,',
        '  TMPDIR: process.env.TMPDIR!,',
        '  CONTENT_AGENTS_DATA_ROOT: process.env.CONTENT_AGENTS_DATA_ROOT!,',
        '  CONTENT_AGENTS_TEST_COST_LOG: process.env.CONTENT_AGENTS_TEST_COST_LOG!,',
        '  NODE_TEST_CONTEXT: "1",',
        '};',
        'const result = spawnSync(process.execPath, ["--import", "tsx", childLogScript], { env, stdio: "inherit", timeout: 5_000, killSignal: "SIGKILL" });',
        'if (result.error) throw result.error;',
        'if (result.status !== 0 || result.signal) throw new Error(`fixture child failed: status=${result.status} signal=${result.signal}`);',
        "",
      ].join("\n"));
      const npm = fakeRenderer(folder, { childLogScript, childRunnerScript });
      try {
        assert.equal(dirname(folder), join(scratch, "tmp"), "the card fixture stays under the isolated temp root");
        assert.equal(dirname(npm.dir), join(scratch, "tmp"), "the render shim stays under the isolated temp root");
        approveConfiguredMediaStage(folder, "child-logged-card");
        const result = await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, "child-logged-card", defaultConfiguredMediaRenderer));
        const shared = names.get("child-logged-card")!;
        assert.deepEqual(npm.calls(), [["run", "render", "--", "--still", folder, "--quote", shared]], "the test-owned shim handled the render command");
        assert.equal(result.costUsd, 0, "the free renderer outcome remains cost-free");
        assert.equal(result.primaryAsset, `images/${shared}.png`);
        assert.deepEqual(readdirSync(join(folder, "images")).sort(), [`${shared}.mp4`, `${shared}.png`]);
        assert.equal(costLogPath(), costLog, "the parent resolves the explicit isolated cost log");
        const rows = readFileSync(costLog, "utf8").trimEnd().split("\n");
        assert.equal(rows.length, 2, "exactly the header and the real fixture-child row were written");
        assert.equal(rows[0], "timestamp,step,detail,cost_usd,engine");
        assert.match(rows[1]!, /,fixture:configured-render-child,"isolated render child",0\.0000,fixture$/);
      } finally {
        rmSync(folder, { recursive: true, force: true });
        rmSync(npm.dir, { recursive: true, force: true });
      }
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("SLICE-5I: two platforms whose card is identical render once and both rows promote to that one file", async () => {
  const quote = "Careful teams ship the smaller first step.";
  const { folder, names } = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote },
    { id: "bluesky-card", platform: "bluesky", media: "static-quote-card", quote },
  ]);
  // One cost log shared by this process AND the spawned renderer, so "appends nothing" covers both
  // sides of the spawn. A render is a subprocess (execFileSync in configured-media-runtime.ts), and
  // with no explicit override a Node child computes its OWN throwaway data root -- parent and child
  // would resolve to two different files and a child-side row would be invisible from here. An
  // explicit path is inherited through the environment (that spawn passes no `env` option), which
  // the envProbe assertion below proves rather than assumes. It is a scratch file, never Muxin's
  // real data/cost-log.csv.
  const scratch = mkdtempSync(join(tmpdir(), "configured-media-cost-log-"));
  const costLog = join(scratch, "cost-log.csv");
  const envProbe = join(scratch, "child-cost-log-env.txt");
  const npm = fakeRenderer(folder, { envProbe });
  const savedCostLogEnv = process.env.CONTENT_AGENTS_TEST_COST_LOG;
  process.env.CONTENT_AGENTS_TEST_COST_LOG = costLog;
  try {
    assert.equal(costLogPath(), costLog, "logCost in this process resolves to the shared scratch log");
    const costBefore = existsSync(costLog) ? readFileSync(costLog, "utf8") : null;
    // The render inputs, not the variant id or the platform, decide the name.
    assert.equal(names.get("linkedin-card"), names.get("bluesky-card"));
    const shared = names.get("linkedin-card")!;
    assert.doesNotMatch(shared, /linkedin|bluesky|card-quote$/, "the name encodes neither a platform nor a variant id");

    for (const id of ["linkedin-card", "bluesky-card"]) {
      approveConfiguredMediaStage(folder, id);
      const result = await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, id, defaultConfiguredMediaRenderer));
      assert.equal(result.primaryAsset, `images/${shared}.png`, `${id} promotes to the shared render`);
      assert.equal(result.costUsd, 0, "the card renderer is free");
    }

    // One render, one file. The second platform reused the first's output instead of re-rendering,
    // and its promotion did not fail because the file already existed.
    const calls = npm.calls();
    assert.equal(calls.length, 1, "the identical card is rendered exactly once");
    assert.deepEqual(calls[0].slice(-2), ["--quote", shared]);
    assert.deepEqual(readdirSync(join(folder, "images")).sort(), [`${shared}.mp4`, `${shared}.png`]);

    // Each platform keeps its own row, its own post text, and its own review state; only the image
    // is shared.
    const rows = readQueue(folder).rows;
    assert.deepEqual(rows.map((row) => row.asset), [`images/${shared}.png`, `images/${shared}.png`]);
    assert.deepEqual(rows.map((row) => row.platform), ["linkedin", "bluesky"]);
    assert.deepEqual(rows.map((row) => row.status), ["pending", "pending"], "sharing publishes nothing");
    assert.notEqual(
      readFileSync(join(folder, "derivatives/linkedin-card.md"), "utf8"),
      readFileSync(join(folder, "derivatives/bluesky-card.md"), "utf8"),
      "each platform keeps its own post text",
    );
    for (const id of ["linkedin-card", "bluesky-card"]) {
      assert.equal(JSON.parse(readFileSync(join(folder, "media-stages", `${id}.json`), "utf8")).status, "rendered");
      assert.ok(existsSync(join(folder, "configured-media", id, "render-manifest.json")), `${id} keeps its own render manifest`);
    }

    // Extraction-first: the shared render paints the approved quote and nothing else.
    assert.equal(splitFrontmatter(readFileSync(join(folder, "derivatives", `${shared}.md`), "utf8")).body.trim(), quote);

    // The spawned renderer resolved the SAME log this assertion reads. Without this, a child-side
    // row would land in the child's own throwaway root and "appends nothing" would be unfalsifiable
    // from here.
    const childSaw = readFileSync(envProbe, "utf8").split("\n").filter(Boolean);
    assert.equal(childSaw.length, 1, "the one spawned renderer wrote one probe line");
    assert.deepEqual(childSaw, [costLog], "the renderer subprocess inherited the shared cost-log path");

    // A free local render logs no cost row, so sharing one adds none -- on either side of the spawn.
    assert.equal(existsSync(costLog) ? readFileSync(costLog, "utf8") : null, costBefore, "a shared card render appends no cost row");
  } finally {
    restoreCostLogEnv(savedCostLogEnv);
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("SLICE-5I: cards whose render inputs genuinely differ are never collapsed into one render", async () => {
  const quote = "Careful teams ship the smaller first step.";
  const cards = [
    { id: "same-text-still", platform: "linkedin", media: "static-quote-card", quote },
    // Same words, different deliverable: a .png and a .mp4 are two renders, never one.
    { id: "same-text-animated", platform: "bluesky", media: "animated-quote-card", quote },
    // Same words, different palette: the scheme is painted, so it splits the key.
    { id: "other-scheme", platform: "x", media: "static-quote-card", quote, scheme: "ink" },
    // Different words entirely.
    { id: "other-quote", platform: "substack", media: "static-quote-card", quote: "Roadmaps fail for boring reasons." },
  ] as const;
  const { folder, names } = cardRequestFolder(cards);
  const npm = fakeRenderer(folder);
  try {
    assert.equal(new Set(names.values()).size, cards.length, "four distinct cards, four distinct render names");
    for (const card of cards) {
      approveConfiguredMediaStage(folder, card.id);
      await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, card.id, defaultConfiguredMediaRenderer));
    }
    assert.equal(npm.calls().length, cards.length, "each distinct card renders on its own");
    const rows = readQueue(folder).rows;
    assert.equal(new Set(rows.map((row) => row.asset)).size, cards.length, "and each row promotes to its own file");
    assert.equal(rows.find((row) => row.id === "same-text-animated")!.asset, `images/${names.get("same-text-animated")}.mp4`);
    assert.equal(rows.find((row) => row.id === "same-text-still")!.asset, `images/${names.get("same-text-still")}.png`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: a definition swapped under a content-addressed name is refused before anything renders", async () => {
  const { folder, names } = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote: "Careful teams ship the smaller first step." },
  ]);
  const npm = fakeRenderer(folder);
  try {
    const stage = approveConfiguredMediaStage(folder, "linkedin-card");
    // The plan digest covers the quote text, but a definition also carries the `scheme:` that picks
    // the palette. Repainting the approved words in an unapproved treatment breaks the name's claim
    // about its own bytes, so the render refuses instead of reusing or producing the wrong card.
    writeFileSync(
      join(folder, "derivatives", `${names.get("linkedin-card")}.md`),
      `---\nplatform: quote-card\nscheme: ink\nsource_lines: [4]\n---\n\nCareful teams ship the smaller first step.\n`,
    );
    await assert.rejects(
      withFakeNpm(npm.dir, () => defaultConfiguredMediaRenderer(stage, folder)),
      /no longer matches the render inputs its name encodes/,
    );
    assert.equal(npm.calls().length, 0, "a refused card render spawns nothing");
    assert.equal(existsSync(join(folder, "images")), false, "and writes no image");
  } finally {
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: a render that dies after creating its output paths is re-run, never promoted as leftovers", async () => {
  const { folder, names } = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote: "Careful teams ship the smaller first step." },
  ]);
  const shared = names.get("linkedin-card")!;
  const broken = fakeRenderer(folder, { bytes: "truncated", fail: true });
  const good = fakeRenderer(folder, { bytes: "rendered", log: broken.log });
  try {
    approveConfiguredMediaStage(folder, "linkedin-card");
    // The renderer creates both expected paths and then fails. Existence alone would call this done.
    await assert.rejects(withFakeNpm(broken.dir, () => executeConfiguredMediaStage(folder, "linkedin-card", defaultConfiguredMediaRenderer)));
    assert.equal(readFileSync(join(folder, "images", `${shared}.png`), "utf8"), "truncated", "the wreckage is on disk");
    assert.equal(existsSync(join(folder, "media-stages", ".renders", `${shared}.json`)), false, "a failed render leaves no completion marker");
    assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/linkedin-card.json"), "utf8")).status, "approved", "and nothing was promoted");

    const result = await withFakeNpm(good.dir, () => executeConfiguredMediaStage(folder, "linkedin-card", defaultConfiguredMediaRenderer));
    assert.equal(good.calls().length, 2, "the retry re-runs the render instead of trusting the leftovers");
    assert.equal(readFileSync(join(folder, "images", `${shared}.png`), "utf8"), "rendered", "and the promoted file is the completed one");
    assert.equal(result.primaryAsset, `images/${shared}.png`);
    assert.ok(existsSync(join(folder, "media-stages", ".renders", `${shared}.json`)), "a completed render is marked");
  } finally {
    rmSync(folder, { recursive: true, force: true });
    rmSync(broken.dir, { recursive: true, force: true });
    rmSync(good.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: a second variant never reuses an unmarked output left by a broken render", async () => {
  const quote = "Careful teams ship the smaller first step.";
  const { folder, names } = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote },
    { id: "bluesky-card", platform: "bluesky", media: "static-quote-card", quote },
  ]);
  const shared = names.get("linkedin-card")!;
  const npm = fakeRenderer(folder, { bytes: "rendered" });
  try {
    // Exactly what a renderer killed partway leaves behind: both expected paths, no marker.
    mkdirSync(join(folder, "images"), { recursive: true });
    for (const extension of ["png", "mp4"]) writeFileSync(join(folder, "images", `${shared}.${extension}`), "truncated");

    approveConfiguredMediaStage(folder, "bluesky-card");
    const result = await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, "bluesky-card", defaultConfiguredMediaRenderer));
    assert.equal(npm.calls().length, 1, "the unmarked output is re-rendered, not reused");
    assert.equal(readFileSync(join(folder, "images", `${shared}.png`), "utf8"), "rendered");
    assert.equal(result.primaryAsset, `images/${shared}.png`);

    // Once marked, the sibling really does reuse it: the guard costs nothing when the render is sound.
    approveConfiguredMediaStage(folder, "linkedin-card");
    await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, "linkedin-card", defaultConfiguredMediaRenderer));
    assert.equal(npm.calls().length, 1, "a marked, complete render is still shared");
  } finally {
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: the render lane is held on the render name, so variants sharing one card cannot render concurrently", async () => {
  const quote = "Careful teams ship the smaller first step.";
  const { folder, names } = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote },
    { id: "bluesky-card", platform: "bluesky", media: "static-quote-card", quote },
  ]);
  const shared = names.get("linkedin-card")!;
  const npm = fakeRenderer(folder);
  // Another process holding the RENDER lease, not either variant's stage lease.
  const held = tryAcquireFileLease(join(folder, "media-stages", ".locks", `${shared}.render.lock`));
  try {
    assert.ok(held, "the render lease was free to take");
    for (const id of ["linkedin-card", "bluesky-card"]) {
      approveConfiguredMediaStage(folder, id);
      await assert.rejects(
        withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, id, defaultConfiguredMediaRenderer)),
        new RegExp(`configured card render ${shared} is already running`),
        `${id} waits on the shared render, not on its own stage id`,
      );
    }
    assert.equal(npm.calls().length, 0, "neither variant rendered into the contended paths");
    assert.equal(existsSync(join(folder, "images")), false);
  } finally {
    held?.release();
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: repointing an approved stage at another definition invalidates its approval", async () => {
  const quote = "Careful teams ship the smaller first step.";
  const { folder } = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote },
  ]);
  const npm = fakeRenderer(folder);
  try {
    approveConfiguredMediaStage(folder, "linkedin-card");
    // A second definition holding the SAME approved words in a different palette, written under its
    // own correctly computed content address, so the name check alone would wave it through.
    const repainted = `---\nplatform: quote-card\nscheme: ink\nsource_lines: [4]\n---\n\n${quote}\n`;
    const repaintedName = configuredCardRenderDerivative({ media: "static-quote-card", definition: repainted, sourceLine: configuredCardSourceLine(folder) });
    writeFileSync(join(folder, "derivatives", `${repaintedName}.md`), repainted);
    const stagePath = join(folder, "media-stages/linkedin-card.json");
    const stage = JSON.parse(readFileSync(stagePath, "utf8"));
    stage.quoteDerivativePath = `derivatives/${repaintedName}.md`;
    writeFileSync(stagePath, JSON.stringify(stage, null, 2) + "\n");

    await assert.rejects(
      withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, "linkedin-card", defaultConfiguredMediaRenderer)),
      /changed after approval/,
      "the definition a stage points at is part of what was approved",
    );
    // Pointing the field at a name that is not a content address does not slip past it either.
    stage.quoteDerivativePath = "derivatives/linkedin-card-quote.md";
    writeFileSync(stagePath, JSON.stringify(stage, null, 2) + "\n");
    await assert.rejects(
      withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, "linkedin-card", defaultConfiguredMediaRenderer)),
      /changed after approval/,
    );
    assert.equal(npm.calls().length, 0, "no unapproved card was rendered");
    assert.equal(existsSync(join(folder, "images")), false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: a stage written before quoteDerivativePath existed keeps its digest and still renders", async () => {
  // Two legacy shapes at once: no recorded definition path, and an id that happens to read like a
  // content address. Neither may be treated as a claim about the definition's bytes.
  const legacyId = `card-${"a1b2c3d4".repeat(4)}`;
  assert.equal(legacyId.length, "card-".length + 32);
  const folder = mkdtempSync(join(tmpdir(), "configured-media-legacy-"));
  const npm = fakeRenderer(folder);
  try {
    mkdirSync(join(folder, "media-stages"));
    mkdirSync(join(folder, "derivatives"));
    const quote = "Roadmaps fail for boring reasons.";
    const legacy = {
      version: "configured-media-stage-v1", id: legacyId, media: "static-quote-card",
      status: "staged", stage: "render-required", plan: { kind: "quote-render-plan", sourceText: quote },
      primitives: ["injected"],
    };
    writeFileSync(join(folder, "media-stages", `${legacyId}.json`), JSON.stringify(legacy));
    writeFileSync(join(folder, "derivatives", `${legacyId}-quote.md`), `---\nplatform: quote-card\nsource_lines: [4]\n---\n\n${quote}\n`);
    writeFileSync(join(folder, "review-queue.md"),
      `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| ${legacyId} | linkedin | image | media-stages/${legacyId}.json | — | — | — | pending | | from GUI queue |\n`);

    // The digest is byte-for-byte the pre-slice one: adding the field to the input never touched a
    // stage that does not record it.
    const approved = approveConfiguredMediaStage(folder, legacyId);
    assert.equal(approved.approval!.digest, createHash("sha256").update(JSON.stringify({
      id: legacyId, media: "static-quote-card", stage: "render-required",
      plan: legacy.plan, primitives: legacy.primitives, sourcePaths: [],
    })).digest("hex"), "a legacy stage hashes exactly as it did before");

    // And it renders: an unchanged, approved quote is not failed by a name-shape coincidence.
    const result = await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, legacyId, defaultConfiguredMediaRenderer));
    assert.equal(result.primaryAsset, `images/${legacyId}-quote.png`);
    assert.deepEqual(npm.calls()[0].slice(-2), ["--quote", `${legacyId}-quote`]);
    // A legacy name is never shared: its image can outlive a re-approved quote, so it re-renders.
    // It therefore leaves no completion marker either — the marker set is exactly the reusable
    // renders, never dead state nothing reads.
    assert.equal(existsSync(join(folder, "media-stages", ".renders", `${legacyId}-quote.json`)), false,
      "a legacy render is never reusable, so it is never marked");
    const stagePath = join(folder, "media-stages", `${legacyId}.json`);
    const { rendered: _finished, ...rerun } = JSON.parse(readFileSync(stagePath, "utf8"));
    writeFileSync(stagePath, JSON.stringify({ ...rerun, status: "approved" }, null, 2) + "\n");
    writeFileSync(join(folder, "review-queue.md"),
      `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| ${legacyId} | linkedin | image | media-stages/${legacyId}.json | — | — | — | pending | | from GUI queue |\n`);
    await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, legacyId, defaultConfiguredMediaRenderer));
    assert.equal(npm.calls().length, 2, "a legacy per-variant render is never reused");
  } finally {
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: a render that exits clean having produced nothing fails, addressed or legacy", async () => {
  // The marker is addressed-only, but the produced-its-assets check is not: a renderer that returns
  // success and wrote no files is a failure for every card, including one that can never be reused.
  const quote = "Roadmaps fail for boring reasons.";
  const addressed = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote },
  ]);
  const legacyId = "legacy-card";
  const legacyFolder = mkdtempSync(join(tmpdir(), "configured-media-empty-"));
  const silentAddressed = fakeRenderer(addressed.folder, { produce: false });
  const silentLegacy = fakeRenderer(legacyFolder, { produce: false });
  try {
    approveConfiguredMediaStage(addressed.folder, "linkedin-card");
    await assert.rejects(
      withFakeNpm(silentAddressed.dir, () => executeConfiguredMediaStage(addressed.folder, "linkedin-card", defaultConfiguredMediaRenderer)),
      /configured card render produced no verified output/,
    );
    assert.equal(existsSync(join(addressed.folder, "media-stages", ".renders")), false, "and nothing was marked complete");

    mkdirSync(join(legacyFolder, "media-stages"));
    mkdirSync(join(legacyFolder, "derivatives"));
    writeFileSync(join(legacyFolder, "media-stages", `${legacyId}.json`), JSON.stringify({
      version: "configured-media-stage-v1", id: legacyId, media: "static-quote-card", status: "staged",
      stage: "render-required", plan: { kind: "quote-render-plan", sourceText: quote }, primitives: ["injected"],
    }));
    writeFileSync(join(legacyFolder, "derivatives", `${legacyId}-quote.md`), `---\nplatform: quote-card\nsource_lines: [4]\n---\n\n${quote}\n`);
    writeFileSync(join(legacyFolder, "review-queue.md"),
      `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| ${legacyId} | linkedin | image | media-stages/${legacyId}.json | — | — | — | pending | | from GUI queue |\n`);
    approveConfiguredMediaStage(legacyFolder, legacyId);
    await assert.rejects(
      withFakeNpm(silentLegacy.dir, () => executeConfiguredMediaStage(legacyFolder, legacyId, defaultConfiguredMediaRenderer)),
      /configured card render produced no verified output/,
      "a legacy render still has to prove it produced its assets",
    );
    assert.equal(JSON.parse(readFileSync(join(legacyFolder, "media-stages", `${legacyId}.json`), "utf8")).status, "approved");
  } finally {
    rmSync(addressed.folder, { recursive: true, force: true });
    rmSync(legacyFolder, { recursive: true, force: true });
    rmSync(silentAddressed.dir, { recursive: true, force: true });
    rmSync(silentLegacy.dir, { recursive: true, force: true });
  }
});

test("SLICE-5I: reusing a shared render still revalidates the approved quote against the definition", async () => {
  const quote = "Careful teams ship the smaller first step.";
  const { folder, names } = cardRequestFolder([
    { id: "linkedin-card", platform: "linkedin", media: "static-quote-card", quote },
    { id: "bluesky-card", platform: "bluesky", media: "static-quote-card", quote },
  ]);
  const shared = names.get("linkedin-card")!;
  const npm = fakeRenderer(folder);
  try {
    approveConfiguredMediaStage(folder, "linkedin-card");
    await withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, "linkedin-card", defaultConfiguredMediaRenderer));
    assert.equal(npm.calls().length, 1);
    assert.ok(existsSync(join(folder, "media-stages", ".renders", `${shared}.json`)), "the render is marked reusable");

    // The definition is swapped after the render was marked. The reuse path must still validate it
    // before serving that file to the second stage — the assertion is not skipped when nothing is
    // spawned.
    writeFileSync(join(folder, "derivatives", `${shared}.md`), `---\nplatform: quote-card\nsource_lines: [4]\n---\n\nUnapproved text nobody reviewed.\n`);
    approveConfiguredMediaStage(folder, "bluesky-card");
    await assert.rejects(
      withFakeNpm(npm.dir, () => executeConfiguredMediaStage(folder, "bluesky-card", defaultConfiguredMediaRenderer)),
      /no longer matches its approved render plan/,
      "a reused render is only served to a stage whose approved quote still matches the definition",
    );
    assert.equal(npm.calls().length, 1, "and the refusal spawns nothing");
    assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/bluesky-card.json"), "utf8")).status, "approved");
    assert.equal(readQueue(folder).rows.find((row) => row.id === "bluesky-card")!.asset, "media-stages/bluesky-card.json",
      "the second row was never promoted onto the shared file");
  } finally {
    rmSync(folder, { recursive: true, force: true });
    rmSync(npm.dir, { recursive: true, force: true });
  }
});

test("render refuses a plan changed after its explicit approval", async () => {
  const folder = fixture("image");
  approveConfiguredMediaStage(folder, "m1");
  const path = join(folder, "media-stages/m1.json");
  const stage = JSON.parse(readFileSync(path, "utf8")); stage.plan = { kind: "tampered" };
  writeFileSync(path, JSON.stringify(stage));
  await assert.rejects(executeConfiguredMediaStage(folder, "m1", async () => ({ primaryAsset:"x", assets:["x"], costUsd:0 })), /changed after approval/);
});

test("promotion failure checkpoints verified output and retry promotes without rerendering or billing", async () => {
  const folder = fixture("static-quote-card");
  approveConfiguredMediaStage(folder, "m1");
  let renders = 0;
  const renderer = async (_stage: unknown, root: string) => {
    renders++;
    const primary = "images/m1-quote.png";
    const out = join(root, primary); mkdirSync(dirname(out), { recursive:true }); writeFileSync(out, "verified once");
    return { primaryAsset: primary, assets: [primary], costUsd: 1.25 };
  };
  await assert.rejects(
    executeConfiguredMediaStage(folder, "m1", renderer, () => { throw new Error("injected promotion crash"); }),
    /injected promotion crash/,
  );
  assert.equal(renders, 1);
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "promotion-pending");

  const result = await executeConfiguredMediaStage(folder, "m1", renderer);
  assert.equal(renders, 1, "retry must not rerun a renderer or incur provider cost again");
  assert.equal(result.costUsd, 1.25);
  assert.match(readFileSync(join(folder, "review-queue.md"), "utf8"), /images\/m1-quote\.png/);
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "rendered");
});

test("an approved image stage attaches one reviewed in-folder image through the render checkpoint", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/codex-art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");

  const result = await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/codex-art.png"]);

  assert.deepEqual(result, {
    primaryAsset: "configured-media/m1/image.png",
    assets: ["configured-media/m1/image.png"],
    costUsd: 0,
  });
  assert.deepEqual(readFileSync(join(folder, result.primaryAsset)), IMAGE_BYTES.png);
  const stage = JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8"));
  assert.equal(stage.status, "rendered");
  assert.equal(stage.rendered.manifestPath, "configured-media/m1/render-manifest.json");
  const manifest = JSON.parse(readFileSync(join(folder, stage.rendered.manifestPath), "utf8"));
  assert.equal(manifest.version, "configured-media-render-v1");
  assert.equal(manifest.approvalDigest, stage.approval.digest);
  assert.match(readFileSync(join(folder, "review-queue.md"), "utf8"), /configured-media\/m1\/image\.png/);
});

test("an approved carousel preserves reviewed slide order and writes both carousel and render manifests", async () => {
  const folder = fixture("image-carousel");
  const stagePath = join(folder, "media-stages/m1.json");
  const staged = JSON.parse(readFileSync(stagePath, "utf8"));
  staged.plan = { kind: "carousel-slide-plan", slides: ["one", "two"] };
  writeFileSync(stagePath, JSON.stringify(staged));
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/slide-1.png"), IMAGE_BYTES.png);
  writeFileSync(join(folder, "reviewed/slide-2.jpg"), IMAGE_BYTES.jpg);
  approveConfiguredMediaStage(folder, "m1");

  const result = await attachReviewedConfiguredMediaFiles(folder, "m1", [
    "reviewed/slide-1.png",
    "reviewed/slide-2.jpg",
  ]);

  assert.equal(result.primaryAsset, "configured-media/m1/carousel-manifest.json");
  assert.deepEqual(result.assets, [
    "configured-media/m1/carousel-manifest.json",
    "configured-media/m1/slide-1.png",
    "configured-media/m1/slide-2.jpg",
  ]);
  assert.deepEqual(JSON.parse(readFileSync(join(folder, result.primaryAsset), "utf8")), {
    version: "configured-carousel-v1",
    slides: result.assets.slice(1),
  });
  assert.deepEqual(readFileSync(join(folder, result.assets[1])), IMAGE_BYTES.png);
  assert.deepEqual(readFileSync(join(folder, result.assets[2])), IMAGE_BYTES.jpg);
});

test("reviewed-file attachment rejects unapproved, changed, non-image, unsafe, and malformed inputs", async () => {
  const folder = fixture("image-carousel");
  const stagePath = join(folder, "media-stages/m1.json");
  const staged = JSON.parse(readFileSync(stagePath, "utf8"));
  staged.plan = { kind: "carousel-slide-plan", slides: ["one", "two"] };
  writeFileSync(stagePath, JSON.stringify(staged));
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/slide-1.png"), IMAGE_BYTES.png);
  writeFileSync(join(folder, "reviewed/slide-2.png"), IMAGE_BYTES.png);
  writeFileSync(join(folder, "reviewed/empty.png"), "");
  writeFileSync(join(folder, "reviewed/not-image.txt"), IMAGE_BYTES.png);
  mkdirSync(join(folder, "reviewed/directory.png"));
  symlinkSync(join(folder, "reviewed/slide-1.png"), join(folder, "reviewed/link.png"));
  const outside = mkdtempSync(join(tmpdir(), "configured-media-outside-"));
  writeFileSync(join(outside, "escaped.png"), "outside");
  symlinkSync(outside, join(folder, "reviewed/linked-directory"));

  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-1.png", "reviewed/slide-2.png"]), /not approved/);
  approveConfiguredMediaStage(folder, "m1");
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["../outside.png", "reviewed/slide-2.png"]), /unsafe/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/link.png", "reviewed/slide-2.png"]), /symlink/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/linked-directory/escaped.png", "reviewed/slide-2.png"]), /outside|symlink/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/directory.png", "reviewed/slide-2.png"]), /regular file/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/empty.png", "reviewed/slide-2.png"]), /empty/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/not-image.txt", "reviewed/slide-2.png"]), /image file/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-1.png"]), /exactly 2/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-2.png", "reviewed/slide-1.png"]), /slide order/);

  const changed = JSON.parse(readFileSync(stagePath, "utf8"));
  changed.plan.slides[0] = "changed";
  writeFileSync(stagePath, JSON.stringify(changed));
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-1.png", "reviewed/slide-2.png"]), /changed after approval/);
});

test("reviewed-file attachment rejects non-image stages", async () => {
  const folder = fixture("short-video-script");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/frame.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/frame.png"]), /only image and image-carousel/);
});

test("attachment promotion retry uses its checkpoint without copying reviewed files again", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");

  await assert.rejects(
    attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"], () => { throw new Error("injected promotion crash"); }),
    /injected promotion crash/,
  );
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "promotion-pending");
  writeFileSync(join(folder, "reviewed/art.png"), Buffer.concat([IMAGE_BYTES.png, Buffer.from("changed source") ]));

  const result = await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]);
  assert.deepEqual(readFileSync(join(folder, result.primaryAsset)), IMAGE_BYTES.png);
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "rendered");
  assert.ok(existsSync(join(folder, "configured-media/m1/render-manifest.json")));
});

test("reviewed attachment promotion and retry identify attachment provenance instead of provider rendering", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  const notes: string[] = [];

  await assert.rejects(
    attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"], (_folder, _id, update) => {
      notes.push(update.notes);
      throw new Error("promotion interrupted");
    }),
    /promotion interrupted/,
  );
  await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"], (_folder, _id, update) => {
    notes.push(update.notes);
    return true;
  });

  assert.equal(notes.length, 2);
  assert.match(notes[0], /^Attached reviewed image; manifest /);
  assert.equal(notes[1], notes[0], "retry must retain the checkpointed attachment provenance");
  assert.doesNotMatch(notes[0], /^Rendered /);
});

test("reviewed attachments validate image magic bytes against png, jpeg, webp, and gif extensions", async () => {
  for (const [extension, bytes] of Object.entries(IMAGE_BYTES)) {
    const folder = fixture("image", extension);
    mkdirSync(join(folder, "reviewed"));
    const fileExtension = extension === "jpg" ? "jpeg" : extension;
    writeFileSync(join(folder, `reviewed/art.${fileExtension}`), bytes);
    approveConfiguredMediaStage(folder, extension);
    const result = await attachReviewedConfiguredMediaFiles(folder, extension, [`reviewed/art.${fileExtension}`]);
    assert.equal(result.primaryAsset, `configured-media/${extension}/image.${fileExtension}`);
  }

  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/spoofed.png"), Buffer.from("not actually a png"));
  writeFileSync(join(folder, "reviewed/mismatched.png"), IMAGE_BYTES.jpg);
  approveConfiguredMediaStage(folder, "m1");
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/spoofed.png"]), /image bytes.*extension/i);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/mismatched.png"]), /image bytes.*extension/i);
});

test("a concurrent attachment and production render serialize per stage so paid rendering cannot duplicate work", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  let renders = 0;
  let releaseRenderer!: () => void;
  const rendererBlocked = new Promise<void>((resolve) => { releaseRenderer = resolve; });
  let markRendererStarted!: () => void;
  const rendererStarted = new Promise<void>((resolve) => { markRendererStarted = resolve; });
  const renderPromise = executeConfiguredMediaStage(folder, "m1", async (_stage, root) => {
    renders++;
    markRendererStarted();
    await rendererBlocked;
    const output = join(root, "configured-media/m1/provider.png");
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, IMAGE_BYTES.png);
    return { primaryAsset: "configured-media/m1/provider.png", assets: ["configured-media/m1/provider.png"], costUsd: 2 };
  });
  await rendererStarted;
  const attachmentPromise = attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]);
  releaseRenderer();
  const [render, attachment] = await Promise.allSettled([renderPromise, attachmentPromise]);

  assert.equal(render.status, "fulfilled");
  assert.equal(attachment.status, "rejected");
  assert.equal(renders, 1, "only the already-started paid provider call may run");
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "rendered");
});

test("a cross-process stage lease rejects contention before attachment or paid rendering starts", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  const lease = tryAcquireFileLease(join(folder, "media-stages/.locks/m1.execute.lock"));
  assert.ok(lease);
  let renders = 0;
  try {
    await assert.rejects(
      attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]),
      /already executing in another process/,
    );
    await assert.rejects(
      executeConfiguredMediaStage(folder, "m1", async () => {
        renders++;
        return { primaryAsset: "never.png", assets: ["never.png"], costUsd: 5 };
      }),
      /already executing in another process/,
    );
    assert.equal(renders, 0);
    assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "approved");
  } finally {
    lease.release();
  }

  const attached = await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]);
  assert.equal(attached.primaryAsset, "configured-media/m1/image.png");
});
