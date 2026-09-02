import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  createPostizTransport, fetchPostizCapabilities, uploadPostizMedia,
  type PostizCapability, type PostizCreateInput, type PostizMediaRef, type PostizTransport,
} from "../src/publish/postiz.js";
import { runPostizLifecycleCanary, type CanaryApproval, type PostizCanaryResult } from "../src/publish/postiz-canary.js";

function parseJson<T>(name: string): T {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required as JSON`);
  try { return JSON.parse(value) as T; }
  catch { throw new Error(`${name} must be valid JSON`); }
}

const CANARY_MARKER = "content-agents canary";

interface ChannelReport {
  destination: string;
  accountId: string;
  accountLabel: string;
  media: "text" | "image" | "video";
  ok: boolean;
  postId?: string;
  scheduledAt?: string;
  rescheduledTo?: string;
  error?: string;
}

/** Build one safe, far-future input per connected channel; media channels use the uploaded fixtures. */
function inputFor(cap: PostizCapability, scheduledAt: string, media: { image?: PostizMediaRef; video?: PostizMediaRef }, stamp: string): { input: PostizCreateInput; media: ChannelReport["media"] } | { skip: string } {
  const content = `${CANARY_MARKER} ${stamp}: scheduled far out and cancelled immediately by the adapter test.`;
  const base = { accountId: cap.accountId, content, scheduledAt, visibility: "scheduled" as const };
  switch (cap.destination) {
    case "instagram":
      if (!media.image) return { skip: "no image fixture" };
      return { media: "image", input: { ...base, destination: cap.destination, media: [media.image], providerSettings: { post_type: "post" } } };
    case "tiktok":
      if (!media.video) return { skip: "no video fixture" };
      return { media: "video", input: { ...base, destination: cap.destination, media: [media.video], providerSettings: { privacy_level: "SELF_ONLY", title: `${CANARY_MARKER} ${stamp}` } } };
    case "youtube":
      if (!media.video) return { skip: "no video fixture" };
      return { media: "video", input: { ...base, destination: cap.destination, media: [media.video], providerSettings: { title: `${CANARY_MARKER} ${stamp}`, type: "private" } } };
    default:
      return { media: "text", input: { ...base, destination: cap.destination } };
  }
}

async function uploadFixture(transport: PostizTransport, envName: string, mime: string): Promise<PostizMediaRef | undefined> {
  const path = process.env[envName];
  if (!path) return undefined;
  return uploadPostizMedia(transport, { bytes: new Uint8Array(readFileSync(path)), filename: basename(path), mime });
}

/** Every connected channel, one attempt each, then a window sweep proving no canary row survived. */
async function runAll(transport: PostizTransport, approval: CanaryApproval): Promise<void> {
  const now = new Date();
  const stamp = now.toISOString();
  const scheduledAt = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
  const rescheduleTo = new Date(Date.parse(scheduledAt) + 60 * 60 * 1000).toISOString();
  const registry = await fetchPostizCapabilities(transport, now, { mediaUploadVerified: true });
  const media = { image: await uploadFixture(transport, "POSTIZ_CANARY_IMAGE", "image/png"), video: await uploadFixture(transport, "POSTIZ_CANARY_VIDEO", "video/mp4") };
  const only = new Set((process.env.POSTIZ_CANARY_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const reports: ChannelReport[] = [];
  for (const cap of registry.capabilities) {
    if (only.size && !only.has(cap.destination)) continue;
    const built = inputFor(cap, scheduledAt, media, stamp);
    if ("skip" in built) { reports.push({ destination: cap.destination, accountId: cap.accountId, accountLabel: cap.accountLabel, media: "text", ok: false, error: built.skip }); continue; }
    const report: ChannelReport = { destination: cap.destination, accountId: cap.accountId, accountLabel: cap.accountLabel, media: built.media, ok: false, scheduledAt, rescheduledTo: rescheduleTo };
    try {
      const result: PostizCanaryResult = await runPostizLifecycleCanary(transport, built.input, approval, process.env, new Date(), { rescheduleTo });
      report.ok = result.reconciled.status === "canceled" && result.rescheduled?.scheduledAt === rescheduleTo;
      report.postId = result.created.id;
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
    }
    reports.push(report);
    process.stderr.write(`${report.ok ? "PASS" : "FAIL"} ${cap.destination} (${cap.accountLabel})${report.error ? `: ${report.error}` : ""}\n`);
  }
  // Sweep: any surviving canary row in the far-future window is a cleanup failure, listed by id.
  const from = new Date(Date.parse(scheduledAt) - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.parse(rescheduleTo) + 24 * 60 * 60 * 1000).toISOString();
  const sweep = await transport.request(`/api/public/v1/posts?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`) as { posts?: Array<Record<string, unknown>> };
  const leftovers = (sweep.posts ?? []).filter((row) => String(row.content ?? "").includes(CANARY_MARKER)).map((row) => ({ id: row.id, publishDate: row.publishDate, integration: (row.integration as Record<string, unknown> | undefined)?.providerIdentifier }));
  const output = { ranAt: stamp, scheduledAt, rescheduleTo, unrecognized: registry.unrecognized ?? [], uploaded: media, channels: reports, leftovers };
  if (process.env.POSTIZ_CANARY_REPORT) writeFileSync(process.env.POSTIZ_CANARY_REPORT, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
  if (leftovers.length || reports.some((r) => !r.ok)) process.exitCode = 1;
}

/** Invocation adapter for ~/.claude/verify/run-canary.sh. The library gate remains authoritative. */
async function main(): Promise<void> {
  const approval = parseJson<CanaryApproval>("POSTIZ_CANARY_APPROVAL_JSON");
  const transport = createPostizTransport();
  if (process.argv.includes("--all")) return runAll(transport, approval);
  const input = parseJson<PostizCreateInput>("POSTIZ_CANARY_INPUT_JSON");
  const result = await runPostizLifecycleCanary(transport, input, approval, process.env, new Date(), process.env.POSTIZ_CANARY_RESCHEDULE_TO ? { rescheduleTo: process.env.POSTIZ_CANARY_RESCHEDULE_TO } : {});
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
