ALTER TABLE logs ADD COLUMN scheduled_due_date TEXT;
ALTER TABLE logs ADD COLUMN next_due_date TEXT;
ALTER TABLE logs ADD COLUMN assigned_person TEXT;
ALTER TABLE logs ADD COLUMN actual_person TEXT;
ALTER TABLE logs ADD COLUMN completion_type TEXT DEFAULT 'normal';
ALTER TABLE logs ADD COLUMN credit_weight REAL DEFAULT 1;