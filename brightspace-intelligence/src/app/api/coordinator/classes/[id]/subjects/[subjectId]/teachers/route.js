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

    const { id, subjectId } = await params;
    const items = await prisma.$queryRaw`
      SELECT DISTINCT
        tp.id::text AS id,
        u.full_name
      FROM teacher_assignments ta
      INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
      INNER JOIN users u ON u.id = tp.user_id
      WHERE ta.course_id = ${id}::uuid
        AND ta.subject_id = ${subjectId}::uuid
        AND ta.student_id IS NULL
        AND ta.status = 'active'::user_status
        AND u.status = 'active'::user_status
      ORDER BY u.full_name ASC
    `;

    return json("Assigned teachers fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to fetch assigned teachers.", 500);
  }
}
