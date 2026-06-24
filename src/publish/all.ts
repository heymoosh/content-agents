import { spawnSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { existsSync } from "node:fs";
import { repoRoot } from "../db/db.js";

// One entry point that schedules a content folder across EVERY channel in a single pass — text
// (Typefully), quote cards (image relays), TikTok (PostPeer), YouTube, and ready-to-paste files — all
// drawing from the one shared slot ledger (src/publish/slots.ts) so nothing double-books a platform's
// day. The per-channel scripts (publish:typefully / :cards / :tiktok / :youtube / :paste) stay
// independently callable; this just runs them in order. Each acts ONLY on rows Muxin set to `approve`
// in review-queue.md, so a channel with nothing approved is a harmless no-op. Nothing here publishes
// instantly — every channel schedules a draft.
//   npm run publish:all <content-folder>

const CHANNELS = [
  { name: "typefully", script: "src/publish/typefully.ts" },
  { name: "cards", script: "src/publish/cards.ts" },
  { name: "tiktok", script: "src/publish/tiktok.ts" },
  { name: "youtube", script: "src/publish/youtube.ts" },
  { name: "paste", script: "src/publish/paste-files.ts" },
];

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/all.ts <content-folder>");
    process.exit(1);
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);

  // Use the same tsx binary that's running this script, so child channels share the toolchain.
  const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
  if (!existsSync(tsxBin)) throw new Error(`tsx not found at ${tsxBin} — run npm install`);

  const failed: string[] = [];
  for (const ch of CHANNELS) {
    console.log(`\n=== publish:${ch.name} ===`);
    const res = spawnSync(tsxBin, [ch.script, folder], { stdio: "inherit", cwd: repoRoot });
    // Keep going past a failing channel so one quota/auth error doesn't strand the others; report at
    // the end and exit non-zero if anything failed.
    if (res.status !== 0 || res.error) failed.push(ch.name);
  }

  console.log("");
  if (failed.length) {
    console.error(`publish:all finished with failures in: ${failed.join(", ")} — re-run that channel's script for details.`);
    process.exit(1);
  }
  console.log("publish:all: all channels processed. Check `npm run queue` for the merged schedule.");
}

main();
