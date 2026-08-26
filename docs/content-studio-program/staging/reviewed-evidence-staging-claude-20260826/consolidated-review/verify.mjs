#!/usr/bin/env node
// Read-only, body-free reconciliation of summary.json against the three lane reports.
// Performs no writes. Exits nonzero on any mismatch.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const laneDir = path.dirname(here);

const LANES = ['text-community', 'professional-publishing', 'visual-video'];

const FIXED = {
  accounts: 65,
  evidence: 499,
  baselines: 12,
  recommend: 30,
  hold: 8,
  research_further: 27,
};

const LANE_TOTALS = {
  'text-community': { accounts: 31, evidence: 354, baselines: 12, recommend: 14, hold: 6, research_further: 11 },
  'professional-publishing': { accounts: 14, evidence: 70, baselines: 0, recommend: 11, hold: 0, research_further: 3 },
  'visual-video': { accounts: 20, evidence: 75, baselines: 0, recommend: 5, hold: 2, research_further: 13 },
};

const failures = [];

function fail(msg) {
  failures.push(msg);
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    fail(`could not read/parse ${p}: ${err.message}`);
    return null;
  }
}

function dispositionLabel(reason) {
  if (typeof reason !== 'string') return null;
  if (/\brecommend\b/i.test(reason)) return 'recommend';
  if (/\bhold\b/i.test(reason)) return 'hold';
  if (/\bresearch[_ ]further\b/i.test(reason)) return 'research_further';
  return null;
}

const summaryPath = path.join(here, 'summary.json');
const summary = readJson(summaryPath);

const laneAccountKeys = {};
const laneReports = {};
let unionAccountKeys = [];

for (const lane of LANES) {
  const intakePath = path.join(laneDir, lane, 'intake-report.json');
  const bridgePath = path.join(laneDir, lane, 'ledger-bridge-report.json');
  const intake = readJson(intakePath);
  const bridge = readJson(bridgePath);
  if (!intake || !bridge) continue;
  laneReports[lane] = { intake, bridge };

  const accounts = intake.rows && Array.isArray(intake.rows.accounts) ? intake.rows.accounts : [];
  const evidence = intake.rows && Array.isArray(intake.rows.evidence) ? intake.rows.evidence : [];
  const baselines = intake.rows && Array.isArray(intake.rows.baselines) ? intake.rows.baselines : [];

  const expected = LANE_TOTALS[lane];

  if (accounts.length !== expected.accounts) {
    fail(`${lane}: expected ${expected.accounts} account rows, found ${accounts.length}`);
  }
  if (evidence.length !== expected.evidence) {
    fail(`${lane}: expected ${expected.evidence} evidence rows, found ${evidence.length}`);
  }
  if (baselines.length !== expected.baselines) {
    fail(`${lane}: expected ${expected.baselines} baseline rows, found ${baselines.length}`);
  }

  if (intake.summary) {
    const s = intake.summary;
    if (s.accounts?.total !== expected.accounts) fail(`${lane}: intake-report.json summary.accounts.total mismatch (${s.accounts?.total} != ${expected.accounts})`);
    if (s.evidence?.total !== expected.evidence) fail(`${lane}: intake-report.json summary.evidence.total mismatch (${s.evidence?.total} != ${expected.evidence})`);
    if (s.baselines?.total !== expected.baselines) fail(`${lane}: intake-report.json summary.baselines.total mismatch (${s.baselines?.total} != ${expected.baselines})`);
  } else {
    fail(`${lane}: intake-report.json missing summary block`);
  }

  if (intake.readiness) {
    if (intake.readiness.status !== 'blocked') fail(`${lane}: intake-report.json readiness.status expected "blocked", found "${intake.readiness.status}"`);
    if (intake.readiness.ready !== 0) fail(`${lane}: intake-report.json readiness.ready expected 0, found ${intake.readiness.ready}`);
  } else {
    fail(`${lane}: intake-report.json missing readiness block`);
  }

  const bridgeCounts = bridge.counts || {};
  if (bridgeCounts.accounts !== expected.accounts) fail(`${lane}: ledger-bridge-report.json counts.accounts mismatch (${bridgeCounts.accounts} != ${expected.accounts})`);
  if (bridgeCounts.sources !== expected.evidence) fail(`${lane}: ledger-bridge-report.json counts.sources mismatch (${bridgeCounts.sources} != ${expected.evidence})`);
  if (bridgeCounts.baselines !== expected.baselines) fail(`${lane}: ledger-bridge-report.json counts.baselines mismatch (${bridgeCounts.baselines} != ${expected.baselines})`);
  if (bridge.bodyIncluded !== false) fail(`${lane}: ledger-bridge-report.json bodyIncluded expected false, found ${bridge.bodyIncluded}`);
  if (bridge.sideEffects !== 'none') fail(`${lane}: ledger-bridge-report.json sideEffects expected "none", found "${bridge.sideEffects}"`);

  const keys = accounts.map((a) => a.currentAccountKey).filter(Boolean);
  if (keys.length !== accounts.length) fail(`${lane}: one or more account rows missing currentAccountKey`);
  const uniqueLaneKeys = new Set(keys);
  if (uniqueLaneKeys.size !== keys.length) fail(`${lane}: duplicate account keys within lane`);
  laneAccountKeys[lane] = keys;
  unionAccountKeys = unionAccountKeys.concat(keys);

  const dispCounts = { recommend: 0, hold: 0, research_further: 0, unknown: 0 };
  for (const a of accounts) {
    const label = dispositionLabel(a.dispositionReason);
    if (label) dispCounts[label] += 1;
    else dispCounts.unknown += 1;
    if (a.disposition !== 'pending') {
      fail(`${lane}: account ${a.currentAccountKey} has disposition "${a.disposition}", expected "pending"`);
    }
  }
  if (dispCounts.unknown > 0) fail(`${lane}: ${dispCounts.unknown} account row(s) had an unparseable dispositionReason`);
  if (dispCounts.recommend !== expected.recommend) fail(`${lane}: recommend count mismatch (${dispCounts.recommend} != ${expected.recommend})`);
  if (dispCounts.hold !== expected.hold) fail(`${lane}: hold count mismatch (${dispCounts.hold} != ${expected.hold})`);
  if (dispCounts.research_further !== expected.research_further) fail(`${lane}: research_further count mismatch (${dispCounts.research_further} != ${expected.research_further})`);

  for (const e of evidence) {
    if (e.status !== undefined && e.status !== null && e.status !== 'blocked' && e.status !== 'pending') {
      // status field is not guaranteed present on every schema version; only flag an explicit reviewed/ready claim
    }
    if (e.reviewStatus === 'reviewed') fail(`${lane}: evidence row ${e.id ?? e.sourceId ?? '(unknown id)'} claims reviewStatus "reviewed"`);
  }
}

// Cross-lane account-key checks
const overallUniqueKeys = new Set(unionAccountKeys);
if (unionAccountKeys.length !== FIXED.accounts) {
  fail(`union of lane account keys has ${unionAccountKeys.length} entries, expected ${FIXED.accounts}`);
}
if (overallUniqueKeys.size !== unionAccountKeys.length) {
  fail(`union of lane account keys contains duplicates: ${unionAccountKeys.length} entries but only ${overallUniqueKeys.size} unique`);
}

// Pairwise disjointness across lanes
for (let i = 0; i < LANES.length; i += 1) {
  for (let j = i + 1; j < LANES.length; j += 1) {
    const a = new Set(laneAccountKeys[LANES[i]] || []);
    const b = laneAccountKeys[LANES[j]] || [];
    const overlap = b.filter((k) => a.has(k));
    if (overlap.length > 0) {
      fail(`account keys overlap between ${LANES[i]} and ${LANES[j]}: ${overlap.join(', ')}`);
    }
  }
}

// Fixed totals from the task packet
const totalAccounts = LANES.reduce((sum, l) => sum + (laneAccountKeys[l]?.length || 0), 0);
if (totalAccounts !== FIXED.accounts) fail(`total accounts across lanes is ${totalAccounts}, expected ${FIXED.accounts}`);

let totalEvidence = 0;
let totalBaselines = 0;
let totalRecommend = 0;
let totalHold = 0;
let totalResearchFurther = 0;
for (const lane of LANES) {
  const expected = LANE_TOTALS[lane];
  totalEvidence += expected.evidence;
  totalBaselines += expected.baselines;
  totalRecommend += expected.recommend;
  totalHold += expected.hold;
  totalResearchFurther += expected.research_further;
}
if (totalEvidence !== FIXED.evidence) fail(`total evidence rows across lanes is ${totalEvidence}, expected ${FIXED.evidence}`);
if (totalBaselines !== FIXED.baselines) fail(`total baselines across lanes is ${totalBaselines}, expected ${FIXED.baselines}`);
if (totalRecommend !== FIXED.recommend) fail(`total recommend across lanes is ${totalRecommend}, expected ${FIXED.recommend}`);
if (totalHold !== FIXED.hold) fail(`total hold across lanes is ${totalHold}, expected ${FIXED.hold}`);
if (totalResearchFurther !== FIXED.research_further) fail(`total research_further across lanes is ${totalResearchFurther}, expected ${FIXED.research_further}`);

// summary.json checks
if (summary) {
  const s = summary.totals || {};
  if (s.accounts !== FIXED.accounts) fail(`summary.json totals.accounts is ${s.accounts}, expected ${FIXED.accounts}`);
  if (s.evidence !== FIXED.evidence) fail(`summary.json totals.evidence is ${s.evidence}, expected ${FIXED.evidence}`);
  if (s.baselines !== FIXED.baselines) fail(`summary.json totals.baselines is ${s.baselines}, expected ${FIXED.baselines}`);
  const p = s.proposals || {};
  if (p.recommend !== FIXED.recommend) fail(`summary.json totals.proposals.recommend is ${p.recommend}, expected ${FIXED.recommend}`);
  if (p.hold !== FIXED.hold) fail(`summary.json totals.proposals.hold is ${p.hold}, expected ${FIXED.hold}`);
  if (p.research_further !== FIXED.research_further) fail(`summary.json totals.proposals.research_further is ${p.research_further}, expected ${FIXED.research_further}`);

  for (const lane of LANES) {
    const laneSummary = summary.lanes?.[lane];
    if (!laneSummary) {
      fail(`summary.json missing lanes.${lane}`);
      continue;
    }
    const expected = LANE_TOTALS[lane];
    if (laneSummary.accounts?.total !== expected.accounts) fail(`summary.json lanes.${lane}.accounts.total mismatch`);
    if (laneSummary.evidence?.total !== expected.evidence) fail(`summary.json lanes.${lane}.evidence.total mismatch`);
    if (laneSummary.baselines?.total !== expected.baselines) fail(`summary.json lanes.${lane}.baselines.total mismatch`);
    if (laneSummary.proposals?.recommend !== expected.recommend) fail(`summary.json lanes.${lane}.proposals.recommend mismatch`);
    if (laneSummary.proposals?.hold !== expected.hold) fail(`summary.json lanes.${lane}.proposals.hold mismatch`);
    if (laneSummary.proposals?.research_further !== expected.research_further) fail(`summary.json lanes.${lane}.proposals.research_further mismatch`);

    const laneKeysInSummary = Array.isArray(laneSummary.accountKeys) ? laneSummary.accountKeys : [];
    const actualLaneKeys = laneAccountKeys[lane] || [];
    const sortedSummaryKeys = [...laneKeysInSummary].sort();
    const sortedActualKeys = [...actualLaneKeys].sort();
    if (JSON.stringify(sortedSummaryKeys) !== JSON.stringify(sortedActualKeys)) {
      fail(`summary.json lanes.${lane}.accountKeys does not exactly match ${lane}/intake-report.json accounts`);
    }
  }

  // summary.accountKeys must exactly equal the union of the lane accounts (as sets)
  const summaryKeys = Array.isArray(summary.accountKeys) ? summary.accountKeys : [];
  const summaryKeySet = new Set(summaryKeys);
  if (summaryKeys.length !== summaryKeySet.size) {
    fail(`summary.json accountKeys contains duplicate entries`);
  }
  if (summaryKeySet.size !== overallUniqueKeys.size) {
    fail(`summary.json accountKeys has ${summaryKeySet.size} unique entries, expected ${overallUniqueKeys.size}`);
  }
  const missingFromSummary = [...overallUniqueKeys].filter((k) => !summaryKeySet.has(k));
  const extraInSummary = [...summaryKeySet].filter((k) => !overallUniqueKeys.has(k));
  if (missingFromSummary.length > 0) fail(`summary.json accountKeys is missing keys present in the lane reports: ${missingFromSummary.join(', ')}`);
  if (extraInSummary.length > 0) fail(`summary.json accountKeys has keys not present in any lane report: ${extraInSummary.join(', ')}`);

  const recon = summary.reconciliation || {};
  if (recon.duplicateCount !== 0) fail(`summary.json reconciliation.duplicateCount is ${recon.duplicateCount}, expected 0`);
  if (Array.isArray(recon.duplicateAccountKeys) && recon.duplicateAccountKeys.length !== 0) {
    fail(`summary.json reconciliation.duplicateAccountKeys is non-empty`);
  }
  if (recon.uniqueAccountKeyCount !== FIXED.accounts) fail(`summary.json reconciliation.uniqueAccountKeyCount is ${recon.uniqueAccountKeyCount}, expected ${FIXED.accounts}`);

  const auth = summary.authorization || {};
  if (auth.reviewed !== false) fail(`summary.json authorization.reviewed must be false`);
  if (auth.canonical !== false) fail(`summary.json authorization.canonical must be false`);
  if (auth.winnerOrBestClaim !== false) fail(`summary.json authorization.winnerOrBestClaim must be false`);
  if (auth.authorizesGeneration !== false) fail(`summary.json authorization.authorizesGeneration must be false`);
  if (auth.authorizesPublishing !== false) fail(`summary.json authorization.authorizesPublishing must be false`);
  if (auth.authorizesCanonicalWrite !== false) fail(`summary.json authorization.authorizesCanonicalWrite must be false`);
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} mismatch(es) found\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('OK: consolidated review reconciliation verified.');
console.log(`  accounts=${FIXED.accounts} evidence=${FIXED.evidence} baselines=${FIXED.baselines}`);
console.log(`  proposals: recommend=${FIXED.recommend} hold=${FIXED.hold} research_further=${FIXED.research_further}`);
console.log(`  unique account keys=${overallUniqueKeys.size}, zero duplicates, zero cross-lane overlap`);
process.exit(0);
