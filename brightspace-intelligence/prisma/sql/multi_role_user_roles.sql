-- Multi-role identity foundation.
--
-- This script adds the user_roles join table, backfills one role assignment
-- per existing users.role_id, and marks the legacy role as the initial
-- primary role. It is intentionally backward compatible: users.role_id
-- remains untouched so auth and guards can migrate gradually.

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP(6) DEFAULT NOW(),
  updated_at TIMESTAMP(6) DEFAULT NOW()
);

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) DEFAULT NOW();

ALTER TABLE user_roles
  ALTER COLUMN is_primary SET DEFAULT FALSE;

ALTER TABLE user_roles
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE user_roles
SET
  is_primary = COALESCE(is_primary, FALSE),
  updated_at = COALESCE(updated_at, NOW())
WHERE is_primary IS NULL OR updated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_id_key
  ON user_roles (user_id, role_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON user_roles (role_id);

INSERT INTO user_roles (user_id, role_id, is_primary)
SELECT u.id, u.role_id, TRUE
FROM users u
WHERE u.role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO UPDATE
SET is_primary = CASE
  WHEN user_roles.is_primary IS TRUE THEN TRUE
  ELSE EXCLUDED.is_primary
END;
