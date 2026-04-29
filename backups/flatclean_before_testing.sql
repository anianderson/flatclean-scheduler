PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE flatmates (
  name TEXT PRIMARY KEY
, email TEXT);
INSERT INTO "flatmates" ("name","email") VALUES('Melanie',NULL);
INSERT INTO "flatmates" ("name","email") VALUES('Animesh','aniaashu68@gmail.com');
INSERT INTO "flatmates" ("name","email") VALUES('Naveen',NULL);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  interval_days INTEGER,
  task_group TEXT,
  also_logs TEXT
, base_weight REAL DEFAULT 1);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('vacuum','Vacuum cleaning whole flat','scheduled',10,'floor',NULL,2);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('deep_water','Deep water cleaning whole flat','scheduled',20,'floor','vacuum',3);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('bath_toilet_basin','Bathtub, toilet and wash basin cleaning','scheduled',61,'bathroom',NULL,2.4);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('gas_stove','Gas stove cleaning','scheduled',7,'kitchen',NULL,1.2);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('bio_bin','Bio trash bin cleaning','on_demand',NULL,'trash',NULL,0.6);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('yellow_bin','Yellow trash bin cleaning','on_demand',NULL,'trash',NULL,0.8);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('black_bin','Black trash bin cleaning','on_demand',NULL,'trash',NULL,0.8);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('paper_bin','Paper trash bin cleaning','on_demand',NULL,'trash',NULL,1);
INSERT INTO "tasks" ("id","name","type","interval_days","task_group","also_logs","base_weight") VALUES('driveway_backyard','Driveway and backyard cleaning','scheduled',122,'outside',NULL,4);
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  person TEXT NOT NULL,
  done_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, scheduled_due_date TEXT, next_due_date TEXT, assigned_person TEXT, actual_person TEXT, completion_type TEXT DEFAULT 'normal', credit_weight REAL DEFAULT 1, is_partial INTEGER DEFAULT 0, completion_ratio REAL DEFAULT 1, cycle_id TEXT, scoring_period_id TEXT, is_dummy INTEGER DEFAULT 0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('init-1','vacuum','Animesh','2026-04-19','Initial record','2026-04-29 10:45:22',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('init-2','deep_water','Animesh','2026-04-19','Initial record','2026-04-29 10:45:22',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('init-3','bath_toilet_basin','Animesh','2026-04-19','Initial record','2026-04-29 10:45:22',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('init-4','bio_bin','Animesh','2026-04-29','Initial record','2026-04-29 10:45:22',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('init-5','paper_bin','Animesh','2026-04-29','Initial record','2026-04-29 10:45:22',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('init-6','gas_stove','Animesh','2026-04-29','Initial record','2026-04-29 10:45:22',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'vacuum','Melanie','2026-04-09','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'deep_water','Melanie','2026-03-30','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'bath_toilet_basin','Melanie','2026-02-19','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'gas_stove','Melanie','2026-04-22','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'bio_bin','Melanie','2026-04-20','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'paper_bin','Melanie','2026-04-20','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'yellow_bin','Melanie','2026-04-20','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES(NULL,'black_bin','Melanie','2026-04-20','Historical credit: Melanie usually did this before the app started','2026-04-29 11:06:33',NULL,NULL,NULL,NULL,'normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('08bd6395-a855-46d0-8a38-9d00b1a1feed','driveway_backyard','Melanie','2026-03-01','Marked done','2026-04-29 12:33:38',NULL,'2026-07-01','Melanie','Melanie','normal',1,0,1,NULL,'period_d68a12b07476c79b',0);
INSERT INTO "logs" ("id","task_id","person","done_date","note","created_at","scheduled_due_date","next_due_date","assigned_person","actual_person","completion_type","credit_weight","is_partial","completion_ratio","cycle_id","scoring_period_id","is_dummy") VALUES('35f187ce-0336-40c6-87a2-63265dc73f41','gas_stove','Animesh','2026-04-29','[DUMMY TEST] Marked done','2026-04-29 15:46:23','2026-05-06','2026-05-13','Melanie','Animesh','completed_by_other_early',0,0,1,'gas_stove:2026-05-06','period_launch_current',1);
CREATE TABLE bin_status (
  task_id TEXT PRIMARY KEY,
  is_full INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "bin_status" ("task_id","is_full","updated_at") VALUES('bio_bin',0,'2026-04-29 12:47:30');
INSERT INTO "bin_status" ("task_id","is_full","updated_at") VALUES('yellow_bin',0,'2026-04-29 10:45:22');
INSERT INTO "bin_status" ("task_id","is_full","updated_at") VALUES('black_bin',0,'2026-04-29 11:30:09');
INSERT INTO "bin_status" ("task_id","is_full","updated_at") VALUES('paper_bin',0,'2026-04-29 12:15:21');
CREATE TABLE subtasks (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_de TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('stairway_area','Stairway area','Treppenbereich',1.5,10);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('kitchen_area','Kitchen area','Küche',1.25,20);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('hallway','Hallway','Flur',1.25,30);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('bathroom_floor','Bathroom','Bad',1,40);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('bathtub','Bathtub','Badewanne',1.2,10);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('toilet','Toilet','Toilette',1.2,20);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('wash_basin','Wash basin','Waschbecken',0.8,30);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('driveway','Driveway','Einfahrt',1,10);
INSERT INTO "subtasks" ("id","name_en","name_de","weight","sort_order") VALUES('backyard','Backyard','Hinterhof',1,20);
CREATE TABLE task_subtasks (
  task_id TEXT NOT NULL,
  subtask_id TEXT NOT NULL,
  PRIMARY KEY (task_id, subtask_id)
);
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('vacuum','stairway_area');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('vacuum','kitchen_area');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('vacuum','hallway');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('vacuum','bathroom_floor');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('deep_water','stairway_area');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('deep_water','kitchen_area');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('deep_water','hallway');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('deep_water','bathroom_floor');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('bath_toilet_basin','bathtub');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('bath_toilet_basin','toilet');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('bath_toilet_basin','wash_basin');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('driveway_backyard','driveway');
INSERT INTO "task_subtasks" ("task_id","subtask_id") VALUES('driveway_backyard','backyard');
CREATE TABLE log_subtasks (
  log_id TEXT NOT NULL,
  subtask_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  weight REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (log_id, subtask_id)
);
CREATE TABLE email_log (
  id TEXT PRIMARY KEY,
  email_type TEXT NOT NULL,
  task_id TEXT,
  recipient_person TEXT,
  recipient_email TEXT NOT NULL,
  reference_date TEXT,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL,
  error TEXT
);
INSERT INTO "email_log" ("id","email_type","task_id","recipient_person","recipient_email","reference_date","sent_at","status","error") VALUES('2e854674-cb32-4bf6-be0b-05ff403baae8','developer_test',NULL,'Animesh','aniaashu68@gmail.com','2026-04-29','2026-04-29 15:45:43','sent',NULL);
CREATE TABLE score_milestones (
  person TEXT NOT NULL,
  milestone INTEGER NOT NULL,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (person, milestone)
);
CREATE TABLE scoring_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  reason TEXT
);
INSERT INTO "scoring_periods" ("id","name","started_at","ended_at","reason") VALUES('period_d68a12b07476c79b','Current period','2026-04-29 14:56:57','2026-04-29 15:18:19','Initial active scoring period');
INSERT INTO "scoring_periods" ("id","name","started_at","ended_at","reason") VALUES('period_before_launch','Before launch','2026-04-29 00:00:00','2026-04-29 15:18:19','Archived existing setup/testing points before official app launch');
INSERT INTO "scoring_periods" ("id","name","started_at","ended_at","reason") VALUES('period_launch_current','Current period','2026-04-29 15:18:19',NULL,'Official launch: everyone starts from 0 points');
CREATE TABLE flatmate_history (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  action TEXT NOT NULL,
  scoring_period_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);
CREATE TABLE admin_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
