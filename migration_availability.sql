CREATE TABLE IF NOT EXISTS absences (
  id TEXT PRIMARY KEY,
  person TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_absences_person_dates
ON absences (person, start_date, end_date);
