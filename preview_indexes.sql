CREATE INDEX idx_email_runs_created_at ON email_runs (created_at);
CREATE INDEX idx_email_runs_run_id ON email_runs (run_id);
CREATE INDEX idx_email_runs_source ON email_runs (source);
CREATE INDEX idx_waitlist_created_at ON waitlist (created_at);
CREATE INDEX idx_waitlist_fleet_size ON waitlist (fleet_size);
CREATE INDEX idx_waitlist_role ON waitlist (role);
