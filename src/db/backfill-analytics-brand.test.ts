import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  type BackfillManifest,
  executeBackfill,
  logicalDatabaseSha256,
  parseArgs,
  readFrozenManifest,
} from "./backfill-analytics-brand.js";

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function withTempDir<T>(callback: (directory: string) => Promise<T> | T): Promise<T> {
  const directory = mkdtempSync(join(tmpdir(), "analytics-backfill-test-"));
  try {
    return await callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function createFixture(path: string): void {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      platform TEXT NOT NULL,
      platform_post_id TEXT,
      content_text TEXT,
      pillar TEXT,
      source TEXT,
      brand_id TEXT,
      provider_account_id TEXT
    );
    CREATE TABLE metrics (
      id INTEGER PRIMARY KEY,
      post_id INTEGER NOT NULL,
      likes INTEGER,
      raw_json TEXT,
      brand_id TEXT,
      provider_account_id TEXT
    );
    CREATE TABLE retained_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO retained_state VALUES ('unrelated', 'preserve-this-logical-value');
  `);
  const post = db.prepare("INSERT INTO posts (platform, platform_post_id, content_text, pillar, source) VALUES (?, ?, ?, ?, ?)");
  const metric = db.prepare("INSERT INTO metrics (post_id, likes, raw_json) VALUES (?, ?, ?)");
  let ordinal = 0;
  const insertTarget = (platform: "substack" | "substack-note", posts: number, metrics: number, pillarless = 0) => {
    const postIds: number[] = [];
    for (let index = 0; index < posts; index += 1) {
      const info = post.run(platform, `${platform}-${index}`, `fixture-${platform}-${index}`, index < pillarless ? null : "human-ai", "organic");
      postIds.push(Number(info.lastInsertRowid));
    }
    const pillarlessMetrics = pillarless * 2;
    for (let index = 0; index < metrics - pillarlessMetrics; index += 1) {
      metric.run(postIds[pillarless + (index % (postIds.length - pillarless))], ordinal++, JSON.stringify({ fixture: index }));
    }
    for (let index = 0; index < pillarlessMetrics; index += 1) {
      metric.run(postIds[index % pillarless], ordinal++, JSON.stringify({ fixture: metrics + index }));
    }
  };
  insertTarget("substack", 13, 86, 3);
  insertTarget("substack-note", 32, 120);
  const x = post.run("x", "unassigned-x", "experimental fixture", "human-ai", "organic");
  metric.run(x.lastInsertRowid, 1, "{}");
  const linkedin = post.run("linkedin", "unassigned-linkedin", "experimental fixture", "human-ai", "organic");
  metric.run(linkedin.lastInsertRowid, 1, "{}");
  db.close();
}

function manifestFor(path: string): { manifest: BackfillManifest; manifestSha256: string } {
  const manifest: BackfillManifest = {
    version: "slice-5x-substack-backfill-v1",
    source_db_sha256: sha256(path),
    evidence: {
      provenance_account_audit_sha256: "f563cb5c540a56ec41f0506c0d5e07497e9c415d0d57cf8fc9e73a28977a36d0",
      source_reference_attestation_sha256: "bdd66d35a744490cabf105ceec4f9b37a00184bf966bd430683ea986eee2617c",
      substack_verified_source_count: 22,
      substack_verified_source_checksum_set_sha256: "87e9632974f85e1516106e3710566485f8dd6659f2a2284ebbb6f833f464b75f",
      owner_attestation: "fixture owner attestation",
    },
    preconditions: {
      all_target_identity_fields_are_both_null: true,
      partial_identity_rows: { posts: 0, metrics: 0 },
      excluded_legacy_experiment_pairs: {
        x: { posts: 264, metrics: 2345 },
        linkedin: { posts: 100, metrics: 430 },
      },
    },
    targets: [
      {
        name: "checksum-joined-substack-articles",
        platform: "substack",
        brand_id: "human-inference",
        provider_account_id: "human-inference/browser-analytics",
        expected_posts: 13,
        expected_metrics: 86,
        evidence: "fixture article evidence",
      },
      {
        name: "legacy-substack-notes",
        platform: "substack-note",
        brand_id: "human-inference",
        provider_account_id: "human-inference/substack",
        expected_posts: 32,
        expected_metrics: 120,
        evidence: "fixture note evidence",
      },
    ],
    expected_change_totals: { posts: 45, metrics: 206 },
    excluded_scope: { audience_rows: 25, import_rows: 22, reason: "fixture excludes audience and imports" },
  };
  const manifestSha256 = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  return { manifest, manifestSha256 };
}

function fingerprint(path: string): string {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    return logicalDatabaseSha256(db);
  } finally {
    db.close();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error;
  }
}

test("dry run is read-only; apply is exact, recoverable, and replay is a verified zero-change outcome", async () => {
  await withTempDir(async (directory) => {
    const dbPath = join(directory, "analytics.db");
    const backupPath = join(directory, "before-apply.db");
    createFixture(dbPath);
    const { manifest, manifestSha256 } = manifestFor(dbPath);
    const before = fingerprint(dbPath);

    const dry = await executeBackfill({ dbPath, manifest, manifestSha256 });
    assert.equal(dry.state, "candidate");
    assert.deepEqual(dry.proposed, { posts: 45, metrics: 206 });
    assert.equal(fingerprint(dbPath), before, "dry run did not alter the database");

    const applied = await executeBackfill({ dbPath, manifest, manifestSha256, apply: true, backupPath });
    assert.equal(applied.state, "applied");
    assert.deepEqual(applied.changed, { posts: 45, metrics: 206 });
    assert.equal(applied.visibility.human_inference.posts, 45);
    assert.equal(applied.visibility.human_inference.metrics, 206);
    assert.deepEqual(applied.visibility.browser_analytics, { posts: 13, metrics: 86 });
    assert.deepEqual(applied.visibility.substack_notes, { posts: 32, metrics: 120 });
    assert.deepEqual(applied.visibility.route_cell_eligible, { posts: 42, metrics: 200 });
    assert.deepEqual(applied.visibility.pillarless, { posts: 3, metrics: 6 });
    assert.deepEqual(applied.visibility.retained_experimental_unassigned, { posts: 2, metrics: 2 });
    assert.ok(applied.backup && existsSync(applied.backup.path));
    assert.equal(fingerprint(backupPath), before, "validated backup restores the entire pre-apply logical state");
    const preserved = new Database(dbPath, { readonly: true }).prepare("SELECT value FROM retained_state WHERE key = 'unrelated'").get() as { value: string };
    assert.equal(preserved.value, "preserve-this-logical-value", "unrelated rows and nonidentity columns survive the repair");

    const replayBackup = join(directory, "unused-replay-backup.db");
    const replay = await executeBackfill({ dbPath, manifest, manifestSha256, apply: true, backupPath: replayBackup });
    assert.equal(replay.state, "replay");
    assert.deepEqual(replay.changed, { posts: 0, metrics: 0 });
    assert.equal(existsSync(replayBackup), false, "verified replay creates no unnecessary backup or write");
  });
});

test("wrong snapshot hash, wrong counts, partial state, and conflicting state fail before mutation", async () => {
  await withTempDir(async (directory) => {
    const dbPath = join(directory, "analytics.db");
    createFixture(dbPath);
    const initial = manifestFor(dbPath);
    const beforeWrongHash = fingerprint(dbPath);
    initial.manifest.source_db_sha256 = "0".repeat(64);
    await assert.rejects(() => executeBackfill({ dbPath, ...initial }));
    assert.equal(fingerprint(dbPath), beforeWrongHash);

    const db = new Database(dbPath);
    db.prepare("DELETE FROM metrics WHERE id = (SELECT id FROM metrics LIMIT 1)").run();
    db.close();
    const wrongCount = manifestFor(dbPath);
    const beforeWrongCount = fingerprint(dbPath);
    await assert.rejects(() => executeBackfill({ dbPath, ...wrongCount }));
    assert.equal(fingerprint(dbPath), beforeWrongCount);

    rmSync(dbPath);
    createFixture(dbPath);
    const partialDb = new Database(dbPath);
    partialDb.prepare("UPDATE posts SET brand_id = 'human-inference' WHERE platform = 'substack' LIMIT 1").run();
    partialDb.close();
    const partial = manifestFor(dbPath);
    const beforePartial = fingerprint(dbPath);
    await assert.rejects(() => executeBackfill({ dbPath, ...partial }));
    assert.equal(fingerprint(dbPath), beforePartial);

    rmSync(dbPath);
    createFixture(dbPath);
    const conflictDb = new Database(dbPath);
    conflictDb.prepare("UPDATE metrics SET brand_id = 'charles', provider_account_id = 'charles/other' WHERE id = (SELECT id FROM metrics LIMIT 1)").run();
    conflictDb.close();
    const conflict = manifestFor(dbPath);
    const beforeConflict = fingerprint(dbPath);
    await assert.rejects(() => executeBackfill({ dbPath, ...conflict }));
    assert.equal(fingerprint(dbPath), beforeConflict);
  });
});

test("backup aliases, symlinks, clobbers, and a failed metric update cannot create a partial repair", async () => {
  await withTempDir(async (directory) => {
    const dbPath = join(directory, "analytics.db");
    createFixture(dbPath);
    const first = manifestFor(dbPath);
    const before = fingerprint(dbPath);
    await assert.rejects(() => executeBackfill({ dbPath, ...first, apply: true, backupPath: dbPath }));
    assert.equal(fingerprint(dbPath), before);
    const clobber = join(directory, "already-exists.db");
    new Database(clobber).close();
    await assert.rejects(() => executeBackfill({ dbPath, ...first, apply: true, backupPath: clobber }));
    assert.equal(fingerprint(dbPath), before);
    const link = join(directory, "backup-link.db");
    symlinkSync(dbPath, link);
    await assert.rejects(() => executeBackfill({ dbPath, ...first, apply: true, backupPath: link }));
    assert.equal(fingerprint(dbPath), before);

    const triggerDb = new Database(dbPath);
    triggerDb.exec(`CREATE TRIGGER abort_backfill BEFORE UPDATE OF brand_id ON metrics BEGIN SELECT RAISE(ABORT, 'injected metric failure'); END;`);
    triggerDb.close();
    const failed = manifestFor(dbPath);
    const beforeFailure = fingerprint(dbPath);
    const retainedBackup = join(directory, "failure-before-apply.db");
    await assert.rejects(() => executeBackfill({ dbPath, ...failed, apply: true, backupPath: retainedBackup }));
    assert.equal(fingerprint(dbPath), beforeFailure, "one IMMEDIATE transaction rolled back the post updates after a metric failure");
    assert.equal(fingerprint(retainedBackup), beforeFailure, "failure retains a recoverable pre-apply backup");
  });
});

test("dangling backup symlinks and symlinked backup parents cannot create files outside the requested directory", async () => {
  await withTempDir(async (directory) => {
    const externalDirectory = mkdtempSync(join(tmpdir(), "analytics-backfill-external-sentinel-"));
    try {
      const dbPath = join(directory, "analytics.db");
      createFixture(dbPath);
      const fixture = manifestFor(dbPath);
      const before = fingerprint(dbPath);

      const danglingSentinel = join(externalDirectory, "unexpected-dangling-backup.db");
      const danglingLink = join(directory, "dangling-backup-link.db");
      symlinkSync(danglingSentinel, danglingLink);
      const danglingError = await captureError(() => executeBackfill({ dbPath, ...fixture, apply: true, backupPath: danglingLink }));

      const linkedParent = join(directory, "linked-external-backup-parent");
      const linkedParentSentinel = join(externalDirectory, "unexpected-parent-backup.db");
      symlinkSync(externalDirectory, linkedParent);
      const parentError = await captureError(() => executeBackfill({ dbPath, ...fixture, apply: true, backupPath: join(linkedParent, "unexpected-parent-backup.db") }));

      assert.equal(existsSync(danglingSentinel), false, "a dangling backup symlink did not create its external sentinel");
      assert.equal(existsSync(linkedParentSentinel), false, "a symlinked backup parent did not create its external sentinel");
      assert.match(errorMessage(danglingError), /backup path must be new and must not clobber an existing file or symlink/);
      assert.match(errorMessage(parentError), /backup parent directory must exist and must not be a symbolic link/);
      assert.equal(fingerprint(dbPath), before, "rejected backup paths leave the database unchanged");
    } finally {
      rmSync(externalDirectory, { recursive: true, force: true });
    }
  });
});

test("nonempty live WAL and rollback-journal sidecars fail closed without checkpointing or mutation", async () => {
  await withTempDir(async (directory) => {
    const walDbPath = join(directory, "wal-analytics.db");
    createFixture(walDbPath);
    const walSetup = new Database(walDbPath);
    try {
      walSetup.pragma("journal_mode = WAL");
      walSetup.pragma("wal_autocheckpoint = 0");
    } finally {
      walSetup.close();
    }
    const walFixture = manifestFor(walDbPath);
    const frozenMainSha = sha256(walDbPath);
    const walWriter = new Database(walDbPath);
    try {
      walWriter.pragma("wal_autocheckpoint = 0");
      walWriter.prepare("UPDATE retained_state SET value = ? WHERE key = 'unrelated'").run("live-wal-state");
      const walPath = `${walDbPath}-wal`;
      assert.ok(existsSync(walPath));
      const walBytesBefore = readFileSync(walPath);
      assert.ok(walBytesBefore.byteLength > 0, "fixture retains uncheckpointed WAL frames");
      assert.equal(sha256(walDbPath), frozenMainSha, "the frozen main-file hash excludes the live WAL state");
      const visibleBefore = walWriter.prepare("SELECT value FROM retained_state WHERE key = 'unrelated'").get() as { value: string };

      await assert.rejects(() => executeBackfill({ dbPath: walDbPath, ...walFixture }), /nonempty SQLite WAL sidecar/);
      assert.equal(sha256(walDbPath), frozenMainSha, "sidecar rejection does not alter the main database file");
      assert.deepEqual(readFileSync(walPath), walBytesBefore, "sidecar rejection does not checkpoint or alter the live WAL");
      assert.deepEqual(walWriter.prepare("SELECT value FROM retained_state WHERE key = 'unrelated'").get(), visibleBefore, "sidecar rejection does not alter visible WAL state");
    } finally {
      walWriter.close();
    }

    const journalDbPath = join(directory, "journal-analytics.db");
    createFixture(journalDbPath);
    const journalFixture = manifestFor(journalDbPath);
    const journalWriter = new Database(journalDbPath);
    try {
      journalWriter.pragma("journal_mode = DELETE");
      journalWriter.exec("BEGIN IMMEDIATE");
      journalWriter.prepare("UPDATE retained_state SET value = ? WHERE key = 'unrelated'").run("live-journal-state");
      const journalPath = `${journalDbPath}-journal`;
      const journalBytesBefore = readFileSync(journalPath);
      assert.ok(journalBytesBefore.byteLength > 0, "fixture retains an active rollback journal");
      const mainShaBefore = sha256(journalDbPath);

      await assert.rejects(() => executeBackfill({ dbPath: journalDbPath, ...journalFixture }), /nonempty SQLite rollback journal sidecar/);
      assert.equal(sha256(journalDbPath), mainShaBefore, "sidecar rejection does not alter the journal-backed main file");
      assert.deepEqual(readFileSync(journalPath), journalBytesBefore, "sidecar rejection does not checkpoint or alter the rollback journal");
    } finally {
      journalWriter.exec("ROLLBACK");
      journalWriter.close();
    }

    const inertWalDbPath = join(directory, "inert-wal-analytics.db");
    createFixture(inertWalDbPath);
    const inertWriter = new Database(inertWalDbPath);
    try {
      inertWriter.pragma("journal_mode = WAL");
      inertWriter.pragma("wal_autocheckpoint = 0");
      inertWriter.prepare("UPDATE retained_state SET value = ? WHERE key = 'unrelated'").run("checkpointed-inert-wal-state");
      inertWriter.pragma("wal_checkpoint(TRUNCATE)");
      const inertWalFixture = manifestFor(inertWalDbPath);
      const inertWalPath = `${inertWalDbPath}-wal`;
      assert.equal(readFileSync(inertWalPath).byteLength, 0, "fixture has an inert zero-byte WAL");
      assert.ok(existsSync(`${inertWalDbPath}-shm`), "fixture retains SQLite's inert shared-memory sidecar");
      const inertReport = await executeBackfill({ dbPath: inertWalDbPath, ...inertWalFixture });
      assert.equal(inertReport.state, "candidate", "inert zero-byte WAL and shared-memory sidecars do not block a safe dry run");
    } finally {
      inertWriter.close();
    }
  });
});

test("CLI parsing and frozen-manifest loading reject unsafe or altered command inputs", () => {
  assert.throws(() => parseArgs(["--db", "analytics.db", "--manifest", "manifest.json", "--backup", "/tmp/backup.db"]));
  assert.throws(() => parseArgs(["--db", "analytics.db", "--manifest", "manifest.json", "--apply", "--apply", "--backup", "/tmp/backup.db"]));
  assert.throws(() => readFrozenManifest(join(tmpdir(), "missing-manifest.json")));
  const directory = mkdtempSync(join(tmpdir(), "analytics-backfill-altered-manifest-"));
  try {
    const altered = join(directory, "altered.json");
    writeFileSync(altered, JSON.stringify({ version: "slice-5x-substack-backfill-v1" }));
    assert.throws(() => readFrozenManifest(altered));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
