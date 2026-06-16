import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { repoRoot } from "../../db/db.js";
import type { ImageProvider } from "../types.js";

// Free, local, open-source contender. The "model" is an SVG that Claude authors for the
// prompt (flat New Yorker screen-print spot); Remotion rasterizes it to PNG via the same
// `npx remotion still` path render.ts already uses. $0. Pass the SVG with --svg <file>
// (the harness forwards it as params.svgPath).
const ENTRY = join(repoRoot, "remotion", "index.ts");
const DIM: Record<string, [number, number]> = {
  "1:1": [1024, 1024],
  "9:16": [1024, 1820],
  "16:9": [1820, 1024],
};

export const provider: ImageProvider = {
  name: "remotion-svg",
  async generate({ aspect, outPath, params }) {
    const svg =
      (params?.svg as string) ??
      (params?.svgPath ? readFileSync(params.svgPath as string, "utf8") : undefined);
    if (!svg) {
      throw new Error("remotion-svg needs an authored SVG — pass --svg <file> (or params.svg)");
    }
    const bg = (params?.bg as string) ?? "#f2ead9";
    const [width, height] = DIM[aspect] ?? DIM["1:1"];
    mkdirSync(dirname(outPath), { recursive: true });
    const propsFile = join(dirname(outPath), `.illus-props-${Date.now().toString(36)}.json`);
    writeFileSync(propsFile, JSON.stringify({ svg, bg, width, height }));
    try {
      execFileSync(
        "npx",
        ["remotion", "still", ENTRY, "Illustration", outPath, `--props=${propsFile}`],
        { cwd: repoRoot, stdio: "inherit" }
      );
    } finally {
      rmSync(propsFile, { force: true });
    }
    return { imagePath: outPath, costUsd: 0 };
  },
};
