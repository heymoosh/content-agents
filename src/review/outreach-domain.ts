/** Pure policy helpers for the Outreach room. Adapters can map existing lead/detail rows into these shapes. */
export const OUTREACH_GMAIL_ACCOUNT = "muxin.li.pro@gmail.com";

export interface OutreachLeadCandidate {
  name?: string;
  kind?: string;
  classification?: string;
  fit?: string;
  whyMutual?: string;
  whyThem?: string;
  whyMe?: string;
  pitchAngle?: string;
}

export function isGoodOutreachFit(lead: OutreachLeadCandidate): boolean {
  if (lead.kind === "client") return lead.classification === "turnaround" || lead.classification === "greenfield";
  if (lead.kind === "platform") return lead.fit === "strong" || lead.fit === "partial";
  return false;
}

export function filterOutreachRecommendations<T extends OutreachLeadCandidate>(leads: T[]): T[] {
  return leads.filter(isGoodOutreachFit);
}

export function conciseFitSummary(lead: OutreachLeadCandidate): string {
  return [lead.whyMutual, lead.whyThem, lead.whyMe, lead.pitchAngle]
    .map((value) => (value ?? "").trim())
    .find(Boolean) ?? "No fit summary recorded yet.";
}

export type ContactDiscoveryState = "not-searched" | "found" | "not-found";
export interface ContactDiscoveryInput { discoveryAttempted?: boolean; contacts?: { name: string; role?: string }[]; }
export interface ContactDiscoveryResult { state: ContactDiscoveryState; contacts: { name: string; role?: string }[]; }

export function contactDiscoveryState(input: ContactDiscoveryInput): ContactDiscoveryResult {
  const contacts = (input.contacts ?? []).filter((contact) => contact.name.trim());
  if (contacts.length) return { state: "found", contacts };
  return { state: input.discoveryAttempted ? "not-found" : "not-searched", contacts: [] };
}

export interface GmailConnectionState {
  account?: string;
  authenticated?: boolean;
  sendPermission?: boolean;
}
export type GmailSendReadiness =
  | { ready: true; account: typeof OUTREACH_GMAIL_ACCOUNT }
  | { ready: false; account: typeof OUTREACH_GMAIL_ACCOUNT; reason: string };

export function gmailSendReadiness(connection: GmailConnectionState): GmailSendReadiness {
  const ready = connection.account === OUTREACH_GMAIL_ACCOUNT && connection.authenticated === true && connection.sendPermission === true;
  return ready
    ? { ready: true, account: OUTREACH_GMAIL_ACCOUNT }
    : { ready: false, account: OUTREACH_GMAIL_ACCOUNT, reason: "Connect Gmail and grant send permission before sending." };
}
