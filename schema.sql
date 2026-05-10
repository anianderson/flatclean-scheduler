-- CREATE TABLE IF NOT EXISTS flatmates (
--   name TEXT PRIMARY KEY
-- );

-- CREATE TABLE IF NOT EXISTS tasks (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL,
--   type TEXT NOT NULL,
--   interval_days INTEGER,
--   task_group TEXT,
--   also_logs TEXT
-- );

-- CREATE TABLE IF NOT EXISTS logs (
--   id TEXT PRIMARY KEY,
--   task_id TEXT NOT NULL,
--   person TEXT NOT NULL,
--   done_date TEXT NOT NULL,
--   note TEXT,
--   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE TABLE IF NOT EXISTS bin_status (
--   task_id TEXT PRIMARY KEY,
--   is_full INTEGER NOT NULL DEFAULT 0,
--   updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- INSERT OR IGNORE INTO flatmates (name) VALUES ('Melanie'), ('Animesh'), ('Naveen');

-- INSERT OR IGNORE INTO tasks (id, name, type, interval_days, task_group, also_logs) VALUES
-- ('vacuum', 'Vacuum cleaning whole flat', 'scheduled', 10, 'floor', NULL),
-- ('deep_water', 'Deep water cleaning whole flat', 'scheduled', 20, 'floor', 'vacuum'),
-- ('bath_toilet_basin', 'Bathtub, toilet and wash basin cleaning', 'scheduled', 61, 'bathroom', NULL),
-- ('gas_stove', 'Gas stove cleaning', 'scheduled', 7, 'kitchen', NULL),
-- ('bio_bin', 'Bio trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
-- ('yellow_bin', 'Yellow trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
-- ('black_bin', 'Black trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
-- ('paper_bin', 'Paper trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
-- ('driveway_backyard', 'Driveway and backyard cleaning', 'scheduled', 122, 'outside', NULL);

-- INSERT OR IGNORE INTO bin_status (task_id, is_full) VALUES
-- ('bio_bin', 0), ('yellow_bin', 0), ('black_bin', 0), ('paper_bin', 0);

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'vacuum', 'Melanie', '2026-04-09', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'vacuum' AND person = 'Melanie' AND done_date = '2026-04-09'
-- );

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'deep_water', 'Melanie', '2026-03-30', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'deep_water' AND person = 'Melanie' AND done_date = '2026-03-30'
-- );

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'bath_toilet_basin', 'Melanie', '2026-02-19', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'bath_toilet_basin' AND person = 'Melanie' AND done_date = '2026-02-19'
-- );

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'gas_stove', 'Melanie', '2026-04-22', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'gas_stove' AND person = 'Melanie' AND done_date = '2026-04-22'
-- );

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'bio_bin', 'Melanie', '2026-04-20', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'bio_bin' AND person = 'Melanie' AND done_date = '2026-04-20'
-- );

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'paper_bin', 'Melanie', '2026-04-20', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'paper_bin' AND person = 'Melanie' AND done_date = '2026-04-20'
-- );

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'yellow_bin', 'Melanie', '2026-04-20', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'yellow_bin' AND person = 'Melanie' AND done_date = '2026-04-20'
-- );

-- INSERT INTO logs (task_id, person, done_date, note)
-- SELECT 'black_bin', 'Melanie', '2026-04-20', 'Historical credit: Melanie usually did this before the app started'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM logs WHERE task_id = 'black_bin' AND person = 'Melanie' AND done_date = '2026-04-20'
-- );

-- INSERT OR IGNORE INTO logs (id, task_id, person, done_date, note) VALUES
-- ('init-1', 'vacuum', 'Animesh', '2026-04-19', 'Initial record'),
-- ('init-2', 'deep_water', 'Animesh', '2026-04-19', 'Initial record'),
-- ('init-3', 'bath_toilet_basin', 'Animesh', '2026-04-19', 'Initial record'),
-- ('init-4', 'bio_bin', 'Animesh', '2026-04-29', 'Initial record'),
-- ('init-5', 'paper_bin', 'Animesh', '2026-04-29', 'Initial record'),
-- ('init-6', 'gas_stove', 'Animesh', '2026-04-29', 'Initial record');

-- Flat Cleaning Scheduler canonical schema
-- This file is a complete, current schema for a fresh Cloudflare D1 database.
-- For an existing database, back it up first before replacing older migration flows.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS flatmates (
  name TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'on_demand')),
  interval_days INTEGER,
  task_group TEXT,
  also_logs TEXT,
  base_weight REAL NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_de TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_subtasks (
  task_id TEXT NOT NULL,
  subtask_id TEXT NOT NULL,
  PRIMARY KEY (task_id, subtask_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scoring_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  person TEXT NOT NULL,
  actual_person TEXT,
  assigned_person TEXT,
  done_date TEXT NOT NULL,
  scheduled_due_date TEXT,
  next_due_date TEXT,
  completion_type TEXT NOT NULL DEFAULT 'normal',
  credit_weight REAL NOT NULL DEFAULT 1,
  is_partial INTEGER NOT NULL DEFAULT 0,
  completion_ratio REAL NOT NULL DEFAULT 1,
  cycle_id TEXT,
  scoring_period_id TEXT,
  is_dummy INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (scoring_period_id) REFERENCES scoring_periods(id)
);

CREATE TABLE IF NOT EXISTS log_subtasks (
  log_id TEXT NOT NULL,
  subtask_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  weight REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (log_id, subtask_id),
  FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE,
  FOREIGN KEY (subtask_id) REFERENCES subtasks(id)
);

CREATE TABLE IF NOT EXISTS bin_status (
  task_id TEXT PRIMARY KEY,
  is_full INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS absences (
  id TEXT PRIMARY KEY,
  person TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flatmate_history (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  action TEXT NOT NULL,
  scoring_period_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  FOREIGN KEY (scoring_period_id) REFERENCES scoring_periods(id)
);

CREATE TABLE IF NOT EXISTS admin_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  email_type TEXT NOT NULL,
  task_id TEXT,
  recipient_person TEXT,
  recipient_email TEXT NOT NULL,
  reference_date TEXT,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS score_milestones (
  person TEXT NOT NULL,
  milestone INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (person, milestone)
);

CREATE TABLE IF NOT EXISTS maintenance_runs (
  id TEXT PRIMARY KEY,
  run_date TEXT,
  run_type TEXT,
  status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_task_date ON logs(task_id, done_date);
CREATE INDEX IF NOT EXISTS idx_logs_person_date ON logs(person, done_date);
CREATE INDEX IF NOT EXISTS idx_logs_scoring_period ON logs(scoring_period_id);
CREATE INDEX IF NOT EXISTS idx_logs_cycle ON logs(task_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_absences_person_dates ON absences(person, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_email_log_dedupe ON email_log(email_type, task_id, recipient_person, reference_date, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_runs_created_at ON maintenance_runs(created_at);

INSERT OR IGNORE INTO flatmates (name, email) VALUES
  ('Melanie', ''),
  ('Animesh', ''),
  ('Naveen', '');

INSERT OR IGNORE INTO scoring_periods (id, name, reason) VALUES
  ('initial_current_period', 'Current period', 'Initial active scoring period');

INSERT OR IGNORE INTO tasks (id, name, type, interval_days, task_group, also_logs, base_weight, active) VALUES
  ('vacuum', 'Vacuum cleaning whole flat', 'scheduled', 10, 'floor', '', 2.00, 1),
  ('deep_water', 'Deep water cleaning whole flat', 'scheduled', 20, 'floor', 'vacuum', 3.00, 1),
  ('bath_toilet_basin', 'Bathtub, toilet and wash basin cleaning', 'scheduled', 61, 'bathroom', '', 2.40, 1),
  ('gas_stove', 'Gas stove cleaning', 'scheduled', 7, 'kitchen', '', 1.20, 1),
  ('bio_bin', 'Bio trash bin cleaning', 'on_demand', NULL, 'trash', '', 0.60, 1),
  ('yellow_bin', 'Yellow trash bin cleaning', 'on_demand', NULL, 'trash', '', 0.80, 1),
  ('black_bin', 'Black trash bin cleaning', 'on_demand', NULL, 'trash', '', 0.80, 1),
  ('paper_bin', 'Paper trash bin cleaning', 'on_demand', NULL, 'trash', '', 1.00, 1),
  ('driveway_backyard', 'Driveway and backyard cleaning', 'scheduled', 122, 'outside', '', 4.00, 1);

INSERT OR IGNORE INTO subtasks (id, name_en, name_de, weight, sort_order) VALUES
  ('stairway_area', 'Stairway area', 'Treppenbereich', 1.50, 10),
  ('kitchen_area', 'Kitchen area', 'Küche', 1.25, 20),
  ('hallway', 'Hallway', 'Flur', 1.25, 30),
  ('bathroom_floor', 'Bathroom', 'Bad', 1.00, 40),
  ('bathtub', 'Bathtub', 'Badewanne', 1.20, 10),
  ('toilet', 'Toilet', 'Toilette', 1.20, 20),
  ('wash_basin', 'Wash basin', 'Waschbecken', 0.80, 30),
  ('driveway', 'Driveway', 'Einfahrt', 1.00, 10),
  ('backyard', 'Backyard', 'Hinterhof', 1.00, 20);

INSERT OR IGNORE INTO task_subtasks (task_id, subtask_id) VALUES
  ('vacuum', 'stairway_area'),
  ('vacuum', 'kitchen_area'),
  ('vacuum', 'hallway'),
  ('vacuum', 'bathroom_floor'),
  ('deep_water', 'stairway_area'),
  ('deep_water', 'kitchen_area'),
  ('deep_water', 'hallway'),
  ('deep_water', 'bathroom_floor'),
  ('bath_toilet_basin', 'bathtub'),
  ('bath_toilet_basin', 'toilet'),
  ('bath_toilet_basin', 'wash_basin'),
  ('driveway_backyard', 'driveway'),
  ('driveway_backyard', 'backyard');

INSERT OR IGNORE INTO bin_status (task_id, is_full) VALUES
  ('bio_bin', 0),
  ('yellow_bin', 0),
  ('black_bin', 0),
  ('paper_bin', 0);

-- Seed records preserve the original app baseline/history.
INSERT OR IGNORE INTO logs (id, task_id, person, actual_person, done_date, credit_weight, completion_type, scoring_period_id, note) VALUES
  ('hist-melanie-vacuum-2026-04-09', 'vacuum', 'Melanie', 'Melanie', '2026-04-09', 2.00, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('hist-melanie-deep-water-2026-03-30', 'deep_water', 'Melanie', 'Melanie', '2026-03-30', 3.00, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('hist-melanie-bath-2026-02-19', 'bath_toilet_basin', 'Melanie', 'Melanie', '2026-02-19', 2.40, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('hist-melanie-gas-2026-04-22', 'gas_stove', 'Melanie', 'Melanie', '2026-04-22', 1.20, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('hist-melanie-bio-2026-04-20', 'bio_bin', 'Melanie', 'Melanie', '2026-04-20', 0.60, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('hist-melanie-paper-2026-04-20', 'paper_bin', 'Melanie', 'Melanie', '2026-04-20', 1.00, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('hist-melanie-yellow-2026-04-20', 'yellow_bin', 'Melanie', 'Melanie', '2026-04-20', 0.80, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('hist-melanie-black-2026-04-20', 'black_bin', 'Melanie', 'Melanie', '2026-04-20', 0.80, 'baseline_history', 'initial_current_period', 'Historical credit: Melanie usually did this before the app started'),
  ('init-1', 'vacuum', 'Animesh', 'Animesh', '2026-04-19', 2.00, 'initial_record', 'initial_current_period', 'Initial record'),
  ('init-2', 'deep_water', 'Animesh', 'Animesh', '2026-04-19', 3.00, 'initial_record', 'initial_current_period', 'Initial record'),
  ('init-3', 'bath_toilet_basin', 'Animesh', 'Animesh', '2026-04-19', 2.40, 'initial_record', 'initial_current_period', 'Initial record'),
  ('init-4', 'bio_bin', 'Animesh', 'Animesh', '2026-04-29', 0.60, 'initial_record', 'initial_current_period', 'Initial record'),
  ('init-5', 'paper_bin', 'Animesh', 'Animesh', '2026-04-29', 1.00, 'initial_record', 'initial_current_period', 'Initial record'),
  ('init-6', 'gas_stove', 'Animesh', 'Animesh', '2026-04-29', 1.20, 'initial_record', 'initial_current_period', 'Initial record');
