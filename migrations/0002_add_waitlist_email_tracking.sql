ALTER TABLE waitlist ADD COLUMN resend_message_id TEXT;

ALTER TABLE waitlist ADD COLUMN email_status TEXT;

ALTER TABLE waitlist ADD COLUMN email_error TEXT;

ALTER TABLE waitlist ADD COLUMN email_sent_at TEXT;

ALTER TABLE waitlist ADD COLUMN email_attempts INTEGER DEFAULT 0;

ALTER TABLE waitlist ADD COLUMN next_email_attempt_at TEXT;
