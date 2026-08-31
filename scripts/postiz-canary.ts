import { createPostizTransport, type PostizCreateInput } from "../src/publish/postiz.js";
import { runPostizLifecycleCanary, type CanaryApproval } from "../src/publish/postiz-canary.js";

function parseJson<T>(name: string): T {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required as JSON`);
  try { return JSON.parse(value) as T; }
  catch { throw new Error(`${name} must be valid JSON`); }
}

/** Invocation adapter for ~/.claude/verify/run-canary.sh. The library gate remains authoritative. */
async function main(): Promise<void> {
  const input = parseJson<PostizCreateInput>("POSTIZ_CANARY_INPUT_JSON");
  const approval = parseJson<CanaryApproval>("POSTIZ_CANARY_APPROVAL_JSON");
  const result = await runPostizLifecycleCanary(createPostizTransport(), input, approval);
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
