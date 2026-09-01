import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, rmdirSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "../db/db.js";
import { GmailProvider, type GmailSendRequest, type GmailSendResult } from "../providers/email/gmail.js";

export const GMAIL_DELIVERY_LEDGER = join(repoRoot, "data", "outreach", "gmail-delivery.jsonl");
export type DeliveryEventType = "intent" | "delivered" | "failed" | "uncertain";
export interface DeliveryEvent {
  ts: string;
  event: DeliveryEventType;
  idempotencyKey: string;
  messageId: string;
  messageDigest: string;
  account: string;
  leaseId?: string;
  leaseExpiresAt?: string;
  providerMessageId?: string;
  error?: string;
}

export interface DeliveryLedger {
  read(path?: string): DeliveryEvent[];
  append(event: DeliveryEvent, path?: string): void;
}

function digest(request: GmailSendRequest): string {
  // Deliberately excludes message body from the ledger, while binding every retry to its exact bytes.
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

export function messageDigest(request: GmailSendRequest): string { return digest(request); }

export function readDeliveryEvents(path = GMAIL_DELIVERY_LEDGER): DeliveryEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as DeliveryEvent]; } catch { return []; }
  });
}
export const readLedger = readDeliveryEvents;

function appendFsync(event: DeliveryEvent, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "a", 0o600);
  try { writeSync(fd, JSON.stringify(event) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
}

export function appendDeliveryEvent(event: DeliveryEvent, path = GMAIL_DELIVERY_LEDGER): void { appendFsync(event, path); }
export const appendLedger = appendDeliveryEvent;

function acquireLock(path: string, leaseMs: number): { id: string; expires: string; release: () => void } {
  const lock = `${path}.lock`;
  mkdirSync(dirname(lock), { recursive: true });
  try { mkdirSync(lock); } catch {
    const stale = `${lock}/lease`;
    if (existsSync(stale) && Number(readFileSync(stale, "utf8")) < Date.now()) { unlinkSync(stale); try { rmdirSync(lock); } catch {} mkdirSync(lock); }
    else throw new Error("Gmail delivery lease is held");
  }
  const id = `${process.pid}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + leaseMs).toISOString();
  const lease = join(lock, "lease");
  const fd = openSync(lease, "w", 0o600); writeSync(fd, String(Date.now() + leaseMs)); fsyncSync(fd); closeSync(fd);
  return { id, expires: expiresAt, release: () => { try { unlinkSync(lease); rmdirSync(lock); } catch {} } };
}

export interface DeliveryOptions {
  ledgerPath?: string;
  provider?: { send(request: GmailSendRequest): Promise<GmailSendResult> };
  now?: () => Date;
  leaseMs?: number;
}

export interface ReconciliationOptions {
  ledgerPath?: string;
  provider?: { findSent(request: GmailSendRequest): Promise<GmailSendResult | null> };
  now?: () => Date;
}

export async function reconcileLockedGmailMessage(request: GmailSendRequest, options: ReconciliationOptions = {}): Promise<GmailSendResult | { status: "uncertain" }> {
  const path = options.ledgerPath ?? GMAIL_DELIVERY_LEDGER;
  const now = options.now ?? (() => new Date());
  const key = request.messageId ?? createHash("sha256").update(`${request.to}\0${request.subject}`).digest("hex");
  const messageId = request.messageId ?? key;
  const messageDigestValue = digest(request);
  const prior = readDeliveryEvents(path).filter((event) => event.idempotencyKey === key);
  if (prior.some((event) => event.messageDigest !== messageDigestValue)) throw new Error("locked message digest drift detected");
  const delivered = [...prior].reverse().find((event) => event.event === "delivered" && event.providerMessageId);
  if (delivered?.providerMessageId) return { provider: "gmail", account: delivered.account, providerMessageId: delivered.providerMessageId };
  if (!prior.some((event) => event.event === "intent")) throw new Error("Gmail delivery has no recorded intent to reconcile");
  const found = await (options.provider ?? new GmailProvider()).findSent(request);
  if (!found) {
    appendFsync({ ts: now().toISOString(), event: "uncertain", idempotencyKey: key, messageId, messageDigest: messageDigestValue, account: "muxin.li.pro@gmail.com", error: "sent-mail lookup found no authoritative match; absence does not prove failure" }, path);
    return { status: "uncertain" };
  }
  appendFsync({ ts: now().toISOString(), event: "delivered", idempotencyKey: key, messageId, messageDigest: messageDigestValue, account: found.account, providerMessageId: found.providerMessageId }, path);
  return found;
}

export async function deliverLockedGmailMessage(request: GmailSendRequest, options: DeliveryOptions = {}): Promise<GmailSendResult | { status: "already_delivered" | "uncertain" }> {
  const path = options.ledgerPath ?? GMAIL_DELIVERY_LEDGER;
  const now = options.now ?? (() => new Date());
  const key = request.messageId ?? createHash("sha256").update(`${request.to}\0${request.subject}`).digest("hex");
  const messageId = request.messageId ?? key;
  const messageDigestValue = digest(request);
  const prior = readDeliveryEvents(path).filter((e) => e.idempotencyKey === key);
  if (prior.some((e) => e.messageDigest !== messageDigestValue)) throw new Error("locked message digest drift detected");
  if (prior.some((e) => e.event === "delivered")) return { status: "already_delivered" };
  const openIntent = [...prior].reverse().find((e) => e.event === "intent");
  if (openIntent) {
    if (openIntent.leaseExpiresAt && Date.parse(openIntent.leaseExpiresAt) > now().getTime()) return { status: "uncertain" };
    appendFsync({ ts: now().toISOString(), event: "uncertain", idempotencyKey: key, messageId, messageDigest: messageDigestValue, account: "muxin.li.pro@gmail.com", error: "stale delivery intent recovered" }, path);
  }
  const lease = acquireLock(path, options.leaseMs ?? 60_000);
  try {
    const refreshed = readDeliveryEvents(path).filter((e) => e.idempotencyKey === key);
    if (refreshed.some((e) => e.event === "delivered")) return { status: "already_delivered" };
    appendFsync({ ts: now().toISOString(), event: "intent", idempotencyKey: key, messageId, messageDigest: messageDigestValue, account: "muxin.li.pro@gmail.com", leaseId: lease.id, leaseExpiresAt: lease.expires }, path);
    try {
      const result = await (options.provider ?? new GmailProvider()).send(request);
      appendFsync({ ts: now().toISOString(), event: "delivered", idempotencyKey: key, messageId, messageDigest: messageDigestValue, account: result.account, providerMessageId: result.providerMessageId }, path);
      return result;
    } catch (error) {
      // A provider timeout leaves the remote state unknowable. Never silently retry it.
      const text = error instanceof Error ? error.message : "provider failure";
      appendFsync({ ts: now().toISOString(), event: text.toLowerCase().includes("timeout") ? "uncertain" : "failed", idempotencyKey: key, messageId, messageDigest: messageDigestValue, account: "muxin.li.pro@gmail.com", error: text.slice(0, 240) }, path);
      throw error;
    }
  } finally { lease.release(); }
}

export const sendLockedGmailMessage = deliverLockedGmailMessage;
