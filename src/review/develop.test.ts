import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";
import { tmpdir } from "node:os";
import {
  readAdvice,
  writeAdvice,
  roundCount,
  parseLineRefs,
  extractSourceLines,
  acceptAngle,
  dismissCard,
  appendReply,
  developSessionForFolder,
  advicePath,
  developLogPath,
  ownDestinationHosts,
  sourceTagFor,
  contentSessionForFolder,
  type Advice,
} from "./develop.js";
import {
  buildFormatArg,
  parseContinueArg,
  continueJobProgressed,
  continueArtifactCounts,
  resolveContinueArg,
  settleContinueRun,
  runContinueJob,
  jobLogPath,
} from "./jobs.js";
import { scaffoldContentFolder } from "../atomize/new-content.js";
import { repoRoot } from "../db/db.js";

// A minimal content folder: source.md (the verbatim material) + review-queue.md (what makes a
// folder a real content folder everywhere else in this GUI).
function tmpFolder(sourceLines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "develop-test-"));
  writeFileSync(join(dir, "source.md"), sourceLines.join("\n") + "\n");
  writeFileSync(join(dir, "review-queue.md"), "# Review queue — Test piece\n");
  return dir;
}

function sampleAdvice(): Advice {
  return {
    version: 1,
    rounds: [
      {
        index: 1,
        trigger: "initial",
        replyText: null,
        at: "2026-07-17T00:00:00Z",
        cards: [
          {
            id: "r1-c1",
            kind: "angle",
            title: "Belief under audit: fear is aimed at the wrong actor",
            summary: "Advisor rationale prose that must NEVER enter a cut body.",
            lens: "belief-audit",
            sourceLines: [2, "4-5"],
            status: "open",
            acceptedLens: null,
            decidedAt: null,
          },
          {
            id: "r1-c2",
            kind: "cta",
            title: "CTA sense-check",
            summary: "Reads as essay_excerpt; no project link applies.",
            status: "open",
            acceptedLens: null,
            decidedAt: null,
          },
        ],
      },
    ],
  };
}

// ── advice.json round-trip ──────────────────────────────────────────────────────────────────────

test("writeAdvice/readAdvice round-trips, and roundCount counts rounds", () => {
  const dir = tmpFolder(["L1", "L2", "L3", "L4", "L5"]);
  try {
    assert.equal(readAdvice(dir), null);
    assert.equal(roundCount(dir), 0);
    writeAdvice(dir, sampleAdvice());
    const back = readAdvice(dir);
    assert.ok(back);
    assert.equal(back.rounds.length, 1);
    assert.equal(back.rounds[0].cards[0].id, "r1-c1");
    assert.equal(roundCount(dir), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readAdvice returns null on malformed JSON instead of throwing", () => {
  const dir = tmpFolder(["L1"]);
  try {
    mkdirSync(join(dir, "develop"), { recursive: true });
    writeFileSync(advicePath(dir), "{ this is not json");
    assert.equal(readAdvice(dir), null);
    assert.equal(roundCount(dir), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readAdvice normalizes an unknown card kind/status instead of dropping the card", () => {
  const dir = tmpFolder(["L1"]);
  try {
    mkdirSync(join(dir, "develop"), { recursive: true });
    writeFileSync(
      advicePath(dir),
      JSON.stringify({ version: 1, rounds: [{ index: 1, trigger: "initial", cards: [{ id: "r1-c1", kind: "wat", status: "hm", title: "t", summary: "s" }] }] }),
    );
    const advice = readAdvice(dir);
    assert.ok(advice);
    assert.equal(advice.rounds[0].cards[0].kind, "note");
    assert.equal(advice.rounds[0].cards[0].status, "open");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── line refs + verbatim extraction (the extraction-first guardrail's mechanics) ────────────────

test("parseLineRefs accepts bare numbers and start-end ranges", () => {
  assert.deepEqual(parseLineRefs([12, "31-33"]), [[12, 12], [31, 33]]);
});

test("parseLineRefs rejects malformed, reversed, zero, and non-integer refs", () => {
  assert.throws(() => parseLineRefs(["33-31"]), /bad line ref/);
  assert.throws(() => parseLineRefs(["x"]), /bad line ref/);
  assert.throws(() => parseLineRefs([0]), /bad line ref/);
  assert.throws(() => parseLineRefs([1.5]), /bad line ref/);
  assert.throws(() => parseLineRefs([]), /at least one/);
});

test("extractSourceLines returns exactly the referenced verbatim lines, ranges separated by a blank line", () => {
  const dir = tmpFolder(["# Title", "Muxin line two.", "filler", "Range start.", "Range end."]);
  try {
    assert.equal(extractSourceLines(dir, [2, "4-5"]), "Muxin line two.\n\nRange start.\nRange end.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("extractSourceLines throws on a ref past the end of source.md (stale advisor refs)", () => {
  const dir = tmpFolder(["only one line"]);
  try {
    assert.throws(() => extractSourceLines(dir, ["5-9"]), /past the end/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── acceptAngle: the core guardrail ─────────────────────────────────────────────────────────────

test("acceptAngle creates cuts/<lens>/cut.md whose body is EXACTLY the verbatim source lines — advisor prose never enters", () => {
  const dir = tmpFolder(["# Title", "Muxin line two.", "filler", "Range start.", "Range end."]);
  try {
    writeAdvice(dir, sampleAdvice());
    const result = acceptAngle(dir, "r1-c1");
    assert.equal(result.lens, "belief-audit");
    const cutPath = join(dir, "cuts", "belief-audit", "cut.md");
    assert.ok(existsSync(cutPath));
    const raw = readFileSync(cutPath, "utf8");
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
    assert.equal(body, "Muxin line two.\n\nRange start.\nRange end.");
    assert.ok(!raw.includes("Advisor rationale"), "advisor summary must never land in the cut file body");
    // Card flipped + logged
    const advice = readAdvice(dir)!;
    assert.equal(advice.rounds[0].cards[0].status, "accepted");
    assert.equal(advice.rounds[0].cards[0].acceptedLens, "belief-audit");
    assert.match(readFileSync(developLogPath(dir), "utf8"), /## Accepted: belief-audit \(r1-c1\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acceptAngle refuses: double-accept, non-angle cards, colliding lens, bad lens slugs", () => {
  const dir = tmpFolder(["L1", "L2", "L3", "L4", "L5"]);
  try {
    writeAdvice(dir, sampleAdvice());
    acceptAngle(dir, "r1-c1");
    assert.throws(() => acceptAngle(dir, "r1-c1"), /already accepted/);
    assert.throws(() => acceptAngle(dir, "r1-c2"), /only an angle/);
    assert.throws(() => acceptAngle(dir, "nope"), /no such card/);
    // A second open angle proposing the SAME lens collides with the cut on disk.
    const advice = readAdvice(dir)!;
    advice.rounds[0].cards.push({ id: "r1-c3", kind: "angle", title: "again", summary: "s", lens: "belief-audit", sourceLines: [1], status: "open", acceptedLens: null, decidedAt: null });
    advice.rounds[0].cards.push({ id: "r1-c4", kind: "angle", title: "evil", summary: "s", lens: "../evil", sourceLines: [1], status: "open", acceptedLens: null, decidedAt: null });
    advice.rounds[0].cards.push({ id: "r1-c5", kind: "angle", title: "default", summary: "s", lens: "extract", sourceLines: [1], status: "open", acceptedLens: null, decidedAt: null });
    writeAdvice(dir, advice);
    assert.throws(() => acceptAngle(dir, "r1-c3"), /already exists/);
    assert.throws(() => acceptAngle(dir, "r1-c4"), /bad lens/);
    assert.throws(() => acceptAngle(dir, "r1-c5"), /bad lens/); // "extract" is the top-level default, never a cuts/ subfolder
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dismissCard flips status and persists; a decided card can't be dismissed again", () => {
  const dir = tmpFolder(["L1"]);
  try {
    writeAdvice(dir, sampleAdvice());
    dismissCard(dir, "r1-c2");
    assert.equal(readAdvice(dir)!.rounds[0].cards[1].status, "dismissed");
    assert.throws(() => dismissCard(dir, "r1-c2"), /already dismissed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── reply + session view ────────────────────────────────────────────────────────────────────────

test("appendReply writes the Muxin-reply section (numbered for the round the answer will get)", () => {
  const dir = tmpFolder(["L1"]);
  try {
    writeAdvice(dir, sampleAdvice());
    const round = appendReply(dir, "push the second angle harder");
    assert.equal(round, 2);
    const log = readFileSync(developLogPath(dir), "utf8");
    assert.match(log, /## Muxin — reply \(round 2\)/);
    assert.match(log, /push the second angle harder/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("developSessionForFolder resolves angle previews live from source.md; a stale ref becomes an inline error, not a crash", () => {
  const dir = tmpFolder(["# Title", "Muxin line two.", "filler", "Range start.", "Range end."]);
  try {
    assert.equal(developSessionForFolder(dir, "slug"), null); // no advice yet
    const advice = sampleAdvice();
    advice.rounds[0].cards.push({ id: "r1-c9", kind: "angle", title: "stale", summary: "s", lens: "stale", sourceLines: [99], status: "open", acceptedLens: null, decidedAt: null });
    writeAdvice(dir, advice);
    const session = developSessionForFolder(dir, "slug")!;
    assert.equal(session.title, "Test piece"); // firstHeading strips the "Review queue —" prefix
    const [angle, cta, stale] = session.rounds[0].cards;
    assert.equal(angle.previewText, "Muxin line two.\n\nRange start.\nRange end.");
    assert.equal(cta.previewText, undefined); // non-angle cards carry no preview
    assert.match(stale.previewError!, /past the end/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── "Format for platforms" plumbing (jobs.ts pure pieces) ───────────────────────────────────────

test("buildFormatArg: extract targets the folder itself; any other lens adds --cut", () => {
  assert.equal(buildFormatArg("2026-07-17-foo", "extract"), "--continue content/2026-07-17-foo");
  assert.equal(buildFormatArg("2026-07-17-foo", "short"), "--continue content/2026-07-17-foo --cut short");
});

test("parseContinueArg round-trips buildFormatArg and rejects foreign shapes", () => {
  assert.deepEqual(parseContinueArg("--continue content/2026-07-17-foo"), { folder: "content/2026-07-17-foo" });
  assert.deepEqual(parseContinueArg("--continue content/2026-07-17-foo --cut short"), { folder: "content/2026-07-17-foo", lens: "short" });
  assert.equal(parseContinueArg("https://example.com"), null);
  assert.equal(parseContinueArg("--continue content/x --cut ../evil"), null);
});

test("continueJobProgressed: growth in queue rows OR derivatives counts as progress; neither does not", () => {
  assert.equal(continueJobProgressed({ rows: 3, derivatives: 0 }, { rows: 8, derivatives: 0 }), true);
  assert.equal(continueJobProgressed({ rows: 3, derivatives: 2 }, { rows: 3, derivatives: 5 }), true);
  assert.equal(continueJobProgressed({ rows: 3, derivatives: 2 }, { rows: 3, derivatives: 2 }), false);
});

// ── SLICE-5M: a continue job must inspect the folder that was actually written ───────────────────
// There is exactly ONE live producer of `--continue <folder>`: the notes picker (serve.ts POST
// /api/notes/pick), which enqueues scaffoldContentFolder's ABSOLUTE dir. buildFormatArg emits the
// repo-relative `content/<slug>` shape but has no production caller today — its relative branch and
// the test below are kept deliberately as cheap insurance, not because a caller exists.
//
// The old consumer did join(repoRoot, folder), which concatenates an absolute argument onto the
// root instead of discarding it, so the notes flow counted artifacts in a directory that does not
// exist: a run that produced rows and derivatives reported "added no new rows or derivatives" and
// never reached stampFolderEngine.

const QUEUE_HEADER =
  "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n" +
  "|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n";
const QUEUE_ROW = "| x-1 | x | text | derivatives/x-1.md | 5 | 4 | yes | pending |  | from GUI queue |\n";
const SCAFFOLD_SUBDIRS = ["derivatives", "images", "video", "ready-to-paste"];

// A scaffolded-but-not-yet-formatted content folder inside a throwaway repo root: source.md, an
// empty queue, empty subfolders. Pinned to scaffoldContentFolder's real output by the fixture test
// below, so it cannot drift from what the notes picker actually hands the queue. `root` is
// realpath'd because macOS hands out /var/... temp dirs that canonicalize to /private/var/...
function scaffoldedRoot(slug = "2026-09-05-a-note"): { root: string; rawRoot: string; folderAbs: string; slug: string } {
  const rawRoot = mkdtempSync(join(tmpdir(), "continue-root-"));
  const root = realpathSync(rawRoot);
  const folderAbs = join(root, "content", slug);
  for (const sub of SCAFFOLD_SUBDIRS) mkdirSync(join(folderAbs, sub), { recursive: true });
  writeFileSync(join(folderAbs, "source.md"), "---\ntitle: \"A note\"\n---\n\nThe note body.\n");
  writeFileSync(join(folderAbs, "review-queue.md"), `# Review queue — A note\n\n${QUEUE_HEADER}`);
  return { root, rawRoot, folderAbs, slug };
}

// What a working /atomize --continue run leaves behind: one queue row and the derivative it names.
function runProducedArtifacts(folderAbs: string): void {
  writeFileSync(join(folderAbs, "review-queue.md"), `# Review queue — A note\n\n${QUEUE_HEADER}${QUEUE_ROW}`);
  writeFileSync(join(folderAbs, "derivatives", "x-1.md"), "---\nplatform: x\n---\n\nThe drafted post.\n");
}

function fakeContinueJob(arg: string) {
  return { id: "job-continue-test", arg, engine: "codex" as const, status: "running" as const, slugs: [] as string[], error: null as string | null };
}

// A whole job-shaped record, for the one test that drives the real runContinueJob. Deliberately NOT
// stopped: a stopped job never spawns anyway, which would make a no-spawn assertion prove nothing.
function fullContinueJob(arg: string) {
  return {
    id: "job-slice5m-refused", kind: "continue" as const, label: "Note: refused", arg, engine: "codex" as const,
    status: "running" as const, slugs: [] as string[], error: null as string | null,
    createdAt: Date.now(), startedAt: Date.now(), finishedAt: null, lastStdoutLine: null,
    steps: [] as string[], stepTotal: null, step: 0, failedAtStep: null, retryable: false, ask: null, answer: null,
    lastSpawn: undefined as { code: number | null; timedOut: boolean; enoent: boolean } | undefined,
  };
}

function tableLines(text: string): string[] {
  return text.split("\n").filter((l) => l.startsWith("|"));
}

test("the fixture below is the shape scaffoldContentFolder really returns", () => {
  // R4: pin the synthetic folder to the real scaffolder, so this suite breaks if that shape moves.
  // Writes into the repo's own content/ (the only place scaffoldContentFolder can write) and
  // removes it again.
  const real = scaffoldContentFolder({
    title: `slice5m fixture check ${Date.now()}`,
    origin: "pasted-text",
    publishedAt: null,
    text: "Fixture body.",
  });
  const fx = scaffoldedRoot();
  try {
    // The notes picker hands exactly this string to addJob("continue", `--continue ${dir}`).
    assert.equal(isAbsolute(real), true, "scaffoldContentFolder returns an absolute path");
    assert.equal(real.startsWith(join(repoRoot, "content") + sep), true);
    assert.deepEqual(readdirSync(fx.folderAbs).sort(), readdirSync(real).sort());
    assert.deepEqual(
      tableLines(readFileSync(join(fx.folderAbs, "review-queue.md"), "utf8")),
      tableLines(readFileSync(join(real, "review-queue.md"), "utf8")),
    );
    // A freshly scaffolded folder is empty by the artifact check's own reckoning, which is what
    // makes "did this run add anything" a meaningful question.
    assert.deepEqual(continueArtifactCounts(real), { rows: 0, derivatives: 0 });
  } finally {
    rmSync(real, { recursive: true, force: true });
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("a continue job on the notes picker's ABSOLUTE folder concludes 'done' and stamps the engine", () => {
  const { root, folderAbs, slug } = scaffoldedRoot();
  try {
    // Exactly the arg serve.ts POST /api/notes/pick builds: `--continue ` + the absolute dir
    // scaffoldContentFolder returned.
    const arg = `--continue ${folderAbs}`;
    const resolved = resolveContinueArg(arg, root);
    assert.equal(resolved.kind, "ok", "an absolute folder inside content/ must resolve, not be refused");
    const target = resolved.kind === "ok" ? resolved.target : null;
    assert.equal(target!.folderAbs, folderAbs);

    // The regression itself: the old join(root, folder) named a directory that never exists, so
    // both snapshots were zero no matter what the run wrote.
    const concatenated = join(root, folderAbs);
    assert.equal(existsSync(concatenated), false);

    const before = continueArtifactCounts(target!.folderAbs, target!.lens);
    assert.deepEqual(before, { rows: 0, derivatives: 0 });
    runProducedArtifacts(folderAbs);

    const job = fakeContinueJob(arg);
    settleContinueRun(job, resolved, before, null);

    // The outcome, not the path string: the job reports the run worked and links back to the folder.
    assert.equal(job.status, "done");
    assert.equal(job.error, null);
    assert.deepEqual(job.slugs, [slug]);
    // stampFolderEngine reached the real folder and stamped the derivative the queue row names.
    assert.match(readFileSync(join(folderAbs, "derivatives", "x-1.md"), "utf8"), /^engine: codex$/m);

    // And the same run, verified the old way, would still have reported failure — proof the test
    // fixture is not simply always-green.
    const stale = continueArtifactCounts(concatenated);
    assert.equal(continueJobProgressed(before, stale), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an absolute folder given by a path ALIAS still resolves to the same real directory", () => {
  // macOS hands out /var/... and /tmp/... temp dirs whose real paths live under /private/...; a
  // lexical containment test refuses that alias outright. Canonicalizing both sides accepts it and
  // lands on the same directory the picker meant.
  const { root, rawRoot, folderAbs, slug } = scaffoldedRoot();
  const alias = join(rawRoot, "content", slug);
  try {
    assert.notEqual(alias, folderAbs, "this platform's tmpdir is not aliased; the case is untested here");
    const resolved = resolveContinueArg(`--continue ${alias}`, root);
    assert.equal(resolved.kind, "ok", "an alias of a folder inside content/ must not be refused");
    const target = resolved.kind === "ok" ? resolved.target : null;
    assert.equal(target!.folderAbs, folderAbs);

    const before = continueArtifactCounts(target!.folderAbs, target!.lens);
    runProducedArtifacts(folderAbs);
    const job = fakeContinueJob(`--continue ${alias}`);
    settleContinueRun(job, resolved, before, null);
    assert.equal(job.status, "done");
    assert.deepEqual(job.slugs, [slug]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a continue job on buildFormatArg's RELATIVE folder still resolves to the same real directory", () => {
  // Insurance only: buildFormatArg has no production caller today. Kept so the relative shape is
  // covered if one returns.
  const { root, folderAbs, slug } = scaffoldedRoot();
  try {
    const resolved = resolveContinueArg(buildFormatArg(slug, "extract"), root);
    assert.equal(resolved.kind, "ok");
    const target = resolved.kind === "ok" ? resolved.target : null;
    assert.equal(target!.folderAbs, folderAbs, "the relative producer must reach the same directory");

    const before = continueArtifactCounts(target!.folderAbs, target!.lens);
    runProducedArtifacts(folderAbs);
    const job = fakeContinueJob(buildFormatArg(slug, "extract"));
    settleContinueRun(job, resolved, before, null);
    assert.equal(job.status, "done");
    assert.deepEqual(job.slugs, [slug]);

    // A cut lens rides through resolution unchanged — same folder, lens preserved for the
    // cuts/<lens>/derivatives snapshot.
    assert.deepEqual(resolveContinueArg(buildFormatArg(slug, "short"), root), {
      kind: "ok",
      target: { folder: `content/${slug}`, folderAbs, lens: "short" },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a continue run that genuinely produced nothing still reports no progress", () => {
  const { root, folderAbs, slug } = scaffoldedRoot();
  try {
    const arg = `--continue ${folderAbs}`;
    const resolved = resolveContinueArg(arg, root);
    const target = resolved.kind === "ok" ? resolved.target : null;
    const before = continueArtifactCounts(target!.folderAbs, target!.lens);
    // No runProducedArtifacts() — the subprocess exited clean and wrote nothing.
    const job = fakeContinueJob(arg);
    settleContinueRun(job, resolved, before, null);
    assert.equal(job.status, "failed");
    assert.match(job.error!, /added no new rows or derivatives/);
    assert.match(job.error!, new RegExp(slug));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a continue run whose subprocess failed reports 'failed' even though artifacts grew", () => {
  // R5: growth is necessary, not sufficient. A run that wrote rows and then died still failed, and
  // the spawn's own message wins over the artifact wording.
  const { root, folderAbs } = scaffoldedRoot();
  try {
    const arg = `--continue ${folderAbs}`;
    const resolved = resolveContinueArg(arg, root);
    const target = resolved.kind === "ok" ? resolved.target : null;
    const before = continueArtifactCounts(target!.folderAbs, target!.lens);
    runProducedArtifacts(folderAbs);
    const job = fakeContinueJob(arg);
    settleContinueRun(job, resolved, before, "Formatting for platforms failed (exit 1)");
    assert.equal(job.status, "failed");
    assert.equal(job.error, "Formatting for platforms failed (exit 1)");
    assert.deepEqual(job.slugs, [], "a failed run gets no review jump link");
    // And nothing was stamped, because the stamp only ever runs on a done verdict.
    assert.doesNotMatch(readFileSync(join(folderAbs, "derivatives", "x-1.md"), "utf8"), /engine:/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a folder outside the content tree is REFUSED: the job fails, and nothing outside is read or stamped", () => {
  const { root, folderAbs } = scaffoldedRoot();
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "continue-outside-")));
  try {
    // Traversal, an absolute path elsewhere on disk, and the content root itself are all refused —
    // where the old join(repoRoot, folder) would have walked straight out of the repository.
    for (const folder of ["../evil", "content/../../evil", join(outside, "evil"), "content", `${root}-worktrees/x`]) {
      assert.deepEqual(resolveContinueArg(`--continue ${folder}`, root), { kind: "refused", folder }, folder);
    }
    // The pre-existing lens rejection is untouched: an invalid --cut is still refused at parse, and
    // an argument this module never built stays "unparseable" (its own, older escape hatch).
    assert.equal(parseContinueArg("--continue content/x --cut ../evil"), null);
    assert.deepEqual(resolveContinueArg(`--continue ${folderAbs} --cut ../evil`, root), { kind: "unparseable" });
    assert.deepEqual(resolveContinueArg("https://example.com", root), { kind: "unparseable" });

    // The verdict, not just the resolver: a refused folder FAILS the job. It used to report "done"
    // for a run that did nothing, because refusal shared the unparseable escape hatch.
    mkdirSync(join(outside, "derivatives"), { recursive: true });
    writeFileSync(join(outside, "review-queue.md"), `# Review queue\n\n${QUEUE_HEADER}${QUEUE_ROW}`);
    const untouched = "---\nplatform: x\n---\n\nSomeone else's file.\n";
    writeFileSync(join(outside, "derivatives", "x-1.md"), untouched);
    const job = fakeContinueJob(`--continue ${outside}`);
    settleContinueRun(job, resolveContinueArg(`--continue ${outside}`, root), null, null);
    assert.equal(job.status, "failed");
    assert.match(job.error!, /^refused to format /);
    assert.match(job.error!, new RegExp(outside.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.deepEqual(job.slugs, [], "a refused folder never gets a review jump link");
    assert.equal(readFileSync(join(outside, "derivatives", "x-1.md"), "utf8"), untouched);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("a SYMLINK planted inside content/ cannot walk a continue job out of the tree", () => {
  // A lexical prefix check accepts content/escape and then counts, and STAMPS, files outside the
  // repository. Canonicalizing both sides before the check is what refuses it.
  const { root } = scaffoldedRoot();
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "continue-symlink-")));
  try {
    mkdirSync(join(outside, "derivatives"), { recursive: true });
    writeFileSync(join(outside, "review-queue.md"), `# Review queue\n\n${QUEUE_HEADER}${QUEUE_ROW}`);
    const untouched = "---\nplatform: x\n---\n\nOutside the repository.\n";
    writeFileSync(join(outside, "derivatives", "x-1.md"), untouched);
    symlinkSync(outside, join(root, "content", "escape"));

    const arg = "--continue content/escape";
    const resolved = resolveContinueArg(arg, root);
    assert.deepEqual(resolved, { kind: "refused", folder: "content/escape" });
    const job = fakeContinueJob(arg);
    settleContinueRun(job, resolved, null, null);
    assert.equal(job.status, "failed");
    assert.deepEqual(job.slugs, []);
    assert.equal(readFileSync(join(outside, "derivatives", "x-1.md"), "utf8"), untouched, "no stamp outside the tree");
    // The same symlink named absolutely is refused too.
    assert.deepEqual(resolveContinueArg(`--continue ${join(root, "content", "escape")}`, root).kind, "refused");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("a DANGLING symlink inside content/ is refused, not treated as a folder yet to be created", () => {
  // realpath fails with ENOENT on a dangling link exactly as it does on a folder /atomize has not
  // written yet. Walking past it re-appends its name under a canonical ancestor and calls that
  // contained, while the OS keeps following the link outside the tree.
  const { root } = scaffoldedRoot();
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "continue-dangling-")));
  try {
    symlinkSync(join(outside, "not-created"), join(root, "content", "dangling"));
    assert.equal(existsSync(join(root, "content", "dangling")), false, "the link target really is missing");
    const resolved = resolveContinueArg("--continue content/dangling", root);
    assert.deepEqual(resolved, { kind: "refused", folder: "content/dangling" });
    const job = fakeContinueJob("--continue content/dangling");
    settleContinueRun(job, resolved, null, null);
    assert.equal(job.status, "failed");
    assert.deepEqual(job.slugs, []);
    // A folder that genuinely does not exist yet is still fine: only the dangling link is refused.
    assert.equal(resolveContinueArg("--continue content/not-written-yet", root).kind, "ok");
  } finally {
    rmSync(join(root, "content", "dangling"), { force: true });
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("a folder whose canonical path cannot be read (EACCES) is refused, not accepted lexically", () => {
  const { root } = scaffoldedRoot();
  const locked = join(root, "content", "locked");
  try {
    mkdirSync(join(locked, "inner"), { recursive: true });
    chmodSync(locked, 0o000);
    if (existsSync(join(locked, "inner"))) return; // running as root: the permission bit means nothing
    assert.deepEqual(resolveContinueArg("--continue content/locked/inner", root), {
      kind: "refused",
      folder: "content/locked/inner",
    });
  } finally {
    chmodSync(locked, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});

test("a `..` segment is refused before resolution, so the checked path is the one the subprocess gets", () => {
  // resolve() collapses `..` lexically, ahead of symlinks: `content/link/../marker` checks out as
  // `content/marker` while the OS, following the real link, lands on `<outside>/marker`. The job
  // hands the raw string to /atomize, so checking the collapsed form checks a different directory.
  const { root } = scaffoldedRoot();
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "continue-dotdot-")));
  try {
    mkdirSync(join(outside, "child"), { recursive: true });
    symlinkSync(join(outside, "child"), join(root, "content", "link"));
    assert.deepEqual(resolveContinueArg("--continue content/link/../marker", root), {
      kind: "refused",
      folder: "content/link/../marker",
    });
    // The discrepancy the refusal exists to close: the collapsed form names a directory inside the
    // tree, and it is NOT the directory the OS would have reached.
    assert.equal(resolveContinueArg("--continue content/marker", root).kind, "ok");
  } finally {
    rmSync(join(root, "content", "link"), { force: true });
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("runContinueJob settles a refused folder WITHOUT spawning the formatter", async () => {
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "continue-nospawn-")));
  // The job is NOT stopped, so nothing short-circuits the spawn path but the refusal branch itself.
  // Emptying PATH is the safety net: if that branch regresses, the spawn is entered and fails fast
  // with ENOENT instead of launching a real `/atomize` run — and an entered spawn is exactly what
  // the assertions below detect (runCommandSpawn opens the job log before spawning, and records
  // lastSpawn when the child closes).
  const savedPath = process.env.PATH;
  const job = fullContinueJob(`--continue ${outside}`);
  rmSync(jobLogPath(job.id), { force: true }); // a stale log from an earlier run must not mask a spawn
  try {
    process.env.PATH = "";
    await runContinueJob(job);
  } finally {
    // Restore absence as absence: assigning `undefined` to an env var stores the string
    // "undefined", which would follow every later test in this process.
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
    rmSync(outside, { recursive: true, force: true });
  }
  assert.equal(job.status, "failed");
  assert.match(job.error!, /^refused to format /);
  assert.doesNotMatch(job.error!, /isn't on this server's PATH/);
  assert.equal(job.lastSpawn, undefined, "a spawn would have recorded its result on the job");
  assert.equal(existsSync(jobLogPath(job.id)), false, "a spawn would have opened a job log");
});

// ── The source picker's tags ────────────────────────────────────────────────────────────────────

const OWN = ["humaninference.ai", "humaninference.substack.com", "voter-choice.vercel.app"];

test("ownDestinationHosts reads the configured destinations and skips the `source` keyword", () => {
  const dir = mkdtempSync(join(tmpdir(), "cta-"));
  try {
    const p = join(dir, "cta.yaml");
    writeFileSync(
      p,
      [
        "targets:",
        "  human-ai:",
        "    url: source",
        "  civic-tech:",
        '    url: "https://voter-choice.vercel.app/"',
        "  builder:",
        '    url: "https://www.humaninference.substack.com"',
        "source_fallback:",
        '  url: "https://humaninference.ai"',
        "",
      ].join("\n"),
    );
    assert.deepEqual(ownDestinationHosts(p), ["humaninference.ai", "humaninference.substack.com", "voter-choice.vercel.app"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ownDestinationHosts on a missing file returns nothing, so no origin is guessed as hers", () => {
  assert.deepEqual(ownDestinationHosts(join(tmpdir(), "no-such-cta-config-here.yaml")), []);
});

test("sourceTagFor: every tag stands on a fact, and an origin that does not say gets no tag", () => {
  // a Note: new-notes.ts only ever ingests HER account, so source_kind alone proves it
  const note = sourceTagFor({ source_kind: "substack-note", origin: "https://substack.com/@x/note/c-1" }, OWN);
  assert.equal(note.tag, "SUBSTACK");
  assert.match(note.basis, /source_kind/);

  // an http origin on one of her own configured destinations
  const own = sourceTagFor({ origin: "https://humaninference.substack.com/p/essay" }, OWN);
  assert.equal(own.tag, "SUBSTACK");
  assert.match(own.basis, /config\/cta\.yaml/);

  // the same shape on a foreign host is NOT hers
  const foreign = sourceTagFor({ origin: "https://example.com/p/someone-else" }, OWN);
  assert.equal(foreign.tag, "READ IN");
  assert.match(foreign.basis, /example\.com/);

  // her own local drafts
  for (const origin of ["file:An Essay.md", "pasted-text", "voice-memo:memo.m4a"]) {
    assert.equal(sourceTagFor({ origin }, OWN).tag, "YOURS", origin);
  }

  // nothing to stand on
  assert.equal(sourceTagFor({}, OWN).tag, null);
  assert.equal(sourceTagFor({ origin: "  " }, OWN).tag, null);
  assert.equal(sourceTagFor({ origin: "reply to mention" }, OWN).tag, null);
  assert.equal(sourceTagFor({ origin: "http://" }, OWN).tag, null);
});

test("sourceTagFor never invents VENTURE, the one prototype tag with no source in this repo", () => {
  const vectors: Record<string, unknown>[] = [
    { origin: "file:x.md" },
    { origin: "pasted-text" },
    { origin: "https://humaninference.substack.com/p/x" },
    { origin: "https://example.com/p/x" },
    { source_kind: "substack-note" },
    {},
  ];
  for (const fm of vectors) assert.notEqual(sourceTagFor(fm, OWN).tag, "VENTURE");
});

test("contentSessionForFolder carries the origin facts the picker renders", () => {
  const dir = mkdtempSync(join(tmpdir(), "cs-"));
  try {
    writeFileSync(
      join(dir, "source.md"),
      '---\ntitle: "T"\norigin: https://example.com/p/x\ncanonical_url: https://example.com/p/x\npublished_at: 2026-08-10\n---\n\n# T\n\nbody\n',
    );
    // a cut on disk is what makes this a workbench piece at all
    mkdirSync(join(dir, "cuts", "extract"), { recursive: true });
    writeFileSync(join(dir, "cuts", "extract", "cut.md"), '---\ntitle: "T"\nsource_lines: [1]\n---\n\nbody\n');
    const s = contentSessionForFolder(dir, "2026-08-10-t", OWN);
    assert.ok(s);
    assert.equal(s.origin, "https://example.com/p/x");
    assert.equal(s.canonicalUrl, "https://example.com/p/x");
    assert.equal(s.publishedAt, "2026-08-10");
    assert.equal(s.tag, "READ IN");
    assert.ok(s.tagBasis.length > 0, "the tag never renders bare");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
