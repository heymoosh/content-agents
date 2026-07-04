import { spawnSync } from "node:child_process";
import { repoRoot } from "../db/db.js";

// Weekly analytics refresh — the "don't ask me" job.
//
// Runs the same verified commands you'd run by hand, in order, isolating failures so one dead
// session never blocks the rest:
//   1. npm run pull -- --ingest   → LinkedIn + X + Substack (saved-session browser) → ingest
//   2. npm run bluesky            → Bluesky per-post metrics via the AT Protocol API
//
// Because ingest upserts posts and APPENDS a fresh timestamped metrics snapshot, running this
// weekly keeps every post's stats current (a post that gains traction later gets re-measured)
// while preserving history — and /strategy reads the latest snapshot per post, so no double count.
//
// Meant to be driven by launchd (see config/launchd/ + docs/setup-weekly-pull.md), but safe to
// run by hand any time: `npm run pull:weekly`.

interface Step {
  name: string;
  cmd: string;
  args: string[];
}

const STEPS: Step[] = [
  { name: "pull + ingest (LinkedIn / X / Substack)", cmd: "npm", args: ["run", "pull", "--", "--ingest"] },
  { name: "bluesky metrics", cmd: "npm", args: ["run", "bluesky"] },
];

function run(step: Step): number {
  console.log(`\n━━ ${step.name} ━━`);
  const r = spawnSync(step.cmd, step.args, { cwd: repoRoot, stdio: "inherit" });
  return r.status ?? 1;
}

function main(): void {
  const startedAt = new Date().toISOString();
  console.log(`\n═══ weekly analytics pull · ${startedAt} ═══`);

  const results = STEPS.map((s) => ({ name: s.name, code: run(s) }));
  const failed = results.filter((r) => r.code !== 0);

  console.log(`\n═══ summary ═══`);
  for (const r of results) console.log(`  ${r.code === 0 ? "✓" : "✗"} ${r.name}`);

  if (failed.length) {
    console.error(
      `\n⚠ ${failed.length} step(s) failed. If a pull said "the saved session lapsed", re-run:` +
        `\n    npm run pull:login -- <linkedin|x|substack>` +
        `\n(diagnostics bundles, if any, were printed above and saved under ~/.content-agents/pull-diagnostics/).`
    );
    process.exitCode = 1;
  } else {
    console.log(`\n✓ all fresh. Run /strategy when you're ready — the DB is up to date.`);
  }
}

main();
