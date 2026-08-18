/**
 * Read-only validation for the multi-role foundation.
 *
 * Confirms that the new user_roles table can support a gradual migration by
 * checking:
 * - the table exists
 * - legacy users.role_id assignments are backfilled into user_roles
 * - no duplicate (user_id, role_id) mappings exist
 * - each mapped user has at least one primary role
 *
 * This script does not modify data.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const results = [];

function check(name, condition, detail) {
  results.push({ name, passed: Boolean(condition), detail });
  if (!condition) {
    throw new Error(`${name}: ${detail}`);
  }
}

async function main() {
  const [tableExists] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'user_roles'
    ) AS exists
  `;

  check("user_roles table exists", Boolean(tableExists?.exists), "Expected public.user_roles to exist.");

  const [legacyUserCount] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE role_id IS NOT NULL
  `;

  const [mappedLegacyCount] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT u.id)::int AS count
    FROM users u
    INNER JOIN user_roles ur
      ON ur.user_id = u.id
     AND ur.role_id = u.role_id
    WHERE u.role_id IS NOT NULL
  `;

  check(
    "legacy role backfill coverage",
    Number(mappedLegacyCount?.count || 0) === Number(legacyUserCount?.count || 0),
    `Expected ${legacyUserCount?.count || 0} legacy users to be backfilled, found ${mappedLegacyCount?.count || 0}.`
  );

  const [duplicateMappings] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT user_id, role_id, COUNT(*)::int AS duplicate_count
      FROM user_roles
      GROUP BY user_id, role_id
      HAVING COUNT(*) > 1
    ) duplicates
  `;

  check(
    "no duplicate user_roles mappings",
    Number(duplicateMappings?.count || 0) === 0,
    `Found ${duplicateMappings?.count || 0} duplicate (user_id, role_id) mappings.`
  );

  const [missingPrimary] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT ur.user_id
      FROM user_roles ur
      GROUP BY ur.user_id
      HAVING COUNT(*) FILTER (WHERE COALESCE(ur.is_primary, false) = true) = 0
    ) users_without_primary
  `;

  check(
    "every mapped user has a primary role",
    Number(missingPrimary?.count || 0) === 0,
    `Found ${missingPrimary?.count || 0} users without a primary role mapping.`
  );

  const [orphanedMappings] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM user_roles ur
    LEFT JOIN users u ON u.id = ur.user_id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id IS NULL OR r.id IS NULL
  `;

  check(
    "no orphaned user_roles references",
    Number(orphanedMappings?.count || 0) === 0,
    `Found ${orphanedMappings?.count || 0} orphaned user_roles rows.`
  );

  const passed = results.filter((item) => item.passed).length;
  console.log(`User role foundation verification passed: ${passed}/${results.length} checks.`);
  for (const result of results) {
    console.log(`PASS  ${result.name}`);
  }
}

main()
  .catch((error) => {
    console.error(`User role foundation verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
