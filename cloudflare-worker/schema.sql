CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  installation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  risk_verdict TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  layer TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  url_host TEXT NOT NULL,
  reason TEXT NOT NULL,
  matched_brand TEXT,
  title_digest TEXT,
  h1_digest TEXT,
  dataset_version TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_org_ts
ON security_events (org_id, ts DESC);

CREATE TABLE IF NOT EXISTS dataset_apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT NOT NULL,
  official_urls_json TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dataset_official_domains (
  domain TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (app_id) REFERENCES dataset_apps(id)
);

CREATE INDEX IF NOT EXISTS idx_dataset_official_domains_app
ON dataset_official_domains (app_id);

CREATE TABLE IF NOT EXISTS dataset_phishing_domains (
  domain TEXT PRIMARY KEY,
  target_app_id TEXT,
  status TEXT NOT NULL,
  source TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  reviewed_at TEXT,
  reviewer TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (target_app_id) REFERENCES dataset_apps(id)
);

CREATE INDEX IF NOT EXISTS idx_dataset_phishing_status
ON dataset_phishing_domains (status);

CREATE TABLE IF NOT EXISTS dataset_versions (
  version TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  apps_count INTEGER NOT NULL,
  official_domains_count INTEGER NOT NULL,
  phishing_confirmed_count INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_active
ON dataset_versions (is_active, created_at DESC);
