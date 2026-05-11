-- Migration: Allow guest orders (user_id can be NULL)
-- This allows customers to place orders without creating an account

-- Make user_id nullable in orders table
ALTER TABLE orders 
  ALTER COLUMN user_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL
-- (The existing constraint already has ON DELETE CASCADE, so we just need to allow NULL)

-- Add a comment to document this change
COMMENT ON COLUMN orders.user_id IS 'User ID (NULL for guest orders)';
