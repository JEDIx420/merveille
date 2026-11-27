-- Personal workspace preferences; no business records or permissions are changed.
CREATE TABLE workspace_preferences (
 org_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id),
 view_mode TEXT NOT NULL DEFAULT 'LIST' CHECK(view_mode IN ('LIST','BOARD','CALENDAR')),
 favorite_projects TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL,
 PRIMARY KEY(org_id,user_id)
);
CREATE TABLE personal_task_comments (
 id TEXT PRIMARY KEY, personal_task_id TEXT NOT NULL REFERENCES personal_tasks(id),
 body_text TEXT NOT NULL, created_at INTEGER NOT NULL
);
