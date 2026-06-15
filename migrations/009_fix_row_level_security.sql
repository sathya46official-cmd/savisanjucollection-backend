-- SaviSanju Collections Database Schema
-- Migration: 009_fix_row_level_security
-- Description: Replaces the broken Row Level Security policies from migration 002
--              with correct, portable policies, and extends RLS to the `orders`
--              table. Fixes the "Missing/ineffective RLS on critical tables" issue.
--
-- WHY THE OLD POLICIES WERE BROKEN
--   * Migration 002 used `auth.uid()` — a Supabase-only function. This project
--     uses plain PostgreSQL accessed by the Node backend, so those policies could
--     never evaluate correctly.
--   * They referenced `cart_items.cart_id`, but migration 006 models cart items by
--     `user_id` (there is no `cart_id`), so the policies did not match the schema.
--   * `orders` had no RLS at all.
--
-- HOW THE NEW POLICIES WORK
--   * Ownership is matched against a per-request session setting,
--     `app.current_user_id`, that the backend sets inside a transaction via
--     `set_config('app.current_user_id', <uuid>, true)` (see config/database.ts
--     `queryAsUser`). Admin/service access is granted when `app.is_admin = 'on'`.
--
-- ACTIVATION NOTE (IMPORTANT)
--   PostgreSQL superusers BYPASS RLS, and a table's owner bypasses it unless
--   FORCE ROW LEVEL SECURITY is set (done below). To make RLS actually ENFORCE,
--   the backend must connect as the least-privilege role `savisanju_app` created
--   here (not as `postgres`). Until then, RLS is a no-op and the application-layer
--   checks (authenticate + requireAdmin + `WHERE user_id = ...`) remain the
--   primary access control. These policies are defense-in-depth.

-- ============================================
-- SESSION CONTEXT HELPERS
-- ============================================

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.is_admin', true), 'off') = 'on';
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION app_current_user_id() IS 'Current request user id, set by the backend via set_config(app.current_user_id, ...).';
COMMENT ON FUNCTION app_is_admin() IS 'True when the backend marks the request as an admin/service context.';

-- ============================================
-- DROP BROKEN POLICIES FROM MIGRATION 002
-- ============================================

DROP POLICY IF EXISTS "Users can view their own cart" ON cart;
DROP POLICY IF EXISTS "Users can insert their own cart" ON cart;
DROP POLICY IF EXISTS "Users can update their own cart" ON cart;

DROP POLICY IF EXISTS "Users can view their own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert their own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update their own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete their own cart items" ON cart_items;

DROP POLICY IF EXISTS "Users can view their own notifications" ON stock_notifications;
DROP POLICY IF EXISTS "Anyone can insert stock notifications" ON stock_notifications;

-- ============================================
-- CART ITEMS RLS (keyed on user_id — matches migration 006)
-- ============================================

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items FORCE ROW LEVEL SECURITY;

CREATE POLICY cart_items_select ON cart_items FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_admin());
CREATE POLICY cart_items_insert ON cart_items FOR INSERT
  WITH CHECK (user_id = app_current_user_id());
CREATE POLICY cart_items_update ON cart_items FOR UPDATE
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
CREATE POLICY cart_items_delete ON cart_items FOR DELETE
  USING (user_id = app_current_user_id());

-- ============================================
-- ORDERS RLS (was completely missing)
-- ============================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

-- Users see/manage only their own orders. Guest orders (user_id IS NULL,
-- migration 003) are visible only to admin/service contexts.
CREATE POLICY orders_select ON orders FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_admin());
CREATE POLICY orders_insert ON orders FOR INSERT
  WITH CHECK (user_id = app_current_user_id() OR app_is_admin());
CREATE POLICY orders_update ON orders FOR UPDATE
  USING (user_id = app_current_user_id() OR app_is_admin())
  WITH CHECK (user_id = app_current_user_id() OR app_is_admin());

-- ============================================
-- STOCK NOTIFICATIONS RLS
-- ============================================

ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_notifications FORCE ROW LEVEL SECURITY;

-- Anyone (including guests) may register a notification request.
CREATE POLICY stock_notifications_insert ON stock_notifications FOR INSERT
  WITH CHECK (true);
-- A user can see their own; admin/service can see all.
CREATE POLICY stock_notifications_select ON stock_notifications FOR SELECT
  USING (
    app_is_admin()
    OR user_id = app_current_user_id()
    OR (user_id IS NULL AND app_is_admin())
  );

-- ============================================
-- LEAST-PRIVILEGE APPLICATION ROLE
-- ============================================
-- Connect the backend as this role (instead of a superuser) to ACTIVATE RLS.
-- Set a password out-of-band, e.g.:
--   ALTER ROLE savisanju_app WITH LOGIN PASSWORD '<strong-password>';
-- then point DB_USER/DB_PASSWORD at it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'savisanju_app') THEN
    CREATE ROLE savisanju_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO savisanju_app;

-- Read-only on the public catalog
GRANT SELECT ON products, product_variants TO savisanju_app;

-- Read/write on user-owned and auth tables (RLS constrains rows where enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  user_profiles, user_auth, cart_items, orders, stock_notifications,
  email_verification_tokens
TO savisanju_app;

-- Ensure future tables/sequences are usable by the app role
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO savisanju_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO savisanju_app;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 009_fix_row_level_security.sql completed: corrected RLS on cart_items, orders, stock_notifications + savisanju_app role';
END $$;
