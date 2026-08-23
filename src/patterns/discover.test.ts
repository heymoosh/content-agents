// Account discovery. Every test writes into a temp directory and against a temp copy of the
// config, never into the real data/patterns or the real config/pattern-mining.yaml.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";
import {
  addProposals,
  approveProposal,
  buildProposal,
  insertAccountEntry,
  loadDiscoverySettings,
  parseArgs,
  proposalKey,
  readProposals,
  rejectProposal,
  renderConfigEntry,
  engagementScore,
  nichesFor,
  runPlatform,
  seedsFor,
  substackSource,
  linkedinReactionCount,
  undoubleName,
  type AccountProposal,
  type Candidate,
  type CandidateInput,
  type DiscoverySource,
  type ProposalEvidence,
  type SearchHit,
} from "./discover.js";

let dir: string;
let proposalsPath: string;
let configPath: string;

// A small config with the shapes that actually bite: a null handle, the same handle on two
// platforms, and a real accounts block followed by a commented top level key.
const CONFIG_FIXTURE = `# Pattern mining test config.
niches:
  - building-solopreneur
  - inner-journey
  - virality-growth

accounts:
  - handle: "@justinwelsh"
    creator: Justin Welsh
    platform: linkedin
    niche: building-solopreneur
    followers: null

  - handle: null   # TODO: confirm handle
    creator: Josh Silver
    platform: substack
    niche: building-solopreneur
    followers: null

  - handle: "@neuranne"   # verified: substack.com/@neuranne, retrieved 2026-08-22
    creator: Anne-Laure Le Cunff
    platform: substack
    niche: inner-journey
    followers: 125000

# Either bar clearing marks a post as an outlier worth studying.
outlier_thresholds:
  substack:
    view_follower_ratio: 1.5
    baseline_multiple: 2.5
  linkedin:
    view_follower_ratio: 3.0
    baseline_multiple: 3.0
  x:
    view_follower_ratio: 5.0
    baseline_multiple: 3.0

targets:
  corpus_size_min: 20
  corpus_size_max: 50

discovery:
  platforms:
    - substack
    - linkedin
  search_terms:
    inner-journey:
      - burnout recovery
      - inner work
    virality-growth:
      - how to write a hook
    civic-democracy: []
  crawl_configured_accounts: true
  request_delay_ms: 1234
  max_terms_per_niche: 2
  max_results_per_term: 5
  max_seed_accounts_per_platform: 2
  max_candidates_per_seed: 3
  max_proposals_per_run: 4
`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "patterns-discover-"));
  proposalsPath = join(dir, "account-proposals.jsonl");
  configPath = join(dir, "pattern-mining.yaml");
  writeFileSync(configPath, CONFIG_FIXTURE, "utf8");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function evidence(overrides: Partial<ProposalEvidence> = {}): ProposalEvidence {
  return {
    url: "https://someone.substack.com/p/a-real-post",
    posted_at: "2026-08-01T00:00:00.000Z",
    excerpt: "A real post title",
    metrics: { views: null, likes: 412, comments: 33, shares: null, followers: null },
    retrieved_at: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

function candidateInput(overrides: Partial<CandidateInput> = {}): CandidateInput {
  return {
    handle: "@someone",
    creator: "Some One",
    platform: "substack",
    niche: "inner-journey",
    why: "Surfaced from @neuranne (Anne-Laure Le Cunff), an inner-journey account already in the config.",
    source: {
      relation: "recommended",
      platform: "substack",
      niche: "inner-journey",
      url: "https://substack.com/@neuranne",
      handle: "@neuranne",
    },
    evidence: evidence(),
    ...overrides,
  };
}

function add(overrides: Partial<CandidateInput> = {}) {
  return addProposals([candidateInput(overrides)], { proposalsPath, configPath, now: "2026-08-22T12:00:00.000Z" });
}

describe("evidence is not optional", () => {
  test("a candidate with no citable post is refused, not written", () => {
    const { proposal, errors } = buildProposal(candidateInput({ evidence: null }));
    assert.equal(proposal, null);
    assert.match(errors.join(" "), /no citable post/);

    const result = add({ evidence: null });
    assert.equal(result.added.length, 0);
    assert.equal(readProposals(proposalsPath).length, 0);
    assert.match(result.skipped[0].reason, /no citable post/);
  });

  test("a post url with no public number is refused", () => {
    const { proposal, errors } = buildProposal(
      candidateInput({ evidence: evidence({ metrics: { views: null, likes: null, comments: null, shares: null, followers: 90000 } }) })
    );
    assert.equal(proposal, null);
    assert.match(errors.join(" "), /no public post number/);
  });

  test("a number with no post url is refused", () => {
    const { proposal, errors } = buildProposal(candidateInput({ evidence: evidence({ url: "" }) }));
    assert.equal(proposal, null);
    assert.match(errors.join(" "), /real post url/);
  });

  test("a search proposal must record the term that found it", () => {
    const { proposal, errors } = buildProposal(
      candidateInput({ source: { relation: "search", platform: "substack", niche: "inner-journey", url: "https://substack.com/search/x" } })
    );
    assert.equal(proposal, null);
    assert.match(errors.join(" "), /must record the term that found it/);
  });

  test("a crawl proposal must record the configured account it came from", () => {
    const { proposal, errors } = buildProposal(
      candidateInput({ source: { relation: "recommended", platform: "substack", niche: "inner-journey", url: "https://substack.com/@neuranne" } })
    );
    assert.equal(proposal, null);
    assert.match(errors.join(" "), /must record the configured account/);
  });

  test("a real post with real numbers is written, with the numbers unchanged", () => {
    const result = add();
    assert.equal(result.added.length, 1);
    const written = readProposals(proposalsPath);
    assert.equal(written.length, 1);
    assert.equal(written[0].status, "proposed");
    assert.equal(written[0].decided_at, null);
    assert.equal(written[0].evidence.url, "https://someone.substack.com/p/a-real-post");
    assert.deepEqual(written[0].evidence.metrics, { views: null, likes: 412, comments: 33, shares: null, followers: null });
  });
});

describe("dedupe", () => {
  test("re-running does not duplicate a proposal that is still waiting", () => {
    add();
    const second = add();
    assert.equal(second.added.length, 0);
    assert.equal(second.skipped[0].reason, "already proposed");
    assert.equal(readProposals(proposalsPath).length, 1);
  });

  test("an approved proposal is not proposed again", () => {
    add();
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-22T12:00:00.000Z" });
    const again = add();
    assert.equal(again.added.length, 0);
    // Approval put it in the config, so the config check fires first. Either way it is not re-added.
    assert.match(again.skipped[0].reason, /already in config|already approved/);
    assert.equal(readProposals(proposalsPath).length, 1);
  });

  test("a rejected proposal is not proposed again", () => {
    add();
    rejectProposal("@someone", { proposalsPath, now: "2026-08-22T13:00:00.000Z" });
    const again = add();
    assert.equal(again.added.length, 0);
    assert.equal(again.skipped[0].reason, "already rejected");
    assert.equal(readProposals(proposalsPath).length, 1);
  });

  test("an account already in the config is never proposed", () => {
    const result = add({ handle: "@NeurAnne" });
    assert.equal(result.added.length, 0);
    assert.equal(result.skipped[0].reason, "already in config/pattern-mining.yaml");
  });

  test("the same handle on a different platform is a different account", () => {
    const result = addProposals(
      [candidateInput({ handle: "@neuranne", platform: "linkedin" })],
      { proposalsPath, configPath, now: "2026-08-22T12:00:00.000Z" }
    );
    assert.equal(result.added.length, 1);
  });

  test("a config row with a null handle does not crash the dedupe", () => {
    // The fixture carries a null handle on purpose. Getting here at all is the assertion.
    const result = add();
    assert.equal(result.added.length, 1);
  });

  test("a handle repeated inside one batch collapses to the first", () => {
    const result = addProposals(
      [candidateInput(), candidateInput({ creator: "Duplicate" })],
      { proposalsPath, configPath, now: "2026-08-22T12:00:00.000Z" }
    );
    assert.equal(result.added.length, 1);
    assert.equal(result.skipped.length, 1);
  });
});

describe("approval is the only config write path", () => {
  test("discovering never touches the config", () => {
    const before = readFileSync(configPath, "utf8");
    add();
    assert.equal(readFileSync(configPath, "utf8"), before);
  });

  test("approve writes a correctly shaped and correctly cited config entry", () => {
    add();
    const result = approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    assert.equal(result.ok, true);

    const text = readFileSync(configPath, "utf8");
    // The citation wraps across comment lines the way the rest of the file does, so match it
    // unwrapped.
    const unwrapped = text.replace(/\n\s*# /g, " ");
    const config = parse(text) as { accounts: { handle: string | null; creator: string; platform: string; niche: string; followers: number | null }[] };
    const entry = config.accounts.find((a) => a.handle === "@someone");
    assert.ok(entry, "the approved account is in the accounts list");
    assert.equal(entry.creator, "Some One");
    assert.equal(entry.platform, "substack");
    assert.equal(entry.niche, "inner-journey");
    assert.equal(entry.followers, null);

    // Cited the way every hand-written account in that file is cited.
    assert.match(unwrapped, /Proposed by patterns:discover on 2026-08-22, approved by Muxin on 2026-08-23\./);
    assert.match(unwrapped, /Evidence: https:\/\/someone\.substack\.com\/p\/a-real-post, 412 likes, 33 comments, retrieved 2026-08-22\./);
    assert.match(unwrapped, /Source: recommended by @neuranne on substack, seen at https:\/\/substack\.com\/@neuranne\./);
    assert.match(unwrapped, /Niche is the proposing account's niche, not a verified read of this one\./);
    assert.equal(/[–—]/.test(unwrapped), false);
  });

  test("approve flips the proposal to approved and stamps the date", () => {
    add();
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const stored = readProposals(proposalsPath);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].status, "approved");
    assert.equal(stored[0].decided_at, "2026-08-23T09:00:00.000Z");
  });

  test("approving twice is refused", () => {
    add();
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const second = approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-24T09:00:00.000Z" });
    assert.equal(second.ok, false);
    assert.match(second.message, /already approved/);
  });

  test("approving an unknown handle is refused and writes nothing", () => {
    const before = readFileSync(configPath, "utf8");
    const result = approveProposal("@nobody", { proposalsPath, configPath });
    assert.equal(result.ok, false);
    assert.match(result.message, /No proposal for @nobody/);
    assert.equal(readFileSync(configPath, "utf8"), before);
  });

  test("a handle proposed on two platforms refuses to approve without --platform", () => {
    add();
    addProposals([candidateInput({ platform: "linkedin" })], { proposalsPath, configPath, now: "2026-08-22T12:00:00.000Z" });

    const ambiguous = approveProposal("@someone", { proposalsPath, configPath });
    assert.equal(ambiguous.ok, false);
    assert.match(ambiguous.message, /more than one platform \(substack, linkedin\)/);

    const resolved = approveProposal("@someone", { platform: "linkedin", proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.proposal?.platform, "linkedin");
  });

  test("a rejected proposal can still be approved later, since reject only stops re-proposing", () => {
    add();
    rejectProposal("@someone", { proposalsPath, reason: "off niche" });
    const result = approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    assert.equal(result.ok, true);
    assert.equal(readProposals(proposalsPath)[0].status, "approved");
  });

  test("the approved entry lands inside the accounts block, not after it", () => {
    add();
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const lines = readFileSync(configPath, "utf8").split("\n");
    const entryAt = lines.findIndex((l) => l.includes('- handle: "@someone"'));
    const thresholdsAt = lines.findIndex((l) => /^outlier_thresholds:/.test(l));
    assert.ok(entryAt > 0);
    assert.ok(entryAt < thresholdsAt, "the entry sits above the next top level key");
  });

  test("the entry never splits a comment from the key it documents", () => {
    add();
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const lines = readFileSync(configPath, "utf8").split("\n");
    const thresholdsAt = lines.findIndex((l) => /^outlier_thresholds:/.test(l));
    assert.equal(lines[thresholdsAt - 1], "# Either bar clearing marks a post as an outlier worth studying.");

    // And the rest of the file still means what it meant.
    const config = parse(readFileSync(configPath, "utf8")) as Record<string, any>;
    assert.equal(config.outlier_thresholds.substack.view_follower_ratio, 1.5);
    assert.equal(config.targets.corpus_size_min, 20);
    assert.equal(config.discovery.request_delay_ms, 1234);
  });

  test("a search proposal is cited to the term and the results page", () => {
    addProposals(
      [
        candidateInput({
          handle: "@viafind",
          source: {
            relation: "search",
            platform: "substack",
            niche: "virality-growth",
            url: "https://substack.com/search/how%20to%20write%20a%20hook?searchType=posts",
            term: "how to write a hook",
          },
        }),
      ],
      { proposalsPath, configPath, now: "2026-08-22T12:00:00.000Z" }
    );
    approveProposal("@viafind", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const unwrapped = readFileSync(configPath, "utf8").replace(/\n\s*# /g, " ");
    assert.match(
      unwrapped,
      /Source: found by searching substack for "how to write a hook", results page https:\/\/substack\.com\/search\/how%20to%20write%20a%20hook\?searchType=posts\./
    );
    assert.match(unwrapped, /Evidence: https:\/\/someone\.substack\.com\/p\/a-real-post, 412 likes, 33 comments, retrieved 2026-08-22\./);
    assert.match(unwrapped, /Niche is the niche of the search term that found it, not a verified read of this account\./);
  });

  test("a proposal with no readable display name says so instead of inventing one", () => {
    add({ creator: null });
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const text = readFileSync(configPath, "utf8");
    assert.match(text, /creator: someone/);
    assert.match(text, /display name was not readable at proposal time/);
  });

  test("no em dash reaches the config", () => {
    add();
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const text = readFileSync(configPath, "utf8");
    assert.equal(/[–—]/.test(text), false, "no en dash or em dash in the written entry");
  });
});

describe("rejection", () => {
  test("reject flips the status, records the reason, and leaves the config alone", () => {
    add();
    const before = readFileSync(configPath, "utf8");
    const result = rejectProposal("@someone", { proposalsPath, reason: "grievance register", now: "2026-08-23T09:00:00.000Z" });
    assert.equal(result.ok, true);
    const stored = readProposals(proposalsPath);
    assert.equal(stored[0].status, "rejected");
    assert.equal(stored[0].reject_reason, "grievance register");
    assert.equal(stored[0].decided_at, "2026-08-23T09:00:00.000Z");
    assert.equal(readFileSync(configPath, "utf8"), before);
  });

  test("rejecting an already approved account is refused", () => {
    add();
    approveProposal("@someone", { proposalsPath, configPath, now: "2026-08-23T09:00:00.000Z" });
    const result = rejectProposal("@someone", { proposalsPath });
    assert.equal(result.ok, false);
    assert.match(result.message, /already approved/);
  });
});

describe("the run", () => {
  const settings = {
    platforms: ["substack" as const],
    search_terms: {},
    crawl_configured_accounts: true,
    request_delay_ms: 1,
    max_terms_per_niche: 4,
    max_results_per_term: 10,
    max_seed_accounts_per_platform: 8,
    max_candidates_per_seed: 10,
    max_proposals_per_run: 15,
  };

  const seed = { handle: "@neuranne", platform: "substack" as const, niche: "inner-journey", creator: "Anne-Laure Le Cunff" };

  function candidate(handle: string): Candidate {
    return { handle, creator: "Some One", platform: "substack", niche: "inner-journey", relation: "recommended", sourceUrl: "https://substack.com/@neuranne", seedHandle: "@neuranne" };
  }

  function hit(handle: string, evidence: ProposalEvidence | null, term = "burnout recovery"): SearchHit {
    return {
      handle,
      creator: "Some One",
      platform: "substack",
      niche: "inner-journey",
      relation: "search",
      sourceUrl: `https://substack.com/search/${encodeURIComponent(term)}?searchType=posts`,
      term,
      evidence,
    };
  }

  // A source with both halves stubbed. Search returns per-term hits; crawl returns candidates.
  function fakeSource(opts: {
    hits?: Record<string, SearchHit[]>;
    candidates?: Candidate[];
    evidenceFor?: (c: Candidate) => ProposalEvidence | null;
    onSearch?: (term: string) => void;
    onFetch?: (c: Candidate) => void;
  }): DiscoverySource {
    return {
      platform: "substack",
      async search(_context, term) {
        opts.onSearch?.(term);
        return opts.hits?.[term] ?? [];
      },
      async findCandidates() {
        return opts.candidates ?? [];
      },
      async fetchEvidence(_context, c) {
        opts.onFetch?.(c);
        return opts.evidenceFor ? opts.evidenceFor(c) : null;
      },
    };
  }

  function run(overrides: Partial<Parameters<typeof runPlatform>[0]>) {
    return runPlatform({
      settings,
      niches: [],
      seeds: [],
      source: fakeSource({}),
      context: {} as never,
      proposalsPath,
      configPath,
      now: "2026-08-22T12:00:00.000Z",
      delay: async () => {},
      ...overrides,
    });
  }

  test("search is the primary mechanism and its evidence is the post that matched", async () => {
    const report = await run({
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      source: fakeSource({ hits: { "burnout recovery": [hit("@fromsearch", evidence())] } }),
    });
    assert.equal(report.terms, 1);
    assert.equal(report.from_search, 1);
    assert.equal(report.from_crawl, 0);
    assert.equal(report.proposed, 1);

    const stored = readProposals(proposalsPath);
    assert.equal(stored[0].source.relation, "search");
    assert.equal(stored[0].source.term, "burnout recovery");
    assert.match(stored[0].why, /A post of theirs matched one of the inner-journey search terms on substack/);
  });

  test("a search hit with no numbers on the results page falls back to a fetch", async () => {
    const fetched: string[] = [];
    const report = await run({
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      source: fakeSource({
        hits: { "burnout recovery": [hit("@needsfetch", null)] },
        onFetch: (c) => fetched.push(c.handle),
        evidenceFor: () => evidence({ url: "https://needsfetch.substack.com/p/x" }),
      }),
    });
    assert.deepEqual(fetched, ["@needsfetch"]);
    assert.equal(report.proposed, 1);
    assert.equal(readProposals(proposalsPath)[0].evidence.url, "https://needsfetch.substack.com/p/x");
  });

  test("a search hit with no citable post anywhere never becomes a proposal", async () => {
    const report = await run({
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      source: fakeSource({ hits: { "burnout recovery": [hit("@nothing", null)] }, evidenceFor: () => null }),
    });
    assert.equal(report.proposed, 0);
    assert.equal(readProposals(proposalsPath).length, 0);
    assert.ok(report.skipped.some((s) => s.handle === "@nothing" && /no citable post/.test(s.reason)));
  });

  test("search results are ranked by the numbers on the posts, best first", async () => {
    const report = await run({
      settings: { ...settings, max_proposals_per_run: 2 },
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      source: fakeSource({
        hits: {
          "burnout recovery": [
            hit("@small", evidence({ url: "https://a.substack.com/p/1", metrics: { views: null, likes: 5, comments: 1, shares: null, followers: null } })),
            hit("@biggest", evidence({ url: "https://b.substack.com/p/2", metrics: { views: null, likes: 900, comments: 40, shares: null, followers: null } })),
            hit("@middle", evidence({ url: "https://c.substack.com/p/3", metrics: { views: null, likes: 100, comments: 2, shares: null, followers: null } })),
          ],
        },
      }),
    });
    assert.equal(report.proposed, 2);
    assert.deepEqual(readProposals(proposalsPath).map((p) => p.handle), ["@biggest", "@middle"]);
  });

  test("a real view count outranks engagement, and a missing number is not guessed", () => {
    assert.equal(engagementScore({ views: 50_000, likes: 1, comments: null, shares: null, followers: null }), 50_000);
    assert.equal(engagementScore({ views: null, likes: 10, comments: 5, shares: null, followers: null }), 15);
    assert.equal(engagementScore({ views: null, likes: null, comments: null, shares: null, followers: 900_000 }), 0);
  });

  test("crawling configured accounts still runs as the second pass", async () => {
    const report = await run({
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      seeds: [seed],
      source: fakeSource({
        hits: { "burnout recovery": [hit("@fromsearch", evidence({ url: "https://s.substack.com/p/1" }))] },
        candidates: [candidate("@fromcrawl")],
        evidenceFor: () => evidence({ url: "https://c.substack.com/p/2" }),
      }),
    });
    assert.equal(report.from_search, 1);
    assert.equal(report.from_crawl, 1);
    const stored = readProposals(proposalsPath);
    assert.deepEqual(stored.map((p) => p.source.relation), ["search", "recommended"]);
    assert.equal(stored[1].source.handle, "@neuranne");
  });

  test("crawl_configured_accounts false leaves search as the only mechanism", async () => {
    const report = await run({
      settings: { ...settings, crawl_configured_accounts: false },
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      seeds: [seed],
      source: fakeSource({
        hits: { "burnout recovery": [hit("@fromsearch", evidence())] },
        candidates: [candidate("@fromcrawl")],
        evidenceFor: () => evidence({ url: "https://c.substack.com/p/2" }),
      }),
    });
    assert.equal(report.seeds, 0);
    assert.equal(report.from_crawl, 0);
    assert.deepEqual(readProposals(proposalsPath).map((p) => p.handle), ["@fromsearch"]);
  });

  test("one per-run cap covers both mechanisms", async () => {
    const report = await run({
      settings: { ...settings, max_proposals_per_run: 2 },
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      seeds: [seed],
      source: fakeSource({
        hits: {
          "burnout recovery": [
            hit("@a", evidence({ url: "https://a.substack.com/p/1", metrics: { views: null, likes: 900, comments: 1, shares: null, followers: null } })),
            hit("@b", evidence({ url: "https://b.substack.com/p/2", metrics: { views: null, likes: 800, comments: 1, shares: null, followers: null } })),
            hit("@c", evidence({ url: "https://c.substack.com/p/3", metrics: { views: null, likes: 700, comments: 1, shares: null, followers: null } })),
          ],
        },
        candidates: [candidate("@fromcrawl")],
        evidenceFor: () => evidence({ url: "https://d.substack.com/p/4" }),
      }),
    });
    assert.equal(report.proposed, 2);
    assert.equal(report.from_crawl, 0, "the cap was already full before the crawl pass");
  });

  test("politeness: a wait happens before every request", async () => {
    let waited = 0;
    await run({
      settings: { ...settings, request_delay_ms: 10 },
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      seeds: [seed],
      source: fakeSource({
        hits: { "burnout recovery": [hit("@needsfetch", null)] },
        candidates: [candidate("@fromcrawl")],
        evidenceFor: () => evidence({ url: "https://x.substack.com/p/1" }),
      }),
      delay: async (ms) => {
        waited += ms;
      },
    });
    // one search, one evidence fetch after it, one seed walk, one evidence fetch after that.
    assert.equal(waited, 40);
  });

  test("a second run over the same results proposes nothing new and spends no evidence request", async () => {
    const source = fakeSource({ hits: { "burnout recovery": [hit("@someone", evidence())] } });
    const niches = [{ niche: "inner-journey", terms: ["burnout recovery"] }];
    const first = await run({ niches, source });
    const second = await run({ niches, source });
    assert.equal(first.proposed, 1);
    assert.equal(second.proposed, 0);
    assert.equal(second.candidates, 0);
    assert.equal(readProposals(proposalsPath).length, 1);
  });

  test("a candidate already in the config is skipped before any evidence request", async () => {
    let evidenceCalls = 0;
    const report = await run({
      niches: [{ niche: "inner-journey", terms: ["burnout recovery"] }],
      source: fakeSource({
        hits: { "burnout recovery": [hit("@neuranne", null)] },
        onFetch: () => {
          evidenceCalls++;
        },
        evidenceFor: () => evidence(),
      }),
    });
    assert.equal(evidenceCalls, 0);
    assert.equal(report.proposed, 0);
    assert.match(report.skipped[0].reason, /already in config/);
  });

  test("a platform that blocks during search is recorded and stopped for the run", async () => {
    const { PullError } = await import("../pull/errors.js");
    const report = await run({
      niches: [{ niche: "inner-journey", terms: ["first term", "second term"] }],
      seeds: [seed],
      source: {
        platform: "substack",
        async search() {
          throw new PullError("UNKNOWN", "substack signalled a block on https://substack.com/search/first%20term");
        },
        async findCandidates() {
          return [candidate("@fromcrawl")];
        },
        async fetchEvidence() {
          return evidence();
        },
      },
    });
    assert.equal(report.terms, 1, "it stopped after the block instead of running the second term");
    assert.equal(report.seeds, 0, "and never started the crawl pass");
    assert.equal(report.proposed, 0);
    assert.ok(report.failures.some((f) => /stopping this platform for the run/.test(f.reason)));
  });
});

describe("config reading", () => {
  test("discovery settings come from the config", () => {
    const settings = loadDiscoverySettings(configPath);
    assert.deepEqual(settings.platforms, ["substack", "linkedin"]);
    assert.equal(settings.crawl_configured_accounts, true);
    assert.equal(settings.request_delay_ms, 1234);
    assert.equal(settings.max_terms_per_niche, 2);
    assert.equal(settings.max_results_per_term, 5);
    assert.equal(settings.max_seed_accounts_per_platform, 2);
    assert.equal(settings.max_candidates_per_seed, 3);
    assert.equal(settings.max_proposals_per_run, 4);
  });

  test("search terms come from the config, never from the code", () => {
    const settings = loadDiscoverySettings(configPath);
    assert.deepEqual(settings.search_terms["inner-journey"], ["burnout recovery", "inner work"]);
    assert.deepEqual(settings.search_terms["virality-growth"], ["how to write a hook"]);
    // An empty list is not a niche to search.
    assert.equal(settings.search_terms["civic-democracy"], undefined);
  });

  test("terms are listed in the config's niche order, capped per niche", () => {
    const settings = loadDiscoverySettings(configPath);
    const niches = nichesFor({ ...settings, max_terms_per_niche: 1 }, configPath);
    assert.deepEqual(niches, [
      { niche: "inner-journey", terms: ["burnout recovery"] },
      { niche: "virality-growth", terms: ["how to write a hook"] },
    ]);
  });

  test("a niche with no terms is not searched for its own name", () => {
    const settings = loadDiscoverySettings(configPath);
    assert.equal(nichesFor(settings, configPath).some((n) => n.niche === "civic-democracy"), false);
  });

  test("seeds skip null handles and other platforms", () => {
    const seeds = seedsFor("substack", configPath);
    assert.deepEqual(seeds.map((s) => s.handle), ["@neuranne"]);
    assert.deepEqual(seedsFor("linkedin", configPath).map((s) => s.handle), ["@justinwelsh"]);
  });

  test("--account narrows the seeds", () => {
    assert.equal(seedsFor("substack", configPath, "@nobody").length, 0);
    assert.equal(seedsFor("substack", configPath, "@NeurAnne").length, 1);
  });
});

describe("plumbing", () => {
  test("proposal keys are per platform and case insensitive", () => {
    assert.equal(proposalKey("substack", "@NeurAnne"), proposalKey("substack", "neuranne"));
    assert.notEqual(proposalKey("substack", "@a"), proposalKey("linkedin", "@a"));
  });

  test("parseArgs reads the flags the CLI documents", () => {
    const args = parseArgs(["--platform", "substack", "--account", "@neuranne", "--limit", "3", "--dry-run"]);
    assert.deepEqual(args.platforms, ["substack"]);
    assert.equal(args.account, "@neuranne");
    assert.equal(args.limit, 3);
    assert.equal(args.dryRun, true);
  });

  test("parseArgs refuses a platform discovery does not cover", () => {
    assert.throws(() => parseArgs(["--platform", "tiktok"]), /not one of/);
  });

  test("the rendered entry carries no em dash and parses as yaml", () => {
    const { proposal } = buildProposal(candidateInput(), "2026-08-22T12:00:00.000Z");
    const text = renderConfigEntry(proposal as AccountProposal, "2026-08-23");
    assert.equal(/[–—]/.test(text), false);
    const parsed = parse(`accounts:\n${text}\n`) as { accounts: { handle: string }[] };
    assert.equal(parsed.accounts[0].handle, "@someone");
  });

  test("insertAccountEntry refuses a file with no accounts list", () => {
    assert.throws(() => insertAccountEntry("niches:\n  - a\n", "  - handle: \"@x\"\n"), /no top level `accounts:` list/);
  });
});

// The defect this guards against was found on the live page, not in a test: Chenell Basilio's
// Substack profile shows a post she reposted from another writer, and the first version cited HIS
// post as evidence for HER account. Evidence has to be demonstrably the candidate's own post.
describe("substack evidence proves the post is theirs", () => {
  function post(handle: string, url: string, reactions: number, comments: number) {
    return { canonical_url: url, reaction_count: reactions, comment_count: comments, post_date: "2026-08-01T00:00:00.000Z", title: "a post", publishedBylines: [{ name: handle, handle }] };
  }

  // A stub of just the two things substackSource.fetchEvidence touches: the archive endpoint and
  // one page whose links name the publications to try.
  function stubContext(archives: Record<string, unknown[]>, profileHosts: string[] = []) {
    return {
      request: {
        get: async (url: string) => {
          const host = new URL(url).host;
          const posts = archives[host];
          return { ok: () => posts !== undefined, status: () => (posts ? 200 : 404), json: async () => posts ?? [] };
        },
      },
      newPage: async () => ({
        goto: async () => undefined,
        waitForSelector: async () => null,
        evaluate: async () => profileHosts,
        close: async () => undefined,
        url: () => "https://substack.com/@someone",
      }),
    } as unknown as Parameters<typeof substackSource.fetchEvidence>[0];
  }

  const candidate = {
    handle: "@chenell",
    creator: "Chenell Basilio",
    platform: "substack" as const,
    niche: "virality-growth",
    relation: "search" as const,
    sourceUrl: "https://substack.com/search/newsletter%20growth?searchType=posts",
    term: "newsletter growth",
  };

  test("a post by someone else is not cited, even when it is the only one there", async () => {
    const context = stubContext({ "stevekamb.substack.com": [post("stevekamb", "https://stevekamb.substack.com/p/his-post", 25, 12)] }, ["stevekamb.substack.com"]);
    assert.equal(await substackSource.fetchEvidence(context, candidate), null);
  });

  test("their own post is cited, with the archive's real numbers", async () => {
    const context = stubContext(
      {
        "stevekamb.substack.com": [post("stevekamb", "https://stevekamb.substack.com/p/his-post", 25, 12)],
        "growthinreverse.substack.com": [post("chenell", "https://growthinreverse.substack.com/p/her-post", 4, 0)],
      },
      ["stevekamb.substack.com", "growthinreverse.substack.com"]
    );
    const evidence = await substackSource.fetchEvidence(context, candidate);
    assert.equal(evidence?.url, "https://growthinreverse.substack.com/p/her-post");
    assert.deepEqual(evidence?.metrics, { views: null, likes: 4, comments: 0, shares: null, followers: null });
    // Substack shows a non-owner no view count, so it stays null rather than borrowing the likes.
    assert.equal(evidence?.metrics.views, null);
  });

  test("the post that matched the search wins over their more popular one", async () => {
    const context = stubContext({
      "growthinreverse.substack.com": [
        post("chenell", "https://growthinreverse.substack.com/p/popular", 900, 40),
        post("chenell", "https://growthinreverse.substack.com/p/matched", 12, 3),
      ],
    });
    const evidence = await substackSource.fetchEvidence(context, { ...candidate, postUrl: "https://growthinreverse.substack.com/p/matched?utm_source=x" });
    assert.equal(evidence?.url, "https://growthinreverse.substack.com/p/matched");
  });
});

describe("names read off a live page", () => {
  test("LinkedIn's doubled name is undoubled, and nothing else is touched", () => {
    // Observed live 2026-08-22: the anchor text read "Jonathan WeberJonathan Weber".
    assert.equal(undoubleName("Jonathan WeberJonathan Weber"), "Jonathan Weber");
    assert.equal(undoubleName("David PierceDavid Pierce"), "David Pierce");
    // A real name that happens to repeat a word is not mangled.
    assert.equal(undoubleName("Ana Calin"), "Ana Calin");
    assert.equal(undoubleName("Sarah Sarah Lee"), "Sarah Sarah Lee");
    assert.equal(undoubleName("  "), null);
    assert.equal(undoubleName(null), null);
  });
});

describe("linkedin reaction counts", () => {
  test("a labelled aria-label is used as is", () => {
    // Observed live 2026-08-22 on the recent-activity page.
    assert.equal(linkedinReactionCount("3,233 reactions", "3,233"), 3233);
    assert.equal(linkedinReactionCount("4,127 reactions", "4,127"), 4127);
  });

  test("an unlabelled aria-label is ignored in favour of the button's own total", () => {
    // The trap: aria said "Maddy Viswanath and 370 others" while the real total was 371. Reading
    // a number out of that aria-label would be off by one, every time, in the same direction.
    assert.equal(linkedinReactionCount("Maddy Viswanath and 370 others", "371"), 371);
  });

  test("no button and no label means null, never a number from somewhere else", () => {
    assert.equal(linkedinReactionCount(null, null), null);
    assert.equal(linkedinReactionCount("Reaction button state: no reaction", "Like"), null);
  });
});
