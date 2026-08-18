import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const [summary, items] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COUNT(ls.id)::int AS total_conducted,
          COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') IN ('present','partial'))::int AS attended_classes,
          COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') = 'absent' OR la.id IS NULL)::int AS absent_classes,
          COALESCE(
            ROUND(
              (COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') IN ('present','partial'))::numeric
                / NULLIF(COUNT(ls.id), 0)) * 100
            ),
            0
          )::int AS attendance_percentage
        FROM student_profiles sp
        INNER JOIN lecture_schedules ls ON (
          ls.student_id = sp.id
          OR ls.enrollment_id IN (
            SELECT e2.id
            FROM enrollments e2
            WHERE e2.course_id IN (
              SELECT course_id
              FROM enrollments
              WHERE student_id = sp.id
                AND LOWER(status) = 'active'
            )
          )
        )
        LEFT JOIN lecture_attendance la ON la.lecture_id = ls.id AND la.user_id = sp.user_id
        WHERE sp.user_id = ${session.user.id}::uuid
          AND ls.status::text = 'verified_by_coordinator'
      `,
      prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.title,
          sub.name AS subject_name,
          tu.full_name AS teacher_name,
          ls.scheduled_start::text AS scheduled_start,
          COALESCE(la.status::text, 'absent') AS attendance_status,
          la.source::text AS source,
          COALESCE(la.duration_minutes, 0)::int AS duration_minutes,
          COALESCE(la.status::text, 'absent') AS status
        FROM student_profiles sp
        INNER JOIN lecture_schedules ls ON (
          ls.student_id = sp.id
          OR ls.enrollment_id IN (
            SELECT e2.id
            FROM enrollments e2
            WHERE e2.course_id IN (
              SELECT course_id
              FROM enrollments
              WHERE student_id = sp.id
                AND LOWER(status) = 'active'
            )
          )
        )
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN lecture_attendance la ON la.lecture_id = ls.id AND la.user_id = sp.user_id
        WHERE sp.user_id = ${session.user.id}::uuid
          AND ls.status::text = 'verified_by_coordinator'
        ORDER BY ls.scheduled_start DESC
      `
    ]);
    return json("Attendance fetched.", 200, { summary: summary?.[0] || {}, items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load attendance.", 500);
  }
}
