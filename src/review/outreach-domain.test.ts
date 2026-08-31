import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterOutreachRecommendations,
  conciseFitSummary,
  contactDiscoveryState,
  gmailSendReadiness,
  OUTREACH_GMAIL_ACCOUNT,
  type OutreachLeadCandidate,
} from "./outreach-domain.js";

const lead = (overrides: Partial<OutreachLeadCandidate> = {}): OutreachLeadCandidate => ({
  name: "Acme", kind: "client", classification: "turnaround", whyMutual: "A strong mutual fit.", ...overrides,
});

test("poor-fit leads never enter main Outreach recommendations", () => {
  const result = filterOutreachRecommendations([
    lead(),
    lead({ name: "Weak", classification: "unclear" }),
    lead({ name: "Platform", kind: "platform", fit: "partial", classification: undefined }),
    lead({ name: "Bad platform", kind: "platform", fit: "weak", classification: undefined }),
    lead({ name: "Example", kind: "content-example", classification: undefined }),
  ]);
  assert.deepEqual(result.map((item) => item.name), ["Acme", "Platform"]);
});

test("selected lead gets a concise mutual-fit summary with a safe fallback", () => {
  assert.equal(conciseFitSummary(lead()), "A strong mutual fit.");
  assert.equal(conciseFitSummary(lead({ whyMutual: "", whyThem: "They work on climate." })), "They work on climate.");
  assert.equal(conciseFitSummary(lead({ whyMutual: "", whyThem: "", whyMe: "I have a useful receipt.", pitchAngle: "Ask for a chat" })), "I have a useful receipt.");
  assert.equal(conciseFitSummary(lead({ whyMutual: "", whyThem: "", whyMe: "", pitchAngle: "Ask for a chat" })), "Ask for a chat");
});

test("contact discovery exposes explicit not-searched, found, and not-found states", () => {
  assert.deepEqual(contactDiscoveryState({}), { state: "not-searched", contacts: [] });
  assert.deepEqual(contactDiscoveryState({ discoveryAttempted: true }), { state: "not-found", contacts: [] });
  assert.deepEqual(contactDiscoveryState({ discoveryAttempted: true, contacts: [{ name: "Rae" }] }), { state: "found", contacts: [{ name: "Rae" }] });
});

test("Gmail sending is setup-dependent until exact account auth and permission are ready", () => {
  assert.equal(OUTREACH_GMAIL_ACCOUNT, "muxin.li.pro@gmail.com");
  assert.deepEqual(gmailSendReadiness({}), { ready: false, account: OUTREACH_GMAIL_ACCOUNT, reason: "Connect Gmail and grant send permission before sending." });
  assert.equal(gmailSendReadiness({ account: OUTREACH_GMAIL_ACCOUNT, authenticated: true, sendPermission: true }).ready, true);
  assert.equal(gmailSendReadiness({ account: "other@example.com", authenticated: true, sendPermission: true }).ready, false);
});
