import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { repoRoot } from "../db/db.js";
import { BRAND_IDS, type BrandId } from "../identity/brand.js";
import { loadYamlConfig } from "./load.js";

export const DELIVERY_PROVIDERS = ["postiz", "typefully", "postpeer", "youtube", "substack"] as const;
export type DeliveryProviderAccount = (typeof DELIVERY_PROVIDERS)[number];
export const BRAND_ACCOUNT_REGISTRY_VERSION = "brand-account-registry-v1" as const;

const accountId = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, "must be a non-secret provider/account identity");
const platformRouteSchema = z.object({
  providers: z.array(z.enum(DELIVERY_PROVIDERS)).min(1),
}).strict();
const brandSchema = z.object({
  measurement_account: accountId.optional(),
  provider_accounts: z.record(z.enum(DELIVERY_PROVIDERS), accountId),
  platforms: z.record(z.string().min(1), platformRouteSchema),
}).strict().superRefine((brand, ctx) => {
  for (const [platform, route] of Object.entries(brand.platforms)) {
    for (const provider of route.providers) {
      if (!brand.provider_accounts[provider]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["platforms", platform, "providers"], message: `${provider} has no provider account identity` });
      }
    }
  }
});
const registrySchema = z.object({
  version: z.literal(BRAND_ACCOUNT_REGISTRY_VERSION),
  brands: z.object({
    "human-inference": brandSchema,
    charles: brandSchema,
    fiction: brandSchema,
  }).strict(),
}).strict();

export type BrandAccountRegistry = z.infer<typeof registrySchema>;

const CONFIG_PATH = join(repoRoot, "config", "brand-accounts.yaml");
let cached: BrandAccountRegistry | null = null;
let cachedMtimeMs: number | null = null;

export function loadBrandAccountRegistry(): BrandAccountRegistry {
  const mtimeMs = existsSync(CONFIG_PATH) ? statSync(CONFIG_PATH).mtimeMs : null;
  if (!cached || mtimeMs !== cachedMtimeMs) {
    cached = loadYamlConfig(CONFIG_PATH, registrySchema, {
      version: BRAND_ACCOUNT_REGISTRY_VERSION,
      brands: Object.fromEntries(BRAND_IDS.map((id) => [id, { provider_accounts: {}, platforms: {} }])) as BrandAccountRegistry["brands"],
    });
    cachedMtimeMs = mtimeMs;
  }
  return cached;
}

/** Return only the exact configured non-secret identity; unmapped brands never fall back. */
export function providerAccountForBrand(brand: BrandId, provider: DeliveryProviderAccount): string | null {
  return loadBrandAccountRegistry().brands[brand].provider_accounts[provider] ?? null;
}

export function measurementAccountForBrand(brand: BrandId): string | null {
  return loadBrandAccountRegistry().brands[brand].measurement_account ?? null;
}

/** Candidate order only. Runtime capability discovery and credential checks remain mandatory. */
export function providersForBrandPlatform(brand: BrandId, platform: string): readonly DeliveryProviderAccount[] {
  return loadBrandAccountRegistry().brands[brand].platforms[platform]?.providers ?? [];
}

/** Resolve an account only when both the brand and destination explicitly allow the provider. */
export function providerAccountForBrandPlatform(brand: BrandId, platform: string, provider: DeliveryProviderAccount): string | null {
  if (!providersForBrandPlatform(brand, platform).includes(provider)) return null;
  return providerAccountForBrand(brand, provider);
}
