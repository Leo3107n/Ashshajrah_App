import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { id } = await params;
    const items = await prisma.$queryRaw`
      SELECT
        sp.id::text AS id,
        e.id::text AS enrollment_id,
        u.full_name,
        u.email,
        u.phone
      FROM courses c
      INNER JOIN enrollments e ON e.course_id = c.id
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users u ON u.id = sp.user_id
      WHERE c.id = ${id}::uuid
        AND LOWER(e.status) = 'active'
        AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
        AND u.status = 'active'::user_status
      ORDER BY u.full_name ASC
    `;

    return json("Class students fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to fetch class students.", 500);
  }
}
