import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContentRequest } from "./src/review/content-request.js";
import { generateConfiguredContent } from "./src/review/jobs.js";
import { readQueue } from "./src/publish/queue.js";

const repo = process.cwd();
const artifacts = requiredEnv("CANARY_ARTIFACTS");
const executionMode = requiredEnv("CANARY_ENGINE_EXECUTION");
const isolatedData = requiredEnv("CONTENT_AGENTS_DATA_ROOT");
const isolatedJobStore = requiredEnv("CONTENT_AGENTS_TEST_JOB_STORE");
const isolatedHome = requiredEnv("CONTENT_AGENTS_HOME");
const slug = "routing-gate-live-canary";
const folder = join(repo, "content", slug);
const sourceBody = "Most teams do not need another AI strategy deck. They need one small workflow where a person can see what the model changed, reject it, and keep the original.";
const sourceBytes = `---\nsource_kind: essay\n---\n${sourceBody}\n`;
const queueBytes = "# Review queue\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n";
const routingBytes = [
  "# Routing: canary",
  "",
  "| platform | decision | fit | confidence | why |",
  "|----------|----------|-----|------------|-----|",
  "| x | skip | weak | data | Recorded skip must gate the whole platform. |",
  "| bluesky | include | unknown | cold-start | Recorded cold-start include. |",
  "| mastodon | include | hypothesis | exploration | Recorded one-off exploration probe. |",
  "",
].join("\n");

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function listFiles(root: string, prefix = ""): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(join(root, entry.name), rel));
    else files.push(rel);
  }
  return files.sort();
}

function bodyOf(raw: string): string {
  const end = raw.indexOf("\n---\n", 4);
  assert.notEqual(end, -1, "derivative has frontmatter");
  return raw.slice(end + 5);
}

async function waitForCompletedJob(): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (existsSync(isolatedJobStore)) {
      const records = JSON.parse(readFileSync(isolatedJobStore, "utf8")) as Record<string, unknown>[];
      const matches = records.filter((record) => record.kind === "content-generate" && record.label === `Create configured drafts: ${slug}`);
      if (matches.length === 1 && matches[0]?.status === "done") return matches[0]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("isolated durable store did not record exactly one completed configured-generation job");
}

async function main(): Promise<void> {
  assert.equal(process.env.CANARY_I_MEAN_IT, "1", "explicit live-canary gate is required");
  assert.equal(process.env.CROSS_FAMILY_AUDIT_PASSED, "1", "cross-family audit must pass first");
  assert.ok(executionMode === "live" || executionMode === "fake-cli-dry-run", "execution evidence must be explicitly labeled");
  assert.equal(process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN, undefined, "disposable injector token must be absent");
  assert.equal(process.env.E2E_REPO_ROOT, undefined, "disposable injector root must be absent");
  assert.equal(process.env.OPENAI_API_KEY, undefined, "API-key billing is forbidden; use subscription auth only");
  assert.equal(process.env.ANTHROPIC_API_KEY, undefined, "unrelated provider credentials must be absent");
  assert.ok(isolatedData.startsWith(artifacts), "mutable data root must be inside this attempt's artifacts");
  assert.ok(isolatedJobStore.startsWith(artifacts), "job store must be inside this attempt's artifacts");
  assert.ok(isolatedHome.startsWith(artifacts), "content-agents home must be inside this attempt's artifacts");
  assert.deepEqual(listFiles(isolatedData), [], "isolated mutable data must start with no migrated or historical files");
  assert.equal(existsSync(join(repo, ".e2e-configured-engine-token")), false, "disposable injector marker must be absent");
  assert.equal(existsSync(folder), false, "canary content folder must start absent");

  const request = buildContentRequest({
    id: slug,
    origin: "studio",
    descriptor: "A visible, reversible first AI workflow",
    originalInput: sourceBody,
    treatments: ["summary"],
    media: [],
    platforms: ["x", "bluesky", "mastodon"],
    includeUntreatedControl: true,
    sourceProvenance: {
      kind: "source",
      sourceLines: [4],
      canonicalUrl: "https://www.humaninference.ai/essays/canary-source",
    },
  });
  const requestBytes = JSON.stringify(request, null, 2) + "\n";
  const requestSnapshot = JSON.stringify(request);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "source.md"), sourceBytes, { mode: 0o600 });
  writeFileSync(join(folder, "review-queue.md"), queueBytes, { mode: 0o600 });
  writeFileSync(join(folder, "routing.md"), routingBytes, { mode: 0o600 });
  writeFileSync(join(folder, "content-request.json"), requestBytes, { mode: 0o600 });

  const result = await generateConfiguredContent(slug, request, "codex");
  assert.equal(result.engineExecution, undefined, "disposable injected engine must not impersonate a live run");
  assert.equal(JSON.stringify(request), requestSnapshot, "generation must not mutate the request object");
  assert.equal(readFileSync(join(folder, "content-request.json"), "utf8"), requestBytes, "request bytes must remain exact");
  assert.equal(readFileSync(join(folder, "source.md"), "utf8"), sourceBytes, "authoritative source bytes must remain exact");
  assert.equal(readFileSync(join(folder, "routing.md"), "utf8"), routingBytes, "recorded routing bytes must remain exact");

  const included = request.variants.filter((variant) => variant.platform === "bluesky" || variant.platform === "mastodon");
  const skipped = request.variants.filter((variant) => variant.platform === "x");
  assert.deepEqual(result.ids, included.map((variant) => variant.identity.id), "result must preserve all and only routed identities");
  assert.equal(included.filter((variant) => variant.identity.kind === "control").length, 2, "each included platform has a control");
  assert.equal(included.filter((variant) => variant.identity.kind === "treated").length, 2, "each included platform has a treatment");

  for (const variant of skipped) {
    assert.equal(existsSync(join(folder, "derivatives", `${variant.identity.id}.md`)), false, "x skip has no derivative");
    assert.equal(existsSync(join(folder, "media-stages", `${variant.identity.id}.json`)), false, "x skip has no media stage");
  }

  let explorationCount = 0;
  for (const variant of included) {
    const derivativePath = join(folder, "derivatives", `${variant.identity.id}.md`);
    const stagePath = join(folder, "media-stages", `${variant.identity.id}.json`);
    assert.ok(existsSync(derivativePath), `missing included derivative ${variant.identity.id}`);
    assert.ok(existsSync(stagePath), `missing included media stage ${variant.identity.id}`);
    const raw = readFileSync(derivativePath, "utf8");
    assert.match(raw, /^source_lines: \[4\]$/m, "every output retains authoritative source_lines");
    assert.match(raw, new RegExp(`^request_id: ${JSON.stringify(slug)}$`, "m"), "every output retains request provenance");
    assert.match(raw, /^cta: source$/m, "published essay provenance retains source CTA");
    assert.match(raw, /^cta_label: "Read the full essay:"$/m, "source CTA remains essay-scoped");
    const probe = /^exploration_probe: true$/m.test(raw);
    if (probe) explorationCount++;
    assert.equal(probe, variant.platform === "mastodon", "exploration stamp belongs only to mastodon");
    const stage = JSON.parse(readFileSync(stagePath, "utf8")) as { media?: string; stage?: string; status?: string };
    assert.deepEqual({ media: stage.media, stage: stage.stage, status: stage.status }, { media: "none", stage: "draft-ready", status: "staged" });
    if (variant.identity.kind === "control") {
      assert.equal(bodyOf(raw), sourceBody, "untreated control body must be byte-for-byte exact with no added newline");
      assert.doesNotMatch(raw, /^editor_pass:/m, "control must not claim an editor pass");
    } else {
      assert.match(raw, /^editor_pass: cold-feed-v1$/m, "treated output records the real studio editor");
      assert.notEqual(bodyOf(raw).trim(), "", "treated output is nonempty");
    }
  }
  assert.equal(explorationCount, 2, "both and only mastodon variants carry the exploration probe");

  const rows = readQueue(folder).rows;
  assert.deepEqual(rows.map((row) => row.id), included.map((variant) => variant.identity.id), "queue has all and only included identities");
  assert.ok(rows.every((row) => row.status === "pending"), "every included variant remains pending review");
  assert.ok(rows.every((row) => row.platform !== "x"), "x skip has no queue row");
  assert.ok(rows.every((row) => row.origin === "from GUI queue"), "queue provenance remains generation-only");

  const count = Number(readFileSync(join(artifacts, "invocation-count"), "utf8").trim());
  assert.equal(count, 2, "live configured generation must execute real Codex drafting and editor calls exactly once each");
  for (let n = 1; n <= count; n++) {
    const invocation = JSON.parse(readFileSync(join(artifacts, `invocation-${n}.json`), "utf8")) as Record<string, unknown>;
    assert.equal(invocation.completed, true, `Codex invocation ${n} completed`);
    assert.equal(invocation.exit_code, 0, `Codex invocation ${n} exited successfully`);
    assert.equal(invocation.execution, executionMode, `Codex invocation ${n} carries the exact execution label`);
    assert.equal(invocation.engine, executionMode === "live" ? "codex-subscription" : "fake-cli-dry-run", `Codex invocation ${n} cannot be mistaken for another engine`);
    assert.equal(invocation.requested_sandbox, "workspace-write", `Codex invocation ${n} exercised the application sandbox override`);
    assert.equal(invocation.enforced_sandbox, "read-only", `Codex invocation ${n} was read-only`);
    assert.equal(invocation.pinned_cwd, true, `Codex invocation ${n} pinned the source-only fixture cwd`);
    assert.equal(invocation.approval_policy, "never", `Codex invocation ${n} cannot request approvals`);
    assert.equal(invocation.user_config_ignored, true, `Codex invocation ${n} ignored unrelated user config`);
    assert.equal(invocation.mcp_config, "empty", `Codex invocation ${n} had no configured MCP servers`);
    assert.deepEqual(invocation.sanitized_capability_args, [
      "-a", "never", "exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--strict-config",
      "-c", "shell_environment_policy.inherit=none", "-c", "mcp_servers={}", "--cd", "<PINNED_FIXTURE>",
      "--sandbox", "read-only", "--skip-git-repo-check", "--output-last-message", "<ATTEMPT_TMP>",
    ], `Codex invocation ${n} recorded the actual sanitized capability arguments without prompt/auth`);
    assert.ok(existsSync(join(artifacts, `model-output-${n}.txt`)), `Codex invocation ${n} final output was preserved`);
  }

  assert.equal(existsSync(join(folder, "publish-log.md")), false, "generation must not publish");
  assert.equal(existsSync(join(folder, "ready-to-paste")), false, "generation must not prepare delivery");
  const mutableFiles = listFiles(isolatedData);
  assert.ok(mutableFiles.every((path) => !/publish|schedule|slot/i.test(path)), `no publisher or scheduler state is allowed: ${mutableFiles.join(", ")}`);
  const repoDataFiles = listFiles(join(repo, "data"));
  assert.ok(repoDataFiles.every((path) => path === "cost-log.csv"), `only the isolated run's cost audit may appear in repo data: ${repoDataFiles.join(", ")}`);
  const completedJob = await waitForCompletedJob();
  assert.equal(completedJob.engine, "codex", "isolated durable job records the selected engine");
  assert.deepEqual(completedJob.slugs, [slug], "isolated durable job records the generated slug");
  assert.equal(process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN, undefined);
  assert.equal(existsSync(join(repo, ".e2e-configured-engine-token")), false);

  const behaviorSummary = {
    ok: true,
    execution: executionMode,
    completedAt: new Date().toISOString(),
    slug,
    engine: executionMode === "live" ? "codex-subscription" : "fake-cli-dry-run",
    engineInvocations: count,
    routedPlatforms: ["bluesky", "mastodon"],
    skippedPlatforms: ["x"],
    outputIds: result.ids,
    jobStatus: completedJob.status,
    reviewStatus: "pending",
    published: false,
  };
  writeFileSync(join(artifacts, "behavior-result.json"), JSON.stringify(behaviorSummary, null, 2) + "\n", { mode: 0o600 });

  const jobLogCount = listFiles(join(isolatedData, "logs", "gui-jobs")).filter((path) => path.endsWith(".log")).length;
  const isolationPostcheck = {
    ok: jobLogCount === 1,
    retryAuthorized: jobLogCount !== 1,
    checkedAt: new Date().toISOString(),
    expectedJobLogCount: 1,
    actualJobLogCount: jobLogCount,
    historicalLogsCopied: jobLogCount !== 1,
  };
  writeFileSync(join(artifacts, "isolation-postcheck.json"), JSON.stringify(isolationPostcheck, null, 2) + "\n", { mode: 0o600 });
  assert.equal(jobLogCount, 1, "isolated mutable data must contain exactly the current configured-generation job log");

  writeFileSync(join(artifacts, "result.json"), JSON.stringify({ ...behaviorSummary, isolationPostcheck: "passed" }, null, 2) + "\n", { mode: 0o600 });
  console.log(`PASS (${executionMode}): routing gate generated only the included pending-review variants; artifacts preserved privately.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(join(artifacts, "result.json"), JSON.stringify({ ok: false, error: message }, null, 2) + "\n", { mode: 0o600 });
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
});
