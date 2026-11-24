-- 0001_identity_and_permissions.sql
-- Merveille Designs: Foundation schema for organizations, users, identities, roles, and audit.

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  base_currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at INTEGER NOT NULL
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INVITED, DISABLED
  created_at INTEGER NOT NULL,
  disabled_at INTEGER
);

-- 3. Identities (Linked Cloudflare Access or OAuth identities)
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- cloudflare_access, synthetic, etc.
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, issuer, subject)
);

-- 4. Organization Memberships
CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id)
);

-- 5. Role Assignments (Global capability bundles)
CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- ADMIN, OWNER, MANAGER, STAFF, CONSULTANT, MAIN_CLIENT, CLIENT_REP
  scope TEXT NOT NULL DEFAULT 'GLOBAL',
  granted_by TEXT REFERENCES users(id),
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER
);

-- 6. Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  intended_role TEXT NOT NULL,
  project_id TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, EXPIRED, REVOKED
  expires_at INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  accepted_at INTEGER
);

-- 7. Client Accounts (Grouping households / commercial entities)
CREATE TABLE IF NOT EXISTS client_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'RESIDENTIAL', -- RESIDENTIAL, COMMERCIAL, INSTITUTIONAL
  contact_info TEXT,
  created_at INTEGER NOT NULL
);

-- 8. Client Account Memberships (Distinguishes MAIN_CLIENT vs CLIENT_REP)
CREATE TABLE IF NOT EXISTS client_account_memberships (
  id TEXT PRIMARY KEY,
  client_account_id TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL, -- MAIN_CLIENT, CLIENT_REP
  is_contractual_authority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (client_account_id, user_id)
);

-- 9. Base Projects Table (Required for project scopes, foreign keys, and memberships)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_account_id TEXT REFERENCES client_accounts(id),
  main_client_user_id TEXT REFERENCES users(id),
  manager_user_id TEXT REFERENCES users(id),
  stage TEXT NOT NULL DEFAULT 'ENQUIRY',
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED
  is_archived INTEGER NOT NULL DEFAULT 0,
  archive_reason TEXT,
  archived_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 10. Project Memberships (Scoped project access)
CREATE TABLE IF NOT EXISTS project_memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL, -- MANAGER, TEAM_MEMBER, CONSULTANT, MAIN_CLIENT, CLIENT_REP
  is_active INTEGER NOT NULL DEFAULT 1,
  assigned_at INTEGER NOT NULL,
  revoked_at INTEGER
);

-- 11. Audit Events (Append-only security and operational audit trail)
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'PROJECT',
  old_state TEXT,
  new_state TEXT,
  reason TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL
);

-- Seed Default Organization and Practice Admin
INSERT OR IGNORE INTO organizations (id, name, timezone, base_currency, status, created_at)
VALUES ('org_merveille_main', 'Merveille Designs', 'Asia/Kolkata', 'INR', 'ACTIVE', 1700000000000);

INSERT OR IGNORE INTO users (id, email, display_name, status, created_at)
VALUES ('usr_admin_001', 'admin@merveilledesigns.com', 'Operations & Finance Admin', 'ACTIVE', 1700000000000);

INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at)
VALUES ('om_admin_001', 'org_merveille_main', 'usr_admin_001', 1, 1700000000000);

INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at)
VALUES ('ra_admin_001', 'org_merveille_main', 'usr_admin_001', 'ADMIN', 'GLOBAL', 1700000000000);
