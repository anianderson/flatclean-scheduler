CREATE TABLE IF NOT EXISTS flatmates (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  interval_days INTEGER,
  task_group TEXT,
  also_logs TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  person TEXT NOT NULL,
  done_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bin_status (
  task_id TEXT PRIMARY KEY,
  is_full INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO flatmates (name) VALUES ('Melanie'), ('Animesh'), ('Neveen');

INSERT OR IGNORE INTO tasks (id, name, type, interval_days, task_group, also_logs) VALUES
('vacuum', 'Vacuum cleaning whole flat', 'scheduled', 10, 'floor', NULL),
('deep_water', 'Deep water cleaning whole flat', 'scheduled', 20, 'floor', 'vacuum'),
('bath_toilet_basin', 'Bathtub, toilet and wash basin cleaning', 'scheduled', 61, 'bathroom', NULL),
('gas_stove', 'Gas stove cleaning', 'scheduled', 7, 'kitchen', NULL),
('bio_bin', 'Bio trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
('yellow_bin', 'Yellow trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
('black_bin', 'Black trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
('paper_bin', 'Paper trash bin cleaning', 'on_demand', NULL, 'trash', NULL),
('driveway_backyard', 'Driveway and backyard cleaning', 'scheduled', 122, 'outside', NULL);

INSERT OR IGNORE INTO bin_status (task_id, is_full) VALUES
('bio_bin', 0), ('yellow_bin', 0), ('black_bin', 0), ('paper_bin', 0);

INSERT OR IGNORE INTO logs (id, task_id, person, done_date, note) VALUES
('init-1', 'vacuum', 'Animesh', '2026-04-19', 'Initial record'),
('init-2', 'deep_water', 'Animesh', '2026-04-19', 'Initial record'),
('init-3', 'bath_toilet_basin', 'Animesh', '2026-04-19', 'Initial record'),
('init-4', 'bio_bin', 'Animesh', '2026-04-29', 'Initial record'),
('init-5', 'paper_bin', 'Animesh', '2026-04-29', 'Initial record'),
('init-6', 'gas_stove', 'Animesh', '2026-04-29', 'Initial record');
