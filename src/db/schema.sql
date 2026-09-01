CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  platform TEXT NOT NULL,              -- 'x' | 'linkedin' | 'substack' | 'bluesky'
  platform_post_id TEXT,
  posted_at TEXT,                      -- ISO8601
  url TEXT,
  content_text TEXT,
  format TEXT,                         -- 'text' | 'thread' | 'image' | 'video' | 'newsletter'
  media_type TEXT,                     -- 'text' | 'quote-card' | 'video' | 'note' | 'unknown'; populated on ingest, backfilled from format by migration
  pillar TEXT,                         -- 'human-ai' | 'claude-code' | 'civic-tech' | 'career-work' | 'builder' | 'other' | NULL = untagged
  bet_id TEXT,                         -- set by link-bet.ts when /strategy matches a post to a brief's bet (NULL = unattributed)
  source TEXT,                         -- 'atomized' (verbatim, shipped by /publish from a content folder) | 'atomized-spin' (audience-reframed variant, docs/spin-experiment.md) | 'spin-control-run' (deliberate --no-spin control run, card f444f440, src/strategy/spin-control.ts) | 'exploration-probe' (off-assignment pillar/platform probe, card 92bb2ae6 -- excluded from route.ts's resonance figures, see src/strategy/exploration.ts) | 'organic' (posted natively / a note Muxin wrote) | NULL = unclassified; set by tag-source.ts
  cta_destination TEXT,                -- 'source' | 'project' | 'work_with_me' (src/publish/cta.ts CtaDestination) | NULL = no CTA resolved, or unclassified (a literal-url override); read back from the bets.md Placed-log `| cta:<dest>` marker by tag-source.ts (card d80411bc, strategy lever E scaffold -- src/strategy/cta-fit.ts)
  cadence_source TEXT,                 -- 'override' | 'default' | NULL = not determined (only stamped for CORE_TEXT (x/linkedin/bluesky) publishes via src/publish/typefully.ts; card/TikTok/YouTube/Substack claims use a cadence window config/schedule-overrides.yaml never targets, so they're left NULL rather than a trivially-always-'default' value). Records whether THIS post's publish slot came from an active config/schedule-overrides.yaml entry or the static config/platforms.yaml default (strategy lever C follow-through, epic 2ce597d7); read back from the bets.md Placed-log `| cadence:<source>` marker by tag-source.ts
  brand_id TEXT,                         -- canonical measurement brand; NULL means legacy/unassigned
  provider_account_id TEXT,              -- non-secret provider account identity, NULL when unassigned
  UNIQUE(platform, platform_post_id)
);

CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  captured_at TEXT NOT NULL,
  impressions INTEGER,
  likes INTEGER,
  replies INTEGER,
  reposts INTEGER,
  clicks INTEGER,
  new_follows INTEGER,
  engagement_rate REAL,
  raw_json TEXT                        -- full source row; parser gaps never lose data
  ,brand_id TEXT
  ,provider_account_id TEXT
);

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY,
  sha256 TEXT UNIQUE NOT NULL,
  file_name TEXT,
  platform TEXT,
  imported_at TEXT,
  row_count INTEGER
  ,brand_id TEXT
  ,provider_account_id TEXT
);

-- Audience-level data (who follows you), separate from per-post metrics. One long/EAV-style
-- table holds both scalar totals (a follower count = metric_type 'follower_total', dimension NULL)
-- and demographic breakdowns (metric_type 'demographic', dimension+value_label+value_pct). Only
-- LinkedIn populates demographics; Substack adds subscriber tier; Bluesky a follower count; X none.
-- Repeated captured_at snapshots reconstruct growth-over-time for snapshot-only platforms.
CREATE TABLE IF NOT EXISTS audience (
  id INTEGER PRIMARY KEY,
  platform TEXT NOT NULL,              -- 'x' | 'linkedin' | 'substack' | 'bluesky'
  captured_at TEXT NOT NULL,           -- ISO8601: when WE ingested (enables growth-over-time)
  as_of_date TEXT,                     -- ISO8601 date the source attributes the value to
  metric_type TEXT NOT NULL,           -- 'follower_total' | 'follower_delta' | 'demographic'
  dimension TEXT,                      -- NULL for totals; 'location'|'seniority'|'industry'|'company'|'job_title'|'company_size'|'tier'
  value_label TEXT,                    -- NULL for totals; e.g. 'Greater Houston', 'Senior', 'paid'
  value_count INTEGER,                 -- absolute count when known (totals, deltas, tier counts)
  value_pct REAL,                      -- demographic share (0–100); NULL when source says "< 1%"
  source_file TEXT,                    -- export filename / 'atproto:getProfile' for provenance
  raw_json TEXT,
  brand_id TEXT,
  provider_account_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audience_platform ON audience(platform, metric_type);

CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_pillar ON posts(pillar);
CREATE INDEX IF NOT EXISTS idx_posts_bet ON posts(bet_id);
CREATE INDEX IF NOT EXISTS idx_metrics_post ON metrics(post_id);
-- NOTE: idx_posts_media_type and idx_posts_source are omitted here intentionally.
-- Both columns may be absent on legacy DBs until db.ts migrations add them, so indexing
-- here would throw "no such column" on a legacy DB. The indexes are created in db.ts instead.
-- NOTE: no idx_posts_source here on purpose. `source` is added by a migration in db.ts that runs
-- AFTER this file executes, so indexing it here would throw "no such column: source" on a legacy
-- DB. The index is created in that migration instead.

-- Account-level research evidence. These tables deliberately live beside analytics in the
-- gitignored data/analytics.db; observations are venture-neutral and classifications are
-- taxonomy-specific, so reclassification never duplicates evidence.
CREATE TABLE IF NOT EXISTS research_observations (
  observation_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  surface TEXT,
  content_item_id TEXT,
  note_id TEXT,
  reply_id TEXT,
  parent_reply_id TEXT,
  published_at TEXT,
  observed_at TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  respondent_hash TEXT,
  exact_text TEXT,
  redacted_text TEXT,
  follow_up_question TEXT,
  behavioral_action TEXT,
  is_creator_observation INTEGER NOT NULL DEFAULT 0,
  privacy_class TEXT NOT NULL,
  post_age_hours REAL,
  views_at_observation REAL,
  edited_at TEXT,
  deleted_at TEXT,
  superseded_by TEXT,
  metric_name TEXT,
  metric_value REAL,
  previous_value REAL,
  delta REAL,
  window_start TEXT,
  window_end TEXT,
  collected_at TEXT,
  brand_id TEXT,
  provider_account_id TEXT,
  CHECK ((source IN ('metric', 'subscriber_movement')) = (metric_name IS NOT NULL)),
  CHECK (source NOT IN ('metric', 'subscriber_movement') OR collected_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_research_observations_reply
  ON research_observations(source_platform, surface, note_id, reply_id);
CREATE INDEX IF NOT EXISTS idx_research_observations_content_metric
  ON research_observations(content_item_id, metric_name, collected_at);
CREATE INDEX IF NOT EXISTS idx_research_observations_active_reply
  ON research_observations(note_id, reply_id)
  WHERE source = 'reply' AND superseded_by IS NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS research_observation_classifications (
  classification_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES research_observations(observation_id),
  taxonomy_id TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  prompt_version TEXT,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('classified', 'abstained', 'human_corrected', 'human_entered')),
  classified_at TEXT,
  supersedes_classification_id TEXT REFERENCES research_observation_classifications(classification_id),
  fields_json TEXT NOT NULL,
  correction_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_classifications_one_live_taxonomy
  ON research_observation_classifications(observation_id, taxonomy_id)
  WHERE supersedes_classification_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_research_classifications_observation
  ON research_observation_classifications(observation_id, taxonomy_id, taxonomy_version);
