PRAGMA foreign_keys = OFF;

DELETE FROM log_subtasks;
DELETE FROM logs;
DELETE FROM email_log;
DELETE FROM score_milestones;
DELETE FROM flatmate_history;
DELETE FROM bin_status;
DELETE FROM scoring_periods;

INSERT INTO scoring_periods (
  id,
  name,
  started_at,
  reason
)
VALUES (
  'launch-period',
  'Current period',
  CURRENT_TIMESTAMP,
  'Clean launch: visible logs, scores, milestones and history reset. Pre-launch baseline kept only for fair scheduling.'
);

INSERT OR IGNORE INTO bin_status (
  task_id,
  is_full,
  updated_at
)
SELECT
  id,
  0,
  CURRENT_TIMESTAMP
FROM tasks
WHERE type = 'on_demand';

-- Hidden pre-launch baseline.
-- scoring_period_id is NULL, so these do NOT count in launch scores
-- and do NOT appear in current recent logs.
-- They only help the scheduler know who recently did what.

INSERT INTO logs (
  id,
  task_id,
  person,
  actual_person,
  assigned_person,
  done_date,
  scheduled_due_date,
  next_due_date,
  completion_type,
  credit_weight,
  is_partial,
  completion_ratio,
  cycle_id,
  scoring_period_id,
  is_dummy,
  note
)
VALUES
(
  'baseline-vacuum-2026-04-19',
  'vacuum',
  'Animesh',
  'Animesh',
  NULL,
  '2026-04-19',
  NULL,
  '2026-04-29',
  'pre_launch_baseline',
  0,
  0,
  1,
  'vacuum:2026-04-29',
  NULL,
  0,
  'Pre-launch baseline only. Hidden from current log and not counted in scores.'
),
(
  'baseline-deep-water-2026-04-19',
  'deep_water',
  'Animesh',
  'Animesh',
  NULL,
  '2026-04-19',
  NULL,
  '2026-05-09',
  'pre_launch_baseline',
  0,
  0,
  1,
  'deep_water:2026-05-09',
  NULL,
  0,
  'Pre-launch baseline only. Hidden from current log and not counted in scores.'
),
(
  'baseline-bath-toilet-basin-2026-04-19',
  'bath_toilet_basin',
  'Animesh',
  'Animesh',
  NULL,
  '2026-04-19',
  NULL,
  '2026-06-18',
  'pre_launch_baseline',
  0,
  0,
  1,
  'bath_toilet_basin:2026-06-18',
  NULL,
  0,
  'Pre-launch baseline only. Hidden from current log and not counted in scores.'
),
(
  'baseline-gas-stove-2026-04-29',
  'gas_stove',
  'Animesh',
  'Animesh',
  NULL,
  '2026-04-29',
  NULL,
  '2026-05-06',
  'pre_launch_baseline',
  0,
  0,
  1,
  'gas_stove:2026-05-06',
  NULL,
  0,
  'Pre-launch baseline only. Hidden from current log and not counted in scores.'
),
(
  'baseline-bio-bin-2026-04-29',
  'bio_bin',
  'Animesh',
  'Animesh',
  NULL,
  '2026-04-29',
  NULL,
  NULL,
  'pre_launch_baseline',
  0,
  0,
  1,
  'bio_bin:2026-04-29',
  NULL,
  0,
  'Pre-launch baseline only. Hidden from current log and not counted in scores.'
),
(
  'baseline-paper-bin-2026-04-29',
  'paper_bin',
  'Animesh',
  'Animesh',
  NULL,
  '2026-04-29',
  NULL,
  NULL,
  'pre_launch_baseline',
  0,
  0,
  1,
  'paper_bin:2026-04-29',
  NULL,
  0,
  'Pre-launch baseline only. Hidden from current log and not counted in scores.'
),
(
  'baseline-driveway-backyard-2026-03-01',
  'driveway_backyard',
  'Melanie',
  'Melanie',
  NULL,
  '2026-03-01',
  NULL,
  '2026-07-01',
  'pre_launch_baseline',
  0,
  0,
  1,
  'driveway_backyard:2026-07-01',
  NULL,
  0,
  'Pre-launch baseline only. Hidden from current log and not counted in scores.'
);

PRAGMA foreign_keys = ON;