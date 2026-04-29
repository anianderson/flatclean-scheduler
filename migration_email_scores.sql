ALTER TABLE flatmates ADD COLUMN email TEXT;

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  email_type TEXT NOT NULL,
  task_id TEXT,
  recipient_person TEXT,
  recipient_email TEXT NOT NULL,
  reference_date TEXT,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS score_milestones (
  person TEXT NOT NULL,
  milestone INTEGER NOT NULL,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (person, milestone)
);