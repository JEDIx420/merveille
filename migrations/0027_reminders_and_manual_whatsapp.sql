-- 0027_reminders_and_manual_whatsapp.sql
-- Stage N04: Fixed reminder presets, user snoozes (without altering deadlines),
-- and suppression of legacy queued WhatsApp outbox rows in favor of manual sharing.

CREATE TABLE IF NOT EXISTS reminder_preset_configs (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preset_key TEXT NOT NULL, -- TASK_DUE, TASK_OVERDUE, LEAD_FOLLOWUP, LEAD_NEEDS_ATTENTION, CONSULTANT_REVIEW_PENDING, MANAGER_RELEASE_WAITING, CLIENT_PUBLICATION
  is_enabled INTEGER NOT NULL DEFAULT 1,
  office_hours_start TEXT NOT NULL DEFAULT '09:00',
  office_hours_end TEXT NOT NULL DEFAULT '18:00',
  delay_working_days INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, preset_key)
);

CREATE TABLE IF NOT EXISTS reminder_snoozes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  snoozed_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id, source_entity_type, source_entity_id)
);

-- Suppress any outstanding un-dispatched WHATSAPP obligations so they cannot replay
UPDATE notifications
SET status = 'SUPPRESSED',
    suppression_reason = 'MANUAL_WHATSAPP_PHASE_DISABLED'
WHERE channel = 'WHATSAPP' AND status IN ('QUEUED', 'FAILED', 'PROCESSING');
