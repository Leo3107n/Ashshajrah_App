import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];
const VALID = new Set(["present", "absent", "late", "partial"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function POST(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json();
    const status = String(body?.status || "").toLowerCase();
    if (!VALID.has(status)) return json("Invalid attendance status.", 400);

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT ls.id::text AS id, su.id::text AS student_user_id
          FROM lecture_schedules ls
          INNER JOIN student_profiles sp ON sp.id = ls.student_id
          INNER JOIN users su ON su.id = sp.user_id
          WHERE ls.id = ${id}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT ls.id::text AS id, su.id::text AS student_user_id
          FROM lecture_schedules ls
          INNER JOIN student_profiles sp ON sp.id = ls.student_id
          INNER JOIN users su ON su.id = sp.user_id
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${id}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    if (!lecture?.id) return json("Lecture not found.", 404);

    await prisma.$executeRaw`
      INSERT INTO lecture_attendance (id, lecture_id, user_id, role_type, source, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${id}::uuid, ${lecture.student_user_id}::uuid, 'student', 'manual'::attendance_source, ${status}::attendance_status, NOW(), NOW())
      ON CONFLICT (lecture_id, user_id)
      DO UPDATE SET status = ${status}::attendance_status, source = 'manual'::attendance_source, updated_at = NOW()
    `;
    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'attendance_updated', 'lecture_schedules', ${id}::uuid, NOW())
    `;
    return json("Attendance saved.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to save attendance.", 500);
  }
}
