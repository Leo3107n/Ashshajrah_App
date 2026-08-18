import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

/** Student-only academic progress assembled from owned enrollments. */
export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const [student] = await prisma.$queryRaw`
      SELECT id::text AS id, user_id::text AS user_id
      FROM student_profiles
      WHERE user_id = ${session.user.id}::uuid
      LIMIT 1
    `;
    if (!student?.id) return json("Student profile not found.", 404);

    const [subjects, items] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          sub.id::text AS subject_id,
          sub.name AS subject_name,
          COUNT(DISTINCT ls.id) FILTER (
            WHERE ls.status::text = 'verified_by_coordinator'
          )::int AS verified_lectures,
          COUNT(DISTINCT lcr.id)::int AS progress_reports,
          COUNT(DISTINCT ls.id) FILTER (
            WHERE ls.status::text = 'verified_by_coordinator'
              AND COALESCE(la.status::text, 'absent') IN ('present', 'partial')
          )::int AS attended_lectures,
          COUNT(DISTINCT h.id)::int AS homework_total,
          COUNT(DISTINCT h.id) FILTER (
            WHERE h.status::text IN ('submitted', 'reviewed')
          )::int AS homework_completed
        FROM enrollments e
        INNER JOIN course_subjects cs ON cs.course_id = e.course_id
        INNER JOIN subjects sub ON sub.id = cs.subject_id
        LEFT JOIN lecture_schedules ls ON (
          ls.subject_id = sub.id
          AND (
            ls.enrollment_id = e.id
            OR ls.student_id = ${student.id}::uuid
          )
        )
        LEFT JOIN lecture_completion_reports lcr ON (
          lcr.lecture_id = ls.id
          AND ls.status::text = 'verified_by_coordinator'
        )
        LEFT JOIN lecture_attendance la ON (
          la.lecture_id = ls.id
          AND la.user_id = ${student.user_id}::uuid
        )
        LEFT JOIN homework h ON (
          h.subject_id = sub.id
          AND h.student_id = ${student.id}::uuid
        )
        WHERE e.student_id = ${student.id}::uuid
          AND LOWER(e.status) = 'active'
        GROUP BY sub.id, sub.name
        ORDER BY sub.name
      `,
      prisma.$queryRaw`
        SELECT
          lcr.id::text AS id,
          ls.id::text AS lecture_id,
          ls.title AS lecture_title,
          ls.scheduled_start::text AS scheduled_start,
          sub.id::text AS subject_id,
          sub.name AS subject_name,
          u.full_name AS teacher_name,
          lcr.summary,
          lcr.topic_covered,
          lcr.homework_given,
          lcr.student_performance,
          lcr.submitted_at::text AS submitted_at,
          COALESCE(la.status::text, 'absent') AS attendance_status,
          COALESCE(la.duration_minutes, 0)::int AS duration_minutes
        FROM lecture_completion_reports lcr
        INNER JOIN lecture_schedules ls ON ls.id = lcr.lecture_id
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        INNER JOIN teacher_profiles tp ON tp.id = lcr.teacher_id
        INNER JOIN users u ON u.id = tp.user_id
        LEFT JOIN lecture_attendance la ON (
          la.lecture_id = ls.id
          AND la.user_id = ${student.user_id}::uuid
        )
        WHERE ls.status::text = 'verified_by_coordinator'
          AND (
            ls.student_id = ${student.id}::uuid
            OR e.student_id = ${student.id}::uuid
            OR e.course_id IN (
              SELECT course_id
              FROM enrollments
              WHERE student_id = ${student.id}::uuid
                AND LOWER(status) = 'active'
            )
          )
        ORDER BY ls.scheduled_start DESC, lcr.submitted_at DESC
      `,
    ]);

    const subjectSummary = subjects.map((subject) => ({
      ...subject,
      attendance_percentage: subject.verified_lectures
        ? Math.round(
            (subject.attended_lectures / subject.verified_lectures) * 100
          )
        : 0,
      homework_percentage: subject.homework_total
        ? Math.round(
            (subject.homework_completed / subject.homework_total) * 100
          )
        : 0,
    }));

    return json("Student progress reports fetched.", 200, {
      subjects: subjectSummary,
      items,
      summary: {
        total_subjects: subjectSummary.length,
        total_reports: items.length,
        average_attendance: subjectSummary.length
          ? Math.round(
              subjectSummary.reduce(
                (total, subject) => total + subject.attendance_percentage,
                0
              ) / subjectSummary.length
            )
          : 0,
        average_homework: subjectSummary.length
          ? Math.round(
              subjectSummary.reduce(
                (total, subject) => total + subject.homework_percentage,
                0
              ) / subjectSummary.length
            )
          : 0,
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return (
      guard ||
      json(
        error instanceof Error
          ? error.message
          : "Unable to load Student progress reports.",
        500
      )
    );
  }
}
