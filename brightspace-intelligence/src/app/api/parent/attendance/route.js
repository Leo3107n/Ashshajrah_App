import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { buildParentStudentScope, getScopedParentChildren } from "@/lib/parentScope";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = String(searchParams.get("childId") || "").trim();
    const scope = buildParentStudentScope(session, childId);
    const visibilityFilter = "COALESCE(ls.status::text, '') = 'verified_by_coordinator'";
    const whereClause = scope.where
      ? `${scope.where} AND ${visibilityFilter}`
      : `WHERE ${visibilityFilter}`;

    const [rows, children] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
        SELECT
          la.id::text AS id,
          la.status::text AS status,
          CASE
            WHEN LOWER(COALESCE(la.status::text, '')) IN ('present', 'late') THEN 'present'
            WHEN LOWER(COALESCE(la.status::text, '')) IN ('partial', 'partial_present') THEN 'partial'
            WHEN LOWER(COALESCE(la.status::text, '')) IN ('absent', 'missed') THEN 'absent'
            ELSE LOWER(COALESCE(la.status::text, 'unknown'))
          END AS attendance_status,
          la.joined_at,
          la.left_at,
          la.duration_minutes,
          COALESCE(ls.title, sub.name, 'Class') AS title,
          ls.title AS class_title,
          ls.scheduled_start,
          ls.scheduled_end,
          sub.name AS subject_name,
          su.full_name AS student_name,
          teacher_user.full_name AS teacher_name
        FROM lecture_attendance la
        INNER JOIN users student_user ON student_user.id = la.user_id
        INNER JOIN student_profiles sp ON sp.user_id = student_user.id
        INNER JOIN users su ON su.id = sp.user_id
        LEFT JOIN lecture_schedules ls ON ls.id = la.lecture_id
        LEFT JOIN subjects sub ON sub.id = ls.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        LEFT JOIN users teacher_user ON teacher_user.id = tp.user_id
        ${scope.joins}
        ${whereClause}
        ORDER BY COALESCE(ls.scheduled_start, la.created_at) DESC
        `,
        ...scope.values
      ),
      getScopedParentChildren(session),
    ]);

    const total = rows.length;
    const present = rows.filter((row) => row.attendance_status === "present").length;
    const absent = rows.filter((row) => row.attendance_status === "absent").length;
    const attendancePercentage = total ? Math.round((present / total) * 100) : 0;

    return json("Attendance fetched.", 200, {
      children,
      items: rows,
      summary: {
        total,
        present,
        percentage: attendancePercentage,
        attendance_percentage: attendancePercentage,
        attended_classes: present,
        absent_classes: absent,
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load attendance.", 500);
  }
}
