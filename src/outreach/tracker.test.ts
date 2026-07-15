import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { loadOutreachConfig, type OutreachConfig } from "./config.js";
import {
  appendTrackerEvent,
  readTrackerEvents,
  foldLeadEvents,
  nextActionLabel,
  buildClientPlatformRows,
  buildInboundRows,
  buildJobsearchRows,
  markResponded,
  markContacted,
  moveOn,
  type TrackerEvent,
} from "./tracker.js";

const CONFIG: OutreachConfig = loadOutreachConfig();

function tmpFile(name: string): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "tracker-test-"));
  return { dir, path: join(dir, name) };
}

describe("appendTrackerEvent / readTrackerEvents", () => {
  test("round-trips one event through the injectable path", () => {
    const { dir, path } = tmpFile("tracker.jsonl");
    try {
      const event: TrackerEvent = { ts: "2026-07-10T12:00:00.000Z", lead: "client-acme-co", bucket: "client", event: "contacted", channel: "email" };
      appendTrackerEvent(event, path);
      assert.deepEqual(readTrackerEvents(path), [event]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates the parent directory if it doesn't exist yet", () => {
    const dir = mkdtempSync(join(tmpdir(), "tracker-test-"));
    const path = join(dir, "nested", "tracker.jsonl");
    try {
      appendTrackerEvent({ ts: "2026-07-10T12:00:00.000Z", lead: "x", bucket: "client", event: "contacted" }, path);
      assert.ok(existsSync(path));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns [] for a path that doesn't exist", () => {
    assert.deepEqual(readTrackerEvents(join(tmpdir(), "does-not-exist-tracker.jsonl")), []);
  });

  test("skips an unparseable line instead of throwing", () => {
    const { dir, path } = tmpFile("tracker.jsonl");
    try {
      writeFileSync(path, 'not json\n{"ts":"2026-07-10T12:00:00.000Z","lead":"x","bucket":"client","event":"contacted"}\n');
      const events = readTrackerEvents(path);
      assert.equal(events.length, 1);
      assert.equal(events[0].lead, "x");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("appends multiple events across calls", () => {
    const { dir, path } = tmpFile("tracker.jsonl");
    try {
      appendTrackerEvent({ ts: "2026-07-01T00:00:00.000Z", lead: "x", bucket: "client", event: "contacted" }, path);
      appendTrackerEvent({ ts: "2026-07-05T00:00:00.000Z", lead: "x", bucket: "client", event: "responded" }, path);
      assert.equal(readTrackerEvents(path).length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("foldLeadEvents: due-date / overdue math", () => {
  test("no events at all -> not_contacted, no due dates", () => {
    const state = foldLeadEvents("client-acme-co", "client", [], CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "not_contacted");
    assert.equal(state.dueDate, null);
    assert.equal(state.abandonDate, null);
    assert.equal(state.lastEvent, null);
  });

  test("contacted, well within the follow-up window -> waiting", () => {
    // client bucket: follow_up_after_days=7, abandon_after_days=30
    const events: TrackerEvent[] = [{ ts: "2026-07-10T00:00:00.000Z", lead: "client-acme-co", bucket: "client", event: "contacted" }];
    const state = foldLeadEvents("client-acme-co", "client", events, CONFIG, "2026-07-12T00:00:00.000Z");
    assert.equal(state.status, "waiting");
    assert.equal(state.dueDate, "2026-07-17");
    assert.equal(state.abandonDate, "2026-08-09");
  });

  test("contacted, past follow_up_after_days but before abandon_after_days -> due", () => {
    const events: TrackerEvent[] = [{ ts: "2026-07-01T00:00:00.000Z", lead: "client-acme-co", bucket: "client", event: "contacted" }];
    const state = foldLeadEvents("client-acme-co", "client", events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "due");
  });

  test("contacted, past abandon_after_days -> overdue", () => {
    const events: TrackerEvent[] = [{ ts: "2026-06-01T00:00:00.000Z", lead: "client-acme-co", bucket: "client", event: "contacted" }];
    const state = foldLeadEvents("client-acme-co", "client", events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "overdue");
  });

  test("platform bucket uses its own, wider windows (10 / 45 days)", () => {
    const events: TrackerEvent[] = [{ ts: "2026-07-01T00:00:00.000Z", lead: "platform-x", bucket: "platform", event: "contacted" }];
    // 9 days out: client would already be "due" (7d), platform should still be "waiting" (10d)
    const state = foldLeadEvents("platform-x", "platform", events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "waiting");
  });

  test("an event-supplied `due` overrides the computed date", () => {
    const events: TrackerEvent[] = [{ ts: "2026-07-01T00:00:00.000Z", lead: "x", bucket: "client", event: "contacted", due: "2026-07-02" }];
    const state = foldLeadEvents("x", "client", events, CONFIG, "2026-07-03T00:00:00.000Z");
    assert.equal(state.dueDate, "2026-07-02");
    assert.equal(state.status, "due");
  });

  test("most recent event wins: contacted then responded -> responded, no due-date pressure", () => {
    const events: TrackerEvent[] = [
      { ts: "2026-06-01T00:00:00.000Z", lead: "x", bucket: "client", event: "contacted" },
      { ts: "2026-07-01T00:00:00.000Z", lead: "x", bucket: "client", event: "responded" },
    ];
    const state = foldLeadEvents("x", "client", events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "responded");
    assert.equal(state.dueDate, null);
    assert.equal(state.abandonDate, null);
  });

  test("events out of insertion order are still folded by ts, not array order", () => {
    const events: TrackerEvent[] = [
      { ts: "2026-07-01T00:00:00.000Z", lead: "x", bucket: "client", event: "responded" },
      { ts: "2026-06-01T00:00:00.000Z", lead: "x", bucket: "client", event: "contacted" },
    ];
    const state = foldLeadEvents("x", "client", events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "responded"); // the later ts (responded) wins, despite coming first in the array
  });

  test("abandoned -> abandoned, no due-date pressure", () => {
    const events: TrackerEvent[] = [{ ts: "2026-07-01T00:00:00.000Z", lead: "x", bucket: "client", event: "abandoned" }];
    const state = foldLeadEvents("x", "client", events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "abandoned");
    assert.equal(state.dueDate, null);
  });

  test("re_researched resets a lead back to not_contacted", () => {
    const events: TrackerEvent[] = [
      { ts: "2026-06-01T00:00:00.000Z", lead: "x", bucket: "client", event: "abandoned" },
      { ts: "2026-07-01T00:00:00.000Z", lead: "x", bucket: "client", event: "re_researched" },
    ];
    const state = foldLeadEvents("x", "client", events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(state.status, "not_contacted");
  });
});

describe("nextActionLabel: no CRM aesthetics, no guilt-styling", () => {
  test("every status renders plain, non-alarming copy", () => {
    const base = { lead: "x", bucket: "client" as const, lastEvent: null, lastTouch: null };
    const cases: Array<[Parameters<typeof nextActionLabel>[0]["status"], string | null, string | null]> = [
      ["not_contacted", null, null],
      ["waiting", "2026-07-17", "2026-08-09"],
      ["due", "2026-07-17", "2026-08-09"],
      ["overdue", "2026-07-17", "2026-08-09"],
      ["responded", null, null],
      ["scheduled", null, null],
      ["done", null, null],
      ["abandoned", null, null],
    ];
    for (const [status, dueDate, abandonDate] of cases) {
      const label = nextActionLabel({ ...base, status, dueDate, abandonDate });
      assert.ok(label.length > 0);
      // Explicit anti-pattern check (backlog 659b50f0): no shouty/guilt-inducing copy anywhere.
      assert.ok(!/overdue!|failed|guilt|urgent|alert/i.test(label), `unexpectedly alarming copy for ${status}: "${label}"`);
    }
  });
});

const LEAD_HEADER = (name: string, pitchAngle: string) =>
  ["---", "kind: client", `name: "${name}"`, "url: https://example.com", "source: manual", "status: locked", "classification: greenfield", `pitch_angle: "${pitchAngle}"`, "---"].join("\n");

function writeLead(leadsRoot: string, dirName: string, opts: { pitchAngle?: string; lockedMessage?: boolean; messageChannel?: string } = {}): void {
  const leadDir = join(leadsRoot, dirName);
  mkdirSync(leadDir, { recursive: true });
  writeFileSync(join(leadDir, "lead.md"), `${LEAD_HEADER(dirName, opts.pitchAngle ?? "the angle")}\n\n## Profile\n\ntext\n`);
  if (opts.lockedMessage) {
    mkdirSync(join(leadDir, "messages"), { recursive: true });
    writeFileSync(
      join(leadDir, "messages", "message-01.md"),
      `---\nlead: ${dirName}\nchannel: ${opts.messageChannel ?? "email"}\nevidence: [E1]\nclassification: greenfield\nstatus: locked\nlocked_at: 2026-07-01\n---\n\nbody\n`,
    );
  }
}

describe("buildClientPlatformRows", () => {
  let dir: string;
  let leadsRoot: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tracker-leads-test-"));
    leadsRoot = join(dir, "leads");
    mkdirSync(leadsRoot, { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("includes a locked lead with no tracker event yet as 'not yet contacted'", () => {
    writeLead(leadsRoot, "client-acme-co", { lockedMessage: true, pitchAngle: "the honest angle" });
    const rows = buildClientPlatformRows("client", [], CONFIG, leadsRoot, "2026-07-10T00:00:00.000Z");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].who, "client-acme-co");
    assert.equal(rows[0].why, "the honest angle");
    assert.equal(rows[0].status, "not_contacted");
    assert.equal(rows[0].channel, "email");
    assert.equal(rows[0].dir, "outreach/leads/client-acme-co");
  });

  test("excludes a lead with neither a locked message nor a tracker event (still mid-pipeline)", () => {
    writeLead(leadsRoot, "client-notyet", { lockedMessage: false });
    const rows = buildClientPlatformRows("client", [], CONFIG, leadsRoot, "2026-07-10T00:00:00.000Z");
    assert.equal(rows.length, 0);
  });

  test("includes a lead with a tracker event even without a locked message on disk", () => {
    writeLead(leadsRoot, "client-tracked", { lockedMessage: false });
    const events: TrackerEvent[] = [{ ts: "2026-07-01T00:00:00.000Z", lead: "client-tracked", bucket: "client", event: "contacted" }];
    const rows = buildClientPlatformRows("client", events, CONFIG, leadsRoot, "2026-07-10T00:00:00.000Z");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "due");
  });

  test("only picks up folders for the requested kind", () => {
    writeLead(leadsRoot, "client-acme-co", { lockedMessage: true });
    writeLead(leadsRoot, "platform-lenny-pod", { lockedMessage: true });
    const clientRows = buildClientPlatformRows("client", [], CONFIG, leadsRoot, "2026-07-10T00:00:00.000Z");
    const platformRows = buildClientPlatformRows("platform", [], CONFIG, leadsRoot, "2026-07-10T00:00:00.000Z");
    assert.deepEqual(clientRows.map((r) => r.lead), ["client-acme-co"]);
    assert.deepEqual(platformRows.map((r) => r.lead), ["platform-lenny-pod"]);
  });

  test("returns [] when the leads root doesn't exist", () => {
    const rows = buildClientPlatformRows("client", [], CONFIG, join(dir, "nope"), "2026-07-10T00:00:00.000Z");
    assert.deepEqual(rows, []);
  });
});

describe("buildInboundRows", () => {
  test("empty when no bucket:inbound events exist (schema-ready, empty until db22283f lands)", () => {
    assert.deepEqual(buildInboundRows([], CONFIG, "2026-07-10T00:00:00.000Z"), []);
  });

  test("folds an inbound event into a row once one exists", () => {
    const events: TrackerEvent[] = [{ ts: "2026-07-01T00:00:00.000Z", lead: "some-commenter", bucket: "inbound", event: "contacted" }];
    const rows = buildInboundRows(events, CONFIG, "2026-07-02T00:00:00.000Z");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].lead, "some-commenter");
    assert.equal(rows[0].bucket, "inbound");
  });
});

describe("buildJobsearchRows: degrades gracefully without JSA_DB_PATH", () => {
  let savedEnv: string | undefined;
  beforeEach(() => {
    savedEnv = process.env.JSA_DB_PATH;
    delete process.env.JSA_DB_PATH;
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.JSA_DB_PATH;
    else process.env.JSA_DB_PATH = savedEnv;
  });

  test("returns an empty bucket + a clear note instead of throwing", () => {
    const result = buildJobsearchRows([], CONFIG, "2026-07-10T00:00:00.000Z");
    assert.deepEqual(result.rows, []);
    assert.ok(result.note && /JSA_DB_PATH/.test(result.note));
  });
});

function makeJsaDb(dbPath: string, rows: Array<{ company_name: string; verdict: string; persona?: string; founder_persona?: string }>): void {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE manual_research (
      company_name TEXT, domain TEXT, verdict TEXT,
      remote_score INTEGER, remote_notes TEXT, parental_leave_score INTEGER, parental_leave_notes TEXT,
      pm_hiring_score INTEGER, pm_hiring_notes TEXT, red_flags_score INTEGER, red_flags_notes TEXT,
      salary_score INTEGER, salary_notes TEXT, culture_score INTEGER, culture_notes TEXT,
      japan_hsp TEXT, japan_hsp_notes TEXT, sources TEXT, researched_date TEXT,
      async_score INTEGER, async_notes TEXT, other_benefits_score INTEGER, other_benefits_notes TEXT,
      pm_role_quality_score INTEGER, pm_role_quality_notes TEXT, job_protection_score INTEGER, job_protection_notes TEXT,
      work_life_balance_score INTEGER, work_life_balance_notes TEXT, hiring_signals_score INTEGER, hiring_signals_notes TEXT,
      persona TEXT, founder_persona TEXT
    );
  `);
  const insert = db.prepare(
    `INSERT INTO manual_research (company_name, domain, verdict, researched_date, persona, founder_persona) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    insert.run(r.company_name, "", r.verdict, "2026-07-01", r.persona ?? "", r.founder_persona ?? "");
  }
  db.close();
}

describe("buildJobsearchRows: joins JSA TARGET verdicts against tracker events", () => {
  let dir: string;
  let savedEnv: string | undefined;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tracker-jsa-test-"));
    savedEnv = process.env.JSA_DB_PATH;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (savedEnv === undefined) delete process.env.JSA_DB_PATH;
    else process.env.JSA_DB_PATH = savedEnv;
  });

  test("a TARGET company with no tracker event is a legal row: not yet contacted, no due-date pressure", () => {
    const dbPath = join(dir, "manual_research.db");
    makeJsaDb(dbPath, [{ company_name: "PostHog", verdict: "TARGET", founder_persona: "values-driven, ships fast" }]);
    process.env.JSA_DB_PATH = dbPath;
    const result = buildJobsearchRows([], CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(result.note, null);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].who, "PostHog");
    assert.equal(result.rows[0].why, "values-driven, ships fast");
    assert.equal(result.rows[0].status, "not_contacted");
    assert.equal(result.rows[0].dueDate, null);
  });

  test("joins a bucket:jobsearch tracker event against the JSA company name case-insensitively", () => {
    const dbPath = join(dir, "manual_research.db");
    makeJsaDb(dbPath, [{ company_name: "PostHog", verdict: "TARGET" }]);
    process.env.JSA_DB_PATH = dbPath;
    const events: TrackerEvent[] = [{ ts: "2026-07-01T00:00:00.000Z", lead: "posthog", bucket: "jobsearch", event: "contacted" }];
    const result = buildJobsearchRows(events, CONFIG, "2026-07-10T00:00:00.000Z");
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].status, "due"); // jobsearch: follow_up_after_days=7, 9 days elapsed
  });

  test("only pulls TARGET verdicts, never a full unfiltered dump", () => {
    const dbPath = join(dir, "manual_research.db");
    makeJsaDb(dbPath, [
      { company_name: "PostHog", verdict: "TARGET" },
      { company_name: "SomeOtherCo", verdict: "CONSIDER" },
    ]);
    process.env.JSA_DB_PATH = dbPath;
    const result = buildJobsearchRows([], CONFIG, "2026-07-10T00:00:00.000Z");
    assert.deepEqual(result.rows.map((r) => r.who), ["PostHog"]);
  });
});

describe("markResponded / moveOn", () => {
  test("markResponded appends a responded event for the given bucket+lead", () => {
    const { dir, path } = tmpFile("tracker.jsonl");
    try {
      const event = markResponded("client", "client-acme-co", "intro call Fri", path);
      assert.equal(event.event, "responded");
      assert.equal(event.bucket, "client");
      assert.equal(event.lead, "client-acme-co");
      assert.equal(event.note, "intro call Fri");
      assert.deepEqual(readTrackerEvents(path), [event]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("moveOn appends an abandoned event", () => {
    const { dir, path } = tmpFile("tracker.jsonl");
    try {
      const event = moveOn("platform", "platform-x", undefined, path);
      assert.equal(event.event, "abandoned");
      assert.deepEqual(readTrackerEvents(path), [event]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("markContacted appends a followup_sent event for the given bucket+lead", () => {
    const { dir, path } = tmpFile("tracker.jsonl");
    try {
      const event = markContacted("jobsearch", "PostHog", "sent via email", path);
      assert.equal(event.event, "followup_sent");
      assert.equal(event.bucket, "jobsearch");
      assert.equal(event.lead, "PostHog");
      assert.equal(event.note, "sent via email");
      assert.deepEqual(readTrackerEvents(path), [event]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
