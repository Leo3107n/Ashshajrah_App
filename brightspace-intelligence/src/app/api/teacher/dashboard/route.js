import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getCurrentWeekRange, getDayRange } from "@/lib/dateTime";
import { getActiveHeadlines } from "@/lib/headlines";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function getTeacherProfile(session) {
  if (String(session.user.role).toLowerCase() === "admin") return null;
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return teacher;
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const teacher = await getTeacherProfile(session);
    const teacherFilter = teacher?.id ? `WHERE ls.teacher_id = $1::uuid` : "";
    const teacherFilterForSubquery = teacher?.id ? `WHERE ls3.teacher_id = $1::uuid` : "";
    const values = teacher?.id ? [teacher.id] : [];
    const todayRange = getDayRange(new Date());
    const weekRange = getCurrentWeekRange(new Date());
    const todayStartIndex = values.length + 1;
    const todayEndIndex = values.length + 2;
    const weekStartIndex = values.length + 3;
    const weekEndIndex = values.length + 4;
    const statsValues = [...values, todayRange.start, todayRange.end, weekRange.start, weekRange.end];
    const todayValues = [...values, todayRange.start, todayRange.end];

    const [stats] = await prisma.$queryRawUnsafe(
      `
      WITH teacher_courses AS (
        SELECT DISTINCT e.course_id
        FROM lecture_schedules ls3
        INNER JOIN enrollments e ON e.id = ls3.enrollment_id
        ${teacherFilterForSubquery}
      )
      SELECT
        COUNT(*) FILTER (WHERE ls.scheduled_start >= $${todayStartIndex}::timestamp AND ls.scheduled_start <= $${todayEndIndex}::timestamp)::int AS today_lectures,
        COUNT(*) FILTER (WHERE ls.scheduled_start > NOW() AND ls.status::text IN ('scheduled','upcoming','live'))::int AS upcoming_lectures,
        COUNT(*) FILTER (WHERE ls.status::text IN ('completed_by_teacher','verified_by_coordinator') AND ls.scheduled_start >= $${weekStartIndex}::timestamp AND ls.scheduled_start <= $${weekEndIndex}::timestamp)::int AS completed_this_week,
        COUNT(*) FILTER (WHERE ls.status::text IN ('scheduled','upcoming','live','missed'))::int AS pending_completion_reports,
        (
          SELECT COUNT(DISTINCT e2.student_id)::int
          FROM enrollments e2
          WHERE e2.course_id IN (SELECT course_id FROM teacher_courses)
            AND LOWER(e2.status) = 'active'
        ) AS assigned_students,
        COUNT(DISTINCT ls.subject_id)::int AS assigned_subjects
      FROM lecture_schedules ls
      ${teacherFilter}
      `,
      ...statsValues
    );

    const [today, headlines] = await Promise.all([
      prisma.$queryRawUnsafe(
      `
      WITH course_stats AS (
        SELECT
          e2.course_id,
          COUNT(DISTINCT e2.student_id)::int AS student_count,
          STRING_AGG(su2.full_name, ', ' ORDER BY su2.full_name) AS student_name
        FROM enrollments e2
        INNER JOIN student_profiles sp2 ON sp2.id = e2.student_id
        INNER JOIN users su2 ON su2.id = sp2.user_id
        WHERE LOWER(e2.status) = 'active'
        GROUP BY e2.course_id
      )
      SELECT
        ls.id::text AS id,
        ls.google_calendar_event_id,
        ls.google_meet_link,
        ls.meet_link_source,
        ls.title,
        ls.teacher_id::text AS teacher_id,
        ls.subject_id::text AS subject_id,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.status::text AS status,
        COALESCE(cs.student_count, 0) AS student_count,
        COALESCE(cs.student_name, '') AS student_name,
        sub.name AS subject_name
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      LEFT JOIN course_stats cs ON cs.course_id = e.course_id
      ${teacherFilter}
      ${teacherFilter ? "AND" : "WHERE"} ls.scheduled_start >= $${todayStartIndex}::timestamp
      AND ls.scheduled_start <= $${todayEndIndex}::timestamp
      ORDER BY ls.scheduled_start ASC, ls.id ASC
      `,
      ...todayValues
      ),
      getActiveHeadlines(),
    ]);

    return json("Teacher dashboard fetched.", 200, { stats, today, headlines });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load teacher dashboard.", 500);
  }
}
