import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";

// Read-only reader for JSA's (job-search-agent, a sibling repo) manual_research.db.
// docs/outreach-engine-plan.md §2a/§4: the ONLY thing this module does is snapshot rows out of
// JSA's db for `/outreach add --from-jsa` (intake.ts, not built yet in this phase) and, later,
// the Follow-ups tab's live jobsearch-bucket read (§2b). It never writes to JSA's db and never
// becomes the outreach engine's source of truth after intake ("snapshot, don't live-link").
//
//   tsx src/outreach/jsa.ts "PostHog"   → prints the looked-up row as JSON (smoke test)

const DEFAULT_ENV_VAR = "JSA_DB_PATH";
// A hard ceiling on listByVerdict's `limit`, independent of whatever the caller asks for. The
// plan is explicit that a filtered import must never become a full unfiltered dump of JSA's db.
const MAX_LIST_LIMIT = 100;

export interface JsaRecord {
  companyName: string;
  domain: string;
  verdict: string | null;
  remoteScore: number | null;
  remoteNotes: string;
  parentalLeaveScore: number | null;
  parentalLeaveNotes: string;
  pmHiringScore: number | null;
  pmHiringNotes: string;
  redFlagsScore: number | null;
  redFlagsNotes: string;
  salaryScore: number | null;
  salaryNotes: string;
  cultureScore: number | null;
  cultureNotes: string;
  japanHsp: string;
  japanHspNotes: string;
  sources: string;
  researchedDate: string | null;
  asyncScore: number | null;
  asyncNotes: string;
  otherBenefitsScore: number | null;
  otherBenefitsNotes: string;
  pmRoleQualityScore: number | null;
  pmRoleQualityNotes: string;
  jobProtectionScore: number | null;
  jobProtectionNotes: string;
  workLifeBalanceScore: number | null;
  workLifeBalanceNotes: string;
  hiringSignalsScore: number | null;
  hiringSignalsNotes: string;
  persona: string;
  founderPersona: string;
}

// Raw column shape as better-sqlite3 hands it back (snake_case, NULLable TEXT columns).
interface RawRow {
  company_name: string;
  domain: string | null;
  verdict: string | null;
  remote_score: number | null;
  remote_notes: string | null;
  parental_leave_score: number | null;
  parental_leave_notes: string | null;
  pm_hiring_score: number | null;
  pm_hiring_notes: string | null;
  red_flags_score: number | null;
  red_flags_notes: string | null;
  salary_score: number | null;
  salary_notes: string | null;
  culture_score: number | null;
  culture_notes: string | null;
  japan_hsp: string | null;
  japan_hsp_notes: string | null;
  sources: string | null;
  researched_date: string | null;
  async_score: number | null;
  async_notes: string | null;
  other_benefits_score: number | null;
  other_benefits_notes: string | null;
  pm_role_quality_score: number | null;
  pm_role_quality_notes: string | null;
  job_protection_score: number | null;
  job_protection_notes: string | null;
  work_life_balance_score: number | null;
  work_life_balance_notes: string | null;
  hiring_signals_score: number | null;
  hiring_signals_notes: string | null;
  persona: string | null;
  founder_persona: string | null;
}

// Every column this module reads (kept as one list so lookupCompany/listByVerdict can't drift).
const COLUMNS = [
  "company_name",
  "domain",
  "verdict",
  "remote_score",
  "remote_notes",
  "parental_leave_score",
  "parental_leave_notes",
  "pm_hiring_score",
  "pm_hiring_notes",
  "red_flags_score",
  "red_flags_notes",
  "salary_score",
  "salary_notes",
  "culture_score",
  "culture_notes",
  "japan_hsp",
  "japan_hsp_notes",
  "sources",
  "researched_date",
  "async_score",
  "async_notes",
  "other_benefits_score",
  "other_benefits_notes",
  "pm_role_quality_score",
  "pm_role_quality_notes",
  "job_protection_score",
  "job_protection_notes",
  "work_life_balance_score",
  "work_life_balance_notes",
  "hiring_signals_score",
  "hiring_signals_notes",
  "persona",
  "founder_persona",
].join(", ");

// TEXT columns collapse NULL -> "" (matching the well-known `domain` gotcha: many real rows,
// including TARGET rows like PostHog/Supabase/Notion, have an empty/NULL domain — callers should
// never have to branch on null vs "" for a text field). Score (INTEGER) columns stay nullable:
// "no score recorded" is a real, distinct state from "scored 0" and callers need to tell them apart.
function toRecord(row: RawRow): JsaRecord {
  return {
    companyName: row.company_name,
    domain: row.domain ?? "",
    verdict: row.verdict ?? null,
    remoteScore: row.remote_score ?? null,
    remoteNotes: row.remote_notes ?? "",
    parentalLeaveScore: row.parental_leave_score ?? null,
    parentalLeaveNotes: row.parental_leave_notes ?? "",
    pmHiringScore: row.pm_hiring_score ?? null,
    pmHiringNotes: row.pm_hiring_notes ?? "",
    redFlagsScore: row.red_flags_score ?? null,
    redFlagsNotes: row.red_flags_notes ?? "",
    salaryScore: row.salary_score ?? null,
    salaryNotes: row.salary_notes ?? "",
    cultureScore: row.culture_score ?? null,
    cultureNotes: row.culture_notes ?? "",
    japanHsp: row.japan_hsp ?? "",
    japanHspNotes: row.japan_hsp_notes ?? "",
    sources: row.sources ?? "",
    researchedDate: row.researched_date ?? null,
    asyncScore: row.async_score ?? null,
    asyncNotes: row.async_notes ?? "",
    otherBenefitsScore: row.other_benefits_score ?? null,
    otherBenefitsNotes: row.other_benefits_notes ?? "",
    pmRoleQualityScore: row.pm_role_quality_score ?? null,
    pmRoleQualityNotes: row.pm_role_quality_notes ?? "",
    jobProtectionScore: row.job_protection_score ?? null,
    jobProtectionNotes: row.job_protection_notes ?? "",
    workLifeBalanceScore: row.work_life_balance_score ?? null,
    workLifeBalanceNotes: row.work_life_balance_notes ?? "",
    hiringSignalsScore: row.hiring_signals_score ?? null,
    hiringSignalsNotes: row.hiring_signals_notes ?? "",
    persona: row.persona ?? "",
    founderPersona: row.founder_persona ?? "",
  };
}

// The env var name is normally just JSA_DB_PATH (docs/outreach-engine-plan.md §2a/§4 name it
// directly). config/outreach.yaml is documented as the future home for an override knob, so if
// that file exists and sets `jsa_db_path_env:`, honor it — otherwise fall back to the default.
// This lets this module ship ahead of config/outreach.yaml without hardcoding a name that later
// turns out to be wrong.
function envVarName(): string {
  const configPath = join(repoRoot, "config", "outreach.yaml");
  if (existsSync(configPath)) {
    try {
      const config = parse(readFileSync(configPath, "utf8")) as { jsa_db_path_env?: string } | null;
      if (config?.jsa_db_path_env) return config.jsa_db_path_env;
    } catch {
      // Malformed config shouldn't block a JSA lookup; fall through to the default env var name.
    }
  }
  return DEFAULT_ENV_VAR;
}

function jsaDbPath(): string {
  const varName = envVarName();
  const path = process.env[varName];
  if (!path) {
    throw new Error(
      `${varName} is not set. Point it at JSA's manual_research.db (read-only), e.g. in .env: ` +
        `${varName}=/path/to/job-search-agent/manual_research.db`,
    );
  }
  if (!existsSync(path)) {
    throw new Error(`${varName} is set to "${path}" but no file exists there.`);
  }
  return path;
}

function openJsaDb(): Database.Database {
  // readonly: true — this module must never be able to write to JSA's db, structurally, not
  // just by convention (docs/outreach-engine-plan.md: "read-only", "display-only").
  return new Database(jsaDbPath(), { readonly: true, fileMustExist: true });
}

// Normalize company names for matching: trim, lowercase, collapse internal whitespace. Case
// alone (e.g. "posthog" vs "PostHog") should never miss a real row.
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Look up one company by name. Match strategy (in order), documented so callers can predict it:
//   1. Exact match, case/whitespace-insensitive (COLLATE NOCASE handles case; JS-side trim/collapse
//      handles stray whitespace before the query runs).
//   2. Fuzzy fallback: substring match (LIKE '%name%', case-insensitive) against company_name.
//      If more than one row matches, the shortest company_name wins (closest to the query — e.g.
//      querying "Notion" against a db that also has "Notion Labs Inc" prefers the shorter,
//      more-likely-canonical name), ties broken alphabetically for determinism.
// Returns null if nothing matches either way.
export function lookupCompany(name: string): JsaRecord | null {
  const db = openJsaDb();
  try {
    const target = norm(name);
    const exact = db
      .prepare(`SELECT ${COLUMNS} FROM manual_research WHERE company_name = ? COLLATE NOCASE`)
      .get(target) as RawRow | undefined;
    if (exact) return toRecord(exact);

    const fuzzy = db
      .prepare(
        `SELECT ${COLUMNS} FROM manual_research WHERE company_name LIKE ? COLLATE NOCASE ` +
          `ORDER BY LENGTH(company_name) ASC, company_name ASC LIMIT 1`,
      )
      .get(`%${target}%`) as RawRow | undefined;
    return fuzzy ? toRecord(fuzzy) : null;
  } finally {
    db.close();
  }
}

// List companies filtered by verdict, hard-capped at `limit` (never a full unfiltered dump — the
// caller must name at least one verdict and `limit` is clamped to MAX_LIST_LIMIT regardless of
// what's requested). Ordered by researched_date descending (most recently researched first) so a
// capped page surfaces the freshest verdicts.
export function listByVerdict(verdicts: string[], limit: number): JsaRecord[] {
  if (!verdicts || verdicts.length === 0) {
    throw new Error("listByVerdict requires at least one verdict to filter on (no unfiltered dump).");
  }
  const cappedLimit = Math.max(1, Math.min(limit, MAX_LIST_LIMIT));
  const db = openJsaDb();
  try {
    const placeholders = verdicts.map(() => "? COLLATE NOCASE").join(", ");
    const rows = db
      .prepare(
        `SELECT ${COLUMNS} FROM manual_research WHERE verdict IN (${placeholders}) ` +
          `ORDER BY researched_date DESC LIMIT ?`,
      )
      .all(...verdicts, cappedLimit) as RawRow[];
    return rows.map(toRecord);
  } finally {
    db.close();
  }
}

// Run directly: look up one company by name and print the result as JSON.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: tsx src/outreach/jsa.ts "<company name>"');
    process.exit(1);
  }
  const record = lookupCompany(name);
  console.log(JSON.stringify(record, null, 2));
}
