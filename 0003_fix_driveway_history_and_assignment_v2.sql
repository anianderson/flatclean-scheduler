-- Hotfix for current production DB after checking driveway/backyard history.
-- Problem found:
--   1) first_cycle_assignment_credit rows exist, but only with credit_weight = base_weight (4).
--      For this very heavy first-cycle chore, that can still select Naveen again.
--   2) a legacy schedule_seed row is only a due-date seed, but older backend logic could treat it
--      like a real substantial completion and block the hidden historical credits.
--   3) old assignment_logs for the current driveway/backyard cycle preserve the stale assignment.
--
-- This migration keeps the 2026-07-01 due date, makes the seed non-scoring, strengthens the
-- first-cycle historical credit for Naveen and Melanie, and forces one recalculation.

-- Treat legacy schedule_seed rows as pre-launch baseline due-date seeds.
-- They remain non-dummy so the due date still comes from next_due_date, but the backend ignores
-- them for score/task-count/repeat fairness because pre_launch_baseline is non-scoring.
UPDATE logs
SET completion_type = 'pre_launch_baseline',
    credit_weight = 0,
    note = 'Pre-launch baseline only. Keeps the next due date but is hidden from current logs and not counted in fairness scores.'
WHERE task_id = 'driveway_backyard'
  AND completion_type = 'schedule_seed';

-- Keep/insert hidden first-cycle history for both people who already did this heavy task.
INSERT OR REPLACE INTO logs (
  id, task_id, person, actual_person, assigned_person, done_date,
  scheduled_due_date, next_due_date, completion_type, credit_weight,
  is_partial, completion_ratio, cycle_id, scoring_period_id, is_dummy, note
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
  COALESCE(base_weight, 1) * 2,
  0,
  1,
  'driveway_backyard:first_cycle_history:naveen',
  NULL,
  1,
  'Hidden double historical assignment credit. Naveen already did driveway/backyard before the app; used only for the first substantial app cycle.'
FROM tasks
WHERE id = 'driveway_backyard';

INSERT OR REPLACE INTO logs (
  id, task_id, person, actual_person, assigned_person, done_date,
  scheduled_due_date, next_due_date, completion_type, credit_weight,
  is_partial, completion_ratio, cycle_id, scoring_period_id, is_dummy, note
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
  COALESCE(base_weight, 1) * 2,
  0,
  1,
  'driveway_backyard:first_cycle_history:melanie',
  NULL,
  1,
  'Hidden double historical assignment credit. Melanie already did driveway/backyard before the app; used only for the first substantial app cycle.'
FROM tasks
WHERE id = 'driveway_backyard';

-- Remove stale transparency rows for the current cycle so the backend creates exactly one fresh row.
DELETE FROM assignment_logs
WHERE task_id = 'driveway_backyard'
  AND scheduled_due_date = '2026-07-01';
