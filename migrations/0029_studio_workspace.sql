-- Additive studio preferences, labels, and immutable automation publications.
CREATE TABLE studio_views (
 org_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), scope_key TEXT NOT NULL,
 settings_json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(org_id,user_id,scope_key)
);
CREATE TABLE studio_task_labels (
 org_id TEXT NOT NULL, task_id TEXT NOT NULL, task_scope TEXT NOT NULL CHECK(task_scope IN ('PROJECT','PERSONAL')),
 labels_json TEXT NOT NULL DEFAULT '[]', PRIMARY KEY(org_id,task_id,task_scope)
);
CREATE TABLE automation_rules (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), project_id TEXT REFERENCES projects(id),
 owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, draft_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, published_revision INTEGER, publisher_id TEXT REFERENCES users(id),
 state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ACTIVE','PAUSED')), next_run_at INTEGER,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX automation_due ON automation_rules(state,next_run_at);
CREATE INDEX automation_scope ON automation_rules(org_id,project_id,owner_id);
CREATE TABLE automation_publications (
 rule_id TEXT NOT NULL REFERENCES automation_rules(id), revision INTEGER NOT NULL,
 definition_json TEXT NOT NULL, publisher_id TEXT NOT NULL REFERENCES users(id), published_at INTEGER NOT NULL,
 PRIMARY KEY(rule_id,revision)
);
CREATE TABLE automation_runs (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES automation_rules(id), revision INTEGER NOT NULL,
 source_key TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 UNIQUE(rule_id,revision,source_key)
);
CREATE TABLE automation_effects (
 run_id TEXT NOT NULL REFERENCES automation_runs(id), action_index INTEGER NOT NULL,
 entity_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(run_id,action_index)
);
CREATE TABLE automation_ai_usage (
 org_id TEXT NOT NULL, user_id TEXT NOT NULL, day TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(org_id,user_id,day)
);
CREATE TABLE automation_notification_sources (
 notification_id TEXT PRIMARY KEY REFERENCES notifications(id), rule_id TEXT NOT NULL REFERENCES automation_rules(id),
 trigger_type TEXT NOT NULL, task_id TEXT, drawing_version_id TEXT, owner_id TEXT NOT NULL
);
CREATE INDEX automation_run_source ON automation_runs(rule_id,revision,source_key,status);
CREATE INDEX studio_tasks_due ON tasks(org_id,project_id,effective_due_date,status);
CREATE INDEX studio_personal_due ON personal_tasks(org_id,owner_user_id,due_date,status);
