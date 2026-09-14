import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { readSignalsPerformance } from "./signals-performance.js";

test("performance uses one latest identity-matched snapshot per post, not cumulative snapshots or other brands", () => {
  const db = new Database(":memory:");
  try {
    db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
    db.exec(`INSERT INTO posts (id,platform,posted_at,content_text,pillar,format,brand_id,provider_account_id) VALUES
      (1,'bluesky','2026-09-01','A real post','civic-tech','text','human-inference','one'),
      (2,'bluesky','2026-09-02','No metrics',NULL,'text','human-inference','one'),
      (3,'bluesky','2026-09-03','Other brand',NULL,'text','charles','two'),
      (4,'bluesky','2026-09-04','Unassigned',NULL,'text',NULL,NULL);
      INSERT INTO metrics (post_id,captured_at,impressions,replies,brand_id,provider_account_id) VALUES
      (1,'2026-09-02',20,4,'human-inference','one'),
      (1,'2026-09-03',30,0,'human-inference','one'),
      (1,'2026-09-04',999,999,'human-inference','wrong-account'),
      (3,'2026-09-04',999,999,'charles','two');`);
    const r = readSignalsPerformance(db, "human-inference");
    assert.equal(r.posts, 2);
    assert.equal(r.measuredPosts, 1);
    assert.equal(r.latestCapture, "2026-09-03");
    assert.equal(r.platforms[0].impressions.value, 30);
    assert.equal(r.platforms[0].replies.value, 0);
    assert.equal(r.platforms[0].replies.measured, 1);
    assert.equal(r.platforms[0].examples[0].text, "A real post");
    assert.equal(r.platforms[0].topics[0].label, "civic-tech");
    assert.equal(r.excludedUnassigned, 1);
    assert.equal(readSignalsPerformance(db, "fiction").posts, 0);
    const other = readSignalsPerformance(db, "charles");
    assert.equal(other.platforms[0].impressions.value, 999);
  } finally { db.close(); }
});

test("missing measurements stay unknown, and period uses post dates rather than brief dates", () => {
  const db = new Database(":memory:");
  try {
    db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
    db.exec(`INSERT INTO posts (platform,posted_at,brand_id) VALUES ('x','2026-08-01','human-inference')`);
    const r = readSignalsPerformance(db, "human-inference");
    assert.equal(r.firstPost, "2026-08-01");
    assert.equal(r.latestCapture, null);
    assert.equal(r.platforms[0].replies.value, null);
    assert.deepEqual(r.platforms[0].examples, []);
  } finally { db.close(); }
});
