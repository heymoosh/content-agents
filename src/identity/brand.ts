/** Canonical measurement and delivery identities. Keep this module dependency-light. */
export const BRAND_IDS = ["human-inference", "charles", "fiction"] as const;
export type BrandId = (typeof BRAND_IDS)[number];

export const BRAND_REGISTRY: Readonly<Record<BrandId, { id: BrandId; label: string }>> = {
  "human-inference": { id: "human-inference", label: "Human Inference" },
  charles: { id: "charles", label: "Charles" },
  fiction: { id: "fiction", label: "Fiction" },
};

export function isBrandId(value: unknown): value is BrandId {
  return typeof value === "string" && (BRAND_IDS as readonly string[]).includes(value);
}

/** Resolve only explicit, durable origins. Generic Studio and absent values fail closed. */
export function brandForOrigin(origin: unknown): BrandId | null {
  if (origin === "human-inference" || origin === "venture") return "human-inference";
  if (origin === "charles") return "charles";
  if (origin === "fiction") return "fiction";
  return null;
}

export function requireBrandId(value: unknown): BrandId {
  if (!isBrandId(value)) throw new Error(`invalid brand id: ${String(value)}`);
  return value;
}

/** New ingestion and observation paths must bind both dimensions explicitly. */
export function validateMeasurementBinding(binding: { brandId?: unknown; providerAccountId?: unknown }): { brandId: BrandId; providerAccountId: string } {
  const brandId = requireBrandId(binding.brandId);
  if (typeof binding.providerAccountId !== "string" || !binding.providerAccountId.trim()) {
    throw new Error("provider account id is required for a bound measurement");
  }
  return { brandId, providerAccountId: binding.providerAccountId.trim() };
}
