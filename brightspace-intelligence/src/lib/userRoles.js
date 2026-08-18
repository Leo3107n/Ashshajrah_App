import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export async function getUserRoles(userId, tx = prisma) {
  if (!userId) return [];

  const roles = await tx.$queryRaw(
    Prisma.sql`
      SELECT
        ur.id::text AS id,
        ur.user_id::text AS user_id,
        ur.role_id::text AS role_id,
        COALESCE(ur.is_primary, false) AS is_primary,
        LOWER(r.name) AS role_name
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${userId}::uuid
      ORDER BY COALESCE(ur.is_primary, false) DESC, r.name ASC
    `
  );

  if (roles.length) {
    return roles.map((role) => ({
      ...role,
      role_name: normalizeRole(role.role_name),
    }));
  }

  // Compatibility fallback while the app still relies on users.role_id in
  // some places. This keeps the new helper safe before every environment has
  // run the backfill SQL.
  const legacyRoles = await tx.$queryRaw(
    Prisma.sql`
      SELECT
        u.id::text AS user_id,
        u.role_id::text AS role_id,
        LOWER(r.name) AS role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ${userId}::uuid
      LIMIT 1
    `
  );

  return legacyRoles.map((role) => ({
    id: "",
    user_id: role.user_id,
    role_id: role.role_id,
    is_primary: true,
    role_name: normalizeRole(role.role_name),
  }));
}

export async function getPrimaryUserRole(userId, tx = prisma) {
  const [role] = await getUserRoles(userId, tx);
  return role || null;
}

export async function getUserRoleNames(userId, tx = prisma) {
  const roles = await getUserRoles(userId, tx);
  return roles.map((role) => role.role_name);
}
