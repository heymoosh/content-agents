export type EvidencePool = "niche" | "broad" | "format";

export interface EvidenceMetric {
  name: string | null;
  numerator: number | null;
  denominator: number | null;
  window: string | null;
  scope: string | null;
}

export interface SourceEvidenceRow {
  sourceId: string | null;
  accountId: string | null;
  handle: string | null;
  creator: string | null;
  platform: string | null;
  url: string | null;
  observedAt: string | null;
  collectedAt: string | null;
  sourceRole: string | null;
  listing: string | null;
  window: string | null;
  rank: number | null;
  bodyComplete: boolean | null;
  evidenceLocation: string | null;
  metric: EvidenceMetric;
  pool: EvidencePool | null;
  membershipReason: string | null;
  selectionRule: string | null;
  caveats: string[];
  readiness: { status: "ready" | "blocked"; reason: string };
}

export interface SourceEvidenceInventory {
  rows: SourceEvidenceRow[];
  summary: { ready: number; blocked: number; pools: Record<EvidencePool, number> };
}

const POOLS = new Set<EvidencePool>(["niche", "broad", "format"]);
type Loose = Record<string, unknown>;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const record = (value: unknown): Loose => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Loose : {};
const numberOrNull = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const list = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.map(text).filter((v): v is string => v !== null))].sort() : [];

function memberships(analysis: Loose): Array<{ pool: EvidencePool; reason: string }> {
  const raw = analysis.pool_memberships ?? analysis.poolMemberships;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = record(item);
    const pool = text(row.pool)?.toLowerCase() as EvidencePool | null;
    const reason = text(row.reason);
    return pool && POOLS.has(pool) && reason ? [{ pool, reason }] : [];
  }).sort((a, b) => a.pool.localeCompare(b.pool));
}

function metric(analysis: Loose): EvidenceMetric {
  const raw = record(analysis.metric ?? analysis.metric_snapshot ?? analysis.metricSnapshot);
  return {
    name: text(raw.name ?? raw.metric),
    numerator: numberOrNull(raw.numerator),
    denominator: numberOrNull(raw.denominator),
    window: text(raw.window),
    scope: text(raw.scope),
  };
}

function baseRow(post: Loose, analysis: Loose, pool: EvidencePool | null, reason: string | null): SourceEvidenceRow {
  const sample = record(post.sample);
  const media = record(post.media);
  const sourceId = text(post.id ?? post.source_id);
  return {
    sourceId,
    accountId: text(analysis.account_id ?? analysis.accountId ?? post.account_id ?? post.accountId),
    handle: text(post.handle ?? analysis.handle),
    creator: text(post.creator ?? analysis.creator),
    platform: text(post.platform ?? analysis.platform),
    url: text(post.url ?? analysis.url),
    observedAt: text(post.posted_at ?? post.observed_at ?? analysis.observed_at),
    collectedAt: text(post.collected_at ?? analysis.collected_at),
    sourceRole: text(sample.role ?? post.sample_role),
    listing: text(sample.listing),
    window: text(sample.window),
    rank: numberOrNull(sample.rank),
    bodyComplete: typeof media.body_is_complete === "boolean" ? media.body_is_complete : typeof post.body_is_complete === "boolean" ? post.body_is_complete : null,
    evidenceLocation: text(analysis.evidence_location ?? analysis.evidenceLocation),
    metric: metric(analysis),
    pool,
    membershipReason: reason,
    selectionRule: text(analysis.selection_rule ?? analysis.selectionRule),
    caveats: list(analysis.caveats ?? post.caveats),
    readiness: { status: "blocked", reason: "Blocked: source evidence fields are incomplete." },
  };
}

function readiness(row: SourceEvidenceRow): SourceEvidenceRow["readiness"] {
  if (row.sourceId === null) return { status: "blocked", reason: "Blocked: missing source or post ID; evidence cannot be joined without a stable locator." };
  if (row.pool === null) return { status: "blocked", reason: "Blocked: no explicit supported pool membership; niche, broad, or format was not inferred." };
  if (row.accountId === null) return { status: "blocked", reason: "Blocked: missing account identity; attribution was not inferred from creator text." };
  if (row.url === null) return { status: "blocked", reason: "Blocked: missing source locator." };
  if (row.observedAt === null || row.collectedAt === null) return { status: "blocked", reason: "Blocked: missing observed or collected date." };
  if (row.evidenceLocation === null) return { status: "blocked", reason: "Blocked: missing explicit evidence location; no locator was inferred from the post body." };
  if (row.metric.scope === null) return { status: "blocked", reason: "Blocked: missing explicit metric scope; popularity scope was not inferred from listing or rank." };
  if (row.metric.name === null || row.metric.numerator === null || row.metric.denominator === null || row.metric.window === null) return { status: "blocked", reason: "Blocked: metric snapshot is incomplete; no denominator or observation window was inferred." };
  if (row.selectionRule === null) return { status: "blocked", reason: "Blocked: missing explicit selection rule; source selection was not inferred from rank." };
  if (row.bodyComplete === false) return { status: "blocked", reason: "Blocked: body is incomplete; the source substance cannot be treated as complete evidence." };
  if (row.bodyComplete === null) return { status: "blocked", reason: "Blocked: body completeness is unknown." };
  return { status: "ready", reason: "Explicit source evidence fields are present." };
}

function compare(a: SourceEvidenceRow, b: SourceEvidenceRow): number {
  return (a.sourceId ?? "").localeCompare(b.sourceId ?? "") || (a.pool ?? "").localeCompare(b.pool ?? "") || (a.url ?? "").localeCompare(b.url ?? "");
}

export function buildSourceEvidenceRows(corpus: unknown[], analyses: unknown[]): SourceEvidenceRow[] {
  const posts = corpus.map(record);
  const bySource = new Map<string, Loose>();
  for (const analysis of analyses.map(record)) {
    const id = text(analysis.source_id ?? analysis.sourceId ?? analysis.id);
    if (id) bySource.set(id, analysis);
  }
  const rows = posts.flatMap((post) => {
    const sourceId = text(post.id ?? post.source_id);
    const analysis = sourceId ? bySource.get(sourceId) ?? {} : {};
    const pools = memberships(analysis);
    const candidates = pools.length ? pools : [{ pool: null, reason: null }];
    return candidates.map((candidate) => {
      const row = baseRow(post, analysis, candidate.pool, candidate.reason);
      return { ...row, readiness: readiness(row) };
    });
  });
  return rows.sort(compare);
}

export function buildSourceEvidence(corpus: unknown[], analyses: unknown[]): SourceEvidenceInventory {
  const rows = buildSourceEvidenceRows(corpus, analyses);
  return {
    rows,
    summary: {
      ready: rows.filter((row) => row.readiness.status === "ready").length,
      blocked: rows.filter((row) => row.readiness.status === "blocked").length,
      pools: {
        niche: rows.filter((row) => row.pool === "niche").length,
        broad: rows.filter((row) => row.pool === "broad").length,
        format: rows.filter((row) => row.pool === "format").length,
      },
    },
  };
}
