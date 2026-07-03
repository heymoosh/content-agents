import { renderCardAnimation, type CardData } from "./hyperframes.js";
import { resolveScheme } from "./card-schemes.js";

// One-shot animated quote card: quote text in, editorial sentence-reveal MP4 out. No content
// folder, no derivative file, no orchestration — just the locked-default card. This is the
// deterministic path so producing an animated card never depends on multi-step setup again.
//
//   npm run card -- --text 'The quote goes here.'
//   npm run card -- --text '...' --source 'Essay Title' --scheme classic --out promo.mp4
//
// Schemes: teal-accent (default), classic, teal-block, ink.

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const text = arg("--text");
if (!text) {
  console.error(
    "usage: npm run card -- --text '<quote>' [--attribution '<name>'] [--source '<title>'] " +
      "[--scheme teal-accent|classic|teal-block|ink] [--out card.mp4] [--duration 5000]"
  );
  process.exit(1);
}

const data: CardData = {
  quote: text,
  attribution: arg("--attribution") ?? "Muxin Li",
  source: arg("--source") ?? "",
  ...resolveScheme({ scheme: arg("--scheme") }),
};
const out = arg("--out") ?? "card.mp4";
const duration = Number(arg("--duration") ?? 5000);

renderCardAnimation(data, out, duration);
console.log(`animated card → ${out}`);
