import { readFileSync } from "node:fs";
import { openDb } from "./db.js";
import { isBrandId } from "../identity/brand.js";
import type { BrandId } from "../identity/brand.js";

// Write back the bet a post belongs to, after /strategy matches an analytics row to a bet placed
// in briefs/bets.md (the match itself is Claude judgment; this script just persists it).
//   tsx src/db/link-bet.ts '[{"id":1,"bet_id":"2026-06-14-001"}, ...]'
//   tsx src/db/link-bet.ts links.json
// bet_id is the ledger bet id without the "bet:" prefix (e.g. "2026-06-14-001").

export function parseLinkBetArgv(argv: readonly string[]): { brandId: BrandId; input: string } {
  const brandIndex = argv.indexOf("--brand");
  const rawBrand = brandIndex >= 0 ? argv[brandIndex + 1] : argv.find((item) => item.startsWith("--brand="))?.slice(8);
  if (!isBrandId(rawBrand)) throw new Error("--brand <brand> is required");
  const input = argv.find((item, index) => index !== brandIndex && index !== brandIndex + 1 && !item.startsWith("--"));
  if (!input) throw new Error("links JSON or path is required");
  return { brandId: rawBrand, input };
}

function main() {
  let parsed: { brandId: BrandId; input: string };
  try { parsed = parseLinkBetArgv(process.argv.slice(2)); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); return; }
  const { brandId, input: arg } = parsed;
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
  const update = db.prepare("UPDATE posts SET bet_id = ? WHERE id = ? AND brand_id = ?");
  const tx = db.transaction(() => {
    let n = 0;
    for (const l of links) n += update.run(l.bet_id.replace(/^bet:/, ""), l.id, brandId).changes;
    return n;
  });
  console.log(`linked ${tx()} post(s) to bets`);
  db.close();
}

main();
