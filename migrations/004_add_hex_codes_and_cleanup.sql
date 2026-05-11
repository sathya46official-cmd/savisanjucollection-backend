-- Migration 004: Add hex_code column and cleanup duplicates
-- Add hex_code column to product_variants
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS hex_code VARCHAR(7);

-- Update hex codes for existing colors
UPDATE product_variants SET hex_code = '#DC143C' WHERE LOWER(color) LIKE '%crimson%' OR LOWER(color) LIKE '%ruby%';
UPDATE product_variants SET hex_code = '#6A0DAD' WHERE LOWER(color) LIKE '%purple%';
UPDATE product_variants SET hex_code = '#228B22' WHERE LOWER(color) LIKE '%forest green%' OR LOWER(color) LIKE '%emerald%';
UPDATE product_variants SET hex_code = '#FF69B4' WHERE LOWER(color) LIKE '%rose%' OR LOWER(color) LIKE '%pink%';
UPDATE product_variants SET hex_code = '#FF8C00' WHERE LOWER(color) LIKE '%burnt orange%';
UPDATE product_variants SET hex_code = '#800000' WHERE LOWER(color) LIKE '%maroon%';
UPDATE product_variants SET hex_code = '#FFD700' WHERE LOWER(color) LIKE '%golden yellow%' OR LOWER(color) LIKE '%gold%';
UPDATE product_variants SET hex_code = '#191970' WHERE LOWER(color) LIKE '%midnight blue%';
UPDATE product_variants SET hex_code = '#0000CD' WHERE LOWER(color) LIKE '%royal blue%';
UPDATE product_variants SET hex_code = '#DAA520' WHERE LOWER(color) LIKE '%golden oak%' OR LOWER(color) LIKE '%oak%';

-- Set default black for any remaining NULL hex codes
UPDATE product_variants SET hex_code = '#000000' WHERE hex_code IS NULL;

-- Add featured flag to products for curated collection display
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- Add display_order for controlling collection order
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

COMMENT ON COLUMN product_variants.hex_code IS 'Hex color code for the variant color';
COMMENT ON COLUMN products.featured IS 'Whether to show this product in the homepage collection accordion';
COMMENT ON COLUMN products.display_order IS 'Order in which to display featured products (lower = first)';
