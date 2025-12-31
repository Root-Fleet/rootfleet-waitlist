CREATE TABLE IF NOT EXISTS email_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('trigger', 'cron')),
    resend_id TEXT,
    ok INTEGER NOT NULL,
    status INTEGER,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_runs_created_at ON email_runs (created_at);

CREATE INDEX IF NOT EXISTS idx_email_runs_run_id ON email_runs (run_id);

CREATE INDEX IF NOT EXISTS idx_email_runs_source ON email_runs (source);
