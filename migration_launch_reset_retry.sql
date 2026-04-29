CREATE TABLE IF NOT EXISTS scoring_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  reason TEXT
);

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

CREATE TABLE IF NOT EXISTS score_milestones (
  person TEXT NOT NULL,
  milestone INTEGER NOT NULL,
  scoring_period_id TEXT,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (person, milestone, scoring_period_id)
);

INSERT OR IGNORE INTO scoring_periods (
  id,
  name,
  started_at,
  ended_at,
  reason
)
VALUES (
  'period_before_launch',
  'Before launch',
  '2026-04-29 00:00:00',
  CURRENT_TIMESTAMP,
  'Archived existing setup/testing points before official app launch'
);

UPDATE logs
SET scoring_period_id = 'period_before_launch'
WHERE scoring_period_id IS NULL
   OR scoring_period_id = ''
   OR scoring_period_id NOT IN (
     SELECT id FROM scoring_periods WHERE ended_at IS NULL
   );

UPDATE scoring_periods
SET ended_at = CURRENT_TIMESTAMP
WHERE ended_at IS NULL;

INSERT OR IGNORE INTO scoring_periods (
  id,
  name,
  started_at,
  ended_at,
  reason
)
VALUES (
  'period_launch_current',
  'Current period',
  CURRENT_TIMESTAMP,
  NULL,
  'Official launch: everyone starts from 0 points'
);

DELETE FROM score_milestones;

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