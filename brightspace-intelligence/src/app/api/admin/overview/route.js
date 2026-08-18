import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function getRoleCounts() {
  const rows = await prisma.$queryRaw`
    SELECT
      LOWER(r.name) AS role_name,
      COUNT(*)::int AS total
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    GROUP BY LOWER(r.name)
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.role_name] = Number(row.total || 0);
    return accumulator;
  }, {});
}

async function getUserStatusCounts() {
  const rows = await prisma.$queryRaw`
    SELECT
      LOWER(status::text) AS status_name,
      COUNT(*)::int AS total
    FROM users
    GROUP BY LOWER(status::text)
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.status_name] = Number(row.total || 0);
    return accumulator;
  }, {});
}

async function getNewLeadCount() {
  try {
    const [row] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total
      FROM registration_leads
      WHERE LOWER(status::text) = 'new_lead'
    `;

    return Number(row?.total || 0);
  } catch {
    return 0;
  }
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (role !== "admin" && role !== "superadmin") {
    return json("Forbidden.", 403);
  }

  try {
    const [roleCounts, statusCounts, newLeadCount] = await Promise.all([
      getRoleCounts(),
      getUserStatusCounts(),
      getNewLeadCount(),
    ]);

    const totalUsers = Object.values(roleCounts).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );

    return json("Admin overview fetched.", 200, {
      stats: {
        totalUsers,
        totalStudents: roleCounts.student || 0,
        totalParents: roleCounts.parent || 0,
        totalTeachers: roleCounts.teacher || 0,
        totalCoordinators: roleCounts.coordinator || 0,
        activeUsers: statusCounts.active || 0,
        suspendedUsers: statusCounts.suspended || 0,
        newRegistrationLeads: newLeadCount,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch admin overview.",
      500
    );
  }
}
