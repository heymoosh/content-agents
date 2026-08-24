/**
 * A body-free, side-effect-free view of whether the current pattern inventory can be reused.
 *
 * The catalog is an account target inventory. Source evidence is the collected observation
 * inventory, and comparison readiness is the authority for reviewed evidence. Format targets are
 * not represented by the catalog today, so they stay explicitly unknown instead of being inferred
 * from observed formats.
 */

export const PLATFORM_READINESS_VERSION = "platform-readiness-v1" as const;

export type ReadinessText = string | "unknown" | null;
export type ReadinessStatus = "ready" | "blocked";

export interface PlatformReadinessCatalogRow {
  readonly accountId: string;
  readonly platform: ReadinessText;
  readonly configured: boolean;
  readonly collected: boolean;
  readonly formats: readonly ReadinessText[];
}

export interface PlatformReadinessCatalog {
  readonly rows: readonly PlatformReadinessCatalogRow[];
}

export interface PlatformReadinessEvidenceRow {
  readonly id: ReadinessText;
  readonly sourceId?: ReadinessText;
  readonly postId?: ReadinessText;
  readonly platform: ReadinessText;
  readonly format: ReadinessText;
  readonly baselineScope: ReadinessText;
  readonly baselineSource: ReadinessText;
}

export interface PlatformReadinessEvidenceInventory {
  readonly rows: readonly PlatformReadinessEvidenceRow[];
}

export interface PlatformReadinessComparisonRow {
  readonly id: string;
  readonly evidenceId: ReadinessText;
  readonly sourceId?: ReadinessText;
  readonly postId?: ReadinessText;
  readonly platform: ReadinessText;
  readonly format: ReadinessText;
  readonly readiness: {
    readonly status: ReadinessStatus;
    readonly blockers: readonly string[];
  };
}

export interface PlatformReadinessComparisonInventory {
  readonly rows: readonly PlatformReadinessComparisonRow[];
}

export interface PlatformReadinessOperatorView {
  readonly gaps: readonly string[];
}

export interface PlatformReadinessInput {
  readonly catalog: PlatformReadinessCatalog;
  readonly sourceEvidence: PlatformReadinessEvidenceInventory;
  readonly comparisonReadiness: PlatformReadinessComparisonInventory;
  readonly operatorReadiness?: PlatformReadinessOperatorView;
}

export interface BaselineCounts {
  readonly present: number;
  readonly unknown: number;
  readonly missing: number;
}

export interface PlatformReadinessRow {
  readonly kind: "platform_format_readiness_row";
  readonly version: typeof PLATFORM_READINESS_VERSION;
  readonly key: string;
  readonly platform: ReadinessText;
  readonly format: ReadinessText;
  /** Count of configured account targets on the platform. It is not a format target count. */
  readonly configuredTargets: number;
  /** The catalog has no explicit format-target field, so this remains unknown. */
  readonly formatTargets: number | "unknown";
  readonly collectedEvidence: number;
  readonly reviewedEvidence: number;
  readonly baselines: BaselineCounts;
  readonly reusable: {
    readonly status: ReadinessStatus;
    readonly reason: string;
  };
  readonly blockers: string[];
  readonly bodyIncluded: false;
}

export interface PlatformReadinessSummary {
  readonly rows: number;
  readonly configuredTargets: number;
  readonly configuredPlatforms: number;
  readonly configuredAndCollectedPlatforms: number;
  readonly configuredButUncollectedPlatforms: number;
  readonly collectedEvidence: number;
  readonly reviewedEvidence: number;
  readonly baselines: BaselineCounts;
  readonly reusableRows: number;
  readonly blockedRows: number;
  readonly blockers: string[];
}

export interface PlatformReadinessInventory {
  readonly kind: "pattern_platform_readiness";
  readonly version: typeof PLATFORM_READINESS_VERSION;
  readonly rows: PlatformReadinessRow[];
  readonly summary: PlatformReadinessSummary;
  readonly sideEffects: "none";
}

interface Axis {
  readonly platform: ReadinessText;
  readonly format: ReadinessText;
}

interface MutableRow {
  readonly axis: Axis;
  configuredTargets: number;
  collectedEvidence: number;
  reviewedEvidence: number;
  baselines: BaselineCounts;
  blockers: Set<string>;
}

function text(value: unknown): ReadinessText {
  if (value === "unknown") return "unknown";
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function dimension(value: unknown): ReadinessText {
  return text(value);
}

function compareValue(left: ReadinessText, right: ReadinessText): number {
  return (left ?? "").localeCompare(right ?? "");
}

function axisKey(axis: Axis): string {
  return `${JSON.stringify(axis.platform)}|${JSON.stringify(axis.format)}`;
}

function compareAxes(left: Axis, right: Axis): number {
  return compareValue(left.platform, right.platform) || compareValue(left.format, right.format);
}

function addAxis(axes: Map<string, MutableRow>, platform: unknown, format: unknown): MutableRow {
  const axis = { platform: dimension(platform), format: dimension(format) };
  const key = axisKey(axis);
  const current = axes.get(key);
  if (current) return current;
  const created: MutableRow = {
    axis,
    configuredTargets: 0,
    collectedEvidence: 0,
    reviewedEvidence: 0,
    baselines: { present: 0, unknown: 0, missing: 0 },
    blockers: new Set<string>(),
  };
  axes.set(key, created);
  return created;
}

function inventoryRows<T>(inventory: { readonly rows: readonly T[] }): readonly T[] {
  return inventory.rows;
}

function identifiers(value: {
  readonly id?: ReadinessText;
  readonly evidenceId?: ReadinessText;
  readonly sourceId?: ReadinessText;
  readonly postId?: ReadinessText;
}): string[] {
  return [value.id, value.evidenceId, value.sourceId, value.postId]
    .filter((item): item is string => typeof item === "string" && item.trim() !== "" && item !== "unknown");
}

function sourceLookup(rows: readonly PlatformReadinessEvidenceRow[]): Map<string, PlatformReadinessEvidenceRow> {
  const lookup = new Map<string, PlatformReadinessEvidenceRow>();
  const ordered = [...rows].sort((left, right) => {
    return sourceSortKey(left).localeCompare(sourceSortKey(right));
  });
  for (const row of ordered) {
    for (const id of identifiers(row)) if (!lookup.has(id)) lookup.set(id, row);
  }
  return lookup;
}

function sourceSortKey(row: PlatformReadinessEvidenceRow): string {
  return JSON.stringify([
    [...identifiers(row)].sort(),
    dimension(row.platform),
    dimension(row.format),
    text(row.baselineScope),
    text(row.baselineSource),
  ]);
}

function baselineState(row: PlatformReadinessEvidenceRow): keyof BaselineCounts {
  const scope = text(row.baselineScope);
  const source = text(row.baselineSource);
  if (scope === "unknown" || source === "unknown") return "unknown";
  if (scope !== null && source !== null) return "present";
  return "missing";
}

function incrementBaseline(row: MutableRow, state: keyof BaselineCounts): void {
  row.baselines = { ...row.baselines, [state]: row.baselines[state] + 1 };
}

function comparisonSource(
  row: PlatformReadinessComparisonRow,
  sourceById: Map<string, PlatformReadinessEvidenceRow>,
): PlatformReadinessEvidenceRow | null {
  for (const id of identifiers(row)) {
    const source = sourceById.get(id);
    if (source) return source;
  }
  return null;
}

function addComparisonBlockers(row: MutableRow, comparison: PlatformReadinessComparisonRow): void {
  if (comparison.readiness.status === "ready") return;
  const blockers = comparison.readiness.blockers.length > 0
    ? comparison.readiness.blockers
    : ["comparison readiness is blocked"];
  for (const blocker of blockers) {
    const normalized = text(blocker);
    if (normalized !== null) row.blockers.add(normalized);
  }
}

function missingDimensionBlockers(row: MutableRow): void {
  if (row.axis.platform === null) row.blockers.add("platform is missing");
  else if (row.axis.platform === "unknown") row.blockers.add("platform is unknown");
  if (row.axis.format === null) row.blockers.add("format is missing");
  else if (row.axis.format === "unknown") row.blockers.add("format is unknown");
}

function readinessBlockers(row: MutableRow): string[] {
  missingDimensionBlockers(row);
  if (row.configuredTargets === 0) row.blockers.add("platform is not a configured target");
  if (row.collectedEvidence === 0) row.blockers.add("no collected evidence");
  if (row.reviewedEvidence === 0) row.blockers.add("reviewed evidence is missing");
  if (row.baselines.present === 0) {
    if (row.baselines.unknown > 0) row.blockers.add("baseline is unknown");
    else if (row.baselines.missing > 0) row.blockers.add("baseline is missing");
    else row.blockers.add("no baseline evidence");
  }
  return [...row.blockers].sort((left, right) => left.localeCompare(right));
}

function reusableReason(blockers: readonly string[]): string {
  return blockers.length === 0
    ? "Reviewed evidence and a known baseline are available for this configured platform and format."
    : `Blocked: ${blockers.join(", ")}.`;
}

function platformTargetCounts(rows: readonly PlatformReadinessCatalogRow[]): {
  configuredTargets: Map<string, number>;
  configuredPlatforms: Set<string>;
  configuredAndCollectedPlatforms: Set<string>;
} {
  const configuredTargets = new Map<string, number>();
  const configuredPlatforms = new Set<string>();
  const configuredAndCollectedPlatforms = new Set<string>();
  for (const row of rows) {
    const platform = dimension(row.platform);
    const key = JSON.stringify(platform);
    if (row.configured) {
      configuredTargets.set(key, (configuredTargets.get(key) ?? 0) + 1);
      configuredPlatforms.add(key);
      if (row.collected) configuredAndCollectedPlatforms.add(key);
    }
  }
  return { configuredTargets, configuredPlatforms, configuredAndCollectedPlatforms };
}

function addCatalogAxes(axes: Map<string, MutableRow>, rows: readonly PlatformReadinessCatalogRow[]): void {
  for (const row of rows) {
    const formats = row.formats.map(dimension).filter((format): format is ReadinessText => format !== null);
    if (formats.length === 0) addAxis(axes, row.platform, null);
    else for (const format of formats) addAxis(axes, row.platform, format);
  }
}

function addEvidenceAxes(axes: Map<string, MutableRow>, rows: readonly PlatformReadinessEvidenceRow[]): void {
  for (const row of rows) addAxis(axes, row.platform, row.format);
}

function addComparisonAxes(axes: Map<string, MutableRow>, rows: readonly PlatformReadinessComparisonRow[], sourceById: Map<string, PlatformReadinessEvidenceRow>): void {
  for (const row of rows) {
    const source = comparisonSource(row, sourceById);
    addAxis(axes, source?.platform ?? row.platform, source?.format ?? row.format);
  }
}

function rowKey(axis: Axis): string {
  return `platform=${JSON.stringify(axis.platform)}|format=${JSON.stringify(axis.format)}`;
}

function buildRows(
  axes: Map<string, MutableRow>,
  evidenceRows: readonly PlatformReadinessEvidenceRow[],
  comparisonRows: readonly PlatformReadinessComparisonRow[],
  sourceById: Map<string, PlatformReadinessEvidenceRow>,
  configuredTargets: Map<string, number>,
): PlatformReadinessRow[] {
  for (const row of evidenceRows) {
    const target = addAxis(axes, row.platform, row.format);
    target.collectedEvidence += 1;
    incrementBaseline(target, baselineState(row));
  }

  for (const row of comparisonRows) {
    const source = comparisonSource(row, sourceById);
    const target = addAxis(axes, source?.platform ?? row.platform, source?.format ?? row.format);
    if (row.readiness.status === "ready") target.reviewedEvidence += 1;
    addComparisonBlockers(target, row);
  }

  for (const row of axes.values()) {
    row.configuredTargets = configuredTargets.get(JSON.stringify(row.axis.platform)) ?? 0;
  }

  return [...axes.values()]
    .sort((left, right) => compareAxes(left.axis, right.axis))
    .map((row): PlatformReadinessRow => {
      const blockers = readinessBlockers(row);
      const reusable = blockers.length === 0;
      return {
        kind: "platform_format_readiness_row",
        version: PLATFORM_READINESS_VERSION,
        key: rowKey(row.axis),
        platform: row.axis.platform,
        format: row.axis.format,
        configuredTargets: row.configuredTargets,
        formatTargets: "unknown",
        collectedEvidence: row.collectedEvidence,
        reviewedEvidence: row.reviewedEvidence,
        baselines: { ...row.baselines },
        reusable: {
          status: reusable ? "ready" : "blocked",
          reason: reusableReason(blockers),
        },
        blockers,
        bodyIncluded: false,
      };
    });
}

function configuredPlatformCount(value: Set<string>): number {
  return value.size;
}

export function buildPlatformReadiness(input: PlatformReadinessInput): PlatformReadinessInventory {
  const catalogRows = [...input.catalog.rows];
  const evidenceRows = [...inventoryRows(input.sourceEvidence)];
  const comparisonRows = [...inventoryRows(input.comparisonReadiness)];
  const sourceById = sourceLookup(evidenceRows);
  const targetCounts = platformTargetCounts(catalogRows);
  const axes = new Map<string, MutableRow>();

  addCatalogAxes(axes, catalogRows);
  addEvidenceAxes(axes, evidenceRows);
  addComparisonAxes(axes, comparisonRows, sourceById);

  const rows = buildRows(axes, evidenceRows, comparisonRows, sourceById, targetCounts.configuredTargets);
  const blockers = new Set<string>(input.operatorReadiness?.gaps ?? []);
  for (const row of rows) for (const blocker of row.blockers) blockers.add(blocker);
  const baselines = rows.reduce<BaselineCounts>((total, row) => ({
    present: total.present + row.baselines.present,
    unknown: total.unknown + row.baselines.unknown,
    missing: total.missing + row.baselines.missing,
  }), { present: 0, unknown: 0, missing: 0 });
  const configuredTargets = catalogRows.filter((row) => row.configured).length;
  const collectedEvidence = rows.reduce((total, row) => total + row.collectedEvidence, 0);
  const reviewedEvidence = rows.reduce((total, row) => total + row.reviewedEvidence, 0);
  const reusableRows = rows.filter((row) => row.reusable.status === "ready").length;

  return {
    kind: "pattern_platform_readiness",
    version: PLATFORM_READINESS_VERSION,
    rows,
    summary: {
      rows: rows.length,
      configuredTargets,
      configuredPlatforms: configuredPlatformCount(targetCounts.configuredPlatforms),
      configuredAndCollectedPlatforms: configuredPlatformCount(targetCounts.configuredAndCollectedPlatforms),
      configuredButUncollectedPlatforms: targetCounts.configuredPlatforms.size - targetCounts.configuredAndCollectedPlatforms.size,
      collectedEvidence,
      reviewedEvidence,
      baselines,
      reusableRows,
      blockedRows: rows.length - reusableRows,
      blockers: [...blockers].filter((blocker) => blocker.trim() !== "").sort((left, right) => left.localeCompare(right)),
    },
    sideEffects: "none",
  };
}

export const createPlatformReadiness = buildPlatformReadiness;
