CREATE TABLE d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE email_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('trigger', 'cron')),
  resend_id TEXT,
  ok INTEGER NOT NULL,
  status INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  fleet_size TEXT NOT NULL,
  company_name TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  ip TEXT,
  user_agent TEXT,
  resend_message_id TEXT,
  email_status TEXT,
  email_error TEXT,
  email_sent_at TEXT,
  stats_counted INTEGER DEFAULT 0,
  email_attempts INTEGER DEFAULT 0,
  next_email_attempt_at TEXT,
  email_source TEXT CHECK (email_source IN ('trigger','cron'))
);

CREATE TABLE waitlist_stats (
  id INTEGER PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
