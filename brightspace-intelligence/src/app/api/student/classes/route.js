import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

/**
 * Returns only courses enrolled by the signed-in Student. Subjects and teacher
 * assignments are resolved inside those enrollments so a Student cannot query
 * another learner's class membership through this endpoint.
 */
export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const rows = await prisma.$queryRaw`
      SELECT
        e.id::text AS enrollment_id,
        e.status AS enrollment_status,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        c.id::text AS course_id,
        c.title AS course_title,
        c.class_level,
        c.description AS course_description,
        c.status::text AS course_status,
        sub.id::text AS subject_id,
        sub.name AS subject_name,
        sub.description AS subject_description,
        teacher.teacher_id,
        teacher.teacher_name,
        teacher.qualification,
        (
          SELECT COUNT(*)::int
          FROM lecture_schedules ls
          WHERE ls.enrollment_id = e.id
            AND ls.subject_id = sub.id
            AND ls.scheduled_start >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'
            AND ls.status::text IN ('scheduled', 'upcoming')
        ) AS upcoming_lectures,
        (
          SELECT MIN(ls.scheduled_start)::text
          FROM lecture_schedules ls
          WHERE ls.enrollment_id = e.id
            AND ls.subject_id = sub.id
            AND ls.scheduled_start >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'
            AND ls.status::text IN ('scheduled', 'upcoming')
        ) AS next_lecture_at,
        (
          SELECT COUNT(*)::int
          FROM homework h
          INNER JOIN student_profiles target ON target.id = h.student_id
          WHERE target.user_id = ${session.user.id}::uuid
            AND h.subject_id = sub.id
            AND h.status::text = 'pending'
        ) AS pending_homework
      FROM student_profiles sp
      INNER JOIN enrollments e ON e.student_id = sp.id
      INNER JOIN courses c ON c.id = e.course_id
      INNER JOIN course_subjects cs ON cs.course_id = c.id
      INNER JOIN subjects sub ON sub.id = cs.subject_id
      LEFT JOIN LATERAL (
        SELECT
          tp.id::text AS teacher_id,
          u.full_name AS teacher_name,
          tp.qualification
        FROM teacher_assignments ta
        INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
        INNER JOIN users u ON u.id = tp.user_id
        WHERE ta.course_id = c.id
          AND ta.subject_id = sub.id
          AND (ta.student_id IS NULL OR ta.student_id = sp.id)
          AND COALESCE(ta.status, 'active'::user_status) = 'active'::user_status
          AND COALESCE(tp.status, 'active'::user_status) = 'active'::user_status
          AND u.status = 'active'::user_status
        ORDER BY (ta.student_id = sp.id) DESC, ta.created_at DESC
        LIMIT 1
      ) teacher ON true
      WHERE sp.user_id = ${session.user.id}::uuid
      ORDER BY
        CASE WHEN LOWER(e.status) = 'active' THEN 0 ELSE 1 END,
        c.title,
        sub.name
    `;

    const byCourse = new Map();
    for (const row of rows) {
      if (!byCourse.has(row.course_id)) {
        byCourse.set(row.course_id, {
          id: row.course_id,
          enrollment_id: row.enrollment_id,
          title: row.course_title,
          class_level: row.class_level,
          description: row.course_description,
          status: row.course_status,
          enrollment_status: row.enrollment_status,
          start_date: row.start_date,
          end_date: row.end_date,
          subjects: [],
        });
      }

      byCourse.get(row.course_id).subjects.push({
        id: row.subject_id,
        name: row.subject_name,
        description: row.subject_description,
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        teacher_qualification: row.qualification,
        upcoming_lectures: row.upcoming_lectures,
        next_lecture_at: row.next_lecture_at,
        pending_homework: row.pending_homework,
      });
    }

    const items = [...byCourse.values()];
    return json("Student classes fetched.", 200, {
      items,
      summary: {
        total_classes: items.length,
        active_classes: items.filter(
          (item) => String(item.enrollment_status).toLowerCase() === "active"
        ).length,
        total_subjects: items.reduce(
          (total, item) => total + item.subjects.length,
          0
        ),
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return (
      guard ||
      json(
        error instanceof Error ? error.message : "Unable to load Student classes.",
        500
      )
    );
  }
}
