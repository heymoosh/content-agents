import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const read = (path: string): string => readFileSync(path, "utf8");

test("repository policy keeps ordinary verification local", () => {
  assert.match(read(".orch/config.toml"), /command = "npm run check"/);
  assert.match(read(".repo-policy/check"), /exec npm run check/);

  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /workflow_dispatch:/);
  assert.doesNotMatch(ci, /^\s*pull_request\s*:/m);
  assert.doesNotMatch(ci, /^\s*push\s*:/m);
});

test("any future Vercel production workflow is v-tag-only", () => {
  const workflowPaths = readdirSync(".github/workflows")
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => `.github/workflows/${name}`);

  for (const path of workflowPaths) {
    const workflow = read(path);
    if (!/(?:npx\s+)?vercel(?:\s+deploy)?[\s\S]{0,200}--prod/.test(workflow)) continue;
    assert.match(workflow, /tags:\s*(?:\n\s*-\s*)?["']?v\*/);
    assert.doesNotMatch(workflow, /^\s*pull_request\s*:/m);
    assert.doesNotMatch(workflow, /^\s*branches\s*:\s*\[?\s*main/m);
    assert.doesNotMatch(workflow, /^\s*workflow_dispatch\s*:/m);
  }
});

test("any future Vercel configuration disables Git auto-deploy", () => {
  if (!existsSync("vercel.json")) return;
  const config = JSON.parse(read("vercel.json")) as { git?: { deploymentEnabled?: unknown } };
  assert.equal(config.git?.deploymentEnabled, false);
});

test("local-only delivery is documented without inventing Vercel configuration", () => {
  const policy = read(".repo-policy/README.md");
  assert.match(policy, /has no\s+Vercel production project/i);
  assert.match(policy, /Delivery is a merge to `main`/);
  assert.match(policy, /git\.deploymentEnabled: false/);
  assert.match(policy, /tags matching `v\*`/);
});
