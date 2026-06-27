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
  source TEXT,                         -- 'atomized' (verbatim, shipped by /publish from a content folder) | 'atomized-spin' (audience-reframed variant, docs/spin-experiment.md) | 'organic' (posted natively / a note Muxin wrote) | NULL = unclassified; set by tag-source.ts
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
);

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY,
  sha256 TEXT UNIQUE NOT NULL,
  file_name TEXT,
  platform TEXT,
  imported_at TEXT,
  row_count INTEGER
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
  UNIQUE(platform, captured_at, metric_type, dimension, value_label)
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
