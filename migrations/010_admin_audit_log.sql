-- SaviSanju Collections Database Schema
-- Migration: 010_admin_audit_log
-- Description: Adds an append-only audit trail for privileged admin actions
--              (stock changes, order status changes, product/variant CRUD).
--              Gives an after-the-fact record of WHO did WHAT, WHEN, and from
--              WHERE — useful for incident response and accountability.
--
-- RLS: like migration 009, access is gated on the per-request `app.is_admin`
--      session flag. Only admin/service contexts may read or write the log.
--      Enforcement is active only when the backend connects as the
--      least-privilege `savisanju_app` role (see 009 activation note).

-- ============================================
-- ADMIN AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,                 -- intentionally not FK: keep the log even if a user is deleted
  actor_email   TEXT,
  action        TEXT NOT NULL,        -- e.g. 'stock.update', 'order.status.update', 'product.create'
  target_type   TEXT,                 -- e.g. 'product_variant', 'order', 'product'
  target_id     TEXT,                 -- id/order_id of the affected entity
  metadata      JSONB,                -- arbitrary context (old/new values, notes length, etc.)
  ip            INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log (actor_user_id);

COMMENT ON TABLE admin_audit_log IS 'Append-only audit trail of privileged admin actions.';

-- ============================================
-- ROW LEVEL SECURITY (admin/service context only)
-- ============================================

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log FORCE ROW LEVEL SECURITY;

-- app_is_admin() is defined in migration 009.
CREATE POLICY admin_audit_log_select ON admin_audit_log FOR SELECT
  USING (app_is_admin());
CREATE POLICY admin_audit_log_insert ON admin_audit_log FOR INSERT
  WITH CHECK (app_is_admin());

-- ============================================
-- GRANTS FOR THE LEAST-PRIVILEGE APP ROLE
-- ============================================
-- Only SELECT + INSERT: the trail is append-only (no UPDATE/DELETE grant).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'savisanju_app') THEN
    -- Migration 009 set ALTER DEFAULT PRIVILEGES granting INSERT/SELECT/UPDATE/DELETE
    -- on all future tables. Revoke the mutating grants here so the audit trail is
    -- genuinely append-only at the privilege layer (RLS also denies UPDATE/DELETE
    -- since no such policy exists, but defense-in-depth is cheap and explicit).
    REVOKE UPDATE, DELETE ON admin_audit_log FROM savisanju_app;
    GRANT SELECT, INSERT ON admin_audit_log TO savisanju_app;
  END IF;
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 010_admin_audit_log.sql completed: created admin_audit_log with RLS (admin-only) and append-only grants';
END $$;
