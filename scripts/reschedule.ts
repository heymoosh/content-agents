import { readQueue } from "../src/publish/queue.js";
import { safeFolder } from "../src/review/rows.js";
import { batchReschedule, listBatchCandidates, rescheduleRow, type BatchPlan, type BatchSelection } from "../src/review/reschedule.js";

/**
 * Move scheduled Postiz posts without opening Studio.
 *
 *   npm run publish:reschedule -- --slug <slug> --id <rowId> --to 2026-09-20T17:00:00Z
 *   npm run publish:reschedule -- --slug <slug> --id <rowId> --not-before 2026-09-20
 *   npm run publish:reschedule -- --pillar human-ai --shift 7            # whole theme, keep spacing
 *   npm run publish:reschedule -- --slug <slug> --after 2026-09-20       # re-flow through the cadence
 *   add --dry-run to list what would move.
 */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
function args(name: string): string[] | undefined {
  const values = process.argv.flatMap((value, index) => (value === `--${name}` && process.argv[index + 1] ? [process.argv[index + 1]] : []));
  return values.length ? values : undefined;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const id = arg("id");
  if (id) {
    const slug = arg("slug");
    if (!slug) throw new Error("--id needs --slug");
    const folder = safeFolder(slug);
    const row = readQueue(folder).rows.find((item) => item.id === id);
    if (!row) throw new Error(`no row ${id} in ${slug}`);
    if (dryRun) { console.log(JSON.stringify({ slug, id, platform: row.platform }, null, 2)); return; }
    const outcome = await rescheduleRow(folder, slug, row, { to: arg("to"), notBefore: arg("not-before") });
    console.log(JSON.stringify(outcome, null, 2));
    if (!outcome.ok) process.exitCode = 1;
    return;
  }
  const selection: BatchSelection = { slugs: args("slug"), pillars: args("pillar"), platforms: args("platform"), ids: args("key") };
  if (dryRun) {
    console.log(JSON.stringify(listBatchCandidates(selection).map((c) => ({ slug: c.slug, id: c.row.id, platform: c.platform, pillar: c.pillar, plannedFor: c.status.plannedFor })), null, 2));
    return;
  }
  const shift = arg("shift");
  const after = arg("after");
  const plan: BatchPlan | null = shift ? { mode: "shift", days: Number(shift) } : after ? { mode: "after", notBefore: after } : null;
  if (!plan) throw new Error("give --shift <days> or --after <date>");
  const result = await batchReschedule(selection, plan);
  console.log(JSON.stringify(result, null, 2));
  if (result.results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
