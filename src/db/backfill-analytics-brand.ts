import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FROZEN_MANIFEST_SHA256 = "7c44574002b3d7e53f002c75ead63a5503678766eda5bb80d81a86ef4e0d5206";
const MANIFEST_VERSION = "slice-5x-substack-backfill-v1";

export interface BackfillTarget {
  name: string;
  platform: "substack" | "substack-note";
  brand_id: "human-inference";
  provider_account_id: "human-inference/browser-analytics" | "human-inference/substack";
  expected_posts: number;
  expected_metrics: number;
  evidence: string;
}

export interface BackfillManifest {
  version: string;
  source_db_sha256: string;
  evidence: {
    provenance_account_audit_sha256: string;
    source_reference_attestation_sha256: string;
    substack_verified_source_count: number;
    substack_verified_source_checksum_set_sha256: string;
    owner_attestation: string;
  };
  preconditions: {
    all_target_identity_fields_are_both_null: boolean;
    partial_identity_rows: { posts: number; metrics: number };
    excluded_legacy_experiment_pairs: {
      x: { posts: number; metrics: number };
      linkedin: { posts: number; metrics: number };
    };
  };
  targets: BackfillTarget[];
  expected_change_totals: { posts: number; metrics: number };
  excluded_scope: { audience_rows: number; import_rows: number; reason: string };
}

export interface BackfillReport {
  mode: "dry-run" | "apply";
  state: "candidate" | "replay" | "applied";
  manifest_sha256: string;
  source_db_sha256: string;
  proposed: { posts: number; metrics: number };
  changed: { posts: number; metrics: number };
  after: { posts: number; metrics: number };
  unresolved: { posts: number; metrics: number };
  visibility: VisibilityReport;
  backup: null | {
    path: string;
    sha256: string;
    pre_apply_logical_sha256: string;
    restore_logical_sha256: string;
  };
}

export interface VisibilityReport {
  human_inference: { posts: number; metrics: number };
  browser_analytics: { posts: number; metrics: number };
  substack_notes: { posts: number; metrics: number };
  other_brand_target_pairs: { posts: number; metrics: number };
  retained_experimental_unassigned: { posts: number; metrics: number };
  target_partial_or_conflicting: { posts: number; metrics: number };
  route_cell_eligible: { posts: number; metrics: number };
  pillarless: { posts: number; metrics: number };
}

export interface ExecuteBackfillOptions {
  dbPath: string;
  manifest: BackfillManifest;
  manifestSha256: string;
  apply?: boolean;
  backupPath?: string;
}

type TargetInventory = {
  target: BackfillTarget;
  posts: { total: number; unbound: number; exact: number; unsafe: number };
  metrics: { total: number; unbound: number; exact: number; unsafe: number };
};

type DatabaseState = {
  kind: "candidate" | "replay";
  targets: TargetInventory[];
};

const EXPECTED_TARGETS: ReadonlyArray<Pick<BackfillTarget, "name" | "platform" | "brand_id" | "provider_account_id" | "expected_posts" | "expected_metrics">> = [
  {
    name: "checksum-joined-substack-articles",
    platform: "substack",
    brand_id: "human-inference",
    provider_account_id: "human-inference/browser-analytics",
    expected_posts: 13,
    expected_metrics: 86,
  },
  {
    name: "legacy-substack-notes",
    platform: "substack-note",
    brand_id: "human-inference",
    provider_account_id: "human-inference/substack",
    expected_posts: 32,
    expected_metrics: 120,
  },
];

function fail(message: string): never {
  throw new Error(message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, field: string, label: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value) fail(`${label}.${field} must be a non-empty string`);
  return value;
}

function numberField(record: Record<string, unknown>, field: string, label: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) fail(`${label} must be a lowercase SHA-256`);
}

function assertExactKeys(record: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} has unexpected or missing fields`);
  }
}

/**
 * The engine accepts only the fixed 5X mapping. The manifest checksum is enforced by
 * readFrozenManifest() for CLI callers; this structural check makes direct imports testable
 * without weakening the command-line contract.
 */
export function assertBackfillManifest(value: unknown): asserts value is BackfillManifest {
  const manifest = asRecord(value, "manifest");
  assertExactKeys(manifest, ["version", "source_db_sha256", "evidence", "preconditions", "targets", "expected_change_totals", "excluded_scope"], "manifest");
  if (stringField(manifest, "version", "manifest") !== MANIFEST_VERSION) fail("unsupported manifest version");
  assertSha256(stringField(manifest, "source_db_sha256", "manifest"), "manifest.source_db_sha256");

  const evidence = asRecord(manifest.evidence, "manifest.evidence");
  assertExactKeys(evidence, ["provenance_account_audit_sha256", "source_reference_attestation_sha256", "substack_verified_source_count", "substack_verified_source_checksum_set_sha256", "owner_attestation"], "manifest.evidence");
  assertSha256(stringField(evidence, "provenance_account_audit_sha256", "manifest.evidence"), "manifest.evidence.provenance_account_audit_sha256");
  assertSha256(stringField(evidence, "source_reference_attestation_sha256", "manifest.evidence"), "manifest.evidence.source_reference_attestation_sha256");
  assertSha256(stringField(evidence, "substack_verified_source_checksum_set_sha256", "manifest.evidence"), "manifest.evidence.substack_verified_source_checksum_set_sha256");
  if (numberField(evidence, "substack_verified_source_count", "manifest.evidence") !== 22) fail("manifest must retain 22 verified Substack sources");
  stringField(evidence, "owner_attestation", "manifest.evidence");

  const preconditions = asRecord(manifest.preconditions, "manifest.preconditions");
  assertExactKeys(preconditions, ["all_target_identity_fields_are_both_null", "partial_identity_rows", "excluded_legacy_experiment_pairs"], "manifest.preconditions");
  if (preconditions.all_target_identity_fields_are_both_null !== true) fail("manifest requires both target identity fields to be NULL before apply");
  const partial = asRecord(preconditions.partial_identity_rows, "manifest.preconditions.partial_identity_rows");
  assertExactKeys(partial, ["posts", "metrics"], "manifest.preconditions.partial_identity_rows");
  if (numberField(partial, "posts", "manifest.preconditions.partial_identity_rows") !== 0 || numberField(partial, "metrics", "manifest.preconditions.partial_identity_rows") !== 0) {
    fail("manifest cannot authorize partial target identities");
  }
  const experimental = asRecord(preconditions.excluded_legacy_experiment_pairs, "manifest.preconditions.excluded_legacy_experiment_pairs");
  assertExactKeys(experimental, ["x", "linkedin"], "manifest.preconditions.excluded_legacy_experiment_pairs");
  for (const [platform, expectedPosts, expectedMetrics] of [["x", 264, 2345], ["linkedin", 100, 430]] as const) {
    const row = asRecord(experimental[platform], `manifest.preconditions.excluded_legacy_experiment_pairs.${platform}`);
    assertExactKeys(row, ["posts", "metrics"], `manifest.preconditions.excluded_legacy_experiment_pairs.${platform}`);
    if (numberField(row, "posts", `manifest.preconditions.excluded_legacy_experiment_pairs.${platform}`) !== expectedPosts || numberField(row, "metrics", `manifest.preconditions.excluded_legacy_experiment_pairs.${platform}`) !== expectedMetrics) {
      fail(`manifest must retain the fixed ${platform} exclusion inventory`);
    }
  }

  if (!Array.isArray(manifest.targets) || manifest.targets.length !== EXPECTED_TARGETS.length) fail("manifest must contain exactly the two approved targets");
  for (const [index, expected] of EXPECTED_TARGETS.entries()) {
    const target = asRecord(manifest.targets[index], `manifest.targets[${index}]`);
    assertExactKeys(target, ["name", "platform", "brand_id", "provider_account_id", "expected_posts", "expected_metrics", "evidence"], `manifest.targets[${index}]`);
    for (const field of ["name", "platform", "brand_id", "provider_account_id"] as const) {
      if (stringField(target, field, `manifest.targets[${index}]`) !== expected[field]) fail(`manifest target ${index} does not match the approved mapping`);
    }
    if (numberField(target, "expected_posts", `manifest.targets[${index}]`) !== expected.expected_posts || numberField(target, "expected_metrics", `manifest.targets[${index}]`) !== expected.expected_metrics) {
      fail(`manifest target ${index} does not match the approved counts`);
    }
    stringField(target, "evidence", `manifest.targets[${index}]`);
  }

  const totals = asRecord(manifest.expected_change_totals, "manifest.expected_change_totals");
  assertExactKeys(totals, ["posts", "metrics"], "manifest.expected_change_totals");
  if (numberField(totals, "posts", "manifest.expected_change_totals") !== 45 || numberField(totals, "metrics", "manifest.expected_change_totals") !== 206) fail("manifest must retain the approved 45/206 total");

  const excludedScope = asRecord(manifest.excluded_scope, "manifest.excluded_scope");
  assertExactKeys(excludedScope, ["audience_rows", "import_rows", "reason"], "manifest.excluded_scope");
  if (numberField(excludedScope, "audience_rows", "manifest.excluded_scope") !== 25 || numberField(excludedScope, "import_rows", "manifest.excluded_scope") !== 22) fail("manifest must retain the approved excluded scope");
  stringField(excludedScope, "reason", "manifest.excluded_scope");
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function lstatIfPresent(path: string, label: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (isMissingPathError(error)) return undefined;
    fail(`${label} cannot be safely inspected`);
  }
}

function resolveExistingRegularFile(path: string, label: string): string {
  const absolute = resolve(path);
  const entry = lstatIfPresent(absolute, label);
  if (!entry) fail(`${label} does not exist`);
  if (entry.isSymbolicLink() || !entry.isFile()) fail(`${label} must be a regular file`);
  return realpathSync(absolute);
}

function resolveNewBackupPath(path: string, sourceDbPath: string): string {
  if (!isAbsolute(path)) fail("backup path must be absolute");
  const absolute = resolve(path);
  if (lstatIfPresent(absolute, "backup path")) fail("backup path must be new and must not clobber an existing file or symlink");
  const parent = dirname(absolute);
  const parentEntry = lstatIfPresent(parent, "backup parent directory");
  if (!parentEntry || parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) fail("backup parent directory must exist and must not be a symbolic link");
  const canonical = join(realpathSync(parent), basename(absolute));
  if (canonical === sourceDbPath) fail("backup path cannot alias the source database");
  return canonical;
}

/**
 * A raw main-file SHA-256 cannot represent uncheckpointed WAL or rollback-journal
 * contents. This command never checkpoints or alters those sidecars, so it accepts
 * only absent or inert zero-byte files and refuses every unsupported active state.
 */
function assertNoActiveSnapshotSidecars(sourceDbPath: string): void {
  for (const [suffix, kind] of [["-wal", "WAL"], ["-journal", "rollback journal"]] as const) {
    const path = `${sourceDbPath}${suffix}`;
    const entry = lstatIfPresent(path, `SQLite ${kind} sidecar`);
    if (!entry) continue;
    if (entry.isSymbolicLink() || !entry.isFile()) fail(`database has an unsupported SQLite ${kind} sidecar`);
    if (entry.size > 0) fail(`database has a nonempty SQLite ${kind} sidecar`);
  }
}

function openReadonly(dbPath: string, queryOnly = true): Database.Database {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  if (queryOnly) db.pragma("query_only = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

function numeric(row: unknown, key: string): number {
  const value = (row as Record<string, unknown> | undefined)?.[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) fail(`database returned an invalid aggregate for ${key}`);
  return value;
}

function targetInventory(db: Database.Database, target: BackfillTarget): TargetInventory {
  const postRow = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN brand_id IS NULL AND provider_account_id IS NULL THEN 1 ELSE 0 END) AS unbound,
      SUM(CASE WHEN brand_id = ? AND provider_account_id = ? THEN 1 ELSE 0 END) AS exact,
      SUM(CASE WHEN NOT ((brand_id IS NULL AND provider_account_id IS NULL) OR (brand_id = ? AND provider_account_id = ?)) THEN 1 ELSE 0 END) AS unsafe
    FROM posts
    WHERE platform = ?
  `).get(target.brand_id, target.provider_account_id, target.brand_id, target.provider_account_id, target.platform);
  const metricRow = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN m.brand_id IS NULL AND m.provider_account_id IS NULL THEN 1 ELSE 0 END) AS unbound,
      SUM(CASE WHEN m.brand_id = ? AND m.provider_account_id = ? THEN 1 ELSE 0 END) AS exact,
      SUM(CASE WHEN NOT ((m.brand_id IS NULL AND m.provider_account_id IS NULL) OR (m.brand_id = ? AND m.provider_account_id = ?)) THEN 1 ELSE 0 END) AS unsafe
    FROM metrics m
    JOIN posts p ON p.id = m.post_id
    WHERE p.platform = ?
  `).get(target.brand_id, target.provider_account_id, target.brand_id, target.provider_account_id, target.platform);

  return {
    target,
    posts: { total: numeric(postRow, "total"), unbound: numeric(postRow, "unbound"), exact: numeric(postRow, "exact"), unsafe: numeric(postRow, "unsafe") },
    metrics: { total: numeric(metricRow, "total"), unbound: numeric(metricRow, "unbound"), exact: numeric(metricRow, "exact"), unsafe: numeric(metricRow, "unsafe") },
  };
}

function inspectState(db: Database.Database, manifest: BackfillManifest): DatabaseState {
  const targets = manifest.targets.map((target) => targetInventory(db, target));
  const candidate = targets.every(({ target, posts, metrics }) =>
    posts.total === target.expected_posts && posts.unbound === target.expected_posts && posts.exact === 0 && posts.unsafe === 0 &&
    metrics.total === target.expected_metrics && metrics.unbound === target.expected_metrics && metrics.exact === 0 && metrics.unsafe === 0
  );
  if (candidate) return { kind: "candidate", targets };

  const replay = targets.every(({ target, posts, metrics }) =>
    posts.total === target.expected_posts && posts.exact === target.expected_posts && posts.unbound === 0 && posts.unsafe === 0 &&
    metrics.total === target.expected_metrics && metrics.exact === target.expected_metrics && metrics.unbound === 0 && metrics.unsafe === 0
  );
  if (replay) return { kind: "replay", targets };

  fail("target rows are partial, mixed, conflicting, or have unexpected counts");
}

function scalarCount(db: Database.Database, sql: string, ...params: unknown[]): number {
  return numeric(db.prepare(sql).get(...params), "count");
}

function visibilityReport(db: Database.Database): VisibilityReport {
  const targetWhere = `(
    (p.platform = 'substack' AND p.brand_id = 'human-inference' AND p.provider_account_id = 'human-inference/browser-analytics') OR
    (p.platform = 'substack-note' AND p.brand_id = 'human-inference' AND p.provider_account_id = 'human-inference/substack')
  )`;
  const metricTargetWhere = targetWhere.replaceAll("p.brand_id", "m.brand_id").replaceAll("p.provider_account_id", "m.provider_account_id");
  const targetPosts = scalarCount(db, `SELECT COUNT(*) AS count FROM posts p WHERE ${targetWhere}`);
  const targetMetrics = scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE ${metricTargetWhere}`);
  const browserPosts = scalarCount(db, `SELECT COUNT(*) AS count FROM posts WHERE platform = 'substack' AND brand_id = 'human-inference' AND provider_account_id = 'human-inference/browser-analytics'`);
  const browserMetrics = scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE p.platform = 'substack' AND m.brand_id = 'human-inference' AND m.provider_account_id = 'human-inference/browser-analytics'`);
  const notesPosts = scalarCount(db, `SELECT COUNT(*) AS count FROM posts WHERE platform = 'substack-note' AND brand_id = 'human-inference' AND provider_account_id = 'human-inference/substack'`);
  const notesMetrics = scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE p.platform = 'substack-note' AND m.brand_id = 'human-inference' AND m.provider_account_id = 'human-inference/substack'`);
  const otherPosts = scalarCount(db, `SELECT COUNT(*) AS count FROM posts WHERE platform IN ('substack', 'substack-note') AND brand_id IN ('charles', 'fiction')`);
  const otherMetrics = scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE p.platform IN ('substack', 'substack-note') AND m.brand_id IN ('charles', 'fiction')`);
  const experimentalPosts = scalarCount(db, `SELECT COUNT(*) AS count FROM posts WHERE platform IN ('x', 'linkedin') AND brand_id IS NULL AND provider_account_id IS NULL`);
  const experimentalMetrics = scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE p.platform IN ('x', 'linkedin') AND m.brand_id IS NULL AND m.provider_account_id IS NULL`);
  const partialPosts = scalarCount(db, `SELECT COUNT(*) AS count FROM posts WHERE platform IN ('substack', 'substack-note') AND ((brand_id IS NULL) <> (provider_account_id IS NULL) OR (brand_id IS NOT NULL AND provider_account_id IS NOT NULL AND NOT ${targetWhere.replaceAll("p.", "")}))`);
  const partialMetrics = scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE p.platform IN ('substack', 'substack-note') AND ((m.brand_id IS NULL) <> (m.provider_account_id IS NULL) OR (m.brand_id IS NOT NULL AND m.provider_account_id IS NOT NULL AND NOT ${metricTargetWhere}))`);
  const eligibleWhere = `${targetWhere} AND p.pillar IS NOT NULL AND COALESCE(p.source, '') NOT IN ('spin-control-run', 'exploration-probe')`;
  const pillarlessWhere = `${targetWhere} AND p.pillar IS NULL`;
  return {
    human_inference: { posts: targetPosts, metrics: targetMetrics },
    browser_analytics: { posts: browserPosts, metrics: browserMetrics },
    substack_notes: { posts: notesPosts, metrics: notesMetrics },
    other_brand_target_pairs: { posts: otherPosts, metrics: otherMetrics },
    retained_experimental_unassigned: { posts: experimentalPosts, metrics: experimentalMetrics },
    target_partial_or_conflicting: { posts: partialPosts, metrics: partialMetrics },
    route_cell_eligible: {
      posts: scalarCount(db, `SELECT COUNT(*) AS count FROM posts p WHERE ${eligibleWhere}`),
      metrics: scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE ${eligibleWhere.replaceAll("p.brand_id", "m.brand_id").replaceAll("p.provider_account_id", "m.provider_account_id")}`),
    },
    pillarless: {
      posts: scalarCount(db, `SELECT COUNT(*) AS count FROM posts p WHERE ${pillarlessWhere}`),
      metrics: scalarCount(db, `SELECT COUNT(*) AS count FROM metrics m JOIN posts p ON p.id = m.post_id WHERE ${pillarlessWhere.replaceAll("p.brand_id", "m.brand_id").replaceAll("p.provider_account_id", "m.provider_account_id")}`),
    },
  };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function fingerprintValue(value: unknown): string {
  if (value === null) return "null";
  if (Buffer.isBuffer(value)) return `blob:${value.toString("base64")}`;
  if (typeof value === "string") return `string:${JSON.stringify(value)}`;
  if (typeof value === "number") return `number:${Number.isNaN(value) ? "NaN" : String(value)}`;
  if (typeof value === "bigint") return `bigint:${value.toString()}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  return `other:${JSON.stringify(value)}`;
}

/** A content-free logical fingerprint used only to validate a backup restore. */
export function logicalDatabaseSha256(db: Database.Database): string {
  const digest = createHash("sha256");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  for (const { name } of tables) {
    const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all() as { name: string }[];
    const rows = db.prepare(`SELECT * FROM ${quoteIdentifier(name)}`).all() as Record<string, unknown>[];
    const rowHashes = rows.map((row) => createHash("sha256").update(columns.map(({ name: column }) => `${column}=${fingerprintValue(row[column])}`).join("\u001f")).digest("hex")).sort();
    digest.update(`${name}\u001e${columns.map(({ name: column }) => column).join("\u001f")}\u001e${rowHashes.join("\u001f")}\n`);
  }
  return digest.digest("hex");
}

function assertIntegrity(db: Database.Database, label: string): void {
  const row = db.prepare("PRAGMA integrity_check").get() as { integrity_check?: unknown } | undefined;
  if (row?.integrity_check !== "ok") fail(`${label} failed SQLite integrity validation`);
}

async function createVerifiedBackup(sourceDbPath: string, backupPath: string, expectedFingerprint: string): Promise<NonNullable<BackfillReport["backup"]>> {
  // A readonly connection can create a separate destination through SQLite's backup API.
  // query_only is deliberately omitted here because it suppresses that API's destination write.
  const source = openReadonly(sourceDbPath, false);
  try {
    await source.backup(backupPath);
  } finally {
    source.close();
  }
  const resolvedBackup = resolveExistingRegularFile(backupPath, "backup");
  const backupSha256 = sha256File(resolvedBackup);
  const backupDb = openReadonly(resolvedBackup, false);
  let restoreDir: string | undefined;
  try {
    assertIntegrity(backupDb, "backup");
    const backupFingerprint = logicalDatabaseSha256(backupDb);
    if (backupFingerprint !== expectedFingerprint) fail("backup does not match the pre-apply database state");
    restoreDir = mkdtempSync(join(dirname(resolvedBackup), ".analytics-backfill-restore-"));
    const restoredPath = join(restoreDir, `${randomUUID()}.db`);
    await backupDb.backup(restoredPath);
    const restoredDb = openReadonly(restoredPath);
    try {
      assertIntegrity(restoredDb, "isolated backup restore");
      const restoreFingerprint = logicalDatabaseSha256(restoredDb);
      if (restoreFingerprint !== backupFingerprint) fail("isolated backup restore does not match its backup");
      return { path: resolvedBackup, sha256: backupSha256, pre_apply_logical_sha256: expectedFingerprint, restore_logical_sha256: restoreFingerprint };
    } finally {
      restoredDb.close();
    }
  } finally {
    backupDb.close();
    if (restoreDir) rmSync(restoreDir, { recursive: true, force: true });
  }
}

function applyUpdates(db: Database.Database, manifest: BackfillManifest): { posts: number; metrics: number } {
  let posts = 0;
  let metrics = 0;
  for (const target of manifest.targets) {
    posts += db.prepare("UPDATE posts SET brand_id = ?, provider_account_id = ? WHERE platform = ? AND brand_id IS NULL AND provider_account_id IS NULL")
      .run(target.brand_id, target.provider_account_id, target.platform).changes;
    metrics += db.prepare(`
      UPDATE metrics AS m
      SET brand_id = ?, provider_account_id = ?
      WHERE m.brand_id IS NULL AND m.provider_account_id IS NULL
        AND EXISTS (
          SELECT 1 FROM posts p
          WHERE p.id = m.post_id
            AND p.platform = ?
            AND p.brand_id = ?
            AND p.provider_account_id = ?
        )
    `).run(target.brand_id, target.provider_account_id, target.platform, target.brand_id, target.provider_account_id).changes;
  }
  if (posts !== manifest.expected_change_totals.posts || metrics !== manifest.expected_change_totals.metrics) fail("update counts did not match the approved manifest totals");
  return { posts, metrics };
}

function reportFor(state: DatabaseState["kind"], mode: BackfillReport["mode"], manifest: BackfillManifest, manifestSha256: string, sourceSha256: string, visibility: VisibilityReport, changed: { posts: number; metrics: number }, backup: BackfillReport["backup"]): BackfillReport {
  const totals = manifest.expected_change_totals;
  return {
    mode,
    state: state === "candidate" && mode === "apply" ? "applied" : state,
    manifest_sha256: manifestSha256,
    source_db_sha256: sourceSha256,
    proposed: state === "candidate" ? { ...totals } : { posts: 0, metrics: 0 },
    changed,
    after: state === "candidate" && mode === "dry-run" ? { posts: 0, metrics: 0 } : { ...totals },
    unresolved: { posts: 0, metrics: 0 },
    visibility,
    backup,
  };
}

/**
 * Execute against an already-validated fixed 5X manifest. It never imports openDb(), so a dry
 * run cannot initialize or migrate a database. The public CLI additionally pins the manifest
 * bytes before calling this engine.
 */
export async function executeBackfill(options: ExecuteBackfillOptions): Promise<BackfillReport> {
  assertBackfillManifest(options.manifest);
  assertSha256(options.manifestSha256, "manifest SHA-256");
  const sourceDbPath = resolveExistingRegularFile(options.dbPath, "database");
  assertNoActiveSnapshotSidecars(sourceDbPath);
  const sourceSha256 = sha256File(sourceDbPath);
  const readonly = openReadonly(sourceDbPath);
  let initialState: DatabaseState;
  let initialVisibility: VisibilityReport;
  try {
    initialState = inspectState(readonly, options.manifest);
    initialVisibility = visibilityReport(readonly);
  } finally {
    readonly.close();
  }
  assertNoActiveSnapshotSidecars(sourceDbPath);

  if (initialState.kind === "candidate" && sourceSha256 !== options.manifest.source_db_sha256) {
    fail("database SHA-256 does not match the frozen manifest snapshot");
  }
  if (!options.apply) return reportFor(initialState.kind, "dry-run", options.manifest, options.manifestSha256, sourceSha256, initialVisibility, { posts: 0, metrics: 0 }, null);
  if (!options.backupPath) fail("--apply requires a new absolute --backup path");

  if (initialState.kind === "replay") {
    return reportFor("replay", "apply", options.manifest, options.manifestSha256, sourceSha256, initialVisibility, { posts: 0, metrics: 0 }, null);
  }

  const backupPath = resolveNewBackupPath(options.backupPath, sourceDbPath);
  const db = new Database(sourceDbPath, { fileMustExist: true });
  db.pragma("busy_timeout = 5000");
  let inTransaction = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    inTransaction = true;
    assertNoActiveSnapshotSidecars(sourceDbPath);
    if (sha256File(sourceDbPath) !== options.manifest.source_db_sha256) fail("database changed before the IMMEDIATE transaction began");
    const lockedState = inspectState(db, options.manifest);
    if (lockedState.kind !== "candidate") fail("database state changed before the IMMEDIATE transaction began");
    const beforeFingerprint = logicalDatabaseSha256(db);
    const backup = await createVerifiedBackup(sourceDbPath, backupPath, beforeFingerprint);
    const changed = applyUpdates(db, options.manifest);
    const afterState = inspectState(db, options.manifest);
    if (afterState.kind !== "replay") fail("post-update state was not an exact replay state");
    const visibility = visibilityReport(db);
    if (visibility.human_inference.posts !== 45 || visibility.human_inference.metrics !== 206 || visibility.browser_analytics.posts !== 13 || visibility.browser_analytics.metrics !== 86 || visibility.substack_notes.posts !== 32 || visibility.substack_notes.metrics !== 120 || visibility.target_partial_or_conflicting.posts !== 0 || visibility.target_partial_or_conflicting.metrics !== 0) {
      fail("post-update aggregate verification did not match the approved repair result");
    }
    db.exec("COMMIT");
    inTransaction = false;
    return reportFor("candidate", "apply", options.manifest, options.manifestSha256, sourceSha256, visibility, changed, backup);
  } catch (error) {
    if (inTransaction) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export function readFrozenManifest(manifestPath: string): { manifest: BackfillManifest; sha256: string } {
  const resolved = resolveExistingRegularFile(manifestPath, "manifest");
  const bytes = readFileSync(resolved);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== FROZEN_MANIFEST_SHA256) fail("manifest bytes do not match the frozen 5X contract");
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("manifest is not valid JSON");
  }
  assertBackfillManifest(value);
  return { manifest: value, sha256 };
}

type ParsedArgs = { dbPath: string; manifestPath: string; apply: boolean; backupPath?: string } | { help: true };

export function parseArgs(args: readonly string[]): ParsedArgs {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return { help: true };
  let dbPath: string | undefined;
  let manifestPath: string | undefined;
  let backupPath: string | undefined;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") {
      if (apply) fail("--apply may be supplied only once");
      apply = true;
      continue;
    }
    if (arg === "--verify") continue; // Optional compatibility flag; reports are always aggregate-verified.
    if (arg === "--db" || arg === "--manifest" || arg === "--backup") {
      const value = args[++index];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      if (arg === "--db") {
        if (dbPath) fail("--db may be supplied only once");
        dbPath = value;
      } else if (arg === "--manifest") {
        if (manifestPath) fail("--manifest may be supplied only once");
        manifestPath = value;
      } else {
        if (backupPath) fail("--backup may be supplied only once");
        backupPath = value;
      }
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!dbPath || !manifestPath) fail("--db and --manifest are required");
  if (apply !== Boolean(backupPath)) fail("--apply and --backup must be supplied together");
  return { dbPath, manifestPath, apply, backupPath };
}

export async function runCli(args: readonly string[]): Promise<BackfillReport | null> {
  const parsed = parseArgs(args);
  if ("help" in parsed) {
    process.stdout.write("Usage: npm run backfill:analytics-brand -- --db <path> --manifest <path> [--apply --backup <new-absolute-path>] [--verify]\n");
    return null;
  }
  const frozen = readFrozenManifest(parsed.manifestPath);
  const report = await executeBackfill({ dbPath: parsed.dbPath, manifest: frozen.manifest, manifestSha256: frozen.sha256, apply: parsed.apply, backupPath: parsed.backupPath });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).catch(() => {
    // Reports intentionally contain only aggregates. Do not leak source rows through a SQLite error.
    process.stderr.write("analytics brand backfill failed; no transaction was committed\n");
    process.exitCode = 1;
  });
}
