import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { burnCaptions, renderAudiogram, transcriptFromCaptions, type BurnCaptionsDeps, type AnimatedShortRenderProps } from "./burn-captions.js";
import type { CharTs } from "./align.js";

function chars(text: string, msPerChar = 50): CharTs[] {
  return [...text].map((char, i) => ({ char, startMs: i * msPerChar, endMs: (i + 1) * msPerChar }));
}

function deps(over: Partial<BurnCaptionsDeps> & { probeSize?: [number, number]; text?: string } = {}) {
  const calls: { rendered?: AnimatedShortRenderProps; alignedPath?: string } = {};
  const [w, h] = over.probeSize ?? [1080, 1920];
  const d: BurnCaptionsDeps = {
    probe: over.probe ?? (() => ({ width: w, height: h, durationMs: 6810 })),
    align: over.align ?? (async (p) => { calls.alignedPath = p; return chars(over.text ?? "hello brave world"); }),
    render: over.render ?? (async (props, _src, out) => { calls.rendered = props; writeFileSync(out, "mp4"); }),
  };
  return { d, calls };
}

test("burns word captions from one alignment pass and writes sidecars", async () => {
  const dir = mkdtempSync(join(tmpdir(), "burn-"));
  const src = join(dir, "clip.mp4"); writeFileSync(src, "x");
  const { d, calls } = deps();
  const out = join(dir, "clip-captioned.mp4");
  const result = await burnCaptions({ sourcePath: src, outPath: out, transcriptPath: join(dir, "t.txt"), captionsPath: join(dir, "c.json") }, d);
  assert.equal(calls.alignedPath, src);
  assert.equal(result.captions.length, 3);
  assert.equal(result.transcript, "hello brave world");
  assert.equal(result.durationMs, 6810);
  assert.equal(calls.rendered?.audio, "", "the clip's own audio track plays; nothing is extracted");
  assert.deepEqual(calls.rendered?.clipFrames, [Math.ceil(6.81 * 30)]);
  assert.equal(calls.rendered?.durationMs, 6810, "duration comes from ffprobe, not the last caption");
  assert.equal(readFileSync(join(dir, "t.txt"), "utf8"), "hello brave world\n");
  assert.equal(JSON.parse(readFileSync(join(dir, "c.json"), "utf8")).length, 3);
  assert.ok(existsSync(out));
});

test("refuses landscape input instead of cropping it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "burn-"));
  const src = join(dir, "wide.mp4"); writeFileSync(src, "x");
  const { d } = deps({ probeSize: [1920, 1080] });
  await assert.rejects(burnCaptions({ sourcePath: src, outPath: join(dir, "o.mp4") }, d), /1920x1080.*portrait/);
});

test("refuses non-video sources, missing files, and silent clips", async () => {
  const dir = mkdtempSync(join(tmpdir(), "burn-"));
  const { d } = deps({ text: "   " });
  await assert.rejects(burnCaptions({ sourcePath: join(dir, "nope.mp4"), outPath: join(dir, "o.mp4") }, d), /missing source video/);
  const png = join(dir, "still.png"); writeFileSync(png, "x");
  await assert.rejects(burnCaptions({ sourcePath: png, outPath: join(dir, "o.mp4") }, d), /need a video file/);
  const src = join(dir, "quiet.mp4"); writeFileSync(src, "x");
  await assert.rejects(burnCaptions({ sourcePath: src, outPath: join(dir, "o.mp4") }, d), /no spoken words/);
});

test("fails when the renderer produced no file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "burn-"));
  const src = join(dir, "clip.mp4"); writeFileSync(src, "x");
  const { d } = deps({ render: async () => {} });
  await assert.rejects(burnCaptions({ sourcePath: src, outPath: join(dir, "o.mp4") }, d), /produced no file/);
});

test("audiogram draws a waveform clip then burns the same captions over it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "burn-"));
  const audio = join(dir, "talk.wav"); writeFileSync(audio, "x");
  const { d, calls } = deps();
  let waveformArgs: [string, string] | undefined;
  const out = join(dir, "audiogram.mp4");
  const result = await renderAudiogram({ audioPath: audio, outPath: out }, { ...d, waveform: (a, clip) => { waveformArgs = [a, clip]; writeFileSync(clip, "clip"); } });
  assert.deepEqual(waveformArgs, [audio, join(dir, "audiogram-waveform.mp4")]);
  assert.equal(calls.alignedPath, join(dir, "audiogram-waveform.mp4"));
  assert.ok(!existsSync(join(dir, "audiogram-waveform.mp4")), "intermediate waveform clip is cleaned up");
  assert.equal(result.captions.length, 3);
  assert.ok(existsSync(out));
});

test("transcriptFromCaptions joins trimmed words", () => {
  assert.equal(transcriptFromCaptions([{ text: "a", startMs: 0, endMs: 1, timestampMs: 0, confidence: 1 }, { text: " b", startMs: 1, endMs: 2, timestampMs: 1, confidence: 1 }]), "a b");
});
