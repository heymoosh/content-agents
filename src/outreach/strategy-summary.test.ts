import { strict as assert } from "node:assert";
import test from "node:test";
import type { LeadSummary } from "./status.js";
import type { FollowupsResult } from "./tracker.js";
import { renderOutreachStrategySection } from "./strategy-summary.js";

const leads: LeadSummary[] = [
  { dir: "outreach/leads/platform-civic-lab", kind: "platform", name: "Civic Lab", source: "manual", status: "pursue", classificationOrFit: "strong", pitchAngle: "Shared interest in participatory technology" },
  { dir: "outreach/leads/client-acme", kind: "client", name: "Acme", source: "manual", status: "locked", classificationOrFit: "greenfield", pitchAngle: "Untested product assumptions" },
];

const followups: FollowupsResult = {
  buckets: {
    client: [{ key: "client:client-acme:", bucket: "client", lead: "client-acme", who: "Acme", why: "fit", status: "due", lastTouch: "2026-08-20", lastEvent: "contacted", nextAction: "Follow up", dueDate: "2026-08-27", abandonDate: null }],
    platform: [{ key: "platform:platform-civic-lab:", bucket: "platform", lead: "platform-civic-lab", who: "Civic Lab", why: "fit", status: "responded", lastTouch: "2026-08-28", lastEvent: "responded", nextAction: "Review reply", dueDate: null, abandonDate: null }],
    inbound: [],
    jobsearch: [],
  },
  jobsearchNote: "JSA_DB_PATH is not configured; job-search rows are unavailable.",
};

test("weekly Outreach section includes target list, per-bucket follow-up counts, and honest degraded notes", () => {
  const text = renderOutreachStrategySection(leads, followups);
  assert.match(text, /^## Outreach and follow-ups/m);
  assert.match(text, /BORROWED-AUDIENCE TARGET LIST \(1\)/);
  assert.match(text, /Civic Lab \[fit: strong\]/);
  assert.match(text, /client \| 1 \| 1 \| 0 \| 0/);
  assert.match(text, /platform \| 1 \| 0 \| 0 \| 1/);
  assert.match(text, /JSA_DB_PATH is not configured/);
  assert.doesNotMatch(text, /urgent|failure|send now/i);
});

test("empty Outreach state is explicit rather than silently omitted", () => {
  const empty: FollowupsResult = { buckets: { client: [], platform: [], inbound: [], jobsearch: [] }, jobsearchNote: null };
  const text = renderOutreachStrategySection([], empty);
  assert.match(text, /no platform-kind leads yet/i);
  assert.match(text, /No follow-up rows are active/i);
});
