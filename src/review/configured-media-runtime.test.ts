import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { approveConfiguredMediaStage, executeConfiguredMediaStage } from "./configured-media-runtime.js";

function fixture(media: string, id = "m1") {
  const folder = mkdtempSync(join(tmpdir(), "configured-media-runtime-"));
  mkdirSync(join(folder, "media-stages"));
  writeFileSync(join(folder, "review-queue.md"), `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| ${id} | linkedin | ${media.includes("image") ? "image" : "video"} | media-stages/${id}.json | — | — | — | pending | | from GUI queue |\n`);
  writeFileSync(join(folder, "media-stages", `${id}.json`), JSON.stringify({ version:"configured-media-stage-v1", id, media, status:"staged", stage:"source-approval-required", plan:{kind:"test"}, primitives:["injected"] }));
  return folder;
}

for (const [media, primary] of [["static-quote-card","images/m1.png"],["animated-quote-card","images/m1.mp4"],["short-video-script","video/short.mp4"],["image","configured-media/m1/image.png"],["image-carousel","configured-media/m1/carousel-manifest.json"],["video-caption-package","configured-media/m1/caption-manifest.json"],["audiogram","configured-media/m1/audiogram.mp4"]] as const) {
  test(`${media} requires approval, verifies injected output, then promotes the queue asset`, async () => {
    const folder = fixture(media);
    await assert.rejects(executeConfiguredMediaStage(folder, "m1", async () => ({ primaryAsset: primary, assets:[primary], costUsd:0 })), /not approved/);
    approveConfiguredMediaStage(folder, "m1");
    await assert.rejects(executeConfiguredMediaStage(folder, "m1", async () => ({ primaryAsset: primary, assets:[primary], costUsd:0 })), /did not create/);
    const result = await executeConfiguredMediaStage(folder, "m1", async (_stage, root) => {
      const out = join(root, primary); mkdirSync(dirname(out), { recursive:true }); writeFileSync(out, "verified");
      return { primaryAsset: primary, assets:[primary], costUsd:0 };
    });
    assert.equal(result.primaryAsset, primary);
    assert.match(readFileSync(join(folder,"review-queue.md"),"utf8"), new RegExp(primary.replaceAll("/","\\/")));
    const stage = JSON.parse(readFileSync(join(folder,"media-stages/m1.json"),"utf8"));
    assert.equal(stage.status,"rendered");
  });
}

test("render refuses a plan changed after its explicit approval", async () => {
  const folder = fixture("image");
  approveConfiguredMediaStage(folder, "m1");
  const path = join(folder, "media-stages/m1.json");
  const stage = JSON.parse(readFileSync(path, "utf8")); stage.plan = { kind: "tampered" };
  writeFileSync(path, JSON.stringify(stage));
  await assert.rejects(executeConfiguredMediaStage(folder, "m1", async () => ({ primaryAsset:"x", assets:["x"], costUsd:0 })), /changed after approval/);
});

test("promotion failure checkpoints verified output and retry promotes without rerendering or billing", async () => {
  const folder = fixture("static-quote-card");
  approveConfiguredMediaStage(folder, "m1");
  let renders = 0;
  const renderer = async (_stage: unknown, root: string) => {
    renders++;
    const primary = "images/m1.png";
    const out = join(root, primary); mkdirSync(dirname(out), { recursive:true }); writeFileSync(out, "verified once");
    return { primaryAsset: primary, assets: [primary], costUsd: 1.25 };
  };
  await assert.rejects(
    executeConfiguredMediaStage(folder, "m1", renderer, () => { throw new Error("injected promotion crash"); }),
    /injected promotion crash/,
  );
  assert.equal(renders, 1);
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "promotion-pending");

  const result = await executeConfiguredMediaStage(folder, "m1", renderer);
  assert.equal(renders, 1, "retry must not rerun a renderer or incur provider cost again");
  assert.equal(result.costUsd, 1.25);
  assert.match(readFileSync(join(folder, "review-queue.md"), "utf8"), /images\/m1\.png/);
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "rendered");
});
