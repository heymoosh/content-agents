import '../util/env.js';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { saveWebsiteMeasurement } from '../review/venture-actions.js';

// Reuse the website's installed pg client. Never run its submit handlers: those send email/write data.
// Connection is supplied through the environment, never command-line arguments or logged output.
const repo = process.argv[2];
if (!repo) throw new Error('Usage: website-measurements <website-repo>; set HUMAN_INFERENCE_DATABASE_URL privately');
const connectionString = process.env.HUMAN_INFERENCE_DATABASE_URL;
if (!connectionString) throw new Error('Website connection pending: HUMAN_INFERENCE_DATABASE_URL is not configured');
const require = createRequire(join(resolve(repo), 'site', 'package.json'));
const { Client } = require('pg');
const client = new Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const { rows } = await client.query(`SELECT count(*)::int AS signups,
    count(*) FILTER (WHERE survey_completed_at IS NOT NULL)::int AS surveys,
    count(*) FILTER (WHERE unsubscribed_at IS NULL)::int AS active,
    min(subscribed_at) AS first_signup FROM essays_subscribers`);
  await client.query('COMMIT');
  const row = rows[0];
  saveWebsiteMeasurement({ brandId:'human-inference', source:'website-postgres', capturedAt:new Date().toISOString(),
    firstSignupAt:row.first_signup?.toISOString()??null, signups:row.signups, surveyCompletions:row.surveys, activeSubscribers:row.active });
  console.log('Website aggregate saved. No email addresses, survey answers or per-person rows were retrieved.');
} catch {
  console.error('Website aggregate could not be read. Check the connection and essays_subscribers schema; saved measurements were not changed.');
  process.exitCode=1;
} finally { await client.end(); }
