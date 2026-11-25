-- D1 database "profile-leads" for profile.wheretospot.com.
-- Apply with: npx wrangler d1 execute profile-leads --remote --file worker/schema.sql
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  chat_id TEXT UNIQUE,
  at TEXT NOT NULL,
  source TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS leads_at ON leads (at);

CREATE TABLE IF NOT EXISTS rate (
  bucket TEXT NOT NULL,
  k TEXT NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_lookup ON rate (bucket, k, t);
