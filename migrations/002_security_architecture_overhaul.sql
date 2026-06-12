-- SaviSanju Collections Database Schema
-- Migration: 002_security_architecture_overhaul
-- Description: Security enhancements and e-commerce feature additions
-- Requirements: 2.73-2.83, 14.1-14.11

-- ============================================
-- NOTES
-- ============================================
-- This migration is designed to be backward compatible with existing data.
-- All new columns have DEFAULT values or allow NULL to prevent breaking existing records.
-- The migration is idempotent - it can be run multiple times safely.

-- ============================================
-- VERIFICATION: Check existing schema
-- ============================================
-- This migration assumes 001_initial_schema.sql has been applied.
-- The following tables should already exist:
-- - user_profiles (with email_verified, address fields, country)
-- - user_auth
-- - products
-- - product_variants (with quantity field)
-- - cart (with user_id, created_at, updated_at)
-- - cart_items (with cart_id, variant_id, quantity, added_at)
-- - orders (with status, admin_notes, contacted_at, confirmed_price, quantity)
-- - stock_notifications (with user_id, variant_id, email, notified_at)

-- ============================================
-- SAFETY CHECK: Verify critical tables exist
-- ============================================
DO $$
BEGIN
  -- Check if critical tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    RAISE EXCEPTION 'Migration 001_initial_schema.sql must be applied first. Table user_profiles does not exist.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    RAISE EXCEPTION 'Migration 001_initial_schema.sql must be applied first. Table products does not exist.';
  END IF;
END $$;

-- ============================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================
-- These indexes optimize common query patterns for the e-commerce workflow

-- Index for finding user by email (login, registration checks)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email_verified ON user_profiles(email, email_verified);

-- Index for product variant stock queries (out of stock, low stock alerts)
CREATE INDEX IF NOT EXISTS idx_product_variants_quantity_product ON product_variants(product_id, quantity);

-- Index for cart items by variant is defined in migration 006 (where cart_items lives)

-- Index for pending stock notifications (batch notification processing)
CREATE INDEX IF NOT EXISTS idx_stock_notifications_pending ON stock_notifications(variant_id, notified_at) WHERE notified_at IS NULL;

-- Index for order status filtering and sorting (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Index for user order history (customer order tracking page)
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- ============================================
-- ADDITIONAL CONSTRAINTS
-- ============================================

-- Ensure product variant quantity is never negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'product_variants_quantity_check'
  ) THEN
    ALTER TABLE product_variants 
    ADD CONSTRAINT product_variants_quantity_check CHECK (quantity >= 0);
  END IF;
END $$;

-- Ensure order quantity is positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'orders_quantity_check'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_quantity_check CHECK (quantity > 0);
  END IF;
END $$;

-- Ensure confirmed_price is positive when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'orders_confirmed_price_check'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_confirmed_price_check CHECK (confirmed_price IS NULL OR confirmed_price > 0);
  END IF;
END $$;

-- ============================================
-- BUSINESS LOGIC FUNCTIONS
-- ============================================

-- Function to check and reserve stock atomically
-- This prevents race conditions when multiple users order the same item
CREATE OR REPLACE FUNCTION reserve_stock(
  p_variant_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT quantity INTO v_current_stock
  FROM product_variants
  WHERE id = p_variant_id
  FOR UPDATE;
  
  -- Check if sufficient stock is available
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product variant not found: %', p_variant_id;
  END IF;
  
  IF v_current_stock < p_quantity THEN
    RETURN FALSE; -- Insufficient stock
  END IF;
  
  -- Decrement stock
  UPDATE product_variants
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_variant_id;
  
  RETURN TRUE; -- Stock reserved successfully
END;
$$ LANGUAGE plpgsql;

-- Function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION restore_stock(
  p_variant_id UUID,
  p_quantity INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE product_variants
  SET quantity = quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock variants (quantity <= 2)
CREATE OR REPLACE FUNCTION get_low_stock_variants()
RETURNS TABLE(
  variant_id UUID,
  product_id UUID,
  product_name VARCHAR(255),
  color VARCHAR(100),
  size VARCHAR(50),
  quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.id AS variant_id,
    p.id AS product_id,
    p.name AS product_name,
    pv.color,
    pv.size,
    pv.quantity
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE pv.quantity > 0 AND pv.quantity <= 2
  ORDER BY pv.quantity ASC, p.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to notify users when stock becomes available
CREATE OR REPLACE FUNCTION notify_stock_available(
  p_variant_id UUID
) RETURNS TABLE(
  notification_id UUID,
  email TEXT,
  user_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sn.id AS notification_id,
    sn.email,
    sn.user_id
  FROM stock_notifications sn
  WHERE sn.variant_id = p_variant_id
    AND sn.notified_at IS NULL;
  
  -- Mark notifications as processed
  UPDATE stock_notifications
  SET notified_at = NOW()
  WHERE variant_id = p_variant_id
    AND notified_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS FOR BUSINESS LOGIC
-- ============================================

-- Trigger to prevent order cancellation after shipping
CREATE OR REPLACE FUNCTION prevent_cancellation_after_shipping()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('shipped', 'delivered') AND NEW.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot cancel order after it has been shipped or delivered';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_order_cancellation ON orders;
CREATE TRIGGER check_order_cancellation
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled')
  EXECUTE FUNCTION prevent_cancellation_after_shipping();

-- Trigger to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION restore_stock_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM restore_stock(NEW.variant_id, NEW.quantity);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restore_stock_trigger ON orders;
CREATE TRIGGER restore_stock_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled')
  EXECUTE FUNCTION restore_stock_on_cancellation();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for admin dashboard: orders with product details
CREATE OR REPLACE VIEW admin_order_details AS
SELECT 
  o.id AS order_id,
  o.order_id AS order_number,
  o.status,
  o.quantity,
  o.price,
  o.confirmed_price,
  o.admin_notes,
  o.contacted_at,
  o.created_at,
  o.updated_at,
  -- User details
  up.id AS user_id,
  up.name AS customer_name,
  up.email AS customer_email,
  o.phone AS customer_phone,
  -- Product details
  p.id AS product_id,
  p.name AS product_name,
  p.category AS product_category,
  pv.id AS variant_id,
  pv.color AS variant_color,
  pv.size AS variant_size,
  pv.image_url AS variant_image,
  -- Address
  o.address_line1,
  o.address_line2,
  o.city,
  o.state,
  o.postal_code,
  o.country
FROM orders o
JOIN user_profiles up ON o.user_id = up.id
JOIN product_variants pv ON o.variant_id = pv.id
JOIN products p ON pv.product_id = p.id;

-- View for customer order history
CREATE OR REPLACE VIEW customer_order_history AS
SELECT 
  o.id AS order_id,
  o.order_id AS order_number,
  o.status,
  o.quantity,
  o.price,
  o.confirmed_price,
  o.created_at,
  o.updated_at,
  -- Product details
  p.name AS product_name,
  p.category AS product_category,
  pv.color AS variant_color,
  pv.size AS variant_size,
  pv.image_url AS variant_image,
  -- User
  o.user_id
FROM orders o
JOIN product_variants pv ON o.variant_id = pv.id
JOIN products p ON pv.product_id = p.id;

-- View for product stock status
CREATE OR REPLACE VIEW product_stock_status AS
SELECT 
  p.id AS product_id,
  p.name AS product_name,
  p.category,
  pv.id AS variant_id,
  pv.color,
  pv.size,
  pv.quantity,
  pv.price,
  pv.image_url,
  CASE 
    WHEN pv.quantity = 0 THEN 'out_of_stock'
    WHEN pv.quantity <= 2 THEN 'low_stock'
    ELSE 'in_stock'
  END AS stock_status
FROM products p
JOIN product_variants pv ON p.id = pv.product_id;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION reserve_stock IS 'Atomically checks and reserves stock for an order, preventing race conditions';
COMMENT ON FUNCTION restore_stock IS 'Restores stock quantity when an order is cancelled';
COMMENT ON FUNCTION get_low_stock_variants IS 'Returns all product variants with quantity <= 2 for admin alerts';
COMMENT ON FUNCTION notify_stock_available IS 'Returns list of users to notify when stock becomes available and marks notifications as sent';

COMMENT ON VIEW admin_order_details IS 'Complete order information for admin dashboard with customer and product details';
COMMENT ON VIEW customer_order_history IS 'Customer-facing order history with product details';
COMMENT ON VIEW product_stock_status IS 'Product inventory status with stock level indicators';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- RLS is defined in migration 009_fix_row_level_security.sql using portable,
-- self-hosted PostgreSQL primitives (session GUCs via current_setting()).
-- The previous Supabase-specific `auth.uid()` policies were removed because this
-- project targets a self-hosted PostgreSQL instance (Docker), not Supabase.

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 002_security_architecture_overhaul.sql completed successfully';
  RAISE NOTICE 'Added: Performance indexes, business logic functions, triggers, and views';
  RAISE NOTICE 'RLS is configured separately in migration 009 (self-hosted PostgreSQL)';
END $$;
