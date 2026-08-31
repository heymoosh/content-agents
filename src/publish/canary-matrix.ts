import {
  selectDeliveryRoute,
  type DeliveryRoute,
  type PostizCapabilityRegistry,
  type PostizDestination,
  type PostizMedia,
} from "./postiz.js";
import { type CanaryApproval } from "./postiz-canary.js";

export interface CanaryMatrixCase {
  destination: PostizDestination;
  media: PostizMedia;
  /** Local files need an explicitly advertised Postiz upload capability. */
  requiresLocalMediaUpload?: boolean;
  content?: string;
  localMediaPath?: string;
  /** Required for providers intentionally outside the Postiz/Typefully live-canary path. */
  expectedExceptionRoute?: Exclude<DeliveryRoute, "postiz" | "typefully" | "unsupported">;
}

export interface CanaryMatrixEvidence extends CanaryMatrixCase {
  route: DeliveryRoute;
  outcome: "verified" | "explicit-exception";
  providerObjectId?: string;
  exception?: string;
}

export interface CanaryMatrixRunner {
  postiz(item: CanaryMatrixCase): Promise<{ providerObjectId: string; cleanupTerminal: boolean }>;
  typefully(item: CanaryMatrixCase): Promise<{ providerObjectId: string; cleanupTerminal: boolean }>;
}

/**
 * Attended Phase 1 matrix. Network access is dependency-injected so route selection, gating and
 * cleanup invariants are deterministic in tests. Provider adapters must create draft/private
 * objects only and positively verify cleanup before returning cleanupTerminal=true.
 */
export async function runCanaryMatrix(
  registry: PostizCapabilityRegistry,
  cases: readonly CanaryMatrixCase[],
  approval: CanaryApproval,
  runner: CanaryMatrixRunner,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CanaryMatrixEvidence[]> {
  if (env.CANARY_I_MEAN_IT !== "1") throw new Error("live canary matrix blocked: CANARY_I_MEAN_IT=1 is required");
  if (!approval.approvedBy.trim() || !approval.evidence.trim() || !Number.isFinite(Date.parse(approval.approvedAt))) {
    throw new Error("live canary matrix blocked: valid explicit approval evidence is required");
  }
  const accountId = env.POSTIZ_ACCOUNT_ID?.trim();
  if (!accountId) throw new Error("live canary matrix blocked: POSTIZ_ACCOUNT_ID is required");
  const configuredRegistry: PostizCapabilityRegistry = {
    ...registry,
    capabilities: registry.capabilities.filter((item) => item.accountId === accountId),
  };
  if (configuredRegistry.capabilities.length === 0) {
    throw new Error("live canary matrix incomplete: configured Postiz account advertises no capabilities");
  }
  if (cases.length === 0) throw new Error("live canary matrix incomplete: no destination/media cases were declared");

  const keys = new Set(cases.map((item) => `${item.destination}/${item.media}`));
  for (const capability of configuredRegistry.capabilities) {
    for (const media of capability.media) {
      if (!keys.has(`${capability.destination}/${media}`)) {
        throw new Error(`live canary matrix incomplete: missing Postiz-supported ${capability.destination}/${media}`);
      }
    }
  }

  const evidence: CanaryMatrixEvidence[] = [];
  let verifiedPostiz = 0;
  let verifiedTypefully = 0;
  let verifiedExceptions = 0;
  for (const item of cases) {
    const route = selectDeliveryRoute(configuredRegistry, item.destination, item.media, item);
    if (route === "postiz" || route === "typefully") {
      if (item.expectedExceptionRoute) throw new Error(`live canary matrix invalid: ${item.destination}/${item.media} resolves to ${route}, not exception ${item.expectedExceptionRoute}`);
      const result = await runner[route](item);
      if (!result.providerObjectId.trim()) throw new Error(`${route} canary returned no stable provider object id`);
      if (!result.cleanupTerminal) throw new Error(`${route} canary cleanup was not positively reconciled`);
      evidence.push({ ...item, route, outcome: "verified", providerObjectId: result.providerObjectId });
      if (route === "postiz") verifiedPostiz++;
      else verifiedTypefully++;
      continue;
    }
    if (route === "unsupported") throw new Error(`live canary matrix invalid: ${item.destination}/${item.media} has no configured delivery route`);
    if (item.expectedExceptionRoute !== route) {
      throw new Error(`live canary matrix incomplete: ${item.destination}/${item.media} exception must explicitly declare ${route}`);
    }
    evidence.push({ ...item, route, outcome: "explicit-exception", exception: `${route} is outside the Postiz/Typefully Phase 1 canary path` });
    verifiedExceptions++;
  }
  if (verifiedPostiz === 0) throw new Error("live canary matrix incomplete: no Postiz-first case was verified");
  if (verifiedTypefully === 0) throw new Error("live canary matrix incomplete: no supported Typefully fallback case was verified");
  if (verifiedExceptions === 0) throw new Error("live canary matrix incomplete: no explicit provider exception was validated");
  return evidence;
}
