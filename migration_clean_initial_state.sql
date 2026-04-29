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
  'Clean launch: logs, scores, milestones and history reset'
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

PRAGMA foreign_keys = ON;