import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import type { ContentOrigin } from "../review/content-request.js";
import type { QueueRow } from "./queue.js";
import { splitFrontmatter } from "../util/frontmatter.js";

export const DELIVERY_POLICY_VERSION = "delivery-policy-v1" as const;

export type DeliveryProvider = "postiz" | "typefully" | "postpeer" | "youtube" | "substack" | "manual";
export type DeliveryBrand = "human-inference" | "fiction" | "charles";
export type DeliveryMode = "provider" | "manual" | "blocked";

export interface DeliveryPolicyDecision {
  readonly policyVersion: typeof DELIVERY_POLICY_VERSION;
  readonly origin: ContentOrigin | "missing" | "unknown";
  readonly brand: DeliveryBrand | null;
  readonly provider: DeliveryProvider;
  readonly providerAccountId: string | null;
  readonly mode: DeliveryMode;
  readonly reason: string;
}

const HUMAN_INFERENCE_ACCOUNTS: Readonly<Record<Exclude<DeliveryProvider, "manual">, string>> = {
  postiz: "human-inference/postiz",
  typefully: "human-inference/typefully",
  postpeer: "human-inference/postpeer",
  youtube: "human-inference/youtube",
  substack: "human-inference/substack",
};

/**
 * The complete P0 policy matrix. An account id is a non-secret audit identity, never a credential.
 * Fiction is deliberately not mapped to Muxin's accounts: adding a label without account-selecting
 * adapter support would only make an unsafe shared credential look safe.
 */
export function decideDeliveryPolicy(origin: ContentOrigin | "missing" | "unknown", provider: DeliveryProvider): DeliveryPolicyDecision {
  const base = { policyVersion: DELIVERY_POLICY_VERSION, origin, provider } as const;
  if (origin === "charles") {
    return { ...base, brand: "charles", providerAccountId: null, mode: "manual", reason: "Charles delivery is always ready-to-paste; provider dispatch is prohibited" };
  }
  if (origin === "fiction") {
    return { ...base, brand: "fiction", providerAccountId: null, mode: "blocked", reason: "Fiction has no separately configured provider account; refusing to reuse the Human Inference identity" };
  }
  if (origin === "human-inference" || origin === "venture") {
    if (provider === "manual") return { ...base, brand: "human-inference", providerAccountId: null, mode: "manual", reason: "destination is intentionally manual" };
    return { ...base, brand: "human-inference", providerAccountId: HUMAN_INFERENCE_ACCOUNTS[provider], mode: "provider", reason: `${origin} is explicitly bound to the Human Inference ${provider} account` };
  }
  return {
    ...base,
    brand: null,
    providerAccountId: null,
    mode: "blocked",
    reason: origin === "studio"
      ? "generic Studio origin is brand-ambiguous; choose an explicit content identity before delivery"
      : "content origin is missing or unknown; delivery identity cannot be inferred",
  };
}

function humanInferenceSource(folder: string): boolean {
  const path = join(folder, "source.md");
  if (!existsSync(path)) return false;
  try {
    const { fm } = splitFrontmatter(readFileSync(path, "utf8"));
    const canonical = String(fm.canonical_url ?? "").toLowerCase();
    const origin = String(fm.origin ?? "").toLowerCase();
    return canonical.includes("humaninference.substack.com/") || origin.includes("substack.com/@humaninference/");
  } catch { return false; }
}

function ventureArtifactSource(folder: string): boolean {
  const path = join(folder, "artifacts.jsonl");
  if (!existsSync(path)) return false;
  try {
    const records = readFileSync(path, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as { venture_id?: unknown });
    return records.length > 0 && records.every((record) => record.venture_id === basename(folder));
  } catch { return false; }
}

function storedOrigin(folder: string): { origin: ContentOrigin | "missing" | "unknown"; rationale?: string } {
  const path = join(folder, "content-request.json");
  if (!existsSync(path)) return humanInferenceSource(folder)
    ? { origin: "human-inference", rationale: "legacy folder source.md explicitly identifies the Human Inference Substack account" }
    : ventureArtifactSource(folder)
      ? { origin: "venture", rationale: "venture artifacts.jsonl consistently binds every artifact to this venture directory" }
    : { origin: "missing" };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { origin?: unknown };
    if (parsed.origin === "studio" && humanInferenceSource(folder)) {
      return { origin: "human-inference", rationale: "generic Studio request resolved from source.md's explicit Human Inference account URL" };
    }
    return ["studio", "fiction", "charles", "venture", "human-inference"].includes(String(parsed.origin))
      ? { origin: parsed.origin as ContentOrigin }
      : { origin: "unknown" };
  } catch { return { origin: "unknown" }; }
}

/** Resolve durable content identity without consulting provider credentials. */
export function resolveDeliveryIntent(folder: string, provider: DeliveryProvider): DeliveryPolicyDecision {
  const resolved = storedOrigin(folder);
  let decision = decideDeliveryPolicy(resolved.origin, provider);
  if (resolved.rationale) decision = { ...decision, reason: `${resolved.rationale}; ${decision.reason}` };
  return decision;
}

export function resolveDeliveryPolicy(folder: string, provider: DeliveryProvider): DeliveryPolicyDecision {
  const decision = resolveDeliveryIntent(folder, provider);
  if (decision.mode !== "provider") return decision;
  const envKey = `CONTENT_AGENTS_${provider.toUpperCase()}_ACCOUNT_ID`;
  const configuredAccount = process.env[envKey]?.trim();
  if (!configuredAccount) {
    return { ...decision, mode: "blocked", reason: `${envKey} is missing; the active provider credential identity is unverified` };
  }
  if (configuredAccount !== decision.providerAccountId) {
    return { ...decision, mode: "blocked", reason: `${envKey} does not match the policy account for ${decision.brand}` };
  }
  return decision;
}

export function assertProviderDispatch(folder: string, provider: Exclude<DeliveryProvider, "manual">, supplied?: DeliveryPolicyDecision): DeliveryPolicyDecision {
  // A caller-supplied decision is never authorization. Re-read durable folder metadata and the
  // active credential assertion at the last boundary before provider side effects, then require
  // the earlier decision (when present) to be exactly the same security decision. This closes a
  // confused-deputy path where a valid Human Inference decision could otherwise be handed to a
  // Fiction, Charles, or brand-ambiguous folder.
  const authoritative = resolveDeliveryPolicy(folder, provider);
  if (supplied) {
    const fields = ["policyVersion", "origin", "brand", "provider", "providerAccountId", "mode", "reason"] as const;
    const mismatch = fields.find((field) => supplied[field] !== authoritative[field]);
    if (mismatch) throw new Error(`delivery policy blocked: supplied decision does not match authoritative folder policy (${mismatch})`);
  }
  if (authoritative.provider !== provider) throw new Error(`delivery policy blocked: decision provider ${authoritative.provider} does not match ${provider}`);
  if (authoritative.mode !== "provider" || !authoritative.providerAccountId) throw new Error(`delivery policy blocked: ${authoritative.reason}`);
  return authoritative;
}

/** Charles/manual handoff: write inspectable copy, but do not claim it was posted. */
export function writeReadyToPaste(folder: string, row: QueueRow, decision: DeliveryPolicyDecision): { autoPublishes: false; readyToPaste: string } {
  if (decision.mode !== "manual") throw new Error("ready-to-paste requires a manual delivery policy");
  const asset = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
  const { body } = splitFrontmatter(readFileSync(asset, "utf8"));
  const outputDir = join(folder, "ready-to-paste");
  mkdirSync(outputDir, { recursive: true });
  const relativePath = `ready-to-paste/${row.id.replaceAll("/", "-")}.txt`;
  writeFileSync(join(folder, relativePath), `# paste manually as ${decision.brand ?? decision.origin} to ${row.platform}\n# provider dispatch prohibited by ${decision.policyVersion}\n\n${body.trim()}\n`, { mode: 0o600 });
  return { autoPublishes: false, readyToPaste: relativePath };
}
