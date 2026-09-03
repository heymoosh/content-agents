import { mkdirSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { repoRoot } from "../db/db.js";

// Shared Remotion invocation helpers (extracted from render.ts so other renderers can reuse
// them without importing render.ts, whose module load runs its CLI main()).
export const REMOTION_PUBLIC_DIR = join(repoRoot, "remotion", "public");
export const REMOTION_ENTRY = join(repoRoot, "remotion", "index.ts");

export function remotion(args: string[]): void {
  execFileSync("npx", ["remotion", ...args], { cwd: repoRoot, stdio: "inherit" });
}

/** Stage inputs under remotion/public/<job> (Remotion's staticFile root) and clean up afterwards. */
export async function withRemotionJob<T>(fn: (jobDir: string, jobName: string) => Promise<T>): Promise<T> {
  const jobName = `job-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`; // unique under concurrent renders
  const jobDir = join(REMOTION_PUBLIC_DIR, jobName);
  mkdirSync(jobDir, { recursive: true });
  try {
    // await so the finally (jobDir cleanup) runs AFTER the async body finishes.
    return await fn(jobDir, jobName);
  } finally {
    rmSync(jobDir, { recursive: true, force: true });
  }
}
