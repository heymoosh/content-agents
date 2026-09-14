import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  fetchWebsiteAnalyticsReport,
  readWebsiteAnalyticsReport,
  reportToWebsiteMeasurement,
  saveWebsiteAnalyticsReport,
  type WebsiteAnalyticsReport,
} from './website-analytics-client.js';
import { ventureSeriesSignalsHtml } from './page-venture-actions.js';
import { renderPage } from './page.js';
import { readWebsiteMeasurement, saveWebsiteMeasurement } from './venture-actions.js';

function report(): WebsiteAnalyticsReport {
  return {
    reportVersion: 'website-funnel-v1',
    capturedAt: '2026-09-14T12:00:00.000Z',
    range: { from: '2026-09-01', to: '2026-09-14', timezone: 'UTC' },
    definitions: {},
    rows: [{
      platform: 'linkedin', medium: 'social', referrerHost: '(direct/unknown)', campaign: 'campaign-1',
      variantId: 'variant-1', sourcePost: 'post-1', landingPath: '/essays/example',
      measuredSessions: 10, newSignups: 2, newSignupSessions: 2, newSignupsWithoutSession: 0,
      signupRate: 0.2, surveyCompletions: 1,
    }],
    pageViews: [{ path: '/essays/example', platform: 'linkedin', medium: 'social', referrerHost: '(direct/unknown)', pageViews: 12, sessions: 10 }],
    needs: { motivation: { responseCount: 2, categories: [{ answer: 'More freedom', count: 2, share: 1 }] } },
    audience: { total: 25, active: 23, surveyCompletions: 7, origin: { website: 5, imported: 18, unknown: 2 } },
    coverage: {
      measuredPageViews: 12,
      measuredSessions: 10,
      unattributedSessions: 4,
      newSignups: 2,
      newSignupsWithSession: 2,
      newSignupsWithoutSession: 0,
      newsletterFormStarts: 4,
      newsletterFormSubmits: 3,
      surveyStarts: 5,
      newCohortSurveyCompletions: 1,
      importedSurveyCompletions: 4,
      otherSurveyCompletions: 2,
    },
  };
}

test('fetches the protected report server-side with bounded query parameters', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetched = await fetchWebsiteAnalyticsReport({
    endpoint: 'https://humaninference.ai/api/website-analytics',
    token: 'server-only-token',
    from: '2026-09-01',
    to: '2026-09-14',
    timezone: 'America/Chicago',
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify(report()), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  assert.equal(fetched.audience.total, 25);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://humaninference.ai/api/website-analytics?from=2026-09-01&to=2026-09-14&timezone=America%2FChicago&limit=500');
  assert.equal((calls[0]?.init?.headers as Record<string, string>).authorization, 'Bearer server-only-token');
});

test('projects the report into the existing private website measurement summary', () => {
  assert.deepEqual(reportToWebsiteMeasurement(report()), {
    brandId: 'human-inference',
    source: 'website-analytics-api',
    capturedAt: '2026-09-14T12:00:00.000Z',
    firstSignupAt: null,
    signups: 25,
    surveyCompletions: 7,
    activeSubscribers: 23,
    measuredSessions: 10,
    newSignups: 2,
    newSignupSessions: 2,
    unattributedSessions: 4,
    newSignupsWithoutSession: 0,
  });
});

test('saved reports contain aggregate fields only and use a private file mode', () => {
  const directory = mkdtempSync(join(tmpdir(), 'website-analytics-client-'));
  const path = join(directory, 'website-analytics-report.json');
  saveWebsiteAnalyticsReport(report(), path);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(saved.audience.total, 25);
  assert.equal(saved.rows[0].newSignups, 2);
  assert.equal('email' in saved, false);
  assert.equal('rawAnswers' in saved, false);
});

test('reads the saved aggregate report and renders the source funnel and needs in Studio', () => {
  const directory = mkdtempSync(join(tmpdir(), 'website-analytics-render-'));
  const path = join(directory, 'website-analytics-report.json');
  saveWebsiteAnalyticsReport(report(), path);
  const saved = readWebsiteAnalyticsReport(path);
  assert.equal(saved?.rows[0]?.landingPath, '/essays/example');
  const html = ventureSeriesSignalsHtml([], null, String, saved);
  assert.match(html, /Measured website funnel/);
  assert.match(html, /linkedin \/ social/);
  assert.match(html, /\/essays\/example/);
  assert.match(html, /More freedom/);
  assert.match(html, /newsletter form starts: 4/);
  assert.match(html, /newsletter submit attempts: 3/);
  assert.match(html, /survey starts: 5/);
  assert.match(html, /diagnostic client signals/);
  assert.doesNotMatch(html, /server-only-token|rawAnswers/);
  assert.match(renderPage({ repoRoot: '/fixture', isDevWorktree: true }), /const websiteAnalyticsReportHtml = function websiteAnalyticsReportHtml/);
});

test('the report summary can replace the legacy private measurement snapshot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'website-analytics-summary-'));
  const path = join(directory, 'website-measurements.json');
  saveWebsiteMeasurement(reportToWebsiteMeasurement(report()), path);
  const saved = readWebsiteMeasurement(path);
  assert.equal(saved?.source, 'website-analytics-api');
  assert.equal(saved?.newSignups, 2);
  assert.equal(saved?.measuredSessions, 10);
});
