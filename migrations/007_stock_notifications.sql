-- Migration 007: Stock notification requests table
CREATE TABLE IF NOT EXISTS stock_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(email, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_notify_variant ON stock_notifications(variant_id);
