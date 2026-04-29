CREATE TABLE IF NOT EXISTS scoring_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  reason TEXT
);

INSERT INTO scoring_periods (id, name, reason)
SELECT 'period_' || lower(hex(randomblob(8))), 'Current period', 'Initial active scoring period'
WHERE NOT EXISTS (SELECT 1 FROM scoring_periods);

ALTER TABLE logs ADD COLUMN scoring_period_id TEXT;
ALTER TABLE logs ADD COLUMN is_dummy INTEGER DEFAULT 0;

UPDATE logs
SET scoring_period_id = (
  SELECT id FROM scoring_periods WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1
)
WHERE scoring_period_id IS NULL;

CREATE TABLE IF NOT EXISTS flatmate_history (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  action TEXT NOT NULL,
  scoring_period_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);

CREATE TABLE IF NOT EXISTS admin_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

UPDATE tasks SET base_weight = 2.00 WHERE id = 'vacuum';
UPDATE tasks SET base_weight = 3.00 WHERE id = 'deep_water';
UPDATE tasks SET base_weight = 2.40 WHERE id = 'bath_toilet_basin';
UPDATE tasks SET base_weight = 1.20 WHERE id = 'gas_stove';
UPDATE tasks SET base_weight = 0.60 WHERE id = 'bio_bin';
UPDATE tasks SET base_weight = 0.80 WHERE id = 'yellow_bin';
UPDATE tasks SET base_weight = 0.80 WHERE id = 'black_bin';
UPDATE tasks SET base_weight = 1.00 WHERE id = 'paper_bin';
UPDATE tasks SET base_weight = 4.00 WHERE id = 'driveway_backyard';

UPDATE subtasks SET weight = 1.50 WHERE id = 'stairway_area';
UPDATE subtasks SET weight = 1.25 WHERE id = 'kitchen_area';
UPDATE subtasks SET weight = 1.25 WHERE id = 'hallway';
UPDATE subtasks SET weight = 1.00 WHERE id = 'bathroom_floor';

UPDATE subtasks SET weight = 1.20 WHERE id = 'bathtub';
UPDATE subtasks SET weight = 1.20 WHERE id = 'toilet';
UPDATE subtasks SET weight = 0.80 WHERE id = 'wash_basin';

UPDATE subtasks SET weight = 1.00 WHERE id = 'driveway';
UPDATE subtasks SET weight = 1.00 WHERE id = 'backyard';