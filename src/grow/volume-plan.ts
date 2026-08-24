/**
 * A deterministic, planning-only allocation of generated variants to daily slots.
 *
 * This module intentionally carries references and variant metadata only. It never reads or
 * composes source substance, invokes a model, publishes, or mutates the supplied brief.
 */

export type VolumePlanReadiness = "ready" | "blocked";

export interface VolumePlanVariant {
  id: string;
  platform: string;
  experimentAssignment: Record<string, string> | null;
  readiness?: {
    status: VolumePlanReadiness;
    blockers: readonly string[];
  };
}

/** The structural part of GenerationBrief needed by this planner. */
export interface GenerationBrief {
  sourceReference: string;
  substanceReference: string;
  platforms: readonly string[];
  dailyVolumePerPlatform: Readonly<Record<string, number>>;
  variants: readonly VolumePlanVariant[];
}

export type VolumePlanBrief = GenerationBrief;

export interface VolumePlanHumanGate {
  required: true;
  before: "publish";
  approvalOwner: "human";
  status: "pending";
}

export interface VolumePlanSlot {
  platform: string;
  dayIndex: number;
  slotIndex: number;
  variantId: string;
  experimentAssignment: Record<string, string> | null;
  readiness: VolumePlanReadiness;
  blockers: string[];
  humanReviewRequired: true;
  humanGate: VolumePlanHumanGate;
}

export interface VolumePlan {
  sourceReference: string;
  substanceReference: string;
  slots: VolumePlanSlot[];
  humanReviewRequired: true;
  generatesCopy: false;
  sideEffects: "none";
}

export type VolumeOverrides = Readonly<Record<string, number>>;

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function volumeFor(
  platform: string,
  brief: GenerationBrief,
  overrides: VolumeOverrides | undefined,
): number {
  const configured = brief.dailyVolumePerPlatform[platform];
  if (overrides && Object.hasOwn(overrides, platform)) return positiveInteger(overrides[platform], `daily volume for ${platform}`);
  return positiveInteger(configured, `daily volume for ${platform}`);
}

function variantsFor(platform: string, variants: readonly VolumePlanVariant[]): VolumePlanVariant[] {
  return variants.filter((variant) => variant.platform === platform);
}

function gate(): VolumePlanHumanGate {
  return { required: true, before: "publish", approvalOwner: "human", status: "pending" };
}

export function createVolumePlan(brief: GenerationBrief, overrides?: VolumeOverrides): VolumePlan {
  if (brief === null || typeof brief !== "object") throw new Error("generation brief must be an object");
  if (!Array.isArray(brief.platforms) || !Array.isArray(brief.variants)) {
    throw new Error("generation brief must contain platforms and variants");
  }
  if (overrides !== undefined && (overrides === null || typeof overrides !== "object" || Array.isArray(overrides))) {
    throw new Error("volume overrides must be a platform map");
  }

  const platforms = [...brief.platforms];
  const platformSet = new Set(platforms);
  for (const platform of Object.keys(overrides ?? {})) {
    if (!platformSet.has(platform)) throw new Error(`volume overrides contain unknown platform "${platform}"`);
  }

  const slots: VolumePlanSlot[] = [];
  for (const platform of platforms) {
    const platformVariants = variantsFor(platform, brief.variants);
    if (platformVariants.length === 0) throw new Error(`platform "${platform}" has no variants`);

    const dailyVolume = volumeFor(platform, brief, overrides);
    const dayCount = Math.ceil(platformVariants.length / dailyVolume);
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
      const slotsToday = Math.min(dailyVolume, platformVariants.length - dayIndex * dailyVolume);
      for (let slotIndex = 0; slotIndex < slotsToday; slotIndex += 1) {
        const variant = platformVariants[dayIndex * dailyVolume + slotIndex];
        const readiness = variant.readiness?.status ?? "blocked";
        const blockers = variant.readiness ? [...variant.readiness.blockers] : ["variant readiness is unknown"];
        slots.push({
          platform,
          dayIndex,
          slotIndex,
          variantId: variant.id,
          experimentAssignment: variant.experimentAssignment ? { ...variant.experimentAssignment } : null,
          readiness,
          blockers,
          humanReviewRequired: true,
          humanGate: gate(),
        });
      }
    }
  }

  return {
    sourceReference: brief.sourceReference,
    substanceReference: brief.substanceReference,
    slots,
    humanReviewRequired: true,
    generatesCopy: false,
    sideEffects: "none",
  };
}
