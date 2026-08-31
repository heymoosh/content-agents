import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { approveConfiguredMediaStage, attachReviewedConfiguredMediaFiles, executeConfiguredMediaStage } from "./configured-media-runtime.js";
import { tryAcquireFileLease } from "../runtime/file-lock.js";

const IMAGE_BYTES = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]),
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01]),
  gif: Buffer.from("GIF89a1"),
  webp: Buffer.from("RIFF\u0004\u0000\u0000\u0000WEBPx"),
} as const;

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

test("an approved image stage attaches one reviewed in-folder image through the render checkpoint", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/codex-art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");

  const result = await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/codex-art.png"]);

  assert.deepEqual(result, {
    primaryAsset: "configured-media/m1/image.png",
    assets: ["configured-media/m1/image.png"],
    costUsd: 0,
  });
  assert.deepEqual(readFileSync(join(folder, result.primaryAsset)), IMAGE_BYTES.png);
  const stage = JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8"));
  assert.equal(stage.status, "rendered");
  assert.equal(stage.rendered.manifestPath, "configured-media/m1/render-manifest.json");
  const manifest = JSON.parse(readFileSync(join(folder, stage.rendered.manifestPath), "utf8"));
  assert.equal(manifest.version, "configured-media-render-v1");
  assert.equal(manifest.approvalDigest, stage.approval.digest);
  assert.match(readFileSync(join(folder, "review-queue.md"), "utf8"), /configured-media\/m1\/image\.png/);
});

test("an approved carousel preserves reviewed slide order and writes both carousel and render manifests", async () => {
  const folder = fixture("image-carousel");
  const stagePath = join(folder, "media-stages/m1.json");
  const staged = JSON.parse(readFileSync(stagePath, "utf8"));
  staged.plan = { kind: "carousel-slide-plan", slides: ["one", "two"] };
  writeFileSync(stagePath, JSON.stringify(staged));
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/slide-1.png"), IMAGE_BYTES.png);
  writeFileSync(join(folder, "reviewed/slide-2.jpg"), IMAGE_BYTES.jpg);
  approveConfiguredMediaStage(folder, "m1");

  const result = await attachReviewedConfiguredMediaFiles(folder, "m1", [
    "reviewed/slide-1.png",
    "reviewed/slide-2.jpg",
  ]);

  assert.equal(result.primaryAsset, "configured-media/m1/carousel-manifest.json");
  assert.deepEqual(result.assets, [
    "configured-media/m1/carousel-manifest.json",
    "configured-media/m1/slide-1.png",
    "configured-media/m1/slide-2.jpg",
  ]);
  assert.deepEqual(JSON.parse(readFileSync(join(folder, result.primaryAsset), "utf8")), {
    version: "configured-carousel-v1",
    slides: result.assets.slice(1),
  });
  assert.deepEqual(readFileSync(join(folder, result.assets[1])), IMAGE_BYTES.png);
  assert.deepEqual(readFileSync(join(folder, result.assets[2])), IMAGE_BYTES.jpg);
});

test("reviewed-file attachment rejects unapproved, changed, non-image, unsafe, and malformed inputs", async () => {
  const folder = fixture("image-carousel");
  const stagePath = join(folder, "media-stages/m1.json");
  const staged = JSON.parse(readFileSync(stagePath, "utf8"));
  staged.plan = { kind: "carousel-slide-plan", slides: ["one", "two"] };
  writeFileSync(stagePath, JSON.stringify(staged));
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/slide-1.png"), IMAGE_BYTES.png);
  writeFileSync(join(folder, "reviewed/slide-2.png"), IMAGE_BYTES.png);
  writeFileSync(join(folder, "reviewed/empty.png"), "");
  writeFileSync(join(folder, "reviewed/not-image.txt"), IMAGE_BYTES.png);
  mkdirSync(join(folder, "reviewed/directory.png"));
  symlinkSync(join(folder, "reviewed/slide-1.png"), join(folder, "reviewed/link.png"));
  const outside = mkdtempSync(join(tmpdir(), "configured-media-outside-"));
  writeFileSync(join(outside, "escaped.png"), "outside");
  symlinkSync(outside, join(folder, "reviewed/linked-directory"));

  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-1.png", "reviewed/slide-2.png"]), /not approved/);
  approveConfiguredMediaStage(folder, "m1");
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["../outside.png", "reviewed/slide-2.png"]), /unsafe/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/link.png", "reviewed/slide-2.png"]), /symlink/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/linked-directory/escaped.png", "reviewed/slide-2.png"]), /outside|symlink/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/directory.png", "reviewed/slide-2.png"]), /regular file/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/empty.png", "reviewed/slide-2.png"]), /empty/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/not-image.txt", "reviewed/slide-2.png"]), /image file/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-1.png"]), /exactly 2/);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-2.png", "reviewed/slide-1.png"]), /slide order/);

  const changed = JSON.parse(readFileSync(stagePath, "utf8"));
  changed.plan.slides[0] = "changed";
  writeFileSync(stagePath, JSON.stringify(changed));
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/slide-1.png", "reviewed/slide-2.png"]), /changed after approval/);
});

test("reviewed-file attachment rejects non-image stages", async () => {
  const folder = fixture("short-video-script");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/frame.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/frame.png"]), /only image and image-carousel/);
});

test("attachment promotion retry uses its checkpoint without copying reviewed files again", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");

  await assert.rejects(
    attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"], () => { throw new Error("injected promotion crash"); }),
    /injected promotion crash/,
  );
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "promotion-pending");
  writeFileSync(join(folder, "reviewed/art.png"), Buffer.concat([IMAGE_BYTES.png, Buffer.from("changed source") ]));

  const result = await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]);
  assert.deepEqual(readFileSync(join(folder, result.primaryAsset)), IMAGE_BYTES.png);
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "rendered");
  assert.ok(existsSync(join(folder, "configured-media/m1/render-manifest.json")));
});

test("reviewed attachment promotion and retry identify attachment provenance instead of provider rendering", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  const notes: string[] = [];

  await assert.rejects(
    attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"], (_folder, _id, update) => {
      notes.push(update.notes);
      throw new Error("promotion interrupted");
    }),
    /promotion interrupted/,
  );
  await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"], (_folder, _id, update) => {
    notes.push(update.notes);
    return true;
  });

  assert.equal(notes.length, 2);
  assert.match(notes[0], /^Attached reviewed image; manifest /);
  assert.equal(notes[1], notes[0], "retry must retain the checkpointed attachment provenance");
  assert.doesNotMatch(notes[0], /^Rendered /);
});

test("reviewed attachments validate image magic bytes against png, jpeg, webp, and gif extensions", async () => {
  for (const [extension, bytes] of Object.entries(IMAGE_BYTES)) {
    const folder = fixture("image", extension);
    mkdirSync(join(folder, "reviewed"));
    const fileExtension = extension === "jpg" ? "jpeg" : extension;
    writeFileSync(join(folder, `reviewed/art.${fileExtension}`), bytes);
    approveConfiguredMediaStage(folder, extension);
    const result = await attachReviewedConfiguredMediaFiles(folder, extension, [`reviewed/art.${fileExtension}`]);
    assert.equal(result.primaryAsset, `configured-media/${extension}/image.${fileExtension}`);
  }

  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/spoofed.png"), Buffer.from("not actually a png"));
  writeFileSync(join(folder, "reviewed/mismatched.png"), IMAGE_BYTES.jpg);
  approveConfiguredMediaStage(folder, "m1");
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/spoofed.png"]), /image bytes.*extension/i);
  await assert.rejects(attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/mismatched.png"]), /image bytes.*extension/i);
});

test("a concurrent attachment and production render serialize per stage so paid rendering cannot duplicate work", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  let renders = 0;
  let releaseRenderer!: () => void;
  const rendererBlocked = new Promise<void>((resolve) => { releaseRenderer = resolve; });
  let markRendererStarted!: () => void;
  const rendererStarted = new Promise<void>((resolve) => { markRendererStarted = resolve; });
  const renderPromise = executeConfiguredMediaStage(folder, "m1", async (_stage, root) => {
    renders++;
    markRendererStarted();
    await rendererBlocked;
    const output = join(root, "configured-media/m1/provider.png");
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, IMAGE_BYTES.png);
    return { primaryAsset: "configured-media/m1/provider.png", assets: ["configured-media/m1/provider.png"], costUsd: 2 };
  });
  await rendererStarted;
  const attachmentPromise = attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]);
  releaseRenderer();
  const [render, attachment] = await Promise.allSettled([renderPromise, attachmentPromise]);

  assert.equal(render.status, "fulfilled");
  assert.equal(attachment.status, "rejected");
  assert.equal(renders, 1, "only the already-started paid provider call may run");
  assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "rendered");
});

test("a cross-process stage lease rejects contention before attachment or paid rendering starts", async () => {
  const folder = fixture("image");
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "reviewed/art.png"), IMAGE_BYTES.png);
  approveConfiguredMediaStage(folder, "m1");
  const lease = tryAcquireFileLease(join(folder, "media-stages/.locks/m1.execute.lock"));
  assert.ok(lease);
  let renders = 0;
  try {
    await assert.rejects(
      attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]),
      /already executing in another process/,
    );
    await assert.rejects(
      executeConfiguredMediaStage(folder, "m1", async () => {
        renders++;
        return { primaryAsset: "never.png", assets: ["never.png"], costUsd: 5 };
      }),
      /already executing in another process/,
    );
    assert.equal(renders, 0);
    assert.equal(JSON.parse(readFileSync(join(folder, "media-stages/m1.json"), "utf8")).status, "approved");
  } finally {
    lease.release();
  }

  const attached = await attachReviewedConfiguredMediaFiles(folder, "m1", ["reviewed/art.png"]);
  assert.equal(attached.primaryAsset, "configured-media/m1/image.png");
});
