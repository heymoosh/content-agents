import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { normalizeHandle } from "./corpus.js";
import type { AccountSeed, CorpusEntry, PatternMiningConfig } from "./types.js";

const CONFIG_PATH = join(repoRoot, "config", "pattern-mining.yaml");
const CORPUS_PATH = join(repoRoot, "data", "patterns", "corpus.jsonl");
const ANALYSES_PATH = join(repoRoot, "data", "patterns", "analyses.jsonl");

type LooseRecord = Record<string, unknown>;
const FORMAT_ENUMS = new Set([
  "audio", "carousel", "image", "link-preview", "mixed", "text", "text-only", "video",
]);

export interface CatalogAudience {
  size: number | null;
  countType: string | null;
  provenance: string | null;
  asOf: string | null;
}

export interface CatalogRow {
  key: string;
  platform: string;
  handle: string | null;
  creator: string | null;
  sourceKind: "handle" | "source";
  configured: boolean;
  collected: boolean;
  audience: CatalogAudience;
  topics: string[];
  formats: string[];
  mediaForms: string[];
  popularityScopes: string[];
  evidenceCount: number;
  admissibleCount: number;
  bodyCompleteCount: number;
  bodyIncompleteCount: number;
  lastCollectedAt: string | null;
  lastAnalyzedAt: string | null;
  caveats: string[];
}

export interface PatternCatalog {
  rows: CatalogRow[];
  summary: {
    configuredTargets: number;
    collectedSources: number;
    configuredAndCollected: number;
    configuredButUncollected: number;
    evidenceCount: number;
    admissibleCount: number;
    bodyCompleteCount: number;
    bodyIncompleteCount: number;
  };
}

function record(value: unknown): LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as LooseRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonEmptyStrings(values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map(text).filter((v): v is string => v !== null))].sort();
}

function normalizedFormat(value: unknown): string | null {
  const normalized = text(value)?.toLowerCase().replace(/[_\s]+/g, "-") ?? null;
  return normalized && FORMAT_ENUMS.has(normalized) ? normalized : null;
}

function maxDate(values: unknown[]): string | null {
  const dates = values.map(text).filter((v): v is string => v !== null).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function popularityScopes(posts: LooseRecord[], analyses: LooseRecord[]): string[] {
  const explicit = [
    ...posts.flatMap((row) => [row.popularity_scope, row.sample_scope]),
    ...analyses.flatMap((row) => [row.popularity_scope, row.sample_scope, row.baseline_source]),
  ];
  const textScopes = [...posts, ...analyses]
    .flatMap((row) => [row.notes, row.provenance, row.provenance_flag])
    .map(text)
    .filter((value): value is string => value !== null)
    .flatMap((value) => /search[- ]biased sample/i.test(value) ? ["search-biased"] : []);
  return nonEmptyStrings([...explicit, ...textScopes]);
}

function keyFor(platform: unknown, handle: unknown, creator: unknown): string {
  const normalized = text(handle);
  return `${text(platform) ?? "unknown"}|${normalized ? normalizeHandle(normalized) : `source:${text(creator) ?? "unknown"}`}`;
}

function audienceFrom(seed: AccountSeed | undefined, posts: LooseRecord[]): CatalogAudience {
  const metrics = posts.map((post) => record(post.metrics));
  const observed = metrics.map((metric) => metric.followers).find((v) => typeof v === "number" && Number.isFinite(v));
  const size = typeof observed === "number" ? observed : seed?.followers ?? null;
  const platform = text(seed?.platform) ?? text(posts[0]?.platform);
  const countType = size === null ? null : platform === "substack" ? "subscribers" : "followers";
  const notes = posts.map((post) => text(post.notes)).filter((v): v is string => v !== null);
  const provenance = notes.find((note) => /followers|subscriber/i.test(note)) ?? null;
  const asOf = maxDate(notes.flatMap((note) => note.match(/\b20\d{2}-\d{2}-\d{2}\b/g) ?? []));
  return { size, countType, provenance, asOf };
}

function readJsonl(path: string): LooseRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => record(JSON.parse(line)));
}

export function loadCatalogInputs(paths: { config?: string; corpus?: string; analyses?: string } = {}): {
  config: PatternMiningConfig;
  corpus: LooseRecord[];
  analyses: LooseRecord[];
} {
  return {
    config: parse(readFileSync(paths.config ?? CONFIG_PATH, "utf8")) as PatternMiningConfig,
    corpus: readJsonl(paths.corpus ?? CORPUS_PATH),
    analyses: readJsonl(paths.analyses ?? ANALYSES_PATH),
  };
}

export function buildCatalog(config: PatternMiningConfig, corpus: unknown[] = [], analyses: unknown[] = []): PatternCatalog {
  const posts = corpus.map(record);
  const analysisRows = analyses.map(record);
  const rows = new Map<string, { seed?: AccountSeed; posts: LooseRecord[]; analyses: LooseRecord[] }>();
  const ensure = (key: string) => rows.get(key) ?? (rows.set(key, { posts: [], analyses: [] }), rows.get(key)!);

  for (const seed of config.accounts ?? []) {
    const state = ensure(keyFor(seed.platform, seed.handle, seed.creator));
    state.seed = seed;
  }
  for (const post of posts) ensure(keyFor(post.platform, post.handle, post.creator)).posts.push(post);
  for (const analysis of analysisRows) ensure(keyFor(analysis.platform, analysis.handle, analysis.creator)).analyses.push(analysis);

  const result = [...rows.entries()].map(([key, state]): CatalogRow => {
    const seed = state.seed;
    const post = state.posts[0];
    const analysis = state.analyses;
    const platform = text(seed?.platform) ?? text(post?.platform) ?? text(analysis[0]?.platform) ?? "unknown";
    const handle = text(seed?.handle) ?? text(post?.handle) ?? text(analysis[0]?.handle);
    const caveats = nonEmptyStrings([
      ...state.posts.map((row) => row.notes),
      ...state.posts.map((row) => record(row.media).description),
      ...analysis.map((row) => row.provenance),
      ...analysis.map((row) => row.provenance_flag),
      ...analysis.map((row) => row.correction),
    ]);
    const bodyComplete = analysis.filter((row) => row.body_complete === true).length;
    const bodyIncomplete = analysis.filter((row) => row.body_complete === false).length;
    return {
      key,
      platform,
      handle,
      creator: seed?.creator ?? text(post?.creator) ?? text(analysis[0]?.creator),
      sourceKind: handle ? "handle" : "source",
      configured: seed !== undefined,
      collected: state.posts.length > 0,
      audience: audienceFrom(seed, state.posts),
      topics: nonEmptyStrings([seed?.niche, ...state.posts.map((row) => row.niche), ...analysis.map((row) => row.niche)]),
      formats: nonEmptyStrings([
        ...state.posts.map((row) => normalizedFormat(row.kind)),
        ...state.posts.map((row) => normalizedFormat(record(row.media).form)),
        ...analysis.map((row) => normalizedFormat(row.format)),
      ]),
      mediaForms: nonEmptyStrings(state.posts.map((row) => normalizedFormat(record(row.media).form))),
      popularityScopes: popularityScopes(state.posts, analysis),
      evidenceCount: state.posts.length,
      admissibleCount: analysis.filter((row) => row.admissible === true).length,
      bodyCompleteCount: bodyComplete,
      bodyIncompleteCount: bodyIncomplete,
      lastCollectedAt: maxDate(state.posts.map((row) => row.collected_at)),
      lastAnalyzedAt: maxDate(analysis.map((row) => row.analyzed_at)),
      caveats,
    };
  }).sort((a, b) => a.key.localeCompare(b.key));

  return {
    rows: result,
    summary: {
      configuredTargets: result.filter((row) => row.configured).length,
      collectedSources: result.filter((row) => row.collected).length,
      configuredAndCollected: result.filter((row) => row.configured && row.collected).length,
      configuredButUncollected: result.filter((row) => row.configured && !row.collected).length,
      evidenceCount: result.reduce((sum, row) => sum + row.evidenceCount, 0),
      admissibleCount: result.reduce((sum, row) => sum + row.admissibleCount, 0),
      bodyCompleteCount: result.reduce((sum, row) => sum + row.bodyCompleteCount, 0),
      bodyIncompleteCount: result.reduce((sum, row) => sum + row.bodyIncompleteCount, 0),
    },
  };
}

export function renderCatalogJson(config: PatternMiningConfig, corpus: unknown[], analyses: unknown[]): string {
  return `${JSON.stringify(buildCatalog(config, corpus, analyses), null, 2)}\n`;
}

export function renderCatalogMarkdown(catalog: PatternCatalog): string {
  const cell = (value: string): string => value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const list = (values: string[]): string => values.length ? values.join(", ") : "unknown";
  const audience = (row: CatalogRow): string => {
    if (row.audience.size === null) return "unknown";
    const size = row.audience.size.toLocaleString("en-US");
    const type = row.audience.countType ?? "unknown type";
    return `${size} ${type}${row.audience.asOf ? ` (${row.audience.asOf})` : ""}`;
  };
  const lines = [
    "# Pattern source catalog", "", `Configured targets: ${catalog.summary.configuredTargets} | Collected sources: ${catalog.summary.collectedSources}`,
    "", "| Source | Platform | Status | Audience (size/type/as-of) | Popularity scope(s) | Topics | Formats | Media | Evidence/admissible/complete/incomplete | Last collected | Last analyzed | Caveats |", "|---|---|---|---|---|---|---|---|---:|---|---|---|",
  ];
  for (const row of catalog.rows) {
    const status = row.configured ? (row.collected ? "configured + collected" : "configured, uncollected") : "collected only";
    const completeness = `${row.evidenceCount} / ${row.admissibleCount} / ${row.bodyCompleteCount} / ${row.bodyIncompleteCount}`;
    lines.push(`| ${cell(row.handle ?? row.creator ?? row.key)} | ${cell(row.platform)} | ${status} | ${cell(audience(row))} | ${cell(list(row.popularityScopes))} | ${cell(list(row.topics))} | ${cell(list(row.formats))} | ${cell(list(row.mediaForms))} | ${completeness} | ${row.lastCollectedAt ?? "unknown"} | ${row.lastAnalyzedAt ?? "unknown"} | ${cell(list(row.caveats))} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const paths: { config?: string; corpus?: string; analyses?: string } = {};
  let format = "json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--format" && argv[i + 1]) format = argv[++i];
    else if (argv[i] === "--config" && argv[i + 1]) paths.config = argv[++i];
    else if (argv[i] === "--corpus" && argv[i + 1]) paths.corpus = argv[++i];
    else if (argv[i] === "--analyses" && argv[i + 1]) paths.analyses = argv[++i];
  }
  const inputs = loadCatalogInputs(paths);
  const catalog = buildCatalog(inputs.config, inputs.corpus, inputs.analyses);
  process.stdout.write(format === "markdown" ? renderCatalogMarkdown(catalog) : `${JSON.stringify(catalog, null, 2)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();
