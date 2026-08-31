import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { captureId, captureJobId, listCaptures, markCaptureStarted, saveCapture } from "./captures.js";

test("captures are durable, repository-shaped, and idempotent by room plus exact trimmed input", () => {
  const path = join(mkdtempSync(join(tmpdir(), "captures-")), "data", "captures.json");
  const first = saveCapture("Content", "  a thought\n", path);
  const replay = saveCapture("Content", "a thought", path);
  assert.equal(first.id, captureId("Content", "a thought"));
  assert.deepEqual(replay, first);
  assert.equal(listCaptures(path).length, 1);
  assert.equal(JSON.parse(readFileSync(path, "utf8"))[0].text, "a thought");
});

test("concurrent capture starts reserve one deterministic durable enqueue", async () => {
  const root = mkdtempSync(join(tmpdir(), "captures-start-"));
  const path = join(root, "captures.json"), enqueues = join(root, "enqueues.jsonl");
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/captures.ts")).href;
  const script = `import { appendFileSync } from "node:fs"; import { startCapture } from ${JSON.stringify(moduleUrl)}; startCapture("Content", "same source", id => { appendFileSync(process.argv[2], id + "\\n"); return { id }; }, process.argv[1]);`;
  const run = promisify(execFile);
  try {
    await Promise.all(Array.from({ length: 6 }, () => run(process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script, path, enqueues])));
    assert.deepEqual(readFileSync(enqueues, "utf8").trim().split("\n"), [captureJobId(captureId("Content", "same source"))]);
    assert.equal(listCaptures(path)[0]!.jobId, captureJobId(captureId("Content", "same source")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("restart after crash between durable enqueue and capture bind relaunches the abandoned reservation", async () => {
  const root = mkdtempSync(join(tmpdir(), "captures-crash-"));
  const path = join(root, "captures.json"), store = join(root, "jobs.json"), dataRoot = join(root, "data-root");
  const capturesUrl = pathToFileURL(join(process.cwd(), "src/review/captures.ts")).href;
  const durableUrl = pathToFileURL(join(process.cwd(), "src/runtime/durable-jobs.ts")).href;
  const jobsUrl = pathToFileURL(join(process.cwd(), "src/review/jobs.ts")).href;
  const run = promisify(execFile), env = { ...process.env, CONTENT_AGENTS_TEST_JOB_STORE: store, CONTENT_AGENTS_DATA_ROOT: dataRoot };
  const crash = `import { startCapture } from ${JSON.stringify(capturesUrl)}; import { upsertDurableJob } from ${JSON.stringify(durableUrl)}; try { startCapture("Content", "https://example.com/source", id => { upsertDurableJob({ id, kind:"develop", label:"reserved", status:"queued", ownerPid:process.pid }); throw new Error("crash"); }, process.argv[1]); } catch {}`;
  const restart = `import { startCapture } from ${JSON.stringify(capturesUrl)}; import { addDevelopJob } from ${JSON.stringify(jobsUrl)}; const result = startCapture("Content", "https://example.com/source", (id, c) => addDevelopJob("url", c.text, c.text, undefined, "claude", id), process.argv[1]); console.log(JSON.stringify({ jobId: result.capture.jobId, status: result.job?.status })); process.exit(0);`;
  try {
    await run(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", crash, path], { env });
    assert.equal(listCaptures(path)[0]!.jobId, null, "crash happened before binding");
    const recovered = await run(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", restart, path], { env });
    const result = JSON.parse(recovered.stdout.trim()) as { jobId: string; status: string };
    assert.equal(result.jobId, captureJobId(captureId("Content", "https://example.com/source")));
    assert.ok(["queued", "running"].includes(result.status), `reserved advisor job must be viable, got ${result.status}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("starting a capture binds one real job id and replay cannot replace it", () => {
  const path = join(mkdtempSync(join(tmpdir(), "captures-")), "captures.json");
  const capture = saveCapture("Content", "source", path);
  const started = markCaptureStarted(capture.id, "job-1", path);
  assert.equal(started.jobId, "job-1");
  assert.ok(started.startedAt);
  assert.equal(markCaptureStarted(capture.id, "job-2", path).jobId, "job-1");
});

test("concurrent processes serialize capture creates without losing writers", async () => {
  const root = mkdtempSync(join(tmpdir(), "captures-concurrent-"));
  const path = join(root, "captures.json");
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/captures.ts")).href;
  const script = `import { saveCapture } from ${JSON.stringify(moduleUrl)}; saveCapture("Content", process.argv[2], process.argv[1]);`;
  const run = promisify(execFile);
  try {
    await Promise.all(Array.from({ length: 8 }, (_, index) => run(process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script, path, `thought-${index}`])));
    assert.deepEqual(listCaptures(path).map((row) => row.text).sort(), Array.from({ length: 8 }, (_, index) => `thought-${index}`).sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("concurrent start updates preserve one idempotent winner and valid JSON", async () => {
  const root = mkdtempSync(join(tmpdir(), "captures-update-"));
  const path = join(root, "captures.json");
  const capture = saveCapture("Content", "one source", path);
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/captures.ts")).href;
  const script = `import { markCaptureStarted } from ${JSON.stringify(moduleUrl)}; markCaptureStarted(process.argv[2], process.argv[3], process.argv[1]);`;
  const run = promisify(execFile);
  try {
    await Promise.all(Array.from({ length: 8 }, (_, index) => run(process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script, path, capture.id, `job-${index}`])));
    const rows = listCaptures(path);
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.jobId ?? "", /^job-\d$/);
    assert.ok(rows[0]!.startedAt);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
