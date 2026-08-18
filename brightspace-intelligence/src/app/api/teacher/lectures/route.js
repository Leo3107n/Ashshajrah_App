import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";
const DISPLAY_STATUS_SQL = `
  LOWER(
    CASE
      WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
      WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
      WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
      ELSE 'ended'
    END
  )
`;

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getTeacherId(session) {
  if (String(session.user.role).toLowerCase() === "admin") return "";
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return teacher.id;
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const teacherId = await getTeacherId(session);
    const { searchParams } = new URL(request.url);
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];
    const values = [];

    if (teacherId) {
      values.push(teacherId);
      conditions.push(`ls.teacher_id = $${values.length}::uuid`);
    }
    if (status) {
      values.push(status);
      conditions.push(
        `(
          CASE
            WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN LOWER(ls.status::text)
            WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
            WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
            ELSE 'ended'
          END
        ) = $${values.length}`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        ls.id::text AS id,
        ls.google_calendar_event_id,
        ls.google_meet_link,
        ls.meet_link_source,
        ls.google_meet_space_id,
        ls.teacher_id::text AS teacher_id,
        ls.subject_id::text AS subject_id,
        ls.title,
        ls.description,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        COALESCE(ls.google_meet_sync_meta->'recording'->>'url', ls.recording_drive_url) AS recording_drive_url,
        ls.status::text AS status,
        ${DISPLAY_STATUS_SQL} AS display_status,
        COALESCE(course_stats.student_count, 0) AS student_count,
        COALESCE(course_stats.student_name, '') AS student_name,
        sub.name AS subject_name,
        c.class_level AS class_level,
        c.title AS course_title,
        lcr.id::text AS report_id
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      INNER JOIN courses c ON c.id = e.course_id
      LEFT JOIN lecture_completion_reports lcr ON lcr.lecture_id = ls.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT e2.student_id)::int AS student_count,
          STRING_AGG(su2.full_name, ', ' ORDER BY su2.full_name) AS student_name
        FROM enrollments e2
        INNER JOIN student_profiles sp2 ON sp2.id = e2.student_id
        INNER JOIN users su2 ON su2.id = sp2.user_id
        WHERE e2.course_id = e.course_id
          AND LOWER(e2.status) = 'active'
      ) course_stats ON TRUE
      ${where}
      ORDER BY ls.scheduled_start ASC, ls.id ASC
      `,
      ...values
    );

    return json("Lectures fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load lectures.", 500);
  }
}
