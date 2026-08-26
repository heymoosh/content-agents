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
  readinessTotal: 576,
  readinessReady: 0,
  readinessBlocked: 576,
  readinessUnmapped: 0,
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

// Reject anything but the two placeholder values these fields are allowed to carry while
// every row stays pending/blocked: an explicit "reviewed"/"ready"/"unmapped" claim must fail.
function checkPlaceholderField(lane, rowKind, rowId, fieldName, value, allowedNonNull) {
  if (value === undefined || value === null) return;
  if (value === allowedNonNull) return;
  fail(`${lane}: ${rowKind} ${rowId} has ${fieldName} "${value}", expected null or "${allowedNonNull}"`);
}

function rowId(row) {
  return row.id ?? row.sourceId ?? row.currentAccountKey ?? row.accountId ?? '(unknown id)';
}

const summaryPath = path.join(here, 'summary.json');
const summary = readJson(summaryPath);

const laneAccountKeys = {};
const laneReports = {};
let unionAccountKeys = [];

// Independently totaled across all three intake reports' accounts + evidence + baselines rows.
let globalRowTotal = 0;
let globalBlocked = 0;
let globalReady = 0;
let globalUnmapped = 0;
let globalOtherStatus = 0;

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
  const laneRowTotal = expected.accounts + expected.evidence + expected.baselines;

  if (accounts.length !== expected.accounts) {
    fail(`${lane}: expected ${expected.accounts} account rows, found ${accounts.length}`);
  }
  if (evidence.length !== expected.evidence) {
    fail(`${lane}: expected ${expected.evidence} evidence rows, found ${evidence.length}`);
  }
  if (baselines.length !== expected.baselines) {
    fail(`${lane}: expected ${expected.baselines} baseline rows, found ${baselines.length}`);
  }

  // Per-category summary block: total/ready/blocked/unmapped must each be exact, not just total.
  const categories = { accounts: { rows: accounts, count: expected.accounts }, evidence: { rows: evidence, count: expected.evidence }, baselines: { rows: baselines, count: expected.baselines } };
  if (intake.summary) {
    for (const [key, { count }] of Object.entries(categories)) {
      const s = intake.summary[key];
      if (!s) { fail(`${lane}: intake-report.json summary.${key} missing`); continue; }
      if (s.total !== count) fail(`${lane}: intake-report.json summary.${key}.total mismatch (${s.total} != ${count})`);
      if (s.ready !== 0) fail(`${lane}: intake-report.json summary.${key}.ready expected 0, found ${s.ready}`);
      if (s.blocked !== count) fail(`${lane}: intake-report.json summary.${key}.blocked expected ${count}, found ${s.blocked}`);
      if (s.unmapped !== 0) fail(`${lane}: intake-report.json summary.${key}.unmapped expected 0, found ${s.unmapped}`);
    }
    const t = intake.summary.total;
    if (!t) {
      fail(`${lane}: intake-report.json summary.total missing`);
    } else {
      if (t.total !== laneRowTotal) fail(`${lane}: intake-report.json summary.total.total mismatch (${t.total} != ${laneRowTotal})`);
      if (t.ready !== 0) fail(`${lane}: intake-report.json summary.total.ready expected 0, found ${t.ready}`);
      if (t.blocked !== laneRowTotal) fail(`${lane}: intake-report.json summary.total.blocked expected ${laneRowTotal}, found ${t.blocked}`);
      if (t.unmapped !== 0) fail(`${lane}: intake-report.json summary.total.unmapped expected 0, found ${t.unmapped}`);
    }
  } else {
    fail(`${lane}: intake-report.json missing summary block`);
  }

  // Top-level readiness block: status, total, ready, blocked, unmapped all asserted exactly.
  if (intake.readiness) {
    if (intake.readiness.status !== 'blocked') fail(`${lane}: intake-report.json readiness.status expected "blocked", found "${intake.readiness.status}"`);
    if (intake.readiness.total !== laneRowTotal) fail(`${lane}: intake-report.json readiness.total mismatch (${intake.readiness.total} != ${laneRowTotal})`);
    if (intake.readiness.ready !== 0) fail(`${lane}: intake-report.json readiness.ready expected 0, found ${intake.readiness.ready}`);
    if (intake.readiness.blocked !== laneRowTotal) fail(`${lane}: intake-report.json readiness.blocked expected ${laneRowTotal}, found ${intake.readiness.blocked}`);
    if (intake.readiness.unmapped !== 0) fail(`${lane}: intake-report.json readiness.unmapped expected 0, found ${intake.readiness.unmapped}`);
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

  // Every evidence/baseline row's status and reviewStatus must be null or the one pending/blocked
  // placeholder value; anything else (including an explicit "reviewed"/"ready"/"unmapped" claim)
  // fails closed instead of being silently ignored.
  for (const e of evidence) {
    checkPlaceholderField(lane, 'evidence row', rowId(e), 'status', e.status, 'blocked');
    checkPlaceholderField(lane, 'evidence row', rowId(e), 'reviewStatus', e.reviewStatus, 'pending');
  }
  for (const b of baselines) {
    checkPlaceholderField(lane, 'baseline row', rowId(b), 'status', b.status, 'blocked');
    checkPlaceholderField(lane, 'baseline row', rowId(b), 'reviewStatus', b.reviewStatus, 'pending');
  }

  // Every row (account, evidence, baseline) must carry readiness.status === "blocked" exactly;
  // this is the independent per-row check backing the totals asserted below.
  const allRows = [
    ...accounts.map((r) => ({ row: r, kind: 'account' })),
    ...evidence.map((r) => ({ row: r, kind: 'evidence' })),
    ...baselines.map((r) => ({ row: r, kind: 'baseline' })),
  ];
  for (const { row, kind } of allRows) {
    const status = row.readiness && row.readiness.status;
    globalRowTotal += 1;
    if (status === 'blocked') {
      globalBlocked += 1;
    } else if (status === 'ready') {
      globalReady += 1;
      fail(`${lane}: ${kind} ${rowId(row)} has readiness.status "ready", expected "blocked"`);
    } else if (status === 'unmapped') {
      globalUnmapped += 1;
      fail(`${lane}: ${kind} ${rowId(row)} has readiness.status "unmapped", expected "blocked"`);
    } else {
      globalOtherStatus += 1;
      fail(`${lane}: ${kind} ${rowId(row)} has readiness.status "${status}", expected "blocked"`);
    }
  }
}

// Independently totaled readiness assertion across all three lanes' actual rows (not the
// hardcoded LANE_TOTALS constants): exactly 576 blocked, 0 ready, 0 unmapped, 0 other.
if (globalRowTotal !== FIXED.readinessTotal) fail(`independently counted rows across accounts+evidence+baselines is ${globalRowTotal}, expected ${FIXED.readinessTotal}`);
if (globalBlocked !== FIXED.readinessBlocked) fail(`independently counted blocked rows is ${globalBlocked}, expected ${FIXED.readinessBlocked}`);
if (globalReady !== FIXED.readinessReady) fail(`independently counted ready rows is ${globalReady}, expected ${FIXED.readinessReady}`);
if (globalUnmapped !== FIXED.readinessUnmapped) fail(`independently counted unmapped rows is ${globalUnmapped}, expected ${FIXED.readinessUnmapped}`);
if (globalOtherStatus !== 0) fail(`independently counted ${globalOtherStatus} row(s) with a readiness.status other than blocked/ready/unmapped`);

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
  if (s.readinessTotal !== FIXED.readinessTotal) fail(`summary.json totals.readinessTotal is ${s.readinessTotal}, expected ${FIXED.readinessTotal}`);
  if (s.readinessReady !== FIXED.readinessReady) fail(`summary.json totals.readinessReady is ${s.readinessReady}, expected ${FIXED.readinessReady}`);
  if (s.readinessBlocked !== FIXED.readinessBlocked) fail(`summary.json totals.readinessBlocked is ${s.readinessBlocked}, expected ${FIXED.readinessBlocked}`);
  if (s.readinessUnmapped !== FIXED.readinessUnmapped) fail(`summary.json totals.readinessUnmapped is ${s.readinessUnmapped}, expected ${FIXED.readinessUnmapped}`);
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
    const laneRowTotal = expected.accounts + expected.evidence + expected.baselines;
    if (laneSummary.accounts?.total !== expected.accounts) fail(`summary.json lanes.${lane}.accounts.total mismatch`);
    if (laneSummary.evidence?.total !== expected.evidence) fail(`summary.json lanes.${lane}.evidence.total mismatch`);
    if (laneSummary.baselines?.total !== expected.baselines) fail(`summary.json lanes.${lane}.baselines.total mismatch`);
    if (laneSummary.proposals?.recommend !== expected.recommend) fail(`summary.json lanes.${lane}.proposals.recommend mismatch`);
    if (laneSummary.proposals?.hold !== expected.hold) fail(`summary.json lanes.${lane}.proposals.hold mismatch`);
    if (laneSummary.proposals?.research_further !== expected.research_further) fail(`summary.json lanes.${lane}.proposals.research_further mismatch`);

    const laneReadiness = laneSummary.readiness;
    if (!laneReadiness) {
      fail(`summary.json lanes.${lane}.readiness missing`);
    } else {
      if (laneReadiness.status !== 'blocked') fail(`summary.json lanes.${lane}.readiness.status expected "blocked", found "${laneReadiness.status}"`);
      if (laneReadiness.total !== laneRowTotal) fail(`summary.json lanes.${lane}.readiness.total mismatch (${laneReadiness.total} != ${laneRowTotal})`);
      if (laneReadiness.ready !== 0) fail(`summary.json lanes.${lane}.readiness.ready expected 0, found ${laneReadiness.ready}`);
      if (laneReadiness.blocked !== laneRowTotal) fail(`summary.json lanes.${lane}.readiness.blocked expected ${laneRowTotal}, found ${laneReadiness.blocked}`);
      if (laneReadiness.unmapped !== 0) fail(`summary.json lanes.${lane}.readiness.unmapped expected 0, found ${laneReadiness.unmapped}`);
    }

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
} else {
  fail('summary.json could not be read/parsed');
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} mismatch(es) found\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('OK: consolidated review reconciliation verified.');
console.log(`  accounts=${FIXED.accounts} evidence=${FIXED.evidence} baselines=${FIXED.baselines}`);
console.log(`  proposals: recommend=${FIXED.recommend} hold=${FIXED.hold} research_further=${FIXED.research_further}`);
console.log(`  readiness: total=${globalRowTotal} blocked=${globalBlocked} ready=${globalReady} unmapped=${globalUnmapped}`);
console.log(`  unique account keys=${overallUniqueKeys.size}, zero duplicates, zero cross-lane overlap`);
process.exit(0);
