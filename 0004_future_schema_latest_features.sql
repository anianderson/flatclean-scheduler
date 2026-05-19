-- Optional safety migration for future DBs/backfills.
-- Normalize any legacy schedule_seed rows so they stay useful for due dates but never count as real work.
UPDATE logs
SET completion_type = 'pre_launch_baseline',
    credit_weight = 0,
    note = COALESCE(note, 'Pre-launch baseline only. Kept for due-date seed; not counted in fairness scores.')
WHERE completion_type = 'schedule_seed';
