ALTER TABLE waitlist ADD COLUMN email_attempts INTEGER DEFAULT 0;

ALTER TABLE waitlist ADD COLUMN next_email_attempt_at TEXT;
