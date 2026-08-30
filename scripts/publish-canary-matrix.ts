import { runCanaryMatrix, type CanaryMatrixCase } from "../src/publish/canary-matrix.js";
import { createPostizTransport, fetchPostizCapabilities, type PostizCreateInput } from "../src/publish/postiz.js";
import { runPostizLifecycleCanary, type CanaryApproval } from "../src/publish/postiz-canary.js";
import { buildDraftPayload, cancelDraft, createDraft, socialSetId, uploadMedia } from "../src/publish/typefully.js";

function parseJson<T>(name: string): T {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required as JSON`);
  try { return JSON.parse(value) as T; } catch { throw new Error(`${name} must be valid JSON`); }
}

async function main(): Promise<void> {
  const cases = parseJson<CanaryMatrixCase[]>("PUBLISH_CANARY_MATRIX_JSON");
  const approval = parseJson<CanaryApproval>("POSTIZ_CANARY_APPROVAL_JSON");
  const transport = createPostizTransport();
  const registry = await fetchPostizCapabilities(transport);
  const result = await runCanaryMatrix(registry, cases, approval, {
    async postiz(item) {
      const input: PostizCreateInput = {
        destination: item.destination,
        accountId: process.env.POSTIZ_ACCOUNT_ID ?? "",
        content: item.content ?? `content-agents attended ${item.destination}/${item.media} draft canary`,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        visibility: "draft",
      };
      const lifecycle = await runPostizLifecycleCanary(transport, input, approval);
      return { providerObjectId: lifecycle.created.id, cleanupTerminal: lifecycle.reconciled.status === "canceled" };
    },
    async typefully(item) {
      if (!new Set(["x", "linkedin", "bluesky"]).has(item.destination)) throw new Error(`Typefully does not support ${item.destination}`);
      const setId = await socialSetId();
      const post: Record<string, unknown> = { text: item.content ?? `content-agents attended ${item.destination}/${item.media} draft canary` };
      if (item.media === "image") {
        if (!item.localMediaPath) throw new Error(`Typefully ${item.destination}/image canary requires localMediaPath`);
        post.media_ids = [await uploadMedia(setId, item.localMediaPath)];
      }
      const payload = buildDraftPayload({ title: `content-agents canary ${Date.now()}`, platformKey: item.destination, posts: [post as { text: string }], publishAt: null });
      const draft = await createDraft(setId, payload);
      const id = String(draft.id ?? "");
      if (!id) throw new Error("Typefully canary returned no stable draft id");
      // A second idempotent DELETE is the positive provider acknowledgement that cleanup is terminal.
      await cancelDraft(id);
      await cancelDraft(id);
      return { providerObjectId: id, cleanupTerminal: true };
    },
  });
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
