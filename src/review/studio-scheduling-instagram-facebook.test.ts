import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultPublishPostiz } from "./studio-scheduling.js";
import { claimSlots, readLedger } from "../publish/slots.js";
import { resolveDeliveryPolicy } from "../publish/delivery-policy.js";
import type { QueueRow } from "../publish/queue.js";
import type { PostizCapability } from "../publish/postiz.js";

// SLICE-8A. Proves config/platforms.yaml's instagram/facebook cadence entries actually drive the
// unified scheduler (src/publish/slots.ts loadSchedule() reads config/platforms.yaml directly —
// nothing here stubs it), and that an approved quote-card:instagram / quote-card:facebook row
// dispatches through Postiz with the source CTA placed. Before those two entries existed,
// loadSchedule()[destination] was undefined, claimSlots returned "next-free-slot" for both, and
// defaultPublishPostiz threw "Postiz requires an explicit future slot" instead of resolving a real
// Tue/Wed/Thu 12:00 PT time — every assertion below would have failed.

function isolatedLedger(): { root: string; restore: () => void } {
  const root = mkdtempSync(join(tmpdir(), "studio-ig-fb-ledger-"));
  const prev = process.env.CONTENT_AGENTS_TEST_LEDGER;
  process.env.CONTENT_AGENTS_TEST_LEDGER = join(root, "publish-schedule.jsonl");
  return {
    root,
    restore: () => {
      if (prev === undefined) delete process.env.CONTENT_AGENTS_TEST_LEDGER;
      else process.env.CONTENT_AGENTS_TEST_LEDGER = prev;
      rmSync(root, { recursive: true, force: true });
    },
  };
}

// PT weekday/time of an ISO instant, read the same way the scheduler itself reasons about "PT day".
function ptWeekdayAndTime(iso: string): { weekday: string; time: string } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { weekday: String(parts.weekday), time: `${parts.hour}:${parts.minute}` };
}

for (const destination of ["instagram", "facebook"] as const) {
  test(`${destination} card cadence claims a Tue/Wed/Thu 12:00 PT slot, one per PT day`, () => {
    const { restore } = isolatedLedger();
    try {
      const { times } = claimSlots({ windowKey: destination, conflictPlatforms: [destination], count: 3, asset: "images/quote-card-1.png", by: "test" });
      assert.equal(times.length, 3, `${destination} must resolve a real cadence, not "next-free-slot"`);
      const seenDays = new Set<string>();
      for (const iso of times) {
        const { weekday, time } = ptWeekdayAndTime(iso);
        assert.ok(["Tue", "Wed", "Thu"].includes(weekday), `${destination} slot ${iso} landed on ${weekday}, not Tue/Wed/Thu`);
        assert.equal(time, "12:00", `${destination} slot ${iso} landed at ${time} PT, not 12:00`);
        assert.ok(!seenDays.has(weekday + iso.slice(0, 10)), "no two claimed slots share a PT calendar day");
        seenDays.add(weekday + iso.slice(0, 10));
      }
    } finally {
      restore();
    }
  });
}

function cardFolder(destination: "instagram" | "facebook"): string {
  const root = mkdtempSync(join(tmpdir(), `studio-${destination}-card-`));
  mkdirSync(join(root, "derivatives"), { recursive: true });
  mkdirSync(join(root, "images"), { recursive: true });
  writeFileSync(join(root, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
  writeFileSync(
    join(root, "source.md"),
    "---\ntitle: \"The world's broken. What do we do?\"\ncanonical_url: https://example.substack.com/p/the-worlds-broken\n---\nBody.\n",
  );
  writeFileSync(
    join(root, "derivatives", `quote-card-1-${destination}.md`),
    [
      "---",
      `platform: ${destination}`,
      "source_lines: [222, 224, 230, 234]",
      "content_type: [society_capitalism_piece, essay_excerpt]",
      "thread_check: pass",
      "cta: source",
      'cta_label: "Full essay (free to subscribe):"',
      "---",
      "Movements that organize only around fear, guilt, anger, and opposition eventually exhaust people.",
      "",
    ].join("\n"),
  );
  writeFileSync(join(root, "images", "quote-card-1.png"), "png-bytes");
  writeFileSync(
    join(root, "review-queue.md"),
    [
      "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |",
      "|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|",
      `| quote-card-1-${destination} | quote-card:${destination} | image | images/quote-card-1.png | 5 | 5 | true | approve | | from test |`,
      "",
    ].join("\n"),
  );
  return root;
}

function fakeTransport(createdBodies: Record<string, unknown>[]) {
  let uploads = 0;
  return {
    async request(path: string, init?: { method?: string; body?: unknown }) {
      if (init?.method === "POST" && path.endsWith("/upload")) {
        uploads += 1;
        return { id: `media-${uploads}`, path: `/uploads/media-${uploads}.png` };
      }
      if (init?.method === "POST" && path.endsWith("/posts")) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        createdBodies.push(body);
        return [{ postId: `pz-${createdBodies.length}` }];
      }
      throw new Error(`unexpected request ${String(init?.method)} ${path}`);
    },
  };
}

// Every env var the Postiz dispatch path can write through — matches ENV_KEYS in
// studio-scheduling-postiz-reuse.test.ts. Without CONTENT_AGENTS_TEST_BETS_PATH isolated,
// appendBetPlacement() (src/publish/queue.ts betsPath()) falls back to Muxin's real
// briefs/human-inference/bets.md and this test would append fake Placed-log rows there.
const DISPATCH_ENV_KEYS = ["CONTENT_AGENTS_TEST_BETS_PATH", "CONTENT_AGENTS_POSTIZ_ACCOUNT_ID"] as const;

for (const destination of ["instagram", "facebook"] as const) {
  test(`an approved quote-card:${destination} row dispatches through Postiz with the source CTA placed`, async () => {
    const root = cardFolder(destination);
    const { restore } = isolatedLedger();
    const saved: Record<string, string | undefined> = {};
    for (const k of DISPATCH_ENV_KEYS) saved[k] = process.env[k];
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = join(root, "bets.md");
    process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH, "# Placed log\n");
    try {
      const policy = resolveDeliveryPolicy(root, "postiz");
      assert.equal(policy.mode, "provider");
      const capability: PostizCapability = { destination, media: ["image"], accountId: "acct-1", accountLabel: "Human Inference" };
      const row: QueueRow = {
        id: `quote-card-1-${destination}`, platform: `quote-card:${destination}`, format: "image",
        asset: "images/quote-card-1.png", status: "approve", notes: "", lineIndex: 1,
      };
      const createdBodies: Record<string, unknown>[] = [];
      const result = await defaultPublishPostiz(root, row, capability, policy, () => fakeTransport(createdBodies)) as {
        platform: string; when: string; providerObjectId: string;
      };
      assert.equal(result.platform, destination);
      assert.match(result.when, /^(Tue|Wed|Thu),.*12:00 PM PT$/);
      assert.equal(createdBodies.length, 1);
      const posted = createdBodies[0] as { posts: Array<{ value: Array<{ content: string; image: unknown[] }> }> };
      const value = posted.posts[0].value[0];
      assert.ok(
        value.content.includes("https://example.substack.com/p/the-worlds-broken"),
        `${destination} post body must place the source CTA inline: ${value.content}`,
      );
      assert.equal(value.image.length, 1, "the rendered card image was uploaded and attached");
      const ledgerClaims = readLedger();
      assert.ok(ledgerClaims.some((c) => c.platform === destination), "the claimed slot is recorded in the shared ledger");
    } finally {
      for (const k of DISPATCH_ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      restore();
      rmSync(root, { recursive: true, force: true });
    }
  });
}
