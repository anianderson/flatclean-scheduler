-- Database-backed hidden historical assignment credits.
-- These are not visible activity and do not move due dates because is_dummy = 1.
-- The app uses them only for the first substantial app cycle of each chore.

INSERT OR IGNORE INTO logs (
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
SELECT
  'first-cycle-history-driveway-backyard-naveen',
  'driveway_backyard',
  'Naveen',
  'Naveen',
  NULL,
  '2026-03-01',
  NULL,
  NULL,
  'first_cycle_assignment_credit',
  COALESCE(base_weight, 1),
  0,
  1,
  'driveway_backyard:first_cycle_history:naveen',
  NULL,
  1,
  'Hidden historical assignment credit only. Naveen did driveway/backyard before the app. Used only for the first substantial app cycle.'
FROM tasks
WHERE id = 'driveway_backyard';

INSERT OR IGNORE INTO logs (
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
SELECT
  'first-cycle-history-driveway-backyard-melanie',
  'driveway_backyard',
  'Melanie',
  'Melanie',
  NULL,
  '2026-03-01',
  NULL,
  NULL,
  'first_cycle_assignment_credit',
  COALESCE(base_weight, 1),
  0,
  1,
  'driveway_backyard:first_cycle_history:melanie',
  NULL,
  1,
  'Hidden historical assignment credit only. Melanie did driveway/backyard before the app. Used only for the first substantial app cycle.'
FROM tasks
WHERE id = 'driveway_backyard';

INSERT OR IGNORE INTO logs (
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
SELECT
  'first-cycle-history-bath-toilet-basin-animesh',
  'bath_toilet_basin',
  'Animesh',
  'Animesh',
  NULL,
  '2026-04-19',
  NULL,
  NULL,
  'first_cycle_assignment_credit',
  COALESCE(base_weight, 1),
  0,
  1,
  'bath_toilet_basin:first_cycle_history:animesh',
  NULL,
  1,
  'Hidden historical assignment credit only. Animesh did bathtub/toilet/wash basin before the app. Used only for the first substantial app cycle.'
FROM tasks
WHERE id = 'bath_toilet_basin';
