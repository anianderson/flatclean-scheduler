ALTER TABLE tasks ADD COLUMN base_weight REAL DEFAULT 1;

ALTER TABLE logs ADD COLUMN is_partial INTEGER DEFAULT 0;
ALTER TABLE logs ADD COLUMN completion_ratio REAL DEFAULT 1;
ALTER TABLE logs ADD COLUMN cycle_id TEXT;

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
  PRIMARY KEY (task_id, subtask_id)
);

CREATE TABLE IF NOT EXISTS log_subtasks (
  log_id TEXT NOT NULL,
  subtask_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  weight REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (log_id, subtask_id)
);

INSERT OR REPLACE INTO subtasks (id, name_en, name_de, weight, sort_order) VALUES
  ('stairway_area', 'Stairway area', 'Treppenbereich', 1.50, 10),
  ('kitchen_area', 'Kitchen area', 'Küche', 1.25, 20),
  ('hallway', 'Hallway', 'Flur', 1.25, 30),
  ('bathroom_floor', 'Bathroom', 'Bad', 1.00, 40),

  ('bathtub', 'Bathtub', 'Badewanne', 1.20, 10),
  ('toilet', 'Toilet', 'Toilette', 1.20, 20),
  ('wash_basin', 'Wash basin', 'Waschbecken', 0.80, 30),

  ('driveway', 'Driveway', 'Einfahrt', 1.00, 10),
  ('backyard', 'Backyard', 'Hinterhof', 1.00, 20);

INSERT OR REPLACE INTO task_subtasks (task_id, subtask_id) VALUES
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

UPDATE tasks SET base_weight = 1.00 WHERE id IN ('vacuum', 'gas_stove', 'bio_bin');
UPDATE tasks SET base_weight = 1.15 WHERE id IN ('yellow_bin', 'black_bin');
UPDATE tasks SET base_weight = 1.35 WHERE id = 'paper_bin';
UPDATE tasks SET base_weight = 1.20 WHERE id = 'deep_water';
UPDATE tasks SET base_weight = 1.00 WHERE id = 'bath_toilet_basin';
UPDATE tasks SET base_weight = 1.00 WHERE id = 'driveway_backyard';