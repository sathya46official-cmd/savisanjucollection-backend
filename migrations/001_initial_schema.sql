-- SaviSanju Collections Database Schema
-- Migration: 001_initial_schema
-- Description: Complete e-commerce schema with security features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  default_phone VARCHAR(15),
  email_verified BOOLEAN DEFAULT FALSE,
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(10),
  country VARCHAR(100) DEFAULT 'India',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User authentication table (passwords)
CREATE TABLE IF NOT EXISTS user_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PRODUCTS
-- ============================================

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants table (colors, sizes, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color VARCHAR(100),
  size VARCHAR(50),
  price INTEGER NOT NULL, -- Price in paise (₹1 = 100 paise)
  quantity INTEGER DEFAULT 0 NOT NULL,
  image_url TEXT,
  is_negotiable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SHOPPING CART
-- ============================================
-- The shopping cart is modelled as a single `cart_items` table keyed by
-- `user_id` (see migration 006_cart_system.sql). The earlier `cart` +
-- `cart_items(cart_id)` design was removed to keep one authoritative schema.

-- ============================================
-- ORDERS
-- ============================================

-- Order status enum
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(50) UNIQUE NOT NULL, -- SAVI-XXXXXXXX format
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER DEFAULT 1 NOT NULL,
  price INTEGER NOT NULL, -- Price in paise at time of order
  confirmed_price INTEGER, -- Final negotiated price in paise
  status order_status DEFAULT 'pending' NOT NULL,
  admin_notes TEXT,
  contacted_at TIMESTAMP WITH TIME ZONE,
  
  -- Delivery address
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  country VARCHAR(100) DEFAULT 'India',
  phone VARCHAR(15) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STOCK NOTIFICATIONS
-- ============================================

-- Stock notifications table
CREATE TABLE IF NOT EXISTS stock_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email, variant_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_quantity ON product_variants(quantity);

-- Cart indexes are defined alongside the cart_items table in migration 006.

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);

-- Stock notification indexes
CREATE INDEX IF NOT EXISTS idx_stock_notifications_variant_id ON stock_notifications(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_notifications_email ON stock_notifications(email);

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_auth_updated_at BEFORE UPDATE ON user_auth
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- NOTE: No admin user is seeded here.
-- Seeding a hardcoded admin (with a known/placeholder password hash) is a
-- security risk (hardcoded credentials / admin account takeover).
-- Create the admin account explicitly and securely instead:
--
--   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong-password>' \
--     npx tsx scripts/create-admin.ts
--
-- The script generates a real bcrypt hash from an environment-provided
-- password and sets role='admin' (see migration 008). The password is never
-- stored in source control.

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE user_profiles IS 'User profile information';
COMMENT ON TABLE user_auth IS 'User authentication credentials';
COMMENT ON TABLE products IS 'Product catalog';
COMMENT ON TABLE product_variants IS 'Product variants (color, size, price)';
COMMENT ON TABLE orders IS 'Customer orders';
COMMENT ON TABLE stock_notifications IS 'Stock availability notification requests';

COMMENT ON COLUMN product_variants.price IS 'Price in paise (₹1 = 100 paise)';
COMMENT ON COLUMN product_variants.quantity IS 'Available stock quantity';
COMMENT ON COLUMN orders.order_id IS 'Human-readable order ID (SAVI-XXXXXXXX)';
COMMENT ON COLUMN orders.price IS 'Original price at time of order (paise)';
COMMENT ON COLUMN orders.confirmed_price IS 'Final negotiated price (paise)';
