DROP TABLE IF EXISTS waitlist;

DROP TABLE IF EXISTS waitlist_stats;

CREATE TABLE waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    fleet_size TEXT NOT NULL,
    company_name TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    ip TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist (created_at);

CREATE INDEX IF NOT EXISTS idx_waitlist_role ON waitlist (role);

CREATE INDEX IF NOT EXISTS idx_waitlist_fleet_size ON waitlist (fleet_size);

CREATE TABLE waitlist_stats (
    id INTEGER PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);

-- one row, id=1
INSERT INTO waitlist_stats (id, count) VALUES (1, 0);
