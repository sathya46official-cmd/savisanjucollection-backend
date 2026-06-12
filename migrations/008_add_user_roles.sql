-- SaviSanju Collections Database Schema
-- Migration: 008_add_user_roles
-- Description: Adds a trusted `role` column to user_profiles so authorization is
--              based on a server-controlled database value instead of a guessable
--              email address. Fixes CRITICAL privilege escalation / admin takeover.
--
-- Security notes:
--   * Authorization MUST be based on this column (or the JWT minted from it),
--     never on matching an email string against a hardcoded ADMIN_EMAIL.
--   * Registration NEVER sets this column, so new users always default to 'user'.
--   * Promoting an admin is an explicit, out-of-band operation (see
--     scripts/create-admin.ts) and cannot be triggered through the public API.

-- ============================================
-- ROLE COLUMN
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles
      ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';
  END IF;
END $$;

-- Constrain role to a known set of values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

COMMENT ON COLUMN user_profiles.role IS 'Authorization role (user|admin). Trusted source for admin checks. Never set via public API.';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 008_add_user_roles.sql completed: added trusted role column to user_profiles';
END $$;
