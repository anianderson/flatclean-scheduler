CREATE TABLE IF NOT EXISTS maintenance_runs (
  id TEXT PRIMARY KEY,
  run_date TEXT,
  run_type TEXT,
  status TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maintenance_runs_created_at
ON maintenance_runs(created_at);

CREATE INDEX IF NOT EXISTS idx_email_log_dedupe
ON email_log(email_type, task_id, recipient_person, reference_date, status);
