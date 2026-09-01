import { Buffer } from "node:buffer";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_METADATA_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const ACCOUNT = "muxin.li.pro@gmail.com";

export interface GmailFetch {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

export interface GmailSendRequest {
  to: string;
  subject: string;
  body: string;
  from?: string;
  cc?: string;
  bcc?: string;
  messageId?: string;
}

export interface GmailSendResult {
  provider: "gmail";
  account: string;
  providerMessageId: string;
  threadId?: string;
}

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  account?: string;
}

function env(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function gmailConfigFromEnv(): GmailConfig {
  const clientId = env("GMAIL_CLIENT_ID") ?? env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GMAIL_CLIENT_SECRET") ?? env("GOOGLE_CLIENT_SECRET");
  const refreshToken = env("GMAIL_REFRESH_TOKEN") ?? env("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth configuration is incomplete");
  }
  return { clientId, clientSecret, refreshToken, account: env("GMAIL_ACCOUNT") ?? ACCOUNT };
}

function requireOk(response: Response, operation: string): Promise<Response> {
  if (response.ok) return Promise.resolve(response);
  return response.text().catch(() => "").then(() => { throw new Error(`Gmail ${operation} failed (${response.status})`); });
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function gmailRfcMessageId(request: GmailSendRequest): string {
  const seed = request.messageId ?? `${request.to}\0${request.subject}\0${request.body}`;
  return `<${Buffer.from(seed, "utf8").toString("base64url").slice(0, 120)}@content-agents.local>`;
}

function header(name: string, value: string): string {
  // Header injection is never allowed, even though this provider is fed locked messages.
  if (/\r|\n/.test(value)) throw new Error(`invalid ${name} header`);
  return `${name}: ${value}`;
}

export function buildMimeMessage(request: GmailSendRequest): string {
  const from = request.from ?? ACCOUNT;
  const lines = [header("From", from), header("To", request.to)];
  if (request.cc) lines.push(header("Cc", request.cc));
  if (request.bcc) lines.push(header("Bcc", request.bcc));
  lines.push(header("Subject", request.subject), header("Message-ID", gmailRfcMessageId(request)), "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", request.body);
  return lines.join("\r\n");
}

export class GmailProvider {
  readonly name = "gmail";
  private readonly fetcher: GmailFetch;
  private readonly config: GmailConfig;

  constructor(config: GmailConfig = gmailConfigFromEnv(), fetcher: GmailFetch = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  private async accessToken(): Promise<string> {
    const response = await this.fetcher(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, refresh_token: this.config.refreshToken, grant_type: "refresh_token" }) });
    await requireOk(response, "token refresh");
    const data = await response.json() as { access_token?: string; scope?: string };
    if (!data.access_token) throw new Error("Gmail token response omitted access token");
    const scopes = (data.scope ?? "").split(/\s+/).filter(Boolean);
    if (!scopes.includes(GMAIL_SEND_SCOPE) || !scopes.includes(GMAIL_METADATA_SCOPE)) throw new Error("Gmail OAuth token requires gmail.send and gmail.metadata scopes");
    return data.access_token;
  }

  private async verifyAccount(token: string): Promise<void> {
    const response = await this.fetcher(PROFILE_URL, { headers: { authorization: `Bearer ${token}` } });
    await requireOk(response, "profile verification");
    const profile = await response.json() as { emailAddress?: string };
    if (profile.emailAddress !== (this.config.account ?? ACCOUNT) || profile.emailAddress !== ACCOUNT) throw new Error("Gmail account is not the approved Muxin account");
  }

  async send(request: GmailSendRequest): Promise<GmailSendResult> {
    const token = await this.accessToken();
    await this.verifyAccount(token);
    const raw = base64Url(buildMimeMessage(request));
    const response = await this.fetcher(SEND_URL, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ raw }) });
    await requireOk(response, "send");
    const data = await response.json() as { id?: string; threadId?: string };
    if (!data.id) throw new Error("Gmail send response omitted message id");
    return { provider: "gmail", account: ACCOUNT, providerMessageId: data.id, ...(data.threadId ? { threadId: data.threadId } : {}) };
  }

  async findSent(request: GmailSendRequest): Promise<GmailSendResult | null> {
    const token = await this.accessToken();
    await this.verifyAccount(token);
    const query = new URLSearchParams({ q: `in:sent rfc822msgid:${gmailRfcMessageId(request)}`, maxResults: "1" });
    const response = await this.fetcher(`${LIST_URL}?${query.toString()}`, { headers: { authorization: `Bearer ${token}` } });
    await requireOk(response, "sent-message reconciliation");
    const data = await response.json() as { messages?: Array<{ id?: string; threadId?: string }> };
    const match = data.messages?.[0];
    if (!match?.id) return null;
    return { provider: "gmail", account: ACCOUNT, providerMessageId: match.id, ...(match.threadId ? { threadId: match.threadId } : {}) };
  }
}

export function createGmailProvider(config?: GmailConfig, fetcher?: GmailFetch): GmailProvider {
  return new GmailProvider(config, fetcher);
}
