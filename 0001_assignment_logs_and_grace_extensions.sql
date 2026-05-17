CREATE TABLE IF NOT EXISTS grace_extensions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  scheduled_due_date TEXT NOT NULL,
  person TEXT NOT NULL,
  default_grace_until TEXT NOT NULL,
  extended_until TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_grace_extensions_cycle
ON grace_extensions(task_id, cycle_id);

CREATE TABLE IF NOT EXISTS assignment_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  scheduled_due_date TEXT,
  assigned_person TEXT NOT NULL,
  previous_assigned_person TEXT,
  reason_summary TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_created
ON assignment_logs(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_task_date
ON assignment_logs(task_id, scheduled_due_date);
