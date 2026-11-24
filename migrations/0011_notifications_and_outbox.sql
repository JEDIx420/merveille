-- 0011_notifications_and_outbox.sql
-- Merveille Designs: Transactional Outbox, In-Portal Notifications, WhatsApp Delivery Tracking, Escalations, and Webhooks.

-- 1. Transactional Outbox Events
CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, DISPATCHED, SUPPRESSED, FAILED
  created_at INTEGER NOT NULL,
  dispatched_at INTEGER
);

-- 2. Notifications (In-portal and outbound recipient rows)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'PORTAL', -- PORTAL, WHATSAPP
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  target_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, SENT, DELIVERED, READ, FAILED, SUPPRESSED, UNKNOWN
  suppression_reason TEXT,
  provider_message_id TEXT,
  delivery_error TEXT,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);

-- 3. Notification Escalations (Admin oversight for unresolved overdue items)
CREATE TABLE IF NOT EXISTS notification_escalations (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  escalated_to_user_id TEXT NOT NULL REFERENCES users(id),
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  overdue_days INTEGER NOT NULL DEFAULT 1,
  escalation_status TEXT NOT NULL DEFAULT 'ESCALATED', -- ESCALATED, RESOLVED
  created_at INTEGER NOT NULL
);

-- 4. WhatsApp Message Delivery Records
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  payload_safe_context TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, SENT, DELIVERED, FAILED, UNKNOWN
  provider_message_id TEXT UNIQUE,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 5. Webhook Events (Meta webhook signature deduplication and receipt logs)
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'WHATSAPP_META',
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
