import { readFileSync } from "node:fs";
import { openDb } from "./db.js";

// Write back the bet a post belongs to, after /strategy matches an analytics row to a bet placed
// in briefs/bets.md (the match itself is Claude judgment; this script just persists it).
//   tsx src/db/link-bet.ts '[{"id":1,"bet_id":"2026-06-14-001"}, ...]'
//   tsx src/db/link-bet.ts links.json
// bet_id is the ledger bet id without the "bet:" prefix (e.g. "2026-06-14-001").

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: tsx src/db/link-bet.ts \'[{"id":1,"bet_id":"2026-06-14-001"}]\' | links.json');
    process.exit(1);
  }
  const text = arg.trim().startsWith("[") ? arg : readFileSync(arg, "utf8");
  const links = JSON.parse(text) as { id: number; bet_id: string }[];

  const bad = links.filter(
    (l) => !Number.isInteger(l.id) || typeof l.bet_id !== "string" || l.bet_id.trim() === ""
  );
  if (bad.length) {
    console.error("invalid entries (need integer id and non-empty bet_id):");
    console.error(JSON.stringify(bad, null, 2));
    process.exit(1);
  }

  const db = openDb();
  const update = db.prepare("UPDATE posts SET bet_id = ? WHERE id = ?");
  const tx = db.transaction(() => {
    let n = 0;
    for (const l of links) n += update.run(l.bet_id.replace(/^bet:/, ""), l.id).changes;
    return n;
  });
  console.log(`linked ${tx()} post(s) to bets`);
  db.close();
}

main();
