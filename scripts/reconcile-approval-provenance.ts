import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { repoRoot } from "../src/db/db.js";
import { readQueue, type QueueRow } from "../src/publish/queue.js";
import { PUBLISHING_STATUS_PATH } from "../src/review/publishing-status.js";
import {
  adoptApprovedQueueRow,
  approvalDispatchDisposition,
  approvalFingerprint,
  approvalSchedulingBlock,
  journalPathForLedger,
} from "../src/review/approval-provenance.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function required(name: string): string {
  const value = argument(name)?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function target(folder: string, rowId: string): QueueRow {
  const row = readQueue(folder).rows.find((item) => item.id === rowId);
  if (!row) throw new Error(`queue row ${rowId} does not exist`);
  if (row.status !== "approve") throw new Error(`queue row ${rowId} has status ${row.status || "pending"}, not approve`);
  return row;
}

function adoptionRoot(): string {
  const testRoot = process.env.NODE_TEST_CONTEXT && process.env.CONTENT_AGENTS_TEST_ADOPTION_REPO_ROOT?.trim();
  return resolve(testRoot || repoRoot);
}

function isWithin(root: string, targetPath: string): boolean {
  const rel = relative(root, targetPath);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function assertAdoptionFolder(folder: string): string {
  const root = realpathSync(adoptionRoot());
  const canonical = realpathSync(folder);
  const allowedRoots = [join(root, "content"), join(root, "outreach")].filter(existsSync).map((path) => realpathSync(path));
  if (!allowedRoots.some((allowed) => isWithin(allowed, canonical))) {
    throw new Error("--folder must be inside the repository's content or outreach root");
  }
  return canonical;
}

function main(): void {
  const folder = assertAdoptionFolder(resolve(required("--folder")));
  const rowId = required("--row");
  const slug = basename(folder);
  const ledger = resolve(argument("--ledger") ?? PUBLISHING_STATUS_PATH);
  const journal = journalPathForLedger(ledger);
  const row = target(folder, rowId);
  const fingerprint = approvalFingerprint(folder, row);
  if (!fingerprint) throw new Error(`queue row ${rowId} asset fingerprint cannot be computed`);
  const assetPath = resolve(folder, row.asset);
  const opening = readFileSync(assetPath, "utf8").split("\n").slice(0, 5);

  console.log(`row         ${slug}/${rowId}`);
  console.log(`asset       ${row.asset}`);
  console.log(`modified    ${statSync(assetPath).mtime.toISOString()}`);
  console.log("opening");
  for (const line of opening) console.log(`  ${line}`);
  console.log(`fingerprint ${fingerprint}`);
  console.log(`journal     ${journal}`);
  console.log(`current     ${JSON.stringify(approvalDispatchDisposition(folder, slug, row, ledger, journal))}`);

  if (!process.argv.includes("--write")) {
    console.log("No journal event was written.");
    console.log(`After reviewing the row and fingerprint, run again with --write --expect-fingerprint ${fingerprint}`);
    return;
  }

  const expected = required("--expect-fingerprint");
  adoptApprovedQueueRow(folder, slug, rowId, expected, ledger, journal);
  const current = readQueue(folder).rows.find((item) => item.id === rowId)!;
  const block = approvalSchedulingBlock(folder, slug, current, ledger, journal);
  if (block) throw new Error(`adoption was recorded but Schedule is still refused: ${block}`);
  console.log("Adoption recorded. Schedule is ready for this row.");
}

try { main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
