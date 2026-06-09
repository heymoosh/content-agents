import { readFileSync } from "node:fs";
import { openDb } from "./db.js";

// Write back pillar tags assigned by Claude.
//   tsx src/db/tag-posts.ts '[{"id":1,"pillar":"civic-tech"}, ...]'
//   tsx src/db/tag-posts.ts tags.json
const VALID = new Set(["human-ai", "claude-code", "civic-tech", "other"]);

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: tsx src/db/tag-posts.ts \'[{"id":1,"pillar":"civic-tech"}]\' | tags.json');
    process.exit(1);
  }
  const text = arg.trim().startsWith("[") ? arg : readFileSync(arg, "utf8");
  const tags = JSON.parse(text) as { id: number; pillar: string }[];

  const bad = tags.filter((t) => !VALID.has(t.pillar) || !Number.isInteger(t.id));
  if (bad.length) {
    console.error(`invalid entries (pillar must be one of ${[...VALID].join(", ")}):`);
    console.error(JSON.stringify(bad, null, 2));
    process.exit(1);
  }

  const db = openDb();
  const update = db.prepare("UPDATE posts SET pillar = ? WHERE id = ?");
  const tx = db.transaction(() => {
    let n = 0;
    for (const t of tags) n += update.run(t.pillar, t.id).changes;
    return n;
  });
  console.log(`tagged ${tx()} post(s)`);
  db.close();
}

main();
