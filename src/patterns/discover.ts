// patterns:discover proposes NEW accounts worth adding to the pattern-mining corpus.
//
// The rule that shapes this whole file: a discovered account is PROPOSED, never auto-added.
// Auto-adding means one bad account silently poisons the corpus and every pattern built on it.
// So `discover` only ever writes data/patterns/account-proposals.jsonl. The ONLY path that adds
// an account to config/pattern-mining.yaml is Muxin running
//   npm run patterns:discover -- --approve <handle>
// which appends the entry with a comment citing the proposal's evidence and the date, matching
// the citation style every account in that file already carries.
//
// EVIDENCE OR IT DOES NOT SHIP. A proposal without a real post url and at least one real public
// number is refused, not written. Nothing here estimates, rounds up, or fills a gap with a guess.
//
// Deterministic only. It fetches public pages and records what it saw. Judging whether a proposed
// account is worth studying is Muxin's call at approval time, not this file's.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { BrowserContext, Page } from "playwright";
import { repoRoot } from "../db/db.js";
import { PullError } from "../pull/errors.js";
import { PATTERNS_DIR, normalizeHandle } from "./corpus.js";
import { loadConfig } from "./collect.js";
import { metricScore } from "./outliers.js";
import { authorFromPermalink } from "./collectors/shared.js";
import type { Platform } from "./types.js";

export const PROPOSALS_PATH = join(PATTERNS_DIR, "account-proposals.jsonl");
const CONFIG_PATH = join(repoRoot, "config", "pattern-mining.yaml");

// Text platforms first, matching the rest of Phase 2. Video discovery is a later pass and is
// deliberately not stubbed here.
export const DISCOVERABLE_PLATFORMS = ["substack", "linkedin", "x"] as const;
export type DiscoverablePlatform = (typeof DISCOVERABLE_PLATFORMS)[number];

// How a candidate was reached. "search" is the PRIMARY mechanism: a public search on the
// platform's own search page, for terms Muxin keeps in config/pattern-mining.yaml. The other two
// are the SECONDARY mechanism, crawling out from accounts already in the config. Only relations a
// source below actually emits are listed. No aspirational values.
export type Relation = "search" | "recommended" | "reposted";

export type ProposalStatus = "proposed" | "approved" | "rejected";

export interface ProposalMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  followers: number | null;
}

// Whether the cited post was PROVED to be the candidate's own work.
//
// "confirmed" means the page carried an author signal and it named this account: a byline on
// substack, the permalink's author segment on x, the card's own profile link on linkedin.
// "unverified" means the surface showed no author signal at all, so the post is cited with that
// said out loud rather than passed off as proved.
//
// There is no third value for "someone else's", because such a post is never cited. The live run
// on 2026-08-22 proposed Chenell Basilio while citing a post she had merely reposted from
// stevekamb, and every pattern later mined off that account would have inherited the false
// citation. A missing proposal is recoverable; a wrong attribution is not.
export type Authorship = "confirmed" | "unverified";

// A real post of the candidate's, with the numbers that were actually public on it. A proposal
// cannot exist without one.
export interface ProposalEvidence {
  url: string;
  posted_at: string | null;
  // A short excerpt, kept only so Muxin can see what kind of post it was. It lives in
  // data/patterns/, which is gitignored, so other creators' text never reaches git.
  excerpt: string;
  metrics: ProposalMetrics;
  retrieved_at: string;
  // Optional so proposals written before this field existed still parse. Absent means the same
  // thing "unverified" means, and both print the same way: it was not proved.
  authorship?: Authorship;
}

export interface ProposalSource {
  relation: Relation;
  platform: DiscoverablePlatform;
  niche: string;
  // The page the post or the link was seen on: the search results page, or the configured
  // account's public page.
  url: string;
  // relation "search": the exact term that found it. Required for a search proposal.
  term?: string;
  // relation "recommended" or "reposted": the configured account it was reached from. Required
  // for a crawl proposal.
  handle?: string;
}

export interface AccountProposal {
  // <platform>-<normalized handle>. One account is one handle on one platform.
  id: string;
  handle: string;
  platform: DiscoverablePlatform;
  creator: string | null;
  // A GUESS, inherited from the niche of the configured account that surfaced this one. Muxin
  // corrects it at approval time.
  niche: string;
  status: ProposalStatus;
  proposed_at: string;
  decided_at: string | null;
  // Plain words: why this account showed up.
  why: string;
  source: ProposalSource;
  evidence: ProposalEvidence;
  // Only set by --reject, and only when Muxin passed a reason.
  reject_reason?: string;
}

// ---------------------------------------------------------------------------------------------
// Discovery settings, read from the `discovery:` block in config/pattern-mining.yaml.
// Typed here rather than in types.ts so Phase 1's record shape stays untouched.
// ---------------------------------------------------------------------------------------------

export interface DiscoverySettings {
  platforms: DiscoverablePlatform[];
  // The PRIMARY mechanism. Niche name to the terms a real person would type into that platform's
  // search box. Muxin edits these in the config; they are never hardcoded here.
  search_terms: Record<string, string[]>;
  // The SECONDARY mechanism, off by default in shape but read from the config.
  crawl_configured_accounts: boolean;
  request_delay_ms: number;
  max_terms_per_niche: number;
  max_results_per_term: number;
  max_seed_accounts_per_platform: number;
  max_candidates_per_seed: number;
  max_proposals_per_run: number;
}

export const DEFAULT_DISCOVERY: DiscoverySettings = {
  platforms: [...DISCOVERABLE_PLATFORMS],
  search_terms: {},
  crawl_configured_accounts: true,
  request_delay_ms: 4000,
  max_terms_per_niche: 4,
  max_results_per_term: 10,
  max_seed_accounts_per_platform: 8,
  max_candidates_per_seed: 10,
  max_proposals_per_run: 15,
};

export function loadDiscoverySettings(path: string = CONFIG_PATH): DiscoverySettings {
  const raw = parse(readFileSync(path, "utf8")) as Record<string, unknown> | null;
  const block = (raw?.discovery ?? {}) as Record<string, unknown>;
  const num = (key: keyof DiscoverySettings, fallback: number): number => {
    const v = block[key];
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  };
  // A term list is only usable if it is really a list of non-empty strings. A malformed entry is
  // dropped rather than searched for.
  const searchTerms: Record<string, string[]> = {};
  const rawTerms = block.search_terms;
  if (typeof rawTerms === "object" && rawTerms !== null && !Array.isArray(rawTerms)) {
    for (const [niche, terms] of Object.entries(rawTerms as Record<string, unknown>)) {
      if (!Array.isArray(terms)) continue;
      const clean = terms.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim());
      if (clean.length > 0) searchTerms[niche] = clean;
    }
  }
  const platforms = Array.isArray(block.platforms)
    ? (block.platforms as unknown[]).filter((p): p is DiscoverablePlatform =>
        DISCOVERABLE_PLATFORMS.includes(p as DiscoverablePlatform)
      )
    : DEFAULT_DISCOVERY.platforms;
  return {
    platforms: platforms.length > 0 ? platforms : [...DEFAULT_DISCOVERY.platforms],
    search_terms: searchTerms,
    crawl_configured_accounts:
      typeof block.crawl_configured_accounts === "boolean"
        ? block.crawl_configured_accounts
        : DEFAULT_DISCOVERY.crawl_configured_accounts,
    request_delay_ms: num("request_delay_ms", DEFAULT_DISCOVERY.request_delay_ms),
    max_terms_per_niche: num("max_terms_per_niche", DEFAULT_DISCOVERY.max_terms_per_niche),
    max_results_per_term: num("max_results_per_term", DEFAULT_DISCOVERY.max_results_per_term),
    max_seed_accounts_per_platform: num("max_seed_accounts_per_platform", DEFAULT_DISCOVERY.max_seed_accounts_per_platform),
    max_candidates_per_seed: num("max_candidates_per_seed", DEFAULT_DISCOVERY.max_candidates_per_seed),
    max_proposals_per_run: num("max_proposals_per_run", DEFAULT_DISCOVERY.max_proposals_per_run),
  };
}

// ---------------------------------------------------------------------------------------------
// The proposal store. One JSON object per line, same shape as the corpus store next door.
// ---------------------------------------------------------------------------------------------

export function proposalKey(platform: string, handle: string): string {
  return `${platform}|${normalizeHandle(handle)}`;
}

export function readProposals(path: string = PROPOSALS_PATH): AccountProposal[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as AccountProposal);
}

// Status changes rewrite the file. The proposal list is tens of rows, not millions.
export function writeProposals(proposals: AccountProposal[], path: string = PROPOSALS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, proposals.map((p) => JSON.stringify(p)).join("\n") + (proposals.length > 0 ? "\n" : ""), "utf8");
}

// Every handle already in config/pattern-mining.yaml, keyed the same way proposals are. A config
// row with a null handle (there is one on purpose) is skipped rather than crashing the run.
export function configuredKeys(configPath: string = CONFIG_PATH): Set<string> {
  const config = loadConfig(configPath);
  const keys = new Set<string>();
  for (const account of config.accounts ?? []) {
    if (!account.handle) continue;
    keys.add(proposalKey(account.platform, account.handle));
  }
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Proposal construction. This is where "evidence or it does not ship" is enforced.
// ---------------------------------------------------------------------------------------------

export interface CandidateInput {
  handle: string;
  creator: string | null;
  platform: DiscoverablePlatform;
  niche: string;
  why: string;
  source: ProposalSource;
  evidence: ProposalEvidence | null;
}

const METRIC_KEYS = ["views", "likes", "comments", "shares", "followers"] as const;

// A number is only usable if it was really read off the page. Anything else is null.
function isRealNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

export function buildProposal(
  input: CandidateInput,
  now: string = new Date().toISOString()
): { proposal: AccountProposal | null; errors: string[] } {
  const errors: string[] = [];
  const handle = (input.handle ?? "").trim();
  if (handle === "") errors.push("handle is empty");
  if (!DISCOVERABLE_PLATFORMS.includes(input.platform)) {
    errors.push(`platform ${JSON.stringify(input.platform)} is not one of: ${DISCOVERABLE_PLATFORMS.join(", ")}`);
  }
  if (!input.niche || input.niche.trim() === "") errors.push("niche is empty");
  if (!input.why || input.why.trim() === "") errors.push("why is empty");

  // A half-filled source record would leave a proposal that cannot say where it came from, which
  // is the one thing Muxin reads before approving. Each relation carries its own required field.
  const source = input.source;
  if (!source || !/^https?:\/\/\S+$/.test(source.url ?? "")) {
    errors.push("source.url must be the real page the candidate was seen on");
  } else if (source.relation === "search") {
    if (!source.term || source.term.trim() === "") errors.push('a "search" proposal must record the term that found it');
  } else if (!source.handle || source.handle.trim() === "") {
    errors.push(`a "${source.relation}" proposal must record the configured account it was reached from`);
  }

  const evidence = input.evidence;
  if (!evidence) {
    errors.push("no citable post: a proposal without a real post and real numbers is not written");
  } else {
    if (!/^https?:\/\/\S+$/.test(evidence.url ?? "")) errors.push("evidence.url must be a real post url");
    // Followers alone says nothing about a post, so it does not count as post evidence.
    const hasPostNumber = (["views", "likes", "comments", "shares"] as const).some((k) => isRealNumber(evidence.metrics?.[k]));
    if (!hasPostNumber) {
      errors.push("evidence carries no public post number (views, likes, comments or shares). Not written.");
    }
    for (const key of METRIC_KEYS) {
      const v = evidence.metrics?.[key] ?? null;
      if (v !== null && !isRealNumber(v)) errors.push(`evidence.metrics.${key} must be a non-negative number or null`);
    }
  }

  if (errors.length > 0) return { proposal: null, errors };
  const ev = evidence as ProposalEvidence;

  const proposal: AccountProposal = {
    id: `${input.platform}-${normalizeHandle(handle).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown"}`,
    handle,
    platform: input.platform,
    creator: input.creator && input.creator.trim() !== "" ? input.creator.trim() : null,
    niche: input.niche,
    status: "proposed",
    proposed_at: now,
    decided_at: null,
    why: input.why,
    source: input.source,
    evidence: {
      url: ev.url,
      posted_at: ev.posted_at ?? null,
      excerpt: (ev.excerpt ?? "").slice(0, 240),
      metrics: {
        views: isRealNumber(ev.metrics.views) ? ev.metrics.views : null,
        likes: isRealNumber(ev.metrics.likes) ? ev.metrics.likes : null,
        comments: isRealNumber(ev.metrics.comments) ? ev.metrics.comments : null,
        shares: isRealNumber(ev.metrics.shares) ? ev.metrics.shares : null,
        followers: isRealNumber(ev.metrics.followers) ? ev.metrics.followers : null,
      },
      retrieved_at: ev.retrieved_at || now,
    },
  };
  return { proposal, errors };
}

export interface AddResult {
  added: AccountProposal[];
  skipped: { handle: string; platform: string; reason: string }[];
}

// Appends every candidate that is genuinely new and genuinely evidenced. A candidate is skipped
// when it is already in the config, already proposed, already approved, already rejected, or
// repeated inside this batch. That is what makes a weekly re-run quiet instead of noisy.
export function addProposals(
  candidates: CandidateInput[],
  opts: { proposalsPath?: string; configPath?: string; now?: string } = {}
): AddResult {
  const proposalsPath = opts.proposalsPath ?? PROPOSALS_PATH;
  const existing = readProposals(proposalsPath);
  const seen = new Map<string, ProposalStatus>();
  for (const p of existing) seen.set(proposalKey(p.platform, p.handle), p.status);
  const configured = configuredKeys(opts.configPath ?? CONFIG_PATH);

  const added: AccountProposal[] = [];
  const skipped: AddResult["skipped"] = [];

  for (const candidate of candidates) {
    const key = proposalKey(candidate.platform, candidate.handle ?? "");
    if (configured.has(key)) {
      skipped.push({ handle: candidate.handle, platform: candidate.platform, reason: "already in config/pattern-mining.yaml" });
      continue;
    }
    const status = seen.get(key);
    if (status) {
      skipped.push({ handle: candidate.handle, platform: candidate.platform, reason: `already ${status}` });
      continue;
    }
    const { proposal, errors } = buildProposal(candidate, opts.now);
    if (!proposal) {
      skipped.push({ handle: candidate.handle, platform: candidate.platform, reason: errors.join("; ") });
      continue;
    }
    seen.set(key, "proposed");
    added.push(proposal);
  }

  if (added.length > 0) {
    mkdirSync(dirname(proposalsPath), { recursive: true });
    appendFileSync(proposalsPath, added.map((p) => JSON.stringify(p)).join("\n") + "\n", "utf8");
  }
  return { added, skipped };
}

// ---------------------------------------------------------------------------------------------
// Approval and rejection. Approval is the ONLY write path into config/pattern-mining.yaml.
// ---------------------------------------------------------------------------------------------

function isoDate(now: string): string {
  return now.slice(0, 10);
}

function displayName(proposal: AccountProposal): { value: string; placeholder: boolean } {
  if (proposal.creator && proposal.creator.trim() !== "") return { value: proposal.creator.trim(), placeholder: false };
  return { value: normalizeHandle(proposal.handle), placeholder: true };
}

function citedMetrics(metrics: ProposalMetrics): string {
  const parts: string[] = [];
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (metrics.views !== null) parts.push(`${fmt(metrics.views)} views`);
  if (metrics.likes !== null) parts.push(`${fmt(metrics.likes)} likes`);
  if (metrics.comments !== null) parts.push(`${fmt(metrics.comments)} comments`);
  if (metrics.shares !== null) parts.push(`${fmt(metrics.shares)} shares`);
  return parts.join(", ");
}

// Wrap a comment body to the width the rest of config/pattern-mining.yaml uses.
function commentLines(text: string, indent: string, width = 98): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (`${indent}# ${candidate}`.length > width && current !== "") {
      lines.push(`${indent}# ${current}`);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(`${indent}# ${current}`);
  return lines;
}

// The yaml block an approved proposal becomes. Same shape and same citation habit as every
// hand-written account above it: a comment saying where it came from and when it was retrieved.
export function renderConfigEntry(proposal: AccountProposal, approvedOn: string): string {
  const name = displayName(proposal);
  const numbers = citedMetrics(proposal.evidence.metrics);
  const source =
    proposal.source.relation === "search"
      ? `Source: found by searching ${proposal.source.platform} for "${proposal.source.term}", results page ${proposal.source.url}.`
      : `Source: ${proposal.source.relation} by @${normalizeHandle(proposal.source.handle ?? "")} on ${proposal.source.platform}, seen at ${proposal.source.url}.`;
  const sentences = [
    `Proposed by patterns:discover on ${isoDate(proposal.proposed_at)}, approved by Muxin on ${approvedOn}.`,
    `${proposal.why}`,
    source,
    `Evidence: ${proposal.evidence.url}, ${numbers}, retrieved ${isoDate(proposal.evidence.retrieved_at)}.`,
    proposal.source.relation === "search"
      ? "Niche is the niche of the search term that found it, not a verified read of this account. Correct it if it is wrong."
      : "Niche is the proposing account's niche, not a verified read of this one. Correct it if it is wrong.",
  ];
  if (name.placeholder) {
    sentences.push("The display name was not readable at proposal time, so the handle stands in. Replace it with the real name.");
  }
  if (proposal.evidence.authorship !== "confirmed") {
    sentences.push("Authorship of that post was NOT verified: the page carried no author signal, so it is cited as this account's without proof.");
  }
  const comment = commentLines(sentences.join(" "), "    ");
  return [
    `  - handle: "${proposal.handle}"`,
    `    creator: ${name.value}`,
    ...comment,
    `    platform: ${proposal.platform}`,
    `    niche: ${proposal.niche}`,
    `    followers: ${proposal.evidence.metrics.followers === null ? "null" : proposal.evidence.metrics.followers}`,
  ].join("\n");
}

// Insert at the END of the accounts list, walking back past the comment block that introduces the
// next top level key so an approval never splits a comment from the key it documents.
export function insertAccountEntry(configText: string, entryText: string): string {
  const lines = configText.split("\n");
  const accountsAt = lines.findIndex((line) => /^accounts:\s*$/.test(line));
  if (accountsAt === -1) throw new Error("config/pattern-mining.yaml has no top level `accounts:` list to append to");

  let end = lines.length;
  for (let i = accountsAt + 1; i < lines.length; i++) {
    if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  let insertAt = end;
  while (insertAt > accountsAt + 1) {
    const previous = lines[insertAt - 1].trim();
    if (previous === "" || previous.startsWith("#")) insertAt--;
    else break;
  }

  const block = entryText.replace(/\s+$/, "").split("\n");
  const before = lines[insertAt - 1]?.trim() === "" ? [] : [""];
  const after = lines[insertAt]?.trim() === "" ? [] : [""];
  lines.splice(insertAt, 0, ...before, ...block, ...after);
  return lines.join("\n");
}

export interface DecisionResult {
  ok: boolean;
  message: string;
  proposal?: AccountProposal;
}

function findProposals(proposals: AccountProposal[], handle: string, platform?: string): AccountProposal[] {
  const wanted = normalizeHandle(handle);
  return proposals.filter(
    (p) => normalizeHandle(p.handle) === wanted && (platform === undefined || p.platform === platform)
  );
}

function disambiguate(matches: AccountProposal[], handle: string, action: string): string | null {
  if (matches.length === 0) return `No proposal for ${handle}. Run patterns:discover first, or check --list.`;
  if (matches.length > 1) {
    const where = matches.map((m) => m.platform).join(", ");
    return `${handle} is proposed on more than one platform (${where}). Re-run ${action} with --platform <name>.`;
  }
  return null;
}

// The ONE path that adds an account to config/pattern-mining.yaml.
export function approveProposal(
  handle: string,
  opts: { platform?: string; proposalsPath?: string; configPath?: string; now?: string } = {}
): DecisionResult {
  const proposalsPath = opts.proposalsPath ?? PROPOSALS_PATH;
  const configPath = opts.configPath ?? CONFIG_PATH;
  const now = opts.now ?? new Date().toISOString();

  const proposals = readProposals(proposalsPath);
  const matches = findProposals(proposals, handle, opts.platform);
  const problem = disambiguate(matches, handle, "--approve");
  if (problem) return { ok: false, message: problem };

  const proposal = matches[0];
  if (proposal.status === "approved") {
    return { ok: false, message: `${proposal.handle} on ${proposal.platform} was already approved on ${proposal.decided_at}.` };
  }
  if (configuredKeys(configPath).has(proposalKey(proposal.platform, proposal.handle))) {
    return { ok: false, message: `${proposal.handle} on ${proposal.platform} is already in config/pattern-mining.yaml.` };
  }

  // WRITE ORDER MATTERS, do not reorder these two writes without reading this.
  // The config is written first, the proposal's status second. A crash in between leaves an
  // approved account in the config whose proposal still says "proposed", and that state is
  // self-healing: addProposals checks the config BEFORE the proposal statuses, so the account is
  // never re-proposed. Flipping the order would give the opposite failure, a proposal marked
  // approved with nothing in the config, which no later run would ever repair.
  const approvedOn = isoDate(now);
  const updated = insertAccountEntry(readFileSync(configPath, "utf8"), renderConfigEntry(proposal, approvedOn));
  writeFileSync(configPath, updated, "utf8");

  proposal.status = "approved";
  proposal.decided_at = now;
  delete proposal.reject_reason;
  writeProposals(proposals, proposalsPath);

  return {
    ok: true,
    proposal,
    message: `Approved ${proposal.handle} on ${proposal.platform}. Added to config/pattern-mining.yaml, cited to ${proposal.evidence.url}.`,
  };
}

// Rejection exists so a weekly run stops re-proposing the same account. It never touches config.
export function rejectProposal(
  handle: string,
  opts: { platform?: string; reason?: string; proposalsPath?: string; now?: string } = {}
): DecisionResult {
  const proposalsPath = opts.proposalsPath ?? PROPOSALS_PATH;
  const now = opts.now ?? new Date().toISOString();

  const proposals = readProposals(proposalsPath);
  const matches = findProposals(proposals, handle, opts.platform);
  const problem = disambiguate(matches, handle, "--reject");
  if (problem) return { ok: false, message: problem };

  const proposal = matches[0];
  if (proposal.status === "approved") {
    return { ok: false, message: `${proposal.handle} on ${proposal.platform} was already approved. Remove it from config/pattern-mining.yaml by hand instead.` };
  }
  proposal.status = "rejected";
  proposal.decided_at = now;
  if (opts.reason) proposal.reject_reason = opts.reason;
  writeProposals(proposals, proposalsPath);
  return { ok: true, proposal, message: `Rejected ${proposal.handle} on ${proposal.platform}. It will not be proposed again.` };
}

// ---------------------------------------------------------------------------------------------
// Live discovery sources.
//
// PRIMARY mechanism, search: type the niche's search terms into the platform's own public search,
// the way a non-owner looking for top creators in that niche would, and read the posts that come
// back. The post that matched IS the evidence, which is the best-grounded case we have. Ranking is
// a plain sort of what search returned by the public numbers on those posts. There is no scoring
// model and no heuristic invented out of nothing.
//
// SECONDARY mechanism, crawl: walk the PUBLIC activity of accounts already in the config and
// surface the accounts they themselves point at. Kept because it was already built and costs
// little, gated by crawl_configured_accounts in the config.
//
// If a source can only surface a few accounts honestly, it surfaces a few.
//
// EVERY SELECTOR BELOW WAS RUN AGAINST THE LIVE PAGES on 2026-08-22, with Muxin's saved Chrome
// session, read-only, public pages only. What each platform actually exposes, and what it hides,
// is written at the top of that platform's source. The live run corrected four real defects: two
// timing bugs (both substack and x render results client side and were being read too early), one
// leak (Substack's nav profile link walked into the results as a candidate), and one that would
// have been a lie in the corpus (evidence cited a post by a DIFFERENT writer, see the substack
// note below).
//
// The rule that outranks yield, and the reason those defects were fixed rather than tolerated:
// A SELECTOR THAT MISSES RETURNS NOTHING, WHICH COSTS A PROPOSAL. IT NEVER INVENTS ONE.
// A page that changes shape later fails the same safe way: fewer proposals, never a made-up post,
// never a number that was not on the page, never someone else's post attributed to this account.
// ---------------------------------------------------------------------------------------------

export interface SeedAccount {
  handle: string;
  platform: DiscoverablePlatform;
  niche: string;
  creator: string;
}

export interface Candidate {
  handle: string;
  creator: string | null;
  platform: DiscoverablePlatform;
  niche: string;
  relation: Relation;
  // The search results page, or the configured account's public page.
  sourceUrl: string;
  // Set on a search hit only: the term that found it.
  term?: string;
  // Set on a crawl hit only: the configured account it was reached from.
  seedHandle?: string;
  // Set when the surface that found this account also showed one of its posts. Evidence starts
  // from this post rather than from a fresh look at the account.
  postUrl?: string;
}

// A search result: the account behind a post that matched, plus that post as evidence when the
// search page showed real numbers on it. A null evidence falls back to fetchEvidence.
export interface SearchHit extends Candidate {
  evidence: ProposalEvidence | null;
}

export interface DiscoverySource {
  platform: DiscoverablePlatform;
  // PRIMARY. Run one term through the platform's own public search.
  search(context: BrowserContext, term: string, niche: string, limit: number): Promise<SearchHit[]>;
  // SECONDARY. Accounts reachable from one configured account's public activity.
  findCandidates(context: BrowserContext, seed: SeedAccount, limit: number): Promise<Candidate[]>;
  // One real recent public post of the candidate's, or null when nothing citable was visible.
  fetchEvidence(context: BrowserContext, candidate: Candidate): Promise<ProposalEvidence | null>;
}

// Rank by the numbers actually on the post that matched, using the SAME rule the corpus is scored
// by: `metricScore` in outliers.ts, which prefers views where a platform shows them to a non-owner
// and otherwise sums the public interaction counts. Discovery deliberately does not own a scoring
// rule of its own; an account picked on one rule and then judged on another would be picked for
// reasons the corpus never agrees with.
//
// The one thing this adds is the missing-number answer. `metricScore` returns null when nothing at
// all was recorded, which is the honest answer for a verdict. Here the caller is a SORT, so null
// becomes 0: an account with no visible numbers ranks last rather than ranking on invented ones.
// The name says "rank" rather than "score" because that zero makes it a sort key and nothing more.
export function rankScore(metrics: ProposalMetrics): number {
  return metricScore(metrics)?.value ?? 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A platform that rate limits, paywalls, or challenges us is done for the run. We record it and
// move on. We never retry harder and never try to get around it.
const BLOCK_SIGNALS = /rate limit|too many requests|unusual traffic|are you a robot|captcha|verify you are human/i;

async function assertNotBlocked(page: Page, platform: string): Promise<void> {
  const body = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? "").catch(() => "");
  if (BLOCK_SIGNALS.test(body)) {
    throw new PullError("UNKNOWN", `${platform} signalled a block on ${page.url()}`, {
      hint: `Discovery stopped for ${platform} this run. Do not retry harder. Try again next week.`,
    });
  }
}

function textNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([KkMm])?/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = (match[2] ?? "").toLowerCase();
  if (suffix === "k") return Math.round(value * 1_000);
  if (suffix === "m") return Math.round(value * 1_000_000);
  return Math.round(value);
}

// LinkedIn's reaction count, which is NOT where the markup implies. Found by collector-core and
// confirmed live here on 2026-08-22 against the same page: the number is the leading text of
// button[data-reaction-details], and the word "reactions" is often absent, which is why reading
// the post's text for "N reactions" found comments and reposts but never reactions.
//
// The trap is the top post: its button reads "371" with aria-label "Maddy Viswanath and 370
// others". Parsing any number out of that aria-label yields 370, which is the count of OTHER
// reactors and is off by one. So the aria-label is used only when it actually says "N reactions",
// and otherwise the leading number of the button text is used, which is the total.
export function linkedinReactionCount(ariaLabel: string | null, buttonText: string | null): number | null {
  const labelled = /([\d,.KM]+)\s+reactions?/i.exec(ariaLabel ?? "")?.[1];
  if (labelled) return textNumber(labelled);
  const leading = /^([\d][\d,.KM]*)\b/.exec((buttonText ?? "").trim())?.[1];
  return leading ? textNumber(leading) : null;
}

// LinkedIn renders a person's name twice inside the same anchor, once visible and once for screen
// readers, so the raw text reads "Jonathan WeberJonathan Weber". Verified live 2026-08-22. Only an
// exact doubling is undone; anything else is left exactly as the page had it.
export function undoubleName(raw: string | null): string | null {
  const text = (raw ?? "").trim();
  if (text === "") return null;
  const half = text.length / 2;
  if (text.length % 2 === 0 && text.slice(0, half) === text.slice(half)) return text.slice(0, half);
  return text;
}

// X puts a post's whole public count set in one aria-label, for example "12 replies, 40 reposts,
// 300 likes, 50000 views". Anything the label does not name stays null.
export function metricsFromXLabel(label: string): ProposalMetrics {
  const grab = (word: string) => textNumber(new RegExp(`([\\d.,KkMm]+)\\s+${word}`).exec(label ?? "")?.[1] ?? null);
  return {
    views: grab("views?"),
    likes: grab("likes?"),
    comments: grab("repl(?:y|ies)"),
    shares: grab("reposts?"),
    followers: null,
  };
}

// Substack. The richest honest surface we have: a public profile lists the publications that
// writer recommends, and a publication's public archive endpoint returns real reaction and
// comment counts per post. Both are pages a logged out reader can see.
export const substackSource: DiscoverySource = {
  platform: "substack",

  // Substack's own public post search. Verified live 2026-08-22 against
  // substack.com/search/<term>?searchType=posts, which rendered 13 post links and 56 profile
  // links for one term.
  //
  // Two things that live run taught us, both of which cost proposals before they were fixed:
  // the result list renders client side, so reading at domcontentloaded finds nothing; and the
  // page's own nav carries Muxin's profile link, which walked straight into the results as a
  // candidate. So we wait for a result row, and we read each candidate out of the ROW that holds
  // its post, never from a loose page-wide link scan.
  //
  // The results page never shows reaction counts, so evidence comes from the archive fetch below,
  // starting at the post the row named.
  async search(context, term, niche, limit) {
    const page = await context.newPage();
    const searchUrl = `https://substack.com/search/${encodeURIComponent(term)}?searchType=posts`;
    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "substack");
      await page.waitForSelector('a[href*="/p/"]', { timeout: 20_000 }).catch(() => null);
      const found = await page.evaluate(() => {
        // The first /@ link on the page is the signed-in user's own profile in the nav. Whoever
        // is logged in is not a discovery, so it is excluded by handle everywhere below.
        const ownHandle = ((document.querySelector('a[href^="/@"]') as HTMLAnchorElement | null)?.getAttribute("href") ?? "")
          .replace(/^\/@/, "")
          .split("?")[0]
          .toLowerCase();
        const rows: { handle: string; name: string | null; postUrl: string }[] = [];
        for (const postLink of Array.from(document.querySelectorAll('a[href*="/p/"]'))) {
          const postUrl = (postLink as HTMLAnchorElement).href;
          if (!/\/p\//.test(postUrl)) continue;
          // Climb to the row that holds both the post and its writer.
          let node: HTMLElement | null = postLink.parentElement;
          for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
            const profile = node.querySelector('a[href^="/@"], a[href*="substack.com/@"]') as HTMLAnchorElement | null;
            const raw = profile?.getAttribute("href") ?? "";
            const handle = (raw.match(/\/@([A-Za-z0-9_-]+)/)?.[1] ?? "").toLowerCase();
            if (!handle || handle === ownHandle) continue;
            rows.push({ handle, name: (profile?.textContent ?? "").trim() || null, postUrl });
            break;
          }
        }
        return rows;
      });
      const unique = new Map<string, SearchHit>();
      for (const item of found) {
        if (unique.has(item.handle)) continue;
        unique.set(item.handle, {
          handle: `@${item.handle}`,
          creator: item.name,
          platform: "substack",
          niche,
          relation: "search",
          sourceUrl: searchUrl,
          term,
          postUrl: item.postUrl,
          evidence: null,
        });
        if (unique.size >= limit) break;
      }
      return [...unique.values()];
    } finally {
      await page.close();
    }
  },

  async findCandidates(context, seed, limit) {
    const page = await context.newPage();
    const sourceUrl = `https://substack.com/@${normalizeHandle(seed.handle)}`;
    try {
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "substack");
      await page.waitForSelector('a[href*="/p/"]', { timeout: 20_000 }).catch(() => null);
      const found = await page.evaluate(() => {
        // Same nav trap the search path hit live on 2026-08-22: the first /@ link on any Substack
        // page is the signed-in user's own profile. Muxin is not a discovery.
        const ownHandle = ((document.querySelector('a[href^="/@"]') as HTMLAnchorElement | null)?.getAttribute("href") ?? "")
          .replace(/^\/@/, "")
          .split("?")[0]
          .toLowerCase();
        const out: { handle: string; name: string | null }[] = [];
        for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
          const href = (anchor as HTMLAnchorElement).getAttribute("href") ?? "";
          const match = href.match(/^https?:\/\/substack\.com\/@([A-Za-z0-9_-]+)|^\/@([A-Za-z0-9_-]+)/);
          if (!match) continue;
          const handle = match[1] ?? match[2];
          if (!handle || handle.toLowerCase() === ownHandle) continue;
          out.push({ handle, name: (anchor.textContent ?? "").trim() || null });
        }
        return out;
      });
      const self = normalizeHandle(seed.handle);
      const unique = new Map<string, Candidate>();
      for (const item of found) {
        const handle = item.handle.toLowerCase();
        if (handle === self || unique.has(handle)) continue;
        unique.set(handle, {
          handle: `@${item.handle}`,
          creator: item.name,
          platform: "substack",
          niche: seed.niche,
          relation: "recommended",
          sourceUrl,
          seedHandle: seed.handle,
        });
        if (unique.size >= limit) break;
      }
      return [...unique.values()];
    } finally {
      await page.close();
    }
  },

  // Evidence: real reaction and comment counts from the publication's own public archive
  // endpoint. Verified live 2026-08-22 against davidpepper.substack.com, sarahfay.substack.com and
  // growthinreverse.substack.com, all HTTP 200 with canonical_url, reaction_count, comment_count,
  // post_date and publishedBylines per post.
  //
  // Views are NOT public to a non-owner on Substack, so views stays null and never gets faked from
  // a like count. Here likes and comments are the only numbers an outlier bar can fire on.
  //
  // The live run caught the failure that matters most in this whole file. Reading the first post
  // link off a profile page cited a post by SOMEONE ELSE: Chenell Basilio's profile shows a post
  // she reposted from stevekamb, and the naive version proposed her while citing his post. So the
  // archive's publishedBylines is checked against the candidate's own handle, and a post that is
  // not demonstrably theirs is not cited at all. Missing a proposal is the correct outcome there.
  async fetchEvidence(context, candidate) {
    const wanted = normalizeHandle(candidate.handle);
    for (const host of await publicationHosts(context, candidate)) {
      const response = await context.request.get(`https://${host}/api/v1/archive?sort=new&limit=12`, { timeout: 30_000 });
      if (!response.ok()) continue;
      const posts = (await response.json()) as Record<string, unknown>[];
      if (!Array.isArray(posts)) continue;
      const theirs = posts.filter((post) => {
        if (typeof post.canonical_url !== "string") return false;
        const bylines = Array.isArray(post.publishedBylines) ? (post.publishedBylines as Record<string, unknown>[]) : [];
        return bylines.some((b) => typeof b.handle === "string" && normalizeHandle(b.handle) === wanted);
      });
      if (theirs.length === 0) continue;
      // Prefer the exact post that matched the search. Otherwise their best recent post, cited by
      // its own url.
      const matched = candidate.postUrl
        ? theirs.find((post) => String(post.canonical_url).split("?")[0] === candidate.postUrl!.split("?")[0])
        : undefined;
      const best = matched ?? theirs.sort((a, b) => Number(b.reaction_count ?? 0) - Number(a.reaction_count ?? 0))[0];
      const likes = isRealNumber(best.reaction_count) ? (best.reaction_count as number) : null;
      const comments = isRealNumber(best.comment_count) ? (best.comment_count as number) : null;
      if (likes === null && comments === null) continue;
      return {
        url: String(best.canonical_url),
        posted_at: typeof best.post_date === "string" ? best.post_date : null,
        excerpt: String(best.title ?? ""),
        metrics: { views: null, likes, comments, shares: null, followers: null },
        retrieved_at: new Date().toISOString(),
        // The byline filter above is what makes this confirmed. Substack never reaches the
        // unverified branch: a post with no matching byline is not cited at all.
        authorship: "confirmed",
      };
    }
    return null;
  },
};

// Publications to look for this account's own posts in. The post a search row named comes first,
// because its host IS the publication that ran it. Otherwise the profile page's post links, which
// may include posts by other writers, so every candidate host is checked against the bylines
// above rather than trusted. Capped at three hosts to keep one candidate to a few requests.
async function publicationHosts(context: BrowserContext, candidate: Candidate): Promise<string[]> {
  const hosts: string[] = [];
  if (candidate.postUrl) {
    try {
      hosts.push(new URL(candidate.postUrl).host);
    } catch {
      /* a malformed url falls through to the profile page */
    }
  }
  const page = await context.newPage();
  try {
    await page.goto(`https://substack.com/@${normalizeHandle(candidate.handle)}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await assertNotBlocked(page, "substack");
    await page.waitForSelector('a[href*="/p/"]', { timeout: 20_000 }).catch(() => null);
    const found = await page.evaluate(() => {
      const out: string[] = [];
      for (const anchor of Array.from(document.querySelectorAll('a[href*="/p/"]'))) {
        const match = ((anchor as HTMLAnchorElement).href ?? "").match(/^https?:\/\/([^/]+)\/p\//i);
        if (match && !out.includes(match[1])) out.push(match[1]);
      }
      return out;
    });
    for (const host of found) if (!hosts.includes(host)) hosts.push(host);
  } finally {
    await page.close();
  }
  return hosts.slice(0, 3);
}

// LinkedIn. Verified live 2026-08-22, and it needs two different readings of the site because the
// search page and the activity page are built differently.
//
// The content search (linkedin.com/search/results/content/?keywords=<term>) answers HTTP 200 and
// renders real posts, but in the current UI those cards carry NO data-urn, NO per-post permalink,
// and no reaction or comment count in their text. Author profile links ARE reliable there. So
// search on this platform finds WHO to look at and nothing more; it never fabricates a post url.
//
// The account's own recent-activity page is where evidence lives: div[data-urn="urn:li:activity:N"]
// per post, which gives a real permalink, and the block text carries counts like "237 comments"
// and "5 reposts", plus a reaction count on button[data-reaction-details], see the reader above.
// Impressions are owner-only on LinkedIn, so views stays null, always.
export const linkedinSource: DiscoverySource = {
  platform: "linkedin",

  async search(context, term, niche, limit) {
    const page = await context.newPage();
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(term)}`;
    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "linkedin");
      await page.waitForSelector('a[href*="/in/"]', { timeout: 20_000 }).catch(() => null);
      const found = await page.evaluate(() => {
        const own = ((document.querySelector('a[href*="/in/"][href*="?"]') as HTMLAnchorElement | null)?.getAttribute("href") ?? "").match(/\/in\/([A-Za-z0-9-]+)/)?.[1] ?? "";
        const out: { slug: string; name: string | null }[] = [];
        for (const anchor of Array.from(document.querySelectorAll('a[href*="/in/"]'))) {
          const slug = ((anchor as HTMLAnchorElement).getAttribute("href") ?? "").match(/\/in\/([A-Za-z0-9-]+)/)?.[1] ?? "";
          if (!slug || slug === own) continue;
          out.push({ slug, name: (anchor.textContent ?? "").trim().split("\n")[0] || null });  // undoubled below
        }
        return out;
      });
      const unique = new Map<string, SearchHit>();
      for (const item of found) {
        const slug = item.slug.toLowerCase();
        const existing = unique.get(slug);
        if (existing) {
          // LinkedIn renders the same person as several anchors, and the image-only ones carry no
          // text. Verified live: taking the first anchor left every creator name null.
          if (!existing.creator && item.name) existing.creator = undoubleName(item.name);
          continue;
        }
        unique.set(slug, {
          handle: `@${item.slug}`,
          creator: undoubleName(item.name),
          platform: "linkedin",
          niche,
          relation: "search",
          sourceUrl: searchUrl,
          term,
          // Evidence never comes from the search page here. See the note above.
          evidence: null,
        });
        if (unique.size >= limit) break;
      }
      return [...unique.values()];
    } finally {
      await page.close();
    }
  },

  // The secondary crawl: authors this configured account reposted. Modest by nature, since most
  // posts are original rather than reposts.
  async findCandidates(context, seed, limit) {
    const page = await context.newPage();
    const sourceUrl = `https://www.linkedin.com/in/${normalizeHandle(seed.handle)}/recent-activity/all/`;
    try {
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "linkedin");
      await page.waitForSelector('a[href*="/in/"]', { timeout: 20_000 }).catch(() => null);
      const found = await page.evaluate(() => {
        const out: { slug: string; name: string | null }[] = [];
        for (const anchor of Array.from(document.querySelectorAll('a[href*="/in/"]'))) {
          const slug = ((anchor as HTMLAnchorElement).getAttribute("href") ?? "").match(/\/in\/([A-Za-z0-9-]+)/)?.[1] ?? "";
          if (!slug) continue;
          out.push({ slug, name: (anchor.textContent ?? "").trim().split("\n")[0] || null });  // undoubled below
        }
        return out;
      });
      const self = normalizeHandle(seed.handle);
      const unique = new Map<string, Candidate>();
      for (const item of found) {
        const slug = item.slug.toLowerCase();
        if (slug === self) continue;
        const existing = unique.get(slug);
        if (existing) {
          if (!existing.creator && item.name) existing.creator = undoubleName(item.name);
          continue;
        }
        unique.set(slug, {
          handle: `@${item.slug}`,
          creator: undoubleName(item.name),
          platform: "linkedin",
          niche: seed.niche,
          relation: "reposted",
          sourceUrl,
          seedHandle: seed.handle,
        });
        if (unique.size >= limit) break;
      }
      return [...unique.values()];
    } finally {
      await page.close();
    }
  },

  // The page reads RAW here and decides nothing. Which card is citable is settled by
  // pickLinkedinCard below, which is a pure function and therefore actually testable. The earlier
  // version made that call inside page.evaluate, where no test could reach it, and the call it
  // made was a text heuristic with no ownership check at all.
  async fetchEvidence(context, candidate) {
    const page = await context.newPage();
    const activityUrl = `https://www.linkedin.com/in/${normalizeHandle(candidate.handle)}/recent-activity/all/`;
    try {
      await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "linkedin");
      await page.waitForSelector("div[data-urn]", { timeout: 20_000 }).catch(() => null);
      const cards: LinkedinActivityCard[] = await page.evaluate(() => {
        const out = [];
        for (const post of Array.from(document.querySelectorAll('div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"]'))) {
          const urn = post.getAttribute("data-urn") ?? "";
          if (!urn) continue;
          const text = (post as HTMLElement).innerText ?? "";
          const reactionButton = post.querySelector("button[data-reaction-details]") as HTMLElement | null;
          out.push({
            urn,
            text: text.slice(0, 240),
            full: text.slice(0, 4000),
            reactionAria: reactionButton?.getAttribute("aria-label") ?? null,
            reactionText: (reactionButton?.innerText ?? "").trim().split("\n")[0] || null,
            // Every profile the card links to. The author is one of them when LinkedIn renders an
            // author link at all, which is why an EMPTY list means "cannot tell" rather than "not
            // theirs". UNVERIFIED selector: this specific author-link read has not been checked
            // against a live page, only the card read around it has.
            authorSlugs: Array.from(post.querySelectorAll('a[href*="/in/"]'))
              .map((a) => ((a as HTMLAnchorElement).getAttribute("href") ?? "").match(/\/in\/([A-Za-z0-9-]+)/)?.[1] ?? "")
              .filter((slug) => slug !== ""),
          });
        }
        return out;
      });
      const picked = pickLinkedinCard(cards, normalizeHandle(candidate.handle));
      if (!picked) return null;
      const { card } = picked;
      const comments = textNumber(/([\d,.KM]+)\s+comments?/i.exec(card.full)?.[1] ?? null);
      const shares = textNumber(/([\d,.KM]+)\s+reposts?/i.exec(card.full)?.[1] ?? null);
      const likes = linkedinReactionCount(card.reactionAria, card.reactionText);
      if (comments === null && shares === null && likes === null) return null;
      return {
        url: `https://www.linkedin.com/feed/update/${card.urn}/`,
        posted_at: null,
        excerpt: card.text,
        metrics: { views: null, likes, comments, shares, followers: null },
        retrieved_at: new Date().toISOString(),
        authorship: picked.authorship,
      };
    } finally {
      await page.close();
    }
  },
};

// One card read off a LinkedIn activity feed, before anything has been decided about it.
export interface LinkedinActivityCard {
  urn: string;
  text: string;
  full: string;
  reactionAria: string | null;
  reactionText: string | null;
  // Profile slugs the card links to, lowercased by the picker rather than here.
  authorSlugs: string[];
}

// Which card on an activity feed can be cited as this account's own post, and how sure we are.
//
// An activity feed mixes a person's own posts with things they reposted, commented on, or liked.
// Citing someone else's post as theirs is the one mistake this file must never make, so the rule
// is the same one the substack fix follows: skip a card only when it DEMONSTRABLY belongs to
// somebody else, and where authorship cannot be determined, keep the card and say so.
//
// Three outcomes per card, in order:
//   1. LinkedIn's own repost and comment banners say outright that the post is someone else's.
//      Skip it.
//   2. The card links to profiles and one of them is this account. It is theirs, confirmed.
//   3. The card links to profiles and none of them is this account. Someone else's. Skip it.
//   4. The card links to no profile at all. Undecidable, so it is kept as a fallback and marked
//      unverified rather than dropped. Dropping it would silently lose a real post, and marking it
//      confirmed would be the false citation this whole function exists to prevent.
//
// A confirmed card always beats an unverified one, however far down the feed it sits.
export function pickLinkedinCard(
  cards: LinkedinActivityCard[],
  wantedHandle: string,
): { card: LinkedinActivityCard; authorship: Authorship } | null {
  const wanted = normalizeHandle(wantedHandle);
  let fallback: LinkedinActivityCard | null = null;
  for (const card of cards) {
    if (/reposted this|commented on this|likes this/i.test(card.full || card.text)) continue;
    const slugs = card.authorSlugs.map((slug) => slug.toLowerCase());
    if (slugs.includes(wanted)) return { card, authorship: "confirmed" };
    if (slugs.length > 0) continue;
    if (fallback === null) fallback = card;
  }
  return fallback ? { card: fallback, authorship: "unverified" } : null;
}

// X. Settled live on 2026-08-22: the saved logged-in Chrome session DOES get through, where a
// direct fetch does not. x.com/search?q=<term>&f=top answered HTTP 200 and rendered 7 post cards,
// each carrying a real public label like
//   "151 replies, 296 reposts, 4011 likes, 10345 bookmarks, 347732 views".
// That matters more than it looks: X is the one text platform that shows a non-owner real VIEW
// counts, which is the number the view/follower outlier bar actually needs. The HTTP 402 recorded
// in config/pattern-mining.yaml is a property of unauthenticated direct fetches, not of this
// session route.
//
// The timeline renders client side, so both calls below wait for a post card before reading. The
// first live run read too early and returned nothing at all.
export const xSource: DiscoverySource = {
  platform: "x",

  // X's own "Top" search tab, which is exactly what a person looking for the best posts on a term
  // would use. A post card carries a public view count and its engagement in one aria-label, so a
  // hit usually arrives with its evidence already attached. Expect this to be blocked often.
  async search(context, term, niche, limit) {
    const page = await context.newPage();
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(term)}&f=top`;
    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "x");
      await page.waitForSelector("article", { timeout: 20_000 }).catch(() => null);
      const found = await page.evaluate(() => {
        // Whoever is signed in is not a discovery. X names the nav's own profile link outright.
        const ownHandle = ((document.querySelector('[data-testid="AppTabBar_Profile_Link"]') as HTMLAnchorElement | null)?.getAttribute("href") ?? "")
          .replace(/^\//, "")
          .toLowerCase();
        const out: { handle: string; href: string; text: string; label: string }[] = [];
        for (const article of Array.from(document.querySelectorAll("article"))) {
          const status = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
          if (!status) continue;
          const handle = new URL(status.href).pathname.match(/^\/([A-Za-z0-9_]{2,15})\/status\//)?.[1] ?? "";
          if (!handle || handle.toLowerCase() === ownHandle) continue;
          out.push({
            handle,
            href: status.href,
            text: ((article as HTMLElement).innerText ?? "").slice(0, 240),
            label: (article.querySelector('[role="group"]') as HTMLElement | null)?.getAttribute("aria-label") ?? "",
          });
        }
        return out;
      });
      const unique = new Map<string, SearchHit>();
      for (const item of found) {
        const handle = item.handle.toLowerCase();
        if (unique.has(handle)) continue;
        const metrics = metricsFromXLabel(item.label);
        unique.set(handle, {
          handle: `@${item.handle}`,
          creator: null,
          platform: "x",
          niche,
          relation: "search",
          sourceUrl: searchUrl,
          term,
          evidence:
            // Confirmed by construction: `handle` was read out of this post's own permalink
            // author segment a few lines up, so the post and the account cannot disagree.
            rankScore(metrics) > 0
              ? { url: item.href, posted_at: null, excerpt: item.text, metrics, retrieved_at: new Date().toISOString(), authorship: "confirmed" as const }
              : null,
        });
        if (unique.size >= limit) break;
      }
      return [...unique.values()];
    } finally {
      await page.close();
    }
  },

  async findCandidates(context, seed, limit) {
    const page = await context.newPage();
    const sourceUrl = `https://x.com/${normalizeHandle(seed.handle)}`;
    try {
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "x");
      // The timeline renders client side here too. Verified live: without this wait the crawl
      // read an empty page and returned nothing at all.
      await page.waitForSelector("article", { timeout: 20_000 }).catch(() => null);
      const found = await page.evaluate(() => {
        const out: string[] = [];
        for (const article of Array.from(document.querySelectorAll("article"))) {
          const text = (article as HTMLElement).innerText ?? "";
          if (!/reposted|quoted/i.test(text)) continue;
          for (const anchor of Array.from(article.querySelectorAll('a[href^="/"]'))) {
            const href = (anchor as HTMLAnchorElement).getAttribute("href") ?? "";
            const match = href.match(/^\/([A-Za-z0-9_]{2,15})$/);
            if (match) out.push(match[1]);
          }
        }
        return out;
      });
      const self = normalizeHandle(seed.handle);
      const unique = new Map<string, Candidate>();
      for (const raw of found) {
        const handle = raw.toLowerCase();
        if (handle === self || unique.has(handle)) continue;
        unique.set(handle, {
          handle: `@${raw}`,
          creator: null,
          platform: "x",
          niche: seed.niche,
          relation: "reposted",
          sourceUrl,
          seedHandle: seed.handle,
        });
        if (unique.size >= limit) break;
      }
      return [...unique.values()];
    } finally {
      await page.close();
    }
  },

  // Same split as linkedin above: the page reads raw, pickXCard decides. The earlier version took
  // document.querySelector("article"), the FIRST card on the timeline, with no author check and no
  // repost check of any kind, which on a profile whose top post is a repost or a pinned quote cited
  // a stranger's post as this account's. The collector for this same platform has filtered reposts
  // by permalink author since it was written (src/patterns/collectors/x.ts); this is that standard,
  // applied on the discovery path too.
  async fetchEvidence(context, candidate) {
    const page = await context.newPage();
    const profileUrl = `https://x.com/${normalizeHandle(candidate.handle)}`;
    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNotBlocked(page, "x");
      await page.waitForSelector("article", { timeout: 20_000 }).catch(() => null);
      // X shows a public view count on a post, confirmed live 2026-08-22. When a card does not
      // render its label the numbers stay null rather than being filled in from somewhere else.
      const cards: XTimelineCard[] = await page.evaluate(() => {
        const out = [];
        for (const article of Array.from(document.querySelectorAll("article"))) {
          const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
          if (!link) continue;
          out.push({
            href: link.href,
            text: ((article as HTMLElement).innerText ?? "").slice(0, 240),
            label: (article.querySelector('[role="group"]') as HTMLElement | null)?.getAttribute("aria-label") ?? "",
            socialContext: (article.querySelector('[data-testid="socialContext"]') as HTMLElement | null)?.textContent ?? "",
            promoted: article.querySelector('[data-testid="placementTracking"]') !== null,
          });
        }
        return out;
      });
      const picked = pickXCard(cards, normalizeHandle(candidate.handle));
      if (!picked) return null;
      const metrics = metricsFromXLabel(picked.card.label);
      if (metrics.views === null && metrics.likes === null && metrics.comments === null && metrics.shares === null) return null;
      return {
        url: picked.card.href,
        posted_at: null,
        excerpt: picked.card.text,
        metrics,
        retrieved_at: new Date().toISOString(),
        authorship: picked.authorship,
      };
    } finally {
      await page.close();
    }
  },
};

// One card read off an X profile timeline, before anything has been decided about it.
export interface XTimelineCard {
  href: string;
  text: string;
  label: string;
  socialContext: string;
  promoted: boolean;
}

// Which card on an X profile timeline can be cited as this account's own post.
//
// X makes ownership easy in a way the other two platforms do not: a post's permalink is
// /<author>/status/<id>, and a repost or an embedded quote keeps the ORIGINAL author's permalink.
// So `authorFromPermalink` answers the question outright and there is almost no undecidable case.
// A card with no status link is not a post at all and never reaches this function.
//
// Promoted cards are skipped for the same reason the collector skips them: an ad is not this
// account's organic reach. A repost banner is skipped because the post belongs to somebody else.
//
// The unverified branch exists only for the shape X has never actually shown us: a status
// permalink whose path does not parse into an author. It is kept rather than dropped, on the same
// principle as linkedin's, and marked so nobody reads it as proved.
export function pickXCard(
  cards: XTimelineCard[],
  wantedHandle: string,
): { card: XTimelineCard; authorship: Authorship } | null {
  const wanted = normalizeHandle(wantedHandle);
  let fallback: XTimelineCard | null = null;
  for (const card of cards) {
    if (card.promoted) continue;
    if (/repost|retweet/i.test(card.socialContext)) continue;
    let author: string | null = null;
    try {
      author = authorFromPermalink(card.href);
    } catch {
      author = null;  // a permalink that is not a url at all tells us nothing
    }
    if (author === wanted) return { card, authorship: "confirmed" };
    if (author !== null) continue;
    if (fallback === null) fallback = card;
  }
  return fallback ? { card: fallback, authorship: "unverified" } : null;
}

export const SOURCES: Record<DiscoverablePlatform, DiscoverySource> = {
  substack: substackSource,
  linkedin: linkedinSource,
  x: xSource,
};

// ---------------------------------------------------------------------------------------------
// The run itself.
// ---------------------------------------------------------------------------------------------

export interface RunReport {
  platform: DiscoverablePlatform;
  // Search, the primary mechanism.
  terms: number;
  from_search: number;
  // Crawl, the secondary mechanism.
  seeds: number;
  from_crawl: number;
  candidates: number;
  evidenced: number;
  proposed: number;
  skipped: { handle: string; platform: string; reason: string }[];
  failures: { where: string; reason: string }[];
}

export interface NicheTerms {
  niche: string;
  terms: string[];
}

export interface RunOptions {
  settings: DiscoverySettings;
  // Search terms per niche, the primary mechanism.
  niches: NicheTerms[];
  // Configured accounts to crawl out from, the secondary mechanism.
  seeds: SeedAccount[];
  source: DiscoverySource;
  context: BrowserContext;
  proposalsPath?: string;
  configPath?: string;
  now?: string;
  // Injected in tests so a run does not really wait.
  delay?: (ms: number) => Promise<void>;
}

// Thrown internally when a platform signals a block. It ends that platform's run and nothing else.
class PlatformBlocked extends Error {}

// One platform's pass: search first, then crawl if the config leaves it on.
//
// Politeness lives in here, not in the caller: a delay before every request, caps on terms,
// results, seeds and proposals, and a hard stop for the platform the moment it signals a block.
export async function runPlatform(opts: RunOptions): Promise<RunReport> {
  const { settings, niches, seeds, source, context } = opts;
  const wait = opts.delay ?? sleep;
  const report: RunReport = {
    platform: source.platform,
    terms: 0,
    from_search: 0,
    seeds: 0,
    from_crawl: 0,
    candidates: 0,
    evidenced: 0,
    proposed: 0,
    skipped: [],
    failures: [],
  };

  const configured = configuredKeys(opts.configPath ?? CONFIG_PATH);
  const known = new Set(readProposals(opts.proposalsPath ?? PROPOSALS_PATH).map((p) => proposalKey(p.platform, p.handle)));
  const inputs: CandidateInput[] = [];

  // Already in the config, already decided, or already seen this run. Checked before any request
  // is spent on evidence we would only throw away.
  const alreadyHandled = (candidate: Candidate): boolean => {
    const key = proposalKey(candidate.platform, candidate.handle);
    if (!configured.has(key) && !known.has(key)) return false;
    report.skipped.push({
      handle: candidate.handle,
      platform: candidate.platform,
      reason: configured.has(key) ? "already in config/pattern-mining.yaml" : "already proposed, approved or rejected",
    });
    return true;
  };

  const noteFailure = (where: string, err: unknown): void => {
    report.failures.push({ where, reason: err instanceof Error ? err.message : String(err) });
    if (err instanceof PullError) {
      report.failures.push({ where: source.platform, reason: "platform signalled a block, stopping this platform for the run" });
      throw new PlatformBlocked();
    }
  };

  // Evidence for one candidate: what search already saw, else a fetch, else nothing.
  const evidenceFor = async (candidate: Candidate, attached: ProposalEvidence | null): Promise<ProposalEvidence | null> => {
    if (attached) return attached;
    await wait(settings.request_delay_ms);
    return source.fetchEvidence(context, candidate);
  };

  const inputFor = (candidate: Candidate, evidence: ProposalEvidence, why: string): CandidateInput => ({
    handle: candidate.handle,
    creator: candidate.creator,
    platform: candidate.platform,
    niche: candidate.niche,
    why,
    source: {
      relation: candidate.relation,
      platform: source.platform,
      niche: candidate.niche,
      url: candidate.sourceUrl,
      ...(candidate.term ? { term: candidate.term } : {}),
      ...(candidate.seedHandle ? { handle: candidate.seedHandle } : {}),
    },
    evidence,
  });

  try {
    // ---- PRIMARY: search the niche's terms on the platform's own public search ----
    const scored: { input: CandidateInput; score: number }[] = [];
    for (const { niche, terms } of niches) {
      for (const term of terms.slice(0, settings.max_terms_per_niche)) {
        report.terms++;
        let hits: SearchHit[] = [];
        try {
          await wait(settings.request_delay_ms);
          hits = await source.search(context, term, niche, settings.max_results_per_term);
        } catch (err) {
          noteFailure(`${source.platform} search ${JSON.stringify(term)}`, err);
          continue;
        }
        for (const hit of hits) {
          if (alreadyHandled(hit)) continue;
          report.candidates++;
          let evidence: ProposalEvidence | null = null;
          try {
            evidence = await evidenceFor(hit, hit.evidence);
          } catch (err) {
            noteFailure(`${source.platform} candidate ${hit.handle}`, err);
            continue;
          }
          if (!evidence) {
            report.skipped.push({ handle: hit.handle, platform: hit.platform, reason: "no citable post with real public numbers" });
            continue;
          }
          report.evidenced++;
          known.add(proposalKey(hit.platform, hit.handle));
          scored.push({
            input: inputFor(
              hit,
              evidence,
              `A post of theirs matched one of the ${niche} search terms on ${source.platform} and showed ${citedMetrics(evidence.metrics)}. The term is cited in the source below.`
            ),
            score: rankScore(evidence.metrics),
          });
        }
      }
    }
    // Rank what search returned by the numbers on the matching posts, best first, then take what
    // the per-run cap allows.
    scored.sort((a, b) => b.score - a.score);
    for (const { input } of scored) {
      if (inputs.length >= settings.max_proposals_per_run) break;
      inputs.push(input);
      report.from_search++;
    }

    // ---- SECONDARY: crawl out from configured accounts, sharing the same per-run cap ----
    if (settings.crawl_configured_accounts) {
      for (const seed of seeds.slice(0, settings.max_seed_accounts_per_platform)) {
        if (inputs.length >= settings.max_proposals_per_run) break;
        report.seeds++;
        let candidates: Candidate[] = [];
        try {
          await wait(settings.request_delay_ms);
          candidates = await source.findCandidates(context, seed, settings.max_candidates_per_seed);
        } catch (err) {
          noteFailure(`${source.platform} seed ${seed.handle}`, err);
          continue;
        }
        for (const candidate of candidates) {
          if (inputs.length >= settings.max_proposals_per_run) break;
          if (alreadyHandled(candidate)) continue;
          report.candidates++;
          let evidence: ProposalEvidence | null = null;
          try {
            evidence = await evidenceFor(candidate, null);
          } catch (err) {
            noteFailure(`${source.platform} candidate ${candidate.handle}`, err);
            continue;
          }
          if (!evidence) {
            report.skipped.push({ handle: candidate.handle, platform: candidate.platform, reason: "no citable post with real public numbers" });
            continue;
          }
          report.evidenced++;
          known.add(proposalKey(candidate.platform, candidate.handle));
          inputs.push(
            inputFor(
              candidate,
              evidence,
              `Surfaced from @${normalizeHandle(seed.handle)} (${seed.creator}), a ${seed.niche} account already in the config.`
            )
          );
          report.from_crawl++;
        }
      }
    }
  } catch (err) {
    if (!(err instanceof PlatformBlocked)) throw err;
  }

  const result = addProposals(inputs, {
    proposalsPath: opts.proposalsPath,
    configPath: opts.configPath,
    now: opts.now,
  });
  report.proposed = result.added.length;
  report.skipped.push(...result.skipped);
  return report;
}


export function seedsFor(platform: DiscoverablePlatform, configPath: string, onlyHandle?: string): SeedAccount[] {
  const config = loadConfig(configPath);
  return (config.accounts ?? [])
    .filter((a): a is typeof a & { handle: string } => Boolean(a.handle))
    .filter((a) => (a.platform as Platform) === (platform as Platform))
    .filter((a) => (onlyHandle ? normalizeHandle(a.handle) === normalizeHandle(onlyHandle) : true))
    .map((a) => ({ handle: a.handle, platform, niche: a.niche, creator: a.creator }));
}

// The search terms to run, in the config's own niche order. A niche with no terms is not searched
// rather than searched for its own name, which would return noise.
export function nichesFor(settings: DiscoverySettings, configPath: string): NicheTerms[] {
  const config = loadConfig(configPath);
  const ordered = config.niches ?? Object.keys(settings.search_terms);
  const out: NicheTerms[] = [];
  for (const niche of ordered) {
    const terms = settings.search_terms[niche];
    if (terms && terms.length > 0) out.push({ niche, terms: terms.slice(0, settings.max_terms_per_niche) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

export interface Args {
  platforms: DiscoverablePlatform[];
  account?: string;
  limit?: number;
  dryRun: boolean;
  list: boolean;
  approve?: string;
  reject?: string;
  reason?: string;
  configPath: string;
  proposalsPath: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    platforms: [],
    dryRun: false,
    list: false,
    configPath: CONFIG_PATH,
    proposalsPath: PROPOSALS_PATH,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--list") args.list = true;
    else if (flag === "--platform" && value) {
      if (DISCOVERABLE_PLATFORMS.includes(value as DiscoverablePlatform)) args.platforms.push(value as DiscoverablePlatform);
      else throw new Error(`--platform ${value} is not one of: ${DISCOVERABLE_PLATFORMS.join(", ")}`);
      i++;
    } else if (flag === "--account" && value) (args.account = value), i++;
    else if (flag === "--limit" && value) (args.limit = Number(value)), i++;
    else if (flag === "--approve" && value) (args.approve = value), i++;
    else if (flag === "--reject" && value) (args.reject = value), i++;
    else if (flag === "--reason" && value) (args.reason = value), i++;
    else if (flag === "--config" && value) (args.configPath = value), i++;
    else if (flag === "--proposals" && value) (args.proposalsPath = value), i++;
  }
  return args;
}

function printProposals(proposals: AccountProposal[]): void {
  if (proposals.length === 0) {
    console.log("No proposals yet. Run patterns:discover.");
    return;
  }
  const byStatus = (status: ProposalStatus) => proposals.filter((p) => p.status === status);
  console.log(`\nProposals: ${proposals.length} (${byStatus("proposed").length} waiting, ${byStatus("approved").length} approved, ${byStatus("rejected").length} rejected).`);
  for (const p of proposals) {
    console.log(`\n  [${p.status}] ${p.handle} on ${p.platform}, guessed niche ${p.niche}`);
    console.log(`    why: ${p.why}`);
    console.log(`    found by: ${p.source.relation === "search" ? `searching ${p.source.platform} for ${JSON.stringify(p.source.term)}` : `${p.source.relation} by @${normalizeHandle(p.source.handle ?? "")}`}`);
    console.log(`    evidence: ${p.evidence.url}`);
    console.log(`    numbers: ${citedMetrics(p.evidence.metrics) || "none recorded"}, retrieved ${isoDate(p.evidence.retrieved_at)}`);
    if (p.evidence.authorship !== "confirmed") {
      console.log("    authorship: NOT VERIFIED. The page showed no author signal, so this post is this account's only if the feed it came from is. Check it before approving.");
    }
  }
  console.log("\nApprove one with: npm run patterns:discover -- --approve <handle> [--platform <name>]");
  console.log("Reject one with:  npm run patterns:discover -- --reject <handle> [--platform <name>] [--reason \"...\"]");
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);

  if (args.approve) {
    const result = approveProposal(args.approve, {
      platform: args.platforms[0],
      proposalsPath: args.proposalsPath,
      configPath: args.configPath,
    });
    console.log(result.message);
    return result.ok ? 0 : 1;
  }

  if (args.reject) {
    const result = rejectProposal(args.reject, {
      platform: args.platforms[0],
      reason: args.reason,
      proposalsPath: args.proposalsPath,
    });
    console.log(result.message);
    return result.ok ? 0 : 1;
  }

  const settings = loadDiscoverySettings(args.configPath);
  if (args.limit && args.limit > 0) settings.max_proposals_per_run = args.limit;
  const platforms = args.platforms.length > 0 ? args.platforms : settings.platforms;

  if (args.list) {
    printProposals(readProposals(args.proposalsPath));
    return 0;
  }

  const existing = readProposals(args.proposalsPath);
  console.log(`\n=== patterns:discover ${args.dryRun ? "(dry run, no network)" : ""} ===`);
  console.log(`Platforms: ${platforms.join(", ")}. Text platforms only; video discovery is a later pass.`);
  console.log(`Politeness: ${settings.request_delay_ms}ms between requests, at most ${settings.max_terms_per_niche} search terms per niche, ${settings.max_results_per_term} results per term, ${settings.max_seed_accounts_per_platform} seed accounts per platform, ${settings.max_candidates_per_seed} candidates per seed, ${settings.max_proposals_per_run} proposals per run.`);
  console.log(`Mechanism: public search on each platform first. Crawling out from configured accounts is ${settings.crawl_configured_accounts ? "ON" : "OFF"} as a second pass.`);
  console.log(`Proposals on file: ${existing.length}.`);

  const niches = nichesFor(settings, args.configPath);

  if (args.dryRun) {
    console.log("\nSearch terms it would run, per niche:");
    if (niches.length === 0) console.log("  none. Add search_terms under discovery: in config/pattern-mining.yaml.");
    for (const { niche, terms } of niches) {
      console.log(`  ${niche}: ${terms.map((t) => JSON.stringify(t)).join(", ")}`);
    }
    for (const platform of platforms) {
      const searches = niches.reduce((n, entry) => n + entry.terms.length, 0);
      console.log(`\n${platform}: would run ${searches} search(es), then rank what comes back by the numbers on the posts.`);
      if (!settings.crawl_configured_accounts) {
        console.log("  crawling out from configured accounts is off");
        continue;
      }
      const seeds = seedsFor(platform, args.configPath, args.account).slice(0, settings.max_seed_accounts_per_platform);
      console.log(`  then walk ${seeds.length} configured account(s) for accounts they point at:`);
      for (const seed of seeds) console.log(`    ${seed.handle} (${seed.creator}, ${seed.niche})`);
      if (seeds.length === 0) console.log("    no configured accounts on this platform");
    }
    console.log("\nDry run. Nothing was fetched and nothing was written.");
    return 0;
  }

  // Imported here on purpose: a dry run and the whole test suite must never construct a browser.
  const { launchPlatform } = await import("../pull/browser.js");
  const reports: RunReport[] = [];
  for (const platform of platforms) {
    const seeds = seedsFor(platform, args.configPath, args.account);
    if (niches.length === 0 && seeds.length === 0) {
      console.log(`\n${platform}: no search terms and no configured accounts. Skipped.`);
      continue;
    }
    const context = await launchPlatform(platform);
    try {
      reports.push(
        await runPlatform({
          settings,
          niches,
          seeds,
          source: SOURCES[platform],
          context,
          proposalsPath: args.proposalsPath,
          configPath: args.configPath,
        })
      );
    } finally {
      await context.close();
    }
  }

  console.log("\n=== summary ===");
  for (const report of reports) {
    console.log(`\n${report.platform}: ${report.terms} search(es) run and ${report.seeds} seed(s) walked, ${report.candidates} candidate(s) checked, ${report.evidenced} with citable evidence, ${report.proposed} newly proposed (${report.from_search} from search, ${report.from_crawl} from crawling configured accounts).`);
    for (const skip of report.skipped) console.log(`  skipped ${skip.handle}: ${skip.reason}`);
    for (const failure of report.failures) console.log(`  FAILED ${failure.where}: ${failure.reason}`);
  }
  console.log("\nNothing was added to config/pattern-mining.yaml. Review with --list, then approve one at a time:");
  console.log("  npm run patterns:discover -- --approve <handle> [--platform <name>]");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
