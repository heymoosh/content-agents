CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  platform TEXT NOT NULL,              -- 'x' | 'linkedin' | 'substack' | 'bluesky'
  platform_post_id TEXT,
  posted_at TEXT,                      -- ISO8601
  url TEXT,
  content_text TEXT,
  format TEXT,                         -- 'text' | 'thread' | 'image' | 'video' | 'newsletter'
  pillar TEXT,                         -- 'human-ai' | 'claude-code' | 'civic-tech' | 'other' | NULL = untagged
  bet_id TEXT,                         -- set by link-bet.ts when /strategy matches a post to a brief's bet (NULL = unattributed)
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

CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_pillar ON posts(pillar);
CREATE INDEX IF NOT EXISTS idx_posts_bet ON posts(bet_id);
CREATE INDEX IF NOT EXISTS idx_metrics_post ON metrics(post_id);
