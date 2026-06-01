-- Repair existing rows that were accidentally pushed too far into the future.
-- Rule: next_due_date may be at most done_date + frequency + 3 days.
-- Safe to run more than once.

UPDATE logs
SET next_due_date = date(
  done_date,
  '+' || (
    COALESCE((SELECT interval_days FROM tasks WHERE tasks.id = logs.task_id), 0) + 3
  ) || ' days'
)
WHERE COALESCE(is_dummy, 0) = 0
  AND done_date IS NOT NULL
  AND next_due_date IS NOT NULL
  AND task_id IN (
    SELECT id
    FROM tasks
    WHERE type = 'scheduled'
      AND interval_days IS NOT NULL
      AND interval_days > 0
  )
  AND next_due_date > date(
    done_date,
    '+' || (
      COALESCE((SELECT interval_days FROM tasks WHERE tasks.id = logs.task_id), 0) + 3
    ) || ' days'
  );
