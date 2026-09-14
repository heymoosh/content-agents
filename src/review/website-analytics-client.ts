import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { WebsiteMeasurement } from './venture-actions.js';
import { dataRoot } from '../runtime/data-root.js';

const REPORT_VERSION = 'website-funnel-v1';
const MAX_ROWS = 500;
const MAX_TEXT = 300;
const LOCALHOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export interface WebsiteAnalyticsRow {
  platform: string;
  medium: string;
  referrerHost: string;
  campaign: string;
  variantId: string;
  sourcePost: string;
  landingPath: string;
  measuredSessions: number;
  newSignups: number;
  newSignupSessions: number;
  newSignupsWithoutSession: number;
  signupRate: number | null;
  surveyCompletions: number;
}

export interface WebsiteAnalyticsReport {
  reportVersion: string;
  capturedAt: string;
  range: { from: string; to: string; timezone: string };
  definitions: Record<string, string>;
  rows: WebsiteAnalyticsRow[];
  pageViews: Array<{ path: string; platform: string; medium: string; referrerHost: string; pageViews: number; sessions: number }>;
  needs: Record<string, { responseCount: number; unansweredCount?: number; shareDenominator?: string; categories: Array<{ answer: string; count: number; share: number | null }> }>;
  audience: { total: number; active: number; surveyCompletions: number; origin: { website: number; imported: number; unknown: number } };
  coverage: {
    measuredPageViews: number;
    measuredSessions: number;
    unattributedSessions: number;
    newSignups: number;
    newSignupsWithSession: number;
    newSignupsWithoutSession: number;
    newsletterFormStarts: number;
    newsletterFormSubmits: number;
    surveyStarts: number;
    newCohortSurveyCompletions: number;
    importedSurveyCompletions: number;
    otherSurveyCompletions: number;
    historicalAudienceOrigin?: string;
    clientTracking?: string;
  };
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function text(value: unknown, field: string, fallback = '') {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT) {
    if (fallback) return fallback;
    throw new Error(`Website analytics report has an invalid ${field}.`);
  }
  return value;
}

function count(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Website analytics report has an invalid ${field}.`);
  return number;
}

function ratio(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error('Website analytics report has an invalid rate.');
  return number;
}

function knownAnswer(value: unknown) {
  const answer = text(value, 'survey category');
  const allowed = new Set([
    'I just want to build things', 'I want to fix big problems', 'Both',
    'More freedom', 'Owning what I make', 'Work that actually feels good',
    'No idea what to build', "Got ideas but can't tell which ones matter", "Don't know how or when to use AI",
    'Feel alone or crazy for trying', 'Good ideas never happen', "Don't know what would actually help",
    'Everything feels broken', 'Stuck between doing good and making money', "Can't tell what's worth building",
    'The hard parts, failures, and wins', 'How I actually do the work', 'Figuring out what to do next',
    'Staying true to what matters most', '(other)', '(other/legacy)',
  ]);
  return allowed.has(answer) ? answer : '(other)';
}

function normalizeRow(value: unknown): WebsiteAnalyticsRow {
  const row = asRecord(value);
  return {
    platform: text(row.platform, 'row platform', '(unattributed)'),
    medium: text(row.medium, 'row medium', '(unknown)'),
    referrerHost: text(row.referrerHost, 'row referrer host', '(direct/unknown)'),
    campaign: text(row.campaign, 'row campaign', '(none)'),
    variantId: text(row.variantId, 'row variant', '(none)'),
    sourcePost: text(row.sourcePost, 'row source post', '(none)'),
    landingPath: text(row.landingPath, 'row landing path', '(unknown)'),
    measuredSessions: count(row.measuredSessions, 'row measured sessions'),
    newSignups: count(row.newSignups, 'row new signups'),
    newSignupSessions: count(row.newSignupSessions, 'row new signup sessions'),
    newSignupsWithoutSession: count(row.newSignupsWithoutSession, 'row signups without session'),
    signupRate: ratio(row.signupRate),
    surveyCompletions: count(row.surveyCompletions, 'row survey completions'),
  };
}

function normalizePageView(value: unknown) {
  const row = asRecord(value);
  return {
    path: text(row.path, 'page path', '(unknown)'),
    platform: text(row.platform, 'page platform', '(unattributed)'),
    medium: text(row.medium, 'page medium', '(unknown)'),
    referrerHost: text(row.referrerHost, 'page referrer host', '(direct/unknown)'),
    pageViews: count(row.pageViews, 'page views'),
    sessions: count(row.sessions, 'page sessions'),
  };
}

function normalizeNeeds(value: unknown) {
  const result: WebsiteAnalyticsReport['needs'] = {};
  for (const [field, rawValue] of Object.entries(asRecord(value))) {
    const need = asRecord(rawValue);
    const rawCategories = Array.isArray(need.categories) ? need.categories : [];
    result[field] = {
      responseCount: count(need.responseCount, `${field} response count`),
      ...(need.unansweredCount === undefined ? {} : { unansweredCount: count(need.unansweredCount, `${field} unanswered count`) }),
      ...(need.shareDenominator === undefined ? {} : { shareDenominator: text(need.shareDenominator, `${field} share denominator`) }),
      categories: rawCategories.slice(0, MAX_ROWS).map((rawCategory) => {
        const category = asRecord(rawCategory);
        return {
          answer: knownAnswer(category.answer),
          count: count(category.count, `${field} category count`),
          share: ratio(category.share),
        };
      }),
    };
  }
  return result;
}

export function normalizeWebsiteAnalyticsReport(value: unknown): WebsiteAnalyticsReport {
  const report = asRecord(value);
  if (report.reportVersion !== REPORT_VERSION) throw new Error('Unsupported website analytics report version.');
  const range = asRecord(report.range);
  const audience = asRecord(report.audience);
  const origin = asRecord(audience.origin);
  const coverage = asRecord(report.coverage);
  const definitions: Record<string, string> = {};
  for (const [key, value] of Object.entries(asRecord(report.definitions))) definitions[key] = text(value, `definition ${key}`);
  const capturedAt = text(report.capturedAt, 'capture time');
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error('Website analytics report has an invalid capture time.');
  return {
    reportVersion: REPORT_VERSION,
    capturedAt,
    range: {
      from: text(range.from, 'range start'),
      to: text(range.to, 'range end'),
      timezone: text(range.timezone, 'range timezone'),
    },
    definitions,
    rows: (Array.isArray(report.rows) ? report.rows : []).slice(0, MAX_ROWS).map(normalizeRow),
    pageViews: (Array.isArray(report.pageViews) ? report.pageViews : []).slice(0, MAX_ROWS).map(normalizePageView),
    needs: normalizeNeeds(report.needs),
    audience: {
      total: count(audience.total, 'audience total'),
      active: count(audience.active, 'active audience'),
      surveyCompletions: count(audience.surveyCompletions, 'survey completions'),
      origin: {
        website: count(origin.website, 'website audience'),
        imported: count(origin.imported, 'imported audience'),
        unknown: count(origin.unknown, 'unknown audience'),
      },
    },
    coverage: {
      measuredPageViews: count(coverage.measuredPageViews, 'measured page views'),
      measuredSessions: count(coverage.measuredSessions, 'measured sessions'),
      unattributedSessions: count(coverage.unattributedSessions, 'unattributed sessions'),
      newSignups: count(coverage.newSignups, 'new signups'),
      newSignupsWithSession: count(coverage.newSignupsWithSession, 'new signups with session'),
      newSignupsWithoutSession: count(coverage.newSignupsWithoutSession, 'new signups without session'),
      newsletterFormStarts: count(coverage.newsletterFormStarts ?? 0, 'newsletter form starts'),
      newsletterFormSubmits: count(coverage.newsletterFormSubmits ?? 0, 'newsletter form submits'),
      surveyStarts: count(coverage.surveyStarts ?? 0, 'survey starts'),
      newCohortSurveyCompletions: count(coverage.newCohortSurveyCompletions, 'new cohort survey completions'),
      importedSurveyCompletions: count(coverage.importedSurveyCompletions, 'imported survey completions'),
      otherSurveyCompletions: count(coverage.otherSurveyCompletions, 'other survey completions'),
      ...(coverage.historicalAudienceOrigin === undefined ? {} : { historicalAudienceOrigin: text(coverage.historicalAudienceOrigin, 'historical audience note') }),
      ...(coverage.clientTracking === undefined ? {} : { clientTracking: text(coverage.clientTracking, 'client tracking note') }),
    },
  };
}

export interface FetchWebsiteAnalyticsOptions {
  endpoint: string;
  token: string;
  from?: string;
  to?: string;
  timezone?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}

function reportEndpoint(value: string) {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error('Website analytics endpoint is invalid.');
  }
  if (endpoint.username || endpoint.password || endpoint.hash) throw new Error('Website analytics endpoint must not contain credentials or a fragment.');
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && LOCALHOSTS.has(endpoint.hostname))) {
    throw new Error('Website analytics endpoint must use HTTPS.');
  }
  endpoint.search = '';
  return endpoint;
}

export async function fetchWebsiteAnalyticsReport(options: FetchWebsiteAnalyticsOptions) {
  const token = options.token.trim();
  if (!token) throw new Error('Website analytics token is not configured.');
  const endpoint = reportEndpoint(options.endpoint);
  if (options.from) endpoint.searchParams.set('from', options.from);
  if (options.to) endpoint.searchParams.set('to', options.to);
  if (options.timezone) endpoint.searchParams.set('timezone', options.timezone);
  endpoint.searchParams.set('limit', String(Math.min(Math.max(Math.trunc(options.limit ?? MAX_ROWS), 1), MAX_ROWS)));
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new Error('Website analytics fetch is unavailable.');
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('Website analytics report could not be reached.');
  }
  if (!response.ok) throw new Error(`Website analytics report returned HTTP ${response.status}.`);
  try {
    return normalizeWebsiteAnalyticsReport(await response.json());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Website analytics report')) throw error;
    throw new Error('Website analytics report was not valid JSON.');
  }
}

export function reportToWebsiteMeasurement(report: WebsiteAnalyticsReport): WebsiteMeasurement {
  return {
    brandId: 'human-inference',
    source: 'website-analytics-api',
    capturedAt: report.capturedAt,
    firstSignupAt: null,
    signups: report.audience.total,
    surveyCompletions: report.audience.surveyCompletions,
    activeSubscribers: report.audience.active,
    measuredSessions: report.coverage.measuredSessions,
    newSignups: report.coverage.newSignups,
    newSignupSessions: report.coverage.newSignupsWithSession,
    unattributedSessions: report.coverage.unattributedSessions,
    newSignupsWithoutSession: report.coverage.newSignupsWithoutSession,
  };
}

export function readWebsiteAnalyticsReport(path = join(dataRoot(), 'website-analytics-report.json')): WebsiteAnalyticsReport | null {
  if (!existsSync(path)) return null;
  try {
    return normalizeWebsiteAnalyticsReport(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    // A stale or partial derived report must not prevent the private dashboard from showing its
    // separately stored website totals. The next explicit refresh replaces it atomically.
    return null;
  }
}

export function saveWebsiteAnalyticsReport(report: WebsiteAnalyticsReport, path: string) {
  const safe = normalizeWebsiteAnalyticsReport(report);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(safe, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
}
