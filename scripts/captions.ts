import "../src/util/env.js";
import { resolve, dirname, basename, extname, join } from "node:path";
import { burnCaptions, renderAudiogram } from "../src/video/burn-captions.js";

// Burn house-style captions onto any vertical video, or build an audiogram from an audio file:
//   npm run captions -- <video.mp4> [--out <captioned.mp4>]
//   npm run captions -- --audiogram <audio.mp3|wav|m4a> [--out <audiogram.mp4>]
// Alignment is local whisper.cpp ($0); rendering is local Remotion ($0). Sidecars
// (<out>.transcript.txt, <out>.captions.json) are written next to the output.
async function main() {
  const args = process.argv.slice(2);
  const audiogram = args.includes("--audiogram");
  const outIdx = args.indexOf("--out");
  const source = args.find((a, i) => !a.startsWith("--") && (outIdx === -1 || i !== outIdx + 1));
  if (!source) {
    console.error("usage: npm run captions -- <video.mp4> [--out file.mp4] | --audiogram <audio> [--out file.mp4]");
    process.exit(1);
  }
  const src = resolve(source);
  const out = outIdx !== -1 ? resolve(args[outIdx + 1]) : join(dirname(src), `${basename(src, extname(src))}-${audiogram ? "audiogram" : "captioned"}.mp4`);
  const base = out.replace(/\.mp4$/i, "");
  const sidecars = { transcriptPath: `${base}.transcript.txt`, captionsPath: `${base}.captions.json` };
  const result = audiogram
    ? await renderAudiogram({ audioPath: src, outPath: out, ...sidecars })
    : await burnCaptions({ sourcePath: src, outPath: out, ...sidecars });
  console.log(`${audiogram ? "audiogram" : "captioned"}: ${out} (${(result.durationMs / 1000).toFixed(1)}s, ${result.captions.length} words)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
